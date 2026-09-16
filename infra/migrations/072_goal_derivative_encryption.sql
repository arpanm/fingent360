ALTER TABLE app_goal_comparisons ALTER COLUMN payload DROP NOT NULL;
ALTER TABLE app_goal_comparisons ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_goal_comparisons ADD COLUMN content_hash text;
ALTER TABLE app_goal_adoptions ALTER COLUMN payload DROP NOT NULL;
ALTER TABLE app_goal_adoptions ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_goal_adoptions ADD COLUMN content_hash text;
ALTER TABLE app_goal_feasibility ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_goal_feasibility ADD COLUMN content_hash text;
ALTER TABLE app_goal_feasibility DROP CONSTRAINT app_goal_feasibility_check;
ALTER TABLE app_goal_comparisons ADD CONSTRAINT comparison_private_copy CHECK ((payload IS NOT NULL AND encrypted_payload IS NULL AND content_hash IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL AND content_hash IS NOT NULL AND content_hash ~ '^[a-f0-9]{64}$'));
ALTER TABLE app_goal_adoptions ADD CONSTRAINT adoption_private_copy CHECK ((payload IS NOT NULL AND encrypted_payload IS NULL AND content_hash IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL AND content_hash IS NOT NULL AND content_hash ~ '^[a-f0-9]{64}$'));
ALTER TABLE app_goal_feasibility ADD CONSTRAINT feasibility_private_copy CHECK ((deleted_at IS NOT NULL AND payload IS NULL AND encrypted_payload IS NULL) OR (deleted_at IS NULL AND ((payload IS NOT NULL AND encrypted_payload IS NULL AND content_hash IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL AND content_hash IS NOT NULL AND content_hash ~ '^[a-f0-9]{64}$'))));
CREATE OR REPLACE FUNCTION protect_goal_comparison_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND NEW.payload IS NULL AND NEW.encrypted_payload IS NOT NULL AND NEW.content_hash IS NOT NULL
 AND (to_jsonb(NEW)-'payload'-'encrypted_payload'-'content_hash')=(to_jsonb(OLD)-'payload'-'encrypted_payload'-'content_hash')
 AND ((OLD.payload IS NOT NULL AND OLD.encrypted_payload IS NULL AND OLD.content_hash IS NULL) OR (OLD.payload IS NULL AND OLD.content_hash=NEW.content_hash)) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Goal comparison receipts are immutable until account deletion';
END; $$;
CREATE OR REPLACE FUNCTION protect_goal_feasibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'payload'-'encrypted_payload'-'content_hash'-'deleted_at')=(to_jsonb(OLD)-'payload'-'encrypted_payload'-'content_hash'-'deleted_at') THEN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.payload IS NULL AND NEW.encrypted_payload IS NULL AND NEW.content_hash IS NOT DISTINCT FROM OLD.content_hash THEN RETURN NEW; END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL AND NEW.payload IS NULL AND NEW.encrypted_payload IS NOT NULL AND NEW.content_hash IS NOT NULL AND ((OLD.payload IS NOT NULL AND OLD.encrypted_payload IS NULL AND OLD.content_hash IS NULL) OR (OLD.payload IS NULL AND OLD.content_hash=NEW.content_hash)) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Assessment is immutable except explicit owned deletion or encrypted rewrap';
END; $$;
