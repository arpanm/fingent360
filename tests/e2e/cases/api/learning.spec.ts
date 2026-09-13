import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  LearningCatalogSchema,
  LearningAttemptSchema,
  LearningStateSchema,
  LearningSuggestionsSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'Synthetic-learning-tests-2026';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-140 glossary quizzes, poll aggregation, ownership and export @UX-002 @LEARN-001', async ({
  request,
  playwright,
  baseURL,
}) => {
  test.setTimeout(60000);
  const other = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    const catalog = LearningCatalogSchema.parse(
      await (await request.get('/api/v1/learning/catalog')).json(),
    );
    expect(catalog.items.length).toBeGreaterThanOrEqual(3);
    expect(new Set(catalog.items.map((item) => item.id)).size).toBe(
      catalog.items.length,
    );
    expect(
      catalog.items.some(
        (item) => item.kind === 'quiz' && item.id === 'isin-meaning',
      ),
    ).toBe(true);
    expect(catalog.items.some((item) => item.kind === 'poll')).toBe(true);
    expect((await request.get('/api/v1/account/learning/state')).status()).toBe(
      401,
    );
    for (const client of [request, other])
      expect(
        (
          await client.post('/api/v1/account/register', {
            headers,
            data: {
              username: `learn_${randomUUID().slice(0, 16)}`,
              password,
              consent: true,
            },
          })
        ).status(),
      ).toBe(201);
    const input = {
      questionId: 'isin-meaning',
      version: 1,
      choiceId: 'account',
      requestId: randomUUID(),
      consent: true,
    };
    const first = LearningAttemptSchema.parse(
      await (
        await request.post('/api/v1/account/learning/attempts', {
          headers,
          data: input,
        })
      ).json(),
    );
    expect(first.correct).toBe(false);
    const repeat = LearningAttemptSchema.parse(
      await (
        await request.post('/api/v1/account/learning/attempts', {
          headers,
          data: input,
        })
      ).json(),
    );
    expect(repeat.id).toBe(first.id);
    expect(
      (
        await request.post('/api/v1/account/learning/attempts', {
          headers,
          data: { ...input, choiceId: 'security' },
        })
      ).status(),
    ).toBe(409);
    const correct = LearningAttemptSchema.parse(
      await (
        await request.post('/api/v1/account/learning/attempts', {
          headers,
          data: { ...input, choiceId: 'security', requestId: randomUUID() },
        })
      ).json(),
    );
    expect(correct.correct).toBe(true);
    expect(correct.sourceRevision).toBe('glossary-dev001-v1');
    const vote = {
      questionId: 'learning-interest',
      version: 1,
      choiceId: 'goals',
      requestId: randomUUID(),
      consent: true,
    };

    expect(
      (
        await request.post('/api/v1/account/learning/vote', {
          headers,
          data: vote,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/account/learning/vote', {
          headers,
          data: vote,
        })
      ).status(),
    ).toBe(201);
    let state = LearningStateSchema.parse(
      await (await request.get('/api/v1/account/learning/state')).json(),
    );
    expect(state.attempts).toHaveLength(2);
    expect(state.polls[0]!.total).toBeGreaterThanOrEqual(1);
    expect(state.polls[0]!.counts.reduce((sum, v) => sum + v.count, 0)).toBe(
      state.polls[0]!.total,
    );
    expect(state.votes[0]!.choiceId).toBe('goals');
    expect(
      (
        await request.post('/api/v1/account/learning/vote', {
          headers,
          data: { ...vote, choiceId: 'sources' },
        })
      ).status(),
    ).toBe(201);
    state = LearningStateSchema.parse(
      await (await request.get('/api/v1/account/learning/state')).json(),
    );
    expect(state.polls[0]!.total).toBeGreaterThanOrEqual(1);
    expect(state.polls[0]!.counts.reduce((sum, v) => sum + v.count, 0)).toBe(
      state.polls[0]!.total,
    );
    expect(state.votes[0]!.choiceId).toBe('sources');
    const isolated = LearningStateSchema.parse(
      await (await other.get('/api/v1/account/learning/state')).json(),
    );
    expect(isolated.attempts).toEqual([]);
    expect(isolated.votes).toEqual([]);
    const exported = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(exported.learning.attempts).toHaveLength(2);
    expect(exported.learning.votes[0]!.choiceId).toBe('sources');
    const otherExport = PrivacyExportSchema.parse(
      await (await other.get('/api/v1/account/privacy/export')).json(),
    );
    expect(otherExport.learning.attempts).toEqual([]);
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
    await other.delete('/api/v1/account', { headers, data: { password } });
    await other.dispose();
  }
});
test('E2E-API-141 learning validation and saved-input suggestions @UX-002 @ASSIST-001', async ({
  request,
}) => {
  try {
    expect(
      (
        await request.post('/api/v1/account/register', {
          headers,
          data: {
            username: `learn_${randomUUID().slice(0, 16)}`,
            password,
            consent: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      LearningSuggestionsSchema.parse(
        await (
          await request.get('/api/v1/account/learning/suggestions')
        ).json(),
      ).suggestions,
    ).toEqual([]);
    const input = {
      questionId: 'isin-meaning',
      version: 1,
      choiceId: 'security',
      requestId: randomUUID(),
      consent: true,
    };
    expect(
      (
        await request.post('/api/v1/account/learning/attempts', { data: input })
      ).status(),
    ).toBe(403);
    for (const invalid of [
      { ...input, choiceId: 'invented' },
      { ...input, version: 2 },
      { ...input, consent: false },
      { ...input, userId: randomUUID() },
    ])
      expect(
        (
          await request.post('/api/v1/account/learning/attempts', {
            headers,
            data: invalid,
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await request.post('/api/v1/account/goals', {
          headers,
          data: {
            name: 'Synthetic historical plan',
            type: 'education',
            targetMinor: '100000',
            savedMinor: '0',
            monthlyMinor: '12345',
            horizonMonths: 24,
            currency: 'INR',
            scale: 2,
            assumptions: 'no-growth-nominal-v1',
            storageConsent: true,
          },
        })
      ).status(),
    ).toBe(201);
    const suggestions = LearningSuggestionsSchema.parse(
      await (await request.get('/api/v1/account/learning/suggestions')).json(),
    );
    const goal = suggestions.suggestions.find((s) => s.kind === 'goal');
    expect(goal?.values.monthlyMinor).toBe('12345');
    expect(goal?.sourceName).toBe('Synthetic historical plan');
    expect(suggestions.basis).toBe('your-saved-input-only');
  } finally {
    await request.delete('/api/v1/account', { headers, data: { password } });
  }
});
