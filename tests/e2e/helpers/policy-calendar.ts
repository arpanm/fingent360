import { readFile } from 'node:fs/promises';
import type { FeedbackSandbox } from './feedback-fixture';
import { connectionDatabase } from './research-connection-fixture';
import { automaticPublicationConfig } from './research-auto-publication';
export const fomcShape = () =>
  readFile(
    new URL(
      '../../../packages/contracts/test/fixtures/fomc-calendar-shape.html',
      import.meta.url,
    ),
    'utf8',
  );
export async function policyCalendarFixture(
  sandbox: FeedbackSandbox,
  body?: string,
  at = '2026-09-15T00:00:00.000Z',
) {
  const pool = await connectionDatabase(sandbox),
    { mongo } = await automaticPublicationConfig(sandbox);
  try {
    const { retainPolicyCalendar } = await import(
      new URL('../../../apps/api/dist/policy-calendar.js', import.meta.url).href
    );
    return (await retainPolicyCalendar(
      pool,
      mongo,
      body ?? (await fomcShape()),
      at,
    )) as string;
  } finally {
    await Promise.allSettled([pool.end(), mongo.close()]);
  }
}
