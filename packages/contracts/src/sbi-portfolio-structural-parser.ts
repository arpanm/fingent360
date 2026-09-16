import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  SbiPortfolioSchema,
  SBI_PORTFOLIO_SOURCES,
  SBI_PORTFOLIO_URL,
  type SbiPortfolio,
} from './sbi-portfolio.js';
import { sbiWorkbookParts, sbiDisplayed } from './sbi-portfolio-parser.js';
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
  const body = new TextDecoder('utf-8', { fatal: true }).decode(part);
  if (
    body.length > 1000000 ||
    /<!DOCTYPE|<!ENTITY/i.test(body) ||
    XMLValidator.validate(body) !== true
  )
    throw Error('Unsafe workbook XML.');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    trimValues: false,
    maxNestedTags: 32,
  }).parse(body) as Node;
  if (!parsed[root] || typeof parsed[root] !== 'object')
    throw Error('Unexpected workbook root.');
  return parsed[root] as Node;
}
const minor = (value: string) => BigInt(value.replace('.', ''));
/** Semantic section discovery verified against original July/August2026 workbooks. */
export function parseSbiPortfolioStructural(
  bytes: Uint8Array,
  sourceUrl: string = SBI_PORTFOLIO_URL,
) {
  const source = SBI_PORTFOLIO_SOURCES.find((s) => s.url === sourceUrl);
  if (!source) throw Error('Original source URL has not been verified.');
  const parts = sbiWorkbookParts(bytes),
    book = xml(parts.get('xl/workbook.xml'), 'workbook');
  if (
    list((book.sheets as Node)?.sheet).length !== 1 ||
    (book.workbookPr as Node)?.['@_date1904'] === '1'
  )
    throw Error('Unsupported sheet/date system.');
  const shared = xml(parts.get('xl/sharedStrings.xml'), 'sst'),
    strings = list(shared.si).map((s) =>
      s.t !== undefined
        ? text(s.t)
        : list(s.r)
            .map((r) => text(r.t))
            .join(''),
    );
  const style = xml(parts.get('xl/styles.xml'), 'styleSheet'),
    formats = new Map(
      list((style.numFmts as Node)?.numFmt).map((f) => [
        String(f['@_numFmtId']),
        String(f['@_formatCode']),
      ]),
    ),
    styles = list((style.cellXfs as Node)?.xf),
    sheet = xml(parts.get('xl/worksheets/sheet1.xml'), 'worksheet');
  const cells = new Map<
    string,
    { value: string; format: string; numeric: boolean; formula: string | null }
  >();
  for (const row of list((sheet.sheetData as Node)?.row))
    for (const cell of list(row.c)) {
      const ref = String(cell['@_r']),
        kind = String(cell['@_t'] || 'n');
      if (!/^[A-Z]{1,2}[1-9][0-9]{0,3}$/.test(ref) || cells.has(ref))
        throw Error('Duplicate or unsupported cell.');
      const value =
        kind === 's'
          ? strings[Number(text(cell.v))]
          : kind === 'inlineStr'
            ? text((cell.is as Node)?.t)
            : text(cell.v);
      if (value === undefined) throw Error('Unknown shared string.');
      const fmt = String(
        styles[Number(cell['@_s'] || 0)]?.['@_numFmtId'] || '0',
      );
      cells.set(ref, {
        value,
        numeric: kind === 'n',
        format: formats.get(fmt) || (fmt === '43' ? '#,##0.00' : fmt),
        formula: cell.f === undefined ? null : text(cell.f),
      });
    }
  const value = (ref: string) => cells.get(ref)?.value || '',
    labels = [...cells]
      .filter(([ref]) => /^C\d+$/.test(ref))
      .map(([ref, c]) => ({ row: Number(ref.slice(1)), label: c.value }))
      .sort((a, b) => a.row - b.row);
  const anchor = (label: string) => {
    const found = labels.filter((c) => c.label === label);
    if (found.length !== 1) throw Error('Missing or repeated section ' + label);
    return found[0]!.row;
  };
  const schemeRow = anchor('SCHEME NAME :'),
    dateRow = anchor('PORTFOLIO STATEMENT AS ON :');
  if (
    value('D' + schemeRow) !== 'SBI Contra Fund' ||
    value('D' + dateRow) !== source.serial ||
    !cells.get('D' + dateRow)?.format.includes('mmmm')
  )
    throw Error('Source URL and statement identity/date disagree.');
  const header = anchor('Name of the Instrument / Issuer');
  [
    'Name of the Instrument / Issuer',
    'ISIN',
    'Rating / Industry^',
    'Quantity',
    'Market value\n(Rs. in Lakhs)',
    '% to AUM',
    'YTM %',
    'YTC % ##',
    'Notes & Symbols',
  ].forEach((v, i) => {
    if (value(String.fromCharCode(67 + i) + header) !== v)
      throw Error('Unverified disclosure headers.');
  });
  const aumRow = anchor('GRAND TOTAL (AUM)'),
    derivativeStart = anchor('DERIVATIVES'),
    derivativeEnd = anchor('Derivatives Total');
  if (!(
    header < aumRow &&
    aumRow < derivativeStart &&
    derivativeStart < derivativeEnd &&
    derivativeEnd < 500
  ))
    throw Error('Unsupported disclosure ordering.');
  const number = (ref: string, places = 2, allowFormula = false) => {
    const c = cells.get(ref);
    if (!c?.numeric || !c.value || (!allowFormula && c.formula !== null))
      throw Error('Unsupported numerical source cell ' + ref);
    if (places === 2 && !c.format.includes('0.00'))
      throw Error('Unverified source display precision.');
    if (places === 0) {
      if (!c.format.includes('#,##0'))
        throw Error('Unknown quantity precision.');
      const m = /^(-?)(\d+)(?:\.(\d+))?(?:[Ee]([+-]?\d+))?$/.exec(c.value);
      if (!m || c.value.length > 80) throw Error('Invalid integer quantity.');
      const shift = Number(m[4] || 0) - (m[3]?.length || 0);
      if (
        Math.abs(shift) > 80 ||
        (shift < 0 &&
          BigInt(m[2]! + (m[3] || '')) % 10n ** BigInt(-shift) !== 0n)
      )
        throw Error('Fractional quantity cannot be rounded.');
    }
    return sbiDisplayed(c.value, places);
  };
  const aum = number('G' + aumRow),
    aumMinor = minor(aum);
  if (aumMinor <= 0n || number('H' + aumRow) !== '100.00')
    throw Error('Invalid disclosed AUM.');
  const rows: SbiPortfolio['rows'] = [],
    totals: SbiPortfolio['totals'] = [],
    warnings: string[] = [],
    used = new Set<number>(),
    totalRows = new Set<number>();
  const sections = [
    ['Equity Shares', 'equity'],
    ['Stock Options', 'stock-options'],
    ['Real Estate Investment Trust', 'reit'],
    ['Foreign Securities and /or overseas ETF', 'foreign'],
    ['Treasury Bills', 'treasury'],
    ['TREPS / Reverse Repo Investments', 'treps'],
    ['Other Current Assets / (Liabilities)', 'current'],
  ] as const;
  const weight = (ref: string) => (value(ref) === '#' ? '#' : number(ref));
  const discrepancy = (amount: string, reported: string, label: string) => {
    if (reported === '#') {
      if (
        minor(amount) * 20000n >= aumMinor ||
        minor(amount) * 20000n <= -aumMinor
      )
        warnings.push(
          label +
            ': source small-weight marker conflicts with disclosed amount/AUM.',
        );
      return;
    }
    const difference = (minor(amount) * 10000n) / aumMinor - minor(reported);
    if (difference > 1n || difference < -1n)
      warnings.push(
        `${label}: reported ${reported}% differs from disclosed amount/AUM beyond rounding tolerance.`,
      );
  };
  const aggregate = (
    start: number,
    end: number,
    section: SbiPortfolio['rows'][number]['section'],
  ) => {
    let sum = 0n,
      count = 0,
      firstPosition = 0;
    for (let r = start; r < end; r++) {
      if (!value('G' + r)) {
        if (
          value('C' + r) &&
          !(
            section === 'derivatives' &&
            ['Index Futures', 'Stock Futures'].includes(value('C' + r))
          )
        )
          throw Error('Unknown populated row inside section.');
        continue;
      }
      if (value('G' + r) === 'NIL')
        throw Error('Unexpected NIL inside position section.');
      const amountLakh = number('G' + r),
        reportedWeightPercent = weight('H' + r),
        name = value('C' + r),
        identity = value('D' + r);
      sum += minor(amountLakh);
      count++;
      if (!firstPosition) firstPosition = r;
      used.add(r);
      discrepancy(amountLakh, reportedWeightPercent, 'Row ' + r);
      rows.push({
        row: r,
        name,
        isin: ['stock-options', 'current', 'treps', 'derivatives'].includes(
          section,
        )
          ? null
          : identity,
        classification: value('E' + r),
        quantity: value('F' + r) ? number('F' + r, 0) : null,
        amountLakh,
        reportedWeightPercent,
        section,
        direction:
          section === 'derivatives' ? (identity as 'Long' | 'Short') : null,
      });
    }
    if (!count) throw Error('Empty section cannot imply coverage.');
    const total = number('G' + end, 2, true),
      totalWeight = value('H' + end) === '#' ? '#' : number('H' + end, 2, true);
    for (const column of ['G', 'H']) {
      const formula = cells.get(column + end)?.formula;
      if (
        formula !== null &&
        formula !== undefined &&
        formula !== `SUM(${column}${firstPosition}:${column}${end - 1})`
      )
        throw Error(
          'Only observed contiguous cached SUM totals are supported.',
        );
    }
    const difference = sum - minor(total);
    if (difference > BigInt(count) || difference < -BigInt(count))
      warnings.push(
        section +
          ': line amounts differ from reported total beyond display rounding tolerance.',
      );
    discrepancy(total, totalWeight, section + ' total');
    totals.push({
      section,
      amountLakh: total,
      reportedWeightPercent: totalWeight,
    });
    used.add(end);
    totalRows.add(end);
  };
  for (const [label, section] of sections) {
    const starts = labels.filter((c) => c.label === label && c.row < aumRow);
    if (!starts.length) {
      if (section === 'stock-options') continue;
      throw Error('Missing required source section.');
    }
    if (starts.length !== 1) throw Error('Repeated source section.');
    const start = starts[0]!.row;
    if (start <= header) throw Error('Invalid section position.');
    const end = labels.find(
      (c) => c.row > start && c.row < aumRow && c.label === 'Total',
    )?.row;
    if (!end) throw Error('Section total missing.');
    aggregate(start + 1, end, section);
    used.add(start);
  }
  const derivativeHeader = derivativeStart + 1;
  [
    'Name of the Instrument',
    'Long / Short',
    'Industry ^',
    'Quantity',
    'Market value \n(Rs. in Lakhs)',
    '% to AUM',
    'Notes & Symbols',
  ].forEach((v, i) => {
    if (value(String.fromCharCode(67 + i) + derivativeHeader) !== v)
      throw Error('Unknown derivative heading.');
  });
  aggregate(derivativeHeader + 1, derivativeEnd, 'derivatives');
  for (let r = header + 1; r < aumRow; r++)
    if (!used.has(r) && value('G' + r) && value('G' + r) !== 'NIL')
      throw Error('Unknown nonzero asset section.');
  const ids = rows.map((r) => r.isin).filter((v): v is string => v !== null);
  if (new Set(ids).size !== ids.length)
    throw Error('Duplicate disclosed cash ISIN.');
  let sum = 0n,
    count = 0;
  for (const t of totals)
    if (t.section !== 'derivatives') {
      sum += minor(t.amountLakh);
      count++;
    }
  if (sum - aumMinor > BigInt(count) || aumMinor - sum > BigInt(count))
    warnings.push(
      'Cash asset section totals do not reconcile to reported AUM.',
    );
  for (const [ref, c] of cells) {
    const row = Number(ref.replace(/[A-Z]/g, ''));
    if (
      row <= derivativeEnd &&
      c.formula !== null &&
      !(totalRows.has(row) && ['G', 'H'].includes(ref.replace(/\d/g, '')))
    )
      throw Error('Unsupported formula in portfolio evidence.');
  }
  return SbiPortfolioSchema.parse({
    parser: 'sbi-contra-structural-v2',
    scheme: 'SBI Contra Fund',
    asOf: source.date,
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
