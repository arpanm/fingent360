import { randomUUID } from 'node:crypto';
export { test, expect, retentionHeaders } from './funds-bonds';
export { indiaActors } from './india-macro';
export function historyInput() {
  return {
    requestId: randomUUID(),
    permissionReference:
      'TEST-SIMULATION generated values only; no real source permission asserted.',
    writtenPermissionConfirmed: true,
    sourceUrl:
      'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?mf=22&frmdt=09-Sep-2026&todt=11-Sep-2026&tp=1',
    body: `Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date

Open Ended Schemes ( Equity Scheme - Multi Cap Fund )

SBI Mutual Fund
900001;Synthetic history fund;Direct Plan;Growth;INF000000001;;10.1000;09-Sep-2026
900001;Synthetic history fund;Direct Plan;Growth;INF000000001;;10.2000;10-Sep-2026
900001;Synthetic history fund;Direct Plan;Growth;INF000000001;;10.3000;11-Sep-2026
`,
  };
}
