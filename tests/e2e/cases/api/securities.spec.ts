import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import type { APIRequestContext } from '@playwright/test';
import { test, expect } from '../../helpers/app-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  SecurityDirectorySchema,
  SecurityEvidenceSchema,
  SecurityHistorySchema,
  SecurityIdentitySchema,
  SecurityRunSchema,
  SecurityRunsSchema,
  parseSecurityMapping,
} from '../../../../packages/contracts/src/index';

const pg = createRequire(
  new URL('../../../../apps/api/package.json', import.meta.url),
)('pg') as {
  Pool: new (options: { connectionString: string; max: number }) => {
    query: (
      sql: string,
      values?: unknown[],
    ) => Promise<{ rows: Array<Record<string, unknown>> }>;
    end: () => Promise<void>;
  };
};
const isin = 'INE002A01018'; // Public Reliance ISIN, never private account data.
const otherIsin = 'INE009A01021';
const headers = () => ({
  Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
});
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

async function signIn(request: APIRequestContext) {
  const response = await request.post('/api/v1/ops/session', {
    headers: headers(),
    data: { key: process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()) },
  });
  expect(
    response.status(),
    'The configured key must authenticate against the owned API.',
  ).toBe(200);
}
async function refresh(
  request: APIRequestContext,
  requestId: string = randomUUID(),
) {
  const response = await request.post('/api/v1/ops/securities/refresh', {
    headers: headers(),
    data: { requestId, isins: [isin] },
    timeout: 120000,
  });
  expect(response.status(), await response.text()).toBe(201);
  const run = SecurityRunSchema.parse(await response.json());
  expect(run.status, run.outcomes.map((v) => v.message).join('; ')).toBe(
    'completed',
  );
  expect(run.outcomes).toHaveLength(1);
  expect(run.outcomes[0]?.status).toBe('matched');
  return run;
}

test('E2E-API-230 real OpenFIGI refresh stores evidence revisions and duplicate-safe checks @IDENTITY-001 @real-provider', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  await signIn(request);
  const first = await refresh(request);
  const identity = SecurityIdentitySchema.parse(
    await (await request.get(`/api/v1/securities/${isin}`)).json(),
  );
  expect(identity.version).toBe(1);
  expect(identity.resolution).toBe('matched');
  expect(identity.candidates[0]?.name).toMatch(/RELIANCE/i);
  expect(identity.source).toBe('OpenFIGI');
  expect(Date.parse(identity.retrievedAt)).toBeGreaterThanOrEqual(
    Date.parse(first.startedAt),
  );
  const evidenceResponse = await request.get(
    `/api/v1/securities/${isin}/evidence/${identity.sourceHash}`,
  );
  expect(evidenceResponse.status()).toBe(200);
  const evidence = SecurityEvidenceSchema.parse(await evidenceResponse.json());
  expect(evidence.isin).toBe(isin);
  expect(evidence.retrievedAt).toBe(identity.retrievedAt);
  // The receipt hash includes identity and retrieval time, so A → B → A
  // source revisions retain distinct immutable evidence for each retrieval.
  expect(evidence.hash).toBe(
    createHash('sha256')
      .update(`${isin}\n${evidence.retrievedAt}\n${evidence.body}`)
      .digest('hex'),
  );
  expect(parseSecurityMapping(JSON.parse(evidence.body))).toEqual({
    resolution: identity.resolution,
    candidates: identity.candidates,
  });
  const originalHistory = SecurityHistorySchema.parse(
    await (await request.get(`/api/v1/securities/${isin}/history`)).json(),
  );
  expect(originalHistory.revisions).toEqual([identity]);
  const replay = await refresh(request, first.id);
  expect(replay).toEqual(first);
  const checked = await refresh(request);
  expect(checked.outcomes[0]?.message).toContain('Unchanged source identity');
  const latest = SecurityIdentitySchema.parse(
    await (await request.get(`/api/v1/securities/${isin}`)).json(),
  );
  expect(latest.version).toBe(identity.version);
  expect(latest.sourceHash).toBe(identity.sourceHash);
  expect(latest.retrievedAt).toBe(identity.retrievedAt);
  expect(Date.parse(latest.checkedAt)).toBeGreaterThan(
    Date.parse(identity.checkedAt),
  );
  expect(
    SecurityHistorySchema.parse(
      await (await request.get(`/api/v1/securities/${isin}/history`)).json(),
    ),
  ).toEqual(originalHistory);
  expect(
    SecurityEvidenceSchema.parse(
      await (
        await request.get(
          `/api/v1/securities/${isin}/evidence/${identity.sourceHash}`,
        )
      ).json(),
    ),
  ).toEqual(evidence);
  const directory = SecurityDirectorySchema.parse(
    await (await request.get('/api/v1/securities?q=reliance')).json(),
  );
  expect(directory.items.map((v) => v.isin)).toEqual([isin]);
  expect(
    (
      await request.get(
        `/api/v1/securities/${otherIsin}/evidence/${identity.sourceHash}`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post('/api/v1/ops/securities/refresh', {
        headers: headers(),
        data: { requestId: first.id, isins: [otherIsin] },
      })
    ).status(),
  ).toBe(409);
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  try {
    const versions = await pool.query(
      'SELECT version,payload FROM security_identity_revisions WHERE isin=$1 ORDER BY version',
      [isin],
    );
    expect(versions.rows).toEqual([{ version: 1, payload: identity }]);
    const runs = SecurityRunsSchema.parse(
      await (await request.get('/api/v1/ops/securities/runs')).json(),
    );
    expect(new Set(runs.runs.map((v) => v.id))).toEqual(
      new Set([first.id, checked.id]),
    );
  } finally {
    await pool.end();
  }
});

test('E2E-API-231 investor sessions cannot refresh identifiers and strict input denies before source work @IDENTITY-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const data = { requestId: randomUUID(), isins: [isin] };
  expect((await request.get('/api/v1/ops/securities/runs')).status()).toBe(401);
  expect(
    (
      await request.post('/api/v1/ops/securities/refresh', {
        headers: headers(),
        data,
      })
    ).status(),
  ).toBe(401);
  const username = `identity_${randomUUID().slice(0, 12)}`;
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers: headers(),
        data: {
          username,
          password: 'Identity-synthetic-account-2026',
          consent: true,
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put('/api/v1/account/watchlist', {
        headers: headers(),
        data: { indicators: ['NY.GDP.MKTP.KD.ZG'] },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post('/api/v1/ops/securities/refresh', {
        headers: headers(),
        data,
      })
    ).status(),
  ).toBe(401);
  const operator = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await signIn(operator);
    for (const origin of [undefined, 'https://untrusted.example']) {
      expect(
        (
          await operator.post('/api/v1/ops/securities/refresh', {
            ...(origin ? { headers: { Origin: origin } } : {}),
            data,
          })
        ).status(),
      ).toBe(403);
    }
    for (const invalid of [
      { ...data, isins: ['INE002A01019'] },
      { ...data, isins: [isin, isin] },
      { ...data, isins: [] },
      { ...data, isins: Array(6).fill(isin) },
      { ...data, requestId: 'not-a-request-uuid' },
      { ...data, providerUrl: 'https://untrusted.example' },
      { ...data, accountId: username },
    ]) {
      expect(
        (
          await operator.post('/api/v1/ops/securities/refresh', {
            headers: headers(),
            data: invalid,
          })
        ).status(),
      ).toBe(400);
    }
    expect(
      SecurityRunsSchema.parse(
        await (await operator.get('/api/v1/ops/securities/runs')).json(),
      ).runs,
    ).toEqual([]);
    expect(
      SecurityDirectorySchema.parse(
        await (await request.get('/api/v1/securities')).json(),
      ).items,
    ).toEqual([]);
    expect(
      await (await request.get('/api/v1/account/watchlist')).json(),
    ).toEqual({ indicators: ['NY.GDP.MKTP.KD.ZG'] });
    expect((await operator.get('/api/v1/account/watchlist')).status()).toBe(
      401,
    );
    const pool = new pg.Pool({
      connectionString: feedbackSandbox.databaseUrl,
      max: 1,
    });
    try {
      expect(
        (await pool.query('SELECT provider FROM security_provider_pacing'))
          .rows,
      ).toEqual([]);
    } finally {
      await pool.end();
    }
  } finally {
    await operator.dispose();
  }
});

test('E2E-API-232 simulated provider cooldown preserves real source edition and records interrupted refresh history @IDENTITY-001 @simulated', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  await signIn(request);
  await refresh(request);
  const before = SecurityIdentitySchema.parse(
    await (await request.get(`/api/v1/securities/${isin}`)).json(),
  );
  const interrupted = {
    id: randomUUID(),
    isins: [isin],
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    outcomes: [],
  };
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  try {
    // Only this test's owned schema is changed. No provider response or success
    // is fabricated: this deliberately creates the documented cooldown state.
    await pool.query(
      "UPDATE security_provider_pacing SET next_allowed_at=now()+interval '2 minutes' WHERE provider='openfigi'",
    );
    await pool.query(
      'INSERT INTO security_refresh_runs(id,payload,started_at) VALUES($1,$2,$3)',
      [interrupted.id, JSON.stringify(interrupted), interrupted.startedAt],
    );
    const failed = await request.post('/api/v1/ops/securities/refresh', {
      headers: headers(),
      data: { requestId: randomUUID(), isins: [isin] },
    });
    expect(failed.status()).toBe(201);
    const run = SecurityRunSchema.parse(await failed.json());
    expect(run.status).toBe('failed');
    expect(run.outcomes).toEqual([
      {
        isin,
        status: 'failed',
        version: null,
        message: 'Provider rate limit is cooling down. Retry after one minute.',
      },
    ]);
    expect(
      SecurityIdentitySchema.parse(
        await (await request.get(`/api/v1/securities/${isin}`)).json(),
      ),
    ).toEqual(before);
    const history = SecurityHistorySchema.parse(
      await (await request.get(`/api/v1/securities/${isin}/history`)).json(),
    );
    expect(history.revisions).toEqual([before]);
    const runsResponse = await request.get('/api/v1/ops/securities/runs');
    expect(runsResponse.status()).toBe(200);
    const runs = SecurityRunsSchema.parse(await runsResponse.json());
    const ended = runs.runs.find((v) => v.id === interrupted.id);
    expect(ended?.status).toBe('failed');
    expect(ended?.finishedAt).toMatch(/Z$/);
    expect(
      (
        await request.get(
          `/api/v1/securities/${isin}/evidence/${before.sourceHash}`,
        )
      ).status(),
    ).toBe(200);
  } finally {
    await pool.end();
  }
});

test('E2E-API-233 missing identity query and evidence failures stay bounded without provider work @IDENTITY-001', async ({
  request,
}) => {
  expect(
    SecurityDirectorySchema.parse(
      await (await request.get('/api/v1/securities?q=%25_')).json(),
    ).items,
  ).toEqual([]);
  expect(
    (await request.get(`/api/v1/securities?q=${'a'.repeat(101)}`)).status(),
  ).toBe(400);
  expect((await request.get(`/api/v1/securities/${isin}`)).status()).toBe(404);
  expect((await request.get('/api/v1/securities/INE002A01019')).status()).toBe(
    400,
  );
  expect(
    (await request.get(`/api/v1/securities/${isin}/history`)).status(),
  ).toBe(404);
  expect(
    (
      await request.get(`/api/v1/securities/${isin}/evidence/not-a-hash`)
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get(`/api/v1/securities/${isin}/evidence/${'0'.repeat(64)}`)
    ).status(),
  ).toBe(404);
});
