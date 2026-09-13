import {
  holdingsWorkbookTemplate,
  workbookParts,
  workbookArchive,
} from '../../../packages/contracts/src/index';
export function syntheticWorkbook(
  change?: (parts: Map<string, string>) => void,
): Uint8Array {
  const parts = workbookParts(holdingsWorkbookTemplate(true));
  change?.(parts);
  return workbookArchive(parts);
}
export function brokenWorkbook(
  kind:
    | 'hidden-row'
    | 'hidden-column'
    | 'formula'
    | 'total'
    | 'numeric-long'
    | 'date-style'
    | 'scientific-style'
    | 'entity'
    | 'external'
    | 'formula-prefix'
    | 'external-prefix'
    | 'row-date'
    | 'row-scientific'
    | 'column-date'
    | 'column-scientific'
    | 'default-date'
    | 'default-scientific',
): Uint8Array {
  return syntheticWorkbook((parts) => {
    const path = 'xl/worksheets/sheet1.xml';
    const xml = parts.get(path)!;
    if (kind === 'hidden-row')
      parts.set(path, xml.replace('<row r="2">', '<row r="2" hidden="true">'));
    if (kind === 'hidden-column')
      parts.set(
        path,
        xml.replace(
          '<sheetData>',
          '<cols><col min="2" max="2" hidden="true"/></cols><sheetData>',
        ),
      );
    if (kind === 'formula-prefix')
      parts.set(
        path,
        xml.replace(
          '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
          '<c r="B2"><x-l:f xmlns:x-l="http://schemas.openxmlformats.org/spreadsheetml/2006/main">1+1</x-l:f><v>1.000001</v></c>',
        ),
      );
    if (kind === 'external-prefix')
      parts.set(
        'xl/_rels/workbook.xml.rels',
        parts
          .get('xl/_rels/workbook.xml.rels')!
          .replace(
            '</Relationships>',
            '<x-l:Relationship xmlns:x-l="http://schemas.openxmlformats.org/package/2006/relationships" Id="evil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/private" TargetMode="External"/></Relationships>',
          ),
      );
    if (kind === 'formula')
      parts.set(
        path,
        xml.replace(
          '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
          '<c r="B2"><f>1+1</f><v>2</v></c>',
        ),
      );
    if (kind === 'total')
      parts.set(
        'xl/worksheets/sheet2.xml',
        parts.get('xl/worksheets/sheet2.xml')!.replace('10001', '10002'),
      );
    if (kind === 'numeric-long')
      parts.set(
        path,
        xml.replace(
          '<c r="C2" t="inlineStr" s="1"><is><t>10001</t></is></c>',
          '<c r="C2"><v>9999999999999999</v></c>',
        ),
      );
    if (kind === 'default-date' || kind === 'default-scientific') {
      parts.set(
        path,
        xml.replace(
          '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
          '<c r="B2"><v>45000</v></c>',
        ),
      );
      parts.set(
        'xl/styles.xml',
        `<styleSheet><cellXfs><xf numFmtId="${kind === 'default-date' ? 14 : 11}"/></cellXfs></styleSheet>`,
      );
    }
    if (
      kind === 'row-date' ||
      kind === 'row-scientific' ||
      kind === 'column-date' ||
      kind === 'column-scientific'
    ) {
      let sheet = xml.replace(
        '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
        '<c r="B2"><v>45000</v></c>',
      );
      sheet = kind.startsWith('row')
        ? sheet.replace('<row r="2">', '<row r="2" s="1" customFormat="1">')
        : sheet.replace(
            '<sheetData>',
            '<cols><col min="2" max="2" style="1"/></cols><sheetData>',
          );
      parts.set(path, sheet);
      parts.set(
        'xl/styles.xml',
        `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="${kind.endsWith('date') ? 14 : 11}"/></cellXfs></styleSheet>`,
      );
    }
    if (kind === 'date-style' || kind === 'scientific-style') {
      parts.set(
        path,
        xml.replace(
          '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
          '<c r="B2" s="1"><v>45000</v></c>',
        ),
      );
      parts.set(
        'xl/styles.xml',
        `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="${kind === 'date-style' ? 14 : 11}"/></cellXfs></styleSheet>`,
      );
    }
    if (kind === 'entity')
      parts.set(path, '<!DOCTYPE worksheet [<!ENTITY x "boom">]>' + xml);
    if (kind === 'external')
      parts.set(
        'xl/_rels/workbook.xml.rels',
        parts
          .get('xl/_rels/workbook.xml.rels')!
          .replace(
            'Target="worksheets/sheet1.xml"',
            'Target="https://example.invalid/private" TargetMode="External"',
          ),
      );
  });
}
