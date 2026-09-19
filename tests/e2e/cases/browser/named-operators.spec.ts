import type { Locator, Page, TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { seedConnectionSource } from '../../helpers/research-connection-fixture';
import { PublicationProposalSchema } from '../../../../packages/contracts/src/index';

// Traverse the real tab order. Do not focus the target programmatically: that
// would hide an unreachable or trapped control from this keyboard regression.
async function keyboardActivate(
  page: Page,
  target: Locator,
  key: 'Enter' | 'Space' = 'Enter',
) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  for (let step = 0; step < 120; step++) {
    if (await target.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
  await page.keyboard.press(key);
}

async function captureReviewedLayout(
  page: Page,
  region: Locator,
  testInfo: TestInfo,
  name: string,
) {
  await expect(region).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const bounds = await region.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  // Long exact source identifiers must remain readable within their controls,
  // not merely clipped by a parent or hidden with document overflow CSS.
  const buttons = region.getByRole('button');
  for (let index = 0; index < (await buttons.count()); index++) {
    const button = buttons.nth(index);
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    expect(
      await button.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
  // This test owns disposable synthetic identities and data. Capture only the
  // named workflow region, with every form value masked; never capture login.
  await testInfo.attach(name, {
    body: await region.screenshot({
      animations: 'disabled',
      mask: [region.locator('input, textarea')],
    }),
    contentType: 'image/png',
  });
}

test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };

test('E2E-WEB-640 named independent review recovers a lost committed approval receipt @NAMED-OPERATORS-001', async ({
  page,
  request,
  feedbackSandbox,
}, testInfo) => {
  const source = await seedConnectionSource(feedbackSandbox);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const credentials = {
    username: 'publisher_' + randomUUID().slice(0, 8),
    password: 'Synthetic-publisher-password-2026',
  };
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers,
        data: { ...credentials, role: 'publisher' },
      })
    ).status(),
  ).toBe(201);
  const proposalId = randomUUID();
  expect(
    (
      await request.put('/api/v1/ops/proposals/' + proposalId, {
        headers,
        data: {
          kind: 'discovery',
          target: source.id,
          body: {
            expectedVersion: source.version,
            status: 'withdrawn',
            correctionNote: 'Synthetic independent publication review',
          },
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto('/#ops');
  await page
    .getByLabel('Named operator username', { exact: true })
    .fill(credentials.username);
  await page
    .getByLabel('Named operator password', { exact: true })
    .fill(credentials.password);
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Sign in to operations', exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Named operators and proposals',
      exact: true,
    }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', { name: new RegExp('discovery.*' + source.id) }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Inspect bound target', exact: true }),
  );
  await expect(
    page.getByText('Protected target read for this proposal.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Publication target inspection' }),
  ).toContainText(source.title);
  await page
    .getByLabel('Decision note', { exact: true })
    .fill('Synthetic independent reviewer approves');
  let committed: unknown;
  const path = '**/api/v1/ops/proposals/' + proposalId + '/approve';
  await page.route(
    path,
    async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + url.pathname,
      });
      expect(response.status()).toBe(201);
      committed = PublicationProposalSchema.parse(await response.json());
      await route.abort();
    },
    { times: 1 },
  );
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Approve exact publication',
      exact: true,
    }),
  );
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toBeFocused();
  // Recover the real committed-but-lost approval using keyboard traversal.
  await captureReviewedLayout(
    page,
    page.getByRole('region', {
      name: 'Named operators and publication proposals',
      exact: true,
    }),
    testInfo,
    'synthetic-named-approval-recovery',
  );
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Approve exact publication',
      exact: true,
    }),
  );
  await expect(
    page.getByText('Saved approved receipt.', { exact: false }),
  ).toBeVisible();
  const receipt = PublicationProposalSchema.parse(
    await (await request.get('/api/v1/ops/proposals/' + proposalId)).json(),
  );
  expect(receipt).toEqual(committed);
  await expect(
    page.getByRole('button', {
      name: 'Approve exact publication',
      exact: true,
    }),
  ).toHaveCount(0);
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Close proposal', exact: true }),
  );
  await expect(
    page.getByRole('button', {
      name: 'Reload proposals and operators',
      exact: true,
    }),
  ).toBeFocused();
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Reload proposals and operators',
      exact: true,
    }),
  );
  await expect(
    page.getByRole('button', {
      name: new RegExp('discovery.*' + source.id + '.*approved'),
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await captureReviewedLayout(
    page,
    page.getByRole('region', {
      name: 'Named operators and publication proposals',
      exact: true,
    }),
    testInfo,
    'synthetic-named-operators-narrow',
  );
});

test('E2E-WEB-641 named administrator creates a viewer and independent review remains required @NAMED-OPERATORS-001', async ({
  page,
  feedbackSandbox,
}, testInfo) => {
  await page.goto('/#ops');
  await page
    .getByLabel('Named operator username', { exact: true })
    .fill(feedbackSandbox.namedCredentials!.username);
  await page
    .getByLabel('Named operator password', { exact: true })
    .fill(feedbackSandbox.namedCredentials!.password);
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Sign in to operations', exact: true }),
  );
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Named operators and proposals',
      exact: true,
    }),
  );
  const username = 'viewer_' + randomUUID().slice(0, 8);
  await page
    .getByLabel('New operator username', { exact: true })
    .fill(username);
  await page
    .getByLabel('New operator password', { exact: true })
    .fill('Synthetic-viewer-password-2026');
  await page
    .getByLabel('New operator role', { exact: true })
    .selectOption('viewer');
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Create named operator', exact: true }),
  );
  await expect(
    page.getByRole('heading', { name: username, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel('New operator password', { exact: true }),
  ).toHaveValue('');
  page.once('dialog', (dialog) => dialog.accept());
  await keyboardActivate(
    page,
    page.getByRole('button', { name: 'Disable ' + username, exact: true }),
  );
  await expect(
    page.getByRole('button', { name: 'Enable ' + username, exact: true }),
  ).toBeVisible();
  await page.reload();
  await keyboardActivate(
    page,
    page.getByRole('button', {
      name: 'Named operators and proposals',
      exact: true,
    }),
  );
  await expect(
    page.getByRole('button', { name: 'Enable ' + username, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await captureReviewedLayout(
    page,
    page.getByRole('region', {
      name: 'Named operators and publication proposals',
      exact: true,
    }),
    testInfo,
    'synthetic-named-operators-narrow',
  );
});
