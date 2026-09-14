import { Controller, Get, Headers, Inject, Injectable } from '@nestjs/common';
import {
  automaticMaterial,
  consentActive,
  MaterialWorkerHealthSchema,
  syncMaterialContext,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { readConsent } from './consent-store.js';
import {
  materialContext,
  materialSources,
  readMaterial,
  saveMaterial,
} from './material-alert-store.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead } from './operator-permissions.js';

@Injectable()
export class MaterialWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<void> | undefined;
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.tick().finally(() => {
          this.active = undefined;
        });
    }, 30000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    // Drain workers before database stores close in application-shutdown hooks.
    await this.onApplicationShutdown();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
  async workOne(): Promise<boolean> {
    let selected: { id: string; due: string } | undefined;
    try {
      return await this.store.transaction(async (client) => {
        await client.query("SET LOCAL statement_timeout='5s'");
        const row = (
          await client.query<{ id: string; due: string }>(`
          SELECT u.id,h.automatic_due_at::text AS due FROM app_users u
          JOIN material_alert_heads h ON h.user_id=u.id
          WHERE h.automatic_due_at<=clock_timestamp()
            AND (h.automatic_retry_at IS NULL OR h.automatic_retry_at<=clock_timestamp())
          ORDER BY h.automatic_due_at,u.id LIMIT 1 FOR UPDATE OF u SKIP LOCKED`)
        ).rows[0];
        if (!row) return false;
        selected = row;
        const state = await readMaterial(client, row.id);
        const context = await materialContext(client, row.id);
        const permission = await readConsent(
          client,
          row.id,
          'automatic-material-checks',
        );
        const permitted =
          consentActive(permission, new Date().toISOString()) &&
          permission.version === state.automatic.consentVersion;
        const sources = permitted ? await materialSources(client) : [];
        const at = new Date().toISOString();
        const current = permitted
          ? syncMaterialContext(
              state,
              context.followed,
              context.muted,
              sources,
              at,
            )
          : state;
        const receipt = automaticMaterial(
          current,
          sources,
          at,
          permitted && consentActive(permission, at),
        );
        if (!receipt) return false;
        await saveMaterial(client, row.id, receipt);
        await client.query(
          'UPDATE material_worker_observation SET last_success_at=clock_timestamp() WHERE id=1',
        );
        // Account lock prevents concurrent revoke; natural expiry is checked after the final storage wait.
        if (permitted && !consentActive(permission, new Date().toISOString()))
          throw Error('Purpose expired during check.');
        return true;
      });
    } catch {
      if (selected) {
        const owned = selected;
        await this.store
          .transaction(async (client) => {
            await client.query("SET LOCAL statement_timeout='5s'");
            await client.query(
              'SELECT id FROM app_users WHERE id=$1 FOR UPDATE',
              [owned.id],
            );
            await client.query(
              "UPDATE material_alert_heads SET automatic_retry_at=clock_timestamp()+interval '15 minutes' WHERE user_id=$1 AND automatic_due_at=$2",
              [owned.id, owned.due],
            );
            await client.query(
              'UPDATE material_worker_observation SET last_failure_at=clock_timestamp() WHERE id=1',
            );
          })
          .catch(() => {});
      } else
        await this.store
          .transaction((client) =>
            client.query(
              'UPDATE material_worker_observation SET last_failure_at=clock_timestamp() WHERE id=1',
            ),
          )
          .catch(() => {});
      return !!selected;
    }
  }
  async tick() {
    try {
      await this.store.transaction((client) =>
        client.query(
          'UPDATE material_worker_observation SET heartbeat_at=clock_timestamp() WHERE id=1',
        ),
      );
      for (let count = 0; count < 10; count++)
        if (!(await this.workOne())) break;
    } catch {
      /* Next timer retries unavailable storage; no provider activity. */
    }
  }
}

@OperatorRead()
@Controller('ops/material-worker')
export class MaterialWorkerController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() async read(@Headers('cookie') cookie?: string) {
    await this.ops.require(cookie);
    const result = await this.store.transaction(async (client) => {
      const health = (
        await client.query(
          'SELECT * FROM material_worker_observation WHERE id=1',
        )
      ).rows[0];
      const counts = (
        await client.query(`SELECT count(*) FILTER(WHERE automatic_due_at<=clock_timestamp())::int AS due,
        count(*) FILTER(WHERE automatic_retry_at>clock_timestamp())::int AS retry FROM material_alert_heads`)
      ).rows[0];
      return MaterialWorkerHealthSchema.parse({
        observedAt: new Date().toISOString(),
        heartbeatAt: health.heartbeat_at?.toISOString() ?? null,
        lastSuccessAt: health.last_success_at?.toISOString() ?? null,
        lastFailureAt: health.last_failure_at?.toISOString() ?? null,
        dueAccounts: counts.due,
        retryAccounts: counts.retry,
      });
    });
    await this.ops.require(cookie);
    return result;
  }
}
