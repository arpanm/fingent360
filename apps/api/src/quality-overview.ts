import { namedSessionCondition } from './named-operator-store.js';
import { OperatorRead } from './operator-permissions.js';
import { requestMetrics } from './request-observability.js';
import {
  Controller,
  Get,
  Headers,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import {
  summarizeQuality,
  OperationalQualitySchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
@OperatorRead()
@Controller('ops/quality')
export class QualityOverviewController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() async overview(@Headers('cookie') cookie?: string) {
    const actor = await this.ops.require(cookie);
    return this.account.transaction(async (c) => {
      await c.query(
        'SELECT token_hash FROM operator_sessions WHERE token_hash=$1 FOR SHARE',
        [actor],
      );
      const heads = await c.query(
        'SELECT i.id,i.version,v.data FROM discovery_items i LEFT JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version ORDER BY i.id LIMIT 1001',
      );
      const runs = await c.query(
        'SELECT started_at,finished_at,status FROM discovery_runs ORDER BY started_at DESC,id DESC LIMIT 20',
      );
      // Authorize after storage waits: an expired session cannot receive the result.
      const admission = await c.query(
        `SELECT clock_timestamp() AS at FROM operator_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp() AND ${namedSessionCondition}`,
        [actor],
      );
      if (!admission.rowCount)
        throw new UnauthorizedException('Sign in to operations again.');
      const quality = summarizeQuality(
        heads.rows,
        admission.rows[0].at.toISOString(),
        runs.rows.map((row) => ({
          startedAt: row.started_at.toISOString(),
          finishedAt: row.finished_at?.toISOString() ?? null,
          status: row.status,
        })),
      );
      return OperationalQualitySchema.parse({
        ...quality,
        requests: requestMetrics(),
      });
    });
  }
}
