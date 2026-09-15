import { test, expect } from '@playwright/test';
import { offlineResearchCalendar } from '../../../../apps/web/src/offline/research-auto';
test('E2E-OFFLINE-1054 calendar explains missing snapshot without network @RESEARCH-AUTO-002', async ({
  page,
}) => {
  await page.goto('/#research-calendar');
  await expect(
    page.getByRole('region', { name: 'Release calendar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Release calendar', exact: true }),
  ).toContainText('not original numerical data vintages');
});
test('E2E-OFFLINE-1055 unavailable capture cannot masquerade as downloaded history @RESEARCH-AUTO-002', () => {
  expect(offlineResearchCalendar(undefined).events).toEqual([]);
  expect(() => offlineResearchCalendar(undefined, 'a'.repeat(64))).toThrow(
    'not downloaded',
  );
});
