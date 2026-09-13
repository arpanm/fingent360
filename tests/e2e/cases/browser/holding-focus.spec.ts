import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { HoldingsSnapshotSchema } from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-095 delayed frames cannot steal holding cost input @PORTFOLIO-001 @simulated @UI-RACES-001', async ({
  page,
}) => {
  const password = 'Synthetic-holding-focus-2026';
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  expect(
    (
      await page.request.post('/api/v1/account/register', {
        headers,
        data: {
          username: `focus_${randomUUID().slice(0, 16)}`,
          password,
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  try {
    await page.goto('/#holdings');
    await page
      .getByLabel('Security ISIN', { exact: true })
      .fill('INE002A01018');
    await page.evaluate(() => {
      const original = window.requestAnimationFrame.bind(window);
      const pending: FrameRequestCallback[] = [];
      let id = 0;
      window.requestAnimationFrame = (callback) => {
        pending.push(callback);
        return ++id;
      };
      Object.assign(window, {
        releaseHoldingFrames: () => {
          window.requestAnimationFrame = original;
          pending.splice(0).forEach((callback) => callback(performance.now()));
        },
      });
    });
    // Force avoids animation-stability waiting while our controlled frames are
    // held; real form handlers, parsing, preview and persistence still execute.
    await page
      .getByRole('button', { name: 'Next: holding amounts', exact: true })
      .click({ force: true });
    const quantity = page.getByLabel('Quantity', { exact: true });
    const cost = page.getByLabel('Total purchase cost (INR)', { exact: true });
    await quantity.fill('1.000001');
    await cost.fill('');
    await expect(cost).toBeFocused();
    await page.evaluate(() =>
      (
        window as unknown as { releaseHoldingFrames: () => void }
      ).releaseHoldingFrames(),
    );
    await page.keyboard.insertText('1000.01');
    await expect(cost).toHaveValue('1000.01');
    await expect(quantity).toHaveValue('1.000001');
    await page
      .getByRole('button', { name: 'Review this holding', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Add to draft', exact: true })
      .click();
    await page
      .getByRole('checkbox', { name: /I consent to storing my holdings/ })
      .check();
    await page
      .getByRole('button', { name: 'Preview holdings', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Confirm replacement', exact: true })
      .click();
    await expect(
      page
        .getByRole('region', { name: 'My entered holdings', exact: true })
        .getByRole('status'),
    ).toHaveText('Holdings saved.');
    const saved = HoldingsSnapshotSchema.parse(
      await (await page.request.get('/api/v1/account/holdings')).json(),
    );
    expect(saved.holdings).toEqual([
      { isin: 'INE002A01018', quantity: '1.000001', totalCostMinor: '100001' },
    ]);
    expect(saved.version).toBe(1);
  } finally {
    await page
      .evaluate(() =>
        (
          window as unknown as { releaseHoldingFrames?: () => void }
        ).releaseHoldingFrames?.(),
      )
      .catch(() => {});
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
  }
});
