import { zipSync, strToU8 } from 'fflate';
/** Synthetic structural workbook using the inspected AXISNETF layout, not real holdings. */
export function syntheticAxisWorkbook(options?: { sharedStringsXml?: string }) {
  const cells = new Map<number, string[]>(),
    add = (r: number, c: string, v: string, style?: number) => {
      const row = cells.get(r) ?? [];
      row.push(
        style === undefined
          ? `<c r="${c}${r}" t="inlineStr"><is><t>${v.replaceAll('&', '&amp;')}</t></is></c>`
          : `<c r="${c}${r}" s="${style}"><v>${v}</v></c>`,
      );
      cells.set(r, row);
    };
  add(1, 'A', 'AXISNETF');
  add(1, 'B', 'Axis NIFTY 50 ETF');
  add(3, 'B', 'Monthly Portfolio Statement as on February 28, 2026');
  [
    'Name of the Instrument',
    'ISIN',
    'Industry',
    'Quantity',
    'Market/Fair Value\n (Rs. in Lakhs)',
    '% to Net\n Assets',
    'YTM~',
    'YTC^',
  ].forEach((v, i) => add(4, String.fromCharCode(66 + i), v));
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
  for (const [r, v] of Object.entries(anchors)) add(Number(r), 'B', v);
  for (let r = 7; r <= 56; r++) {
    add(r, 'A', 'SYN' + r);
    add(r, 'B', 'Synthetic equity ' + r);
    add(r, 'C', 'INX' + String(r).padStart(8, '0') + '0');
    add(r, 'D', 'Synthetic industry');
    add(r, 'E', '10', 1);
    add(r, 'F', '1', 2);
    add(r, 'G', '0.01', 3);
  }
  for (const r of [57, 60]) {
    add(r, 'F', '50', 2);
    add(r, 'G', '0.50', 3);
  }
  for (const r of [58, 59]) {
    add(r, 'F', 'NIL');
    add(r, 'G', 'NIL');
  }
  add(62, 'A', 'SYN-TREPS');
  add(62, 'B', 'Synthetic clearing counterparty');
  add(62, 'H', '0.05', 3);
  for (const r of [62, 63, 64]) {
    add(r, 'F', '1', 2);
    add(r, 'G', '0.01', 3);
  }
  add(65, 'F', '49', 2);
  add(65, 'G', '0.49', 3);
  add(66, 'F', '100', 2);
  add(66, 'G', '1', 3);
  const parts = {
    'xl/workbook.xml':
      '<workbook><sheets><sheet name="AXISNETF" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': options?.sharedStringsXml ?? '<sst/>',
    'xl/styles.xml':
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="#,##0.00%"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="3"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':
      '<worksheet><sheetData>' +
      [...cells]
        .sort(([a], [b]) => a - b)
        .map(([r, c]) => `<row r="${r}">${c.join('')}</row>`)
        .join('') +
      '</sheetData></worksheet>',
  };
  return zipSync(
    Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])),
  );
}
