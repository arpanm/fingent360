CREATE TABLE deployment_monitor_processes (
 id uuid PRIMARY KEY,
 heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 retired_at timestamptz,
 retired_by text
);
CREATE TABLE deployment_monitor_samples (
 id uuid PRIMARY KEY,
 process_id uuid NOT NULL REFERENCES deployment_monitor_processes(id),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed bigint NOT NULL CHECK(completed >= 0),
 server_errors bigint NOT NULL CHECK(server_errors >= 0 AND server_errors <= completed),
 slow bigint NOT NULL CHECK(slow >= 0 AND slow <= completed),
 disconnected bigint NOT NULL CHECK(disconnected >= 0)
);
CREATE INDEX deployment_samples_time ON deployment_monitor_samples(observed_at);
CREATE TABLE deployment_monitor_incidents (
 id uuid PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('server-errors','missing-heartbeat')),
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_at timestamptz,
 acknowledged_at timestamptz,
 acknowledged_by text,
 CHECK((acknowledged_at IS NULL) = (acknowledged_by IS NULL))
);
CREATE UNIQUE INDEX deployment_open_incident ON deployment_monitor_incidents(kind) WHERE resolved_at IS NULL;
CREATE INDEX deployment_incident_time ON deployment_monitor_incidents(opened_at DESC);
