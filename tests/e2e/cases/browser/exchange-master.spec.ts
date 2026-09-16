import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  masterInput,
} from '../../helpers/exchange-master';
test.use({ namedOperators: true });
test('E2E-WEB-1580 dated identity reader exposes exchange series and keyboard source limitations @SRC-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = masterInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/equities/import', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: data.requestId,
            decision: 'publish',
            reason: 'Synthetic master reader review.',
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/?equity=INE002A01018#equities');
    const region = page.getByRole('region', {
      name: 'Exchange identity reconciliation',
    });
    await expect(region).toContainText('NSE:EQ:SYNTHETIC');
    const disclosure = region.getByText('Names and identity limitations', {
      exact: true,
    });
    await disclosure.focus();
    await disclosure.press('Enter');
    await expect(region).toContainText('no complete listing-status history');
    await expect(page.getByText(/paid-up ₹10 · market lot 1/)).toBeVisible();
  } finally {
    await reviewer.dispose();
  }
});
