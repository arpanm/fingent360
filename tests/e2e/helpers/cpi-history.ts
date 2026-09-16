import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CLEVELAND_CPI_HISTORY_URL } from '../../../packages/contracts/src/index';
export function cpiHistoryInput() {
  return {
    requestId: randomUUID(),
    url: CLEVELAND_CPI_HISTORY_URL,
    historySelection: { period: '2025-01', asOf: '2025-02-11' },
    rightsBasis:
      'Test-only original chart excerpt, Cleveland Fed chart CC BY 4.0 attribution; not production activation.',
    rightsConfirmed: true as const,
    body: readFileSync(
      new URL(
        '../fixtures/cpi-history/cleveland-january-2025.json',
        import.meta.url,
      ),
      'utf8',
    ),
  };
}
export function cpiHistoricalActualInput() {
  return {
    requestId: randomUUID(),
    url: 'https://www.bls.gov/news.release/archives/cpi_02122025.htm',
    rightsBasis:
      'Test-only reconstructed original BLS public numerical fact and release header.',
    rightsConfirmed: true as const,
    body: '<pre>8:30 a.m. (ET) Wednesday, February 12, 2025 CONSUMER PRICE INDEX - JANUARY 2025 The Consumer Price Index for All Urban Consumers (CPI-U) increased 0.5 percent on a seasonally adjusted basis in January</pre>',
  };
}
