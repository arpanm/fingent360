CREATE TABLE account_consent_heads (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('external-ai-private-context','reading-personalization','scheduled-record-reviews','automatic-material-checks')),
  payload jsonb NOT NULL,
  PRIMARY KEY(user_id,purpose)
);
CREATE TABLE account_consent_events (
  sequence bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  request_id uuid,
  request jsonb,
  payload jsonb NOT NULL,
  UNIQUE(user_id,request_id)
);
CREATE INDEX account_consent_events_owner ON account_consent_events(user_id,sequence);
CREATE FUNCTION protect_account_consent_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Consent history is immutable until account deletion';
END;
$$;
CREATE TRIGGER account_consent_event_immutable BEFORE UPDATE OR DELETE ON account_consent_events
FOR EACH ROW EXECUTE FUNCTION protect_account_consent_event();
