CREATE TABLE IF NOT EXISTS discovery_source_runs (
 id uuid PRIMARY KEY,
 run_id uuid NOT NULL REFERENCES discovery_runs(id),
 source_id text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
 message text NOT NULL DEFAULT '',
 checked integer NOT NULL DEFAULT 0 CHECK(checked>=0),
 inserted integer NOT NULL DEFAULT 0 CHECK(inserted>=0)
);
CREATE INDEX IF NOT EXISTS discovery_source_runs_latest ON discovery_source_runs(source_id,started_at DESC);
