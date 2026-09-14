import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  PublicationProposalSchema,
  OperatorSessionSchema,
} from '../../../../packages/contracts/src/index';
import {
  seedConnectionSource,
  connectionDatabase,
} from '../../helpers/research-connection-fixture';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { FeedbackSandbox } from '../../helpers/feedback-fixture';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const password = 'Synthetic-named-password-2026';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
async function admin(request: APIRequestContext, sandbox: FeedbackSandbox) {
  expect(sandbox.namedCredentials).toBeDefined();
  const response = await request.post('/api/v1/ops/session', {
    headers,
    data: sandbox.namedCredentials,
  });
  expect(response.status()).toBe(200);
  const session = OperatorSessionSchema.parse(await response.json());
  expect(session.mode).toBe('named');
  return session;
}
async function identity(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
  role: string,
) {
  const username = `${role}_${randomUUID().slice(0, 8)}`;
  const created = await request.post('/api/v1/ops/operators', {
    headers,
    data: { username, password, role },
  });
  expect(created.status()).toBe(201);
  const value = await created.json();
  const client = await playwright.request.newContext({
    baseURL: sandbox.apiOrigin,
  });
  expect(
    (
      await client.post('/api/v1/ops/session', {
        headers,
        data: { username, password },
      })
    ).status(),
  ).toBe(200);
  return { client, value };
}
test('E2E-API-640 named roles reject shared bearer and direct publication bypass @NAMED-OPERATORS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  await admin(request, feedbackSandbox);
  const viewer = await identity(request, playwright, feedbackSandbox, 'viewer');
  try {
    expect(
      (await viewer.client.get('/api/v1/ops/discovery/items')).status(),
    ).toBe(200);
    for (const path of [
      '/ops/discovery/refresh',
      '/ops/macro/refresh',
      '/ops/securities/refresh',
      '/ops/bea-staging',
      '/ops/operators',
    ]) {
      const actual =
        path === '/ops/bea-staging' ? '/ops/discovery/bea-staging' : path;
      expect(
        (
          await viewer.client.post('/api/v1' + actual, { headers, data: {} })
        ).status(),
      ).toBe(403);
    }
    expect(
      (
        await viewer.client.put('/api/v1/ops/discovery/items/unknown', {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put('/api/v1/ops/discovery/items/unknown', {
          headers,
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post('/api/v1/sources', {
          headers: { ...headers, Authorization: 'Bearer ' + 'a'.repeat(64) },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post('/api/v1/macro/refresh', {
          headers: { Authorization: 'Bearer ' + 'a'.repeat(64) },
          data: {},
        })
      ).status(),
    ).toBe(403);
    const anonymous = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      expect(
        (
          await anonymous.post('/api/v1/ops/session', {
            headers,
            data: { key: 'a'.repeat(64) },
          })
        ).status(),
      ).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  } finally {
    await viewer.client.dispose();
  }
});
test('E2E-API-641 exact source proposal independent approval replay stale head and role revocation @NAMED-OPERATORS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await admin(request, feedbackSandbox);
  const researcher = await identity(
    request,
    playwright,
    feedbackSandbox,
    'researcher',
  );
  const publisher = await identity(
    request,
    playwright,
    feedbackSandbox,
    'publisher',
  );
  try {
    const id = randomUUID(),
      input = {
        kind: 'discovery',
        target: source.id,
        body: {
          expectedVersion: source.version,
          status: 'withdrawn',
          correctionNote: 'Synthetic independent review',
        },
      };
    const created = await researcher.client.put('/api/v1/ops/proposals/' + id, {
      headers,
      data: input,
    });
    expect(created.status()).toBe(200);
    const proposal = PublicationProposalSchema.parse(await created.json());
    expect(proposal.state).toBe('pending');
    expect(
      await (
        await researcher.client.put('/api/v1/ops/proposals/' + id, {
          headers,
          data: input,
        })
      ).json(),
    ).toEqual(proposal);
    const db = await connectionDatabase(feedbackSandbox);
    try {
      expect(
        (
          await db.query('SELECT version FROM discovery_items WHERE id=$1', [
            source.id,
          ])
        ).rows[0].version,
      ).toBe(source.version);
    } finally {
      await db.end();
    }
    expect(
      (
        await researcher.client.post(
          '/api/v1/ops/proposals/' + id + '/approve',
          { headers, data: { note: 'Self review denied' } },
        )
      ).status(),
    ).toBe(403);
    const decision = { note: 'Synthetic second-person approval' };
    const approved = await publisher.client.post(
      '/api/v1/ops/proposals/' + id + '/approve',
      { headers, data: decision },
    );
    expect(approved.status()).toBe(201);
    const receipt = PublicationProposalSchema.parse(await approved.json());
    expect(receipt.state).toBe('approved');
    expect(receipt.reviewer?.id).not.toBe(receipt.proposer.id);
    expect(
      await (
        await publisher.client.post(
          '/api/v1/ops/proposals/' + id + '/approve',
          { headers, data: decision },
        )
      ).json(),
    ).toEqual(receipt);
    expect(
      (
        await researcher.client.put('/api/v1/ops/proposals/' + randomUUID(), {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.put('/api/v1/ops/operators/' + publisher.value.id, {
          headers,
          data: {
            expectedVersion: publisher.value.version,
            role: 'publisher',
            enabled: false,
          },
        })
      ).status(),
    ).toBe(200);
    expect((await publisher.client.get('/api/v1/ops/proposals')).status()).toBe(
      401,
    );
  } finally {
    await researcher.client.dispose();
    await publisher.client.dispose();
  }
});
test('E2E-API-642 admin cannot approve own source rights request across sessions @NAMED-OPERATORS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  await admin(request, feedbackSandbox);
  const second = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  const publisher = await identity(
    request,
    playwright,
    feedbackSandbox,
    'publisher',
  );
  try {
    await second.post('/api/v1/ops/session', {
      headers,
      data: feedbackSandbox.namedCredentials,
    });
    const id = randomUUID(),
      data = {
        kind: 'source-create',
        target: 'new',
        body: {
          name: 'Synthetic reviewed source',
          category: 'Synthetic',
          sourceUrl: 'https://example.com/source',
          termsUrl: 'https://example.com/terms',
          rightsStatus: 'approved',
          constraints: 'Synthetic fixture only; no provider rights claim',
          reviewEvidence: 'Synthetic evidence for access-control regression',
          reviewedAt: '2026-09-01T00:00:00.000Z',
          published: true,
        },
      };
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + id, { headers, data })
      ).status(),
    ).toBe(200);
    expect(
      (
        await second.post('/api/v1/ops/proposals/' + id + '/approve', {
          headers,
          data: { note: 'Same person' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await publisher.client.post(
          '/api/v1/ops/proposals/' + id + '/approve',
          { headers, data: { note: 'Independent source evidence reviewed' } },
        )
      ).status(),
    ).toBe(201);
    const receipt = PublicationProposalSchema.parse(
      await (await request.get('/api/v1/ops/proposals/' + id)).json(),
    );
    expect(receipt.actionResult).not.toBeNull();
    const sources = await (await request.get('/api/v1/sources')).json();
    expect(
      sources.find(
        (row: { id: string }) => row.id === receipt.actionResult!.sourceId,
      ),
    ).toMatchObject({
      revision: receipt.actionResult!.revision,
      data: { name: 'Synthetic reviewed source' },
    });
    expect(
      (
        await request.get('/api/v1/ops/proposals?after=9999999999999999999')
      ).status(),
    ).toBe(400);
  } finally {
    await second.dispose();
    await publisher.client.dispose();
  }
});

test('E2E-API-643 committed role disable rejects a publication waiting on its source and preserves the pending proposal @NAMED-OPERATORS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await admin(request, feedbackSandbox);
  const publisher = await identity(
    request,
    playwright,
    feedbackSandbox,
    'publisher',
  );
  const id = randomUUID();
  expect(
    (
      await request.put('/api/v1/ops/proposals/' + id, {
        headers,
        data: {
          kind: 'discovery',
          target: source.id,
          body: {
            expectedVersion: source.version,
            status: 'withdrawn',
            correctionNote: 'Synthetic blocked review',
          },
        },
      })
    ).status(),
  ).toBe(200);
  const blocker = await connectionDatabase(feedbackSandbox);
  const observer = await connectionDatabase(feedbackSandbox);
  let pending: ReturnType<APIRequestContext['post']> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    await blocker.query(
      'SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE',
      [source.id],
    );
    pending = publisher.client.post(
      '/api/v1/ops/proposals/' + id + '/approve',
      { headers, data: { note: 'Synthetic admission check' } },
    );
    await expect
      .poll(async () => {
        await observer.query('SELECT pg_stat_clear_snapshot()');
        const waiting = await observer.query(
          "SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT version FROM discovery_items WHERE id=%FOR UPDATE%'",
          [pid],
        );
        return waiting.rows.length;
      })
      .toBe(1);
    expect(
      (
        await request.put('/api/v1/ops/operators/' + publisher.value.id, {
          headers,
          data: {
            expectedVersion: publisher.value.version,
            role: 'publisher',
            enabled: false,
          },
        })
      ).status(),
    ).toBe(200);
    await blocker.query('COMMIT');
    const response = await pending;
    if (!response) throw Error('Approval request did not return a response.');
    expect(response.status()).toBe(401);
    await response.body();
    const proposal = PublicationProposalSchema.parse(
      await (await request.get('/api/v1/ops/proposals/' + id)).json(),
    );
    expect(proposal.state).toBe('pending');
    expect(
      (
        await observer.query(
          'SELECT version FROM discovery_items WHERE id=$1',
          [source.id],
        )
      ).rows[0].version,
    ).toBe(source.version);
  } finally {
    await blocker.query('ROLLBACK').catch(() => {});
    if (pending)
      await pending.then((response) => response.body()).catch(() => {});
    await blocker.end();
    await observer.end();
    await publisher.client.dispose();
  }
});

test('E2E-API-644 reviewed media stays private until independent approval and has immutable rejection replay @NAMED-OPERATORS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const source = await seedConnectionSource(feedbackSandbox);
  await admin(request, feedbackSandbox);
  const publisher = await identity(
    request,
    playwright,
    feedbackSandbox,
    'publisher',
  );
  try {
    const response = await request.post('/api/v1/ops/media/' + source.id, {
      headers,
      data: {},
    });
    expect(response.status()).toBe(201);
    const asset = await response.json();
    expect(
      (
        await request.get('/api/v1/discovery/items/' + source.id + '/media')
      ).status(),
    ).toBe(404);
    const body = {
      kind: 'media',
      target: source.id,
      body: { assetId: asset.id, publish: true },
    };
    const rejectedId = randomUUID();
    expect(
      (
        await request.put('/api/v1/ops/proposals/' + rejectedId, {
          headers,
          data: body,
        })
      ).status(),
    ).toBe(200);
    const rejection = {
      note: 'Synthetic reviewer requests improved illustration',
    };
    const rejected = await publisher.client.post(
      '/api/v1/ops/proposals/' + rejectedId + '/reject',
      { headers, data: rejection },
    );
    expect(rejected.status()).toBe(201);
    const rejectedReceipt = PublicationProposalSchema.parse(
      await rejected.json(),
    );
    expect(rejectedReceipt.state).toBe('rejected');
    expect(
      await (
        await publisher.client.post(
          '/api/v1/ops/proposals/' + rejectedId + '/reject',
          { headers, data: rejection },
        )
      ).json(),
    ).toEqual(rejectedReceipt);
    expect(
      (
        await request.get('/api/v1/discovery/items/' + source.id + '/media')
      ).status(),
    ).toBe(404);
    const approvedId = randomUUID();
    await request.put('/api/v1/ops/proposals/' + approvedId, {
      headers,
      data: body,
    });
    expect(
      (
        await publisher.client.post(
          '/api/v1/ops/proposals/' + approvedId + '/approve',
          { headers, data: { note: 'Synthetic independent visual review' } },
        )
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.get('/api/v1/discovery/items/' + source.id + '/media')
      ).status(),
    ).toBe(200);
  } finally {
    await publisher.client.dispose();
  }
});
