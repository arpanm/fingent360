import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  seedConnectionSource,
  routeConnectionReading,
  prepareConnectionBrowser,
  reviseConnectionSourceFixture,
  connectionDatabase,
} from '../../helpers/research-connection-fixture';
import { beaBrowserCall as call } from '../../helpers/bea-fixture';
import { ResearchConnectionsSchema } from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-620 genuine source layers use keyboard basis links and expose dated limits at desktop and mobile widths @EVIDENCE-LAYERS-001', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto(`/#read/${source.id}`);
  const region = page.getByRole('region', { name: 'Explanation layers' });
  await expect(
    region.getByRole('heading', { name: 'One line', exact: true }),
  ).toBeVisible();
  const basis = region.getByRole('button', {
    name: `Basis: edition ${source.version}, title`,
    exact: true,
  });
  await basis.focus();
  await basis.press('Enter');
  await expect(
    region.locator(`#explanation-source-${source.id}-title`),
  ).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`#read/${source.id}$`));
  await expect(region).toContainText(source.source.retrievedAt);
  await expect(region).toContainText(source.sourceHash!);
  await region
    .getByText('Beginner — read it with context', { exact: true })
    .click();
  await expect(region).toContainText('not a prediction about your investments');
  await region
    .getByText('Analytical — evidence and limits', { exact: true })
    .click();
  await expect(region).toContainText(
    'Not assessed. Absence of a recorded comparison',
  );
  await expect(region).toContainText('No approved mapping supports either');
  expect(
    await region.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await region
    .getByText('Portfolio — your own research connections', { exact: true })
    .click();
  await expect(
    region.getByRole('link', { name: 'Sign in to view your connections' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(region).toHaveCount(0);
});

test('E2E-WEB-621 failed and malformed explanation replies retry actual source then changed edition requires refresh @EVIDENCE-LAYERS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  const pattern = '**/explanation?expectedVersion=*';
  let mode = 'failure';
  await page.route(pattern, (route) =>
    route.fulfill({
      status: mode === 'failure' ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        mode === 'failure'
          ? { message: 'Synthetic explanation outage' }
          : { invented: 'Untrusted unsupported claim' },
      ),
    }),
  );
  await page.goto(`/#read/${source.id}`);
  const region = page.getByRole('region', { name: 'Explanation layers' });
  try {
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic explanation outage',
    );
    mode = 'malformed';
    await region.getByRole('button', { name: 'Retry explanation' }).click();
    await expect(region.getByRole('alert')).toContainText(
      'response was invalid',
    );
    await expect(region).not.toContainText('Untrusted unsupported claim');
  } finally {
    await page.unroute(pattern);
  }
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'published');
  await region.getByRole('button', { name: 'Retry explanation' }).click();
  await expect(region.getByRole('alert')).toContainText(
    'source edition changed',
  );
  await region
    .getByRole('button', { name: 'Refresh explanation reading' })
    .click();
  await expect(
    region.getByRole('heading', { name: 'One line', exact: true }),
  ).toBeVisible();
  await region
    .getByText('Analytical — evidence and limits', { exact: true })
    .click();
  await expect(region).toContainText(
    `Preceding reviewed edition ${source.version}`,
  );
});

test('E2E-WEB-622 owned portfolio notes preserve dated context and exact records then actual401 clears private explanation @EVIDENCE-LAYERS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const data = ResearchConnectionsSchema.parse(
    (
      await call(
        page,
        `/api/v1/account/research-connections?itemId=${source.id}`,
      )
    ).body,
  );
  const originalHoldings = (await call(page, '/api/v1/account/holdings')).body;
  const originalGoals = (await call(page, '/api/v1/account/goals')).body;
  const target = data.targets.find((v) => v.binding.kind === 'goal')!;
  const note = 'Synthetic personal question; I infer no financial effect.';
  expect(
    (
      await call(
        page,
        `/api/v1/account/research-connections/${randomUUID()}`,
        'PUT',
        {
          action: 'create',
          requestId: randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target: target.binding,
          note,
          storageConsent: true,
        },
      )
    ).status,
  ).toBe(200);
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'published');
  await page.goto(`/#read/${source.id}`);
  const region = page.getByRole('region', { name: 'Explanation layers' });
  await region
    .getByText('Portfolio — your own research connections', { exact: true })
    .click();
  await expect(region).toContainText(note);
  await expect(region).toContainText('Review your connection');
  await expect(region).toContainText(`source edition ${source.version}`);
  expect((await call(page, '/api/v1/account/holdings')).body).toEqual(
    originalHoldings,
  );
  expect((await call(page, '/api/v1/account/goals')).body).toEqual(
    originalGoals,
  );
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
  } finally {
    await pool.end();
  }
  await region
    .getByRole('button', { name: 'Refresh your connections' })
    .click();
  await expect(
    region.getByRole('link', { name: 'Sign in to view your connections' }),
  ).toBeVisible();
  await expect(region).not.toContainText(note);
});

test('E2E-WEB-623 older actual connection response cannot restore notes after a real account change @EVIDENCE-LAYERS-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await routeConnectionReading(page, feedbackSandbox);
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const state = ResearchConnectionsSchema.parse(
    (
      await call(
        page,
        `/api/v1/account/research-connections?itemId=${source.id}`,
      )
    ).body,
  );
  const note = 'Synthetic first account private explanation note';
  expect(
    (
      await call(
        page,
        `/api/v1/account/research-connections/${randomUUID()}`,
        'PUT',
        {
          action: 'create',
          requestId: randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target: state.targets[0]!.binding,
          note,
          storageConsent: true,
        },
      )
    ).status,
  ).toBe(200);
  await page.goto(`/#read/${source.id}`);
  const region = page.getByRole('region', { name: 'Explanation layers' });
  await expect(
    region.getByRole('heading', { name: 'One line', exact: true }),
  ).toBeVisible();
  let release!: () => void,
    finish!: () => void,
    held = false,
    started = false,
    hold = true;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const drained = new Promise<void>((resolve) => (finish = resolve));
  const pattern = '**/account/research-connections?itemId=*';
  await page.route(pattern, async (route) => {
    const url = new URL(route.request().url());
    if (!hold)
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    started = true;
    try {
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
      expect(response.status()).toBe(200);
      const value = ResearchConnectionsSchema.parse(await response.json());
      expect(value.connections[0]?.revision.note).toBe(note);
      held = true;
      await gate;
      await route.fulfill({ response });
    } finally {
      finish();
    }
  });
  try {
    await region
      .getByText('Portfolio — your own research connections', { exact: true })
      .click();
    await expect.poll(() => held).toBe(true);
    expect(
      (await call(page, '/api/v1/account/logout', 'POST', {})).status,
    ).toBe(200);
    await prepareConnectionBrowser(page);
    hold = false;
    // Fixture setup uses actual endpoints; send the same invalidation event as
    // the normal account UI so the mounted reader observes the new session.
    await page.evaluate(() =>
      window.dispatchEvent(new Event('f360-session-changed')),
    );
    await region
      .getByRole('button', { name: 'Load your connections', exact: true })
      .click();
    await expect(region).toContainText(
      'You have no saved research connections',
    );
    release();
    await drained;
    await expect(region).not.toContainText(note);
    await expect(region).toContainText(
      'You have no saved research connections',
    );
  } finally {
    release();
    if (started) await drained;
    await page.unroute(pattern);
  }
});
