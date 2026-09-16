import type { FeedbackSandbox } from './feedback-fixture';
import { connectionDatabase } from './research-connection-fixture';
import { automaticPublicationConfig } from './research-auto-publication';
/** Minimal reconstructed HTML around official March23 schedule dates; not original source bytes or permission. */
export const rbiShape =
  '<h1>Meeting Schedule of the Monetary Policy Committee for 2026-2027</h1><p>Date : Mar 23, 2026</p><table><tr><td>Dates of meetings of Monetary Policy Committee for 2026-27</td></tr>' +
  [
    'April 6, 7 and 8, 2026',
    'June 3, 4 and 5, 2026',
    'August 3, 4 and 5, 2026',
    'October 5, 6 and 7, 2026',
    'December 2, 3 and 4, 2026',
    'February 3, 4 and 5, 2027',
  ]
    .map((v) => `<tr><td>${v}</td></tr>`)
    .join('') +
  '</table><p>Press Release: 2025-2026/2306</p>';
export async function rbiCalendarFixture(
  sandbox: FeedbackSandbox,
  body = rbiShape,
  at = '2026-09-15T00:00:00.000Z',
) {
  const pool = await connectionDatabase(sandbox),
    { mongo } = await automaticPublicationConfig(sandbox);
  try {
    const { retainRbiCalendar } = await import(
      new URL('../../../apps/api/dist/rbi-calendar.js', import.meta.url).href
    );
    return (await retainRbiCalendar(
      pool,
      mongo,
      body,
      at,
      'TEST SIMULATION ONLY: no production permission claim.',
    )) as string;
  } finally {
    await Promise.allSettled([pool.end(), mongo.close()]);
  }
}
