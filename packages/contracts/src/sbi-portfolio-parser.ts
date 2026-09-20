import { sbiDisplayed } from './portfolio-decimal.js';
export { sbiDisplayed } from './portfolio-decimal.js';
import { inflateSync } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { SbiPortfolioSchema } from './sbi-portfolio.js';
const SBI_WORKBOOK_LIMITS = {
  compressed: 1000000,
  entry: 1000000,
  expanded: 3000000,
  entries: 40,
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
export function sbiWorkbookParts(
  bytes: Uint8Array,
  profile: 'sbi' | 'axis' | 'ccil' = 'sbi',
): Map<string, Uint8Array> {
  const limits =
    profile === 'ccil'
      ? { compressed: 2000000, entry: 6000000, expanded: 8000000, entries: 10 }
      : profile === 'axis'
        ? {
            compressed: 2000000,
            entry: 1000000,
            expanded: 6000000,
            entries: 450,
          }
        : SBI_WORKBOOK_LIMITS;
  if (bytes.length > limits.compressed || bytes.length < 22)
    bad('source XLSX exceeds its 1MB bound.');
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
  if (!count || count > limits.entries || directory + directorySize !== end)
    bad('invalid or oversized ZIP directory.');
  const allowed =
    /^(\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(core|app)\.xml|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|calcChain\.xml|theme\/theme1\.xml|worksheets\/sheet1\.xml|worksheets\/_rels\/sheet1\.xml\.rels|drawings\/drawing1\.xml|drawings\/_rels\/drawing1\.xml\.rels|media\/image[12]\.jpg|externalLinks\/externalLink1\.xml|externalLinks\/_rels\/externalLink1\.xml\.rels|printerSettings\/printerSettings1\.bin))$/;
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
    const axisAllowed =
      /^(\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(core|app)\.xml|customXml\/(item[0-9]+\.xml|itemProps[0-9]+\.xml|_rels\/item[0-9]+\.xml\.rels)|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|calcChain\.xml|theme\/theme[0-9]+\.xml|worksheets\/sheet[0-9]+\.xml|worksheets\/_rels\/sheet[0-9]+\.xml\.rels|drawings\/drawing[0-9]+\.xml|drawings\/_rels\/drawing[0-9]+\.xml\.rels|media\/image[0-9]+\.(png|jpeg|jpg|emf)))$/;
    const ccilAllowed =
      /^(\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(core|app)\.xml|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|theme\/theme1\.xml|worksheets\/sheet1\.xml))$/;
    if (
      !(
        profile === 'ccil'
          ? ccilAllowed
          : profile === 'axis'
            ? axisAllowed
            : allowed
      ).test(name)
    )
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
    if (size > limits.entry || (total += size) > limits.expanded)
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
const list = (v: unknown): Node[] =>
  v === undefined ? [] : ((Array.isArray(v) ? v : [v]) as Node[]);
const text = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : v && typeof v === 'object'
      ? text((v as Node)['#text'])
      : '';
function xml(part: Uint8Array | undefined, root: string) {
  if (!part) throw Error('Required workbook part missing.');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(part);
  if (
    /<!DOCTYPE|<!ENTITY/i.test(raw) ||
    raw.length > 1000000 ||
    XMLValidator.validate(raw) !== true
  )
    throw Error('Unsafe workbook XML.');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    trimValues: false,
    maxNestedTags: 32,
  }).parse(raw) as Node;
  if (!parsed[root] || typeof parsed[root] !== 'object')
    throw Error('Unexpected workbook XML root.');
  return parsed[root] as Node;
}
/** Round source lexical decimals to the verified displayed precision, never binary floats. */

const minor = (v: string) => BigInt(v.replace('.', ''));
export function parseSbiPortfolio(bytes: Uint8Array) {
  const parts = sbiWorkbookParts(bytes),
    workbook = xml(parts.get('xl/workbook.xml'), 'workbook');
  if (
    list((workbook.sheets as Node)?.sheet).length !== 1 ||
    (workbook.workbookPr as Node)?.['@_date1904'] === '1'
  )
    throw Error('Unsupported workbook sheet/date system.');
  const shared = xml(parts.get('xl/sharedStrings.xml'), 'sst');
  const strings = list(shared.si).map((si) =>
    si.t !== undefined
      ? text(si.t)
      : list(si.r)
          .map((run) => text(run.t))
          .join(''),
  );
  const style = xml(parts.get('xl/styles.xml'), 'styleSheet'),
    formats = new Map(
      list((style.numFmts as Node)?.numFmt).map((f) => [
        String(f['@_numFmtId']),
        String(f['@_formatCode']),
      ]),
    ),
    styles = list((style.cellXfs as Node)?.xf);
  const sheet = xml(parts.get('xl/worksheets/sheet1.xml'), 'worksheet'),
    cells = new Map<
      string,
      { value: string; format: string; numeric: boolean }
    >();
  for (const row of list((sheet.sheetData as Node)?.row)) {
    for (const c of list(row.c)) {
      const ref = String(c['@_r']);
      if (
        !/^[A-Z]{1,2}[1-9][0-9]{0,3}$/.test(ref) ||
        cells.has(ref) ||
        c.f !== undefined
      )
        throw Error('Duplicate/unsupported cell or formula.');
      const kind = String(c['@_t'] || 'n'),
        value =
          kind === 's'
            ? strings[Number(text(c.v))]
            : kind === 'inlineStr'
              ? text((c.is as Node)?.t)
              : text(c.v);
      if (value === undefined) throw Error('Invalid shared string index.');
      const numFmt = String(
        styles[Number(c['@_s'] || 0)]?.['@_numFmtId'] || '0',
      );
      cells.set(ref, {
        value,
        format: formats.get(numFmt) || (numFmt === '43' ? '#,##0.00' : numFmt),
        numeric: kind === 'n',
      });
    }
  }
  const value = (ref: string) => cells.get(ref)?.value || '',
    number = (ref: string, places = 2) => {
      const cell = cells.get(ref);
      if (!cell?.numeric || !cell.value)
        throw Error('Expected numeric disclosure cell ' + ref);
      if (places === 2 && !cell.format.includes('0.00'))
        throw Error('Unverified amount/weight precision ' + ref);
      if (places === 0 && !cell.format.includes('#,##0'))
        throw Error('Unverified quantity precision ' + ref);
      if (places === 0) {
        const parts = /^(-?)(\d+)(?:\.(\d+))?(?:[Ee]([+-]?\d+))?$/.exec(
          cell.value,
        );
        if (!parts || cell.value.length > 80)
          throw Error('Unsupported quantity.');
        const shift = Number(parts[4] || 0) - (parts[3]?.length || 0);
        if (Math.abs(shift) > 80) throw Error('Unsupported quantity exponent.');
        if (
          shift < 0 &&
          BigInt(parts[2]! + (parts[3] || '')) % 10n ** BigInt(-shift) !== 0n
        )
          throw Error('Fractional quantity cannot be rounded silently.');
      }
      return sbiDisplayed(cell.value, places);
    };
  if (
    value('C3') !== 'SCHEME NAME :' ||
    value('D3') !== 'SBI Contra Fund' ||
    value('C4') !== 'PORTFOLIO STATEMENT AS ON :' ||
    value('D4') !== '46265' ||
    !cells.get('D4')?.format.includes('mmmm')
  )
    throw Error('Unsupported scheme or statement date.');
  const headers = [
    'Name of the Instrument / Issuer',
    'ISIN',
    'Rating / Industry^',
    'Quantity',
    'Market value\n(Rs. in Lakhs)',
    '% to AUM',
    'YTM %',
    'YTC % ##',
    'Notes & Symbols',
  ];
  headers.forEach((header, i) => {
    if (value(String.fromCharCode(67 + i) + '6') !== header)
      throw Error('Unsupported SBI portfolio header.');
  });
  const anchors: Record<number, string> = {
    8: 'EQUITY & EQUITY RELATED',
    10: 'Equity Shares',
    94: 'Total',
    96: 'Real Estate Investment Trust',
    98: 'Total',
    100: 'Foreign Securities and /or overseas ETF',
    103: 'Total',
    126: 'Treasury Bills',
    132: 'Total',
    147: 'TREPS / Reverse Repo Investments',
    149: 'Total',
    151: 'Other Current Assets / (Liabilities)',
    154: 'Total',
    156: 'GRAND TOTAL (AUM)',
    158: 'DERIVATIVES',
    160: 'Index Futures',
    163: 'Stock Futures',
    167: 'Derivatives Total',
  };
  for (const [row, label] of Object.entries(anchors))
    if (value('C' + row) !== label)
      throw Error('Unsupported disclosure section boundary.');
  const definitions = [
    { section: 'equity', from: 11, to: 93, total: 94 },
    { section: 'reit', from: 97, to: 97, total: 98 },
    { section: 'foreign', from: 101, to: 102, total: 103 },
    { section: 'treasury', from: 127, to: 131, total: 132 },
    { section: 'treps', from: 148, to: 148, total: 149 },
    { section: 'current', from: 152, to: 153, total: 154 },
    { section: 'derivatives', from: 161, to: 166, total: 167 },
  ] as const;
  const rows = [],
    totals = [],
    warnings: string[] = [];
  const aum = number('G156'),
    aumMinor = minor(aum);
  if (aumMinor <= 0n || number('H156') !== '100.00')
    throw Error('Invalid reported AUM.');
  const used = new Set<number>();
  for (const def of definitions) {
    let sum = 0n,
      count = 0;
    for (let r: number = def.from; r <= def.to; r++) {
      if (r === 163) continue;
      used.add(r);
      const amountLakh = number('G' + r),
        reportedWeightPercent = number('H' + r),
        name = value('C' + r),
        isin = value('D' + r);
      sum += minor(amountLakh);
      count++;
      const calculated = (minor(amountLakh) * 10000n) / aumMinor,
        reported = minor(reportedWeightPercent),
        difference = calculated - reported;
      if (difference > 1n || difference < -1n)
        warnings.push(
          `Row ${r}: reported ${reportedWeightPercent}% differs from disclosed amount/AUM beyond rounding tolerance.`,
        );
      rows.push({
        row: r,
        name,
        isin: ['current', 'treps', 'derivatives'].includes(def.section)
          ? null
          : isin,
        classification: value('E' + r),
        quantity: value('F' + r) ? number('F' + r, 0) : null,
        amountLakh,
        reportedWeightPercent,
        section: def.section,
        direction: def.section === 'derivatives' ? isin : null,
      });
    }
    const total = number('G' + def.total),
      difference = sum - minor(total);
    if (difference > BigInt(count) || difference < -BigInt(count))
      warnings.push(
        `${def.section}: line amounts differ from reported total beyond source rounding tolerance.`,
      );
    const totalWeight = number('H' + def.total),
      weightDifference =
        (minor(total) * 10000n) / aumMinor - minor(totalWeight);
    if (weightDifference > 1n || weightDifference < -1n)
      warnings.push(
        `${def.section}: reported total weight ${totalWeight}% differs from disclosed section amount/AUM beyond rounding tolerance.`,
      );
    totals.push({
      section: def.section,
      amountLakh: total,
      reportedWeightPercent: totalWeight,
    });
  }
  const ids = rows
    .map((row) => row.isin)
    .filter((isin): isin is string => isin !== null);
  if (new Set(ids).size !== ids.length)
    throw Error('Duplicate disclosed ISIN.');
  let total = 0n;
  for (const section of totals)
    if (section.section !== 'derivatives') total += minor(section.amountLakh);
  if (total - aumMinor > 7n || aumMinor - total > 7n)
    warnings.push(
      'Cash asset section totals do not reconcile to reported AUM.',
    );
  for (let r = 8; r < 156; r++)
    if (
      !used.has(r) &&
      !definitions.some((d) => d.total === r) &&
      value('G' + r) &&
      value('G' + r) !== 'NIL'
    )
      throw Error('Unrecognized nonzero section or position.');
  return SbiPortfolioSchema.parse({
    parser: 'sbi-contra-august-2026-v1',
    scheme: 'SBI Contra Fund',
    asOf: '2026-08-31',
    currency: 'INR',
    amountUnit: 'lakh',
    displayScale: 2,
    aumLakh: aum,
    rows,
    totals,
    warnings,
    quality: warnings.length ? 'source-discrepancy' : 'reconciled-disclosure',
    completeExposure: false,
  });
}
