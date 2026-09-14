import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Body,
  Query,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  ReadingFollowConfigSchema,
  ReadingFollowItemSchema,
  ReadingFollowWriteSchema,
  ReadingFollowCheckSchema,
  ReadingFollowAckSchema,
  ReadingFollowReceiptSchema,
  ReadingFollowViewSchema,
  readingFollowPublications,
  ReadingFollowExportSchema,
  ReadingFollowPageSchema,
  ReadingFollowExportQuerySchema,
  DiscoveryIdSchema,
  emptyReadingFollow,
  evaluateReadingFollow,
  readingFollowAckReceipt,
  sourceIdFor,
  type ReadingFollowConfig,
  type ReadingFollowEvent,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { admitPublications } from './publication.js';
import { researchSources } from './research-providers.js';
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const value = schema.safeParse(input);
  if (!value.success)
    throw new BadRequestException(
      'Invalid reading update request. Reload and review your choices.',
    );
  return value.data;
}
async function config(c: pg.PoolClient, id: string) {
  const r = await c.query(
    'SELECT payload FROM reading_follow_configs WHERE user_id=$1',
    [id],
  );
  return r.rows[0]
    ? ReadingFollowConfigSchema.parse(r.rows[0].payload)
    : emptyReadingFollow();
}
async function event(
  c: pg.PoolClient,
  id: string,
  record: ReadingFollowEvent['record'],
  requestId?: string,
) {
  await c.query(
    'INSERT INTO reading_follow_events(user_id,request_id,payload) VALUES($1,$2,$3)',
    [id, requestId ?? null, record],
  );
}
export async function exportReadingFollow(
  c: pg.PoolClient,
  id: string,
  input: unknown = {},
) {
  const q = parse(ReadingFollowExportQuerySchema, input);
  const upper =
    q.upper ??
    (
      await c.query(
        'SELECT coalesce(max(sequence),0)::text AS upper FROM reading_follow_events WHERE user_id=$1',
        [id],
      )
    ).rows[0].upper;
  const rows = (
    await c.query(
      'SELECT sequence::text,payload FROM reading_follow_events WHERE user_id=$1 AND sequence>$2::bigint AND sequence<=$3::bigint ORDER BY reading_follow_events.sequence LIMIT 101',
      [id, q.after ?? '0', upper],
    )
  ).rows;
  return ReadingFollowExportSchema.parse({
    ownerId: id,
    upper,
    events: rows
      .slice(0, 100)
      .map((r) => ({ sequence: r.sequence, record: r.payload })),
    next: rows.length > 100 ? rows[99].sequence : null,
  });
}
@Controller('account/reading-follow')
export class ReadingFollowController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  private async locked(c: pg.PoolClient, cookie?: string) {
    const user = await this.store.require(c, cookie);
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
    await this.store.require(c, cookie);
    return user;
  }
  @Get() async current(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    const q = parse(ReadingFollowPageSchema, query);
    return this.store.transaction(async (c) => {
      const user = await this.locked(c, cookie);
      const value = await config(c, user.id);
      const found = (
        await c.query(
          "SELECT payload FROM reading_follow_items WHERE user_id=$1 AND item_id>$2 AND payload->>'status'<>'baseline' ORDER BY item_id LIMIT 101",
          [user.id, q.after ?? ''],
        )
      ).rows;
      const items = found
        .slice(0, 100)
        .map((r) => ReadingFollowItemSchema.parse(r.payload));
      const current = await admitPublications(
        c,
        items.map((i) => i.itemId),
      );
      await this.store.require(c, cookie);
      return ReadingFollowViewSchema.parse({
        config: value,
        items,
        next: found.length > 100 ? items.at(-1)!.itemId : null,
        observedAt: new Date().toISOString(),
        bundleGeneratedAt: null,
        availableIds: current
          .filter((i) => i.status === 'published')
          .map((i) => i.id),
        publishedReading: readingFollowPublications(
          current,
          items.map((item) => item.itemId),
        ),
      });
    });
  }
  @Get('export') export(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.transaction(async (c) => {
      const user = await this.locked(c, cookie);
      return exportReadingFollow(c, user.id, query);
    });
  }
  @Put() save(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    return this.apply('settings', body, cookie);
  }
  @Post('check') check(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    return this.apply('check', body, cookie);
  }
  private async apply(
    kind: 'settings' | 'check',
    body: unknown,
    cookie?: string,
  ) {
    const input =
      kind === 'settings'
        ? parse(ReadingFollowWriteSchema, body)
        : parse(ReadingFollowCheckSchema, body);
    const fingerprint = JSON.stringify({ kind, input });
    return this.store.transaction(async (c) => {
      await c.query("SET LOCAL statement_timeout='3s'");
      const deadline = Date.now() + 10000,
        startedAt = new Date().toISOString();
      const user = await this.locked(c, cookie);
      const prior = (
        await c.query(
          'SELECT payload FROM reading_follow_events WHERE user_id=$1 AND request_id=$2',
          [user.id, input.requestId],
        )
      ).rows[0];
      if (prior) {
        if (prior.payload.fingerprint !== fingerprint)
          throw new ConflictException(
            'Request ID already used for different choices.',
          );
        return ReadingFollowReceiptSchema.parse(prior.payload.receipt);
      }
      const old = await config(c, user.id);
      if (old.version !== input.expectedVersion)
        throw new ConflictException(
          'Subscriptions changed. Discard the stale review and reload.',
        );
      let next: ReadingFollowConfig = old;
      if (kind === 'settings') {
        const write = parse(ReadingFollowWriteSchema, body);
        if (write.sources.some((s) => !researchSources.some((r) => r.id === s)))
          throw new BadRequestException('Choose a known catalogue source.');
        next = {
          sources: [...write.sources].sort(),
          topics: [...write.topics].sort(),
          muted: write.muted,
          version: old.version + 1,
          savedAt: startedAt,
        };
        if (
          JSON.stringify({
            ...next,
            version: old.version,
            savedAt: old.savedAt,
          }) === JSON.stringify(old)
        )
          throw new ConflictException('No subscription changes to save.');
      } else if (old.version === 0 || old.muted)
        throw new ConflictException(
          'Save active subscriptions before checking.',
        );
      const upper = (
        await c.query(
          'SELECT max(id) AS id FROM (SELECT id FROM discovery_items UNION SELECT item_id FROM reading_follow_items WHERE user_id=$1) candidates',
          [user.id],
        )
      ).rows[0].id;
      let after = '',
        examined = 0,
        changed = 0;
      const knownTopics = new Set<string>();
      while (upper) {
        if (Date.now() > deadline)
          throw new ServiceUnavailableException(
            'The complete check exceeded its deadline. Nothing changed; retry.',
          );
        const ids = (
          await c.query(
            'SELECT id FROM (SELECT id FROM discovery_items UNION SELECT item_id FROM reading_follow_items WHERE user_id=$1) candidates WHERE id>$2 AND id<=$3 ORDER BY id LIMIT 200',
            [user.id, after, upper],
          )
        ).rows.map((r) => String(r.id));
        if (!ids.length) break;
        const editions = await admitPublications(c, ids);
        await this.store.require(c, cookie);
        const previous = (
          await c.query(
            'SELECT item_id,payload FROM reading_follow_items WHERE user_id=$1 AND item_id=ANY($2::text[])',
            [user.id, ids],
          )
        ).rows;
        for (const id of ids) {
          if (Date.now() > deadline)
            throw new ServiceUnavailableException(
              'Complete check timed out; nothing changed. Retry.',
            );
          const item = editions.find((i) => i.id === id) ?? null;
          if (item?.status === 'published')
            item.topics
              .filter((t) => next.topics.includes(t))
              .forEach((t) => knownTopics.add(t));
          const priorItem = previous.find((r) => r.item_id === id);
          const value = evaluateReadingFollow(
            priorItem ? ReadingFollowItemSchema.parse(priorItem.payload) : null,
            item,
            item ? sourceIdFor(item) : '',
            next,
            new Date().toISOString(),
            kind === 'settings',
            old,
          );
          examined++;
          if (value) {
            changed++;
            await c.query(
              'INSERT INTO reading_follow_items(user_id,item_id,payload) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET payload=excluded.payload',
              [user.id, id, value],
            );
            await event(c, user.id, { kind: 'item', item: value });
          }
        }
        after = ids.at(-1)!;
      }
      if (
        kind === 'settings' &&
        next.topics.some(
          (topic) => !knownTopics.has(topic) && !old.topics.includes(topic),
        )
      )
        throw new BadRequestException(
          'A selected topic is no longer available. Reload catalogue choices.',
        );
      if (Date.now() > deadline)
        throw new ServiceUnavailableException(
          'The complete check exceeded its deadline. Nothing changed; retry.',
        );
      await this.store.require(c, cookie);
      if (kind === 'settings') {
        await c.query(
          'INSERT INTO reading_follow_configs(user_id,payload) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload',
          [user.id, next],
        );
        await event(c, user.id, { kind: 'config', config: next });
      }
      const receipt = ReadingFollowReceiptSchema.parse({
        requestId: input.requestId,
        kind,
        configVersion: next.version,
        startedAt,
        completedAt: new Date().toISOString(),
        bundleGeneratedAt: null,
        examined,
        changed,
      });
      await event(
        c,
        user.id,
        { kind: 'operation', fingerprint, receipt },
        input.requestId,
      );
      return receipt;
    });
  }
  @Post('notices/:id/acknowledge') ack(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    parse(DiscoveryIdSchema, id);
    const input = parse(ReadingFollowAckSchema, body),
      fingerprint = JSON.stringify({ kind: 'acknowledge', id, input });
    return this.store.transaction(async (c) => {
      const user = await this.locked(c, cookie);
      const previous = (
        await c.query(
          'SELECT payload FROM reading_follow_events WHERE user_id=$1 AND request_id=$2',
          [user.id, input.requestId],
        )
      ).rows[0];
      if (previous) {
        if (previous.payload.fingerprint !== fingerprint)
          throw new ConflictException('Request ID already used.');
        return ReadingFollowReceiptSchema.parse(previous.payload.receipt);
      }
      const row = (
        await c.query(
          'SELECT payload FROM reading_follow_items WHERE user_id=$1 AND item_id=$2',
          [user.id, id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Notice unavailable.');
      const old = ReadingFollowItemSchema.parse(row.payload);
      if (old.version !== input.expectedVersion || old.status !== 'open')
        throw new ConflictException(
          'Notice changed. Reload before acknowledging.',
        );
      const item = ReadingFollowItemSchema.parse({
        ...old,
        version: old.version + 1,
        status: 'acknowledged',
      });
      await c.query(
        'UPDATE reading_follow_items SET payload=$3 WHERE user_id=$1 AND item_id=$2',
        [user.id, id, item],
      );
      await event(c, user.id, { kind: 'item', item });
      const at = new Date().toISOString();
      const receipt = readingFollowAckReceipt(
        old,
        input.requestId,
        at,
        at,
        null,
      );
      await this.store.require(c, cookie);
      await event(
        c,
        user.id,
        { kind: 'operation', fingerprint, receipt },
        input.requestId,
      );
      return receipt;
    });
  }
}
