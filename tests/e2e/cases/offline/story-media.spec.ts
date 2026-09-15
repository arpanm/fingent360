import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-1144 on-device story guidance and text fallback need no image-provider network @STORY-MEDIA-002', async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on('request', (r) => {
    if (/api.openai.com|generativelanguage.googleapis.com/.test(r.url()))
      providerRequests.push(r.url());
  });
  await page.goto('/#today');
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Reading story' }),
  ).toBeVisible();
  await expect(page.locator('.story-glyph')).toHaveCount(0);
  expect(providerRequests).toEqual([]);
});
