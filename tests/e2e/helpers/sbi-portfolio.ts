import { zipSync, strToU8 } from 'fflate';
/** Synthetic cells in the verified SBI layout; no original positions/artwork copied. */
export function syntheticSbiWorkbook(discrepancy = true, broken = false) {
  const cells = new Map<
      string,
      { value: string; numeric?: boolean; style?: number }
    >(),
    put = (ref: string, value: string, numeric = false, style = 1) =>
      cells.set(ref, { value, numeric, style });
  put('C3', 'SCHEME NAME :');
  put('D3', broken ? 'Unverified scheme' : 'SBI Contra Fund');
  put('C4', 'PORTFOLIO STATEMENT AS ON :');
  put('D4', '46265', true, 3);
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
  ].forEach((h, i) => put(String.fromCharCode(67 + i) + '6', h));
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
  for (const [row, label] of Object.entries(anchors)) put('C' + row, label);
  const groups = [
    [11, 93, 94],
    [97, 97, 98],
    [101, 102, 103],
    [127, 131, 132],
    [148, 148, 149],
    [152, 153, 154],
    [161, 166, 167],
  ];
  for (const [from, to, total] of groups) {
    let count = 0;
    for (let r = from!; r <= to!; r++) {
      if (r === 163) continue;
      count++;
      put('C' + r, 'Synthetic instrument ' + r);
      put('D' + r, r >= 161 ? 'Long' : 'IN' + String(r).padStart(9, '0') + '0');
      put('E' + r, 'Synthetic classification');
      put('F' + r, '1', true, 2);
      put('G' + r, '10.000000000000001', true);
      put('H' + r, discrepancy && r === 153 ? '8.00' : '1.06', true);
    }
    put('G' + total, String(count * 10), true);
    put('H' + total, ((count * 1000) / 940).toFixed(2), true);
  }
  put('G156', '940', true);
  put('H156', '100', true);
  [
    'Name of the Instrument',
    'Long / Short',
    'Industry ^',
    'Quantity',
    'Market value \n(Rs. in Lakhs)',
    '% to AUM',
    'Notes & Symbols',
  ].forEach((h, i) => put(String.fromCharCode(67 + i) + '159', h));
  const esc = (v: string) =>
    v
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('"', '&quot;');
  const rows = new Map<number, string[]>();
  for (const [ref, c] of cells) {
    const row = Number(ref.replace(/[A-Z]/g, ''));
    const entry = c.numeric
      ? `<c r="${ref}" s="${c.style}"><v>${c.value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${esc(c.value)}</t></is></c>`;
    rows.set(row, [...(rows.get(row) || []), entry]);
  }
  const sheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[
    ...rows,
  ]
    .sort((a, b) => a[0] - b[0])
    .map(([r, entries]) => `<row r="${r}">${entries.join('')}</row>`)
    .join('')}</sheetData></worksheet>`;
  return zipSync(
    Object.fromEntries(
      Object.entries({
        'xl/workbook.xml':
          '<workbook><workbookPr date1904="0"/><sheets><sheet name="Synthetic"/></sheets></workbook>',
        'xl/sharedStrings.xml': '<sst count="0"/>',
        'xl/styles.xml':
          '<styleSheet><numFmts><numFmt numFmtId="43" formatCode="#,##0.00"/><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="166" formatCode="mmmm dd, yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="43"/><xf numFmtId="164"/><xf numFmtId="166"/></cellXfs></styleSheet>',
        'xl/worksheets/sheet1.xml': sheet,
      }).map(([name, xml]) => [name, strToU8(xml)]),
    ),
  );
}
