import { randomUUID } from 'node:crypto';
import { test as base, expect } from './feedback-fixture';
import {
  INDEX_LEVEL_FIELDS,
  INDEX_LEVEL_NAMES,
} from '../../../packages/contracts/src/index';
export { indiaActors } from './india-macro';
export { retentionHeaders } from './retention';
export { expect };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/index-levels(?:[/?]|$)/, (route) => {
      const url = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + url.pathname + url.search,
      });
    });
    await use(context);
  },
});
export function indexLevelInput(day = '2026-09-18', close = '100.25') {
  const filename = `ind_close_all_${day.slice(8)}${day.slice(5, 7)}${day.slice(0, 4)}.csv`;
  const date = `${day.slice(8)}-${day.slice(5, 7)}-${day.slice(0, 4)}`;
  return {
    requestId: randomUUID(),
    filename,
    sourceUrl: 'https://archives.nseindia.com/content/indices/' + filename,
    csv: [
      INDEX_LEVEL_FIELDS.join(','),
      ...INDEX_LEVEL_NAMES.map((name) =>
        [
          name,
          date,
          '100',
          '101',
          '99',
          close,
          '.25',
          '.25',
          '1000',
          '1.25',
          '10',
          '2',
          '.75',
        ].join(','),
      ),
    ].join('\r\n'),
    rightsEvidence:
      'TEST-SIMULATION: invented index levels in the verified original column grammar; no actual exchange permission claimed.',
    rightsConfirmed: true,
  };
}
export function indexLevelReview(id: string, decision = 'publish') {
  return {
    requestId: randomUUID(),
    id,
    decision,
    reason:
      'TEST-SIMULATION: independently reviewed source dates, OHLC and usage scope.',
    rightsVerified: true,
  };
}

/** Real capture requests with tied microsecond timestamps in this test's owned schema only. */
export async function seedIndexQueue(
  request: import('@playwright/test').APIRequestContext,
  sandbox: import('./feedback-fixture').FeedbackSandbox,
) {
  const { connectionDatabase } = await import('./research-connection-fixture');
  const { retentionHeaders } = await import('./retention');
  const pool = await connectionDatabase(sandbox);
  const ids: string[] = [];
  try {
    await pool.query(
      "ALTER TABLE index_levels_editions ALTER COLUMN created_at SET DEFAULT TIMESTAMPTZ '2026-09-18 12:00:00.123456+00'",
    );
    for (let index = 0; index < 21; index++) {
      const input = indexLevelInput();
      const response = await request.post('/api/v1/ops/index-levels/capture', {
        headers: retentionHeaders,
        data: input,
      });
      expect(response.status()).toBe(201);
      expect((await response.json()).state).toBe('retained');
      ids.push(input.requestId);
    }
  } finally {
    try {
      await pool.query(
        'ALTER TABLE index_levels_editions ALTER COLUMN created_at SET DEFAULT clock_timestamp()',
      );
    } finally {
      await pool.end();
    }
  }
  return ids.sort().reverse();
}
