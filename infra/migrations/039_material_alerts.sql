CREATE TABLE material_alert_heads (
  user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL
);
CREATE TABLE material_alert_events (
  sequence bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  request_id uuid,
  request jsonb,
  payload jsonb NOT NULL,
  UNIQUE(user_id, request_id)
);
CREATE INDEX material_alert_events_owner ON material_alert_events(user_id, sequence);
CREATE FUNCTION protect_material_alert_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Material-change history is immutable until account deletion';
END;
$$;
CREATE TRIGGER material_alert_event_immutable BEFORE UPDATE OR DELETE ON material_alert_events
FOR EACH ROW EXECUTE FUNCTION protect_material_alert_event();
