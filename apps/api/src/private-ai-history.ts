import {
  sealPrivatePayload,
  openPrivatePayload,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
import {
  Controller,
  Delete,
  Get,
  Headers,
  Header,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { PrivateAiHistorySchema, consentActive } from '@fingent360/contracts';
import { readConsent } from './consent-store.js';
import { AccountStore, STORE } from './accounts.js';
export async function startPrivateAiHistory(
  c: pg.PoolClient,
  userId: string,
  provider: string,
  model: string,
  instructions: string,
  input: string,
  keys: PrivateDataKeys,
) {
  const consent = await readConsent(c, userId, 'private-ai-history');
  if (!consentActive(consent, new Date().toISOString())) return null;
  if (instructions.length > 12000 || input.length > 40000) return null;
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,360956))', [
    userId,
  ]);
  const id = randomUUID(),
    expiresAt = new Date(
      Math.min(
        Date.now() + 7 * 86400000,
        consent.expiresAt ? Date.parse(consent.expiresAt) : Infinity,
      ),
    ).toISOString();
  await c.query(
    'DELETE FROM private_ai_history WHERE user_id=$1 AND expires_at<=now()',
    [userId],
  );
  await c.query(
    "INSERT INTO private_ai_history(id,user_id,provider,model,instructions,input,status,expires_at,consent_version,encrypted_payload) VALUES($1,$2,$3,$4,'','','running',$5,$6,$7)",
    [
      id,
      userId,
      provider,
      model,
      expiresAt,
      consent.version,
      sealPrivatePayload(
        userId,
        id,
        { instructions, input, raw: null, text: null },
        keys,
      ),
    ],
  );
  await c.query(
    'DELETE FROM private_ai_history WHERE user_id=$1 AND id IN (SELECT id FROM private_ai_history WHERE user_id=$1 ORDER BY created_at DESC,id DESC OFFSET 50)',
    [userId],
  );
  return id;
}
export async function finishPrivateAiHistory(
  c: pg.PoolClient,
  userId: string,
  id: string | null,
  value: {
    raw?: string;
    text?: string;
    status?: 'succeeded' | 'failed';
    outcome?: string;
  },
  keys: PrivateDataKeys,
) {
  if (!id) return;
  await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [userId]);
  const consent = await readConsent(c, userId, 'private-ai-history');
  if (!consentActive(consent, new Date().toISOString())) {
    await c.query('DELETE FROM private_ai_history WHERE user_id=$1', [userId]);
    return;
  }
  const selected = await c.query<{
    instructions: string;
    input: string;
    raw_output: string | null;
    text_output: string | null;
    encrypted_payload: unknown;
  }>(
    'SELECT instructions,input,raw_output,text_output,encrypted_payload FROM private_ai_history WHERE id=$1 AND user_id=$2 AND consent_version=$3 AND expires_at>clock_timestamp() FOR UPDATE',
    [id, userId, consent.version],
  );
  const row = selected.rows[0];
  if (!row) return;
  const previous =
    row.encrypted_payload === null
      ? {
          instructions: row.instructions,
          input: row.input,
          raw: row.raw_output,
          text: row.text_output,
        }
      : openPrivatePayload(userId, id, row.encrypted_payload, keys);
  const encrypted = sealPrivatePayload(
    userId,
    id,
    {
      ...previous,
      raw: value.raw?.slice(0, 65536) ?? previous.raw,
      text: value.text?.slice(0, 65536) ?? previous.text,
    },
    keys,
  );
  await c.query(
    "UPDATE private_ai_history SET instructions='',input='',raw_output=NULL,text_output=NULL,encrypted_payload=$3,status=coalesce($4,status),outcome=coalesce($5,outcome) WHERE id=$1 AND user_id=$2 AND consent_version=$6 AND expires_at>clock_timestamp()",
    [
      id,
      userId,
      encrypted,
      value.status ?? null,
      value.outcome ?? null,
      consent.version,
    ],
  );
}
export async function exportPrivateAiHistory(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  const consent = await readConsent(c, userId, 'private-ai-history'),
    enabled = consentActive(consent, new Date().toISOString());
  await c.query(
    enabled
      ? 'DELETE FROM private_ai_history WHERE user_id=$1 AND expires_at<=clock_timestamp()'
      : 'DELETE FROM private_ai_history WHERE user_id=$1',
    [userId],
  );
  const rows = await c.query<{
    id: string;
    provider: string;
    model: string;
    encrypted_payload: unknown;
    instructions: string;
    input: string;
    raw_output: string | null;
    text_output: string | null;
    status: string;
    outcome: string;
    created_at: Date;
    expires_at: Date;
    consent_version: number;
  }>(
    'SELECT * FROM private_ai_history WHERE user_id=$1 AND expires_at>clock_timestamp() ORDER BY created_at DESC,id DESC LIMIT 50 FOR UPDATE',
    [userId],
  );
  const entries = [];
  for (const row of rows.rows) {
    const clear =
      row.encrypted_payload === null
        ? {
            instructions: row.instructions,
            input: row.input,
            raw: row.raw_output,
            text: row.text_output,
          }
        : openPrivatePayload(userId, row.id, row.encrypted_payload, keys);
    if (
      row.encrypted_payload === null ||
      privatePayloadNeedsRotation(row.encrypted_payload, keys)
    ) {
      await c.query(
        "UPDATE private_ai_history SET instructions='',input='',raw_output=NULL,text_output=NULL,encrypted_payload=$3 WHERE id=$1 AND user_id=$2",
        [row.id, userId, sealPrivatePayload(userId, row.id, clear, keys)],
      );
    }
    entries.push({
      ...row,
      instructions: clear.instructions,
      input: clear.input,
      raw_output: clear.raw,
      text_output: clear.text,
    });
  }
  return PrivateAiHistorySchema.parse({
    enabled,
    retentionDays: 7,
    entries: entries.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      instructions: r.instructions,
      input: r.input,
      rawOutput: r.raw_output,
      textOutput: r.text_output,
      status: r.status,
      outcome: r.outcome,
      createdAt: r.created_at.toISOString(),
      expiresAt: r.expires_at.toISOString(),
      consentVersion: r.consent_version,
    })),
  });
}
@Controller('account/ai-history')
export class PrivateAiHistoryController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  read(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      const result = await exportPrivateAiHistory(
        c,
        user.id,
        this.store.privateDataKeys,
      );
      await this.store.require(c, cookie);
      return result;
    });
  }
  @Delete() remove(
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('DELETE FROM private_ai_history WHERE user_id=$1', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      return exportPrivateAiHistory(c, user.id, this.store.privateDataKeys);
    });
  }
}
@Injectable()
export class PrivateAiHistoryExpiry {
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<unknown> | undefined;
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.store
          .transaction((c) =>
            c.query(
              'DELETE FROM private_ai_history WHERE id IN (SELECT id FROM private_ai_history WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 500)',
            ),
          )
          .catch(() => {})
          .finally(() => {
            this.active = undefined;
          });
    }, 60000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
