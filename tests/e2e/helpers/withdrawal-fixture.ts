import { createHash, randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  FeedItemSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import {
  connectionDatabase,
  connectionHeaders,
} from './research-connection-fixture';
import { beaStorage, beaOperator } from './bea-fixture';

// Every record below is explicitly synthetic; no provider fetch or side effect on import.
export async function withdrawalFixture(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
) {
  const suffix = randomUUID().slice(0, 8),
    at = '2026-09-13T12:00:00.000Z';
  const titles = [
    `Synthetic withdrawn secret ${suffix} <script>`,
    `Synthetic visible sibling ${suffix}`,
  ];
  const url = 'https://www.federalreserve.gov/feeds/press_all.xml';
  const body = `<rss><channel>${titles.map((title) => `<item><title><![CDATA[${title}]]></title></item>`).join('')}</channel></rss>`;
  const hash = createHash('sha256')
    .update(url + '\n' + body)
    .digest('hex');
  const items = titles.map((title, i) =>
    FeedItemSchema.parse({
      id: `fed-withdrawal-${suffix}-${i}`,
      version: 1,
      kind: 'news',
      title,
      summary: `Synthetic summary ${suffix}-${i}`,
      body: `Synthetic body ${suffix}-${i}`,
      topics: ['Inflation'],
      publishedAt: at,
      effectiveLabel: 'Synthetic dated lifecycle fixture',
      source: {
        name: 'Federal Reserve Board',
        url: `https://www.federalreserve.gov/newsevents/pressreleases/synthetic-${suffix}-${i}.htm`,
        retrievedAt: at,
        rights: 'Synthetic fixture; no live source claim.',
      },
      sourceHash: hash,
      importance: 1,
      relatedIds: [],
      status: 'draft',
      correctionNote: null,
      reviewedAt: null,
    }),
  );
  const pool = await connectionDatabase(sandbox),
    storage = await beaStorage(sandbox);
  try {
    await storage.mongo
      .db()
      .collection('discovery_raw')
      .insertOne({ _id: hash, url, body, retrievedAt: at });
    for (const item of items) {
      await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
        item.id,
      ]);
      await pool.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
        [item.id, item],
      );
    }
  } finally {
    await pool.end();
    await storage.close();
  }
  await beaOperator(request);
  const first = await withdrawReview(request, items[0]!, 'published'),
    sibling = await withdrawReview(request, items[1]!, 'published');
  return { first, sibling, body, hash };
}
export async function withdrawReview(
  request: APIRequestContext,
  item: FeedItem,
  status: 'published' | 'withdrawn',
) {
  const response = await request.put(`/api/v1/ops/discovery/items/${item.id}`, {
    headers: connectionHeaders,
    data: {
      expectedVersion: item.version,
      status,
      correctionNote: `Synthetic editorial note containing ${item.title}`,
    },
  });
  if (!response.ok())
    throw Error(`Isolated publication review: ${response.status()}`);
  return FeedItemSchema.parse(await response.json());
}
export async function withdrawalMedia(
  request: APIRequestContext,
  sandbox: FeedbackSandbox,
  item: FeedItem,
) {
  const storage = await beaStorage(sandbox),
    pool = await connectionDatabase(sandbox);
  try {
    const { buildSourceMedia } = await import(
      new URL('../../../apps/api/dist/media.js', import.meta.url).href
    );
    const asset = buildSourceMedia(item);
    await pool.query(
      'INSERT INTO discovery_media(id,item_id,item_version,data) VALUES($1,$2,$3,$4)',
      [asset.id, item.id, item.version, asset],
    );
    const reviewed = await request.put(`/api/v1/ops/media/${item.id}`, {
      headers: connectionHeaders,
      data: { assetId: asset.id, publish: true },
    });
    if (!reviewed.ok())
      throw Error(`Isolated media review: ${reviewed.status()}`);
    return reviewed.json();
  } finally {
    await storage.close();
    await pool.end();
  }
}
export async function waitForBlocked(
  pool: Awaited<ReturnType<typeof connectionDatabase>>,
  count: number,
) {
  const { expect } = await import('@playwright/test');
  await expect
    .poll(async () => {
      await pool.query('SELECT pg_stat_clear_snapshot()');
      const r = await pool.query(
        "SELECT count(*)::integer AS n FROM pg_stat_activity a WHERE a.wait_event_type='Lock' AND (pg_backend_pid()=ANY(pg_blocking_pids(a.pid)) OR EXISTS(SELECT 1 FROM unnest(pg_blocking_pids(a.pid)) b(pid) WHERE pg_backend_pid()=ANY(pg_blocking_pids(b.pid))))",
      );
      return r.rows[0].n;
    })
    .toBeGreaterThanOrEqual(count);
}

export async function waitForQueryBlocked(
  pool: Awaited<ReturnType<typeof connectionDatabase>>,
  query: string,
  blockers: number[],
) {
  const { expect } = await import('@playwright/test');
  let pid = 0;
  await expect
    .poll(
      async () => {
        await pool.query('SELECT pg_stat_clear_snapshot()');
        const result = await pool.query(
          "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query=$1 AND pg_blocking_pids(pid) && $2::integer[] ORDER BY query_start",
          [query, blockers],
        );
        pid = Number(result.rows[0]?.pid ?? 0);
        return pid;
      },
      {
        timeout: 2500,
        intervals: [20, 40, 80],
        message: 'The exact owned operation must reach its expected lock wait.',
      },
    )
    .toBeGreaterThan(0);
  return pid;
}
