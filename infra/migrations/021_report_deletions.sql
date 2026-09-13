CREATE TABLE IF NOT EXISTS record_report_deletions (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_report_deletions_owner ON record_report_deletions(user_id);
CREATE TABLE IF NOT EXISTS record_report_request_limits (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 window_start timestamptz NOT NULL,
 used integer NOT NULL CHECK(used BETWEEN 1 AND 100)
);
