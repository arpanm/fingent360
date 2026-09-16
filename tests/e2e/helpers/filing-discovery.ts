export {
  test,
  expect,
  indiaActors,
  retentionHeaders,
  runFilingTick,
} from './filing-watch';
export const discoveryRights =
  'TEST-SIMULATION reconstructed public RSS grammar, no actual source permission asserted.';
// Reconstructed minimum observed RSS2.0 grammar; titles/URLs are source-linked metadata, not parsed issuer financial facts.
export function filingRss(
  options: { revision?: boolean; count?: number } = {},
) {
  const items = Array.from(
    { length: options.count ?? 2 },
    (_, i) =>
      `<item><title>${i === 0 ? 'CMI Limited' : 'Avio Smart Market Stack Limited'}</title><link>https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_${1724284 + i}_15092026050347_WEB.xml</link><description>Integrated Filing- Financials|${i === 0 && !options.revision ? 'Original' : 'Revision'}|${options.revision ? 'Corrected source metadata' : 'TEST-SIMULATION'}</description><pubDate>15-Sep-2026 17:02:11</pubDate></item>`,
  ).join('');
  return `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><atom:link href="https://www.nseindia.com/content/RSS/Integrated_Filing_Financials.xml" rel="self" type="application/rss+xml"/><link>https://www.nseindia.com/companies-listing/corporate-integrated-filing</link><title>NSE News - Latest INTEGRATED_FILING_FINANCIALS</title><description>National Stock Exchange- INTEGRATED_FILINGWEB</description><language>en-us</language><lastBuildDate>Tue, 15 Sep 2026 17:19:27 +0530</lastBuildDate><ttl>5</ttl>${items}</channel></rss>`;
}
