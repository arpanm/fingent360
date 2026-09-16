import { randomUUID } from 'node:crypto';
export { test, expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
export function masterInput(symbol = 'SYNTHETIC', effectiveOn = '2025-01-31') {
  return {
    requestId: randomUUID(),
    parser: 'nse-equity-master-v2',
    sourceUrl: 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
    effectiveOn,
    publishedAt: null,
    rightsBasis:
      'TEST-SIMULATION generated source shape; no live financial evidence or licence claim.',
    rightsConfirmed: true,
    body: `SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE\n${symbol},Synthetic Identity Limited,EQ,01-JAN-2020,10,1,INE002A01018,10\n`,
  };
}
