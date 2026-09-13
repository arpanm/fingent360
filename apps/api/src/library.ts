import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Query,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  ResearchFiltersSchema,
  filterResearchItems,
  selectToday,
  FeedRankingSchema,
  FeedItemSchema,
  LibrarySchema,
  LibraryItemIdSchema,
  LibrarySaveInputSchema,
  LibraryReactionInputSchema,
  LibraryPositionInputSchema,
  LibraryPreferencesSchema,
  LibraryReminderInputSchema,
  LibraryReminderUpdateSchema,
  LibraryReminderCancelSchema,
  LibraryReminderSchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
const empty = z.strictObject({});
const FeedCursorPayloadSchema = z.strictObject({
  policyVersion: z.literal('explicit-v1'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  offset: z.number().int().positive().max(1000000),
});
export function decodeLibraryFeedCursor(cursor: string) {
  try {
    if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw new Error();
    const bytes = Buffer.from(cursor, 'base64url');
    if (bytes.toString('base64url') !== cursor) throw new Error();
    return FeedCursorPayloadSchema.parse(JSON.parse(bytes.toString('utf8')));
  } catch {
    throw new BadRequestException('Invalid feed cursor. Refresh the feed.');
  }
}
export function libraryFeedPage<T>(
  ordered: T[],
  fingerprint: string,
  cursor?: string,
) {
  const decoded = cursor === undefined ? null : decodeLibraryFeedCursor(cursor);
  if (decoded && decoded.fingerprint !== fingerprint)
    throw new ConflictException('Feed changed. Refresh from the first page.');
  const offset = decoded?.offset ?? 0;
  if (offset > ordered.length || offset % 20 !== 0)
    throw new BadRequestException('Invalid feed cursor. Refresh the feed.');
  return {
    items: ordered.slice(offset, offset + 20),
    nextCursor:
      offset + 20 < ordered.length
        ? Buffer.from(
            JSON.stringify({
              policyVersion: 'explicit-v1',
              fingerprint,
              offset: offset + 20,
            }),
          ).toString('base64url')
        : null,
  };
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((issue) => issue.message).join('; '),
    );
  return result.data;
}
interface ReminderRow {
  id: string;
  item_id: string;
  title: string;
  due_at: Date;
  time_zone: string;
  status: string;
  version: number;
  request: unknown;
}
function reminder(row: ReminderRow) {
  return LibraryReminderSchema.parse({
    id: row.id,
    itemId: row.item_id,
    title: row.title,
    dueAt: row.due_at.toISOString(),
    timeZone: row.time_zone,
    status: row.status,
    version: row.version,
  });
}
async function item(client: pg.PoolClient, id: string, version?: number) {
  parse(LibraryItemIdSchema, id);
  const rows = await client.query<{ data: unknown }>(
    "SELECT data FROM (SELECT data FROM discovery_versions WHERE item_id=$1 AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1) visible WHERE data->>'status'='published'",
    [id],
  );
  if (!rows.rows[0])
    throw new NotFoundException('This item is no longer available.');
  const found = FeedItemSchema.parse(rows.rows[0].data);
  if (version !== undefined && found.version !== version)
    throw new ConflictException(
      'This item has changed. Open its latest version before saving your progress.',
    );
  return found;
}
function due(value: string) {
  const time = Date.parse(value);
  if (time <= Date.now() || time > Date.now() + 366 * 86400000)
    throw new BadRequestException(
      'Choose a future reminder within the next year.',
    );
}
export async function readLibrary(client: pg.PoolClient, userId: string) {
  const saved = await client.query<{
    item_id: string;
    item_version: number;
    snapshot: { title: string; summary: string; sourceUrl: string };
    saved_at: Date;
    current_status: string | null;
    current_version: number | null;
  }>(
    "SELECT s.*,v.data->>'status' AS current_status,v.version AS current_version FROM library_saved s LEFT JOIN LATERAL (SELECT data,version FROM discovery_versions WHERE item_id=s.item_id AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1) v ON true WHERE s.user_id=$1 ORDER BY s.saved_at DESC,s.item_id",
    [userId],
  );
  const reactions = await client.query<{ item_id: string; reaction: string }>(
    'SELECT item_id,reaction FROM library_reactions WHERE user_id=$1 ORDER BY item_id',
    [userId],
  );
  const positions = await client.query<{
    item_id: string;
    item_version: number;
    percent: number;
    updated_at: Date;
  }>('SELECT * FROM library_positions WHERE user_id=$1 ORDER BY item_id', [
    userId,
  ]);
  const preferences = await client.query<{ data: unknown }>(
    'SELECT data FROM library_preferences WHERE user_id=$1',
    [userId],
  );
  const reminders = await client.query<ReminderRow>(
    'SELECT * FROM library_reminders WHERE user_id=$1 ORDER BY due_at DESC,id',
    [userId],
  );
  const notifications = await client.query<{
    id: string;
    reminder_id: string;
    item_id: string;
    title: string;
    delivered_at: Date;
    read_at: Date | null;
  }>(
    'SELECT * FROM library_notifications WHERE user_id=$1 ORDER BY delivered_at DESC,id',
    [userId],
  );
  return LibrarySchema.parse({
    saved: saved.rows.map((row) => ({
      itemId: row.item_id,
      version: row.item_version,
      ...row.snapshot,
      savedAt: row.saved_at.toISOString(),
      currentStatus: row.current_status ?? 'unavailable',
      currentVersion: row.current_version,
    })),
    reactions: reactions.rows.map((row) => ({
      itemId: row.item_id,
      reaction: row.reaction,
    })),
    positions: positions.rows.map((row) => ({
      itemId: row.item_id,
      version: row.item_version,
      percent: row.percent,
      updatedAt: row.updated_at.toISOString(),
    })),
    preferences: preferences.rows[0]?.data ?? {
      topics: [],
      mutedTopics: [],
      mode: 'chronological',
    },
    reminders: reminders.rows.map(reminder),
    notifications: notifications.rows.map((row) => ({
      id: row.id,
      reminderId: row.reminder_id,
      itemId: row.item_id,
      title: row.title,
      deliveredAt: row.delivered_at.toISOString(),
      readAt: row.read_at?.toISOString() ?? null,
    })),
  });
}
@Controller('account/library')
export class LibraryController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get('feed') feed(
    @Headers('cookie') cookie?: string,
    @Query('cursor') cursor?: string,
    @Query('q') query?: string,
    @Query('kind') kind?: string,
    @Query('source') source?: string,
    @Query('topic') topic?: string,
    @Query('region') region?: string,
    @Query('view') view?: string,
  ) {
    if (cursor !== undefined) decodeLibraryFeedCursor(cursor);
    const filters = parse(ResearchFiltersSchema, {
      q: query ?? '',
      ...(kind === undefined ? {} : { kind }),
      ...(source === undefined ? {} : { source }),
      ...(topic === undefined ? {} : { topic }),
      ...(region === undefined ? {} : { region }),
      ...(view === undefined ? {} : { view }),
    });
    return this.store.transaction(async (c) => {
      await c.query(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const user = await this.store.require(c, cookie);
      const library = await readLibrary(c, user.id);
      const rows = await c.query<{ data: unknown }>(
        "SELECT data FROM (SELECT DISTINCT ON(item_id) data FROM discovery_versions WHERE data->>'status'<>'draft' ORDER BY item_id,version DESC) visible WHERE data->>'status'='published'",
      );
      const items = filterResearchItems(
        rows.rows
          .map((row) => FeedItemSchema.parse(row.data))
          .filter(
            (value) =>
              !value.topics.some((topic) =>
                library.preferences.mutedTopics.includes(topic),
              ),
          ),
        filters,
      );
      const whyShown: Record<string, string> = {};
      const ranked = items
        .map((value) => {
          const followed = value.topics.filter((topic) =>
            library.preferences.topics.includes(topic),
          );
          const reaction = library.reactions.find(
            (entry) => entry.itemId === value.id,
          )?.reaction;
          const similar = items.filter(
            (other) =>
              other.id !== value.id &&
              other.topics.some((topic) => value.topics.includes(topic)),
          );
          const similarMore = similar.some((other) =>
            library.reactions.some(
              (entry) => entry.itemId === other.id && entry.reaction === 'more',
            ),
          );
          const similarLess = similar.some((other) =>
            library.reactions.some(
              (entry) => entry.itemId === other.id && entry.reaction === 'less',
            ),
          );
          const similarSaved = similar.some((other) =>
            library.saved.some((entry) => entry.itemId === other.id),
          );
          const score =
            followed.length * 3 +
            (reaction === 'more' ? 5 : reaction === 'less' ? -10 : 0) +
            (library.saved.some((entry) => entry.itemId === value.id) ? 1 : 0) +
            (similarMore ? 2 : 0) -
            (similarLess ? 3 : 0) +
            (similarSaved ? 1 : 0);
          whyShown[value.id] =
            library.preferences.mode === 'chronological'
              ? 'Newest published items first. Your reactions do not change this order.'
              : reaction === 'less'
                ? 'Shown lower because you asked for less like this.'
                : reaction === 'more'
                  ? 'You asked for more like this.'
                  : followed.length
                    ? `Matches topics you follow: ${followed.join(', ')}.`
                    : similarLess
                      ? 'Shown lower because you asked for less on a related topic.'
                      : similarMore
                        ? 'Related to a topic you asked to see more of.'
                        : similarSaved
                          ? 'Related to a topic you saved.'
                          : library.saved.some(
                                (entry) => entry.itemId === value.id,
                              )
                            ? 'You saved this item.'
                            : 'A recent published item to broaden your reading.';
          return { value, score };
        })
        .sort(
          (a, b) =>
            (library.preferences.mode === 'for_you' ? b.score - a.score : 0) ||
            b.value.publishedAt.localeCompare(a.value.publishedAt) ||
            a.value.id.localeCompare(b.value.id),
        );
      // Keep neighboring sources diverse without hiding lower-ranked topics.
      if (library.preferences.mode === 'for_you')
        for (let index = 2; index < ranked.length; index++) {
          if (
            ranked[index]?.value.source.name ===
              ranked[index - 1]?.value.source.name &&
            ranked[index]?.value.source.name ===
              ranked[index - 2]?.value.source.name
          ) {
            const alternative = ranked.findIndex(
              (entry, position) =>
                position > index &&
                entry.value.source.name !== ranked[index]!.value.source.name,
            );
            if (alternative > index) {
              const [entry] = ranked.splice(alternative, 1);
              ranked.splice(index, 0, entry!);
              whyShown[entry!.value.id] += ' Included here for source variety.';
            }
          }
        }
      const ordered =
        filters.view === 'today'
          ? selectToday(ranked.map((entry) => entry.value))
          : ranked.map((entry) => entry.value);
      if (filters.view === 'today')
        for (const item of ordered)
          whyShown[item.id] +=
            ' Selected for Today’s source-balanced digest; Explore contains the full collection.';
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            userId: user.id,
            policyVersion: 'explicit-v1',
            filters,
            preferences: library.preferences,
            reactions: library.reactions,
            saved: library.saved.map((value) => ({
              itemId: value.itemId,
              version: value.version,
            })),
            order: ordered.map((entry) => ({
              id: entry.id,
              version: entry.version,
              reason: whyShown[entry.id],
            })),
          }),
        )
        .digest('hex');
      const page = libraryFeedPage(ordered, fingerprint, cursor);
      return FeedRankingSchema.parse({
        items: page.items,
        evaluatedAt: new Date().toISOString(),
        nextCursor: page.nextCursor,
        whyShown: Object.fromEntries(
          page.items.map((value) => [value.id, whyShown[value.id]]),
        ),
        policyVersion: 'explicit-v1',
      });
    });
  }
  @Get() get(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      await c.query(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const user = await this.store.require(c, cookie);
      return readLibrary(c, user.id);
    });
  }
  private change(
    cookie: string | undefined,
    origin: string | undefined,
    work: (c: pg.PoolClient, id: string) => Promise<unknown>,
  ) {
    this.store.origin(origin);
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      return work(c, user.id);
    });
  }
  @Put('items/:id/save') save(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    const input = parse(LibrarySaveInputSchema, body);
    return this.change(cookie, origin, async (c, user) => {
      const found = await item(c, id, input.version);
      await c.query(
        'INSERT INTO library_saved(user_id,item_id,item_version,snapshot) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,item_id) DO NOTHING',
        [
          user,
          id,
          found.version,
          {
            title: found.title,
            summary: found.summary,
            sourceUrl: found.source.url,
          },
        ],
      );
      return { ok: true };
    });
  }
  @Delete('items/:id/save') unsave(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    parse(LibraryItemIdSchema, id);
    return this.change(cookie, origin, async (c, user) => {
      await c.query(
        'DELETE FROM library_saved WHERE user_id=$1 AND item_id=$2',
        [user, id],
      );
      return { ok: true };
    });
  }
  @Put('items/:id/reaction') react(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    const input = parse(LibraryReactionInputSchema, body);
    return this.change(cookie, origin, async (c, user) => {
      await item(c, id);
      await c.query(
        'INSERT INTO library_reactions(user_id,item_id,reaction) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET reaction=excluded.reaction',
        [user, id, input.reaction],
      );
      return { ok: true };
    });
  }
  @Delete('items/:id/reaction') unreact(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    parse(LibraryItemIdSchema, id);
    return this.change(cookie, origin, async (c, user) => {
      await c.query(
        'DELETE FROM library_reactions WHERE user_id=$1 AND item_id=$2',
        [user, id],
      );
      return { ok: true };
    });
  }
  @Put('items/:id/position') position(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    const input = parse(LibraryPositionInputSchema, body);
    return this.change(cookie, origin, async (c, user) => {
      await item(c, id, input.version);
      await c.query(
        'INSERT INTO library_positions(user_id,item_id,item_version,percent) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,item_id) DO UPDATE SET item_version=excluded.item_version,percent=excluded.percent,updated_at=now()',
        [user, id, input.version, input.percent],
      );
      return { ok: true };
    });
  }
  @Put('preferences') preferences(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    const input = parse(LibraryPreferencesSchema, body);
    return this.change(cookie, origin, async (c, user) => {
      await c.query(
        'INSERT INTO library_preferences(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data',
        [user, input],
      );
      return input;
    });
  }
  @Post('preferences/reset') @HttpCode(200) reset(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    parse(empty, body);
    return this.change(cookie, origin, async (c, user) => {
      await c.query('DELETE FROM library_preferences WHERE user_id=$1', [user]);
      await c.query('DELETE FROM library_reactions WHERE user_id=$1', [user]);
      await c.query('DELETE FROM library_positions WHERE user_id=$1', [user]);
      return { ok: true };
    });
  }
  @Post('reminders') createReminder(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    const input = parse(LibraryReminderInputSchema, body);
    return this.change(cookie, origin, async (c, user) => {
      const existing = await c.query<ReminderRow>(
        'SELECT * FROM library_reminders WHERE user_id=$1 AND idempotency_key=$2',
        [user, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        const previous = parse(
          LibraryReminderInputSchema,
          existing.rows[0].request,
        );
        if (JSON.stringify(previous) !== JSON.stringify(input))
          throw new ConflictException(
            'This reminder request key was used for different details.',
          );
        return reminder(existing.rows[0]);
      }
      due(input.dueAt);
      const found = await item(c, input.itemId);
      const result = await c.query<ReminderRow>(
        'INSERT INTO library_reminders(id,user_id,item_id,title,due_at,time_zone,idempotency_key,request) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [
          randomUUID(),
          user,
          input.itemId,
          found.title,
          input.dueAt,
          input.timeZone,
          input.idempotencyKey,
          input,
        ],
      );
      return reminder(result.rows[0]!);
    });
  }
  @Patch('reminders/:id') updateReminder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    parse(z.uuid(), id);
    const input = parse(LibraryReminderUpdateSchema, body);
    due(input.dueAt);
    return this.change(cookie, origin, async (c, user) => {
      const result = await c.query<ReminderRow>(
        "UPDATE library_reminders SET due_at=$3,time_zone=$4,version=version+1 WHERE id=$1 AND user_id=$2 AND version=$5 AND status='pending' RETURNING *",
        [id, user, input.dueAt, input.timeZone, input.expectedVersion],
      );
      if (!result.rows[0])
        throw new ConflictException(
          'Reminder unavailable or changed. Reload before editing.',
        );
      return reminder(result.rows[0]);
    });
  }
  @Delete('reminders/:id') cancelReminder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    parse(z.uuid(), id);
    const input = parse(LibraryReminderCancelSchema, body);
    return this.change(cookie, origin, async (c, user) => {
      const result = await c.query<ReminderRow>(
        "UPDATE library_reminders SET status='cancelled',version=version+1 WHERE id=$1 AND user_id=$2 AND version=$3 AND status='pending' RETURNING *",
        [id, user, input.expectedVersion],
      );
      if (!result.rows[0])
        throw new ConflictException(
          'Reminder unavailable or already delivered. Reload its status.',
        );
      return reminder(result.rows[0]);
    });
  }
  @Put('notifications/:id/read') markRead(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    parse(z.uuid(), id);
    parse(empty, body);
    return this.change(cookie, origin, async (c, user) => {
      const result = await c.query(
        'UPDATE library_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',
        [id, user],
      );
      if (!result.rowCount)
        throw new NotFoundException('Notification not found.');
      return { ok: true };
    });
  }
}
