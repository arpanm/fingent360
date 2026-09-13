import { z } from 'zod';
import { inflateSync, zipSync, strToU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { HoldingRowsSchema, holdingsTotal, type Holding } from './holdings.js';

export const WorkbookResultSchema = z
  .strictObject({
    holdings: HoldingRowsSchema,
    declaredTotalMinor: z.string().regex(/^(0|[1-9][0-9]*)$/),
    declaredRowCount: z.number().int().min(0).max(200),
  })
  .refine(
    (value) =>
      value.declaredRowCount === value.holdings.length &&
      value.declaredTotalMinor === holdingsTotal(value.holdings),
    'Workbook totals do not match.',
  );
export const WorkbookWorkerReplySchema = z.union([
  z.strictObject({ result: WorkbookResultSchema }),
  z.strictObject({ error: z.string().min(1).max(4000) }),
]);

export const WORKBOOK_LIMITS = {
  compressed: 65536,
  entry: 524288,
  expanded: 2097152,
  entries: 32,
} as const;
function bad(message: string): never {
  throw new Error(`Workbook: ${message}`);
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Fixed output inflate prevents attacker-controlled expansion allocation. Never unzipSync uploaded input. */
export function workbookParts(bytes: Uint8Array): Map<string, string> {
  if (bytes.length > WORKBOOK_LIMITS.compressed || bytes.length < 22)
    bad('choose a nonempty XLSX no larger than 64 KiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true),
    u32 = (at: number) => view.getUint32(at, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) {
      end = i;
      break;
    }
  if (end < 0) bad('invalid ZIP directory.');
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10))
    bad('multi-disk archives are unsupported.');
  const count = u16(end + 10),
    directory = u32(end + 16),
    directorySize = u32(end + 12);
  if (
    !count ||
    count > WORKBOOK_LIMITS.entries ||
    directory + directorySize !== end
  )
    bad('invalid or oversized ZIP directory.');
  const allowed =
    /^(\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(core|app)\.xml|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|theme\/theme[0-9]+\.xml|worksheets\/sheet[0-9]+\.xml))$/;
  const result = new Map<string, string>();
  const spans: Array<[number, number]> = [];
  let offset = directory,
    total = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const deadline = Date.now() + 2000;
  for (let n = 0; n < count; n++) {
    if (Date.now() > deadline) bad('parsing time limit exceeded.');
    if (offset + 46 > end || u32(offset) !== 0x02014b50)
      bad('invalid entry directory.');
    const flags = u16(offset + 8),
      method = u16(offset + 10),
      crc = u32(offset + 16),
      compressed = u32(offset + 20),
      size = u32(offset + 24),
      nameLength = u16(offset + 28),
      extraLength = u16(offset + 30),
      commentLength = u16(offset + 32),
      local = u32(offset + 42);
    if (flags & ~0x800 || ![0, 8].includes(method) || u16(offset + 34))
      bad(
        'encrypted, streaming, ZIP64 or unsupported ZIP entries are not accepted.',
      );
    if (offset + 46 + nameLength + extraLength + commentLength > end)
      bad('truncated directory.');
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (!allowed.test(name))
      bad('unsupported workbook part. Use the standard template.');
    if (
      !/^[A-Za-z0-9_./[\]-]{1,160}$/.test(name) ||
      name.startsWith('/') ||
      name.split('/').some((p) => p === '..' || p === '') ||
      result.has(name)
    )
      bad('unsafe or duplicate archive path.');
    for (
      let x = offset + 46 + nameLength;
      x < offset + 46 + nameLength + extraLength;
    ) {
      if (x + 4 > offset + 46 + nameLength + extraLength)
        bad('invalid ZIP extra field.');
      const kind = u16(x),
        len = u16(x + 2);
      if (kind === 1 || x + 4 + len > offset + 46 + nameLength + extraLength)
        bad('ZIP64 or malformed extra field.');
      x += 4 + len;
    }
    if (
      size > WORKBOOK_LIMITS.entry ||
      (total += size) > WORKBOOK_LIMITS.expanded
    )
      bad('expanded workbook exceeds limits.');
    if (
      local + 30 > directory ||
      u32(local) !== 0x04034b50 ||
      u16(local + 6) !== flags ||
      u16(local + 8) !== method ||
      u32(local + 14) !== crc ||
      u32(local + 18) !== compressed ||
      u32(local + 22) !== size
    )
      bad('inconsistent local ZIP header.');
    const start = local + 30 + u16(local + 26) + u16(local + 28),
      finish = start + compressed;
    if (
      finish > directory ||
      decoder.decode(
        bytes.subarray(local + 30, local + 30 + u16(local + 26)),
      ) !== name ||
      spans.some(([a, b]) => local < b && finish > a)
    )
      bad('overlapping or truncated archive entries.');
    spans.push([local, finish]);
    const source = bytes.subarray(start, finish);
    // One extra byte detects forged smaller declarations; fflate's explicit out disables buffer growth.
    const output =
      method === 0
        ? source
        : inflateSync(source, { out: new Uint8Array(size + 1) });
    if (output.length !== size || crc32(output) !== crc)
      bad('entry length or CRC check failed.');
    if (!name.endsWith('.xml') && !name.endsWith('.rels'))
      bad('embedded objects or unsupported workbook parts.');
    result.set(name, decoder.decode(output));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) bad('directory contains trailing data.');
  return result;
}
function xml(source: string, inertMetadata = false): Record<string, unknown> {
  // Fixed-template XML uses unprefixed elements. Reject all qualified element names,
  // including legal hyphen/dot/non-ASCII prefixes; attributes such as r:id remain valid.
  if (!inertMetadata && /<\/?[^\s<>!?/]+:[^\s<>/]+/.test(source))
    bad('qualified XML elements are unsupported; use the standard template.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    bad('DTD and entity declarations are prohibited.');
  if ((source.match(/</g)?.length ?? 0) > 12000) bad('too many XML nodes.');
  if (XMLValidator.validate(source) !== true) bad('malformed XML.');
  return new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
    trimValues: false,
    maxNestedTags: 32,
  }).parse(source) as Record<string, unknown>;
}
const list = (value: unknown): Array<Record<string, unknown>> =>
  value === undefined
    ? []
    : ((Array.isArray(value) ? value : [value]) as Array<
        Record<string, unknown>
      >);
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '#text' in value)
    return text((value as Record<string, unknown>)['#text']);
  return '';
}
function reference(value: unknown): string {
  const s = String(value ?? '');
  const rooted = s.startsWith('/');
  if (
    !s ||
    /^[a-z]+:|\\|%|\?|#/i.test(s) ||
    s.split('/').includes('..') ||
    s.includes('//') ||
    (rooted &&
      !/^\/xl\/(?:workbook\.xml|styles\.xml|sharedStrings\.xml|worksheets\/sheet[0-9]+\.xml|theme\/theme[0-9]+\.xml)$/.test(
        s,
      ))
  )
    bad('unsafe relationship target.');
  return s;
}
function decodeText(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, v: string) => {
      const known: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      };
      if (known[v]) return known[v];
      const point = v.startsWith('#x')
        ? parseInt(v.slice(2), 16)
        : parseInt(v.slice(1), 10);
      if (
        !Number.isInteger(point) ||
        point < 32 ||
        point > 0x10ffff ||
        (point >= 0xd800 && point <= 0xdfff)
      )
        bad('invalid character reference.');
      return String.fromCodePoint(point);
    },
  );
}
export function parseHoldingsWorkbook(bytes: Uint8Array): {
  holdings: Holding[];
  declaredTotalMinor: string;
  declaredRowCount: number;
} {
  const parts = workbookParts(bytes);
  for (const [name, source] of parts) {
    if (
      name.startsWith('xl/worksheets/') &&
      /<(?:[A-Za-z0-9_]+:)?f(?:\s|>)/.test(source)
    )
      bad('formulas are prohibited.');
  }
  const parsed = new Map(
    [...parts].map(([name, value]) => {
      // Metadata/theme is bounded and validated but never interpreted as workbook records or relationships.
      const inert =
        /^docProps\/(core|app)\.xml$|^xl\/theme\/theme[0-9]+\.xml$/.test(name);
      const document = xml(value, inert);
      return [name, inert ? {} : document] as const;
    }),
  );
  for (const [name, value] of parsed) {
    if (/vba|externalLink|connection|embedding|activeX|calcChain/i.test(name))
      bad('active or external workbook content is prohibited.');
    if (name.endsWith('.rels'))
      for (const rel of list(
        (value.Relationships as Record<string, unknown>)?.Relationship,
      )) {
        if (rel['@_TargetMode'] === 'External')
          bad('external relationships are prohibited.');
        reference(rel['@_Target']);
      }
  }
  const types = parsed.get('[Content_Types].xml')?.Types as
    Record<string, unknown> | undefined;
  if (!types) bad('content types are missing.');
  for (const type of [...list(types.Override), ...list(types.Default)])
    if (/macro|vba|oleObject|externalLink/i.test(String(type['@_ContentType'])))
      bad('macro-enabled content is prohibited.');
  const rootRels = list(
    (parsed.get('_rels/.rels')?.Relationships as Record<string, unknown>)
      ?.Relationship,
  );
  if (
    !rootRels.some(
      (r) =>
        String(r['@_Type']).endsWith('/officeDocument') &&
        ['xl/workbook.xml', '/xl/workbook.xml'].includes(String(r['@_Target'])),
    )
  )
    bad('standard workbook relationship is missing.');
  const book = parsed.get('xl/workbook.xml')?.workbook as
    Record<string, unknown> | undefined;
  const sheets = list((book?.sheets as Record<string, unknown>)?.sheet);
  if (
    sheets.length !== 2 ||
    sheets.some(
      (s) =>
        !['Holdings', 'Reconciliation'].includes(String(s['@_name'])) ||
        (s['@_state'] && s['@_state'] !== 'visible'),
    )
  )
    bad(
      'use exactly the visible Holdings and Reconciliation sheets from the template.',
    );
  if (new Set(sheets.map((s) => s['@_name'])).size !== 2)
    bad('duplicate sheet names.');
  const relationships = list(
    (
      parsed.get('xl/_rels/workbook.xml.rels')?.Relationships as Record<
        string,
        unknown
      >
    )?.Relationship,
  );
  const shared = list(
    (parsed.get('xl/sharedStrings.xml')?.sst as Record<string, unknown>)?.si,
  );
  if (shared.length > 2000) bad('too many shared strings.');
  const styles = parsed.get('xl/styles.xml')?.styleSheet as
    Record<string, unknown> | undefined;
  const defaultStyle = list(
    (styles?.cellXfs as Record<string, unknown>)?.xf,
  )[0];
  const defaultBase = list(
    (styles?.cellStyleXfs as Record<string, unknown>)?.xf,
  )[0];
  const defaultBaseIsGeneral =
    !defaultBase || String(defaultBase['@_numFmtId'] ?? '0') === '0';
  const defaultIsGeneral =
    !styles ||
    (defaultBaseIsGeneral &&
      !!defaultStyle &&
      String(defaultStyle['@_numFmtId'] ?? '0') === '0' &&
      (defaultStyle['@_xfId'] === undefined || defaultStyle['@_xfId'] === '0'));
  const stringValue = (si: Record<string, unknown>) => {
    if (si.r) bad('rich text is unsupported; use plain text cells.');
    return decodeText(text(si.t));
  };
  const readSheet = (name: string): string[][] => {
    const sheet = sheets.find((s) => s['@_name'] === name)!;
    const rel = relationships.find((r) => r['@_Id'] === sheet['@_r:id']);
    if (!rel || !String(rel['@_Type']).endsWith('/worksheet'))
      bad('sheet relationship missing.');
    const target = reference(rel['@_Target']);
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const content = parsed.get(path)?.worksheet as
      Record<string, unknown> | undefined;
    if (!content) bad('worksheet is missing.');
    if (content.mergeCells || content.hyperlinks)
      bad('merged cells and hyperlinks are unsupported.');
    if (
      list((content.cols as Record<string, unknown>)?.col).some(
        (column) =>
          !['0', 'false', undefined].includes(
            column['@_hidden'] as string | undefined,
          ),
      )
    )
      bad('columns must be visible.');
    const styledColumns = list(
      (content.cols as Record<string, unknown>)?.col,
    ).filter((column) => column['@_style'] !== undefined);
    const rows = list((content.sheetData as Record<string, unknown>)?.row);
    if (rows.length > (name === 'Holdings' ? 201 : 2))
      bad('too many worksheet rows.');
    return rows.map((row, index) => {
      if (
        !['0', 'false', undefined].includes(
          row['@_hidden'] as string | undefined,
        ) ||
        String(row['@_r']) !== String(index + 1)
      )
        bad('rows must be visible and consecutive.');
      const cells = list(row.c);
      const expected = name === 'Holdings' ? 3 : 2;
      if (cells.length !== expected)
        bad(`${name} row ${index + 1} requires ${expected} cells.`);
      return cells.map((cell, col) => {
        if (
          cell['@_r'] !== `${String.fromCharCode(65 + col)}${index + 1}` ||
          cell.f !== undefined
        )
          bad(
            `${name} row ${index + 1}: formulas or misplaced cells are prohibited.`,
          );
        const type = cell['@_t'];
        let value: string;
        if (type === 's') {
          const raw = text(cell.v);
          if (!/^\d+$/.test(raw) || !shared[Number(raw)])
            bad('invalid shared string index.');
          value = stringValue(shared[Number(raw)]!);
        } else if (type === 'inlineStr')
          value = stringValue(cell.is as Record<string, unknown>);
        else if (type === undefined || type === 'n') {
          if (
            !defaultIsGeneral ||
            cell['@_s'] !== undefined ||
            row['@_s'] !== undefined ||
            row['@_customFormat'] !== undefined ||
            styledColumns.some((column) => {
              const min = Number(column['@_min']),
                max = Number(column['@_max']);
              return (
                !Number.isInteger(min) ||
                !Number.isInteger(max) ||
                (col + 1 >= min && col + 1 <= max)
              );
            })
          )
            bad(
              `${name} ${cell['@_r']}: styled numeric cells are unsupported; store this value as text.`,
            );
          value = text(cell.v);
          if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value))
            bad(
              `${name} ${cell['@_r']}: use plain decimal text, not dates or scientific notation.`,
            );
          if (value.replace('.', '').replace(/^0+/, '').length > 15)
            bad(
              `${name} ${cell['@_r']}: values longer than 15 significant digits must be text cells.`,
            );
        } else bad(`${name} ${cell['@_r']}: unsupported cell type.`);
        if (value.length > 100) bad('cell value is too long.');
        return value;
      });
    });
  };
  const rows = readSheet('Holdings');
  if (rows.shift()?.join(',') !== 'isin,quantity,total_cost_paise')
    bad('Holdings headers must be isin,quantity,total_cost_paise.');
  const holdings = HoldingRowsSchema.parse(
    rows.map(([isin, quantity, totalCostMinor]) => ({
      isin,
      quantity,
      totalCostMinor,
    })),
  );
  const reconciliation = readSheet('Reconciliation');
  if (
    reconciliation.length !== 2 ||
    reconciliation[0]?.join(',') !== 'row_count,total_cost_paise'
  )
    bad(
      'Reconciliation requires row_count,total_cost_paise and one declared totals row.',
    );
  const [count, total] = reconciliation[1]!;
  if (count === undefined || total === undefined)
    bad('missing declared totals.');
  if (!/^\d{1,3}$/.test(count) || !/^(0|[1-9]\d{0,18})$/.test(total))
    bad('invalid declared totals.');
  if (Number(count) !== holdings.length || total !== holdingsTotal(holdings))
    bad(
      'declared row count or acquisition-cost total does not match. Correct the workbook before previewing.',
    );
  return {
    holdings,
    declaredTotalMinor: total,
    declaredRowCount: Number(count),
  };
}
const esc = (v: string) =>
  v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
/** Generated blank or clearly labelled synthetic sample; no customer data is included. */
export function holdingsWorkbookTemplate(sample = false): Uint8Array {
  const data: Holding[] = sample
    ? [{ isin: 'INE002A01018', quantity: '1.000001', totalCostMinor: '10001' }]
    : [];
  const sheet = (rows: string[][]) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr" s="1"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/styles.xml':
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="49" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/workbook.xml':
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Holdings" sheetId="1" r:id="rId1"/><sheet name="Reconciliation" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet([
      ['isin', 'quantity', 'total_cost_paise'],
      ...data.map((r) => [r.isin, r.quantity, r.totalCostMinor]),
    ]),
    'xl/worksheets/sheet2.xml': sheet([
      ['row_count', 'total_cost_paise'],
      [String(data.length), holdingsTotal(data)],
    ]),
  };
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
    { level: 6 },
  );
}
export function workbookBase64(bytes: Uint8Array): string {
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw);
}
export function workbookBytes(value: string): Uint8Array {
  if (
    value.length > 87384 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    bad('invalid or oversized base64.');
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
/** Serialize authored template XML; upload parsing never calls this helper. */
export function workbookArchive(
  parts: ReadonlyMap<string, string>,
): Uint8Array {
  return zipSync(
    Object.fromEntries(
      [...parts].map(([name, value]) => [name, strToU8(value)]),
    ),
    { level: 6 },
  );
}
