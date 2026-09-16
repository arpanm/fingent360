import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  governanceFixture,
  governanceHeaders as headers,
} from './research-governance';
import type { FeedbackSandbox } from './feedback-fixture';
/** Reconstructed markup from original CCIL static table inspected2026-09-15; independently read numeric facts. Permission/auth fixtures are simulations. */
export function ccilZeroHtml() {
  return (
    '<html><table id="advancedSearch"><thead><tr>' +
    ['Date', 'ß0', 'ß1', 'ß2', 'ß3', 'tau1', 'tau2']
      .map((v) => '<th>' + v + '</th>')
      .join('') +
    '</tr></thead><tbody>' +
    [
      [
        '2026-09-11 00:00:00.0',
        '8.2269',
        '-2.8677',
        '-15.8059',
        '17.9237',
        '8.7201',
        '8.7209',
      ],
      [
        '2026-09-10 00:00:00.0',
        '8.1605',
        '-2.7912',
        '-15.6213',
        '18.1066',
        '10.0509',
        '10.043',
      ],
    ]
      .map(
        (row) =>
          '<tr>' + row.map((v) => '<td>' + v + '</td>').join('') + '</tr>',
      )
      .join('') +
    '</tbody></table></html>'
  );
}
export async function publishedCcilZeroFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const auth = await governanceFixture(request, playwright, sandbox);
  try {
    const id = randomUUID();
    const capture = await request.post('/api/v1/ops/bond-zero-curve/import', {
      headers,
      data: { requestId: id, body: ccilZeroHtml() },
    });
    expect(capture.status()).toBe(201);
    const review = await auth.reviewer.post(
      `/api/v1/ops/bond-zero-curve/${id}/review`,
      {
        headers,
        data: {
          requestId: randomUUID(),
          decision: 'publish',
          reason: 'Independent reconstructed NSS source review.',
        },
      },
    );
    expect(review.status()).toBe(201);
    return { ...auth, id, edition: await review.json() };
  } catch (error) {
    await auth.reviewer.dispose();
    throw error;
  }
}

export async function ccilZeroPointsHtml() {
  return (
    '<html><script>var records = ' +
    (await readFile(
      new URL('../fixtures/ccil-zero-points.json', import.meta.url),
      'utf8',
    )) +
    ';</script></html>'
  );
}

/** Explicit disposable-schema volume simulation from one actual retained/reviewed original. */
export async function ccilZeroVolume(sandbox: FeedbackSandbox, id: string) {
  const { connectionDatabase } = await import('./research-connection-fixture');
  const database = await connectionDatabase(sandbox);
  try {
    await database.query(
      "WITH copies AS (INSERT INTO ccil_zero_editions(id,hash,source_url,retrieved_at,data,error,prepared_by,permission_reference) SELECT gen_random_uuid(),hash,source_url,retrieved_at,data,error,prepared_by,permission_reference FROM ccil_zero_editions CROSS JOIN generate_series(1,100) WHERE id=$1 RETURNING id) INSERT INTO ccil_zero_reviews(request_id,edition_id,fingerprint,decision,reason,reviewer) SELECT gen_random_uuid(),copies.id,'explicit-volume-fixture','publish','Explicit synthetic volume fixture',r.reviewer FROM copies CROSS JOIN ccil_zero_reviews r WHERE r.edition_id=$1",
      [id],
    );
  } finally {
    await database.end();
  }
}
