# BUG-5154ecb155fe6a5e

- Status: Open
- Case/project: E2E-WEB-1730 / mobile
- Stories: SRC-004
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toContainText(expected) failed

    Locator: getByText(/bank interest earned: 100000.00 lakhs/).first().locator('..')
    Expected substring: "not a publication timestamp"
    Received string:    "2026-04-28bank interest earned: 100000.00 lakhs · standalone · audited · period 2026-01-01–2026-03-31Reported bank ratios and reconciliationBank income, provisions and ordinary profit reconcile in the stated INR units. These are reported bank measures, not manufacturing revenue. Uploaded rendered NSE report; board approved 2026-04-28, which is not its publication timestamp.CET118.0400%Additional Tier 10%Gross NPA3.2700%Net NPA0.9700%Total capital adequacy is not inferred from CET1. Amounts of non-performing assets and their reported ratios are separate measures.Source & editionCaptured 2026-09-18T03:05:28.403Z. Published time not supplied.Original sourceSource row 6 · edition 13b612b3-5f31-423e-87a2-f8cc0249f25966db9e8a97c5ef84b716ca5e14c626f8626f308c7b03def1593136590d80a498"
    Timeout: 10000ms

    Call log:
      - Expect "toContainText" with timeout 10000ms
      - waiting for getByText(/bank interest earned: 100000.00 lakhs/).first().locator('..')
        14 × locator resolved to <article>…</article>
           - unexpected value "2026-04-28bank interest earned: 100000.00 lakhs · standalone · audited · period 2026-01-01–2026-03-31Reported bank ratios and reconciliationBank income, provisions and ordinary profit reconcile in the stated INR units. These are reported bank measures, not manufacturing revenue. Uploaded rendered NSE report; board approved 2026-04-28, which is not its publication timestamp.CET118.0400%Additional Tier 10%Gross NPA3.2700%Net NPA0.9700%Total capital adequacy is not inferred from CET1. Amounts of non-performing assets and their reported ratios are separate measures.Source & editionCaptured 2026-09-18T03:05:28.403Z. Published time not supplied.Original sourceSource row 6 · edition 13b612b3-5f31-423e-87a2-f8cc0249f25966db9e8a97c5ef84b716ca5e14c626f8626f308c7b03def1593136590d80a498"


      90 |     await summary.press('Enter');
      91 |     await expect(income).toContainText('18.0400%');
    > 92 |     await expect(income).toContainText('not a publication timestamp');
         |                          ^
      93 |     await expect(income).toContainText(
      94 |       'Total capital adequacy is not inferred',
      95 |     );
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/equity-banking.spec.ts:92:26
    Test timeout of 30000ms exceeded.
