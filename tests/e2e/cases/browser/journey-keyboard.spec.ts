import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../helpers/feedback-fixture';
import {
  activateObservationControl,
  tabToObservationControl,
} from '../../helpers/observation-inbox-accessibility';
import {
  SessionSchema,
  WorkspaceSchema,
  ReviewSchema,
} from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
async function edit(page: Page, control: Locator, value: string) {
  await tabToObservationControl(page, control);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(value);
}

test('E2E-WEB-2315 full keyboard virtual journey edits imports allocates reviews reloads and deletes actual synthetic workspace @SLICE-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/api/v1/journey/**', (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: feedbackSandbox.apiOrigin + url.pathname + url.search,
    });
  });
  const journey = page.locator('.journey');
  const navigation = journey.getByRole('navigation', {
    name: 'Main navigation',
    exact: true,
  });
  const activate = (control: Locator) =>
    activateObservationControl(page, control);
  let token = '';
  let deleted = false;
  const read = async () => {
    const response = await request.get('/api/v1/journey/workspace', {
      headers: { Authorization: 'Bearer ' + token },
    });
    expect(response.status()).toBe(200);
    return WorkspaceSchema.parse(await response.json());
  };
  try {
    await page.goto('/#brief');
    await expect(journey).toContainText('Synthetic learning workspace.');
    await activate(
      journey.getByRole('link', {
        name: 'Explore the mechanism →',
        exact: true,
      }),
    );
    await activate(
      journey.getByRole('link', { name: 'Alpha Air', exact: true }),
    );
    await expect(
      journey.getByRole('heading', { name: 'Alpha Air', exact: true }),
    ).toBeVisible();
    await activate(
      journey.getByRole('link', { name: 'Add a virtual holding', exact: true }),
    );
    const opening = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/v1/journey/workspaces',
    );
    await activate(
      journey.getByRole('button', {
        name: 'Open virtual workspace',
        exact: true,
      }),
    );
    const opened = await opening;
    expect(opened.status()).toBe(201);
    token = SessionSchema.parse(await opened.json()).token;
    await edit(
      page,
      journey.getByLabel('Alpha Air quantity', { exact: true }),
      '10',
    );
    await edit(
      page,
      journey.getByLabel('Cash (INR)', { exact: true }),
      '1000.00',
    );
    await activate(
      journey.getByRole('button', { name: 'Save portfolio', exact: true }),
    );
    await expect(
      journey.getByText('Saved revision 1.', { exact: true }),
    ).toBeVisible();
    await expect(
      journey.getByLabel('Saved valuation', { exact: true }),
    ).toContainText('INR 2000.00');

    await activate(
      navigation.getByRole('link', { name: 'Import CSV', exact: true }),
    );
    await expect(page).toHaveURL(/#import$/);
    await expect(
      navigation.getByRole('link', { name: 'Import CSV', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      journey.getByRole('heading', {
        name: 'Import a virtual portfolio',
        exact: true,
      }),
    ).toBeVisible();
    const csvContent = journey.getByLabel('CSV content', { exact: true });
    await expect(csvContent).toHaveAttribute(
      'id',
      'journey-import-csv-content',
    );
    await expect(csvContent).toHaveAccessibleName('CSV content');
    await edit(page, csvContent, 'instrumentId,quantity\nalpha-air,12\n');
    await expect(csvContent).toHaveValue(
      'instrumentId,quantity\nalpha-air,12\n',
    );
    await edit(
      page,
      journey.getByLabel('Import cash (INR)', { exact: true }),
      '800.00',
    );
    const total = journey.getByLabel('Declared total including cash (INR)', {
      exact: true,
    });
    await edit(page, total, '1.00');
    await activate(
      journey.getByRole('button', { name: 'Preview import', exact: true }),
    );
    await expect(
      journey.getByText('Needs correction — nothing imported', { exact: true }),
    ).toBeVisible();
    await expect(
      journey.getByRole('button', { name: 'Confirm import', exact: true }),
    ).toBeDisabled();
    const unchanged = await read();
    expect(unchanged.revision).toBe(1);
    expect(unchanged.portfolio.holdings).toEqual([
      { instrumentId: 'alpha-air', quantity: '10' },
    ]);
    await edit(page, total, '2000.00');
    await activate(
      journey.getByRole('button', { name: 'Preview import', exact: true }),
    );
    await expect(
      journey.getByText('Reconciled — ready to confirm', { exact: true }),
    ).toBeVisible();
    await activate(
      journey.getByRole('button', { name: 'Confirm import', exact: true }),
    );
    await expect(
      journey.getByText('Saved revision 2.', { exact: true }),
    ).toBeVisible();
    const imported = await read();
    expect(imported.portfolio.holdings).toEqual([
      { instrumentId: 'alpha-air', quantity: '12' },
    ]);
    expect(imported.portfolio.cash).toBe('800.00');
    expect(imported.valuation.total).toBe('2000.00');

    await activate(
      navigation.getByRole('link', { name: 'Goals', exact: true }),
    );
    const names = [
      'Synthetic education one ' + randomUUID().slice(0, 8),
      'Synthetic education two ' + randomUUID().slice(0, 8),
    ];
    for (const [index, name] of names.entries()) {
      await activate(
        journey.getByRole('button', { name: 'Add goal', exact: true }),
      );
      await edit(
        page,
        journey.getByLabel(`Goal ${index + 1} name`, { exact: true }),
        name,
      );
      await edit(
        page,
        journey.getByLabel(`Goal ${index + 1} target (INR)`, { exact: true }),
        index === 0 ? '1600.00' : '2400.00',
      );
      await edit(
        page,
        journey.getByLabel(`Goal ${index + 1} allocation (%)`, { exact: true }),
        index === 0 ? '40' : '60',
      );
    }
    await activate(
      journey.getByRole('button', { name: 'Save goals', exact: true }),
    );
    await expect(
      journey.getByText('Saved revision 3.', { exact: true }),
    ).toBeVisible();
    await expect(journey).toContainText(names[0] + ': INR 800.00 funded');
    await expect(journey).toContainText(names[1] + ': INR 1200.00 funded');
    const allocated = await read();
    expect(allocated.portfolio.goals.map((goal) => goal.name)).toEqual(names);
    expect(allocated.portfolio.goals.map((goal) => goal.type)).toEqual([
      'education',
      'education',
    ]);
    expect(allocated.valuation.goals.map((goal) => goal.fundedPercent)).toEqual(
      ['50.00', '50.00'],
    );

    await activate(
      navigation.getByRole('link', { name: 'Reviews', exact: true }),
    );
    const issued = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/v1/journey/reviews',
    );
    await activate(
      journey.getByRole('button', { name: 'Create review', exact: true }),
    );
    const issueResponse = await issued;
    expect(issueResponse.status()).toBe(201);
    const baseline = ReviewSchema.parse(await issueResponse.json());
    expect(baseline.revision).toBe(3);
    expect(baseline.status).toBe('review');
    expect(baseline.scenario).toBe('baseline');
    expect(baseline.portfolio).toEqual(allocated.portfolio);
    const selected = journey.getByRole('article', {
      name: 'Selected review',
      exact: true,
    });
    await activate(
      selected
        .locator('summary')
        .filter({ hasText: 'Reconstruct saved inputs' }),
    );
    await expect(selected.locator('pre')).toContainText(names[0]!);
    const scenario = journey.getByLabel('Exercise input condition', {
      exact: true,
    });
    await tabToObservationControl(page, scenario);
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect(scenario).toHaveValue('stale');
    await activate(
      journey.getByRole('button', { name: 'Create review', exact: true }),
    );
    await expect(
      selected.getByRole('heading', { name: 'Unable to assess', exact: true }),
    ).toBeVisible();
    await page.reload();
    await activate(
      journey.getByRole('button', { name: /^Review · revision 3 ·/ }),
    );
    await expect(selected).toContainText('Portfolio revision 3');
    await activate(
      selected
        .locator('summary')
        .filter({ hasText: 'Reconstruct saved inputs' }),
    );
    await expect(selected.locator('pre')).toContainText(names[1]!);
    await activate(
      navigation.getByRole('link', { name: 'Portfolio', exact: true }),
    );
    await expect(
      journey.getByLabel('Alpha Air quantity', { exact: true }),
    ).toHaveValue('12');
    await expect(journey.getByLabel('Cash (INR)', { exact: true })).toHaveValue(
      '800.00',
    );
    expect((await read()).portfolio).toEqual(allocated.portfolio);

    await activate(
      journey
        .locator('summary')
        .filter({ hasText: 'Workspace access and deletion' }),
    );
    const removal = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname === '/api/v1/journey/workspace',
    );
    await activate(
      journey.getByRole('button', {
        name: 'Delete virtual workspace and data',
        exact: true,
      }),
    );
    expect((await removal).status()).toBe(200);
    deleted = true;
    await expect(
      journey.getByText('Virtual workspace deleted.', { exact: true }),
    ).toBeVisible();
    await expect(
      journey.getByRole('button', {
        name: 'Open virtual workspace',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem('fingent360.virtual-token.v1'),
      ),
    ).toBeNull();
    for (const path of ['workspace', 'reviews'])
      expect(
        (
          await request.get('/api/v1/journey/' + path, {
            headers: { Authorization: 'Bearer ' + token },
          })
        ).status(),
      ).toBe(401);
    await page.reload();
    await expect(
      journey.getByRole('button', {
        name: 'Open virtual workspace',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    // Failure cleanup is capability-scoped to the workspace this case opened;
    // normal acceptance above exercises deletion entirely through keyboard UI.
    if (token && !deleted)
      await request.delete('/api/v1/journey/workspace', {
        headers: { Authorization: 'Bearer ' + token },
      });
  }
});
