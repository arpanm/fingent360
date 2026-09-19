import { randomUUID, createHmac } from 'node:crypto';
import { test, expect } from '../../helpers/feedback-fixture';
import {
  whatsappAccount,
  whatsappSource,
  verifyWhatsapp,
  postWhatsappWebhook,
  inboundWhatsapp,
  syntheticPhone,
  whatsappHeaders,
} from '../../helpers/whatsapp-channel';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test.use({ whatsappSimulation: true });
test('E2E-API-1600 actual recipient verification encrypted queue idempotency and STOP cancellation @DEV-029 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const handshake = await request.get('/api/v1/whatsapp/webhook', {
    params: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'synthetic-whatsapp-verify-token',
      'hub.challenge': 'synthetic-challenge',
    },
  });
  expect(handshake.status()).toBe(200);
  expect(handshake.headers()['content-type']).toContain('text/plain');
  expect(await handshake.text()).toBe('synthetic-challenge');
  expect(
    (
      await request.get('/api/v1/whatsapp/webhook', {
        params: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'synthetic-challenge',
        },
      })
    ).status(),
  ).toBe(401);
  await whatsappAccount(request);
  const source = await whatsappSource(feedbackSandbox);
  expect(source.sourceHash).toBeNull();
  await verifyWhatsapp(request);
  expect(
    (await (await request.get('/api/v1/account/whatsapp')).json()).connection,
  ).toBe('verified');
  const input = { requestId: randomUUID(), itemId: source.id };
  for (let i = 0; i < 2; i++)
    expect(
      (
        await request.post('/api/v1/account/whatsapp/deliveries', {
          headers: whatsappHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
  const view = await (await request.get('/api/v1/account/whatsapp')).json();
  expect(view.jobs).toHaveLength(1);
  expect(view.jobs[0].status).toBe('queued');
  expect(JSON.stringify(view)).not.toContain(syntheticPhone);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const row = (await pool.query('SELECT payload FROM whatsapp_connections'))
      .rows[0];
    expect(JSON.stringify(row.payload)).not.toContain(syntheticPhone);
    expect(row.payload.ciphertext).toBeTruthy();
    expect(
      (await pool.query('SELECT payload FROM whatsapp_outbox')).rows[0].payload
        .ciphertext,
    ).toBeTruthy();
  } finally {
    await pool.end();
  }
  expect(
    (await postWhatsappWebhook(request, inboundWhatsapp('STOP'))).status(),
  ).toBe(200);
  const stopped = await (await request.get('/api/v1/account/whatsapp')).json();
  expect(stopped.connection).toBe('disabled');
  expect(stopped.jobs[0].status).toBe('cancelled');
  expect(
    (
      await request.post('/api/v1/account/whatsapp/deliveries', {
        headers: whatsappHeaders,
        data: { ...input, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-1601 signed provider status rejects forged signature duplicates and backwards delivery plus uncertain retry @DEV-029 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await whatsappAccount(request);
  const source = await whatsappSource(feedbackSandbox);
  await verifyWhatsapp(request);
  const id = randomUUID();
  expect(
    (
      await request.post('/api/v1/account/whatsapp/deliveries', {
        headers: whatsappHeaders,
        data: { requestId: id, itemId: source.id },
      })
    ).status(),
  ).toBe(201);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await pool.query(
      "UPDATE whatsapp_outbox SET state='accepted',provider_id='synthetic-wamid' WHERE id=$1",
      [id],
    );
  } finally {
    await pool.end();
  }
  const status = (state: string) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'synthetic-business',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '123456789' },
              statuses: [
                {
                  id: 'synthetic-wamid',
                  status: state,
                  timestamp: '1789500000',
                  recipient_id: syntheticPhone,
                },
              ],
            },
          },
        ],
      },
    ],
  });
  expect(
    (
      await request.post('/api/v1/whatsapp/webhook', { data: status('read') })
    ).status(),
  ).toBe(401);
  for (const state of ['delivered', 'delivered', 'sent', 'read', 'failed'])
    expect((await postWhatsappWebhook(request, status(state))).status()).toBe(
      200,
    );
  expect(
    (await (await request.get('/api/v1/account/whatsapp')).json()).jobs[0]
      .status,
  ).toBe('read');
  const db = await connectionDatabase(feedbackSandbox);
  try {
    await db.query("UPDATE whatsapp_outbox SET state='uncertain' WHERE id=$1", [
      id,
    ]);
  } finally {
    await db.end();
  }
  expect(
    (
      await request.post(`/api/v1/account/whatsapp/deliveries/${id}/retry`, {
        headers: whatsappHeaders,
        data: {},
      })
    ).status(),
  ).toBe(409);
  const broken = '{';
  expect(
    (
      await request.post('/api/v1/whatsapp/webhook', {
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256':
            'sha256=' +
            createHmac('sha256', 'synthetic-whatsapp-app-secret')
              .update(broken)
              .digest('hex'),
        },
        data: broken,
      })
    ).status(),
  ).toBe(400);
});
test('E2E-API-1602 owner export contains consent data and actual account deletion removes queue and webhook receipts @DEV-029 @PRIVACY-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const account = await whatsappAccount(request);
  const source = await whatsappSource(feedbackSandbox);
  await verifyWhatsapp(request);
  expect(
    (
      await request.post('/api/v1/account/whatsapp/deliveries', {
        headers: whatsappHeaders,
        data: { requestId: randomUUID(), itemId: source.id },
      })
    ).status(),
  ).toBe(201);
  const exported = await request.get('/api/v1/account/privacy/export');
  expect(exported.status()).toBe(200);
  const data = await exported.json();
  expect(data.whatsapp.connection.phone).toBe(syntheticPhone);
  expect(data.whatsapp.deliveries).toHaveLength(1);
  expect(JSON.stringify(data.whatsapp)).not.toContain('VERIFY ');
  expect(
    (
      await request.delete('/api/v1/account', {
        headers: whatsappHeaders,
        data: { password: account.password },
      })
    ).status(),
  ).toBe(200);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    for (const table of [
      'whatsapp_connections',
      'whatsapp_outbox',
      'whatsapp_webhook_receipts',
      'whatsapp_verification_attempts',
    ])
      expect(
        (await pool.query(`SELECT count(*)::int AS count FROM ${table}`))
          .rows[0].count,
      ).toBe(0);
  } finally {
    await pool.end();
  }
  expect((await request.get('/api/v1/account/whatsapp')).status()).toBe(401);
});
test('E2E-API-1603 actual queue worker captures template acceptance lost acknowledgment and withdrawn source without external send @DEV-029 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await whatsappAccount(request);
  const source = await whatsappSource(feedbackSandbox);
  await verifyWhatsapp(request);
  const { readConfig } = await import(
      new URL('../../../../apps/api/dist/config.js', import.meta.url).href
    ),
    { AccountStore } = await import(
      new URL('../../../../apps/api/dist/accounts.js', import.meta.url).href
    ),
    { WhatsappStore } = await import(
      new URL('../../../../apps/api/dist/whatsapp-channel.js', import.meta.url)
        .href
    );
  const config = readConfig({
    DATABASE_URL: feedbackSandbox.databaseUrl,
    MONGODB_URI: 'mongodb://127.0.0.1:57017/unused_whatsapp',
    WEB_ORIGIN: whatsappHeaders.Origin,
    ...feedbackSandbox.privateDataKeys,
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_AUTOMATIC_DISPATCH: 'false',
    WHATSAPP_ACCESS_TOKEN: 'synthetic-access-token-never-send',
    WHATSAPP_APP_SECRET: 'synthetic-whatsapp-app-secret',
    WHATSAPP_VERIFY_TOKEN: 'synthetic-whatsapp-verify-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_BUSINESS_NUMBER: '15555550100',
    WHATSAPP_TEMPLATE_NAME: 'fingent_public_summary',
    WHATSAPP_PUBLIC_ORIGIN: 'https://reading.example.com',
    WHATSAPP_APPROVAL_REFERENCE:
      'TEST-SIMULATION only; no provider activation or actual permission.',
    WHATSAPP_ALLOWED_SOURCE_IDS: 'glossary',
  });
  const account = new AccountStore(config),
    pool = await connectionDatabase(feedbackSandbox);
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    expect(String(url)).toContain('https://graph.facebook.com/');
    const payload = JSON.parse(String(init?.body));
    expect(payload.to).toBe(syntheticPhone);
    expect(
      payload.template.components[0].parameters.map(
        (v: { text: string }) => v.text,
      ),
    ).toEqual([
      source.title,
      source.summary,
      'https://reading.example.com/#read/' + source.id,
    ]);
    if (calls === 2)
      throw Error('Synthetic lost acknowledgment after provider receipt');
    return new Response(
      JSON.stringify({ messages: [{ id: 'synthetic-worker-message' }] }),
      { status: 200 },
    );
  };
  const worker = new WhatsappStore(account, config, transport);
  try {
    const enqueue = async () => {
      const id = randomUUID();
      expect(
        (
          await request.post('/api/v1/account/whatsapp/deliveries', {
            headers: whatsappHeaders,
            data: { requestId: id, itemId: source.id },
          })
        ).status(),
      ).toBe(201);
      return id;
    };
    const accepted = await enqueue();
    await worker.tick();
    expect(
      (
        await pool.query('SELECT state FROM whatsapp_outbox WHERE id=$1', [
          accepted,
        ])
      ).rows[0].state,
    ).toBe('accepted');
    const uncertain = await enqueue();
    await worker.tick();
    await worker.tick();
    expect(calls).toBe(2);
    expect(
      (
        await pool.query('SELECT state FROM whatsapp_outbox WHERE id=$1', [
          uncertain,
        ])
      ).rows[0].state,
    ).toBe('uncertain');
    const withdrawn = await enqueue();
    await pool.query(
      "UPDATE discovery_versions SET data=jsonb_set(data,'{status}','\"withdrawn\"'::jsonb) WHERE item_id=$1",
      [source.id],
    );
    await worker.tick();
    expect(calls).toBe(2);
    expect(
      (
        await pool.query('SELECT state FROM whatsapp_outbox WHERE id=$1', [
          withdrawn,
        ])
      ).rows[0].state,
    ).not.toBe('accepted');
  } finally {
    await pool.end();
    await account.onApplicationShutdown();
  }
});
test('E2E-API-1604 verification idempotency throttle and daily delivery quota preserve bounded requests @DEV-029 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await whatsappAccount(request);
  const source = await whatsappSource(feedbackSandbox);
  const input = {
    requestId: randomUUID(),
    phone: syntheticPhone,
    consent: true,
  };
  const first = await request.post('/api/v1/account/whatsapp/verify', {
    headers: whatsappHeaders,
    data: input,
  });
  expect(first.status()).toBe(201);
  const receipt = await first.json();
  const again = await request.post('/api/v1/account/whatsapp/verify', {
    headers: whatsappHeaders,
    data: input,
  });
  expect(await again.json()).toEqual(receipt);
  expect(
    (
      await request.post('/api/v1/account/whatsapp/verify', {
        headers: whatsappHeaders,
        data: { ...input, requestId: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await postWhatsappWebhook(
        request,
        inboundWhatsapp(
          new URL(receipt.verificationUrl).searchParams.get('text')!,
        ),
      )
    ).status(),
  ).toBe(200);
  for (let i = 0; i < 10; i++)
    expect(
      (
        await request.post('/api/v1/account/whatsapp/deliveries', {
          headers: whatsappHeaders,
          data: { requestId: randomUUID(), itemId: source.id },
        })
      ).status(),
    ).toBe(201);
  expect(
    (
      await request.post('/api/v1/account/whatsapp/deliveries', {
        headers: whatsappHeaders,
        data: { requestId: randomUUID(), itemId: source.id },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await (await request.get('/api/v1/account/whatsapp')).json()).jobs,
  ).toHaveLength(10);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM whatsapp_verification_attempts',
        )
      ).rows[0].count,
    ).toBe(1);
    const exhausted = (
      await pool.query(
        "UPDATE whatsapp_outbox SET state='failed',dispatch_count=3 WHERE id=(SELECT id FROM whatsapp_outbox LIMIT 1) RETURNING id",
      )
    ).rows[0].id;
    expect(
      (
        await request.post(
          '/api/v1/account/whatsapp/deliveries/' + exhausted + '/retry',
          { headers: whatsappHeaders, data: {} },
        )
      ).status(),
    ).toBe(409);
  } finally {
    await pool.end();
  }
});

test('E2E-API-1605 recipient history rechecks session after actual outbox storage wait @DEV-029 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await whatsappAccount(request);
  await verifyWhatsapp(request);
  const pool = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox),
    blocker = await pool.connect();
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await blocker.query('BEGIN');
    await blocker.query('LOCK TABLE whatsapp_outbox IN ACCESS EXCLUSIVE MODE');
    const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0]
      .pid;
    pending = request.get('/api/v1/account/whatsapp');
    void pending.catch(() => {});
    await expect
      .poll(async () =>
        Number(
          (
            await observer.query(
              'SELECT count(*)::int AS count FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',
              [pid],
            )
          ).rows[0].count,
        ),
      )
      .toBeGreaterThan(0);
    await observer.query(
      "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('COMMIT');
    const response = await pending;
    expect(response.status(), await response.text()).toBe(401);
    expect(await response.text()).not.toContain(syntheticPhone);
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
    await pending?.catch(() => {});
    await observer.end();
    await pool.end();
  }
});
