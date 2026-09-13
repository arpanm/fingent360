import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
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
}) => {
  const body = { ...submission(), image: image() };
  expect(
    (
      await request.post('/api/v1/feedback', { headers: origin(), data: body })
    ).status(),
  ).toBe(201);
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ??
      parseEnv(
        await readFile(new URL('../../../../.env', import.meta.url), 'utf8'),
      ).DATABASE_URL,
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
