import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { sbiWorkbookParts, sbiDisplayed } from './sbi-portfolio-parser.js';
import {
  SbiPortfolioSchema,
  AXIS_PORTFOLIO_URL,
  type SbiPortfolio,
} from './sbi-portfolio.js';
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
  if (!part) throw Error('Workbook part missing.');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(part);
  if (
    raw.length > 1000000 ||
    /<!DOCTYPE|<!ENTITY/i.test(raw) ||
    XMLValidator.validate(raw) !== true
  )
    throw Error('Unsafe XML.');
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    trimValues: false,
    maxNestedTags: 32,
  }).parse(raw) as Node;
  if (!parsed[root] || typeof parsed[root] !== 'object')
    throw Error('Invalid XML root.');
  return parsed[root] as Node;
}
export function parseAxisPortfolio(bytes: Uint8Array, url: string) {
  if (url !== AXIS_PORTFOLIO_URL) throw Error('Unsupported Axis source.');
  const parts = sbiWorkbookParts(bytes, 'axis'),
    workbook = xml(parts.get('xl/workbook.xml'), 'workbook');
  if ((workbook.workbookPr as Node)?.['@_date1904'] === '1')
    throw Error('Unsupported date system.');
  const sheets = list((workbook.sheets as Node)?.sheet).filter(
    (s) => s['@_name'] === 'AXISNETF',
  );
  if (sheets.length !== 1) throw Error('One AXISNETF scheme sheet required.');
  const relationships = list(
    xml(parts.get('xl/_rels/workbook.xml.rels'), 'Relationships').Relationship,
  ).filter((r) => r['@_Id'] === sheets[0]!['@_r:id']);
  if (
    relationships.length !== 1 ||
    relationships[0]!['@_TargetMode'] === 'External' ||
    !/^worksheets\/sheet\d+\.xml$/.test(String(relationships[0]!['@_Target']))
  )
    throw Error('Invalid scheme sheet relationship.');
  const shared = xml(parts.get('xl/sharedStrings.xml'), 'sst'),
    strings = list(shared.si).map((si) =>
      si.t !== undefined
        ? text(si.t)
        : list(si.r)
            .map((r) => text(r.t))
            .join(''),
    ),
    style = xml(parts.get('xl/styles.xml'), 'styleSheet'),
    formats = new Map(
      list((style.numFmts as Node)?.numFmt).map((f) => [
        String(f['@_numFmtId']),
        String(f['@_formatCode']),
      ]),
    ),
    styles = list((style.cellXfs as Node)?.xf),
    sheet = xml(
      parts.get('xl/' + String(relationships[0]!['@_Target'])),
      'worksheet',
    ),
    cells = new Map<
      string,
      { value: string; numeric: boolean; format: string }
    >();
  for (const row of list((sheet.sheetData as Node)?.row))
    for (const c of list(row.c)) {
      const ref = String(c['@_r']);
      if (
        !/^[A-Z]{1,2}[1-9]\d{0,3}$/.test(ref) ||
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
              : text(c.v),
        fmt = String(styles[Number(c['@_s'] || 0)]?.['@_numFmtId'] || '0');
      if (value === undefined) throw Error('Invalid string reference.');
      cells.set(ref, {
        value,
        numeric: kind === 'n',
        format: formats.get(fmt) ?? fmt,
      });
    }
  for (const [ref, c] of cells) {
    const match = /^([A-Z]+)(\d+)$/.exec(ref)!;
    if (
      c.value &&
      ((Number(match[2]) > 66 &&
        ['E', 'F', 'G', 'H', 'I'].includes(match[1]!)) ||
        (Number(match[2]) >= 7 &&
          Number(match[2]) <= 66 &&
          match[1]!.length === 1 &&
          match[1]! > 'I'))
    )
      throw Error('Unsupported extra numerical disclosure cells.');
  }
  const value = (ref: string) => cells.get(ref)?.value ?? '',
    number = (
      ref: string,
      kind: 'amount' | 'weight' | 'quantity' = 'amount',
    ) => {
      const c = cells.get(ref);
      if (!c?.numeric || !c.value) throw Error('Numeric cell required ' + ref);
      if (kind === 'quantity') {
        if (c.format !== '3' || !/^\d+$/.test(c.value))
          throw Error('Exact integer quantity required.');
        return c.value;
      }
      if (
        !c.format.includes('0.00') ||
        (kind === 'weight') !== c.format.includes('%')
      )
        throw Error('Unverified display format.');
      return sbiDisplayed(
        kind === 'weight'
          ? c.value.replace(
              /(?:[Ee]([+-]?\d+))?$/,
              (_match, exponent: string | undefined) =>
                'e' + String(Number(exponent ?? 0) + 2),
            )
          : c.value,
        2,
      );
    };
  if (
    value('A1') !== 'AXISNETF' ||
    value('B1') !== 'Axis NIFTY 50 ETF' ||
    value('B3') !== 'Monthly Portfolio Statement as on February 28, 2026'
  )
    throw Error('Exact source scheme/date required.');
  [
    'Name of the Instrument',
    'ISIN',
    'Industry',
    'Quantity',
    'Market/Fair Value\n (Rs. in Lakhs)',
    '% to Net\n Assets',
    'YTM~',
    'YTC^',
  ].forEach((h, i) => {
    if (value(String.fromCharCode(66 + i) + '4') !== h)
      throw Error('Unsupported Axis header.');
  });
  const anchors: Record<number, string> = {
    5: 'Equity & Equity related',
    6: '(a) Listed / awaiting listing on Stock Exchanges',
    57: 'Sub Total',
    58: '(b) Unlisted',
    59: 'Sub Total',
    60: 'Total',
    61: 'Reverse Repo / TREPS',
    63: 'Sub Total',
    64: 'Total',
    65: 'Net Receivables / (Payables)',
    66: 'GRAND TOTAL',
  };
  for (const [n, label] of Object.entries(anchors))
    if (value('B' + n) !== label) throw Error('Unsupported section layout.');
  for (const n of [58, 59])
    if (value('F' + n) !== 'NIL' || value('G' + n) !== 'NIL')
      throw Error('Unsupported unlisted positions.');
  const rows: SbiPortfolio['rows'] = [];
  for (let row = 7; row <= 56; row++) {
    if (
      !value('A' + row) ||
      !value('C' + row) ||
      value('H' + row) ||
      value('I' + row)
    )
      throw Error('Unexpected equity row or yield.');
    rows.push({
      row,
      name: value('B' + row),
      isin: value('C' + row),
      classification: value('D' + row),
      quantity: number('E' + row, 'quantity'),
      amountLakh: number('F' + row),
      reportedWeightPercent: number('G' + row, 'weight'),
      section: 'equity',
      direction: null,
      sourceCells: Array.from({ length: 9 }, (_, i) =>
        value(String.fromCharCode(65 + i) + row),
      ),
      yieldPercent: null,
    });
  }
  for (const row of [62, 65]) {
    if (
      value('C' + row) ||
      value('D' + row) ||
      value('E' + row) ||
      value('I' + row)
    )
      throw Error('Unsupported cash position fields.');
    rows.push({
      row,
      name: value('B' + row),
      isin: null,
      classification: '',
      quantity: null,
      amountLakh: number('F' + row),
      reportedWeightPercent: number('G' + row, 'weight'),
      section: row === 62 ? 'treps' : 'current',
      direction: null,
      sourceCells: Array.from({ length: 9 }, (_, i) =>
        value(String.fromCharCode(65 + i) + row),
      ),
      yieldPercent: row === 62 ? number('H' + row, 'weight') : null,
    });
  }
  if (new Set(rows.filter((r) => r.isin).map((r) => r.isin)).size !== 50)
    throw Error('Duplicate equity identifiers.');
  const totals: SbiPortfolio['totals'] = [
      {
        section: 'equity',
        amountLakh: number('F60'),
        reportedWeightPercent: number('G60', 'weight'),
      },
      {
        section: 'treps',
        amountLakh: number('F64'),
        reportedWeightPercent: number('G64', 'weight'),
      },
      {
        section: 'current',
        amountLakh: number('F65'),
        reportedWeightPercent: number('G65', 'weight'),
      },
    ],
    aumLakh = number('F66');
  if (
    number('G66', 'weight') !== '100.00' ||
    number('F57') !== number('F60') ||
    number('F63') !== number('F64')
  )
    throw Error('Subtotal/total disagreement.');
  const minor = (v: string) => BigInt(v.replace('.', '')),
    abs = (n: bigint) => (n < 0n ? -n : n),
    warnings = [
      'One archived Axis scheme/date is supported; this is not current portfolio coverage.',
      'Rounded NAV weights are disclosure percentages, not a reconstructed complete risk exposure.',
    ];
  let discrepancy = false;
  for (const total of totals) {
    const members = rows.filter((r) => r.section === total.section),
      sum = members.reduce((s, r) => s + minor(r.amountLakh), 0n);
    if (abs(sum - minor(total.amountLakh)) > BigInt(members.length)) {
      discrepancy = true;
      warnings.push(
        'Displayed instrument values do not reconcile for ' + total.section,
      );
    }
  }
  if (
    abs(totals.reduce((s, r) => s + minor(r.amountLakh), 0n) - minor(aumLakh)) >
    3n
  ) {
    discrepancy = true;
    warnings.push('Displayed category totals do not reconcile to AUM.');
  }
  return SbiPortfolioSchema.parse({
    parser: 'axis-nifty50-february-2026-v1',
    scheme: 'Axis NIFTY 50 ETF',
    asOf: '2026-02-28',
    currency: 'INR',
    amountUnit: 'lakh',
    displayScale: 2,
    aumLakh,
    sourceTotals: [
      ['equity', value('F60'), value('G60')],
      ['treps', value('F64'), value('G64')],
      ['current', value('F65'), value('G65')],
      ['aum', value('F66'), value('G66')],
    ],
    rows,
    totals,
    warnings,
    quality: discrepancy ? 'source-discrepancy' : 'reconciled-disclosure',
    completeExposure: false,
  });
}
