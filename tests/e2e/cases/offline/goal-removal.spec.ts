import { test, expect } from '@playwright/test';
import { exerciseGoalRemoval } from '../../helpers/goal-removal';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-OFFLINE-068 deleting the edited local goal closes its draft and persists without API traffic @GOALS-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      network.push(request.url());
  });
  await page.goto('/#account');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await exerciseGoalRemoval(page);
  expect(network).toEqual([]);
});
