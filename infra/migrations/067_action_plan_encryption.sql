ALTER TABLE app_action_centre ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_action_centre ADD COLUMN content_hash text CHECK(content_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE app_action_centre DROP CONSTRAINT app_action_centre_check;
ALTER TABLE app_action_centre ADD CONSTRAINT action_centre_storage_state CHECK (
 (deleted_at IS NULL AND ((payload IS NOT NULL AND encrypted_payload IS NULL AND content_hash IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL AND content_hash IS NOT NULL)))
 OR (deleted_at IS NOT NULL AND payload IS NULL AND encrypted_payload IS NULL)
);
CREATE OR REPLACE FUNCTION protect_action_centre() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND NEW.user_id=OLD.user_id AND NEW.id=OLD.id AND NEW.fingerprint=OLD.fingerprint AND NEW.created_at=OLD.created_at THEN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.payload IS NULL AND NEW.encrypted_payload IS NULL THEN RETURN NEW; END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL AND NEW.payload IS NULL AND NEW.encrypted_payload IS NOT NULL AND NEW.content_hash IS NOT NULL THEN
   IF OLD.payload IS NOT NULL AND OLD.encrypted_payload IS NULL AND OLD.content_hash IS NULL THEN RETURN NEW; END IF;
   IF OLD.payload IS NULL AND OLD.encrypted_payload IS NOT NULL AND NEW.content_hash=OLD.content_hash THEN RETURN NEW; END IF;
  END IF;
 END IF;
 RAISE EXCEPTION 'Educational comparison is immutable except encryption maintenance or explicit owned deletion';
END; $$;
