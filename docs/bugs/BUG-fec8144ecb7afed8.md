# BUG-fec8144ecb7afed8

- Status: Open
- Case/project: E2E-WEB-661 / mobile
- Stories: MATERIAL-ALERTS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    res one observation transition. This is historical source monitoring, with no expected value, release-time surprise or investment action.Checks use only your two followed indicators. Automatic checks are optional; they never refresh providers or send email or push notifications.Refresh material changesEdit material thresholdsCheck stored observationsYour account is temporarily unavailable. Please try again shortly.Your draft and any saved receipt remain available. Refresh current context before starting a new request.Current material context is unavailable. A saved receipt does not establish current settings or observations.Saved material receiptRecorded 9/17/2026, 1:41:31 AM · check · saved state version 2. This is a historical receipt.GDP growth successful source check at this request: 9/17/2026, 1:41:31 AM.GDP growth: Threshold reachedBefore: 2020: 1% (revision 1). After: 2021: 3% (revision 1). Difference: 2 percentage points.Provider updated 2026-09-16; retrieved 9/17/2026, 1:41:31 AM. Recorded sourceExact comparison provenanceBefore: observation 0769506d-b25d-4444-8017-0c47fc02dab0, revision 1, annual period 2020; provider updated 2026-09-16, retrieved 9/17/2026, 1:41:28 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. Before sourceAfter: observation 95f4b7f3-b89e-48e1-bf05-5c27d19ec423, revision 1, annual period 2021; provider updated 2026-09-16, retrieved 9/17/2026, 1:41:31 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. After sourceRead material history"
    Timeout: 10000ms

    Call log:
      - Expect "toContainText" with timeout 10000ms
      - waiting for getByRole('region', { name: 'Material changes', exact: true })
        14 × locator resolved to <section class="material-alerts" aria-labelledby="material-title">…</section>
           - unexpected value "Material changesChoose an absolute change in percentage points for stored annual India observations. Each check compares one observation transition. This is historical source monitoring, with no expected value, release-time surprise or investment action.Checks use only your two followed indicators. Automatic checks are optional; they never refresh providers or send email or push notifications.Refresh material changesEdit material thresholdsCheck stored observationsYour account is temporarily unavailable. Please try again shortly.Your draft and any saved receipt remain available. Refresh current context before starting a new request.Current material context is unavailable. A saved receipt does not establish current settings or observations.Saved material receiptRecorded 9/17/2026, 1:41:31 AM · check · saved state version 2. This is a historical receipt.GDP growth successful source check at this request: 9/17/2026, 1:41:31 AM.GDP growth: Threshold reachedBefore: 2020: 1% (revision 1). After: 2021: 3% (revision 1). Difference: 2 percentage points.Provider updated 2026-09-16; retrieved 9/17/2026, 1:41:31 AM. Recorded sourceExact comparison provenanceBefore: observation 0769506d-b25d-4444-8017-0c47fc02dab0, revision 1, annual period 2020; provider updated 2026-09-16, retrieved 9/17/2026, 1:41:28 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. Before sourceAfter: observation 95f4b7f3-b89e-48e1-bf05-5c27d19ec423, revision 1, annual period 2021; provider updated 2026-09-16, retrieved 9/17/2026, 1:41:31 AM; retained source hash bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. After sourceRead material history"


      178 |       page.getByRole('status', { name: 'Saved material receipt' }),
      179 |     ).toContainText('saved state version 2');
    > 180 |     await expect(region(page)).toContainText(
          |                                ^
      181 |       'Synthetic current material read outage.',
      182 |     );
      183 |     await expect(region(page)).toContainText(
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/material-alerts.spec.ts:180:32
