import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { PrivacyExportSchema } from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-WEB-050 download private data and end other sessions @PRIVACY-001', async ({
  page,
  playwright,
}) => {
  test.setTimeout(90000);
  const username = `e2e_${randomUUID().slice(0, 16)}`;
  const password = 'E2E-only-private-passphrase-2026';
  const apiURL = process.env.E2E_API_URL || 'http://127.0.0.1:4100';
  const headers = {
    Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
  };
  const second = await playwright.request.newContext({ baseURL: apiURL });
  await page.goto('/#account');
  await page
    .getByRole('button', { name: 'Create a new account', exact: true })
    .click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /I agree to store/ }).check();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: `Signed in as ${username}` }),
  ).toBeVisible();
  try {
    expect(
      (
        await second.post('/api/v1/account/login', {
          headers,
          data: { username, password },
        })
      ).status(),
    ).toBe(200);
    await page.goto('/#privacy');
    await expect(
      page.getByRole('heading', { name: 'This session', exact: true }),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Download account JSON', exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('fingent360-account.json');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const exported = PrivacyExportSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString('utf8')),
    );
    expect(exported.account.username).toBe(username);
    expect(exported.sessions).toHaveLength(2);
    await page
      .getByRole('button', { name: 'End all other sessions', exact: true })
      .click();
    await expect(
      page
        .getByRole('region', { name: 'Privacy and sessions', exact: true })
        .getByRole('status'),
    ).toHaveText('1 other sessions ended.');
    expect((await second.get('/api/v1/account/privacy/export')).status()).toBe(
      401,
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'This session', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'End all other sessions', exact: true }),
    ).toBeDisabled();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  } finally {
    await page.request.delete('/api/v1/account', {
      headers,
      data: { password },
    });
    await second.dispose();
  }
});
