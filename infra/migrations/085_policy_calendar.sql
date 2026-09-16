CREATE TABLE IF NOT EXISTS policy_calendar_editions (
  hash text PRIMARY KEY CHECK (hash ~ '^[a-f0-9]{64}$'),
  source_id text NOT NULL CHECK (source_id = 'fomc-calendar'),
  retrieved_at timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS policy_calendar_capture_idx ON policy_calendar_editions(source_id, retrieved_at DESC, hash);
CREATE TRIGGER policy_calendar_immutable BEFORE UPDATE OR DELETE ON policy_calendar_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
