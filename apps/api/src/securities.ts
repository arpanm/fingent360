import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import {
  IndianIsinSchema,
  SecurityDirectorySchema,
  SecurityEvidenceSchema,
  SecurityHistorySchema,
  SecurityIdentitySchema,
  SecurityRefreshInputSchema,
  SecurityRunSchema,
  SecurityRunsSchema,
  parseSecurityMapping,
  type SecurityRun,
  type SecurityIdentity,
} from '@fingent360/contracts';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import type { AppConfig } from './config.js';

export const SECURITIES = Symbol('SECURITIES');
const sourceUrl = 'https://api.openfigi.com/v3/mapping' as const;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function input<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new BadRequestException(
      'Invalid security lookup. Use a checksum-valid Indian ISIN.',
    );
  return parsed.data;
}
export class SecuritiesStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 10000,
    });
    this.pool.on('error', () => {});
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
    });
  }
  async onApplicationShutdown() {
    await Promise.allSettled([this.pool.end(), this.mongo.close()]);
  }
  async directory(search = '') {
    if (typeof search !== 'string' || search.length > 100)
      throw new BadRequestException('Search is too long.');
    // Escape wildcard characters; this is a literal search, never provider traffic.
    const q = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
    const rows = await this.pool.query<{
      payload: SecurityIdentity;
      checked_at: Date;
    }>(
      `SELECT r.payload,s.checked_at FROM security_identities s JOIN security_identity_revisions r ON r.isin=s.isin AND r.version=s.version WHERE s.isin ILIKE $1 OR EXISTS (SELECT 1 FROM jsonb_array_elements(r.payload->'candidates') c WHERE c->>'name' ILIKE $1 OR c->>'ticker' ILIKE $1) ORDER BY s.isin LIMIT 201`,
      [q],
    );
    return SecurityDirectorySchema.parse({
      items: rows.rows
        .slice(0, 200)
        .map((r) => ({ ...r.payload, checkedAt: r.checked_at.toISOString() })),
      limited: rows.rows.length > 200,
    });
  }
  async detail(isin: string) {
    input(IndianIsinSchema, isin);
    const rows = await this.pool.query<{
      payload: SecurityIdentity;
      checked_at: Date;
    }>(
      'SELECT r.payload,s.checked_at FROM security_identities s JOIN security_identity_revisions r ON r.isin=s.isin AND r.version=s.version WHERE s.isin=$1',
      [isin],
    );
    if (!rows.rows[0])
      throw new NotFoundException(
        'No stored identity for this ISIN. Your holdings remain unchanged.',
      );
    return SecurityIdentitySchema.parse({
      ...rows.rows[0].payload,
      checkedAt: rows.rows[0].checked_at.toISOString(),
    });
  }
  async history(isin: string) {
    await this.detail(isin);
    const rows = await this.pool.query<{ payload: unknown }>(
      'SELECT payload FROM security_identity_revisions WHERE isin=$1 ORDER BY version DESC',
      [isin],
    );
    return SecurityHistorySchema.parse({
      revisions: rows.rows.map((r) => r.payload),
    });
  }
  async evidence(isin: string, hash: string) {
    input(IndianIsinSchema, isin);
    if (!/^[a-f0-9]{64}$/.test(hash))
      throw new BadRequestException('Invalid evidence hash.');
    const owns = await this.pool.query(
      "SELECT 1 FROM security_identity_revisions WHERE isin=$1 AND payload->>'sourceHash'=$2",
      [isin, hash],
    );
    if (!owns.rowCount)
      throw new NotFoundException('Evidence is not part of this identity.');
    const raw = await this.mongo
      .db()
      .collection<{
        _id: string;
        body: string;
        isin: string;
        retrievedAt: string;
        url: typeof sourceUrl;
      }>('security_evidence')
      .findOne({ _id: hash });
    if (!raw)
      throw new ServiceUnavailableException(
        'Source evidence is temporarily unavailable. Retry later.',
      );
    return SecurityEvidenceSchema.parse({
      hash: raw._id,
      isin: raw.isin,
      retrievedAt: raw.retrievedAt,
      url: raw.url,
      body: raw.body,
    });
  }
  async runs() {
    // Interrupted calls stay visible. A new explicit request may retry their identifiers.
    const rows = await this.pool.query<{ payload: SecurityRun }>(
      'SELECT payload FROM security_refresh_runs ORDER BY started_at DESC LIMIT 20',
    );
    return SecurityRunsSchema.parse({ runs: rows.rows.map((r) => r.payload) });
  }
  async refresh(
    raw: unknown,
    authorize: () => Promise<unknown> = async () => undefined,
  ) {
    const request = input(SecurityRefreshInputSchema, raw);
    const c = await this.pool.connect();
    let locked = false;
    try {
      const lock = await c.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(360020) AS locked',
      );
      locked = !!lock.rows[0]?.locked;
      if (!locked)
        throw new ConflictException(
          'An identity refresh is already running. Check its progress, then retry.',
        );
      await authorize();
      const previous = await c.query<{ payload: SecurityRun }>(
        'SELECT payload FROM security_refresh_runs WHERE id=$1',
        [request.requestId],
      );
      if (previous.rows[0]) {
        if (
          JSON.stringify(previous.rows[0].payload.isins) !==
          JSON.stringify(request.isins)
        )
          throw new ConflictException(
            'This request ID belongs to a different selection.',
          );
        return SecurityRunSchema.parse(previous.rows[0].payload);
      }
      // Session lock was acquired, so no other active process owns these interrupted runs.
      await c.query(
        `UPDATE security_refresh_runs SET payload=jsonb_set(jsonb_set(payload,'{status}','"failed"'),'{finishedAt}',to_jsonb(to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),finished_at=now() WHERE finished_at IS NULL`,
      );
      const run: SecurityRun = {
        id: request.requestId,
        isins: request.isins,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: 'running',
        outcomes: [],
      };
      const save = () =>
        c.query(
          'UPDATE security_refresh_runs SET payload=$2,finished_at=$3 WHERE id=$1',
          [run.id, JSON.stringify(run), run.finishedAt],
        );
      await c.query(
        'INSERT INTO security_refresh_runs(id,payload,started_at) VALUES($1,$2,$3)',
        [run.id, JSON.stringify(run), run.startedAt],
      );
      for (const isin of request.isins) {
        try {
          const pacing = await c.query<{ wait: number }>(
            `SELECT GREATEST(0,EXTRACT(EPOCH FROM (next_allowed_at-now()))*1000)::integer AS wait FROM security_provider_pacing WHERE provider='openfigi'`,
          );
          const wait = pacing.rows[0]?.wait ?? 0;
          if (wait > 60000)
            throw Error(
              'Provider rate limit is cooling down. Retry after one minute.',
            );
          if (wait) await delay(wait);
          await c.query(
            `INSERT INTO security_provider_pacing(provider,next_allowed_at) VALUES('openfigi',now()+interval '3 seconds') ON CONFLICT(provider) DO UPDATE SET next_allowed_at=EXCLUDED.next_allowed_at`,
          );
          const response = await fetch(sourceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([
              {
                idType: 'ID_ISIN',
                idValue: isin,
                exchCode: 'IN',
                marketSecDes: 'Equity',
                currency: 'INR',
              },
            ]),
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
          });
          if (response.status === 429) {
            await c.query(
              `UPDATE security_provider_pacing SET next_allowed_at=now()+interval '65 seconds' WHERE provider='openfigi'`,
            );
            throw Error('Provider rate limit reached. Retry after one minute.');
          }
          if (!response.ok)
            throw Error(
              `Identifier provider returned HTTP ${response.status}. Retry later.`,
            );
          let body = '';
          if (!response.body)
            throw Error('Identifier provider returned no response body.');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              body += decoder.decode(part.value, { stream: true });
              if (body.length > 200000) {
                await reader.cancel();
                throw Error(
                  'Identifier provider response exceeds the safety limit.',
                );
              }
            }
            body += decoder.decode();
          } finally {
            reader.releaseLock();
          }
          const mapping = parseSecurityMapping(JSON.parse(body));
          const retrievedAt = new Date().toISOString();
          const fingerprint = sha(JSON.stringify(mapping));
          const prior = await c.query<{
            version: number;
            fingerprint: string;
            payload: SecurityIdentity;
          }>(
            'SELECT r.version,r.fingerprint,r.payload FROM security_identities s JOIN security_identity_revisions r ON r.isin=s.isin AND r.version=s.version WHERE s.isin=$1',
            [isin],
          );
          const old = prior.rows[0];
          let version = old?.version ?? 0;
          if (old?.fingerprint === fingerprint) {
            await c.query(
              'UPDATE security_identities SET checked_at=$2 WHERE isin=$1',
              [isin, retrievedAt],
            );
          } else {
            version++;
            const sourceHash = sha(`${isin}\n${retrievedAt}\n${body}`);
            await this.mongo
              .db()
              .collection<{
                _id: string;
                body: string;
                isin: string;
                retrievedAt: string;
                url: typeof sourceUrl;
              }>('security_evidence')
              .updateOne(
                { _id: sourceHash },
                { $setOnInsert: { body, isin, retrievedAt, url: sourceUrl } },
                { upsert: true },
              );
            const value = SecurityIdentitySchema.parse({
              isin,
              version,
              ...mapping,
              retrievedAt,
              checkedAt: retrievedAt,
              sourceHash,
              source: 'OpenFIGI',
              sourceUrl,
              termsUrl: 'https://www.openfigi.com/docs/terms-of-service',
              mappingPolicy: 'india-common-stock-v1',
            });
            await c.query('BEGIN');
            try {
              await c.query(
                'INSERT INTO security_identities(isin,version,checked_at) VALUES($1,$2,$3) ON CONFLICT(isin) DO UPDATE SET version=$2,checked_at=$3',
                [isin, version, retrievedAt],
              );
              await c.query(
                'INSERT INTO security_identity_revisions(isin,version,fingerprint,payload) VALUES($1,$2,$3,$4)',
                [isin, version, fingerprint, JSON.stringify(value)],
              );
              await authorize();
              await c.query('COMMIT');
            } catch (error) {
              await c.query('ROLLBACK');
              throw error;
            }
          }
          run.outcomes.push({
            isin,
            status: mapping.resolution,
            version,
            message:
              old?.fingerprint === fingerprint
                ? 'Unchanged source identity; successful check recorded.'
                : 'Source identity edition stored.',
          });
        } catch (error) {
          const message =
            error instanceof Error &&
            /^(Identifier provider|The identifier provider|Provider rate|The mapping|Duplicate provider)/.test(
              error.message,
            )
              ? error.message
              : 'Identity could not be validated or stored. Prior editions remain available; retry or inspect provider changes.';
          run.outcomes.push({ isin, status: 'failed', version: null, message });
        }
        await save();
      }
      run.status = run.outcomes.some((v) => v.status === 'failed')
        ? 'failed'
        : 'completed';
      run.finishedAt = new Date().toISOString();
      await save();
      return SecurityRunSchema.parse(run);
    } finally {
      if (locked)
        await c.query('SELECT pg_advisory_unlock(360020)').catch(() => {});
      c.release();
    }
  }
}
@Controller('securities')
export class SecuritiesController {
  constructor(@Inject(SECURITIES) private readonly store: SecuritiesStore) {}
  @Get() list(@Query('q') q?: string) {
    return this.store.directory(q);
  }
  @Get(':isin') detail(@Param('isin') isin: string) {
    return this.store.detail(isin);
  }
  @Get(':isin/history') history(@Param('isin') isin: string) {
    return this.store.history(isin);
  }
  @Get(':isin/evidence/:hash') evidence(
    @Param('isin') isin: string,
    @Param('hash') hash: string,
  ) {
    return this.store.evidence(isin, hash);
  }
}
@OperatorRead()
@Controller('ops/securities')
export class OpsSecuritiesController {
  constructor(
    @Inject(SECURITIES) private readonly store: SecuritiesStore,
    @Inject(OPERATOR_STORE) private readonly operator: OperatorStore,
  ) {}
  @Get('runs') async runs(@Headers('cookie') cookie?: string) {
    await this.operator.require(cookie);
    return this.store.runs();
  }
  @OperatorAction('prepare')
  @Post('refresh')
  async refresh(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.operator.origin(origin);
    await this.operator.require(cookie);
    const request = input(SecurityRefreshInputSchema, body);
    await this.operator.record(
      'security-identity-refresh',
      request.requestId,
      cookie,
    );
    return this.store.refresh(request, () =>
      this.operator.permission(cookie, 'prepare'),
    );
  }
}
export const securitiesProvider = (config: AppConfig) => ({
  provide: SECURITIES,
  useFactory: () => new SecuritiesStore(config),
});
