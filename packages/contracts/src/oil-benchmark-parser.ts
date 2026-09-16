import { inflateSync } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import {
  OilBenchmarkObservationsSchema,
  roundOilSource,
} from './oil-benchmarks.js';

const OIL_WORKBOOK_LIMITS = {
  compressed: 3000000,
  entry: 12000000,
  expanded: 24000000,
  entries: 100,
};
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
export function oilWorkbookParts(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > OIL_WORKBOOK_LIMITS.compressed || bytes.length < 22)
    bad('source XLSX exceeds its 3MB bound.');
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
    count > OIL_WORKBOOK_LIMITS.entries ||
    directory + directorySize !== end
  )
    bad('invalid or oversized ZIP directory.');
  const allowed =
    /^(\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(core|app|custom)\.xml|customXml\/(item[0-9]+\.xml|itemProps[0-9]+\.xml|_rels\/item[0-9]+\.xml\.rels)|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|connections\.xml|theme\/theme[0-9]+\.xml|worksheets\/sheet[0-9]+\.xml|worksheets\/_rels\/sheet[0-9]+\.xml\.rels|drawings\/drawing[0-9]+\.xml|printerSettings\/printerSettings[0-9]+\.bin|tables\/table[0-9]+\.xml))$/;
  const result = new Map<string, Uint8Array>();
  const spans: Array<[number, number]> = [];
  let offset = directory,
    total = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const deadline = Date.now() + 4000;
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
    if (flags & ~0x806 || ![0, 8].includes(method) || u16(offset + 34))
      bad(
        'encrypted, streaming, ZIP64 or unsupported ZIP entries are not accepted.',
      );
    if (offset + 46 + nameLength + extraLength + commentLength > end)
      bad('truncated directory.');
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (!allowed.test(name))
      bad('unsupported workbook part. Use the fixed published distribution.');
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
      size > OIL_WORKBOOK_LIMITS.entry ||
      (total += size) > OIL_WORKBOOK_LIMITS.expanded
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
    result.set(name, output);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) bad('directory contains trailing data.');
  return result;
}

type Node = Record<string, unknown>;
const object = (value: unknown): Node => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return bad('unexpected XML shape.');
  return value as Node;
};
const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
function scalar(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return scalar(object(value)['#text']);
  return '';
}
const mainNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function xml(bytes: Uint8Array, root: string, namespace = mainNs) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (
    /<!DOCTYPE|<!ENTITY/i.test(source) ||
    (source.match(/</g)?.length ?? 0) > 600000 ||
    XMLValidator.validate(source) !== true
  )
    bad('malformed or excessive XML.');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
    trimValues: false,
    maxNestedTags: 32,
  }).parse(source) as Node;
  const value = object(parsed[root]);
  if (value['@_xmlns'] !== namespace) bad('unexpected XML namespace.');
  // The selected data nodes are unprefixed in the documented workbook. Reject
  // nested default bindings and qualified aliases rather than normalizing them.
  {
    const opening = source.indexOf(`<${root}`),
      finish = source.indexOf('>', opening);
    const children = source.slice(finish + 1);
    if (
      /\sxmlns(?::r)?\s*=/.test(children) ||
      /<\/?[^\s<>!?/]+:(?:c|row|v|f|t|si|r|sheetData|cellXfs|xf|numFmt|sheets|sheet|Relationship)(?:\s|[/>])/.test(
        children,
      )
    )
      bad('rebound or unexpected data namespace.');
  }
  return value;
}

/** Reads saved cells only. Connections, drawings, print settings and hidden-sheet metadata are inert. */
export function parsePinkSheetColumns(
  bytes: Uint8Array,
  selected: readonly {
    column: string;
    series: string;
    header: string;
    unit: string;
    precision: 0 | 1;
  }[],
) {
  const columns = ['A', ...selected.map((v) => v.column)];
  const columnNumbers = columns.map((v) =>
    [...v].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0),
  );
  const parts = oilWorkbookParts(bytes),
    deadline = Date.now() + 4000;
  const required = (name: string) =>
    parts.get(name) ?? bad(`missing required part ${name}.`);
  // Every relationship stays inside this ZIP. No external relationship, macro,
  // connection refresh, executable package or arbitrary network target is used.
  for (const [path, body] of parts) {
    if (Date.now() > deadline) bad('parsing time limit exceeded.');
    if (path.endsWith('.xml') || path.endsWith('.rels')) {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
      if (/<!DOCTYPE|<!ENTITY/i.test(text))
        bad('DTD and entity declarations are prohibited.');
    }
    if (!path.endsWith('.rels')) continue;
    const rels = xml(
      body,
      'Relationships',
      'http://schemas.openxmlformats.org/package/2006/relationships',
    );
    const ids = new Set<string>();
    const source =
      path === '_rels/.rels'
        ? ''
        : path.replace('/_rels/', '/').replace(/\.rels$/, '');
    for (const item of list(rels.Relationship)) {
      const rel = object(item),
        id = scalar(rel['@_Id']),
        target = scalar(rel['@_Target']);
      if (
        !id ||
        ids.has(id) ||
        rel['@_TargetMode'] !== undefined ||
        !target ||
        /[:\\%?#]/.test(target) ||
        /externalLink|vbaProject|oleObject|package|attachedTemplate/.test(
          scalar(rel['@_Type']),
        )
      )
        bad('unsafe workbook relationship.');
      ids.add(id);
      const resolvedUrl = new URL(target, `https://workbook.invalid/${source}`);
      if (resolvedUrl.origin !== 'https://workbook.invalid')
        bad('relationship points outside retained workbook.');
      const resolved = resolvedUrl.pathname.slice(1);
      if (!parts.has(resolved))
        bad('relationship points outside retained workbook.');
    }
  }
  const workbook = xml(required('xl/workbook.xml'), 'workbook');
  if (
    workbook['@_xmlns:r'] !==
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  )
    bad('unexpected worksheet relationship namespace.');
  const sheets = list(object(workbook.sheets).sheet).map(object);
  if (sheets.length > 10) bad('too many worksheets.');
  const prices = sheets.filter((sheet) => sheet['@_name'] === 'Monthly Prices');
  if (
    prices.length !== 1 ||
    (prices[0]!['@_state'] !== undefined && prices[0]!['@_state'] !== 'visible')
  )
    bad('missing visible Monthly Prices sheet.');
  const relations = xml(
    required('xl/_rels/workbook.xml.rels'),
    'Relationships',
    'http://schemas.openxmlformats.org/package/2006/relationships',
  );
  const relationship = list(relations.Relationship)
    .map(object)
    .find((rel) => rel['@_Id'] === prices[0]!['@_r:id']);
  if (
    !relationship ||
    !/^worksheets\/sheet[0-9]+\.xml$/.test(scalar(relationship['@_Target'])) ||
    relationship['@_Type'] !==
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet'
  )
    bad('invalid price worksheet binding.');
  const sheet = xml(
    required('xl/' + scalar(relationship['@_Target'])),
    'worksheet',
  );
  for (const entry of list(sheet.cols ? object(sheet.cols).col : undefined)) {
    const col = object(entry),
      min = Number(col['@_min']),
      max = Number(col['@_max']);
    if (
      ['1', 'true'].includes(scalar(col['@_hidden'])) &&
      columnNumbers.some((index) => index >= min && index <= max)
    )
      bad('selected source columns are hidden.');
  }
  const strings = list(xml(required('xl/sharedStrings.xml'), 'sst').si).map(
    (value) => {
      const si = object(value);
      const result =
        si.t !== undefined
          ? scalar(si.t)
          : list(si.r)
              .map((item) => scalar(object(item).t))
              .join('');
      if (result.length > 10000) bad('shared string too long.');
      return result;
    },
  );
  if (strings.length > 10000) bad('too many shared strings.');
  const styles = xml(required('xl/styles.xml'), 'styleSheet');
  const formats = new Map(
    list(styles.numFmts ? object(styles.numFmts).numFmt : undefined).map(
      (value) => {
        const format = object(value);
        return [
          scalar(format['@_numFmtId']),
          scalar(format['@_formatCode']),
        ] as const;
      },
    ),
  );
  const xfs = list(object(styles.cellXfs).xf).map(object);
  const cells = new Map<string, Node>();
  const rows = list(object(sheet.sheetData).row);
  if (rows.length > 2500) bad('too many price rows.');
  for (const value of rows) {
    if (Date.now() > deadline) bad('parsing time limit exceeded.');
    const row = object(value),
      children = list(row.c);
    const rowId = scalar(row['@_r']);
    if (!/^[1-9][0-9]{0,3}$/.test(rowId)) bad('invalid source row identity.');
    if (children.length > 200) bad('too many price columns.');
    for (const item of children) {
      const cell = object(item),
        ref = scalar(cell['@_r']);
      if (!/^[A-Z]{1,3}[1-9][0-9]{0,3}$/.test(ref) || cells.has(ref))
        bad('invalid or duplicate price cell.');
      if (!columns.includes(ref.replace(/[0-9]+$/, ''))) continue;
      if (
        ref.replace(/^[A-Z]+/, '') !== rowId ||
        ['1', 'true'].includes(scalar(row['@_hidden']))
      )
        bad('selected cell has a mismatched or hidden row.');
      if (
        Object.keys(cell).some(
          (key) => !['@_r', '@_s', '@_t', 'v', 'is'].includes(key),
        )
      )
        bad('selected data contain formula or unexpected fields.');
      cells.set(ref, cell);
    }
  }
  const read = (ref: string) => {
    const c = cells.get(ref);
    if (!c) return '';
    if (c['@_t'] === 's') {
      const index = scalar(c.v);
      if (
        !/^(0|[1-9][0-9]{0,4})$/.test(index) ||
        strings[Number(index)] === undefined
      )
        return bad('invalid shared-string reference.');
      return strings[Number(index)]!;
    }
    if (c['@_t'] === 'inlineStr') return scalar(object(c.is).t);
    if (c['@_t'] !== undefined && c['@_t'] !== 'n')
      return bad('unsupported selected cell type.');
    return scalar(c.v);
  };
  if (
    read('A1') !== 'World Bank Commodity Price Data (The Pink Sheet)' ||
    read('A2') !== 'monthly prices in nominal US dollars, 1960 to present' ||
    selected.some(
      (v) =>
        read(v.column + '5') !== v.header || read(v.column + '6') !== v.unit,
    )
  )
    bad('unexpected selected source/header/unit.');
  const updated = /^Updated on ([A-Za-z]+) ([0-9]{2}), ([0-9]{4})$/.exec(
    read('A4'),
  );
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  if (!updated || !months.includes(updated[1]!))
    bad('missing reported workbook update date.');
  const reportedUpdatedOn = z.iso
    .date()
    .parse(
      `${updated[3]}-${String(months.indexOf(updated[1]!) + 1).padStart(2, '0')}-${updated[2]}`,
    );
  const observations: Array<{
    series: string;
    period: string;
    value: string | null;
    sourceValue: string | null;
  }> = [];
  const periods = new Set<string>();
  for (const [ref] of cells) {
    if (!/^A[0-9]+$/.test(ref) || Number(ref.slice(1)) < 7) continue;
    const raw = read(ref);
    if (!raw) continue;
    const match = /^(19[6-9][0-9]|20[0-9]{2})M(0[1-9]|1[0-2])$/.exec(raw);
    if (!match) bad('invalid monthly date label.');
    const period = `${match[1]}-${match[2]}`;
    if (periods.has(period)) bad('duplicate observation month.');
    periods.add(period);
    if (period < '2000-01') continue;
    if (period >= reportedUpdatedOn.slice(0, 7))
      bad('monthly observation is not completed at reported update.');
    for (const { column, series, precision } of selected) {
      const key = column + ref.slice(1),
        text = read(key),
        c = cells.get(key);
      const sourceValue = ['', '…', '...'].includes(text) ? null : text;
      if (sourceValue !== null) {
        const style = scalar(c?.['@_s']),
          xf = /^(0|[1-9][0-9]{0,3})$/.test(style)
            ? xfs[Number(style)]
            : undefined;
        if (
          !xf ||
          (precision === 0
            ? scalar(xf['@_numFmtId']) !== '1'
            : formats.get(scalar(xf['@_numFmtId'])) !== '0.0') ||
          c?.['@_t'] === 's' ||
          c?.['@_t'] === 'inlineStr'
        )
          bad('oil precision or numeric cell type changed.');
      }
      observations.push({
        series,
        period,
        sourceValue,
        value:
          sourceValue === null
            ? null
            : roundPinkSheetValue(sourceValue, precision),
      });
    }
  }
  return {
    reportedUpdatedOn,
    observations: observations.sort(
      (a, b) =>
        a.series.localeCompare(b.series) || a.period.localeCompare(b.period),
    ),
  };
}

/** Existing oil contract retains its exact two-series one-decimal behavior. */
export function parseOilBenchmarks(bytes: Uint8Array) {
  const parsed = parsePinkSheetColumns(bytes, [
    {
      column: 'C',
      series: 'BRENT',
      header: 'Crude oil, Brent',
      unit: '($/bbl)',
      precision: 1,
    },
    {
      column: 'E',
      series: 'WTI',
      header: 'Crude oil, WTI',
      unit: '($/bbl)',
      precision: 1,
    },
  ]);
  return {
    ...parsed,
    observations: OilBenchmarkObservationsSchema.parse(parsed.observations),
  };
}
export function roundPinkSheetValue(value: string, precision: 0 | 1) {
  if (precision === 1) return roundOilSource(value);
  const m =
    /^(-?)(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,20}))?(?:[Ee]([+-]?[0-9]{1,2}))?$/.exec(
      value,
    );
  if (!m) throw Error('Unsupported commodity decimal.');
  const fraction = m[3] ?? '',
    shift = Number(m[4] ?? '0') - fraction.length;
  if (Math.abs(Number(m[4] ?? '0')) > 20)
    throw Error('Commodity exponent exceeds bound.');
  let number = BigInt(m[2] + fraction);
  if (shift >= 0) number *= 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    number = (number + divisor / 2n) / divisor;
  }
  return (m[1] && number !== 0n ? '-' : '') + number.toString();
}
