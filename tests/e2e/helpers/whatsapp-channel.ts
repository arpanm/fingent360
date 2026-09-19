import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { FeedItemSchema } from '../../../packages/contracts/src/index';
import {
  connectionDatabase,
  connectionHeaders,
} from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export { connectionHeaders as whatsappHeaders };
export const syntheticPhone = '15555550123';
export function signedWhatsapp(value: unknown) {
  const body = JSON.stringify(value);
  return {
    body,
    signature:
      'sha256=' +
      createHmac('sha256', 'synthetic-whatsapp-app-secret')
        .update(body)
        .digest('hex'),
  };
}
export function inboundWhatsapp(text: string) {
  return {
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
              messages: [
                {
                  id: 'synthetic-' + randomUUID(),
                  from: syntheticPhone,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
export async function postWhatsappWebhook(
  request: APIRequestContext,
  value: unknown,
) {
  const signed = signedWhatsapp(value);
  return request.post('/api/v1/whatsapp/webhook', {
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signed.signature,
    },
    data: signed.body,
  });
}
export async function whatsappSource(
  sandbox: FeedbackSandbox,
  publishedAt?: string,
) {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { feed: unknown[] };
  const item = bundle.feed
    .map((v) => FeedItemSchema.parse(v))
    .find(
      (v) =>
        v.kind === 'term' &&
        v.status === 'published' &&
        v.summary.length <= 800 &&
        v.title.length <= 200,
    );
  if (!item) throw Error('Authored public glossary fixture missing.');
  // Synthetic clock selection is part of the first retained fixture edition.
  if (publishedAt) item.publishedAt = publishedAt;
  const pool = await connectionDatabase(sandbox);
  try {
    await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,$2)', [
      item.id,
      item.version,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
      [item.id, item.version, item],
    );
  } finally {
    await pool.end();
  }
  return item;
}
export async function whatsappAccount(request: APIRequestContext) {
  const username = 'wa_' + randomUUID().slice(0, 8),
    password = 'Synthetic-whatsapp-2026-password';
  const reply = await request.post('/api/v1/account/register', {
    headers: connectionHeaders,
    data: { username, password, consent: true },
  });
  expect(reply.status(), await reply.text()).toBe(201);
  return { username, password };
}
export async function verifyWhatsapp(request: APIRequestContext) {
  const response = await request.post('/api/v1/account/whatsapp/verify', {
    headers: connectionHeaders,
    data: { requestId: randomUUID(), phone: syntheticPhone, consent: true },
  });
  expect(response.status(), await response.text()).toBe(201);
  const value = (await response.json()) as { verificationUrl: string };
  const text = new URL(value.verificationUrl).searchParams.get('text')!;
  expect(
    (await postWhatsappWebhook(request, inboundWhatsapp(text))).status(),
  ).toBe(200);
  return value;
}
