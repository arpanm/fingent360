import { randomUUID } from 'node:crypto';
import {
  Delete,
  GoneException,
  HttpException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  reportSelections,
  ReportSelectionError,
  ReportDeleteInputSchema,
  ReportDeletionSchema,
  emptyAllocation,
  ReportRequestSchema,
  ReportMutationSchema,
  ReportJobSchema,
  ReportJobsSchema,
  ReportSnapshotSchema,
  HoldingsSnapshotSchema,
  issueRecordReport,
  type ReportJob,
  type RecordReport,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { captureReportConnections } from './report-research.js';
const emptyHoldings = () =>
  HoldingsSnapshotSchema.parse({
    version: 0,
    holdings: [],
    totalCostMinor: '0',
    currency: 'INR',
    scale: 2,
    provenance: 'user-entered-unverified',
    updatedAt: null,
  });
function identifier(id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new BadRequestException('Invalid report ID.');
}
function mapJob(row: Record<string, unknown>): ReportJob {
  return ReportJobSchema.parse({
    id: row.id,
    label: row.label,
    status: row.status,
    version: row.version,
    requestedAt: (row.requested_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    attempts: row.attempts,
    nextAttemptAt: (row.next_attempt_at as Date | null)?.toISOString() ?? null,
    message: row.message,
    snapshot: row.snapshot,
    report: row.report ?? null,
  });
}
const selection =
  'SELECT j.*,r.payload AS report FROM record_report_jobs j LEFT JOIN record_reports r ON r.job_id=j.id';
export async function exportRecordReports(
  c: pg.PoolClient,
  userId: string,
  includeDeletions = true,
) {
  const result = await c.query(
    `${selection} WHERE j.user_id=$1 ORDER BY j.requested_at DESC,j.id DESC`,
    [userId],
  );
  const removed = includeDeletions
    ? await c.query(
        'SELECT id,deleted_at FROM record_report_deletions WHERE user_id=$1 ORDER BY deleted_at,id',
        [userId],
      )
    : { rows: [] };
  return ReportJobsSchema.parse({
    jobs: result.rows.map(mapJob),
    capacity: { used: result.rows.length, limit: 100 },
    deletions: removed.rows.map((r) => ({
      id: r.id,
      deletedAt: r.deleted_at.toISOString(),
    })),
  });
}
@Injectable()
export class ReportsStore {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  async list(cookie?: string) {
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      return exportRecordReports(c, user.id, false);
    });
  }
  async get(id: string, cookie?: string) {
    identifier(id);
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const r = await c.query(`${selection} WHERE j.id=$1 AND j.user_id=$2`, [
        id,
        user.id,
      ]);
      if (!r.rows[0]) throw new NotFoundException('Report not found.');
      return mapJob(r.rows[0]);
    });
  }
  async request(body: unknown, cookie?: string) {
    const parsed = ReportRequestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Enter a report label and confirm snapshot storage.',
      );
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        parsed.data.requestId,
      ]);
      await this.account.require(c, cookie);
      const deleted = await c.query(
        'SELECT user_id FROM record_report_deletions WHERE id=$1',
        [parsed.data.requestId],
      );
      if (deleted.rows[0]) {
        if (deleted.rows[0].user_id !== user.id)
          throw new NotFoundException('Report not found.');
        throw new GoneException(
          'This report was deleted. Use a new request for a new snapshot.',
        );
      }
      const old = await c.query(`${selection} WHERE j.id=$1`, [
        parsed.data.requestId,
      ]);
      if (old.rows[0]) {
        if (old.rows[0].user_id !== user.id)
          throw new NotFoundException('Report not found.');
        if (
          old.rows[0].label !== parsed.data.label ||
          JSON.stringify(
            reportSelections(ReportSnapshotSchema.parse(old.rows[0].snapshot)),
          ) !== JSON.stringify(parsed.data.researchConnections ?? [])
        )
          throw new ConflictException(
            'This request ID already has a different label or research connection selection.',
          );
        return mapJob(old.rows[0]);
      }
      const count = await c.query(
        'SELECT count(*)::int AS count FROM record_report_jobs WHERE user_id=$1',
        [user.id],
      );
      if (count.rows[0].count >= 100)
        throw new BadRequestException(
          'Report history has reached its 100-record limit.',
        );
      const budget = await c.query(
        "INSERT INTO record_report_request_limits(user_id,window_start,used) VALUES($1,now(),1) ON CONFLICT(user_id) DO UPDATE SET window_start=CASE WHEN record_report_request_limits.window_start<=now()-interval '1 hour' THEN now() ELSE record_report_request_limits.window_start END,used=CASE WHEN record_report_request_limits.window_start<=now()-interval '1 hour' THEN 1 ELSE record_report_request_limits.used+1 END WHERE record_report_request_limits.window_start<=now()-interval '1 hour' OR record_report_request_limits.used<100 RETURNING used",
        [user.id],
      );
      if (!budget.rows[0])
        throw new HttpException(
          'New report request limit reached. Try again after one hour. Existing reports can still be deleted.',
          429,
        );
      const goals = await c.query(
        'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.id',
        [user.id],
      );
      const holdings = await c.query(
        'SELECT r.payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
        [user.id],
      );
      const allocations = await c.query(
        'SELECT r.payload FROM app_goal_allocations a JOIN app_goal_allocation_revisions r ON r.user_id=a.user_id AND r.version=a.version WHERE a.user_id=$1',
        [user.id],
      );
      let snapshot = ReportSnapshotSchema.parse({
        capturedAt: new Date().toISOString(),
        goals: goals.rows.map((r) => r.payload),
        holdings: holdings.rows[0]?.payload ?? emptyHoldings(),
        allocations: allocations.rows[0]?.payload ?? emptyAllocation(),
      });
      if (parsed.data.researchConnections) {
        try {
          const researchConnections = await captureReportConnections(
            c,
            user.id,
            parsed.data.researchConnections,
            snapshot,
          );
          // Source publication may have held this request past session expiry.
          await this.account.require(c, cookie);
          snapshot = ReportSnapshotSchema.parse({
            ...snapshot,
            capturedAt: researchConnections.evaluatedAt,
            researchConnections,
          });
        } catch (error) {
          if (error instanceof ReportSelectionError)
            throw new HttpException(error.message, error.status);
          throw error;
        }
      }
      const result = await c.query(
        'INSERT INTO record_report_jobs(id,user_id,label,snapshot) VALUES($1,$2,$3,$4) RETURNING *',
        [
          parsed.data.requestId,
          user.id,
          parsed.data.label,
          JSON.stringify(snapshot),
        ],
      );
      return mapJob(result.rows[0]);
    });
  }
  async mutate(
    id: string,
    body: unknown,
    action: 'cancel' | 'retry',
    cookie?: string,
  ) {
    identifier(id);
    const input = ReportMutationSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException('Provide the current report version.');
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      // Match request/delete ordering and serialize recovery before job waits.
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const r = await c.query(
        'SELECT * FROM record_report_jobs WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [id, user.id],
      );
      await this.account.require(c, cookie);
      const row = r.rows[0];
      if (!row) throw new NotFoundException('Report not found.');
      if (row.version !== input.data.expectedVersion)
        throw new ConflictException('Report changed. Refresh its status.');
      if (
        (action === 'cancel' && !['queued', 'running'].includes(row.status)) ||
        (action === 'retry' && row.status !== 'failed')
      )
        throw new ConflictException('This report cannot perform that action.');
      const result = await c.query(
        "UPDATE record_report_jobs SET status=$2,version=version+1,updated_at=now(),lease_id=NULL,lease_until=NULL,next_attempt_at=CASE WHEN $2='queued' THEN now() ELSE NULL END,attempts=CASE WHEN $2='queued' THEN 0 ELSE attempts END,message=$3 WHERE id=$1 RETURNING *",
        [
          id,
          action === 'cancel' ? 'cancelled' : 'queued',
          action === 'cancel'
            ? 'Cancelled before issuance.'
            : 'Retry requested for the original snapshot.',
        ],
      );
      return mapJob(result.rows[0]);
    });
  }
  async remove(id: string, body: unknown, cookie?: string) {
    identifier(id);
    const input = ReportDeleteInputSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException(
        'Confirm deletion with the current report version.',
      );
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
      await this.account.require(c, cookie);
      const removed = await c.query(
        'SELECT user_id,deleted_at FROM record_report_deletions WHERE id=$1',
        [id],
      );
      if (removed.rows[0]) {
        if (removed.rows[0].user_id !== user.id)
          throw new NotFoundException('Report not found.');
        return ReportDeletionSchema.parse({
          id,
          deletedAt: removed.rows[0].deleted_at.toISOString(),
        });
      }
      const found = await c.query(
        'SELECT status,version FROM record_report_jobs WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [id, user.id],
      );
      await this.account.require(c, cookie);
      const job = found.rows[0];
      if (!job) throw new NotFoundException('Report not found.');
      if (job.version !== input.data.expectedVersion)
        throw new ConflictException('Report changed. Refresh before deleting.');
      if (!['succeeded', 'failed', 'cancelled'].includes(job.status))
        throw new ConflictException(
          'Cancel preparation before deleting this report.',
        );
      const receipt = await c.query(
        'INSERT INTO record_report_deletions(id,user_id) VALUES($1,$2) RETURNING deleted_at',
        [id, user.id],
      );
      await c.query('DELETE FROM record_report_jobs WHERE id=$1', [id]);
      return ReportDeletionSchema.parse({
        id,
        deletedAt: receipt.rows[0].deleted_at.toISOString(),
      });
    });
  }
  async claim() {
    return this.account.transaction(async (c) => {
      await c.query(
        "UPDATE record_report_jobs SET status='failed',version=version+1,updated_at=now(),next_attempt_at=NULL,lease_id=NULL,lease_until=NULL,message='Preparation stopped after three attempts. Retry explicitly when ready.' WHERE status='running' AND lease_until<=now() AND attempts>=3",
      );
      const result = await c.query(
        "SELECT * FROM record_report_jobs WHERE attempts<3 AND ((status='queued' AND next_attempt_at<=now()) OR (status='running' AND lease_until<=now())) ORDER BY requested_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",
      );
      const row = result.rows[0];
      if (!row) return null;
      const lease = randomUUID();
      await c.query(
        "UPDATE record_report_jobs SET status='running',attempts=attempts+1,version=version+1,updated_at=now(),lease_id=$2,lease_until=now()+interval '30 seconds',message='Preparing the captured saved records.' WHERE id=$1",
        [row.id, lease],
      );
      return {
        id: row.id as string,
        label: row.label as string,
        snapshot: row.snapshot as unknown,
        lease,
      };
    });
  }
  async finish(id: string, lease: string, report: RecordReport) {
    return this.account.transaction(async (c) => {
      const row = await c.query(
        "SELECT id FROM record_report_jobs WHERE id=$1 AND lease_id=$2 AND status='running' AND lease_until>now() FOR UPDATE",
        [id, lease],
      );
      if (!row.rows[0]) return;
      await c.query(
        'INSERT INTO record_reports(job_id,payload) VALUES($1,$2) ON CONFLICT(job_id) DO NOTHING',
        [id, JSON.stringify(report)],
      );
      await c.query(
        "UPDATE record_report_jobs SET status='succeeded',version=version+1,updated_at=now(),lease_id=NULL,lease_until=NULL,next_attempt_at=NULL,message='Your immutable saved-record review is ready.' WHERE id=$1",
        [id],
      );
    });
  }
  async fail(id: string, lease: string) {
    return this.account.transaction(async (c) => {
      await c.query(
        "UPDATE record_report_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,version=version+1,updated_at=now(),next_attempt_at=CASE WHEN attempts>=3 THEN NULL ELSE now()+interval '10 seconds' END,lease_id=NULL,lease_until=NULL,message='Preparation interrupted; bounded retry preserves the original snapshot.' WHERE id=$1 AND lease_id=$2 AND status='running'",
        [id, lease],
      );
    });
  }
  async workOne() {
    const claim = await this.claim();
    if (!claim) return false;
    try {
      await this.finish(
        claim.id,
        claim.lease,
        issueRecordReport(
          claim.id,
          claim.label,
          ReportSnapshotSchema.parse(claim.snapshot),
          new Date().toISOString(),
        ),
      );
    } catch {
      await this.fail(claim.id, claim.lease);
    }
    return true;
  }
}
@Controller('account/reports')
export class ReportsController {
  constructor(
    @Inject(ReportsStore) private readonly store: ReportsStore,
    @Inject(STORE) private readonly account: AccountStore,
  ) {}
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.list(cookie);
  }
  @Post() request(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.request(body, cookie);
  }
  @Delete(':id') remove(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.remove(id, body, cookie);
  }
  @Get(':id') get(@Param('id') id: string, @Headers('cookie') cookie?: string) {
    return this.store.get(id, cookie);
  }
  @Get(':id/download') async download(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    const job = await this.store.get(id, cookie);
    if (!job.report)
      throw new ConflictException('Report is not ready to download.');
    return job.report;
  }
  @Post(':id/cancel') cancel(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.mutate(id, body, 'cancel', cookie);
  }
  @Post(':id/retry') retry(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    this.account.origin(origin);
    return this.store.mutate(id, body, 'retry', cookie);
  }
}
