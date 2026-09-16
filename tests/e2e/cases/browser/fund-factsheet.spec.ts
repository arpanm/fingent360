import { test, expect, factsheetFixture } from '../../helpers/fund-factsheet';
import { randomUUID } from 'node:crypto';
import { headers } from '../../helpers/fund-factsheet';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true });
test('E2E-WEB-1910 actual factsheet file upload independent plan review and disclosed BER reader @SRC-016 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const f = await factsheetFixture(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Fund factsheets');
    const ops = page.getByRole('region', { name: 'Factsheet Operations' });
    await ops
      .getByLabel('Factsheet permission reference')
      .fill(f.input.permissionReference);
    await ops.getByRole('checkbox').check();
    await ops.getByLabel('Original factsheet HTML').setInputFiles({
      name: 'reconstructed-factsheet.html',
      mimeType: 'text/html',
      buffer: Buffer.from(f.input.body),
    });
    await ops
      .getByRole('button', { name: 'Retain factsheet', exact: true })
      .click();
    await expect(ops.getByRole('status')).toContainText(
      'Factsheet retained: draft',
    );
    await sourceOpsBrowser(
      page,
      f.reviewer,
      feedbackSandbox,
      'Fund factsheets',
    );
    await ops.getByLabel('Direct AMFI scheme code').fill('908001');
    await ops.getByLabel('Regular AMFI scheme code').fill('908002');
    await ops
      .getByLabel('Factsheet review reason')
      .fill(
        'Independent synthetic identities and original fee arithmetic reviewed.',
      );
    await ops
      .getByRole('button', { name: 'Publish factsheet mappings', exact: true })
      .click();
    await expect(ops.locator('article')).toContainText('published');
    await page.route(
      /\/api\/v1\/(?:funds|fund-factsheets)(?:[/?]|$)/,
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
      },
    );
    await page.goto('/#funds-bonds');
    await page
      .getByRole('button', { name: /Kotak Multi Asset Omni FOF.*Direct Plan/ })
      .click();
    const reader = page.getByRole('region', {
      name: 'Reviewed fund factsheet',
    });
    await expect(reader).toContainText('combined BER 1.02%');
    await expect(reader).not.toContainText('combined BER 1.76%');
    await expect(reader).toContainText('excludes brokerage, transaction costs');
    await reader
      .getByText('Factsheet source and review', { exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(
      reader.getByRole('link', { name: 'Original AMC factsheet' }),
    ).toBeVisible();
  } finally {
    await f.reviewer.dispose();
  }
});
test('E2E-WEB-1914 actual factsheet capture queue reaches the thirty first item and returns to first page @SRC-016 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  const f = await factsheetFixture(request, playwright, feedbackSandbox);
  try {
    for (let i = 0; i < 31; i++)
      expect(
        (
          await request.post('/api/v1/ops/fund-factsheets/import', {
            headers,
            data: { ...f.input, requestId: randomUUID() },
          })
        ).status(),
      ).toBe(201);
    await sourceOpsBrowser(page, request, feedbackSandbox, 'Fund factsheets');
    const ops = page.getByRole('region', { name: 'Factsheet Operations' });
    await expect(ops.locator('article')).toHaveCount(30);
    const first = await ops.locator('article h4').first().textContent();
    await ops
      .getByRole('button', { name: 'Older captures', exact: true })
      .click();
    await expect(ops.locator('article')).toHaveCount(1);
    await expect(
      ops.getByRole('button', { name: 'Older captures', exact: true }),
    ).toBeDisabled();
    await ops
      .getByRole('button', { name: 'Previous captures', exact: true })
      .click();
    await expect(ops.locator('article')).toHaveCount(30);
    await expect(ops.locator('article h4').first()).toHaveText(first!);
  } finally {
    await f.reviewer.dispose();
  }
});
