CREATE TABLE app_action_centre (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 deleted_at timestamptz,
 PRIMARY KEY(user_id,id),
 CHECK((payload IS NOT NULL AND deleted_at IS NULL) OR (payload IS NULL AND deleted_at IS NOT NULL))
);
CREATE FUNCTION protect_action_centre() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.payload IS NULL
 AND NEW.user_id=OLD.user_id AND NEW.id=OLD.id AND NEW.fingerprint=OLD.fingerprint AND NEW.created_at=OLD.created_at THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Educational comparison is immutable except explicit owned deletion';
END; $$;
CREATE TRIGGER action_centre_immutable BEFORE UPDATE OR DELETE ON app_action_centre FOR EACH ROW EXECUTE FUNCTION protect_action_centre();
