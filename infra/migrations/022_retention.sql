CREATE TABLE retention_runs (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX retention_runs_history ON retention_runs(created_at DESC,id DESC);
CREATE INDEX app_sessions_expiry ON app_sessions(expires_at);
CREATE INDEX operator_login_limits_expiry ON operator_login_limits(reset_at);
CREATE INDEX feedback_rate_limits_expiry ON feedback_rate_limits(window_start);
CREATE INDEX app_holdings_previews_expiry ON app_holdings_previews(expires_at) WHERE confirmed_version IS NULL;
CREATE FUNCTION protect_retention_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Retention records are preserved';
  END IF;
  IF OLD.payload->>'status' = 'completed' THEN
    RAISE EXCEPTION 'Completed retention records are immutable';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.payload->'id' IS DISTINCT FROM OLD.payload->'id'
     OR NEW.payload->'createdAt' IS DISTINCT FROM OLD.payload->'createdAt'
     OR NEW.payload->'cutoffAt' IS DISTINCT FROM OLD.payload->'cutoffAt'
     OR NEW.payload->'policyVersion' IS DISTINCT FROM OLD.payload->'policyVersion'
     OR NEW.payload->'preview' IS DISTINCT FROM OLD.payload->'preview' THEN
    RAISE EXCEPTION 'Retention preview identity and scope are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER retention_record_immutable BEFORE UPDATE OR DELETE ON retention_runs
  FOR EACH ROW EXECUTE FUNCTION protect_retention_record();
