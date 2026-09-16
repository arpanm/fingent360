import { decryptScheduleRows, sealSchedule } from './private-schedules.js';
import type { PrivateDataKeys } from './private-data-crypto.js';
import { encryptReportJob } from './private-reports.js';
import { decryptAllocationRows } from './private-allocations.js';
import { decryptHoldingsRows } from './private-holdings.js';
import { randomUUID, createHash } from 'node:crypto';
import { decryptGoalRows } from './private-goals.js';
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import {
  ScheduleExportQuerySchema,
  ReportScheduleSchema,
  ReportSchedulesSchema,
  ScheduleWriteSchema,
  ScheduleReceiptSchema,
  ScheduleExportSchema,
  ScheduleOccurrenceSchema,
  nextScheduleDue,
  latestScheduleDue,
  ReportSnapshotSchema,
  HoldingsSnapshotSchema,
  emptyAllocation,
  consentStatus,
  consentActive,
} from '@fingent360/contracts';
import {
  readConsent,
  recordConsentOptIn,
  requireConsent,
  ConsentUnavailable,
} from './consent-store.js';
import { AccountStore, STORE } from './accounts.js';
import { admitWorker } from './worker-control.js';
export async function exportReportSchedules(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
  query: unknown = {},
) {
  const parsed = ScheduleExportQuerySchema.safeParse(query);
  if (!parsed.success) throw new BadRequestException('Invalid history cursor.');
  const q = parsed.data;
  const bounds = await c.query(
    'SELECT (SELECT coalesce(max(seq),0) FROM report_schedule_editions WHERE user_id=$1) AS e,(SELECT coalesce(max(seq),0) FROM report_schedule_requests WHERE user_id=$1) AS r,(SELECT coalesce(max(seq),0) FROM report_schedule_occurrences WHERE user_id=$1) AS o',
    [userId],
  );
  const editionUntil = q.editionUntil ?? Number(bounds.rows[0].e),
    receiptUntil = q.receiptUntil ?? Number(bounds.rows[0].r),
    occurrenceUntil = q.occurrenceUntil ?? Number(bounds.rows[0].o);
  const [editions, receipts, occurrences] = await Promise.all([
    c.query(
      'SELECT * FROM report_schedule_editions WHERE user_id=$1 AND seq>$2 AND seq<=$3 ORDER BY seq LIMIT 101',
      [userId, q.editionAfter, editionUntil],
    ),
    c.query(
      'SELECT * FROM report_schedule_requests WHERE user_id=$1 AND seq>$2 AND seq<=$3 ORDER BY seq LIMIT 101',
      [userId, q.receiptAfter, receiptUntil],
    ),
    c.query(
      'SELECT * FROM report_schedule_occurrences WHERE user_id=$1 AND seq>$2 AND seq<=$3 ORDER BY seq LIMIT 101',
      [userId, q.occurrenceAfter, occurrenceUntil],
    ),
  ]);
  await decryptScheduleRows(c, 'schedule-edition', userId, editions.rows, keys);
  await decryptScheduleRows(c, 'schedule-request', userId, receipts.rows, keys);
  await decryptScheduleRows(
    c,
    'schedule-occurrence',
    userId,
    occurrences.rows,
    keys,
  );
  const rows = [editions.rows, receipts.rows, occurrences.rows],
    more = rows.some((r) => r.length > 100);
  return ScheduleExportSchema.parse({
    ownerId: userId,
    editions: editions.rows.slice(0, 100).map((r) => r.payload),
    receipts: receipts.rows.slice(0, 100).map((r) => r.payload),
    occurrences: occurrences.rows.slice(0, 100).map((r) => r.payload),
    next: more
      ? {
          editionUntil,
          receiptUntil,
          occurrenceUntil,
          editionAfter: Number(
            editions.rows.slice(0, 100).at(-1)?.seq ?? q.editionAfter,
          ),
          receiptAfter: Number(
            receipts.rows.slice(0, 100).at(-1)?.seq ?? q.receiptAfter,
          ),
          occurrenceAfter: Number(
            occurrences.rows.slice(0, 100).at(-1)?.seq ?? q.occurrenceAfter,
          ),
        }
      : null,
  });
}
@Injectable()
export class ReportSchedulesStore {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  async list(cookie?: string) {
    return this.account.transaction(async (c) => {
      const u = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [u.id]);
      await this.account.require(c, cookie);
      const rows = await c.query(
        "SELECT * FROM report_schedules WHERE user_id=$1 ORDER BY (status='deleted'),saved_at DESC,id LIMIT 105",
        [u.id],
      );
      const occurrences = await c.query(
        'SELECT * FROM report_schedule_occurrences WHERE user_id=$1 ORDER BY due_at DESC,id LIMIT 100',
        [u.id],
      );
      await decryptScheduleRows(
        c,
        'schedule-head',
        u.id,
        rows.rows,
        this.account.privateDataKeys,
      );
      await decryptScheduleRows(
        c,
        'schedule-occurrence',
        u.id,
        occurrences.rows,
        this.account.privateDataKeys,
      );
      const consent = await readConsent(c, u.id, 'scheduled-record-reviews');
      await this.account.require(c, cookie);
      const evaluatedAt = new Date().toISOString();
      return ReportSchedulesSchema.parse({
        consent: {
          record: consent,
          status: consentStatus(consent, evaluatedAt),
        },
        schedules: rows.rows.map((r) => r.payload),
        occurrences: occurrences.rows.map((r) => r.payload),
        evaluatedAt,
        mode: 'connected',
      });
    });
  }
  async save(id: string, body: unknown, cookie?: string) {
    const parsed = ScheduleWriteSchema.safeParse(body);
    if (
      !parsed.success ||
      !ScheduleReceiptSchema.shape.requestId.safeParse(id).success
    )
      throw new BadRequestException('Review the schedule and confirm consent.');
    const input = parsed.data,
      fingerprint = createHash('sha256')
        .update(JSON.stringify({ id, input }))
        .digest('hex');
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const replay = await c.query(
        'SELECT * FROM report_schedule_requests WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Request ID belongs to a different schedule change.',
          );
        await decryptScheduleRows(
          c,
          'schedule-request',
          user.id,
          replay.rows,
          this.account.privateDataKeys,
        );
        return ScheduleReceiptSchema.parse(replay.rows[0].payload);
      }
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
      await this.account.require(c, cookie);
      const owner = await c.query(
        'SELECT user_id FROM report_schedules WHERE id=$1',
        [id],
      );
      if (owner.rows[0] && owner.rows[0].user_id !== user.id)
        throw new NotFoundException('Schedule not found.');
      const previous = await c.query(
        'SELECT * FROM report_schedules WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [id, user.id],
      );
      await this.account.require(c, cookie);
      await decryptScheduleRows(
        c,
        'schedule-head',
        user.id,
        previous.rows,
        this.account.privateDataKeys,
      );
      const old = previous.rows[0]
        ? ReportScheduleSchema.parse(previous.rows[0].payload)
        : null;
      if (!old && input.expectedVersion !== 0)
        throw new NotFoundException('Schedule not found.');
      if (
        old?.status === 'deleted' ||
        (old?.version ?? 0) !== input.expectedVersion
      )
        throw new ConflictException(
          'Schedule changed. Reload before changing it.',
        );
      if (!old && input.action !== 'save')
        throw new NotFoundException('Schedule not found.');
      if (
        (input.action === 'pause' && old?.status !== 'active') ||
        (input.action === 'resume' && old?.status !== 'paused')
      )
        throw new ConflictException(
          'This schedule cannot perform that action.',
        );
      if (!old) {
        const active = await c.query(
          "SELECT count(*)::int AS n FROM report_schedules WHERE user_id=$1 AND status<>'deleted'",
          [user.id],
        );
        if (active.rows[0].n >= 5)
          throw new BadRequestException(
            'Keep at most five schedules. Delete one before creating another.',
          );
      }
      const config = input.config ?? old!.config,
        status =
          input.action === 'delete'
            ? 'deleted'
            : input.action === 'pause'
              ? 'paused'
              : 'active',
        savedAt = new Date().toISOString();
      const schedule = ReportScheduleSchema.parse({
        id,
        version: (old?.version ?? 0) + 1,
        config,
        status,
        savedAt,
        nextDueAt:
          status === 'active' ? nextScheduleDue(config, savedAt) : null,
        message:
          status === 'active'
            ? 'Next future occurrence; no immediate catch-up.'
            : status === 'paused'
              ? 'Paused. Existing reports remain.'
              : 'Deleted. Existing reports remain.',
      });
      const receipt = ScheduleReceiptSchema.parse({
        requestId: input.requestId,
        schedule,
      });
      if (status === 'active')
        await recordConsentOptIn(c, user.id, 'scheduled-record-reviews', {
          kind: 'schedule-opt-in',
          recordedAt: savedAt,
          scheduleId: id,
          scheduleVersion: schedule.version,
          requestId: input.requestId,
        });
      const headCipher = sealSchedule(
          'schedule-head',
          user.id,
          schedule,
          this.account.privateDataKeys,
        ),
        editionCipher = sealSchedule(
          'schedule-edition',
          user.id,
          schedule,
          this.account.privateDataKeys,
        ),
        requestCipher = sealSchedule(
          'schedule-request',
          user.id,
          receipt,
          this.account.privateDataKeys,
        );
      await c.query(
        'INSERT INTO report_schedules(id,user_id,version,status,next_due_at,encrypted_payload,content_hash,saved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET version=EXCLUDED.version,status=EXCLUDED.status,next_due_at=EXCLUDED.next_due_at,payload=NULL,encrypted_payload=EXCLUDED.encrypted_payload,content_hash=EXCLUDED.content_hash,saved_at=EXCLUDED.saved_at WHERE report_schedules.user_id=EXCLUDED.user_id',
        [
          id,
          user.id,
          schedule.version,
          status,
          schedule.nextDueAt,
          headCipher.envelope,
          headCipher.hash,
          schedule.savedAt,
        ],
      );
      await c.query(
        'INSERT INTO report_schedule_editions(schedule_id,user_id,version,encrypted_payload,content_hash) VALUES($1,$2,$3,$4,$5)',
        [
          id,
          user.id,
          schedule.version,
          editionCipher.envelope,
          editionCipher.hash,
        ],
      );
      await c.query(
        'INSERT INTO report_schedule_requests(user_id,request_id,fingerprint,encrypted_payload,content_hash,schedule_id,schedule_version,schedule_status,saved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          user.id,
          input.requestId,
          fingerprint,
          requestCipher.envelope,
          requestCipher.hash,
          id,
          schedule.version,
          status,
          schedule.savedAt,
        ],
      );
      const finalConsent =
        status === 'active'
          ? await requireConsent(c, user.id, 'scheduled-record-reviews')
          : null;
      await this.account.require(c, cookie);
      if (
        finalConsent &&
        !consentActive(finalConsent, new Date().toISOString())
      )
        throw new ConsentUnavailable();
      return receipt;
    });
  }
  async workOne() {
    try {
      return await this.account.transaction(async (c) => {
        if (!(await admitWorker(c, 'reports'))) return false;
        // Lock account first, matching all owned edits/deletion. Concurrent workers skip admitted owners.
        const owner = await c.query(
          `SELECT u.id FROM app_users u WHERE EXISTS(SELECT 1 FROM report_schedules s WHERE s.user_id=u.id AND s.status='active' AND s.next_due_at<=clock_timestamp())
        AND (EXISTS(SELECT 1 FROM account_consent_heads ch WHERE ch.user_id=u.id AND ch.purpose='scheduled-record-reviews'
          AND ch.payload->>'decision'='granted' AND (ch.payload->>'grantedAt')::timestamptz<=clock_timestamp()
          AND (ch.payload->>'changedAt')::timestamptz<=clock_timestamp()
          AND (ch.payload->'basis'->>'recordedAt')::timestamptz<=clock_timestamp()
          AND ((ch.payload->>'expiresAt') IS NULL OR (ch.payload->>'expiresAt')::timestamptz>clock_timestamp()))
        OR (NOT EXISTS(SELECT 1 FROM account_consent_heads ch WHERE ch.user_id=u.id AND ch.purpose='scheduled-record-reviews')
          AND EXISTS(SELECT 1 FROM report_schedule_requests r JOIN report_schedules s ON s.id=r.schedule_id AND s.user_id=r.user_id
            WHERE r.user_id=u.id AND s.status<>'deleted' AND r.schedule_status='active' AND r.saved_at<=clock_timestamp())))
        ORDER BY u.id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        );
        if (!owner.rows[0]) return false;
        const userId = owner.rows[0].id;
        const found = await c.query(
          "SELECT * FROM report_schedules WHERE user_id=$1 AND status='active' AND next_due_at<=clock_timestamp() ORDER BY next_due_at,id LIMIT 1 FOR UPDATE",
          [userId],
        );
        if (!found.rows[0]) return false;
        await requireConsent(c, userId, 'scheduled-record-reviews');
        await decryptScheduleRows(
          c,
          'schedule-head',
          userId,
          found.rows,
          this.account.privateDataKeys,
        );
        const schedule = ReportScheduleSchema.parse(found.rows[0].payload),
          now = new Date().toISOString();
        const due = latestScheduleDue(
          schedule.config,
          schedule.nextDueAt!,
          now,
        );
        const prior = await c.query(
          'SELECT id FROM report_schedule_occurrences WHERE schedule_id=$1 AND schedule_version=$2 AND due_at=$3',
          [schedule.id, schedule.version, due.dueAt],
        );
        if (prior.rows[0])
          throw new Error('Occurrence cursor invariant failed.');
        const id = randomUUID();
        let status: 'queued' | 'capacity' | 'failed' = 'queued',
          message =
            'Actual saved records captured; report preparation is queued.';
        const count = await c.query(
          'SELECT count(*)::int AS n FROM record_report_jobs WHERE user_id=$1',
          [userId],
        );
        const budget = await c.query(
          'SELECT used,window_start FROM record_report_request_limits WHERE user_id=$1',
          [userId],
        );
        if (
          count.rows[0].n >= 100 ||
          (budget.rows[0] &&
            budget.rows[0].used >= 100 &&
            Date.parse(budget.rows[0].window_start) > Date.now() - 3600000)
        ) {
          status = 'capacity';
          message =
            'Skipped: report history or hourly new-report capacity was full. No snapshot captured.';
        }
        if (status === 'queued') {
          await requireConsent(c, userId, 'scheduled-record-reviews');
          const goals = await c.query(
            'SELECT r.goal_id,r.version,r.payload,r.encrypted_payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.id',
            [userId],
          );
          await decryptGoalRows(
            c,
            userId,
            goals.rows,
            this.account.privateDataKeys,
          );
          const holdings = await c.query(
            'SELECT r.user_id,r.version,r.payload,r.encrypted_payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
            [userId],
          );
          await decryptHoldingsRows(
            c,
            userId,
            holdings.rows,
            this.account.privateDataKeys,
          );
          const allocations = await c.query(
            'SELECT r.user_id,r.version,r.payload,r.encrypted_payload FROM app_goal_allocations a JOIN app_goal_allocation_revisions r ON r.user_id=a.user_id AND r.version=a.version WHERE a.user_id=$1',
            [userId],
          );
          await decryptAllocationRows(
            c,
            userId,
            allocations.rows,
            this.account.privateDataKeys,
          );
          await requireConsent(c, userId, 'scheduled-record-reviews');
          const snapshot = ReportSnapshotSchema.safeParse({
            capturedAt: now,
            goals: goals.rows.map((r) => r.payload),
            holdings:
              holdings.rows[0]?.payload ??
              HoldingsSnapshotSchema.parse({
                version: 0,
                holdings: [],
                totalCostMinor: '0',
                currency: 'INR',
                scale: 2,
                provenance: 'user-entered-unverified',
                updatedAt: null,
              }),
            allocations: allocations.rows[0]?.payload ?? emptyAllocation(),
          });
          if (!snapshot.success) {
            status = 'failed';
            message =
              'Saved record validation failed. Review your records before the next occurrence; no snapshot was stored.';
          } else {
            await c.query(
              "INSERT INTO record_report_request_limits(user_id,window_start,used) VALUES($1,clock_timestamp(),1) ON CONFLICT(user_id) DO UPDATE SET window_start=CASE WHEN record_report_request_limits.window_start<=clock_timestamp()-interval '1 hour' THEN clock_timestamp() ELSE record_report_request_limits.window_start END,used=CASE WHEN record_report_request_limits.window_start<=clock_timestamp()-interval '1 hour' THEN 1 ELSE record_report_request_limits.used+1 END",
              [userId],
            );
            await c.query(
              'INSERT INTO record_report_jobs(id,user_id,encrypted_payload) VALUES($1,$2,$3)',
              [
                id,
                userId,
                encryptReportJob(
                  userId,
                  id,
                  schedule.config.label,
                  snapshot.data,
                  this.account.privateDataKeys,
                ),
              ],
            );
          }
        }
        const occurrence = ScheduleOccurrenceSchema.parse({
          id,
          scheduleId: schedule.id,
          scheduleVersion: schedule.version,
          dueAt: due.dueAt,
          capturedAt: now,
          skipped: due.skipped,
          status,
          reportId: status === 'queued' ? id : null,
          message,
        });
        const occurrenceCipher = sealSchedule(
          'schedule-occurrence',
          userId,
          occurrence,
          this.account.privateDataKeys,
        );
        await c.query(
          'INSERT INTO report_schedule_occurrences(id,schedule_id,user_id,schedule_version,due_at,encrypted_payload,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            id,
            schedule.id,
            userId,
            schedule.version,
            due.dueAt,
            occurrenceCipher.envelope,
            occurrenceCipher.hash,
          ],
        );
        const updated = { ...schedule, nextDueAt: due.nextDueAt, message };
        const updatedCipher = sealSchedule(
          'schedule-head',
          userId,
          updated,
          this.account.privateDataKeys,
        );
        await c.query(
          'UPDATE report_schedules SET next_due_at=$2,payload=NULL,encrypted_payload=$3,content_hash=$4 WHERE id=$1',
          [
            schedule.id,
            due.nextDueAt,
            updatedCipher.envelope,
            updatedCipher.hash,
          ],
        );
        await requireConsent(c, userId, 'scheduled-record-reviews');
        return true;
      });
    } catch (error) {
      if (error instanceof ConsentUnavailable) return false;
      throw error;
    }
  }
}
@Controller('account/report-schedules')
export class ReportSchedulesController {
  constructor(
    @Inject(ReportSchedulesStore) private readonly store: ReportSchedulesStore,
    @Inject(STORE) private readonly account: AccountStore,
  ) {}
  @Get('export') history(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      return exportReportSchedules(
        c,
        user.id,
        this.account.privateDataKeys,
        query,
      );
    });
  }
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.list(cookie);
  }
  @Post(':id') save(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.save(id, body, cookie);
  }
}
