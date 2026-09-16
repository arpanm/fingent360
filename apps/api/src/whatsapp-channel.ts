import {
  viewWhatsappSchedule,
  writeWhatsappSchedule,
  pauseWhatsappSchedule,
  prepareWhatsappOccurrence,
  exportWhatsappSchedules,
} from './whatsapp-schedule.js';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import {
  BadRequestException,
  HttpCode,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  WhatsappStartSchema,
  WhatsappSendSchema,
  WhatsappViewSchema,
  WhatsappPrivateSchema,
  WhatsappJobPayloadSchema,
  WhatsappStatusSchema,
  whatsappAdvance,
  publicReadingLink,
  PublicReadingOriginSchema,
  sourceIdFor,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import type { AppConfig } from './config.js';
import {
  sealPrivateJson,
  openPrivateJson,
  type PrivateDataKeys,
} from './private-data-crypto.js';
import { admitPublications } from './publication.js';
const parse = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException('Invalid WhatsApp request.');
  return result.data;
};
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export const WHATSAPP_STORE = Symbol('WHATSAPP_STORE');
export async function deleteWhatsapp(c: pg.PoolClient, userId: string) {
  for (const table of [
    'whatsapp_schedule_occurrences',
    'whatsapp_schedule_requests',
    'whatsapp_schedule_versions',
    'whatsapp_schedules',
  ])
    await c.query(`DELETE FROM ${table} WHERE user_id=$1`, [userId]);
  await c.query('DELETE FROM whatsapp_verification_attempts WHERE user_id=$1', [
    userId,
  ]);
  await c.query('DELETE FROM whatsapp_webhook_receipts WHERE user_id=$1', [
    userId,
  ]);
  await c.query('DELETE FROM whatsapp_outbox WHERE user_id=$1', [userId]);
  await c.query('DELETE FROM whatsapp_connections WHERE user_id=$1', [userId]);
}
export async function exportWhatsapp(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  const connection = (
    await c.query(
      'SELECT payload,state,updated_at FROM whatsapp_connections WHERE user_id=$1',
      [userId],
    )
  ).rows[0];
  const rows = (
    await c.query(
      'SELECT * FROM whatsapp_outbox WHERE user_id=$1 ORDER BY created_at,id',
      [userId],
    )
  ).rows;
  return {
    scheduling: await exportWhatsappSchedules(c, userId, keys),
    connection: connection
      ? {
          phone: WhatsappPrivateSchema.parse(
            openPrivateJson(
              'whatsapp-channel',
              userId,
              'connection',
              connection.payload,
              keys,
            ),
          ).phone,
          state: connection.state,
          updatedAt: connection.updated_at.toISOString(),
        }
      : null,
    deliveries: rows.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      status: row.state,
      createdAt: row.created_at.toISOString(),
      payload: WhatsappJobPayloadSchema.parse(
        openPrivateJson('whatsapp-channel', userId, row.id, row.payload, keys),
      ),
    })),
  };
}
export class WhatsappStore {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  constructor(
    private readonly account: AccountStore,
    private readonly config: AppConfig,
    private readonly transport: typeof fetch = fetch,
  ) {}
  onModuleInit() {
    if (this.config.WHATSAPP_ENABLED && this.config.WHATSAPP_AUTOMATIC_DISPATCH)
      this.timer = setInterval(() => {
        if (this.running) return;
        this.running = true;
        void this.tick()
          .catch(() => {})
          .finally(() => {
            this.running = false;
          });
      }, 30000);
  }
  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
  private ready() {
    if (
      !this.config.WHATSAPP_ENABLED ||
      !this.config.WHATSAPP_ACCESS_TOKEN ||
      !this.config.WHATSAPP_APP_SECRET ||
      !this.config.WHATSAPP_VERIFY_TOKEN ||
      !this.config.WHATSAPP_PHONE_NUMBER_ID ||
      !this.config.WHATSAPP_BUSINESS_NUMBER ||
      !this.config.WHATSAPP_TEMPLATE_NAME ||
      this.config.WHATSAPP_APPROVAL_REFERENCE.length < 20 ||
      !this.config.PRIVATE_IDENTITY_LOOKUP_KEY
    )
      throw new ServiceUnavailableException(
        'WhatsApp is not activated. Public reading links can still be shared manually.',
      );
    PublicReadingOriginSchema.parse(this.config.WHATSAPP_PUBLIC_ORIGIN);
  }
  private userTransaction<T>(
    cookie: string | undefined,
    work: (c: pg.PoolClient) => Promise<T>,
  ) {
    return this.account.transaction(async (c) => {
      const value = await work(c);
      await this.account.require(c, cookie);
      return value;
    });
  }
  private phoneHash(phone: string) {
    const key = this.config.PRIVATE_IDENTITY_LOOKUP_KEY;
    if (!key)
      throw new ServiceUnavailableException(
        'WhatsApp identity protection is unavailable.',
      );
    return createHmac('sha256', key)
      .update('whatsapp-phone:' + phone)
      .digest('hex');
  }
  private async owner(c: pg.PoolClient, cookie?: string) {
    const user = await this.account.require(c, cookie);
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
    await this.account.require(c, cookie);
    return user.id;
  }
  view(cookie?: string) {
    return this.userTransaction(cookie, async (c) => {
      const userId = await this.owner(c, cookie),
        row = (
          await c.query('SELECT * FROM whatsapp_connections WHERE user_id=$1', [
            userId,
          ])
        ).rows[0],
        rows = (
          await c.query(
            'SELECT id,item_id,state,created_at,updated_at,detail FROM whatsapp_outbox WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 100',
            [userId],
          )
        ).rows;
      const value = row
        ? WhatsappPrivateSchema.parse(
            openPrivateJson(
              'whatsapp-channel',
              userId,
              'connection',
              row.payload,
              this.account.privateDataKeys,
            ),
          )
        : null;
      return WhatsappViewSchema.parse({
        enabled: this.config.WHATSAPP_ENABLED,
        connection: row?.state ?? 'none',
        maskedPhone: value ? '••••' + value.phone.slice(-4) : null,
        expiresAt: row?.expires_at?.toISOString() ?? null,
        jobs: rows.map((r) => ({
          id: r.id,
          itemId: r.item_id,
          status: r.state,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
          detail: r.detail,
        })),
      });
    });
  }
  choices(after: string | undefined, cookie?: string) {
    return this.userTransaction(cookie, async (c) => {
      await this.owner(c, cookie);
      if (after !== undefined) parse(z.string().max(160), after);
      const rows = (
        await c.query(
          'SELECT id FROM discovery_items WHERE ($1::text IS NULL OR id>$1) ORDER BY id LIMIT 51',
          [after ?? null],
        )
      ).rows;
      const admitted = await admitPublications(
        c,
        rows.slice(0, 50).map((r) => r.id),
      );
      await this.account.require(c, cookie);
      return {
        items: admitted
          .filter(
            (item) =>
              item.status === 'published' &&
              sourceIdFor(item) !== 'other' &&
              this.config.WHATSAPP_ALLOWED_SOURCE_IDS.split(',')
                .map((v) => v.trim())
                .includes(sourceIdFor(item)) &&
              item.title.length <= 200 &&
              item.summary.length <= 800,
          )
          .map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
          })),
        next: rows.length > 50 ? rows[49].id : null,
      };
    });
  }
  start(body: unknown, cookie?: string) {
    this.ready();
    const input = parse(WhatsappStartSchema, body);
    return this.userTransaction(cookie, async (c) => {
      const userId = await this.owner(c, cookie),
        old = (
          await c.query(
            'SELECT * FROM whatsapp_connections WHERE user_id=$1 FOR UPDATE',
            [userId],
          )
        ).rows[0];
      if (old?.request_id === input.requestId) {
        const value = WhatsappPrivateSchema.parse(
          openPrivateJson(
            'whatsapp-channel',
            userId,
            'connection',
            old.payload,
            this.account.privateDataKeys,
          ),
        );
        if (
          value.phone !== input.phone ||
          !value.code ||
          old.state !== 'pending' ||
          old.expires_at.valueOf() <= Date.now()
        )
          throw new ConflictException('Start a new recipient verification.');
        return {
          verificationUrl: `https://wa.me/${this.config.WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent('VERIFY ' + value.code)}`,
          expiresAt: old.expires_at.toISOString(),
        };
      }
      const attempts = (
        await c.query(
          "SELECT count(*)::int AS count, max(created_at)>clock_timestamp()-interval '1 minute' AS recent FROM whatsapp_verification_attempts WHERE user_id=$1 AND created_at>clock_timestamp()-interval '24 hours'",
          [userId],
        )
      ).rows[0];
      if (attempts.count >= 10 || attempts.recent)
        throw new ConflictException(
          'Wait one minute between new verification requests; at most ten per day.',
        );
      await c.query(
        'INSERT INTO whatsapp_verification_attempts(user_id,request_id) VALUES($1,$2)',
        [userId, input.requestId],
      );
      await pauseWhatsappSchedule(c, userId, this.account.privateDataKeys);
      const code = randomBytes(32).toString('hex'),
        expiresAt = new Date(Date.now() + 15 * 60000).toISOString(),
        payload = sealPrivateJson(
          'whatsapp-channel',
          userId,
          'connection',
          { phone: input.phone, code },
          this.account.privateDataKeys,
        );
      await c.query(
        "UPDATE whatsapp_outbox SET state='cancelled',detail='Recipient consent changed.',updated_at=clock_timestamp() WHERE user_id=$1 AND state='queued'",
        [userId],
      );
      await c.query(
        "INSERT INTO whatsapp_connections(user_id,request_id,phone_hash,payload,state,code_hash,expires_at) VALUES($1,$2,$3,$4,'pending',$5,$6) ON CONFLICT(user_id) DO UPDATE SET request_id=$2,phone_hash=$3,payload=$4,state='pending',code_hash=$5,expires_at=$6,updated_at=clock_timestamp()",
        [
          userId,
          input.requestId,
          this.phoneHash(input.phone),
          payload,
          hash(code),
          expiresAt,
        ],
      );
      return {
        verificationUrl: `https://wa.me/${this.config.WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent('VERIFY ' + code)}`,
        expiresAt,
      };
    });
  }
  stop(cookie?: string) {
    return this.userTransaction(cookie, async (c) => {
      const id = await this.owner(c, cookie);
      await this.disable(c, id);
      return { disabled: true };
    });
  }
  private async disable(c: pg.PoolClient, id: string) {
    await pauseWhatsappSchedule(c, id, this.account.privateDataKeys);
    const row = (
      await c.query(
        'SELECT payload FROM whatsapp_connections WHERE user_id=$1',
        [id],
      )
    ).rows[0];
    if (row) {
      const recipient = WhatsappPrivateSchema.parse(
        openPrivateJson(
          'whatsapp-channel',
          id,
          'connection',
          row.payload,
          this.account.privateDataKeys,
        ),
      );
      await c.query(
        'UPDATE whatsapp_connections SET payload=$2 WHERE user_id=$1',
        [
          id,
          sealPrivateJson(
            'whatsapp-channel',
            id,
            'connection',
            { phone: recipient.phone, code: null },
            this.account.privateDataKeys,
          ),
        ],
      );
    }
    await c.query(
      "UPDATE whatsapp_connections SET state='disabled',code_hash=NULL,expires_at=NULL,updated_at=clock_timestamp() WHERE user_id=$1",
      [id],
    );
    await c.query(
      "UPDATE whatsapp_outbox SET state='cancelled',detail='Channel consent withdrawn.',updated_at=clock_timestamp() WHERE user_id=$1 AND state='queued'",
      [id],
    );
  }
  private async admitted(c: pg.PoolClient, itemId: string) {
    const item = (await admitPublications(c, [itemId]))[0];
    if (
      !item ||
      item.status !== 'published' ||
      sourceIdFor(item) === 'other' ||
      !this.config.WHATSAPP_ALLOWED_SOURCE_IDS.split(',')
        .map((v) => v.trim())
        .includes(sourceIdFor(item))
    )
      throw new ConflictException(
        'This public source is not admitted for WhatsApp redistribution.',
      );
    if (item.title.length > 200 || item.summary.length > 800)
      throw new ConflictException(
        'The reviewed summary exceeds the approved template limits.',
      );
    return WhatsappJobPayloadSchema.parse({
      title: item.title,
      summary: item.summary,
      url: publicReadingLink(this.config.WHATSAPP_PUBLIC_ORIGIN, item.id),
      sourceHash: item.sourceHash,
      sourceVersion: item.version,
    });
  }
  enqueue(body: unknown, cookie?: string) {
    this.ready();
    const input = parse(WhatsappSendSchema, body);
    return this.userTransaction(cookie, async (c) => {
      const id = await this.owner(c, cookie),
        old = (
          await c.query(
            'SELECT user_id,item_id FROM whatsapp_outbox WHERE id=$1',
            [input.requestId],
          )
        ).rows[0];
      if (old) {
        if (old.user_id !== id || old.item_id !== input.itemId)
          throw new ConflictException('Delivery request ID already used.');
        return { id: input.requestId };
      }
      const row = (
        await c.query(
          'SELECT state FROM whatsapp_connections WHERE user_id=$1',
          [id],
        )
      ).rows[0];
      if (row?.state !== 'verified')
        throw new ConflictException(
          'Verify this recipient and channel consent first.',
        );
      const count = (
        await c.query(
          "SELECT count(*)::int AS count FROM whatsapp_outbox WHERE user_id=$1 AND origin='explicit' AND created_at>clock_timestamp()-interval '24 hours'",
          [id],
        )
      ).rows[0].count;
      if (count >= 10)
        throw new ConflictException('At most ten requested summaries per day.');
      const payload = await this.admitted(c, input.itemId);
      await this.account.require(c, cookie);
      await c.query(
        "INSERT INTO whatsapp_outbox(id,user_id,item_id,payload,state) VALUES($1,$2,$3,$4,'queued')",
        [
          input.requestId,
          id,
          input.itemId,
          sealPrivateJson(
            'whatsapp-channel',
            id,
            input.requestId,
            payload,
            this.account.privateDataKeys,
          ),
        ],
      );
      return { id: input.requestId };
    });
  }
  retry(raw: string, cookie?: string) {
    this.ready();
    const id = parse(z.uuid(), raw);
    return this.userTransaction(cookie, async (c) => {
      const owner = await this.owner(c, cookie);
      const row = (
        await c.query(
          'SELECT * FROM whatsapp_outbox WHERE id=$1 AND user_id=$2 FOR UPDATE',
          [id, owner],
        )
      ).rows[0];
      if (row?.dispatch_count >= 3)
        throw new ConflictException(
          'This delivery reached its three-attempt limit.',
        );
      if (!row || row.state !== 'failed')
        throw new ConflictException(
          'Only confirmed failed deliveries can be retried. Uncertain sends cannot be resent safely.',
        );
      const connection = (
        await c.query(
          'SELECT state FROM whatsapp_connections WHERE user_id=$1',
          [owner],
        )
      ).rows[0];
      if (connection?.state !== 'verified')
        throw new ConflictException('Channel consent is not active.');
      await this.admitted(c, row.item_id);
      await c.query(
        "UPDATE whatsapp_outbox SET state='queued',provider_id=NULL,detail='',updated_at=clock_timestamp() WHERE id=$1",
        [id],
      );
      return { id };
    });
  }
  schedule(cookie?: string) {
    return viewWhatsappSchedule(this.account, this.config, cookie);
  }
  changeSchedule(body: unknown, cookie?: string) {
    return writeWhatsappSchedule(this.account, this.config, body, cookie);
  }
  async tick() {
    this.ready();
    await prepareWhatsappOccurrence(this.account, this.config);
    const job = await this.account.transaction(async (c) => {
      await c.query(
        "UPDATE whatsapp_outbox SET state='uncertain',detail='Dispatch interrupted; no automatic resend.',updated_at=clock_timestamp() WHERE state='sending' AND updated_at<clock_timestamp()-interval '2 minutes'",
      );
      const row = (
        await c.query(
          "SELECT id,user_id FROM whatsapp_outbox WHERE state='queued' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!row) return null;
      await c.query(
        "UPDATE whatsapp_outbox SET state='sending',dispatch_count=dispatch_count+1,updated_at=clock_timestamp() WHERE id=$1",
        [row.id],
      );
      return row;
    });
    if (!job) return;
    try {
      await this.account.transaction(async (c) => {
        await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
          job.user_id,
        ]);
        const row = (
            await c.query(
              'SELECT * FROM whatsapp_outbox WHERE id=$1 FOR UPDATE',
              [job.id],
            )
          ).rows[0],
          connection = (
            await c.query(
              'SELECT * FROM whatsapp_connections WHERE user_id=$1',
              [job.user_id],
            )
          ).rows[0];
        if (!row || row.state !== 'sending') return;
        if (connection?.state !== 'verified') {
          await c.query(
            "UPDATE whatsapp_outbox SET state='cancelled',detail='Recipient consent unavailable.',updated_at=clock_timestamp() WHERE id=$1",
            [job.id],
          );
          return;
        }
        if (row.origin === 'scheduled') {
          const schedule = (
            await c.query(
              'SELECT state,version FROM whatsapp_schedules WHERE user_id=$1',
              [job.user_id],
            )
          ).rows[0];
          if (
            schedule?.state !== 'active' ||
            schedule.version !== row.schedule_version ||
            !row.source_expires_at ||
            row.source_expires_at.valueOf() <= Date.now()
          ) {
            await c.query(
              "UPDATE whatsapp_outbox SET state='cancelled',detail='Recurring schedule changed or source freshness expired.',updated_at=clock_timestamp() WHERE id=$1",
              [job.id],
            );
            return;
          }
        }
        const current = await this.admitted(c, row.item_id),
          saved = WhatsappJobPayloadSchema.parse(
            openPrivateJson(
              'whatsapp-channel',
              job.user_id,
              job.id,
              row.payload,
              this.account.privateDataKeys,
            ),
          );
        if (JSON.stringify(current) !== JSON.stringify(saved)) {
          await c.query(
            "UPDATE whatsapp_outbox SET state='cancelled',detail='Public source changed; request a new current summary.',updated_at=clock_timestamp() WHERE id=$1",
            [job.id],
          );
          return;
        }
        const recipient = WhatsappPrivateSchema.parse(
          openPrivateJson(
            'whatsapp-channel',
            job.user_id,
            'connection',
            connection.payload,
            this.account.privateDataKeys,
          ),
        );
        const response = await this.transport(
          `https://graph.facebook.com/${this.config.WHATSAPP_GRAPH_VERSION}/${this.config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
            headers: {
              Authorization: 'Bearer ' + this.config.WHATSAPP_ACCESS_TOKEN,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: recipient.phone,
              type: 'template',
              template: {
                name: this.config.WHATSAPP_TEMPLATE_NAME,
                language: { code: this.config.WHATSAPP_TEMPLATE_LANGUAGE },
                components: [
                  {
                    type: 'body',
                    parameters: [saved.title, saved.summary, saved.url].map(
                      (text) => ({ type: 'text', text }),
                    ),
                  },
                ],
              },
            }),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          await c.query(
            'UPDATE whatsapp_outbox SET state=$2,detail=$3,updated_at=clock_timestamp() WHERE id=$1',
            [
              job.id,
              response.status >= 400 && response.status < 500
                ? 'failed'
                : 'uncertain',
              response.status >= 400 && response.status < 500
                ? 'Provider rejected this request. Review configuration before retry.'
                : 'Provider outcome uncertain. No automatic resend.',
            ],
          );
          return;
        }
        const reader = response.body?.getReader();
        if (!reader) throw Error('Provider acknowledgment is empty.');
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 65536) {
              await reader.cancel();
              throw Error('Provider acknowledgment exceeds limit.');
            }
            chunks.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        const value = z
          .object({
            messages: z
              .array(z.object({ id: z.string().min(1).max(500) }))
              .min(1)
              .max(1),
          })
          .parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        await c.query(
          "UPDATE whatsapp_outbox SET state='accepted',provider_id=$2,detail='Accepted by provider; delivery not yet confirmed.',updated_at=clock_timestamp() WHERE id=$1",
          [job.id, value.messages[0]!.id],
        );
      });
    } catch {
      await this.account.transaction(async (c) => {
        await c.query(
          "UPDATE whatsapp_outbox SET state='uncertain',detail='Source admission or delivery outcome unavailable; no automatic resend.',updated_at=clock_timestamp() WHERE id=$1 AND state='sending'",
          [job.id],
        );
      });
    }
  }
  handshake(query: unknown) {
    this.ready();
    const v = parse(
      z.object({
        'hub.mode': z.literal('subscribe'),
        'hub.verify_token': z.string(),
        'hub.challenge': z.string().min(1).max(2000),
      }),
      query,
    );
    const received = Buffer.from(v['hub.verify_token']),
      expected = Buffer.from(this.config.WHATSAPP_VERIFY_TOKEN);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new UnauthorizedException('Webhook verification failed.');
    return v['hub.challenge'];
  }
  async webhook(raw: Buffer | undefined, signature?: string) {
    this.ready();
    if (
      !raw ||
      raw.length > 262144 ||
      !signature ||
      !/^sha256=[a-f0-9]{64}$/.test(signature)
    )
      throw new UnauthorizedException('Webhook signature required.');
    const expected = createHmac('sha256', this.config.WHATSAPP_APP_SECRET)
        .update(raw)
        .digest(),
      received = Buffer.from(signature.slice(7), 'hex');
    if (!timingSafeEqual(expected, received))
      throw new UnauthorizedException('Webhook signature invalid.');
    const message = z.object({
      from: z.string().regex(/^[1-9]\d{7,14}$/),
      id: z.string().min(1).max(500),
      timestamp: z.string().regex(/^\d+$/),
      type: z.string(),
      text: z.object({ body: z.string().max(4096) }).optional(),
    });
    const status = z.object({
      id: z.string().min(1).max(500),
      status: z.enum(['sent', 'delivered', 'read', 'failed']),
      timestamp: z.string().regex(/^\d+$/),
      recipient_id: z.string().regex(/^[1-9]\d{7,14}$/),
    });
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw.toString('utf8'));
    } catch (cause) {
      throw new BadRequestException('Invalid webhook JSON.', { cause });
    }
    const payload = parse(
      z.object({
        object: z.literal('whatsapp_business_account'),
        entry: z
          .array(
            z.object({
              id: z.string(),
              changes: z
                .array(
                  z.object({
                    field: z.literal('messages'),
                    value: z.object({
                      messaging_product: z.literal('whatsapp'),
                      metadata: z.object({
                        phone_number_id: z.string(),
                        display_phone_number: z.string().optional(),
                      }),
                      messages: z.array(message).max(100).optional(),
                      statuses: z.array(status).max(100).optional(),
                    }),
                  }),
                )
                .max(100),
            }),
          )
          .max(100),
      }),
      decoded,
    );
    for (const entry of payload.entry)
      for (const change of entry.changes) {
        const value = change.value;
        if (
          value.metadata.phone_number_id !==
          this.config.WHATSAPP_PHONE_NUMBER_ID
        )
          throw new UnauthorizedException('Webhook business number mismatch.');
        for (const event of [
          ...(value.messages ?? []).map((v) => ({
            kind: 'message' as const,
            value: v,
          })),
          ...(value.statuses ?? []).map((v) => ({
            kind: 'status' as const,
            value: v,
          })),
        ]) {
          const fingerprint = hash(JSON.stringify(event));
          await this.account.transaction(async (c) => {
            const phone =
                event.kind === 'message'
                  ? event.value.from
                  : event.value.recipient_id,
              connection = (
                await c.query(
                  'SELECT user_id FROM whatsapp_connections WHERE phone_hash=$1',
                  [this.phoneHash(phone)],
                )
              ).rows[0];
            if (!connection) return;
            const owner = await c.query(
              'SELECT id FROM app_users WHERE id=$1 FOR UPDATE',
              [connection.user_id],
            );
            if (!owner.rows.length) return;
            const exists = await c.query(
              'INSERT INTO whatsapp_webhook_receipts(hash,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING hash',
              [fingerprint, connection.user_id],
            );
            if (!exists.rows.length) return;
            const row = (
              await c.query(
                'SELECT * FROM whatsapp_connections WHERE user_id=$1 FOR UPDATE',
                [connection.user_id],
              )
            ).rows[0];
            if (!row || row.phone_hash !== this.phoneHash(phone)) return;
            if (event.kind === 'message') {
              const text =
                event.value.type === 'text'
                  ? event.value.text?.body.trim()
                  : '';
              if (text?.toUpperCase() === 'STOP') {
                await this.disable(c, row.user_id);
                return;
              }
              const match = /^VERIFY ([a-f0-9]{64})$/.exec(text ?? '');
              if (
                match &&
                row.state === 'pending' &&
                row.expires_at.valueOf() > Date.now() &&
                row.code_hash === hash(match[1]!)
              ) {
                const current = WhatsappPrivateSchema.parse(
                  openPrivateJson(
                    'whatsapp-channel',
                    row.user_id,
                    'connection',
                    row.payload,
                    this.account.privateDataKeys,
                  ),
                );
                await c.query(
                  "UPDATE whatsapp_connections SET state='verified',payload=$2,code_hash=NULL,expires_at=NULL,updated_at=clock_timestamp() WHERE user_id=$1",
                  [
                    row.user_id,
                    sealPrivateJson(
                      'whatsapp-channel',
                      row.user_id,
                      'connection',
                      { phone: current.phone, code: null },
                      this.account.privateDataKeys,
                    ),
                  ],
                );
              }
              return;
            }
            const job = (
              await c.query(
                'SELECT id,state FROM whatsapp_outbox WHERE user_id=$1 AND provider_id=$2 FOR UPDATE',
                [row.user_id, event.value.id],
              )
            ).rows[0];
            if (!job) return;
            await c.query(
              'UPDATE whatsapp_outbox SET state=$2,detail=$3,updated_at=clock_timestamp() WHERE id=$1',
              [
                job.id,
                whatsappAdvance(
                  WhatsappStatusSchema.parse(job.state),
                  event.value.status,
                ),
                'Provider status received: ' + event.value.status,
              ],
            );
          });
        }
      }
    return { received: true };
  }
}
export const whatsappProvider = (config: AppConfig) => ({
  provide: WHATSAPP_STORE,
  inject: [STORE],
  useFactory: (account: AccountStore) => new WhatsappStore(account, config),
});
@Controller('account/whatsapp')
export class WhatsappAccountController {
  constructor(
    @Inject(WHATSAPP_STORE) private readonly channel: WhatsappStore,
    @Inject(STORE) private readonly account: AccountStore,
  ) {}
  @Get('schedule') schedule(@Headers('cookie') cookie?: string) {
    return this.channel.schedule(cookie);
  }
  @Post('schedule') changeSchedule(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.account.origin(origin);
    return this.channel.changeSchedule(body, cookie);
  }
  @Get('choices') choices(
    @Query('after') after: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    return this.channel.choices(after, cookie);
  }
  @Get() view(@Headers('cookie') cookie?: string) {
    return this.channel.view(cookie);
  }
  @Post('verify') start(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.account.origin(origin);
    return this.channel.start(body, cookie);
  }
  @Post('deliveries') send(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.account.origin(origin);
    return this.channel.enqueue(body, cookie);
  }
  @Post('deliveries/:id/retry') retry(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.account.origin(origin);
    return this.channel.retry(id, cookie);
  }
  @Delete() stop(
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.account.origin(origin);
    return this.channel.stop(cookie);
  }
}
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  constructor(
    @Inject(WHATSAPP_STORE) private readonly channel: WhatsappStore,
  ) {}
  @Get() handshake(
    @Query() query: unknown,
    @Res() res: { type(value: string): { send(value: string): unknown } },
  ) {
    res.type('text/plain').send(this.channel.handshake(query));
  }
  @Post() @HttpCode(200) receive(
    @Req() req: { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    return this.channel.webhook(req.rawBody, signature);
  }
}
