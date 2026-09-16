import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { AppConfig } from './config.js';
export type PrivateDataKeys = Pick<
  AppConfig,
  'PRIVATE_DATA_KEYS' | 'PRIVATE_DATA_ACTIVE_KEY'
>;

const Payload = z.strictObject({
  instructions: z.string().max(12000),
  input: z.string().max(40000),
  raw: z.string().max(65536).nullable(),
  text: z.string().max(65536).nullable(),
});
const Envelope = z.strictObject({
  version: z.literal(1),
  keyId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  iv: z.string(),
  tag: z.string(),
  ciphertext: z.string().max(24000000),
});
export type PrivatePayload = z.infer<typeof Payload>;
const unavailable = () =>
  new ServiceUnavailableException(
    'Private data encryption is unavailable. Ask the operator to check server keys; existing records were not discarded.',
  );
function bytes(value: string, length?: number) {
  const result = Buffer.from(value, 'base64');
  if (
    result.toString('base64') !== value ||
    (length !== undefined && result.length !== length)
  )
    throw unavailable();
  return result;
}
function keys(config: PrivateDataKeys) {
  try {
    const active = z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,40}$/)
      .parse(config.PRIVATE_DATA_ACTIVE_KEY);
    const entries = z
      .record(z.string().regex(/^[A-Za-z0-9_-]{1,40}$/), z.string())
      .parse(JSON.parse(config.PRIVATE_DATA_KEYS || ''));
    if (
      Object.keys(entries).length < 1 ||
      Object.keys(entries).length > 10 ||
      !Object.hasOwn(entries, active)
    )
      throw unavailable();
    const ring = new Map(
      Object.entries(entries).map(([id, key]) => [id, bytes(key, 32)]),
    );
    return { active, ring };
  } catch {
    throw unavailable();
  }
}
export type PrivateDataPurpose =
  | 'whatsapp-channel'
  | 'private-ai-history'
  | 'feedback-report'
  | 'action-plan'
  | 'account-mfa'
  | 'goal-revision'
  | 'holdings-revision'
  | 'holdings-preview'
  | 'impact-calibration'
  | 'goal-comparison'
  | 'goal-adoption'
  | 'goal-feasibility'
  | 'allocation-revision'
  | 'report-job'
  | 'issued-report'
  | 'schedule-head'
  | 'schedule-edition'
  | 'schedule-request'
  | 'schedule-occurrence'
  | 'connection-revision'
  | 'connection-inbox'
  | 'connection-review'
  | 'impact-trace'
  | 'bond-comparison'
  | 'virtual-workspace'
  | 'virtual-preview'
  | 'virtual-mutation'
  | 'virtual-import'
  | 'virtual-review'
  | 'account-identity'
  | 'broker-kite-token'
  | 'broker-kite-capture'
  | 'broker-angel-token'
  | 'broker-angel-capture'
  | 'broker-upstox-token'
  | 'broker-upstox-capture';
const aad = (purpose: PrivateDataPurpose, userId: string, id: string) =>
  Buffer.from(`fingent360:${purpose}:v1:${userId}:${id}`);
export function sealPrivateJson(
  purpose: PrivateDataPurpose,
  userId: string,
  id: string,
  input: unknown,
  config: PrivateDataKeys,
) {
  try {
    const { active, ring } = keys(config);
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', ring.get(active)!, iv);
    cipher.setAAD(aad(purpose, userId, id));
    const encoded = JSON.stringify(input);
    if (!encoded || Buffer.byteLength(encoded, 'utf8') > 16000000)
      throw unavailable();
    const ciphertext = Buffer.concat([
      cipher.update(encoded, 'utf8'),
      cipher.final(),
    ]);
    return {
      version: 1 as const,
      keyId: active,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  } catch {
    throw unavailable();
  }
}
export function openPrivateJson(
  purpose: PrivateDataPurpose,
  userId: string,
  id: string,
  value: unknown,
  config: PrivateDataKeys,
): unknown {
  try {
    const envelope = Envelope.parse(value),
      { ring } = keys(config);
    const key = ring.get(envelope.keyId);
    if (!key) throw unavailable();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      bytes(envelope.iv, 12),
    );
    decipher.setAAD(aad(purpose, userId, id));
    decipher.setAuthTag(bytes(envelope.tag, 16));
    const clear = Buffer.concat([
      decipher.update(bytes(envelope.ciphertext)),
      decipher.final(),
    ]);
    return JSON.parse(clear.toString('utf8'));
  } catch {
    throw unavailable();
  }
}
export function privatePayloadNeedsRotation(
  value: unknown,
  config: PrivateDataKeys,
) {
  return Envelope.parse(value).keyId !== keys(config).active;
}

export function sealPrivatePayload(
  userId: string,
  id: string,
  input: PrivatePayload,
  config: PrivateDataKeys,
) {
  return sealPrivateJson(
    'private-ai-history',
    userId,
    id,
    Payload.parse(input),
    config,
  );
}
export function openPrivatePayload(
  userId: string,
  id: string,
  value: unknown,
  config: PrivateDataKeys,
): PrivatePayload {
  return Payload.parse(
    openPrivateJson('private-ai-history', userId, id, value, config),
  );
}

export function activePrivateKeyId(config: PrivateDataKeys) {
  return keys(config).active;
}
