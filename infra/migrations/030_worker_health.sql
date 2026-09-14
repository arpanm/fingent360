CREATE TABLE worker_controls (
 worker text PRIMARY KEY CHECK(worker IN ('reports','reminders')),
 paused boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO worker_controls(worker) VALUES('reports'),('reminders');
CREATE TABLE worker_observations (
 worker text PRIMARY KEY REFERENCES worker_controls(worker),
 heartbeat_at timestamptz,
 last_success_at timestamptz,
 last_failure_at timestamptz,
 failure_category text CHECK(failure_category IN ('storage','preparation')),
 CHECK((last_failure_at IS NULL)=(failure_category IS NULL))
);
INSERT INTO worker_observations(worker) VALUES('reports'),('reminders');
CREATE TABLE worker_control_receipts (
 request_id uuid PRIMARY KEY,
 worker text NOT NULL REFERENCES worker_controls(worker),
 version integer NOT NULL CHECK(version>1),
 paused boolean NOT NULL,
 actor_hash text NOT NULL CHECK(actor_hash ~ '^[a-f0-9]{64}$'),
 expected_version integer NOT NULL CHECK(expected_version>0),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(worker,version), CHECK(version=expected_version+1)
);
CREATE INDEX worker_control_receipts_history ON worker_control_receipts(worker,version DESC);
CREATE INDEX record_report_jobs_outstanding_age ON record_report_jobs(requested_at) WHERE status IN ('queued','running');
