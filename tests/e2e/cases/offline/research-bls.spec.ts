import { test, expect } from '@playwright/test';
import { offlineResearchCalendar } from '../../../../apps/web/src/offline/research-auto';
test('E2E-OFFLINE-1070 BLS source remains isolated and missing captures explain download requirement @BLS-CALENDAR-001 @RESEARCH-AUTO-002', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) traffic.push(r.url());
  });
  await page.goto('/#research-calendar');
  await page
    .getByLabel('Calendar source', { exact: true })
    .selectOption('bls-calendar');
  await expect(
    page.getByRole('link', { name: 'Official BLS calendar' }),
  ).toBeVisible();
  expect(traffic).toEqual([]);
  expect(
    offlineResearchCalendar(undefined, undefined, 'bls-calendar').sourceId,
  ).toBe('bls-calendar');
  expect(() =>
    offlineResearchCalendar(undefined, 'a'.repeat(64), 'bls-calendar'),
  ).toThrow('not downloaded');
  const bea = offlineResearchCalendar(undefined);
  expect(
    offlineResearchCalendar(bea, undefined, 'bls-calendar').events,
  ).toEqual([]);
});
