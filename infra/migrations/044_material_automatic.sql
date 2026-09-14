ALTER TABLE material_alert_heads ADD COLUMN automatic_due_at timestamptz;
ALTER TABLE material_alert_heads ADD COLUMN automatic_retry_at timestamptz;
CREATE INDEX material_automatic_due ON material_alert_heads(automatic_due_at)
WHERE automatic_due_at IS NOT NULL;
CREATE TABLE material_worker_observation (
  id integer PRIMARY KEY CHECK(id=1),
  heartbeat_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz
);
INSERT INTO material_worker_observation(id) VALUES(1);
