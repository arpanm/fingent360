CREATE TABLE IF NOT EXISTS record_report_jobs (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 label text NOT NULL,
 snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
 version integer NOT NULL DEFAULT 1,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 requested_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 next_attempt_at timestamptz DEFAULT now(),
 lease_id uuid,
 lease_until timestamptz,
 message text NOT NULL DEFAULT 'Waiting to prepare your saved-record review.'
);
CREATE INDEX IF NOT EXISTS record_report_jobs_due ON record_report_jobs(status,next_attempt_at,lease_until);
CREATE TABLE IF NOT EXISTS record_reports (
 job_id uuid PRIMARY KEY REFERENCES record_report_jobs(id) ON DELETE CASCADE,
 payload jsonb NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT now()
);
