import { decryptConnectionRows } from './private-connections.js';
import type { PrivateDataKeys } from './private-data-crypto.js';
import type pg from 'pg';
import {
  FeedItemSchema,
  ResearchConnectionRevisionSchema,
  connectionSource,
  connectionTargets,
  connectionView,
  captureReportResearch,
  type ReportConnectionSelection,
  type ReportSnapshot,
} from '@fingent360/contracts';
// Caller holds the account row before entering; source locks follow in ID order.
export async function captureReportConnections(
  c: pg.PoolClient,
  userId: string,
  selected: ReportConnectionSelection[],
  financial: ReportSnapshot,
  keys: PrivateDataKeys,
) {
  const result = await c.query(
    'SELECT r.* FROM app_research_connections h JOIN app_research_connection_revisions r ON r.connection_id=h.id AND r.version=h.version WHERE h.user_id=$1 AND h.id=ANY($2::uuid[]) AND NOT h.removed ORDER BY h.id',
    [userId, selected.map((s) => s.id)],
  );
  await decryptConnectionRows(
    c,
    'connection-revision',
    userId,
    result.rows,
    keys,
  );
  const revisions = result.rows.map((row) =>
    ResearchConnectionRevisionSchema.parse(row.payload),
  );
  const ids = [...new Set(revisions.map((r) => r.source.itemId))].sort();
  await c.query(
    'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
    [ids],
  );
  const sourceRows = await c.query(
    "SELECT v.data FROM discovery_items i JOIN LATERAL (SELECT data FROM discovery_versions WHERE item_id=i.id AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1) v ON true WHERE i.id=ANY($1::text[])",
    [ids],
  );
  const sources = sourceRows.rows.flatMap((row) => {
    const receipt = connectionSource(FeedItemSchema.parse(row.data));
    return receipt ? [receipt] : [];
  });
  const targets = connectionTargets(financial.holdings, financial.goals);
  return captureReportResearch(
    selected,
    revisions.map((r) => connectionView(r, sources, targets)),
    new Date().toISOString(),
    null,
  );
}
