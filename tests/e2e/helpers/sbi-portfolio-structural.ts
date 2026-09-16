import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { syntheticSbiWorkbook } from './sbi-portfolio';
/** Synthetic July grammar: different row positions plus one option premium and cached totals. */
export function syntheticSbiJulyWorkbook(unsafeFormula = false) {
  const entries = unzipSync(syntheticSbiWorkbook());
  let sheet = strFromU8(entries['xl/worksheets/sheet1.xml']!);
  sheet = sheet.replace(
    /r="([A-Z]*)(\d+)"/g,
    (_match, letters: string, number: string) =>
      `r="${letters}${Number(number) >= 96 ? Number(number) + 5 : number}"`,
  );
  sheet = sheet.replace('<v>46265</v>', '<v>46234</v>');
  sheet = sheet.replace(
    /(<c r="G161"[^>]*><v>)[^<]+/,
    (_match, prefix: string) => prefix + '939.99',
  );
  const options =
    '<row r="96"><c r="C96" t="inlineStr"><is><t>Stock Options</t></is></c></row><row r="97"><c r="C97" t="inlineStr"><is><t>Synthetic CALL Option</t></is></c><c r="F97" s="2"><v>-1</v></c><c r="G97" s="1"><v>-0.01</v></c><c r="H97" t="inlineStr"><is><t>#</t></is></c></row><row r="98"><c r="C98" t="inlineStr"><is><t>Total</t></is></c><c r="G98" s="1"><f>' +
    (unsafeFormula ? 'EXTERNAL()' : 'SUM(G97:G97)') +
    '</f><v>-0.01</v></c><c r="H98" s="1"><f>SUM(H97:H97)</f><v>0.00</v></c></row>';
  sheet = sheet.replace('</sheetData>', options + '</sheetData>');
  entries['xl/worksheets/sheet1.xml'] = strToU8(sheet);
  entries['xl/calcChain.xml'] = strToU8('<calcChain/>');
  return zipSync(entries);
}
