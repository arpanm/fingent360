import { test, expect, type Page } from '@playwright/test';
import {
  LearningCatalogSchema,
  LearningStateSchema,
  LearningAttemptSchema,
} from '../../../../packages/contracts/src/index';
async function local(page: Page, path: string, body?: unknown) {
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(`/api/v1${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    { path, body },
  );
}
test('E2E-OFFLINE-221 source-backed quiz uses same rubric and stores a durable answer @SOURCES-002', async ({
  page,
}) => {
  await page.goto('/');
  const catalog = LearningCatalogSchema.parse(
    (await local(page, '/learning/catalog')).body,
  );
  expect(
    catalog.items.find((q) => q.id === 'diversification-basics')?.version,
  ).toBe(1);
  const password = 'Offline-sources-fixture-2026';
  expect(
    (
      await local(page, '/account/register', {
        username: `source_${Date.now()}`,
        password,
        consent: true,
      })
    ).status,
  ).toBe(201);
  try {
    const answer = {
      questionId: 'diversification-basics',
      version: 1,
      choiceId: 'spread',
      requestId: crypto.randomUUID(),
      consent: true,
    };
    expect(
      (await local(page, '/account/learning/attempts', answer)).status,
    ).toBe(201);
    await local(page, '/account/learning/attempts', answer);
    await page.goto('/#learning');
    const quiz = page.getByRole('article', {
      name: 'Spread the risk',
      exact: true,
    });
    await expect(quiz).toContainText('That’s right');
    await quiz
      .getByText('Read the source and related research', { exact: true })
      .click();
    await expect(
      quiz.getByRole('link', {
        name: 'Investor.gov · Asset allocation and diversification',
      }),
    ).toHaveAttribute('href', /^https:\/\/www.investor.gov\//);
    await page.reload();
    const state = LearningStateSchema.parse(
      (await local(page, '/account/learning/state')).body,
    );
    expect(
      state.attempts.filter((a) => a.questionId === answer.questionId),
    ).toHaveLength(1);
    expect(state.attempts[0]?.correct).toBe(true);
    for (const [questionId, choiceId] of [
      ['data-revisions', 'evidence'],
      ['basis-points', 'quarter'],
      ['trade-balance', 'imports'],
    ]) {
      const response = await local(page, '/account/learning/attempts', {
        questionId,
        version: 1,
        choiceId,
        requestId: crypto.randomUUID(),
        consent: true,
      });
      expect(response.status).toBe(201);
      expect(LearningAttemptSchema.parse(response.body).correct).toBe(true);
    }
  } finally {
    await page.evaluate(async (password) => {
      await fetch('/api/v1/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    }, password);
  }
});
test('E2E-OFFLINE-222 snapshot source filters and annual context preserve edition dates @SOURCES-002', async ({
  page,
}) => {
  await page.goto('/');
  const {
    FeedSchema,
    ResearchCatalogSchema,
    ResearchContextSchema,
    sourceIdFor,
  } = await import('../../../../packages/contracts/src/index');
  const catalog = ResearchCatalogSchema.parse(
    (await local(page, '/discovery/catalog')).body,
  );
  const source = catalog.sources.find((value) => value.publishedCount > 0);
  expect(source).toBeTruthy();
  const sourceFeed = FeedSchema.parse(
    (await local(page, `/discovery/feed?view=explore&source=${source!.id}`))
      .body,
  );
  expect(sourceFeed.items.length).toBeGreaterThan(0);
  expect(
    sourceFeed.items.every((item) => sourceIdFor(item) === source!.id),
  ).toBe(true);
  const topic = sourceFeed.items[0]!.topics[0]!;
  const filtered = FeedSchema.parse(
    (
      await local(
        page,
        `/discovery/feed?view=explore&source=${source!.id}&topic=${encodeURIComponent(topic)}`,
      )
    ).body,
  );
  expect(filtered.items.length).toBeGreaterThan(0);
  expect(filtered.items.every((item) => item.topics.includes(topic))).toBe(
    true,
  );
  const annuals = FeedSchema.parse(
    (await local(page, '/discovery/feed?view=explore&kind=annual')).body,
  );
  expect(annuals.items.length).toBeGreaterThan(0);
  const annual = annuals.items[0]!;
  const context = ResearchContextSchema.parse(
    (await local(page, `/discovery/items/${annual.id}/context`)).body,
  );
  expect(context.itemId).toBe(annual.id);
  expect(context.itemVersion).toBe(annual.version);
  expect(context.terms.length).toBeGreaterThan(0);
  const edition = await local(page, `/discovery/items/${annual.id}`);
  await page.reload();
  expect((await local(page, `/discovery/items/${annual.id}`)).body).toEqual(
    edition.body,
  );
  expect(
    (await local(page, `/discovery/items/${annual.id}/context`)).body,
  ).toEqual(context);
  expect(annual.effectiveLabel).toMatch(/\d{4}/);
  expect(annual.source.retrievedAt).toMatch(/^\d{4}-/);
});
