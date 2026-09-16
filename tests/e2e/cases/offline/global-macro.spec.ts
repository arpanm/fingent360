import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-1350 installed global source coverage reads downloaded editions without API network calls @SRC-008', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#global-macro');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const panel = page.getByRole('main', { name: 'Global macro coverage' });
  await expect(
    panel.getByRole('region', { name: 'ECB numerical policy rates' }),
  ).toContainText('Published edition');
  await expect(
    panel.getByRole('region', { name: 'BLS release calendar' }),
  ).toContainText('events in selected retained capture');
  expect(network).toEqual([]);
});
