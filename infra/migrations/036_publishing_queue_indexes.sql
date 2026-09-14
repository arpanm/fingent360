-- Add access paths for the bounded current-head queue without changing editions.
-- Historical revisions remain immutable; the head join still selects one version.
CREATE INDEX IF NOT EXISTS discovery_versions_queue_order
  ON discovery_versions (created_at DESC, item_id COLLATE "C" DESC)
  INCLUDE (version);

CREATE INDEX IF NOT EXISTS discovery_runs_queue_latest
  ON discovery_runs (started_at DESC, id DESC);
