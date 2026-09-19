# BUG-c8fb640c4de040b1

- Status: Open
- Case/project: E2E-WEB-1600 / desktop
- Stories: DEV-029
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toContainText(expected) failed

    Locator: getByRole('main', { name: 'WhatsApp summaries' })
    Expected substring: "Not connected"
    Received string:    "Read it on WhatsAppChoose a public summary for your verified number. No holdings, goals, private feedback or account details are included. This form requests a single summary. Recurring delivery has separate consent below. Up to ten summary requests and ten new verification requests per day; wait one minute between verification requests.Please sign in to continue.Sign in to manage deliveryRefresh WhatsApp statusYour recurring public summariesOne daily or weekly digest, up to three separate public-summary messages. Missed runs over ten minutes are skipped; nothing catches up later. No private reports or portfolio data are included. At most three scheduled summaries in 24 hours, separate from single-summary requests.Please sign in to continue.Refresh recurring scheduleBack to Today"
    Timeout: 10000ms

    Call log:
      - Expect "toContainText" with timeout 10000ms
      - waiting for getByRole('main', { name: 'WhatsApp summaries' })
        - locator resolved to <main aria-busy="true" class="panel source-workflow" aria-label="WhatsApp summaries">…</main>
        - unexpected value "Read it on WhatsAppChoose a public summary for your verified number. No holdings, goals, private feedback or account details are included. This form requests a single summary. Recurring delivery has separate consent below. Up to ten summary requests and ten new verification requests per day; wait one minute between verification requests.Updating WhatsApp settings…Refresh WhatsApp statusYour recurring public summariesOne daily or weekly digest, up to three separate public-summary messages. Missed runs over ten minutes are skipped; nothing catches up later. No private reports or portfolio data are included. At most three scheduled summaries in 24 hours, separate from single-summary requests.Updating schedule…Refresh recurring scheduleBack to Today"
        13 × locator resolved to <main aria-busy="false" class="panel source-workflow" aria-label="WhatsApp summaries">…</main>
           - unexpected value "Read it on WhatsAppChoose a public summary for your verified number. No holdings, goals, private feedback or account details are included. This form requests a single summary. Recurring delivery has separate consent below. Up to ten summary requests and ten new verification requests per day; wait one minute between verification requests.Please sign in to continue.Sign in to manage deliveryRefresh WhatsApp statusYour recurring public summariesOne daily or weekly digest, up to three separate public-summary messages. Missed runs over ten minutes are skipped; nothing catches up later. No private reports or portfolio data are included. At most three scheduled summaries in 24 hours, separate from single-summary requests.Please sign in to continue.Refresh recurring scheduleBack to Today"


      26 |   await page.goto('/#whatsapp');
      27 |   const panel = page.getByRole('main', { name: 'WhatsApp summaries' });
    > 28 |   await expect(panel).toContainText('Not connected');
         |                       ^
      29 |   await panel
      30 |     .getByLabel('Your WhatsApp number, including country code')
      31 |     .fill(syntheticPhone);
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/whatsapp-channel.spec.ts:28:23
    Test timeout of 30000ms exceeded.
