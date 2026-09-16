import { test, expect } from '../../helpers/feedback-fixture';
import { registerRecoverable, authHeaders } from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
const path = '/api/v1/account/broker-connections/angel';
test.use({ angelSimulation: true, manualWorkers: true });
async function connect(request: Parameters<typeof registerRecoverable>[0]) {
  const started = await request.post(path + '/start', {
    headers: authHeaders,
    data: { consent: true },
  });
  expect(started.status()).toBe(201);
  const url = new URL((await started.json()).loginUrl),
    state = url.searchParams.get('state')!;
  const callback = await request.post(path + '/complete', {
    headers: authHeaders,
    data: { state, auth_token: 'synthetic_access_token' },
    maxRedirects: 0,
  });
  expect(callback.status()).toBe(303);
  return state;
}
test('E2E-API-1490 simulated Angel authorization produces actual encrypted capture, exact preview, confirmation and private export @DEV-028 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await connectionDatabase(feedbackSandbox);
  try {
    const state = await connect(request);
    expect(
      (
        await request.post(path + '/complete', {
          headers: authHeaders,
          data: { state, auth_token: 'synthetic_access_token' },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(409);
    const fetched = await request.post(path + '/preview', {
      headers: authHeaders,
      data: { storageConsent: true, expectedVersion: 0 },
    });
    expect(fetched.status()).toBe(201);
    const { capture, preview } = await fetched.json();
    expect(preview.totalCostMinor).toBe('30038');
    expect(capture.costBasis).toBe('broker-average-price-unverified');
    const encrypted = (
      await db.query(
        'SELECT encrypted_token FROM broker_angel_connections WHERE user_id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(JSON.stringify(encrypted)).not.toContain('synthetic_access_token');
    expect((await request.get('/api/v1/account/holdings')).status()).toBe(200);
    const confirm = await request.post('/api/v1/account/holdings/confirm', {
      headers: authHeaders,
      data: { previewId: preview.previewId, expectedVersion: 0 },
    });
    expect(confirm.status()).toBe(201);
    expect((await confirm.json()).provenance).toBe(
      'broker-reported-unverified',
    );
    const exported = await request.get(path + '/export');
    expect(exported.status()).toBe(200);
    expect((await exported.json()).captures[0].id).toBe(capture.id);
    expect(await exported.text()).not.toContain('synthetic_access_token');
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
  } finally {
    await db.end();
  }
});
test('E2E-API-1491 revoke cancels pending consent and real saved preview while confirmed holdings remain @DEV-028 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await connectionDatabase(feedbackSandbox);
  try {
    await connect(request);
    const fetched = await request.post(path + '/preview', {
      headers: authHeaders,
      data: { storageConsent: true, expectedVersion: 0 },
    });
    expect(fetched.status()).toBe(201);
    const { preview } = await fetched.json();
    const revoked = await request.post(path + '/revoke', {
      headers: authHeaders,
      data: { confirm: true },
    });
    expect(revoked.status()).toBe(201);
    expect((await revoked.json()).remote).toBe('confirmed');
    expect(
      (
        await request.post(path + '/preview', {
          headers: authHeaders,
          data: { storageConsent: true, expectedVersion: 0 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await db.query(
          'SELECT encrypted_token FROM broker_angel_connections WHERE user_id=$1',
          [owner.id],
        )
      ).rows[0].encrypted_token,
    ).toBeNull();
    expect(
      (
        await request.post('/api/v1/account/holdings/confirm', {
          headers: authHeaders,
          data: { previewId: preview.previewId, expectedVersion: 0 },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post(path + '/delete', {
          headers: authHeaders,
          data: { confirm: true },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await db.query('SELECT 1 FROM broker_angel_captures WHERE user_id=$1', [
          owner.id,
        ])
      ).rowCount,
    ).toBe(0);
  } finally {
    await db.end();
  }
});
test('E2E-API-1492 broker parser rejects unsettled duplicates and unsupported fields without float cost arithmetic @DEV-028 @TEST-SIMULATION', async () => {
  const moduleUrl = new URL(
    '../../../../apps/api/dist/angel-provider.js',
    import.meta.url,
  ).href;
  const { parseAngelHoldings } = await import(moduleUrl);
  const fixtureUrl = new URL(
    '../../helpers/angel-simulation.mjs',
    import.meta.url,
  ).href;
  const { syntheticAngelHolding: row } = await import(fixtureUrl);
  expect(
    parseAngelHoldings(
      JSON.stringify({
        status: true,
        message: 'SUCCESS',
        errorcode: '',
        data: [row],
      }),
    )[0].totalCostMinor,
  ).toBe('30038');
  for (const changed of [
    { ...row, t1quantity: 1 },
    { ...row, realisedquantity: 2 },
    { ...row, collateralquantity: 1 },
    { ...row, averageprice: 0 },
    { ...row, product: 'MTF' },
    { ...row, unknown: 'untrusted' },
  ])
    expect(() =>
      parseAngelHoldings(
        JSON.stringify({
          status: true,
          message: 'SUCCESS',
          errorcode: '',
          data: [changed],
        }),
      ),
    ).toThrow();
  expect(() =>
    parseAngelHoldings(
      JSON.stringify({
        status: true,
        message: 'SUCCESS',
        errorcode: '',
        data: [row, row],
      }),
    ),
  ).toThrow();
});
test('E2E-API-1494 callback requires the initiating signed-in account and never exchanges on its GET page @DEV-028 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await connectionDatabase(feedbackSandbox),
    other = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
  try {
    const started = await request.post(path + '/start', {
        headers: authHeaders,
        data: { consent: true },
      }),
      url = new URL((await started.json()).loginUrl),
      state = url.searchParams.get('state')!,
      data = { state, auth_token: 'synthetic_access_token' };
    const landing = await other.get(path + '/callback', {
      params: { ...data, feed_token: 'synthetic_unused_feed' },
    });
    expect(landing.status()).toBe(200);
    expect(await landing.text()).toContain('Complete connection');
    expect(await landing.text()).not.toContain('synthetic_unused_feed');
    expect(
      (
        await db.query(
          'SELECT encrypted_token FROM broker_angel_connections WHERE user_id=$1',
          [owner.id],
        )
      ).rows[0].encrypted_token,
    ).toBeNull();
    expect(
      (
        await other.post(path + '/complete', {
          headers: authHeaders,
          data,
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(401);
    await registerRecoverable(other);
    expect(
      (
        await other.post(path + '/complete', {
          headers: authHeaders,
          data,
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post(path + '/complete', {
          headers: authHeaders,
          data,
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(303);
  } finally {
    await other.dispose();
    await db.end();
  }
});
test('E2E-API-1495 incomplete authorization and expired pending state recover without linking or stale cancellation @DEV-028 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await connectionDatabase(feedbackSandbox);
  const start = async () => {
    const response = await request.post(path + '/start', {
      headers: authHeaders,
      data: { consent: true },
    });
    expect(response.status()).toBe(201);
    return new URL((await response.json()).loginUrl).searchParams.get('state')!;
  };
  try {
    const state = await start(),
      cancelled = await request.get(path + '/callback', {
        params: { state, status: 'error' },
      });
    expect(cancelled.status()).toBe(200);
    expect(await cancelled.text()).toContain(
      'Broker authorization was not completed',
    );
    expect(
      (
        await request.post(path + '/cancel', {
          headers: authHeaders,
          data: { state },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(303);
    expect((await request.get(path)).status()).toBe(200);
    const next = await start();
    expect(
      (
        await request.post(path + '/cancel', {
          headers: authHeaders,
          data: { state },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(409);
    await db.query(
      "UPDATE broker_angel_connections SET pending_until=now()-interval '1 second' WHERE user_id=$1",
      [owner.id],
    );
    expect((await (await request.get(path)).json()).state).toBe('expired');
    const stored = (
      await db.query(
        'SELECT state_hash,encrypted_token FROM broker_angel_connections WHERE user_id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(stored.state_hash).toBeNull();
    expect(stored.encrypted_token).toBeNull();
    expect(
      (
        await request.post(path + '/complete', {
          headers: authHeaders,
          data: { state: next, auth_token: 'synthetic_access_token' },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(409);
  } finally {
    await db.end();
  }
});

test('E2E-API-1496 publisher network metadata and changed app key fail closed before provider requests @DEV-028 @TEST-SIMULATION', async () => {
  const moduleUrl = new URL(
    '../../../../apps/api/dist/angel-provider.js',
    import.meta.url,
  ).href;
  const { AngelProvider, angelExpiry } = await import(moduleUrl);
  expect(() =>
    new AngelProvider(
      'synthetic',
      'not-ip',
      '192.0.2.1',
      '02:00:00:00:00:01',
    ).assertConfigured(),
  ).toThrow();
  await expect(
    new AngelProvider(
      'new_key',
      '127.0.0.1',
      '192.0.2.1',
      '02:00:00:00:00:01',
    ).holdings({
      accessToken: 'synthetic_access_token',
      apiKey: 'old_key',
      brokerUser: 'SYNTHETIC',
    }),
  ).rejects.toThrow('application changed');
  expect(angelExpiry(new Date('2026-09-15T17:00:00Z'))).toBe(
    '2026-09-15T18:30:00.000Z',
  );
});
