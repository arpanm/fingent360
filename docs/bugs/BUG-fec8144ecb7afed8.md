# BUG-fec8144ecb7afed8

- Status: Resolved
- Case/project: E2E-WEB-661 / mobile
- Stories: MATERIAL-ALERTS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    servation transition. This is historical source monitoring, with no expected value, release-time surprise or investment action.Checks use only your two followed indicators. Automatic checks are optional; they never refresh providers or send email or push notifications.Refresh material changesEdit material thresholdsCheck stored observationsYour account is temporarily unavailable. Please try again shortly.Your draft and any saved receipt remain available. Refresh current context before starting a new request.Current material context is unavailable. A saved receipt does not establish current settings or observations.Saved material receiptRecorded 9/19/2026, 12:26:00 AM · check · saved state version 2. This is a historical receipt.GDP growth successful source check at this request: 9/19/2026, 12:26:00 AM.GDP growth: Threshold reachedBefore: 2020: 1% (revision 1). After: 2021: 3% (revision 1). Difference: 2 percentage points.Provider updated 2026-09-18; retrieved 9/19/2026, 12:26:00 AM. Recorded sourceExact comparison provenanceBefore: observation 7635571a-aa19-4630-8cc6-1a9fd19ae9d5, revision 1, annual period 2020; provider updated 2026-09-18, retrieved 9/19/2026, 12:25:59 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. Before sourceAfter: observation 2bd27252-8c6a-499d-933b-f24cc251d10b, revision 1, annual period 2021; provider updated 2026-09-18, retrieved 9/19/2026, 12:26:00 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. After sourceRead material history"
    Timeout: 10000ms

    Call log:
      - Expect "toContainText" with timeout 10000ms
      - waiting for getByRole('region', { name: 'Material changes', exact: true })
        14 × locator resolved to <section class="material-alerts" aria-labelledby="material-title">…</section>
           - unexpected value "Material changesChoose an absolute change in percentage points for stored annual India observations. Each check compares one observation transition. This is historical source monitoring, with no expected value, release-time surprise or investment action.Checks use only your two followed indicators. Automatic checks are optional; they never refresh providers or send email or push notifications.Refresh material changesEdit material thresholdsCheck stored observationsYour account is temporarily unavailable. Please try again shortly.Your draft and any saved receipt remain available. Refresh current context before starting a new request.Current material context is unavailable. A saved receipt does not establish current settings or observations.Saved material receiptRecorded 9/19/2026, 12:26:00 AM · check · saved state version 2. This is a historical receipt.GDP growth successful source check at this request: 9/19/2026, 12:26:00 AM.GDP growth: Threshold reachedBefore: 2020: 1% (revision 1). After: 2021: 3% (revision 1). Difference: 2 percentage points.Provider updated 2026-09-18; retrieved 9/19/2026, 12:26:00 AM. Recorded sourceExact comparison provenanceBefore: observation 7635571a-aa19-4630-8cc6-1a9fd19ae9d5, revision 1, annual period 2020; provider updated 2026-09-18, retrieved 9/19/2026, 12:25:59 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. Before sourceAfter: observation 2bd27252-8c6a-499d-933b-f24cc251d10b, revision 1, annual period 2021; provider updated 2026-09-18, retrieved 9/19/2026, 12:26:00 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. After sourceRead material history"


      178 |       page.getByRole('status', { name: 'Saved material receipt' }),
      179 |     ).toContainText('saved state version 2');
    > 180 |     await expect(region(page)).toContainText(
          |                                ^
      181 |       'Synthetic current material read outage.',
      182 |     );
      183 |     await expect(region(page)).toContainText(
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/material-alerts.spec.ts:180:32
