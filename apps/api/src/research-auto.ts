import { captureScheduledFilingDiscovery } from './filing-discovery.js';
import { captureScheduledFilingWatch } from './filing-watch.js';
import { captureScheduledEiaSpot } from './eia-spot.js';
import { captureScheduledIndiaGdp } from './india-gdp-provider.js';
import { captureScheduledCommodities } from './commodity-benchmarks.js';
import { captureRbiCalendar, readRbiCalendar } from './rbi-calendar.js';
import {
  capturePolicyCalendar,
  readPolicyCalendar,
} from './policy-calendar.js';
import type { ResearchAutoPolicyStore } from './research-auto-policy.js';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  Put,
  Query,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import {
  ResearchAutoSettingSchema,
  ResearchAutoStatusSchema,
  ReleaseCalendarSchema,
  parseBeaCalendar,
  parseBlsCalendar,
  CalendarSourceSchema,
  calendarSources,
} from '@fingent360/contracts';
import type { AppConfig } from './config.js';
import { DiscoveryStore } from './discovery.js';
import { researchSources } from './research-providers.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
export const RESEARCH_AUTO_STORE = Symbol('RESEARCH_AUTO_STORE');

export class ResearchAutoStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(
    config: AppConfig,
    private readonly discovery: DiscoveryStore,
    readonly workerEnabled = true,
    private readonly policies?: ResearchAutoPolicyStore,
  ) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await Promise.allSettled([this.pool.end(), this.mongo.close()]);
  }
  async initialize() {
    for (const source of researchSources.filter((s) => s.access === 'enabled'))
      await this.pool.query(
        'INSERT INTO research_auto_schedules(source_id,enabled) VALUES($1,true) ON CONFLICT DO NOTHING',
        [source.id],
      );
    await this.pool.query(
      "INSERT INTO research_auto_schedules(source_id,enabled) VALUES('bea-calendar',true),('bls-calendar',true),('fomc-calendar',true) ON CONFLICT DO NOTHING",
    );
  }
  async status() {
    await this.initialize();
    const result = await this.pool.query<{
      source_id: string;
      enabled: boolean;
      interval_minutes: number;
      next_at: Date;
      last_status: string;
      last_run_id: string | null;
      message: string;
    }>('SELECT * FROM research_auto_schedules ORDER BY source_id');
    return ResearchAutoStatusSchema.parse({
      observedAt: new Date().toISOString(),
      schedules: result.rows.map((r) => ({
        sourceId: r.source_id,
        enabled: r.enabled,
        intervalMinutes: r.interval_minutes,
        nextAt: r.next_at.toISOString(),
        lastStatus: r.last_status,
        lastRunId: r.last_run_id,
        message: r.message,
      })),
    });
  }
  async configure(body: unknown, authorize: () => Promise<unknown>) {
    const input = ResearchAutoSettingSchema.safeParse(body);
    if (
      !input.success ||
      !(
        CalendarSourceSchema.safeParse(input.data.sourceId).success ||
        input.data.sourceId === 'fomc-calendar' ||
        input.data.sourceId === 'rbi-mpc-calendar' ||
        input.data.sourceId === 'commodity-benchmarks' ||
        input.data.sourceId === 'india-gdp' ||
        input.data.sourceId === 'eia-daily-spot' ||
        input.data.sourceId === 'equity-filing-watch' ||
        input.data.sourceId === 'equity-filing-discovery' ||
        researchSources.some(
          (s) => s.id === input.data.sourceId && s.access === 'enabled',
        )
      )
    )
      throw new BadRequestException(
        'Choose an enabled source and interval from 60 to 10080 minutes.',
      );
    await this.initialize();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      if (input.data.sourceId === 'india-gdp' && input.data.enabled) {
        if (!input.data.rightsEvidence)
          throw new BadRequestException(
            'Record original PIB/MoSPI retention, display and offline distribution permission.',
          );
        await c.query(
          'UPDATE india_gdp_gate SET rights_evidence=$1 WHERE id=true',
          [input.data.rightsEvidence],
        );
      }
      if (
        input.data.sourceId === 'commodity-benchmarks' &&
        input.data.enabled
      ) {
        if (!input.data.rightsEvidence)
          throw new BadRequestException(
            'Record World Bank dataset attribution and applicable third-party retention/display/offline rights.',
          );
        await c.query(
          'UPDATE commodity_gate SET rights_evidence=$1 WHERE id=true',
          [input.data.rightsEvidence],
        );
      }
      if (input.data.sourceId === 'rbi-mpc-calendar' && input.data.enabled) {
        if (!input.data.rightsEvidence)
          throw new BadRequestException(
            'Record RBI permission covering caching, display, internal linking and offline distribution.',
          );
        await c.query(
          'INSERT INTO rbi_calendar_rights(id,evidence) VALUES(true,$1) ON CONFLICT(id) DO UPDATE SET evidence=EXCLUDED.evidence,recorded_at=now()',
          [input.data.rightsEvidence],
        );
      }
      await c.query(
        'UPDATE research_auto_schedules SET enabled=$2,interval_minutes=$3,next_at=now() WHERE source_id=$1',
        [input.data.sourceId, input.data.enabled, input.data.intervalMinutes],
      );
      await authorize();
      await c.query('COMMIT');
    } catch (error) {
      await c.query('ROLLBACK');
      throw error;
    } finally {
      c.release();
    }
    return this.status();
  }
  async rbiCalendar(edition?: string) {
    return readRbiCalendar(this.pool, edition);
  }
  async policyCalendar(edition?: string) {
    return readPolicyCalendar(this.pool, edition);
  }
  async calendar(edition?: string, sourceValue: unknown = 'bea-calendar') {
    const parsedSource = CalendarSourceSchema.safeParse(sourceValue);
    if (!parsedSource.success)
      throw new BadRequestException('Choose BEA or BLS calendar.');
    const sourceId = parsedSource.data;
    if (edition !== undefined && !/^[a-f0-9]{64}$/.test(edition))
      throw new BadRequestException('Invalid calendar edition.');
    const captures = await this.pool.query<{
      hash: string;
      retrieved_at: Date;
    }>(
      'SELECT hash,retrieved_at FROM research_calendar_editions WHERE source_id=$1 ORDER BY retrieved_at DESC,hash LIMIT 100',
      [sourceId],
    );
    const hash = edition ?? captures.rows[0]?.hash;
    const selected = hash
      ? (
          await this.pool.query<{ data: unknown; retrieved_at: Date }>(
            'SELECT data,retrieved_at FROM research_calendar_editions WHERE hash=$1 AND source_id=$2',
            [hash, sourceId],
          )
        ).rows[0]
      : undefined;
    if (edition && !selected)
      throw new BadRequestException('Calendar edition unavailable.');
    return ReleaseCalendarSchema.parse({
      edition: hash ?? null,
      retrievedAt: selected?.retrieved_at.toISOString() ?? null,
      sourceId,
      sourceUrl: calendarSources[sourceId].url,
      basis: 'retained-calendar-capture',
      events: selected?.data ?? [],
      editions: captures.rows.map((r) => ({
        edition: r.hash,
        retrievedAt: r.retrieved_at.toISOString(),
      })),
    });
  }
  async captureCalendar(
    sourceId: 'bea-calendar' | 'bls-calendar' = 'bea-calendar',
  ) {
    const calendarUrl = calendarSources[sourceId].url;
    const response = await fetch(calendarUrl, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      headers: {
        'User-Agent': 'Fingent360/1.0 public calendar reader',
        Accept: 'text/calendar',
      },
    });
    if (!response.ok) throw Error('Calendar source unavailable.');
    const reader = response.body?.getReader();
    if (!reader) throw Error('Empty calendar.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > 2000000) throw Error('Calendar too large.');
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel();
    }
    const body = Buffer.concat(chunks).toString('utf8');
    const hash = createHash('sha256')
      .update(sourceId === 'bea-calendar' ? body : `${calendarUrl}\n${body}`)
      .digest('hex');
    const retrievedAt = new Date().toISOString();
    await this.mongo
      .db()
      .collection<{
        _id: string;
        body: string;
        url: string;
        retrievedAt: string;
      }>('research_calendar_raw')
      .updateOne(
        { _id: hash },
        { $setOnInsert: { body, url: calendarUrl, retrievedAt } },
        { upsert: true },
      );
    const data =
      sourceId === 'bls-calendar'
        ? parseBlsCalendar(body)
        : parseBeaCalendar(body);
    await this.pool.query(
      'INSERT INTO research_calendar_editions(hash,retrieved_at,data,source_id) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING',
      [hash, retrievedAt, JSON.stringify(data), sourceId],
    );
    return hash;
  }
  async tick() {
    if (!this.workerEnabled) return;
    await this.initialize();
    const c = await this.pool.connect();
    let locked = false;
    let id: string | undefined;
    let source: string | undefined;
    try {
      locked =
        (
          await c.query<{ locked: boolean }>(
            'SELECT pg_try_advisory_lock(360954) AS locked',
          )
        ).rows[0]?.locked === true;
      if (!locked) return;
      await c.query(
        "UPDATE research_auto_runs SET status='failed',finished_at=now(),message='Interrupted attempt; content-addressed retry is safe.' WHERE status='running'",
      );
      const row = (
        await c.query<{ source_id: string }>(
          'SELECT source_id FROM research_auto_schedules WHERE enabled AND next_at<=now() ORDER BY next_at,source_id LIMIT 1',
        )
      ).rows[0];
      if (!row) return;
      source = row.source_id;
      id = randomUUID();
      await c.query(
        "INSERT INTO research_auto_runs(id,source_id,status) VALUES($1,$2,'running')",
        [id, source],
      );
      await c.query(
        "UPDATE research_auto_schedules SET last_status='running',last_run_id=$2,message='Fetching; new news drafts require publication review.' WHERE source_id=$1",
        [source, id],
      );
      let discoveryRun: string | null = null;
      let capture: string | null = null;
      if (source === 'equity-filing-discovery')
        capture = await captureScheduledFilingDiscovery(this.pool, this.mongo);
      else if (source === 'equity-filing-watch')
        capture = await captureScheduledFilingWatch(this.pool, this.mongo);
      else if (source === 'eia-daily-spot')
        capture = await captureScheduledEiaSpot(this.pool, this.mongo);
      else if (source === 'india-gdp')
        capture = await captureScheduledIndiaGdp(this.pool, this.mongo);
      else if (source === 'commodity-benchmarks')
        capture = await captureScheduledCommodities(this.pool, this.mongo);
      else if (source === 'rbi-mpc-calendar')
        capture = await captureRbiCalendar(this.pool, this.mongo);
      else if (source === 'fomc-calendar')
        capture = await capturePolicyCalendar(this.pool, this.mongo);
      else if (source === 'bea-calendar' || source === 'bls-calendar')
        capture = await this.captureCalendar(source);
      else {
        const result = await this.discovery.refresh([source]);
        discoveryRun = result.id;
        if (result.status !== 'succeeded')
          throw Error('Source refresh failed.');
      }
      const publication =
        discoveryRun && this.policies
          ? await this.policies.publish(source, id)
          : {
              message:
                'Capture retained; no automatic publication policy applies.',
            };
      await c.query(
        "UPDATE research_auto_runs SET status='succeeded',finished_at=now(),discovery_run_id=$2,capture_hash=$3,message=$4 WHERE id=$1",
        [id, discoveryRun, capture, publication.message],
      );
      await c.query(
        "UPDATE research_auto_schedules SET last_status='succeeded',next_at=now()+interval_minutes*interval '1 minute',message=$2 WHERE source_id=$1",
        [source, publication.message],
      );
    } catch (error) {
      if (id && source) {
        await c.query(
          "UPDATE research_auto_runs SET status='failed',finished_at=now(),message='Source or storage unavailable; previous editions retained.' WHERE id=$1",
          [id],
        );
        await c.query(
          "UPDATE research_auto_schedules SET last_status='failed',next_at=now()+interval '15 minutes',message='Fetch failed; retry in 15 minutes. Existing published editions retained.' WHERE source_id=$1",
          [source],
        );
      }
      throw error;
    } finally {
      if (locked)
        await c.query('SELECT pg_advisory_unlock(360954)').catch(() => {});
      c.release();
    }
  }
}
@Injectable()
export class ResearchAutoWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<void> | undefined;
  constructor(
    @Inject(RESEARCH_AUTO_STORE) private readonly store: ResearchAutoStore,
  ) {}
  onApplicationBootstrap() {
    if (!this.store.workerEnabled) return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.store
          .tick()
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
@OperatorRead()
@Controller('ops/research-auto')
export class ResearchAutoController {
  constructor(
    @Inject(RESEARCH_AUTO_STORE) private readonly store: ResearchAutoStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() async status(@Headers('cookie') cookie?: string) {
    await this.ops.require(cookie);
    const result = await this.store.status();
    await this.ops.require(cookie);
    return result;
  }
  @Put() @OperatorAction('prepare') async configure(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    await this.ops.permission(cookie, 'prepare');
    const result = await this.store.configure(body, () =>
      this.ops.permission(cookie, 'prepare'),
    );
    await this.ops.record('research.auto.configured', 'schedule', cookie);
    return result;
  }
}
@Controller('research-calendar')
export class ResearchCalendarController {
  constructor(
    @Inject(RESEARCH_AUTO_STORE) private readonly store: ResearchAutoStore,
  ) {}
  @Get('rbi') rbiCalendar(@Query('edition') edition?: string) {
    return this.store.rbiCalendar(edition);
  }
  @Get('policy') policyCalendar(@Query('edition') edition?: string) {
    return this.store.policyCalendar(edition);
  }
  @Get() calendar(
    @Query('edition') edition?: string,
    @Query('source') source?: string,
  ) {
    return this.store.calendar(edition, source);
  }
}
