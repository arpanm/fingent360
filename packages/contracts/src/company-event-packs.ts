export const INFOSYS_FY25_SOURCE =
  'https://www.infosys.com/investors/reports-filings/quarterly-results/2024-2025/q4/documents/ifrs-inr-press-release.pdf';
export const INFOSYS_ISIN = 'INE009A01021';
export const FIU_PIB_SOURCE =
  'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2010719';
export const FIU_PUBLISHED_AT = '2024-03-01T13:18:00.000Z';
export function parseInfosysQuarterRevenue(quote: string) {
  const found =
    /^Revenues\s+([0-9]{1,3}(?:,[0-9]{3})*)\s+([0-9]{1,3}(?:,[0-9]{3})*)\s+([0-9]{1,3}(?:,[0-9]{3})*)\s+([0-9]{1,3}(?:,[0-9]{3})*)$/.exec(
      quote.trim(),
    );
  if (!found)
    throw Error('Retain the exact four-column Infosys IFRS revenues row.');
  return {
    observed: found[1]!.replaceAll(',', ''),
    prior: found[2]!.replaceAll(',', ''),
  };
}
export function parseInfosysGuidance(quote: string) {
  const found =
    /^Guidance for FY26:\s*(?:•\s*)?Revenue growth of (\d+(?:\.\d+)?)%\s*[-–]\s*(\d+(?:\.\d+)?)% in constant currency$/.exec(
      quote.trim(),
    );
  if (!found || found[1] !== '0' || found[2] !== '3')
    throw Error(
      'Retain the verified FY26 constant-currency revenue guidance range.',
    );
  return { lower: '0', upper: '3' };
}
export function parseFiuPenalty(quote: string) {
  const found =
    /Financial Intelligence Unit-India \(FIU-IND\) imposes penalty of Rs\. 5,49,00,000 on Paytm Payments Bank Ltd/.exec(
      quote,
    );
  if (!found)
    throw Error('Retain the exact FIU-IND penalty subject and amount.');
  return {
    authority: 'Financial Intelligence Unit-India',
    subject: 'Paytm Payments Bank Ltd',
    amountInr: '54900000',
    quote: found[0],
  };
}
