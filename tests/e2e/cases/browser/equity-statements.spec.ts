import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  statementInput,
} from '../../helpers/equity-statements';
test.use({ namedOperators: true });
test('E2E-WEB-1510 reported statement reader shows period-end context and keyboard reconciliation on desktop and mobile @SRC-005 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = await statementInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/equities/import', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: input.requestId,
            decision: 'publish',
            reason: 'Synthetic full statements independently reviewed.',
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/?equity=INE002A01018#equities');
    await expect(
      page.getByText(/balance sheet cash: 10.00 lakhs/),
    ).toContainText('as of 2025-03-31');
    const article = page
      .getByText(/cash flow closing: -2.00 lakhs/)
      .locator('..');
    const summary = article
      .locator('summary')
      .filter({ hasText: 'Reported statement reconciliation' });
    await summary.focus();
    await summary.press('Enter');
    await expect(article).toContainText('Cash-flow statement cash is distinct');
    await expect(article).toContainText('net cash change');
  } finally {
    await reviewer.dispose();
  }
});
