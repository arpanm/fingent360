import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  Post,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DeploymentMonitoringSchema,
  AcknowledgeMonitoringSchema,
  RetireMonitoringProcessesSchema,
} from '@fingent360/contracts';
import type pg from 'pg';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { namedSessionCondition } from './named-operator-store.js';
import { requestMetrics } from './request-observability.js';

@Injectable()
export class DeploymentMonitoringStore {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  private async admission(c: pg.PoolClient, actor: string) {
    const result = await c.query(
      `SELECT token_hash FROM operator_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp() AND ${namedSessionCondition} FOR SHARE`,
      [actor],
    );
    if (!result.rowCount)
      throw new UnauthorizedException('Sign in to operations again.');
  }
  async capture(
    id: string,
    processId: string,
    counters: {
      completed: number;
      serverErrors: number;
      slow: number;
      disconnected: number;
    },
  ) {
    await this.account.transaction(async (c) => {
      await c.query(
        'INSERT INTO deployment_monitor_processes(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET heartbeat_at=clock_timestamp(),retired_at=NULL,retired_by=NULL',
        [processId],
      );
      await c.query(
        'INSERT INTO deployment_monitor_samples(id,process_id,completed,server_errors,slow,disconnected) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',
        [
          id,
          processId,
          counters.completed,
          counters.serverErrors,
          counters.slow,
          counters.disconnected,
        ],
      );
      await this.evaluate(c);
      await c.query(
        "DELETE FROM deployment_monitor_samples WHERE observed_at<clock_timestamp()-interval '7 days'",
      );
      await c.query(
        "DELETE FROM deployment_monitor_incidents WHERE resolved_at<clock_timestamp()-interval '90 days'",
      );
      await c.query(
        "DELETE FROM deployment_monitor_processes p WHERE retired_at<clock_timestamp()-interval '7 days' AND NOT EXISTS(SELECT 1 FROM deployment_monitor_samples s WHERE s.process_id=p.id)",
      );
    });
  }
  async retire(id: string) {
    await this.account.transaction(async (c) => {
      await c.query(
        'UPDATE deployment_monitor_processes SET retired_at=clock_timestamp() WHERE id=$1',
        [id],
      );
    });
  }
  private async totals(c: pg.PoolClient) {
    return (
      await c.query(
        `SELECT count(*)::int AS samples,coalesce(sum(completed),0)::text AS completed,coalesce(sum(server_errors),0)::text AS errors,coalesce(sum(slow),0)::text AS slow,coalesce(sum(disconnected),0)::text AS disconnected FROM deployment_monitor_samples WHERE observed_at>clock_timestamp()-interval '15 minutes'`,
      )
    ).rows[0];
  }
  private async evaluate(c: pg.PoolClient) {
    // Serialize incident transitions across all participating processes.
    await c.query('SELECT pg_advisory_xact_lock(360059)');
    const sums = await this.totals(c);
    const stale = (
      await c.query(
        "SELECT count(*)::int AS n FROM deployment_monitor_processes WHERE retired_at IS NULL AND heartbeat_at<clock_timestamp()-interval '180 seconds'",
      )
    ).rows[0].n;
    for (const [kind, active] of [
      [
        'server-errors',
        BigInt(sums.completed) >= 20n &&
          BigInt(sums.errors) * 100n >= BigInt(sums.completed) * 5n,
      ],
      ['missing-heartbeat', stale > 0],
    ] as const) {
      if (active)
        await c.query(
          'INSERT INTO deployment_monitor_incidents(id,kind) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [randomUUID(), kind],
        );
      else
        await c.query(
          'UPDATE deployment_monitor_incidents SET resolved_at=clock_timestamp() WHERE kind=$1 AND resolved_at IS NULL',
          [kind],
        );
    }
  }
  async overview(actor: string) {
    return this.account.transaction(async (c) => {
      await this.admission(c, actor);
      await this.evaluate(c);
      const totals = await this.totals(c);
      const process = (
        await c.query(
          "SELECT count(*)::int AS n,count(*) FILTER(WHERE heartbeat_at<clock_timestamp()-interval '180 seconds')::int AS stale,max(heartbeat_at) AS latest FROM deployment_monitor_processes WHERE retired_at IS NULL",
        )
      ).rows[0];
      const incidents = await c.query(
        'SELECT * FROM deployment_monitor_incidents ORDER BY (resolved_at IS NULL) DESC,opened_at DESC,id DESC LIMIT 101',
      );
      await this.admission(c, actor);
      return DeploymentMonitoringSchema.parse({
        observedAt: new Date().toISOString(),
        scope: 'participating-api-processes',
        windowMinutes: 15,
        heartbeatBudgetSeconds: 180,
        processes: process.n,
        staleProcesses: process.stale,
        lastHeartbeat: process.latest?.toISOString() ?? null,
        samples: totals.samples,
        completed: Number(totals.completed),
        serverErrors: Number(totals.errors),
        slow: Number(totals.slow),
        disconnected: Number(totals.disconnected),
        incidents: incidents.rows.slice(0, 100).map((r) => ({
          id: r.id,
          kind: r.kind,
          openedAt: r.opened_at.toISOString(),
          resolvedAt: r.resolved_at?.toISOString() ?? null,
          acknowledgedAt: r.acknowledged_at?.toISOString() ?? null,
        })),
        moreIncidents: incidents.rows.length > 100,
      });
    });
  }
  async retireMissing(value: unknown, actor: string) {
    if (!RetireMonitoringProcessesSchema.safeParse(value).success)
      throw new BadRequestException(
        'Confirm the missing processes have been decommissioned.',
      );
    return this.account.transaction(async (c) => {
      await this.admission(c, actor);
      const result = await c.query(
        "UPDATE deployment_monitor_processes SET retired_at=clock_timestamp(),retired_by=$1 WHERE retired_at IS NULL AND heartbeat_at<clock_timestamp()-interval '180 seconds' RETURNING id",
        [actor],
      );
      await this.evaluate(c);
      await this.admission(c, actor);
      return { retired: result.rowCount ?? 0 };
    });
  }
  async acknowledge(value: unknown, actor: string) {
    const parsed = AcknowledgeMonitoringSchema.safeParse(value);
    if (!parsed.success)
      throw new BadRequestException('Choose a valid incident.');
    return this.account.transaction(async (c) => {
      await this.admission(c, actor);
      const result = await c.query(
        'UPDATE deployment_monitor_incidents SET acknowledged_at=coalesce(acknowledged_at,clock_timestamp()),acknowledged_by=coalesce(acknowledged_by,$2) WHERE id=$1 RETURNING id',
        [parsed.data.id, actor],
      );
      if (!result.rowCount)
        throw new NotFoundException(
          'Incident is no longer retained. Refresh monitoring.',
        );
      await this.admission(c, actor);
      return { id: parsed.data.id };
    });
  }
}

@Injectable()
export class DeploymentMonitoringWorker {
  private readonly processId = randomUUID();
  private previous = {
    completed: 0,
    serverErrors: 0,
    slow: 0,
    disconnected: 0,
  };
  private pending:
    | {
        id: string;
        snapshot: DeploymentMonitoringWorker['previous'];
        delta: DeploymentMonitoringWorker['previous'];
      }
    | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<void> | undefined;
  constructor(
    @Inject(DeploymentMonitoringStore)
    private readonly store: DeploymentMonitoringStore,
  ) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => this.startTick(), 60000);
    this.timer.unref();
  }
  private startTick() {
    if (!this.active)
      this.active = this.tick().finally(() => {
        this.active = undefined;
      });
  }
  async tick() {
    if (!this.pending) {
      const snapshot = requestMetrics();
      const delta = {
        completed: snapshot.completed - this.previous.completed,
        serverErrors: snapshot.serverErrors - this.previous.serverErrors,
        slow: snapshot.slow - this.previous.slow,
        disconnected: snapshot.disconnected - this.previous.disconnected,
      };
      this.pending = { id: randomUUID(), snapshot, delta };
    }
    try {
      await this.store.capture(
        this.pending.id,
        this.processId,
        this.pending.delta,
      );
      this.previous = this.pending.snapshot;
      this.pending = undefined;
    } catch {
      // Retain the same receipt for retry; never disclose DB details or report a false success.
      process.stderr.write(
        'Deployment monitoring sample unavailable; retained for retry.\n',
      );
    }
  }
  async onModuleDestroy() {
    await this.onApplicationShutdown();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
    await this.store.retire(this.processId).catch(() => {});
  }
}
@OperatorRead()
@Controller('ops/monitoring')
export class DeploymentMonitoringController {
  constructor(
    @Inject(DeploymentMonitoringStore)
    private readonly store: DeploymentMonitoringStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() async overview(@Headers('cookie') cookie?: string) {
    return this.store.overview(await this.ops.require(cookie));
  }
  @Post('retire-missing')
  @OperatorAction('administer')
  async retireMissing(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    return this.store.retireMissing(body, await this.ops.require(cookie));
  }
  @Post('acknowledge')
  @OperatorAction('administer')
  async acknowledge(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    return this.store.acknowledge(body, await this.ops.require(cookie));
  }
}
