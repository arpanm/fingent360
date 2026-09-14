import { test, expect, eventFixture } from '../../helpers/event-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  connectionDatabase,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import {
  EventExtractionViewSchema,
  EventOperationsSchema,
  type FeedItem,
} from '../../../../packages/contracts/src/index';
import type { Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

function activeApiRequests(page: Page) {
  const active = new Set<unknown>();
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      active.add(request);
  });
  page.on('requestfinished', (request) => active.delete(request));
  page.on('requestfailed', (request) => active.delete(request));
  return () => active.size;
}
async function openExtraction(page: Page) {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page.getByRole('button', { name: 'Event review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Prepare event from a source', exact: true })
    .click();
  return page.getByRole('region', {
    name: 'Prepare event from source',
    exact: true,
  });
}
async function selectSource(region: Locator, source: FeedItem) {
  await region
    .getByLabel('Find retained published sources', { exact: true })
    .fill(source.title.slice(0, 80));
  await region
    .getByRole('button', { name: 'Search sources', exact: true })
    .click();
  const radio = region
    .getByRole('group', { name: 'Choose a retained source', exact: true })
    .getByRole('radio')
    .first();
  await expect(radio).toBeEnabled();
  await radio.focus();
  await radio.press('Space');
  await expect(
    region.getByRole('region', {
      name: 'Selected source preview',
      exact: true,
    }),
  ).toContainText(source.title);
  await region
    .getByLabel('Preparation method', { exact: true })
    .selectOption('template');
}
async function prepare(page: Page, region: Locator) {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      /\/ops\/event-extractions\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await region
    .getByRole('button', { name: 'Prepare source candidate', exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(200);
  const view = EventExtractionViewSchema.parse(await result.json());
  await expect(
    region.getByText('Exact source template; no AI was used.', { exact: true }),
  ).toBeVisible();
  return view;
}
async function editCandidate(
  region: Locator,
  title = 'Synthetic human-reviewed extracted event',
) {
  await region.getByLabel('Candidate event title', { exact: true }).fill(title);
  await region
    .getByLabel('Candidate event family', { exact: true })
    .fill('Synthetic source context');
  await region
    .getByLabel('Candidate geography, comma separated', { exact: true })
    .fill('India');
  await region
    .getByLabel('Candidate claim type', { exact: true })
    .selectOption('inference');
  await region
    .getByLabel('Candidate editorial explanation', { exact: true })
    .fill(
      'Synthetic human-authored explanation of the retained excerpt. No market effect is asserted.',
    );
  await region
    .getByLabel('Candidate review reason', { exact: true })
    .fill(
      'Synthetic review of exact source excerpts and explicitly entered context.',
    );
}
async function acceptCandidate(region: Locator) {
  await region
    .getByRole('button', { name: 'Review event draft', exact: true })
    .click();
  await region
    .getByRole('button', {
      name: 'Confirm and create event draft',
      exact: true,
    })
    .click();
  await expect(
    region.getByRole('heading', { name: 'Event draft created', exact: true }),
  ).toBeVisible();
}

test('E2E-WEB-850 retained source preview keyboard review cancel actual draft and separate publication with mobile layout @EVENT-EXTRACTION-001', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  let legacyChoiceReads = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/ops/discovery/items')
      legacyChoiceReads++;
  });
  const { source } = await eventFixture(request, feedbackSandbox),
    region = await openExtraction(page);
  await selectSource(region, source);
  await region.getByText('Preview source body', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(region).toContainText(
    'only this bounded source text, never account records',
  );
  const view = await prepare(page, region);
  expect(view.attempt.candidate).not.toBeNull();
  expect(legacyChoiceReads).toBe(0);
  await expect(
    region.getByLabel('Candidate event family', { exact: true }),
  ).toHaveValue('');
  await region
    .getByLabel('Candidate event title', { exact: true })
    .fill('Synthetic title-only unsaved edit');
  page.once('dialog', (dialog) => dialog.dismiss());
  await region
    .getByRole('button', { name: 'Back to event review', exact: true })
    .click();
  await expect(
    region.getByLabel('Candidate event title', { exact: true }),
  ).toHaveValue('Synthetic title-only unsaved edit');
  await region
    .getByRole('button', { name: 'Review event draft', exact: true })
    .click();
  await expect(region.getByRole('alert')).toContainText(
    'Enter a title, event family',
  );
  await editCandidate(region);
  await region
    .getByRole('button', { name: 'Review event draft', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    region.getByRole('heading', {
      name: 'Review the event draft',
      exact: true,
    }),
  ).toBeFocused();
  await region
    .getByRole('button', { name: 'Back to candidate editing', exact: true })
    .click();
  await expect(
    region.getByLabel('Candidate event title', { exact: true }),
  ).toHaveValue('Synthetic human-reviewed extracted event');
  await acceptCandidate(region);
  const eventId = view.attempt.candidate!.eventId;
  const stored = EventOperationsSchema.parse(
    await (await request.get('/api/v1/ops/events/' + eventId)).json(),
  );
  expect(stored.latest.editorial.announcedAt).toBeNull();
  expect(stored.latest.editorial.effectiveAt).toBeNull();
  expect(stored.latest.editorial.links).toEqual([]);
  expect((await request.get('/api/v1/events/' + eventId)).status()).toBe(404);
  await region
    .getByRole('button', { name: 'Open created event draft', exact: true })
    .click();
  const editor = page.getByRole('region', {
    name: 'Event editorial review',
    exact: true,
  });
  await expect(editor.getByLabel('Event title', { exact: true })).toHaveValue(
    'Synthetic human-reviewed extracted event',
  );
  expect(legacyChoiceReads).toBe(1);
  await expect(
    editor.getByLabel('Exact excerpt 1', { exact: true }),
  ).toHaveValue(view.attempt.candidate!.excerpts[0]!.quote);
  await editor
    .getByLabel('Event review note', { exact: true })
    .fill(
      'Synthetic independent bootstrap publication step after draft review.',
    );
  await editor
    .getByRole('button', { name: 'Review event publication', exact: true })
    .click();
  await expect(editor.getByRole('status')).toContainText(
    'Saved historical event review receipt',
  );
  await editor
    .getByRole('button', { name: 'Close event editor', exact: true })
    .click();
  await editor
    .getByRole('link', { name: 'Read public event', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic human-reviewed extracted event',
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Back to events', exact: true }).click();
  await expect(
    page.getByRole('link', {
      name: 'Synthetic human-reviewed extracted event',
      exact: true,
    }),
  ).toBeVisible();
});

test('E2E-WEB-851 real committed preparation and decision lost replies replay the exact identities then failed draft opening preserves receipt @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const active = activeApiRequests(page),
    { source } = await eventFixture(request, feedbackSandbox),
    region = await openExtraction(page);
  await selectSource(region, source);
  const prepared: string[] = [],
    decided: string[] = [];
  let failDraftRead = true;
  const pattern = '**/api/v1/ops/event-extractions/**',
    draftPattern = '**/api/v1/ops/events/*';
  await page.route(pattern, async (route) => {
    const path = new URL(route.request().url()).pathname,
      method = route.request().method();
    if (method !== 'PUT' && method !== 'POST') {
      await route.fallback();
      return;
    }
    const ids = method === 'PUT' ? prepared : decided;
    ids.push(
      method === 'PUT'
        ? path.split('/').at(-1)!
        : (route.request().postDataJSON() as { requestId: string }).requestId,
    );
    const response = await route.fetch({
      url: feedbackSandbox.apiOrigin + path,
    });
    expect(response.status()).toBe(method === 'PUT' ? 200 : 201);
    if (ids.length === 1) await route.abort('failed');
    else if (method === 'POST' && ids.length === 2) {
      // The real decision has committed; this explicitly malformed delivery
      // binds its otherwise valid body to a different decision request.
      const actual = EventExtractionViewSchema.parse(await response.json());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ...actual,
          decision: { ...actual.decision!, requestId: randomUUID() },
        }),
      });
    } else await route.fulfill({ response });
  });
  await page.route(draftPattern, async (route) => {
    if (route.request().method() === 'GET' && failDraftRead)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Synthetic saved-draft read unavailable.',
        }),
      });
    else await route.fallback();
  });
  try {
    await region
      .getByRole('button', { name: 'Prepare source candidate', exact: true })
      .click();
    await region
      .getByRole('button', {
        name: 'Retry same extraction request',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('group', {
        name: 'Add human-reviewed event context',
        exact: true,
      }),
    ).toBeVisible();
    await editCandidate(region);
    await region
      .getByRole('button', { name: 'Review event draft', exact: true })
      .click();
    await region
      .getByRole('button', {
        name: 'Confirm and create event draft',
        exact: true,
      })
      .click();
    await region
      .getByRole('button', {
        name: 'Retry same extraction request',
        exact: true,
      })
      .click();
    await expect(region.getByRole('alert')).toContainText(
      'returned decision does not confirm this request',
    );
    await expect(
      region.getByRole('region', {
        name: 'Extraction decision receipt',
        exact: true,
      }),
    ).toHaveCount(0);
    await region
      .getByRole('button', {
        name: 'Retry same extraction request',
        exact: true,
      })
      .click();
    const receipt = region.getByRole('region', {
      name: 'Extraction decision receipt',
      exact: true,
    });
    await expect(receipt).toContainText('Event draft created');
    expect(prepared).toHaveLength(2);
    expect(prepared[0]).toBe(prepared[1]);
    expect(decided).toHaveLength(3);
    expect(new Set(decided).size).toBe(1);
    await receipt
      .getByRole('button', { name: 'Open created event draft', exact: true })
      .click();
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic saved-draft read unavailable',
    );
    await expect(receipt).toContainText('historical decision');
    await expect(page.getByLabel('Event title', { exact: true })).toHaveCount(
      0,
    );
    failDraftRead = false;
    await receipt
      .getByRole('button', { name: 'Open created event draft', exact: true })
      .click();
    await expect(page.getByLabel('Event title', { exact: true })).toHaveValue(
      'Synthetic human-reviewed extracted event',
    );
  } finally {
    await page.unroute(pattern);
    await page.unroute(draftPattern);
    await expect.poll(active).toBe(0);
  }
});

for (const [caseId, expire] of [
  [852, false],
  [853, true],
] as const) {
  test(`E2E-WEB-${caseId} ${expire ? 'actual session denial clears private extraction despite held successful draft read' : 'Back fences held successful draft opening without reopening the editor'} @EVENT-EXTRACTION-001 @TEST-SIMULATION`, async ({
    page,
    request,
    feedbackSandbox,
  }) => {
    const network = activeApiRequests(page),
      { source } = await eventFixture(request, feedbackSandbox),
      region = await openExtraction(page);
    await selectSource(region, source);
    const view = await prepare(page, region);
    await editCandidate(region);
    await acceptCandidate(region);
    await expect.poll(network).toBe(0);
    const eventId = view.attempt.candidate!.eventId,
      pattern = '**/api/v1/ops/events/' + eventId;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = 0,
      active = 0;
    await page.route(pattern, async (route) => {
      active++;
      try {
        const response = await route.fetch({
          url: `${feedbackSandbox.apiOrigin}/api/v1/ops/events/${eventId}`,
        });
        expect(response.status()).toBe(200);
        held++;
        await gate;
        await route.fulfill({ response });
      } finally {
        active--;
      }
    });
    try {
      await region
        .getByRole('button', { name: 'Open created event draft', exact: true })
        .click();
      await expect.poll(() => held).toBeGreaterThan(0);
      if (expire) {
        const pool = await connectionDatabase(feedbackSandbox);
        try {
          await pool.query('DELETE FROM operator_sessions');
        } finally {
          await pool.end();
        }
      }
      await region
        .getByRole('button', { name: 'Back to event review', exact: true })
        .click();
      if (expire)
        await expect(
          page.getByRole('button', {
            name: 'Sign in to operations',
            exact: true,
          }),
        ).toBeVisible();
      else
        await expect(
          page.getByRole('button', {
            name: 'Prepare event from a source',
            exact: true,
          }),
        ).toBeEnabled();
      release();
      await expect.poll(() => active).toBe(0);
      await expect.poll(network).toBe(0);
      await expect(page.getByLabel('Event title', { exact: true })).toHaveCount(
        0,
      );
      await expect(region).toHaveCount(0);
      if (expire) {
        await expect(
          page.getByRole('region', {
            name: 'Event editorial review',
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByText(view.attempt.candidate!.excerpts[0]!.quote, {
            exact: true,
          }),
        ).toHaveCount(0);
      }
    } finally {
      release();
      await page.unroute(pattern);
      await expect.poll(() => active).toBe(0);
      await expect.poll(network).toBe(0);
    }
  });
}

test('E2E-WEB-854 setup and authoritative refresh failures recover while actual source withdrawal permits only historical decline @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const network = activeApiRequests(page),
    { source } = await eventFixture(request, feedbackSandbox);
  let failSetup = true,
    failRead = false;
  const options = '**/api/v1/ops/event-extractions/options',
    reads = '**/api/v1/ops/event-extractions/*';
  await page.route(options, async (route) => {
    if (failSetup)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Synthetic preparation setup failure.',
        }),
      });
    else await route.fallback();
  });
  let region: Locator | undefined;
  try {
    region = await openExtraction(page);
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic preparation setup failure',
    );
    failSetup = false;
    await region
      .getByRole('button', { name: 'Retry preparation setup', exact: true })
      .click();
    await selectSource(region, source);
    const view = await prepare(page, region);
    await editCandidate(region);
    await page.route(reads, async (route) => {
      if (failRead && route.request().method() === 'GET')
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Synthetic current-source read failure.',
          }),
        });
      else await route.fallback();
    });
    failRead = true;
    await region
      .getByRole('button', { name: 'Refresh candidate status', exact: true })
      .click();
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic current-source read failure',
    );
    await expect(
      region.getByRole('button', { name: 'Review event draft', exact: true }),
    ).toBeDisabled();
    await expect(region).toContainText(
      'Refresh the candidate status before continuing its review',
    );
    failRead = false;
    await region
      .getByRole('button', { name: 'Refresh candidate status', exact: true })
      .click();
    await expect(
      region.getByRole('button', { name: 'Review event draft', exact: true }),
    ).toBeEnabled();
    await expect(
      region.getByLabel('Candidate event title', { exact: true }),
    ).toHaveValue('Synthetic human-reviewed extracted event');
    await reviseConnectionSourceFixture(feedbackSandbox, source, 'withdrawn');
    await region
      .getByRole('button', { name: 'Refresh candidate status', exact: true })
      .click();
    await expect(region).toContainText(
      'This source is no longer the admitted edition',
    );
    await expect(
      region.getByRole('button', { name: 'Review event draft', exact: true }),
    ).toBeDisabled();
    await region
      .getByRole('button', { name: 'Decline candidate', exact: true })
      .click();
    await region
      .getByRole('button', { name: 'Confirm candidate decline', exact: true })
      .click();
    await expect(
      region.getByRole('heading', { name: 'Candidate declined', exact: true }),
    ).toBeVisible();
    await region
      .getByRole('button', { name: 'Choose another source', exact: true })
      .click();
    await region
      .getByRole('button', { name: 'Load extraction history', exact: true })
      .click();
    await region
      .getByRole('button', {
        name: 'Open preparation ' + view.attempt.requestId,
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('heading', { name: 'Candidate declined', exact: true }),
    ).toBeVisible();
    const stored = EventExtractionViewSchema.parse(
      await (
        await request.get(
          '/api/v1/ops/event-extractions/' + view.attempt.requestId,
        )
      ).json(),
    );
    expect(stored.currentSource).toBe('withdrawn');
    expect(stored.decision?.eventId).toBeNull();
  } finally {
    await page.unroute(options);
    await page.unroute(reads);
    await expect.poll(network).toBe(0);
  }
});

test('E2E-WEB-855 lost actual preparation reply then simulated busy409 preserves request identity and recovers the actual saved receipt @EVENT-EXTRACTION-001 @TEST-SIMULATION', async ({
  page,
  request,
  feedbackSandbox,
}) => {
  const network = activeApiRequests(page),
    { source } = await eventFixture(request, feedbackSandbox),
    region = await openExtraction(page);
  await selectSource(region, source);
  const ids: string[] = [],
    pattern = '**/api/v1/ops/event-extractions/*';
  let committed: ReturnType<typeof EventExtractionViewSchema.parse> | undefined;
  await page.route(pattern, async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    const path = new URL(route.request().url()).pathname;
    ids.push(path.split('/').at(-1)!);
    if (ids.length === 1) {
      const response = await route.fetch({
        url: feedbackSandbox.apiOrigin + path,
      });
      expect(response.status()).toBe(200);
      committed = EventExtractionViewSchema.parse(await response.json());
      await route.abort('failed');
    } else {
      // The first operation really committed. Only the subsequent busy error is
      // simulated here; actual in-flight request exclusion is an API acceptance.
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          message:
            'Synthetic busy extraction request; inspect the saved receipt.',
        }),
      });
    }
  });
  try {
    await region
      .getByRole('button', { name: 'Prepare source candidate', exact: true })
      .click();
    await region
      .getByRole('button', {
        name: 'Retry same extraction request',
        exact: true,
      })
      .click();
    await expect(region.getByRole('alert')).toContainText(
      'Synthetic busy extraction request',
    );
    await expect(
      region.getByRole('button', {
        name: 'Retry same extraction request',
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      region.getByRole('button', {
        name: 'Prepare source candidate',
        exact: true,
      }),
    ).toHaveCount(0);
    await region
      .getByRole('button', {
        name: 'Check saved extraction receipt',
        exact: true,
      })
      .click();
    await expect(
      region.getByRole('region', {
        name: 'Unconfirmed extraction request',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      region.getByText('Exact source template; no AI was used.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      region.getByRole('group', {
        name: 'Add human-reviewed event context',
        exact: true,
      }),
    ).toBeVisible();
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(committed?.attempt.requestId).toBe(ids[0]);
    const saved = EventExtractionViewSchema.parse(
      await (
        await request.get('/api/v1/ops/event-extractions/' + ids[0])
      ).json(),
    );
    expect(saved.attempt).toEqual(committed!.attempt);
    expect(saved.decision).toBeNull();
  } finally {
    await page.unroute(pattern);
    await expect.poll(network).toBe(0);
  }
});
