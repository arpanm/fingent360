import { expect, type APIRequestContext } from '@playwright/test';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
import { operatorKey } from './operator';
import {
  MacroDashboardSchema,
  MacroRunSchema,
} from '../../../packages/contracts/src/index';
export const macroIndicator = 'NY.GDP.MKTP.KD.ZG';
export async function worldBankMode(
  sandbox: FeedbackSandbox,
  mode:
    | 'success'
    | 'http'
    | 'network'
    | 'format'
    | 'invalid'
    | 'empty'
    | 'interrupted'
    | 'oversized',
) {
  const pool = await connectionDatabase(sandbox);
  try {
    await pool.query(
      'UPDATE test_world_bank_provider SET mode=$1 WHERE id=true',
      [mode],
    );
  } finally {
    await pool.end();
  }
}
export async function seedStaleMacro(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const headers = { Authorization: `Bearer ${await operatorKey()}` };
  const response = await request.post('/api/v1/macro/refresh', {
    headers,
    data: { indicator: macroIndicator },
  });
  expect(response.status()).toBe(200);
  const run = MacroRunSchema.parse(await response.json());
  const pool = await connectionDatabase(sandbox);
  try {
    await pool.query(
      "UPDATE macro_runs SET started_at=now()-interval '8 days 1 minute',finished_at=now()-interval '8 days' WHERE id=$1",
      [run.id],
    );
  } finally {
    await pool.end();
  }
  const dashboard = MacroDashboardSchema.parse(
    await (await request.get('/api/v1/macro')).json(),
  );
  const source = dashboard.sources.find(
    (row) => row.indicator === macroIndicator,
  )!;
  expect(source.freshness).toBe('refresh_due');
  expect(source.observations[0]?.value).toBe('1.234567890123456789');
  return { headers, source };
}
