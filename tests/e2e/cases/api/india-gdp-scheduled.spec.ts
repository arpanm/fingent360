import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import type { APIRequestContext } from '@playwright/test';
import {
  test,
  expect,
  indiaActors,
  indiaReview,
  retentionHeaders,
  indiaGdpInput,
} from '../../helpers/india-gdp';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  INDIA_GDP_INDEX,
  IndiaGdpEditionSchema,
  IndiaMacroDashboardSchema,
} from '../../../../packages/contracts/src/index';

test.use({ namedOperators: true, manualWorkers: true });

test('E2E-API-1773 actual scheduled GDP tick retains original drafts deduplicates quarantines and rechecks pause during acquisition @SRC-007 @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  // Every connection/process action is inside the invoked case. This file has
  // no discovery-time side effects and never contacts a real source provider.
  const require = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const env = {
    ...parseEnv(
      await readFile(new URL('../../../../.env', import.meta.url), 'utf8'),
    ),
    ...process.env,
  };
  const mongoUrl = new URL(env.MONGODB_URI!);
  if (
    mongoUrl.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(mongoUrl.hostname)
  )
    throw Error(
      'Owned loopback MongoDB is required for scheduled GDP acceptance.',
    );
  if (!mongoUrl.searchParams.has('authSource'))
    mongoUrl.searchParams.set(
      'authSource',
      mongoUrl.pathname.slice(1) || 'admin',
    );
  mongoUrl.pathname = '/' + feedbackSandbox.schema;
  const [{ readConfig }, { ResearchAutoStore }, { DiscoveryStore }] =
    await Promise.all([
      import(
        new URL('../../../../apps/api/dist/config.js', import.meta.url).href
      ),
      import(
        new URL('../../../../apps/api/dist/research-auto.js', import.meta.url)
          .href
      ),
      import(
        new URL('../../../../apps/api/dist/discovery.js', import.meta.url).href
      ),
    ]);
  const pool = await connectionDatabase(feedbackSandbox);
  const { MongoClient } = require('mongodb');
  const mongo = new MongoClient(mongoUrl.href, {
    serverSelectionTimeoutMS: 3000,
  });
  const config = readConfig({
    DATABASE_URL: feedbackSandbox.databaseUrl,
    MONGODB_URI: mongoUrl.href,
    WEB_ORIGIN: retentionHeaders.Origin,
  });
  const discovery = new DiscoveryStore(config);
  const worker = new ResearchAutoStore(config, discovery, true);
  let reviewer: APIRequestContext | undefined;
  const savedFetch = globalThis.fetch;
  const source = indiaGdpInput();
  const releaseUrl =
    'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2304949&lang=1&reg=3';
  const indexBody =
    '<p>TEST-SIMULATION reconstructed official index grammar.</p><h2>All Releases</h2><h3>Ministry of Statistics and Programme Implementation</h3><a href="/PressReleaseDetail.aspx?PRID=2304949">QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT</a>';
  const calls: string[] = [];
  let releaseBody = source.releaseHtml;
  let pauseDuringDownload = false;
  const configure = (enabled: boolean) =>
    request.put('/api/v1/ops/research-auto', {
      headers: retentionHeaders,
      data: {
        sourceId: 'india-gdp',
        enabled,
        intervalMinutes: 1440,
        ...(enabled ? { rightsEvidence: source.rightsEvidence } : {}),
      },
    });
  const counts = async () =>
    (
      await pool.query(`SELECT
    (SELECT count(*)::int FROM india_macro_editions) AS editions,
    (SELECT count(*)::int FROM india_macro_attempts) AS attempts,
    (SELECT count(*)::int FROM india_macro_reviews) AS reviews,
    (SELECT count(*)::int FROM research_auto_runs WHERE source_id='india-gdp') AS runs`)
    ).rows[0];
  const publicGdp = async () => {
    const response = await request.get('/api/v1/india-macro');
    expect(response.status()).toBe(200);
    return IndiaMacroDashboardSchema.parse(await response.json()).gdp;
  };
  const latestRun = async () =>
    (
      await pool.query(`SELECT r.* FROM research_auto_runs r
    JOIN research_auto_schedules s ON s.last_run_id=r.id WHERE s.source_id='india-gdp'`)
    ).rows[0];
  try {
    reviewer = await indiaActors(request, playwright, feedbackSandbox);
    await worker.initialize();
    await pool.query('UPDATE research_auto_schedules SET enabled=false');
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (![INDIA_GDP_INDEX, releaseUrl].includes(url))
        throw Error('Unexpected provider request in isolated GDP simulation.');
      expect(init?.redirect).toBe('error');
      calls.push(url);
      if (url === releaseUrl && pauseDuringDownload) {
        // Pause through the real authenticated API before the retained-source
        // transaction; fetched bytes must not bypass the post-download gate.
        expect((await configure(false)).status()).toBe(200);
      }
      return new Response(url === INDIA_GDP_INDEX ? indexBody : releaseBody, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    };
    await worker.tick();
    expect(calls).toEqual([]);
    expect(await counts()).toEqual({
      editions: 0,
      attempts: 0,
      reviews: 0,
      runs: 0,
    });
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: { sourceId: 'india-gdp', enabled: true, intervalMinutes: 1440 },
        })
      ).status(),
    ).toBe(400);
    expect((await configure(true)).status()).toBe(200);
    await worker.tick();
    expect(calls).toEqual([INDIA_GDP_INDEX, releaseUrl]);
    expect(await counts()).toEqual({
      editions: 1,
      attempts: 0,
      reviews: 0,
      runs: 1,
    });
    const stored = (
      await pool.query(
        "SELECT actor_id,payload FROM india_macro_editions WHERE kind='gdp'",
      )
    ).rows[0];
    expect(stored.actor_id).toBe('scheduled-india-gdp');
    const edition = IndiaGdpEditionSchema.parse(stored.payload);
    expect(edition.sourceUrl).toBe(releaseUrl);
    expect(edition.point).toMatchObject({
      value: '81.36',
      previousYearValue: '75.46',
      growthPercent: '7.8',
      baseYear: '2022-23',
    });
    const run = await latestRun();
    expect(run.status).toBe('succeeded');
    expect(run.discovery_run_id).toBeNull();
    expect(run.capture_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(run.finished_at).not.toBeNull();
    const index = await mongo
      .db()
      .collection('india_gdp_indexes')
      .findOne({ _id: run.capture_hash });
    expect(index?.value).toMatchObject({
      url: INDIA_GDP_INDEX,
      body: indexBody,
    });
    const raw = await mongo
      .db()
      .collection('india_macro_raw')
      .findOne({ _id: edition.hash });
    expect(raw?.value).toMatchObject({
      requestId: edition.id,
      releaseUrl,
      releaseHtml: source.releaseHtml,
      rightsEvidence: source.rightsEvidence,
    });
    expect((await publicGdp())?.editions).toEqual([]);
    expect(
      (
        await reviewer.post('/api/v1/ops/india-macro/review', {
          headers: retentionHeaders,
          data: indiaReview(edition.id),
        })
      ).status(),
    ).toBe(201);
    expect((await publicGdp())?.editions.map((row) => row.id)).toEqual([
      edition.id,
    ]);

    // Normal not-yet-due tick does nothing. For a later due tick the same real
    // source bytes produce a second durable job, not another source edition.
    await worker.tick();
    expect(calls).toHaveLength(2);
    expect((await counts()).runs).toBe(1);
    await pool.query(
      "UPDATE research_auto_schedules SET next_at=now() WHERE source_id='india-gdp'",
    );
    await worker.tick();
    expect(calls).toEqual([
      INDIA_GDP_INDEX,
      releaseUrl,
      INDIA_GDP_INDEX,
      releaseUrl,
    ]);
    expect(await counts()).toEqual({
      editions: 1,
      attempts: 0,
      reviews: 1,
      runs: 2,
    });
    expect((await latestRun()).status).toBe('succeeded');
    expect(
      (
        await pool.query(
          'SELECT payload FROM india_macro_editions WHERE id=$1',
          [edition.id],
        )
      ).rows[0].payload,
    ).toEqual(edition);

    // Unsupported original stays retained in quarantine, not the public view.
    releaseBody = source.releaseHtml.replace(
      'Benchmark-Indicator methodology',
      'Unsupported synthetic methodology',
    );
    await pool.query(
      "UPDATE research_auto_schedules SET next_at=now() WHERE source_id='india-gdp'",
    );
    await worker.tick();
    expect(await counts()).toEqual({
      editions: 1,
      attempts: 1,
      reviews: 1,
      runs: 3,
    });
    const failedSource = (
      await pool.query('SELECT hash,reason,actor_id FROM india_macro_attempts')
    ).rows[0];
    expect(failedSource.actor_id).toBe('scheduled-india-gdp');
    expect(failedSource.reason).toContain('method');
    expect(
      (
        await mongo
          .db()
          .collection('india_macro_raw')
          .findOne({ _id: failedSource.hash })
      )?.value.releaseHtml,
    ).toBe(releaseBody);
    expect((await latestRun()).status).toBe('succeeded'); // capture completed with quarantined evidence
    expect((await publicGdp())?.editions.map((row) => row.id)).toEqual([
      edition.id,
    ]);

    releaseBody =
      source.releaseHtml +
      '<p>TEST-SIMULATION changed original, paused during acquisition.</p>';
    pauseDuringDownload = true;
    await pool.query(
      "UPDATE research_auto_schedules SET next_at=now() WHERE source_id='india-gdp'",
    );
    await expect(worker.tick()).rejects.toThrow(
      'schedule or source permission changed',
    );
    expect(await counts()).toEqual({
      editions: 1,
      attempts: 1,
      reviews: 1,
      runs: 4,
    });
    expect((await latestRun()).status).toBe('failed');
    expect(
      (
        await pool.query(
          "SELECT enabled FROM research_auto_schedules WHERE source_id='india-gdp'",
        )
      ).rows[0].enabled,
    ).toBe(false);
    const callCount = calls.length;
    await worker.tick();
    expect(calls).toHaveLength(callCount);
    expect((await counts()).runs).toBe(4);
    expect((await publicGdp())?.editions.map((row) => row.id)).toEqual([
      edition.id,
    ]);
  } finally {
    globalThis.fetch = savedFetch;
    await Promise.allSettled([
      reviewer?.dispose(),
      worker.onApplicationShutdown(),
      discovery.onApplicationShutdown(),
      mongo.close(),
      pool.end(),
    ]);
  }
});
