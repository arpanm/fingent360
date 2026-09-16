import { test, expect } from '@playwright/test';
import { FeedSchema } from '../../../../packages/contracts/src/index';

test('E2E-OFFLINE-1255 offline reader never shares a device-only or private-context URL @DEV-029', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const feed = FeedSchema.parse(
    await page.evaluate(async () =>
      (await fetch('/api/v1/discovery/feed')).json(),
    ),
  );
  const item = feed.items.find((entry) => entry.kind === 'term');
  expect(item).toBeDefined();
  await page.goto('/#read/' + item!.id);
  await page
    .getByRole('button', { name: 'More item actions', exact: true })
    .click();
  const actions = page.getByRole('dialog', {
    name: 'Keep this perspective',
    exact: true,
  });
  await expect(actions).toContainText(
    'A public app link is not available in this local edition.',
  );
  await expect(
    actions.getByRole('button', { name: 'Copy link', exact: true }),
  ).toHaveCount(0);
  await expect(
    actions.getByRole('button', { name: 'Share public link', exact: true }),
  ).toHaveCount(0);
  await actions.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: item!.title, exact: true }),
  ).toBeVisible();
});
