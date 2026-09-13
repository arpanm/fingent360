import { test, expect } from '@playwright/test';
import {
  FeedSchema,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-WEB-136 real related term preview and explicit full context @UX-002', async ({
  page,
  isMobile,
}) => {
  const response = await page.request.get('/api/v1/discovery/feed?kind=annual');
  expect(response.status()).toBe(200);
  const annual = FeedSchema.parse(await response.json()).items.find((item) =>
    item.relatedIds.some((id) => id.startsWith('term-')),
  );
  expect(
    annual,
    'Publish annual context and its related glossary term before this case.',
  ).toBeTruthy();
  const termId = annual!.relatedIds.find((id) => id.startsWith('term-'))!;
  const term = FeedItemSchema.parse(
    await (await page.request.get(`/api/v1/discovery/items/${termId}`)).json(),
  );
  expect(term.status).toBe('published');
  await page.goto(`/#read/${annual!.id}`);
  const link = page
    .locator('.reader-related .term-link')
    .filter({ hasText: termId.replace(/^term-/, '').replaceAll('-', ' ') })
    .first();
  await link.scrollIntoViewIfNeeded();
  if (!isMobile) await link.hover();
  else {
    await page.keyboard.press('Tab');
    await link.focus();
  }
  const preview = page.getByRole('tooltip');
  await expect(preview).toContainText(term.title);
  await expect(preview).toContainText(term.summary);
  const box = await preview.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(
    (await page.evaluate(() => innerWidth)) + 1,
  );
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#read/${annual!.id}$`));
  await link.click();
  await expect(page.getByRole('dialog')).toContainText(term.title);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#read/${annual!.id}$`));
});
