import { randomUUID } from 'node:crypto';
import type { Page, Locator } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  prepareConnectionBrowser,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import {
  governanceFixture,
  releaseGovernanceFixture,
  governanceHeaders,
} from '../../helpers/research-governance';
import {
  ActionCentreReceiptSchema,
  ActionCentreListSchema,
} from '../../../../packages/contracts/src/index';
test.use({
  namedOperators: true,
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
async function tabTo(control: Locator) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  const page = control.page();
  for (let step = 0; step < 180; step++) {
    if (await control.evaluate((element) => element === document.activeElement))
      break;
    await page.keyboard.press('Tab');
  }
  await expect(control).toBeFocused();
}
async function activate(control: Locator) {
  await tabTo(control);
  await control.page().keyboard.press('Enter');
}
async function enterComparison(page: Page, policyId: string) {
  await page.goto('/#action-centre');
  const panel = page.getByRole('region', {
    name: 'Educational action centre',
    exact: true,
  });
  const policy = panel.getByLabel('Released educational policy', {
    exact: true,
  });
  await expect(policy.locator('option[value="' + policyId + '"]')).toHaveCount(
    1,
  );
  await tabTo(policy);
  await policy.press('Home');
  await policy.press('ArrowDown');
  await policy.press('Tab');
  await expect(policy).toHaveValue(policyId);
  await panel
    .getByLabel('Saved holding', { exact: true })
    .selectOption('INE002A01018');
  await panel
    .getByLabel('Saved goal', { exact: true })
    .selectOption({ label: 'Synthetic research goal' });
  const fields: Record<string, string> = {
    'Proposed units to dispose': '1',
    'Assumed price per unit (INR)': '200',
    'Total assumed fees (INR)': '1',
    'Total assumed tax (INR)': '2',
    'Available cash (INR)': '500',
    'Emergency reserve (INR)': '100',
    'Loss capacity (INR)': '10',
    'Cash needed within days': '30',
    'Assumed executable units': '1',
    'Assumed settlement days': '2',
    'Maximum concentration (basis points)': '10000',
    'Turnover budget (basis points)': '4000',
    'Prior disposed acquisition cost (INR)': '0',
    'Cooldown days': '7',
    'Downside stress (basis points)': '1000',
    'Fee and tax assumption explanation':
      'Synthetic explicit assumptions, not a tax calculation.',
  };
  for (const [label, value] of Object.entries(fields))
    await panel.getByLabel(label, { exact: true }).fill(value);
  await panel
    .getByLabel('I understand price and investment uncertainty.', {
      exact: true,
    })
    .check();
  await panel
    .getByLabel('I have reviewed my financial obligations.', { exact: true })
    .check();
  await panel
    .getByLabel('Hypothetically earmark net proceeds to this goal once.', {
      exact: true,
    })
    .check();

  await activate(
    panel.getByRole('button', {
      name: 'Review educational comparison',
      exact: true,
    }),
  );
  const review = panel.getByRole('region', {
    name: 'Educational comparison review',
    exact: true,
  });
  await expect(
    review.getByRole('table', {
      name: 'No action compared with your proposal',
    }),
  ).toBeVisible();
  const consent = review.getByRole('checkbox');
  await tabTo(consent);
  await page.keyboard.press('Space');
  await consent.press('Tab');
  await expect(
    review.getByRole('button', {
      name: 'Save educational comparison',
      exact: true,
    }),
  ).toBeFocused();
  return {
    panel,
    review,
    save: review.getByRole('button', {
      name: 'Save educational comparison',
      exact: true,
    }),
  };
}

test('E2E-WEB-1295 released policy keyboard comparison retains sources and no-action through lost-response replay reload and withdrawal @DEV-019 @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(90000);
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    await releaseGovernanceFixture(request, fixture);
    await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#today');
    await prepareConnectionBrowser(page);
    let { panel, review, save } = await enterComparison(page, fixture.id);
    await activate(
      review
        .locator('summary')
        .filter({ hasText: 'Assumptions, sources and reconstruction' }),
    );
    await expect(review).toContainText(fixture.input.title + ' · version 1');
    const sources = review.getByRole('region', {
      name: 'Bound educational policy sources',
    });
    await expect(
      sources.getByRole('link', { name: 'Bound policy event' }),
    ).toHaveAttribute('href', '#events/' + fixture.eventId);
    for (const source of fixture.revision.event.event!.sources) {
      await expect(sources).toContainText(source.title);
      await expect(sources).toContainText('source version ' + source.version);
      await expect(sources).toContainText(source.sourceHash!);
    }
    await expect(
      review.getByRole('list', { name: 'Policy constraints' }),
    ).toContainText('turnover: breached');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await testInfo.attach('synthetic-policy-comparison-keyboard', {
      body: await panel.screenshot(),
      contentType: 'image/png',
    });
    let firstId = '',
      lost = false;
    await page.route(
      /\/api\/v1\/account\/action-centre\/[a-f0-9-]{36}$/,
      async (route) => {
        if (route.request().method() !== 'PUT' || lost) return route.fallback();
        firstId = route.request().url().split('/').at(-1)!;
        const original = new URL(route.request().url());
        const response = await route.fetch({
          url: feedbackSandbox.apiOrigin + original.pathname + original.search,
        });
        expect(response.status()).toBe(200);
        const receipt = ActionCentreReceiptSchema.parse(await response.json());
        expect(receipt.researchPolicy).toEqual(fixture.revision);
        expect(receipt.result.action).toBe('none-educational-comparison');
        lost = true;
        await route.abort('failed');
      },
    );
    await activate(save);
    await expect(panel.getByRole('alert')).toBeVisible();
    const retry = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith('/' + firstId),
    );
    await activate(save);
    expect((await retry).status()).toBe(200);
    await expect(
      panel.getByText('Educational comparison saved.', { exact: true }),
    ).toBeVisible();
    const list = ActionCentreListSchema.parse(
      await page.evaluate(async () =>
        (await fetch('/api/v1/account/action-centre')).json(),
      ),
    );
    expect(list.assessments).toHaveLength(1);
    expect(list.assessments[0]!.receipt.id).toBe(firstId);
    await page.reload();
    await activate(panel.getByText('Open saved comparison', { exact: true }));
    await expect(panel).toContainText('No action compared with your proposal');
    // Retain the currently offered release in a new preview, then withdraw it at the actual reviewer API.
    ({ panel, review, save } = await enterComparison(page, fixture.id));
    expect(
      (
        await fixture.reviewer.post(
          '/api/v1/ops/research-governance/' + fixture.id + '/reviews',
          {
            headers: governanceHeaders,
            data: {
              requestId: randomUUID(),
              expectedVersion: 1,
              decision: 'withdraw',
              simulationId: null,
              reason: 'Synthetic withdrawal between private review and save.',
            },
          },
        )
      ).status(),
    ).toBe(201);
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/account/action-centre/'),
    );
    await activate(save);
    expect((await rejected).status()).toBe(409);
    await expect(panel.getByRole('alert')).toContainText(/policy|withdraw/i);
    await activate(
      panel.getByRole('button', { name: 'Reload comparison records' }),
    );
    await expect(
      panel
        .getByLabel('Released educational policy')
        .locator('option[value="' + fixture.id + '"]'),
    ).toHaveCount(0);
    const after = ActionCentreListSchema.parse(
      await page.evaluate(async () =>
        (await fetch('/api/v1/account/action-centre')).json(),
      ),
    );
    expect(after.assessments).toHaveLength(1);
    expect(after.assessments[0]!.reviewReasons.join(' ')).toContain(
      'withdrawn',
    );
    expect(after.assessments[0]!.receipt).toEqual(list.assessments[0]!.receipt);
  } finally {
    await fixture.reviewer.dispose();
  }
});

test('E2E-WEB-1296 real session revocation clears policy review and saved private comparisons before recovery @DEV-019 @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    await releaseGovernanceFixture(request, fixture);
    await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#today');
    await prepareConnectionBrowser(page);
    const { panel, review, save } = await enterComparison(page, fixture.id);
    expect(
      await page.evaluate(
        async () =>
          (await fetch('/api/v1/account/logout', { method: 'POST' })).status,
      ),
    ).toBe(200);
    const denied = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/account/action-centre/'),
    );
    await activate(save);
    expect((await denied).status()).toBe(401);
    await expect(review).toHaveCount(0);
    await expect(panel.getByLabel('Released educational policy')).toHaveCount(
      0,
    );
    await expect(panel.getByRole('alert')).toContainText(
      'Sign in to review your private comparisons.',
    );
    await activate(
      panel
        .getByRole('alert')
        .getByRole('link', { name: 'Sign in', exact: true }),
    );
    await expect(page).toHaveURL(/#account\?next=action-centre$/);
  } finally {
    await fixture.reviewer.dispose();
  }
});

test('E2E-WEB-1297 changed source edition rejects stale policy preview and removes its selection @DEV-019 @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const fixture = await governanceFixture(request, playwright, feedbackSandbox);
  try {
    await releaseGovernanceFixture(request, fixture);
    await page.route(/\/api\/v1\/equities(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await page.goto('/#today');
    await prepareConnectionBrowser(page);
    const { panel, save } = await enterComparison(page, fixture.id);
    await reviseConnectionSourceFixture(
      feedbackSandbox,
      fixture.revision.event.event!.sources[0]!,
      'published',
    );
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/account/action-centre/'),
    );
    await activate(save);
    expect((await rejected).status()).toBe(409);
    await expect(panel.getByRole('alert')).toBeVisible();
    await activate(
      panel.getByRole('button', { name: 'Reload comparison records' }),
    );
    await expect(
      panel
        .getByLabel('Released educational policy')
        .locator('option[value="' + fixture.id + '"]'),
    ).toHaveCount(0);
    const result = ActionCentreListSchema.parse(
      await page.evaluate(async () =>
        (await fetch('/api/v1/account/action-centre')).json(),
      ),
    );
    expect(result.assessments).toEqual([]);
  } finally {
    await fixture.reviewer.dispose();
  }
});
