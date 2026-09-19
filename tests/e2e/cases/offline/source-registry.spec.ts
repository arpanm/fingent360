import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { SourceListSchema } from '../../../../packages/contracts/src/index';
import { beaBrowserCall } from '../../helpers/bea-fixture';

test('E2E-OFFLINE-071 downloaded approved registry metadata and connected-only editing remain truthful after reload @SOURCES-001', async ({
  page,
}) => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { sources: unknown };
  const expected = SourceListSchema.parse(bundle.sources);
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#sources');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const assertRegistry = async () => {
    const response = await beaBrowserCall(page, '/api/v1/sources');
    expect(response.status).toBe(200);
    expect(SourceListSchema.parse(response.body)).toEqual(expected);
    await expect(
      page.getByRole('heading', {
        name: 'Approved source registry',
        exact: true,
      }),
    ).toBeVisible();
    const rows = page
      .locator('.source-directory')
      .last()
      .locator(':scope > article');
    await expect(rows).toHaveCount(expected.length);
    for (const source of expected) {
      expect(source.data.published).toBe(true);
      expect(source.data.rightsStatus).toBe('approved');
      const row = rows.filter({
        has: page.getByRole('heading', { name: source.data.name, exact: true }),
      });
      await expect(row).toContainText(source.data.constraints);
      await expect(
        row.getByRole('link', { name: 'Original source', exact: true }),
      ).toHaveAttribute('href', source.data.sourceUrl);
      await expect(
        row.getByRole('link', { name: 'Usage terms', exact: true }),
      ).toHaveAttribute('href', source.data.termsUrl);
    }
    if (!expected.length)
      await expect(
        page.getByText(
          'No approved source metadata is included in this view.',
          { exact: true },
        ),
      ).toBeVisible();
    await expect(page.getByLabel('Operator key', { exact: true })).toHaveCount(
      0,
    );
  };
  await assertRegistry();
  await page.reload();
  await assertRegistry();
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', { name: 'Operations need a connected server' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save source metadata' }),
  ).toHaveCount(0);
  expect(network).toEqual([]);
});
