ALTER TABLE record_report_jobs ALTER COLUMN label DROP NOT NULL;
ALTER TABLE record_report_jobs ALTER COLUMN snapshot DROP NOT NULL;
ALTER TABLE record_report_jobs ADD COLUMN encrypted_payload jsonb;
ALTER TABLE record_report_jobs ADD CONSTRAINT report_job_private_copy CHECK ((label IS NOT NULL AND snapshot IS NOT NULL AND encrypted_payload IS NULL) OR (label IS NULL AND snapshot IS NULL AND encrypted_payload IS NOT NULL));
ALTER TABLE record_reports ALTER COLUMN payload DROP NOT NULL;
ALTER TABLE record_reports ADD COLUMN encrypted_payload jsonb;
ALTER TABLE record_reports ADD CONSTRAINT report_private_copy CHECK ((payload IS NOT NULL AND encrypted_payload IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL));

ALTER TABLE report_schedules ADD COLUMN saved_at timestamptz;
UPDATE report_schedules SET saved_at=(payload->>'savedAt')::timestamptz;
ALTER TABLE report_schedules ALTER COLUMN saved_at SET NOT NULL;
ALTER TABLE report_schedule_requests DISABLE TRIGGER schedule_request_immutable;
ALTER TABLE report_schedule_requests ADD COLUMN schedule_id uuid;
ALTER TABLE report_schedule_requests ADD COLUMN schedule_version integer;
ALTER TABLE report_schedule_requests ADD COLUMN schedule_status text;
ALTER TABLE report_schedule_requests ADD COLUMN saved_at timestamptz;
UPDATE report_schedule_requests SET schedule_id=(payload->'schedule'->>'id')::uuid,schedule_version=(payload->'schedule'->>'version')::integer,schedule_status=payload->'schedule'->>'status',saved_at=(payload->'schedule'->>'savedAt')::timestamptz;
ALTER TABLE report_schedule_requests ALTER COLUMN schedule_id SET NOT NULL;
ALTER TABLE report_schedule_requests ALTER COLUMN schedule_version SET NOT NULL;
ALTER TABLE report_schedule_requests ALTER COLUMN schedule_status SET NOT NULL;
ALTER TABLE report_schedule_requests ALTER COLUMN saved_at SET NOT NULL;
ALTER TABLE report_schedule_requests ENABLE TRIGGER schedule_request_immutable;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['report_schedules','report_schedule_editions','report_schedule_requests','report_schedule_occurrences'] LOOP
  EXECUTE format('ALTER TABLE %I ALTER COLUMN payload DROP NOT NULL',t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN encrypted_payload jsonb',t);
  EXECUTE format('ALTER TABLE %I ADD COLUMN content_hash text',t);
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((payload IS NOT NULL AND encrypted_payload IS NULL AND content_hash IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL AND content_hash IS NOT NULL AND content_hash ~ ''^[a-f0-9]{64}$''))',t,t||'_private_copy');
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION protect_schedule_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND NEW.payload IS NULL AND NEW.encrypted_payload IS NOT NULL AND NEW.content_hash IS NOT NULL AND (to_jsonb(NEW)-'payload'-'encrypted_payload'-'content_hash')=(to_jsonb(OLD)-'payload'-'encrypted_payload'-'content_hash') AND ((OLD.payload IS NOT NULL AND OLD.encrypted_payload IS NULL AND OLD.content_hash IS NULL) OR (OLD.payload IS NULL AND OLD.content_hash=NEW.content_hash)) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Schedule receipts are immutable until account deletion';
END; $$;
CREATE FUNCTION fill_legacy_schedule_metadata() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.payload IS NOT NULL THEN
  IF TG_TABLE_NAME='report_schedules' THEN NEW.saved_at=COALESCE(NEW.saved_at,(NEW.payload->>'savedAt')::timestamptz);
  ELSE NEW.schedule_id=COALESCE(NEW.schedule_id,(NEW.payload->'schedule'->>'id')::uuid);NEW.schedule_version=COALESCE(NEW.schedule_version,(NEW.payload->'schedule'->>'version')::integer);NEW.schedule_status=COALESCE(NEW.schedule_status,NEW.payload->'schedule'->>'status');NEW.saved_at=COALESCE(NEW.saved_at,(NEW.payload->'schedule'->>'savedAt')::timestamptz); END IF;
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER legacy_schedule_metadata BEFORE INSERT ON report_schedules FOR EACH ROW EXECUTE FUNCTION fill_legacy_schedule_metadata();
CREATE TRIGGER legacy_schedule_request_metadata BEFORE INSERT ON report_schedule_requests FOR EACH ROW EXECUTE FUNCTION fill_legacy_schedule_metadata();
