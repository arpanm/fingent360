import { test, expect } from '../../helpers/feedback-fixture';
import { randomBytes, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fork } from 'node:child_process';
const pg = createRequire(
  new URL('../../../../apps/api/package.json', import.meta.url),
)('pg') as {
  Pool: new (options: {
    connectionString: string | undefined;
    max: number;
  }) => {
    query: (
      sql: string,
      values: string[],
    ) => Promise<{ rows: Array<Record<string, unknown>> }>;
    end: () => Promise<void>;
  };
};
import {
  FeedbackReceiptSchema,
  FeedbackReportSchema,
  FeedbackListSchema,
} from '../../../../packages/contracts/src/index';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const origin = () => ({
  Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
});
function crc(bytes: Buffer) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Buffer) {
  const output = Buffer.alloc(body.length + 12);
  output.writeUInt32BE(body.length);
  output.write(type, 4);
  body.copy(output, 8);
  output.writeUInt32BE(crc(output.subarray(4, -4)), output.length - 4);
  return output;
}
function image(padding = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return {
    mime: 'image/png' as const,
    width: 1,
    height: 1,
    base64: Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      ...(padding ? [chunk('tEXt', Buffer.alloc(padding, 65))] : []),
      chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
      chunk('IEND', Buffer.alloc(0)),
    ]).toString('base64'),
  };
}
function submission() {
  return {
    id: randomUUID(),
    receiptToken: randomBytes(32).toString('hex'),
    text: 'Synthetic acceptance feedback only',
    image: null as ReturnType<typeof image> | null,
    audio: null,
    context: {
      screen: 'today',
      runtime: 'web' as const,
      appVersion: 'e2e-synthetic',
      viewport: { width: 320, height: 600 },
      capturedAt: new Date().toISOString(),
    },
    consent: true as const,
  };
}
const capability = (body: ReturnType<typeof submission>) => ({
  ...origin(),
  'X-Feedback-Token': body.receiptToken,
});
test('E2E-API-190 explicit feedback idempotency private ownership and deletion tombstone @FEEDBACK-001', async ({
  request,
}) => {
  const body = submission();
  const cancelled = submission();
  expect(
    (
      await request.delete(`/api/v1/feedback/${cancelled.id}`, {
        headers: capability(cancelled),
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.delete(`/api/v1/feedback/${cancelled.id}`, {
        headers: capability(cancelled),
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post('/api/v1/feedback', {
        headers: origin(),
        data: cancelled,
      })
    ).status(),
  ).toBe(410);
  expect(
    (
      await request.delete(`/api/v1/feedback/${cancelled.id}`, {
        headers: { ...origin(), 'X-Feedback-Token': 'b'.repeat(64) },
      })
    ).status(),
  ).toBe(404);
  try {
    const first = await request.post('/api/v1/feedback', {
      headers: origin(),
      data: body,
    });
    expect(first.status(), await first.text()).toBe(201);
    const receipt = FeedbackReceiptSchema.parse(await first.json());
    for (let count = 0; count < 22; count++)
      expect(
        (
          await request.post('/api/v1/feedback', {
            headers: origin(),
            data: body,
          })
        ).status(),
      ).toBe(201);
    const retry = await request.post('/api/v1/feedback', {
      headers: origin(),
      data: body,
    });
    expect(retry.status()).toBe(201);
    expect(await retry.json()).toEqual(receipt);
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers: origin(),
          data: { ...body, text: 'Changed' },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers: origin(),
          data: { ...body, receiptToken: 'b'.repeat(64) },
        })
      ).status(),
    ).toBe(409);
    expect((await request.get(`/api/v1/feedback/${body.id}`)).status()).toBe(
      404,
    );
    expect(
      (
        await request.get(`/api/v1/feedback/${body.id}`, {
          headers: { 'X-Feedback-Token': 'b'.repeat(64) },
        })
      ).status(),
    ).toBe(404);
    const report = await request.get(`/api/v1/feedback/${body.id}`, {
      headers: capability(body),
    });
    expect(report.headers()['cache-control']).toContain('no-store');
    expect(FeedbackReportSchema.parse(await report.json()).text).toBe(
      body.text,
    );
    expect(
      (
        await request.delete(`/api/v1/feedback/${body.id}`, {
          headers: capability(body),
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.delete(`/api/v1/feedback/${body.id}`, {
          headers: capability(body),
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers: origin(),
          data: body,
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await request.get(`/api/v1/feedback/${body.id}`, {
          headers: capability(body),
        })
      ).status(),
    ).toBe(410);
  } finally {
    await request.delete(`/api/v1/feedback/${body.id}`, {
      headers: capability(body),
    });
  }
});
test('E2E-API-191 bounded attachment upload native CORS and origin validation @FEEDBACK-001', async ({
  request,
}) => {
  const body = { ...submission(), image: image(150000) };
  try {
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers: { Origin: 'https://evil.example' },
          data: body,
        })
      ).status(),
    ).toBe(403);
    const response = await request.post('/api/v1/feedback', {
      headers: { Origin: 'https://appassets.androidplatform.net' },
      data: body,
    });
    expect(response.status(), await response.text()).toBe(201);
    expect(response.headers()['access-control-allow-origin']).toBe(
      'https://appassets.androidplatform.net',
    );
    const read = FeedbackReportSchema.parse(
      await (
        await request.get(`/api/v1/feedback/${body.id}`, {
          headers: capability(body),
        })
      ).json(),
    );
    expect(read.image?.base64).toBe(body.image.base64);
    for (const patch of [
      { consent: false },
      { image: { ...body.image, width: 2 } },
      {
        audio: {
          mime: 'audio/webm',
          base64: Buffer.alloc(60).toString('base64'),
          durationMs: 500,
        },
      },
    ])
      expect(
        (
          await request.post('/api/v1/feedback', {
            headers: origin(),
            data: { ...body, id: randomUUID(), ...patch },
          })
        ).status(),
      ).toBe(400);
    const preflight = await request.fetch('/api/v1/feedback', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://appassets.androidplatform.net',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-feedback-token',
      },
    });
    expect(preflight.headers()['access-control-allow-origin']).toBe(
      'https://appassets.androidplatform.net',
    );
    const other = await request.get('/api/v1/health', {
      headers: { Origin: 'https://appassets.androidplatform.net' },
    });
    expect(other.headers()['access-control-allow-origin']).toBe(
      origin().Origin,
    );
    expect(other.headers()['access-control-allow-origin']).not.toBe(
      'https://appassets.androidplatform.net',
    );
  } finally {
    await request.delete(`/api/v1/feedback/${body.id}`, {
      headers: capability(body),
    });
  }
});
test('E2E-API-192 protected feedback inbox private attachment review conflict and deletion @FEEDBACK-001', async ({
  request,
}) => {
  const body = { ...submission(), image: image() };
  expect(
    (
      await request.post('/api/v1/feedback', { headers: origin(), data: body })
    ).status(),
  ).toBe(201);
  try {
    expect((await request.get('/api/v1/ops/feedback')).status()).toBe(401);
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers: origin(),
          data: { key: await operatorKey() },
        })
      ).status(),
    ).toBe(200);
    const listing = FeedbackListSchema.parse(
      await (await request.get('/api/v1/ops/feedback?status=received')).json(),
    );
    const own = listing.items.find((item) => item.id === body.id);
    expect(own?.hasImage).toBe(true);
    expect(JSON.stringify(listing)).not.toContain(body.image.base64);
    expect(JSON.stringify(listing)).not.toContain(body.receiptToken);
    const detail = FeedbackReportSchema.parse(
      await (await request.get(`/api/v1/ops/feedback/${body.id}`)).json(),
    );
    expect(detail.image?.base64).toBe(body.image.base64);
    const changed = await request.patch(`/api/v1/ops/feedback/${body.id}`, {
      headers: origin(),
      data: { expectedVersion: detail.version, status: 'reviewing' },
    });
    expect(changed.status()).toBe(200);
    expect((await changed.json()).status).toBe('reviewing');
    expect(
      (
        await request.patch(`/api/v1/ops/feedback/${body.id}`, {
          headers: origin(),
          data: { expectedVersion: detail.version, status: 'resolved' },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.delete(`/api/v1/ops/feedback/${body.id}`, {
          headers: origin(),
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.get(`/api/v1/feedback/${body.id}`, {
          headers: capability(body),
        })
      ).status(),
    ).toBe(410);
  } finally {
    await request.delete(`/api/v1/feedback/${body.id}`, {
      headers: capability(body),
    });
    await request.delete('/api/v1/ops/session', { headers: origin() });
  }
});
test('E2E-API-193 feedback retention scrubs owned expired report and rejects resurrection @FEEDBACK-001', async ({
  request,
  feedbackSandbox,
}) => {
  const body = { ...submission(), image: image() };
  expect(
    (
      await request.post('/api/v1/feedback', { headers: origin(), data: body })
    ).status(),
  ).toBe(201);
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  try {
    await pool.query(
      "UPDATE feedback_reports SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [body.id],
    );
    expect(
      (
        await request.get(`/api/v1/feedback/${body.id}`, {
          headers: capability(body),
        })
      ).status(),
    ).toBe(410);
    const result = await pool.query(
      'SELECT deleted_at,text,context,image_bytes,audio_bytes,token_hash FROM feedback_reports WHERE id=$1',
      [body.id],
    );
    expect(result.rows[0]!.deleted_at).toBeTruthy();
    for (const key of ['text', 'context', 'image_bytes', 'audio_bytes'])
      expect(result.rows[0]![key]).toBeNull();
    expect(result.rows[0]!.token_hash).not.toBe(body.receiptToken);
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers: origin(),
          data: body,
        })
      ).status(),
    ).toBe(410);
  } finally {
    await request.delete(`/api/v1/feedback/${body.id}`, {
      headers: capability(body),
    });
    await pool.end();
  }
});

test('E2E-API-194 feedback quota rolls back rejected new reports while allowing receipt retries and owned deletion @FEEDBACK-TEST-001 @FEEDBACK-001', async ({
  request,
  feedbackSandbox,
}) => {
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  const first = submission();
  try {
    let firstReceipt: unknown;
    for (let index = 0; index < 20; index++) {
      const body = index === 0 ? first : submission();
      const response = await request.post('/api/v1/feedback', {
        headers: origin(),
        data: body,
      });
      expect(response.status(), await response.text()).toBe(201);
      const receipt = FeedbackReceiptSchema.parse(await response.json());
      expect(receipt.id).toBe(body.id);
      if (index === 0) firstReceipt = receipt;
    }
    const before = await pool.query(
      'SELECT bucket,count FROM feedback_rate_limits ORDER BY bucket',
      [],
    );
    expect(before.rows).toHaveLength(2);
    expect(before.rows.every((row) => row.count === 20)).toBe(true);
    const overflow = submission();
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers: origin(),
          data: overflow,
        })
      ).status(),
    ).toBe(429);
    const after = await pool.query(
      'SELECT bucket,count FROM feedback_rate_limits ORDER BY bucket',
      [],
    );
    expect(after.rows).toEqual(before.rows);
    const reports = await pool.query(
      'SELECT count(*)::integer AS count FROM feedback_reports',
      [],
    );
    expect(reports.rows[0]?.count).toBe(20);
    expect(
      (
        await pool.query('SELECT id FROM feedback_reports WHERE id=$1', [
          overflow.id,
        ])
      ).rows,
    ).toHaveLength(0);

    // A lost receipt may be retried even after the new-report quota is full.
    const retry = await request.post('/api/v1/feedback', {
      headers: origin(),
      data: first,
    });
    expect(retry.status()).toBe(201);
    expect(FeedbackReceiptSchema.parse(await retry.json())).toEqual(
      firstReceipt,
    );
    expect(
      (
        await request.delete(`/api/v1/feedback/${first.id}`, {
          headers: capability(first),
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.get(`/api/v1/feedback/${first.id}`, {
          headers: capability(first),
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await pool.query(
          'SELECT bucket,count FROM feedback_rate_limits ORDER BY bucket',
          [],
        )
      ).rows,
    ).toEqual(before.rows);

    // Creating a new cancellation tombstone is a new resource, so it still
    // consumes the same quota. A rejected cancellation must not create a row.
    const absent = submission();
    expect(
      (
        await request.delete(`/api/v1/feedback/${absent.id}`, {
          headers: capability(absent),
        })
      ).status(),
    ).toBe(429);
    expect(
      (
        await pool.query('SELECT id FROM feedback_reports WHERE id=$1', [
          absent.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await pool.query(
          'SELECT bucket,count FROM feedback_rate_limits ORDER BY bucket',
          [],
        )
      ).rows,
    ).toEqual(before.rows);
  } finally {
    await pool.end();
  }
});

test('E2E-API-195 cancelled feedback fixture startup removes only its owned schema @FEEDBACK-TEST-001 @FEEDBACK-001', async ({
  feedbackSandbox,
}, testInfo) => {
  test.setTimeout(60000);
  const pool = new pg.Pool({
    connectionString: feedbackSandbox.databaseUrl,
    max: 1,
  });
  const child = fork(
    new URL('../../helpers/feedback-api-process.mjs', import.meta.url),
    [],
    {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: [],
      env: { ...process.env },
    },
  );
  let ownedSchema: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(
          Error(
            'Owned cancellation fixture did not exit within 30 seconds. Inspect its annotated schema.',
          ),
        );
      }, 30000);
      child.once('error', () =>
        reject(Error('Could not start the owned cancellation fixture.')),
      );
      child.once('exit', (code) => resolve(code));
      child.on('message', (message) => {
        if (
          !message ||
          typeof message !== 'object' ||
          !('phase' in message) ||
          message.phase !== 'schema-created' ||
          !('schema' in message)
        )
          return;
        const schema = String(message.schema);
        if (!/^e2e_feedback_[a-f0-9]{32}$/.test(schema)) {
          if (child.connected) child.disconnect();
          reject(
            Error('Cancellation fixture reported an invalid owned schema.'),
          );
          return;
        }
        ownedSchema = schema;
        testInfo.annotations.push({
          type: 'cancelled-feedback-schema',
          description: schema,
        });
        // Disconnect immediately at the creation boundary, before accepting any
        // ready API. The child must settle startup ownership and clean itself.
        if (child.connected) child.disconnect();
      });
    });
    expect(exitCode).toBe(0);
    expect(ownedSchema).toMatch(/^e2e_feedback_[a-f0-9]{32}$/);
    expect(ownedSchema).not.toBe(feedbackSandbox.schema);
    const cancelled = await pool.query(
      'SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname=$1',
      [ownedSchema!],
    );
    expect(cancelled.rows).toHaveLength(0);
    const active = await pool.query(
      'SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname=$1',
      [feedbackSandbox.schema],
    );
    expect(active.rows).toHaveLength(1);
  } finally {
    if (timer) clearTimeout(timer);
    if (child.connected) child.disconnect();
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve) => {
        const deadline = setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 15000);
        child.once('exit', () => {
          clearTimeout(deadline);
          resolve();
        });
      });
    }
    await pool.end();
  }
});
