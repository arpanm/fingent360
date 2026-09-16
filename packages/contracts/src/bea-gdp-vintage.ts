export const BEA_GDP_VINTAGES = [
  {
    url: 'https://www.bea.gov/news/2025/gross-domestic-product-2nd-quarter-2025-second-estimate-and-corporate-profits-preliminary',
    publishedAt: '2025-08-28T12:30:00.000Z',
    vintage: 'second' as const,
  },
  {
    url: 'https://www.bea.gov/news/2025/gross-domestic-product-2nd-quarter-2025-third-estimate-gdp-industry-corporate-profits',
    publishedAt: '2025-09-25T12:30:00.000Z',
    vintage: 'third' as const,
  },
] as const;
export function parseBeaGdpAnnualized(quote: string) {
  const rows = [
    ...quote.matchAll(
      /Real gross domestic product\s*\(GDP\)\s+(increased|decreased) at an annual rate of (\d{1,2}(?:\.\d{1,2})?) percent in the (first|second|third|fourth) quarter of (20\d{2})/gi,
    ),
  ];
  if (rows.length !== 1)
    throw Error('Retain one explicit real GDP annual-rate quarter sentence.');
  const row = rows[0]!,
    value = row[2]!.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  const quarters: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
  };
  return {
    value:
      row[1]!.toLowerCase() === 'decreased' && value !== '0'
        ? '-' + value
        : value,
    period: row[4] + '-Q' + quarters[row[3]!.toLowerCase()]!,
    quote: row[0],
  };
}
