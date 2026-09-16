import { randomUUID, createHash } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type pg from 'pg';
import {
  WhatsappScheduleWriteSchema,
  WhatsappScheduleSchema,
  WhatsappScheduleViewSchema,
  WhatsappOccurrenceSchema,
  nextWhatsappDue,
  sourceIdFor,
  WhatsappJobPayloadSchema,
  publicReadingLink,
} from '@fingent360/contracts';
import type { AccountStore } from './accounts.js';
import type { AppConfig } from './config.js';
import {
  openPrivateJson,
  sealPrivateJson,
  type PrivateDataKeys,
} from './private-data-crypto.js';
import { admitPublications } from './publication.js';
function authenticated<T>(
  account: AccountStore,
  cookie: string | undefined,
  work: (c: pg.PoolClient) => Promise<T>,
) {
  return account.transaction(async (c) => {
    const value = await work(c);
    await account.require(c, cookie);
    return value;
  });
}
const sources = (config: AppConfig) => [
  ...new Set(
    config.WHATSAPP_ALLOWED_SOURCE_IDS.split(',')
      .map((v) => v.trim())
      .filter((v) =>
        [
          'glossary',
          'fed',
          'pib',
          'bea',
          'ecb-statistics',
          'ecb-press',
          'world-bank',
          'bea-gdp-original',
        ].includes(v),
      ),
  ),
];
const seal = (
  owner: string,
  id: string,
  value: unknown,
  keys: PrivateDataKeys,
) => sealPrivateJson('whatsapp-channel', owner, 'schedule:' + id, value, keys);
const open = (
  owner: string,
  id: string,
  value: unknown,
  keys: PrivateDataKeys,
) => openPrivateJson('whatsapp-channel', owner, 'schedule:' + id, value, keys);
const decode = (
  row: { user_id: string; payload: unknown },
  keys: PrivateDataKeys,
) => WhatsappScheduleSchema.parse(open(row.user_id, 'head', row.payload, keys));
async function owned(c: pg.PoolClient, account: AccountStore, cookie?: string) {
  const user = await account.require(c, cookie);
  await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
  await account.require(c, cookie);
  return user.id;
}
export async function pauseWhatsappSchedule(
  c: pg.PoolClient,
  owner: string,
  keys: PrivateDataKeys,
) {
  const row = (
    await c.query(
      'SELECT * FROM whatsapp_schedules WHERE user_id=$1 FOR UPDATE',
      [owner],
    )
  ).rows[0];
  if (row?.state === 'active') {
    const prior = decode(row, keys),
      value = {
        ...prior,
        version: prior.version + 1,
        state: 'paused' as const,
        nextDueAt: null,
        savedAt: new Date().toISOString(),
      };
    await c.query(
      "UPDATE whatsapp_schedules SET state='paused',version=$2,next_due_at=NULL,payload=$3 WHERE user_id=$1",
      [owner, value.version, seal(owner, 'head', value, keys)],
    );
    await c.query(
      'INSERT INTO whatsapp_schedule_versions(user_id,version,payload) VALUES($1,$2,$3)',
      [
        owner,
        value.version,
        seal(owner, 'version:' + value.version, value, keys),
      ],
    );
  }
  await c.query(
    "UPDATE whatsapp_outbox SET state='cancelled',detail='Recurring consent paused.',updated_at=clock_timestamp() WHERE user_id=$1 AND origin='scheduled' AND state='queued'",
    [owner],
  );
}
export function viewWhatsappSchedule(
  account: AccountStore,
  config: AppConfig,
  cookie?: string,
) {
  return authenticated(account, cookie, async (c) => {
    const owner = await owned(c, account, cookie),
      row = (
        await c.query('SELECT * FROM whatsapp_schedules WHERE user_id=$1', [
          owner,
        ])
      ).rows[0],
      occurrences = (
        await c.query(
          'SELECT * FROM whatsapp_schedule_occurrences WHERE user_id=$1 ORDER BY recorded_at DESC,id LIMIT 100',
          [owner],
        )
      ).rows;
    return WhatsappScheduleViewSchema.parse({
      schedule: row ? decode(row, account.privateDataKeys) : null,
      occurrences: occurrences.map((r) =>
        WhatsappOccurrenceSchema.parse(
          open(owner, 'occurrence:' + r.id, r.payload, account.privateDataKeys),
        ),
      ),
      availableSources: [...new Set(sources(config))],
    });
  });
}
export function writeWhatsappSchedule(
  account: AccountStore,
  config: AppConfig,
  raw: unknown,
  cookie?: string,
) {
  const parsed = WhatsappScheduleWriteSchema.safeParse(raw);
  if (!parsed.success)
    throw new BadRequestException(
      'Review schedule fields and explicitly confirm recurring consent.',
    );
  const input = parsed.data,
    inputHash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
  return authenticated(account, cookie, async (c) => {
    const owner = await owned(c, account, cookie),
      replay = (
        await c.query(
          'SELECT * FROM whatsapp_schedule_requests WHERE user_id=$1 AND id=$2',
          [owner, input.requestId],
        )
      ).rows[0];
    if (replay) {
      if (replay.input_hash !== inputHash)
        throw new ConflictException(
          'Schedule request ID was used for different input.',
        );
      return WhatsappScheduleSchema.parse(
        open(
          owner,
          'request:' + input.requestId,
          replay.payload,
          account.privateDataKeys,
        ),
      );
    }
    const row = (
        await c.query(
          'SELECT * FROM whatsapp_schedules WHERE user_id=$1 FOR UPDATE',
          [owner],
        )
      ).rows[0],
      prior = row ? decode(row, account.privateDataKeys) : null;
    if ((prior?.version ?? 0) !== input.expectedVersion)
      throw new ConflictException('Schedule changed. Refresh before saving.');
    if (
      (input.action !== 'save' && !prior) ||
      (input.action === 'resume' && prior?.state !== 'paused') ||
      (input.action === 'pause' && prior?.state !== 'active') ||
      (input.action === 'delete' && prior?.state === 'deleted')
    )
      throw new ConflictException('Schedule action unavailable.');
    if (input.action === 'save' || input.action === 'resume') {
      const changes = (
        await c.query(
          "SELECT count(*)::int AS count FROM whatsapp_schedule_versions WHERE user_id=$1 AND created_at>clock_timestamp()-interval '24 hours'",
          [owner],
        )
      ).rows[0].count;
      if (changes >= 20)
        throw new ConflictException(
          'At most twenty schedule changes per day; pause and delete remain available.',
        );
    }
    const cfg = input.config ?? prior!.config,
      state =
        input.action === 'delete'
          ? 'deleted'
          : input.action === 'pause'
            ? 'paused'
            : 'active';
    if (state === 'active') {
      const connection = (
        await c.query(
          'SELECT state FROM whatsapp_connections WHERE user_id=$1',
          [owner],
        )
      ).rows[0];
      if (!config.WHATSAPP_ENABLED || connection?.state !== 'verified')
        throw new ConflictException(
          'Verify recipient and activate the channel first.',
        );
      if (cfg.sourceIds.some((v) => !sources(config).includes(v)))
        throw new ConflictException(
          'A selected source is not admitted for this channel.',
        );
    }
    const savedAt = new Date().toISOString(),
      value = WhatsappScheduleSchema.parse({
        version: (prior?.version ?? 0) + 1,
        state,
        config: cfg,
        savedAt,
        nextDueAt: state === 'active' ? nextWhatsappDue(cfg, savedAt) : null,
      });
    await c.query(
      'INSERT INTO whatsapp_schedules(user_id,version,state,next_due_at,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET version=$2,state=$3,next_due_at=$4,payload=$5',
      [
        owner,
        value.version,
        state,
        value.nextDueAt,
        seal(owner, 'head', value, account.privateDataKeys),
      ],
    );
    await c.query(
      'INSERT INTO whatsapp_schedule_versions(user_id,version,payload) VALUES($1,$2,$3)',
      [
        owner,
        value.version,
        seal(owner, 'version:' + value.version, value, account.privateDataKeys),
      ],
    );
    await c.query(
      'INSERT INTO whatsapp_schedule_requests(user_id,id,input_hash,payload) VALUES($1,$2,$3,$4)',
      [
        owner,
        input.requestId,
        inputHash,
        seal(
          owner,
          'request:' + input.requestId,
          value,
          account.privateDataKeys,
        ),
      ],
    );
    await c.query(
      "UPDATE whatsapp_outbox SET state='cancelled',detail='Schedule changed; old queued occurrence cancelled.',updated_at=clock_timestamp() WHERE user_id=$1 AND origin='scheduled' AND state='queued'",
      [owner],
    );
    return value;
  });
}
export async function prepareWhatsappOccurrence(
  account: AccountStore,
  config: AppConfig,
) {
  return account.transaction(async (c) => {
    const candidate = (
      await c.query(
        "SELECT user_id FROM whatsapp_schedules WHERE state='active' AND next_due_at<=clock_timestamp() ORDER BY next_due_at LIMIT 1",
      )
    ).rows[0];
    if (!candidate) return;
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
      candidate.user_id,
    ]);
    const row = (
      await c.query(
        "SELECT * FROM whatsapp_schedules WHERE user_id=$1 AND state='active' AND next_due_at<=clock_timestamp() FOR UPDATE",
        [candidate.user_id],
      )
    ).rows[0];
    if (!row) return;
    const owner = row.user_id,
      schedule = decode(row, account.privateDataKeys),
      connection = (
        await c.query(
          'SELECT state FROM whatsapp_connections WHERE user_id=$1',
          [owner],
        )
      ).rows[0];
    if (connection?.state !== 'verified') {
      await pauseWhatsappSchedule(c, owner, account.privateDataKeys);
      return;
    }
    const now = new Date().toISOString(),
      dueAt = row.next_due_at.toISOString(),
      id = randomUUID();
    let outcome: 'queued' | 'empty' | 'unavailable' | 'skipped' = 'empty',
      detail =
        'No new admitted public summaries in the selected freshness window.';
    const jobs: string[] = [];
    if (Date.parse(now) - Date.parse(dueAt) > 600000) {
      outcome = 'skipped';
      detail =
        'Occurrence missed by more than ten minutes; no catchup messages.';
    } else {
      await c.query('SAVEPOINT whatsapp_selection');
      try {
        if (schedule.config.sourceIds.some((v) => !sources(config).includes(v)))
          throw Error('Selected source permission unavailable');
        const capacity = (
          await c.query(
            "SELECT count(*)::int AS count FROM whatsapp_outbox WHERE user_id=$1 AND origin='scheduled' AND created_at>clock_timestamp()-interval '24 hours'",
            [owner],
          )
        ).rows[0].count;
        const recent = (
          await c.query(
            "SELECT i.id FROM discovery_items i JOIN LATERAL(SELECT data FROM discovery_versions WHERE item_id=i.id AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1)v ON true WHERE v.data->>'status'='published' AND (CASE WHEN i.id LIKE 'gdp-original-%' THEN 'bea-gdp-original' WHEN i.id LIKE 'ecb-statistics-%' THEN 'ecb-statistics' WHEN i.id LIKE 'ecb-press-%' THEN 'ecb-press' WHEN i.id LIKE 'fed-%' THEN 'fed' WHEN i.id LIKE 'pib-%' THEN 'pib' WHEN i.id LIKE 'bea-%' THEN 'bea' WHEN i.id LIKE 'annual-%' OR i.id LIKE 'wb-%' OR v.data->'source'->>'name'='World Bank' THEN 'world-bank' WHEN v.data->>'kind'='term' THEN 'glossary' ELSE 'other' END)=ANY($3::text[]) AND (v.data->>'publishedAt')::timestamptz >= $1::timestamptz-($2::int*interval '1 hour') ORDER BY (v.data->>'publishedAt')::timestamptz DESC,i.id LIMIT 500",
            [
              now,
              schedule.config.maxAgeHours,
              schedule.config.sourceIds.filter((v) =>
                sources(config).includes(v),
              ),
            ],
          )
        ).rows;
        const admitted = await admitPublications(
          c,
          recent.map((r) => r.id),
        );
        const previous = (
          await c.query(
            "SELECT item_id FROM whatsapp_outbox WHERE user_id=$1 AND origin='scheduled' AND state<>'cancelled' AND item_id=ANY($2::text[])",
            [owner, recent.map((r) => r.id)],
          )
        ).rows.map((r) => r.item_id);
        const eligible = admitted
          .filter(
            (item) =>
              item.status === 'published' &&
              sources(config).includes(sourceIdFor(item)) &&
              schedule.config.sourceIds.includes(
                sourceIdFor(item) as (typeof schedule.config.sourceIds)[number],
              ) &&
              Date.parse(item.publishedAt) <= Date.parse(now) &&
              Date.parse(item.publishedAt) >=
                Date.parse(now) - schedule.config.maxAgeHours * 3600000 &&
              !previous.includes(item.id) &&
              item.title.length <= 200 &&
              item.summary.length <= 800,
          )
          .sort(
            (a, b) =>
              b.publishedAt.localeCompare(a.publishedAt) ||
              a.id.localeCompare(b.id),
          )
          .slice(
            0,
            Math.min(schedule.config.maxItems, Math.max(0, 3 - capacity)),
          );
        for (const item of eligible) {
          const job = randomUUID(),
            payload = WhatsappJobPayloadSchema.parse({
              title: item.title,
              summary: item.summary,
              url: publicReadingLink(config.WHATSAPP_PUBLIC_ORIGIN, item.id),
              sourceHash: item.sourceHash,
              sourceVersion: item.version,
            });
          await c.query(
            "INSERT INTO whatsapp_outbox(id,user_id,item_id,payload,state,origin,schedule_version,source_expires_at) VALUES($1,$2,$3,$4,'queued','scheduled',$5,$6)",
            [
              job,
              owner,
              item.id,
              sealPrivateJson(
                'whatsapp-channel',
                owner,
                job,
                payload,
                account.privateDataKeys,
              ),
              schedule.version,
              new Date(
                Date.parse(item.publishedAt) +
                  schedule.config.maxAgeHours * 3600000,
              ).toISOString(),
            ],
          );
          jobs.push(job);
        }
        if (capacity >= 3) {
          outcome = 'skipped';
          detail =
            'Three scheduled summary requests already used in the last 24 hours.';
        }
        if (jobs.length) {
          outcome = 'queued';
          detail = `${jobs.length} current public summaries queued; delivery not yet confirmed.`;
        }
        await c.query('RELEASE SAVEPOINT whatsapp_selection');
      } catch {
        await c.query('ROLLBACK TO SAVEPOINT whatsapp_selection');
        jobs.length = 0;
        outcome = 'unavailable';
        detail =
          'Source admission unavailable; no messages queued and no catchup retry.';
      }
    }
    const receipt = {
      id,
      scheduleVersion: schedule.version,
      dueAt,
      recordedAt: now,
      outcome,
      detail,
      jobIds: jobs,
    };
    await c.query(
      'INSERT INTO whatsapp_schedule_occurrences(user_id,id,schedule_version,due_at,outcome,payload) VALUES($1,$2,$3,$4,$5,$6)',
      [
        owner,
        id,
        schedule.version,
        dueAt,
        outcome,
        seal(owner, 'occurrence:' + id, receipt, account.privateDataKeys),
      ],
    );
    const updated = {
      ...schedule,
      nextDueAt: nextWhatsappDue(schedule.config, now),
    };
    await c.query(
      'UPDATE whatsapp_schedules SET next_due_at=$2,payload=$3 WHERE user_id=$1',
      [
        owner,
        updated.nextDueAt,
        seal(owner, 'head', updated, account.privateDataKeys),
      ],
    );
    return receipt;
  });
}
export async function exportWhatsappSchedules(
  c: pg.PoolClient,
  owner: string,
  keys: PrivateDataKeys,
) {
  const heads = (
      await c.query('SELECT * FROM whatsapp_schedules WHERE user_id=$1', [
        owner,
      ])
    ).rows,
    versions = (
      await c.query(
        'SELECT * FROM whatsapp_schedule_versions WHERE user_id=$1 ORDER BY version',
        [owner],
      )
    ).rows,
    occurrences = (
      await c.query(
        'SELECT * FROM whatsapp_schedule_occurrences WHERE user_id=$1 ORDER BY recorded_at,id',
        [owner],
      )
    ).rows;
  return {
    schedule: heads[0] ? decode(heads[0], keys) : null,
    versions: versions.map((r) =>
      WhatsappScheduleSchema.parse(
        open(owner, 'version:' + r.version, r.payload, keys),
      ),
    ),
    occurrences: occurrences.map((r) =>
      WhatsappOccurrenceSchema.parse(
        open(owner, 'occurrence:' + r.id, r.payload, keys),
      ),
    ),
  };
}
