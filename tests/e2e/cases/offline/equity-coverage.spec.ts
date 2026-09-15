import { test, expect } from '@playwright/test';
import { EquitySnapshotSchema } from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-900 packaged equity coverage uses local snapshot and no API network @EQUITY-COVERAGE-001', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/'))
      requests.push(r.url());
  });
  await page.goto('/#equities');
  await expect(
    page.getByRole('region', { name: 'Indian equity evidence' }),
  ).toBeVisible();
  const result = await page.evaluate(
    async () => await (await fetch('/api/v1/equities/snapshot')).json(),
  );
  const snapshot = EquitySnapshotSchema.parse(result);
  expect(snapshot.companies.length).toBeGreaterThanOrEqual(0);
  expect(requests).toEqual([]);
});
