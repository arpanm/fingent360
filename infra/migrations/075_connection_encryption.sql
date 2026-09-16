ALTER TABLE app_research_connection_revisions DISABLE TRIGGER research_connection_revision_immutable;
ALTER TABLE app_research_connection_revisions ADD COLUMN target_kind text;
UPDATE app_research_connection_revisions SET target_kind=payload->'target'->'binding'->>'kind';
ALTER TABLE app_research_connection_revisions ENABLE TRIGGER research_connection_revision_immutable;
CREATE FUNCTION fill_legacy_connection_kind() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payload IS NOT NULL THEN NEW.target_kind=NEW.payload->'target'->'binding'->>'kind'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER legacy_connection_kind BEFORE INSERT ON app_research_connection_revisions FOR EACH ROW EXECUTE FUNCTION fill_legacy_connection_kind();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['app_research_connection_revisions','app_connection_review_inboxes','app_connection_review_requests'] LOOP
 EXECUTE format('ALTER TABLE %I ALTER COLUMN payload DROP NOT NULL',t);
 EXECUTE format('ALTER TABLE %I ADD COLUMN encrypted_payload jsonb',t);
 EXECUTE format('ALTER TABLE %I ADD COLUMN content_hash text',t);
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((payload IS NOT NULL AND encrypted_payload IS NULL AND content_hash IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL AND content_hash IS NOT NULL AND content_hash ~ ''^[a-f0-9]{64}$''))',t,t||'_private_copy');
END LOOP; END $$;
ALTER TABLE app_impact_traces ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_impact_traces ADD COLUMN content_hash text;
ALTER TABLE app_impact_traces DROP CONSTRAINT app_impact_traces_check;
ALTER TABLE app_impact_traces ADD CONSTRAINT impact_trace_private_copy CHECK ((deleted_at IS NOT NULL AND payload IS NULL AND encrypted_payload IS NULL) OR (deleted_at IS NULL AND ((payload IS NOT NULL AND encrypted_payload IS NULL AND content_hash IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL AND content_hash IS NOT NULL AND content_hash ~ '^[a-f0-9]{64}$'))));
CREATE OR REPLACE FUNCTION protect_research_connection_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_TABLE_NAME='app_research_connection_revisions' AND TG_OP='UPDATE' THEN
 IF NEW.payload IS NULL AND NEW.encrypted_payload IS NOT NULL AND NEW.content_hash IS NOT NULL AND (to_jsonb(NEW)-'payload'-'encrypted_payload'-'content_hash')=(to_jsonb(OLD)-'payload'-'encrypted_payload'-'content_hash') AND ((OLD.payload IS NOT NULL AND OLD.encrypted_payload IS NULL AND OLD.content_hash IS NULL) OR (OLD.payload IS NULL AND OLD.content_hash=NEW.content_hash)) THEN RETURN NEW; END IF; END IF;
 RAISE EXCEPTION 'Research connection receipts are immutable until account deletion'; END; $$;
CREATE OR REPLACE FUNCTION protect_impact_trace() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'payload'-'encrypted_payload'-'content_hash'-'deleted_at')=(to_jsonb(OLD)-'payload'-'encrypted_payload'-'content_hash'-'deleted_at') THEN
 IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.payload IS NULL AND NEW.encrypted_payload IS NULL AND NEW.content_hash IS NOT DISTINCT FROM OLD.content_hash THEN RETURN NEW; END IF;
 IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL AND NEW.payload IS NULL AND NEW.encrypted_payload IS NOT NULL AND NEW.content_hash IS NOT NULL AND ((OLD.payload IS NOT NULL AND OLD.encrypted_payload IS NULL AND OLD.content_hash IS NULL) OR (OLD.payload IS NULL AND OLD.content_hash=NEW.content_hash)) THEN RETURN NEW; END IF; END IF;
 RAISE EXCEPTION 'Impact trace is immutable except owned deletion or encrypted rewrap'; END; $$;
