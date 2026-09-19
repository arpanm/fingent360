# BUG-eaaec2b7533064da

- Status: Resolved
- Case/project: E2E-WEB-1256 / mobile
- Stories: DEV-017
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toContainText(expected) failed

    Locator: getByRole('region', { name: 'Feedback encryption maintenance', exact: true })
    Expected substring: "0 reports upgraded. 0 remain."
    Received string:    "Protect retained feedbackNew reports are encrypted before storage. Upgrade legacy reports and rotate older keys in batches of up to 50. Keep previous server keys until all retained reports are upgraded or expired.I confirm this bounded encryption maintenance.Upgrade next feedback batchEncryption maintenance is unavailable. Check server keys and retry; this batch was not partially committed."
    Timeout: 10000ms

    Call log:
      - Expect "toContainText" with timeout 10000ms
      - waiting for getByRole('region', { name: 'Feedback encryption maintenance', exact: true })
        14 × locator resolved to <section aria-label="Feedback encryption maintenance">…</section>
           - unexpected value "Protect retained feedbackNew reports are encrypted before storage. Upgrade legacy reports and rotate older keys in batches of up to 50. Keep previous server keys until all retained reports are upgraded or expired.I confirm this bounded encryption maintenance.Upgrade next feedback batchEncryption maintenance is unavailable. Check server keys and retry; this batch was not partially committed."


      32 |   await maintenance.getByRole('checkbox').check();
      33 |   await submit.click();
    > 34 |   await expect(maintenance).toContainText('0 reports upgraded. 0 remain.');
         |                             ^
      35 |   await expect(submit).toBeDisabled();
      36 | });
      37 |
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/feedback-encryption.spec.ts:34:29
    Test timeout of 30000ms exceeded.
