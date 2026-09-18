import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import {
  seedConnectionSource,
  reviseConnectionSourceFixture,
  connectionDatabase,
} from '../../helpers/research-connection-fixture';
import {
  CompletePrivacyExportSchema,
  ReadingFollowViewSchema,
} from '../../../../packages/contracts/src/index';
import { readingPaginationSources } from '../../helpers/reading-follow-fixture';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const base = '/api/v1/account/reading-follow';
async function call(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body },
  );
}
async function register(page: Page) {
  await page.goto('/#overview');
  expect(
    (
      await call(page, '/api/v1/account/register', 'POST', {
        username: `rf_${randomUUID().slice(0, 12)}`,
        password: 'Synthetic-reading-follow-2026',
        consent: true,
      })
    ).status,
  ).toBe(201);
}
const view = (page: Page) =>
  page.getByRole('region', { name: 'Reading updates', exact: true });
test('E2E-WEB-440 keyboard source follow baseline check acknowledge withdrawal and unavailable topic recovery @READING-FOLLOW-001', async ({
  page,
  feedbackSandbox,
}, testInfo) => {
  let source = await seedConnectionSource(feedbackSandbox);
  await page.route('**/api/v1/discovery/catalog', (route) =>
    route.continue({
      url: feedbackSandbox.apiOrigin + '/api/v1/discovery/catalog',
    }),
  );
  await register(page);
  await page.goto('/#reading-follow');
  await expect(
    page
      .locator('nav[aria-label] a[aria-current=page]:visible')
      .filter({ hasText: 'Saved' })
      .first(),
  ).toBeVisible();
  await view(page)
    .getByRole('button', { name: 'Choose sources and topics', exact: true })
    .click();
  const topic = source.topics[0]!;
  await page.getByRole('checkbox', { name: topic, exact: true }).focus();
  await page.keyboard.press('Space');
  await page
    .getByRole('checkbox', {
      name: /I agree to store my reading subscriptions/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review subscription changes', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'without a historical backlog',
  );
  await page
    .getByRole('button', { name: 'Back to choices', exact: true })
    .click();
  await expect(
    page.getByRole('checkbox', { name: topic, exact: true }),
  ).toBeChecked();
  await page
    .getByRole('button', { name: 'Review subscription changes', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm subscription baseline', exact: true })
    .click();
  await expect(view(page)).toContainText('settings revision 1');
  await expect(
    page.getByRole('region', { name: 'Reading update inbox', exact: true }),
  ).toContainText('No notices');
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  await page
    .getByRole('button', { name: 'Check for reading updates', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Reading update inbox', exact: true }),
  ).toContainText(source.id);
  await expect(
    view(page).getByRole('heading', { name: source.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Reading update inbox', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('reading-published-notice.png'),
  });
  await page
    .getByRole('button', { name: `Acknowledge ${source.id}`, exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Reading update inbox', exact: true }),
  ).toContainText('acknowledged');
  await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
  await page
    .getByRole('button', { name: 'Check for reading updates', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Reading update inbox', exact: true }),
  ).toContainText('withdrawn');
  await expect(
    page.getByRole('link', {
      name: 'Open currently available reading',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    view(page).getByRole('heading', { name: source.title, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('button', { name: 'Choose sources and topics', exact: true })
    .click();
  const unavailable = page.getByRole('checkbox', {
    name: topic + ' (not currently published)',
    exact: true,
  });
  await expect(unavailable).toBeChecked();
  await unavailable.uncheck();
  await page
    .getByRole('checkbox', { name: 'Mute reading updates', exact: true })
    .check();
  await page
    .getByRole('checkbox', {
      name: /I agree to store my reading subscriptions/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Review subscription changes', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm subscription baseline', exact: true })
    .click();
  await expect(view(page)).toContainText('Muted');
  await page
    .getByRole('heading', { name: 'Reading updates', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('reading-updates.png') });
  await page.setViewportSize({ width: 360, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('E2E-WEB-441 committed lost response replays exact check and failed current read never reenables notices @READING-FOLLOW-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  let source = await seedConnectionSource(feedbackSandbox);
  await register(page);
  await call(page, base, 'PUT', {
    requestId: randomUUID(),
    expectedVersion: 0,
    sources: ['fed'],
    topics: [],
    muted: false,
    consent: true,
  });
  source = await reviseConnectionSourceFixture(
    feedbackSandbox,
    source,
    'published',
  );
  await page.goto('/#reading-follow');
  await expect(
    page.getByRole('button', {
      name: 'Check for reading updates',
      exact: true,
    }),
  ).toBeEnabled();
  let lost = false;
  const posted: string[] = [];
  await page.route('**/api/v1/account/reading-follow/check', async (route) => {
    posted.push(route.request().postData()!);
    if (!lost) {
      lost = true;
      const actual = await route.fetch({
        url: feedbackSandbox.apiOrigin + base + '/check',
      });
      expect(actual.status()).toBe(201);
      await route.abort('failed');
    } else await route.fallback();
  });
  await page
    .getByRole('button', { name: 'Check for reading updates', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Retry same reading action',
      exact: true,
    }),
  ).toBeVisible();
  await page.route('**/api/v1/account/reading-follow', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic current-read outage' }),
        })
      : route.fallback(),
  );
  await page
    .getByRole('button', { name: 'Retry same reading action', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Saved reading action', exact: true }),
  ).toContainText('historical result');
  await expect(
    page.getByRole('button', {
      name: 'Check for reading updates',
      exact: true,
    }),
  ).toBeDisabled();
  expect(posted).toHaveLength(2);
  expect(posted[0]).toBe(posted[1]);
  await page.unroute('**/api/v1/account/reading-follow');
  await page
    .getByRole('button', { name: 'Reload reading updates', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: `Acknowledge ${source.id}`, exact: true }),
  ).toBeEnabled();
});
test('E2E-WEB-442 complete private export spans pages and later-page real401 prevents partial download @READING-FOLLOW-001', async ({
  page,
  feedbackSandbox,
}) => {
  test.setTimeout(180000);
  await seedConnectionSource(feedbackSandbox);
  await register(page);
  await call(page, base, 'PUT', {
    requestId: randomUUID(),
    expectedVersion: 0,
    sources: ['fed'],
    topics: [],
    muted: false,
    consent: true,
  });
  for (let i = 0; i < 102; i++)
    expect(
      (
        await call(page, base + '/check', 'POST', {
          requestId: randomUUID(),
          expectedVersion: 1,
        })
      ).status,
    ).toBe(201);
  await page.goto('/#privacy');
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download account JSON', exact: true })
    .click();
  const artifact = await download;
  const contents = CompletePrivacyExportSchema.parse(
    JSON.parse(await readFile((await artifact.path())!, 'utf8')),
  );
  expect(contents.readingFollow.complete).toBe(true);
  expect(contents.readingFollow.events.length).toBeGreaterThan(103);
  const pool = await connectionDatabase(feedbackSandbox);
  let downloads = 0;
  page.on('download', () => downloads++);
  try {
    await page.route(
      '**/api/v1/account/reading-follow/export?*',
      async (route) => {
        await pool.query(
          "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
        );
        const actual = await route.fetch({
          url:
            feedbackSandbox.apiOrigin +
            base +
            '/export?' +
            new URL(route.request().url()).searchParams,
        });
        expect(actual.status()).toBe(401);
        await route.fulfill({ response: actual });
      },
    );
    await page
      .getByRole('button', { name: 'Download account JSON', exact: true })
      .click();
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download account JSON', exact: true }),
    ).toHaveCount(0);
    expect(downloads).toBe(0);
  } finally {
    await page.unroute('**/api/v1/account/reading-follow/export?*');
    await pool.end();
  }
});

test('E2E-WEB-443 close pending history keeps controls usable and actual401 invalidates held old observations @READING-FOLLOW-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  test.setTimeout(180000);
  await seedConnectionSource(feedbackSandbox);
  await register(page);
  await call(page, base, 'PUT', {
    requestId: randomUUID(),
    expectedVersion: 0,
    sources: ['fed'],
    topics: [],
    muted: false,
    consent: true,
  });
  for (let i = 0; i < 101; i++)
    await call(page, base + '/check', 'POST', {
      requestId: randomUUID(),
      expectedVersion: 1,
    });
  await page.goto('/#reading-follow');
  await page
    .getByRole('button', { name: 'View reading update history', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'More history entries', exact: true }),
  ).toBeVisible();
  let release!: () => void,
    drain!: () => void,
    held = false;
  const gate = new Promise<void>((r) => {
      release = r;
    }),
    drained = new Promise<void>((r) => {
      drain = r;
    });
  await page.route(
    '**/api/v1/account/reading-follow/export?*',
    async (route) => {
      try {
        const actual = await route.fetch({
          url:
            feedbackSandbox.apiOrigin +
            base +
            '/export?' +
            new URL(route.request().url()).searchParams,
        });
        expect(actual.status()).toBe(200);
        held = true;
        await gate;
        await route.fulfill({ response: actual });
      } finally {
        drain();
      }
    },
  );
  try {
    await page
      .getByRole('button', { name: 'More history entries', exact: true })
      .click();
    await expect.poll(() => held).toBe(true);
    await page
      .getByRole('button', { name: 'Close reading history', exact: true })
      .click();
    release();
    await drained;
    await expect(
      page.getByRole('region', { name: 'Reading update history', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', {
        name: 'Check for reading updates',
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    release();
    if (held) await drained;
    await page.unroute('**/api/v1/account/reading-follow/export?*');
  }
  await page.evaluate(() => {
    const native = window.fetch.bind(window);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const state = {
      held: false,
      status: 0,
      active: 0,
      restore: () => {
        window.fetch = native;
        release();
      },
    };
    (window as typeof window & { readingHold?: typeof state }).readingHold =
      state;
    window.fetch = async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.href,
      );
      if (
        !state.held &&
        url.pathname === '/api/v1/account/reading-follow/export' &&
        (init?.method ?? 'GET') === 'GET'
      ) {
        state.held = true;
        state.active++;
        try {
          const response = await native(input, { ...init, signal: null });
          state.status = response.status;
          if (response.status !== 200) throw Error('Expected actual held200');
          await gate;
          return response;
        } finally {
          state.active--;
        }
      }
      return native(input, init);
    };
  });
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await page
      .getByRole('button', { name: 'View reading update history', exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { readingHold?: { status: number } })
              .readingHold?.status,
        ),
      )
      .toBe(200);
    await pool.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await page
      .getByRole('button', { name: 'Reload reading updates', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Sign in for reading updates',
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() =>
      (
        window as typeof window & { readingHold?: { restore: () => void } }
      ).readingHold?.restore(),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { readingHold?: { active: number } })
              .readingHold?.active,
        ),
      )
      .toBe(0);
    await expect(
      page.getByRole('region', { name: 'Reading updates', exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.evaluate(() =>
      (
        window as typeof window & { readingHold?: { restore: () => void } }
      ).readingHold?.restore(),
    );
    await pool.end();
  }
});

test('E2E-WEB-444 first-read recovery and pending subscription save preserve disabled draft controls @READING-FOLLOW-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  await seedConnectionSource(feedbackSandbox);
  await register(page);
  await page.route('**/api/v1/discovery/catalog', (route) =>
    route.continue({
      url: feedbackSandbox.apiOrigin + '/api/v1/discovery/catalog',
    }),
  );
  let mode: 'outage' | 'unreadable' | 'healthy' = 'outage';
  await page.route('**/api/v1/account/reading-follow', async (route) => {
    if (route.request().method() !== 'GET' || mode === 'healthy') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: mode === 'outage' ? 503 : 200,
      contentType: 'application/json',
      body:
        mode === 'outage'
          ? '{"message":"Synthetic first-read outage"}'
          : 'unreadable',
    });
  });
  await page.goto('/#reading-follow');
  await expect(page.getByRole('alert')).toContainText(
    'Synthetic first-read outage',
  );
  mode = 'unreadable';
  await page
    .getByRole('button', { name: 'Reload reading updates', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('unreadable');
  mode = 'healthy';
  await page
    .getByRole('button', { name: 'Reload reading updates', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Choose sources and topics', exact: true })
    .click();
  const source = page
      .getByRole('group', { name: 'Sources', exact: true })
      .getByRole('checkbox', { name: 'Federal Reserve Board', exact: true }),
    mute = page.getByRole('checkbox', {
      name: 'Mute reading updates',
      exact: true,
    }),
    consent = page.getByRole('checkbox', {
      name: /I agree to store my reading subscriptions/,
    });
  await source.check();
  await consent.check();
  await page
    .getByRole('button', { name: 'Review subscription changes', exact: true })
    .click();
  let release!: () => void,
    finish!: () => void,
    held = false;
  const gate = new Promise<void>((r) => (release = r)),
    drained = new Promise<void>((r) => (finish = r));
  await page.route('**/api/v1/account/reading-follow', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    try {
      const actual = await route.fetch({
        url: feedbackSandbox.apiOrigin + base,
      });
      expect(actual.status()).toBe(200);
      held = true;
      await gate;
      await route.fulfill({ response: actual });
    } finally {
      finish();
    }
  });
  try {
    await page
      .getByRole('button', {
        name: 'Confirm subscription baseline',
        exact: true,
      })
      .click();
    await expect.poll(() => held).toBe(true);
    await expect(source).toBeDisabled();
    await expect(mute).toBeDisabled();
    await expect(consent).toBeDisabled();
    release();
    await drained;
    await expect(view(page)).toContainText('settings revision 1');
    await expect(
      page.getByRole('button', {
        name: 'Check for reading updates',
        exact: true,
      }),
    ).toBeEnabled();
    const saved = await call(page, base);
    expect(saved.status).toBe(200);
    expect(ReadingFollowViewSchema.parse(saved.body).config).toMatchObject({
      version: 1,
      sources: ['fed'],
      topics: [],
      muted: false,
    });
    await page.reload();
    await expect(view(page)).toContainText('settings revision 1');
    await page
      .getByRole('button', { name: 'Choose sources and topics', exact: true })
      .click();
    await expect(source).toBeChecked();
    await expect(
      page.getByRole('checkbox', {
        name: 'Federal Reserve historical',
        exact: true,
      }),
    ).not.toBeChecked();
  } finally {
    release();
    if (held) await drained;
    await page.unroute('**/api/v1/account/reading-follow');
  }
});

test('E2E-WEB-445 notice pagination and status filters retain explicit current reading navigation @READING-FOLLOW-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  await register(page);
  expect(
    (
      await call(page, base, 'PUT', {
        requestId: randomUUID(),
        expectedVersion: 0,
        sources: ['fed'],
        topics: [],
        muted: false,
        consent: true,
      })
    ).status,
  ).toBe(200);
  await readingPaginationSources(feedbackSandbox, 101);
  await page.goto('/#reading-follow');
  await page
    .getByRole('button', { name: 'Check for reading updates', exact: true })
    .click();
  const inbox = page.getByRole('region', {
    name: 'Reading update inbox',
    exact: true,
  });
  await expect(inbox.getByRole('article')).toHaveCount(100);
  await inbox
    .getByRole('button', { name: /^Acknowledge / })
    .first()
    .click();
  await page
    .getByLabel('Notice status on this page')
    .selectOption('acknowledged');
  await expect(inbox.getByRole('article')).toHaveCount(1);
  await page.getByLabel('Notice status on this page').selectOption('resolved');
  await expect(inbox).toContainText('No resolved notices on this page.');
  await page.getByLabel('Notice status on this page').selectOption('all');
  await page
    .getByRole('button', { name: 'More reading notices', exact: true })
    .click();
  await expect(inbox.getByRole('article')).toHaveCount(2);
  await expect(
    inbox.getByRole('link', {
      name: 'Open currently available reading',
      exact: true,
    }),
  ).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Reload reading updates', exact: true })
    .click();
  await expect(inbox.getByRole('article')).toHaveCount(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
