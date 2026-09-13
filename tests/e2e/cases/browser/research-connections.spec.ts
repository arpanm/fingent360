import { test, expect } from '../../helpers/app-fixture';
import {
  connectionGoal,
  connectionPassword,
  prepareConnectionBrowser,
  routeConnectionReading,
  seedConnectionSource,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import type { Page } from '@playwright/test';
import type { FeedbackSandbox } from '../../helpers/feedback-fixture';
const base = '/api/v1/account/research-connections';
async function openReading(page: Page, sandbox: FeedbackSandbox) {
  const source = await seedConnectionSource(sandbox);
  await routeConnectionReading(page, sandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  await page.goto(`/#read/${source.id}`);
  await expect(
    page.getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Connect to my records', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Choose a holding or goal', exact: true })
    .click();
  return source;
}
async function reviewGoal(
  page: Page,
  note = 'I want to reread this source while thinking about my education goal.',
) {
  await page
    .getByLabel('Connect to', { exact: true })
    .selectOption({ label: `Goal: ${connectionGoal.name} · version 1` });
  await page.getByLabel('My personal reason', { exact: true }).fill(note);
  await page
    .getByRole('checkbox', {
      name: /I agree to store this personal connection/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review connection', exact: true })
    .click();
}
async function saveReview(page: Page) {
  await page
    .getByRole('button', { name: 'Save research connection', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Research connections', exact: true })
      .getByRole('status'),
  ).toHaveText('Research connection saved.');
}

test('E2E-WEB-260 actual published reader connects owned goal through consent review and durable save @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  const review = page.getByRole('region', {
    name: 'Connection review',
    exact: true,
  });
  await expect(review).toContainText(connectionGoal.name);
  await expect(
    page.getByRole('region', { name: 'Connection editor' }),
  ).toContainText(source.sourceHash!);
  await saveReview(page);
  await page.reload();
  const saved = page.getByRole('region', {
    name: 'Saved research connections',
  });
  await expect(saved).toContainText(connectionGoal.name);
  await saved
    .getByText('Connection details and dated source receipt', { exact: true })
    .click();
  await expect(saved).toContainText(source.source.retrievedAt.slice(0, 4));
  const verification = saved.getByText('Verify source receipt', {
    exact: true,
  });
  await expect(
    saved.getByText(source.sourceHash!, { exact: true }),
  ).not.toBeVisible();
  await verification.focus();
  await verification.press('Enter');
  await expect(
    saved.getByText(source.sourceHash!, { exact: true }),
  ).toBeVisible();
  await verification.press('Enter');
  await expect(
    saved.getByText(source.sourceHash!, { exact: true }),
  ).not.toBeVisible();
  await expect(
    saved.getByRole('link', { name: 'Read current published source' }),
  ).toHaveAttribute('href', `#read/${source.id}`);
  await page.screenshot({
    path: test.info().outputPath('research-connection-saved.png'),
    fullPage: false,
  });
});

test('E2E-WEB-261 edit note and remove retain original private history with no source text copies @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  await saveReview(page);
  await page.getByRole('button', { name: 'Edit reason', exact: true }).click();
  await page
    .getByLabel('My personal reason', { exact: true })
    .fill('My edited research question.');
  await page
    .getByRole('checkbox', {
      name: /I agree to store this personal connection/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review connection', exact: true })
    .click();
  await saveReview(page);
  await page
    .getByRole('button', { name: 'Connection history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Research connection history' }),
  ).toContainText('revision 1');
  await page
    .getByRole('button', { name: 'Remove connection', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review removal', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm removal', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText('No research connections saved yet');
  await page
    .getByRole('button', { name: 'All connection history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Research connection history' }),
  ).toContainText('revision 3 · remove');
});

test('E2E-WEB-262 keyboard mobile review Back and cancelled navigation preserve draft @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openReading(page, feedbackSandbox);
  await expect(
    page.getByRole('heading', {
      name: 'Your research connection',
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page
      .getByRole('region', { name: 'Connection editor' })
      .getByText('Verify source receipt', { exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Connect to', { exact: true })).toBeFocused();
  await page
    .getByLabel('Connect to', { exact: true })
    .selectOption('holding:INE002A01018');
  await page.keyboard.press('Tab');
  await expect(
    page.getByLabel('My personal reason', { exact: true }),
  ).toBeFocused();
  await page.keyboard.type(
    'A question about my holding, not a price prediction.',
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('region', { name: 'Connection review' }),
  ).toContainText('INE002A01018');
  await page
    .getByRole('button', { name: 'Back to connection', exact: true })
    .click();
  await expect(
    page.getByLabel('My personal reason', { exact: true }),
  ).toHaveValue('A question about my holding, not a price prediction.');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('region', { name: 'Research connections', exact: true })
    .getByRole('link', { name: 'My holdings', exact: true })
    .click();
  await expect(
    page.getByLabel('My personal reason', { exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Cancel connection', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Connection editor' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('E2E-WEB-263 simulated failed save preserves reviewed draft for duplicate-safe retry @EVIDENCE-LINKS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  const writes: string[] = [];
  const pattern = '**/api/v1/account/research-connections/*';
  await page.route(pattern, async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    writes.push(route.request().postData()!);
    if (writes.length === 1)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic connection-save outage.' }),
      });
    return route.fallback();
  });
  await page
    .getByRole('button', { name: 'Save research connection', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic connection-save outage',
  );
  await expect(
    page.getByRole('region', { name: 'Connection review' }),
  ).toContainText(connectionGoal.name);
  await saveReview(page);
  expect(writes).toHaveLength(2);
  expect(writes[1]).toBe(writes[0]);
});

test('E2E-WEB-264 current goal change requires review and explicit reaffirmation updates only the connection @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  await saveReview(page);
  const original = await page.evaluate(
    async ({ goal }) => {
      const goals = await (await fetch('/api/v1/account/goals')).json();
      const response = await fetch(
        `/api/v1/account/goals/${goals.goals[0].id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: 1,
            goal: { ...goal, name: 'Revised synthetic goal' },
          }),
        },
      );
      if (!response.ok) throw Error(`Goal change ${response.status}`);
      return {
        goal: await response.json(),
        holdings: await (await fetch('/api/v1/account/holdings')).json(),
      };
    },
    { goal: connectionGoal },
  );
  await page
    .getByRole('button', { name: 'Reload connections', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Saved research connections' })
      .getByRole('alert'),
  ).toContainText('Review your connection');
  await page
    .getByRole('button', { name: 'Review and reaffirm', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Connection editor' }),
  ).toContainText('Revised synthetic goal · record version 2');
  await page
    .getByRole('checkbox', {
      name: /I agree to store this personal connection/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review connection', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Save reaffirmed connection', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Saved research connections' })
      .getByRole('alert'),
  ).toHaveCount(0);
  const after = await page.evaluate(async () => ({
    goals: await (await fetch('/api/v1/account/goals')).json(),
    holdings: await (await fetch('/api/v1/account/holdings')).json(),
  }));
  expect(after.goals.goals[0]).toEqual(original.goal);
  expect(after.holdings).toEqual(original.holdings);
});

test('E2E-WEB-265 synthetic source withdrawal exposes only dated receipt and removal @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  await saveReview(page);
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
  await page.reload();
  const saved = page.getByRole('region', {
    name: 'Saved research connections',
  });
  await expect(saved.getByRole('alert')).toContainText('withdrawn');
  await expect(saved).not.toContainText(source.title);
  await expect(
    saved.getByRole('link', { name: 'Read current published source' }),
  ).toHaveCount(0);
  await expect(
    saved.getByRole('button', { name: 'Review and reaffirm' }),
  ).toHaveCount(0);
  await saved
    .getByText('Connection details and dated source receipt', { exact: true })
    .click();
  await expect(saved).toContainText(source.sourceHash!);
});

test('E2E-WEB-266 stale save conflicts keep draft and offer cancel reload recovery @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  await saveReview(page);
  await page.getByRole('button', { name: 'Edit reason', exact: true }).click();
  await page
    .getByLabel('My personal reason', { exact: true })
    .fill('A stale editor draft.');
  await page
    .getByRole('checkbox', {
      name: /I agree to store this personal connection/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review connection', exact: true })
    .click();
  await page.evaluate(async (base) => {
    const state = await (await fetch(base)).json(),
      current = state.connections[0].revision;
    const response = await fetch(`${base}/${current.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        requestId: crypto.randomUUID(),
        expectedVersion: current.version,
        note: 'Saved in a concurrent session.',
        storageConsent: true,
      }),
    });
    if (!response.ok) throw Error(`Concurrent save ${response.status}`);
  }, base);
  await page
    .getByRole('button', { name: 'Save research connection', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('changed');
  await expect(
    page.getByRole('region', { name: 'Connection review' }),
  ).toContainText('A stale editor draft.');
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Cancel connection', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reload connections', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText('Saved in a concurrent session.');
});

test('E2E-WEB-267 empty records and actual holdings goals navigation connect the workspace @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/');
  await page.evaluate(
    async ({ password }) => {
      const r = await fetch('/api/v1/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `empty_${crypto.randomUUID().slice(0, 12)}`,
          password,
          consent: true,
        }),
      });
      if (!r.ok) throw Error(`Register ${r.status}`);
    },
    { password: connectionPassword },
  );
  await page.goto(`/#read/${source.id}`);
  await page
    .getByRole('link', { name: 'Connect to my records', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Selected research edition' }),
  ).toContainText('Save a holding or goal first');
  await expect(
    page.getByRole('button', { name: 'Choose a holding or goal' }),
  ).toBeDisabled();
  await page.goto('/#holdings');
  await page
    .getByRole('link', {
      name: 'Research connections to my records',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#connections$/);
  await page.goto('/#my-goals');
  await page
    .getByRole('link', {
      name: 'Research connections to my records',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText('No research connections saved yet');
});

test('E2E-WEB-268 simulated unavailable connection list supports explicit retry @EVIDENCE-LINKS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedConnectionSource(feedbackSandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const pattern = '**/api/v1/account/research-connections';
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic list outage.' }),
    }),
  );
  await page.goto('/#connections');
  await expect(page.getByRole('alert')).toContainText('Synthetic list outage');
  await page.unroute(pattern);
  await page
    .getByRole('button', { name: 'Retry connections', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText('No research connections saved yet');
});

test('E2E-WEB-269 sign-in returns to the exact reader edition and inert personal text is escaped @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const username = await page.evaluate(async () => {
    const exported = await (
      await fetch('/api/v1/account/privacy/export')
    ).json();
    const r = await fetch('/api/v1/account/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) throw Error(`Logout ${r.status}`);
    return exported.account.username;
  });
  await page.goto(`/#read/${source.id}`);
  await page
    .getByRole('link', { name: 'Connect to my records', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Sign in or create an account', exact: true })
    .click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(connectionPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `#connections\\?itemId=${source.id}&sourceVersion=${source.version}&sourceHash=${source.sourceHash}$`,
    ),
  );
  await page
    .getByRole('button', { name: 'Choose a holding or goal', exact: true })
    .click();
  const note = '<img src=x onerror="window.researchInjection=true">';
  await reviewGoal(page, note);
  await saveReview(page);
  await expect(
    page.getByRole('region', { name: 'Saved research connections' }),
  ).toContainText(note);
  expect(await page.evaluate(() => 'researchInjection' in window)).toBe(false);
});

test('E2E-WEB-276 successful create edit and remove stay visible when the subsequent refresh fails @EVIDENCE-LINKS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  let failRefresh = true;
  // Only the optional context read fails. All writes and history are the actual
  // owned application API and PostgreSQL; no successful response is fabricated.
  await page.route(
    /\/api\/v1\/account\/research-connections(?:\?.*)?$/,
    (route) => {
      if (failRefresh && route.request().method() === 'GET')
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Synthetic post-save refresh outage.',
          }),
        });
      return route.fallback();
    },
  );
  const saved = page.getByRole('region', {
    name: 'Saved research connections',
  });
  await saveReview(page);
  await expect(saved).toContainText(connectionGoal.name);
  await expect(saved).toContainText('connection revision 1');
  await expect(page.getByRole('alert')).toContainText(
    'Your saved change is shown below',
  );
  await expect(
    page.getByRole('region', { name: 'Connection editor' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit reason', exact: true }).click();
  await page
    .getByLabel('My personal reason', { exact: true })
    .fill('Saved edit despite the failed context refresh.');
  await page
    .getByRole('checkbox', {
      name: /I agree to store this personal connection/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review connection', exact: true })
    .click();
  await saveReview(page);
  await expect(saved).toContainText(
    'Saved edit despite the failed context refresh.',
  );
  await expect(saved).toContainText('connection revision 2');
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic post-save refresh outage',
  );
  await page
    .getByRole('button', { name: 'Remove connection', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review removal', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm removal', exact: true })
    .click();
  await expect(saved).toContainText('No research connections saved yet');
  await expect(page.getByRole('alert')).toContainText(
    'Your saved change is shown below',
  );
  const history = await page.evaluate(async (base) => {
    const response = await fetch(`${base}/history`);
    if (!response.ok) throw Error(`History ${response.status}`);
    return response.json();
  }, base);
  expect(
    history.revisions.map((revision: { action: string }) => revision.action),
  ).toEqual(['create', 'edit', 'remove']);
  failRefresh = false;
  await page
    .getByRole('button', { name: 'Retry connections', exact: true })
    .click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(saved).toContainText('No research connections saved yet');
});

test('E2E-WEB-277 replayed saved receipt remains pending after source withdrawal goal change and failed refresh @EVIDENCE-LINKS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  const writes: string[] = [];
  let firstReceipt: unknown;
  // Commit the first write to the owned real API, then lose only its browser
  // response. The reviewed draft retains exactly the request that already saved.
  await page.route(
    '**/api/v1/account/research-connections/*',
    async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      writes.push(route.request().postData()!);
      if (writes.length !== 1) return route.fallback();
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: `${feedbackSandbox.apiOrigin}${url.pathname}`,
      });
      expect(response.status()).toBe(200);
      firstReceipt = await response.json();
      await route.abort('failed');
    },
  );
  await page
    .getByRole('button', { name: 'Save research connection', exact: true })
    .click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Connection review' }),
  ).toContainText(connectionGoal.name);
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
  await page.evaluate(async (goal) => {
    const goals = await (await fetch('/api/v1/account/goals')).json();
    const response = await fetch(`/api/v1/account/goals/${goals.goals[0].id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedVersion: 1,
        goal: { ...goal, name: 'Changed goal after the saved receipt' },
      }),
    });
    if (!response.ok) throw Error(`Goal change ${response.status}`);
  }, connectionGoal);
  let failRefresh = true;
  await page.route(
    /\/api\/v1\/account\/research-connections(?:\?.*)?$/,
    (route) => {
      if (failRefresh && route.request().method() === 'GET')
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic replay-context outage.' }),
        });
      return route.fallback();
    },
  );
  await saveReview(page);
  expect(writes).toHaveLength(2);
  expect(writes[1]).toBe(writes[0]);
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic replay-context outage',
  );
  await expect(
    page.getByText('Saved receipts are shown below.', { exact: false }),
  ).toContainText('Current source and record status are unavailable');
  const saved = page.getByRole('region', {
    name: 'Saved research connections',
  });
  await expect(saved).toContainText('connection revision 1');
  await expect(saved).toContainText(`${connectionGoal.name}`);
  await expect(saved).toContainText('Goal · record version 1');
  await expect(saved).not.toContainText('Changed goal after the saved receipt');
  await saved
    .getByText('Connection details and dated source receipt', { exact: true })
    .click();
  await expect(saved).toContainText(source.sourceHash!);
  await expect(saved).toContainText(
    'Current publication status has not been refreshed',
  );
  await expect(
    saved.getByRole('link', {
      name: 'Read current published source',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    saved.getByRole('link', { name: 'Original source website', exact: true }),
  ).toHaveCount(0);
  await expect(
    saved.getByRole('button', { name: 'Review and reaffirm', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Choose a holding or goal', exact: true }),
  ).toHaveCount(0);
  const history = await page.evaluate(async (base) => {
    const response = await fetch(`${base}/history`);
    if (!response.ok) throw Error(`History ${response.status}`);
    return response.json();
  }, base);
  expect(history.revisions).toEqual([firstReceipt]);
  failRefresh = false;
  await page
    .getByRole('button', { name: 'Retry connections', exact: true })
    .click();
  await expect(saved.getByRole('alert')).toContainText('withdrawn');
  await expect(saved.getByRole('alert')).toContainText('changed');
  await expect(
    page.getByText('Saved receipts are shown below.', { exact: false }),
  ).toHaveCount(0);
  await expect(
    saved.getByRole('link', {
      name: 'Read current published source',
      exact: true,
    }),
  ).toHaveCount(0);
  const current = await page.evaluate(
    async (base) => (await (await fetch(base)).json()).connections[0],
    base,
  );
  expect(current.revision).toEqual(firstReceipt);
  expect(current.currentSource).toBeNull();
  expect(current.currentTarget.binding.version).toBe(2);
});

test('E2E-WEB-278 failed manual reload retains receipts but clears current source context @EVIDENCE-LINKS-001', async ({
  page,
  feedbackSandbox,
}) => {
  await openReading(page, feedbackSandbox);
  await reviewGoal(page);
  await saveReview(page);
  const saved = page.getByRole('region', {
    name: 'Saved research connections',
  });
  await saved
    .getByText('Connection details and dated source receipt', { exact: true })
    .click();
  await expect(
    saved.getByRole('link', {
      name: 'Read current published source',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Connection history', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Research connection history' }),
  ).toContainText('revision 1');
  await page.route('**/api/v1/account/research-connections?*', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic manual refresh outage.' }),
        })
      : route.fallback(),
  );
  await page
    .getByRole('button', { name: 'Reload connections', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic manual refresh outage',
  );
  await expect(saved).toContainText('connection revision 1');
  await expect(
    page.getByRole('region', { name: 'Research connection history' }),
  ).toContainText('revision 1');
  await expect(page.getByLabel('Current connection context')).toContainText(
    'Current source and record status are unavailable',
  );
  await expect(
    saved.getByRole('link', {
      name: 'Read current published source',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    saved.getByRole('button', { name: 'Review and reaffirm', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Choose a holding or goal', exact: true }),
  ).toHaveCount(0);
});
