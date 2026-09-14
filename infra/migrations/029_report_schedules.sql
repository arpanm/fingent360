CREATE TABLE report_schedules(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,version integer NOT NULL,status text NOT NULL CHECK(status IN ('active','paused','deleted')),next_due_at timestamptz,payload jsonb NOT NULL,UNIQUE(id,user_id));
CREATE INDEX report_schedules_due ON report_schedules(next_due_at) WHERE status='active';
CREATE TABLE report_schedule_editions(seq bigserial UNIQUE,schedule_id uuid NOT NULL,user_id uuid NOT NULL,version integer NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(schedule_id,version),FOREIGN KEY(schedule_id,user_id) REFERENCES report_schedules(id,user_id) ON DELETE CASCADE);
CREATE TABLE report_schedule_requests(seq bigserial UNIQUE,user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,request_id uuid NOT NULL,fingerprint text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(user_id,request_id));
CREATE TABLE report_schedule_occurrences(seq bigserial UNIQUE,id uuid PRIMARY KEY,schedule_id uuid NOT NULL,user_id uuid NOT NULL,schedule_version integer NOT NULL,due_at timestamptz NOT NULL,payload jsonb NOT NULL,UNIQUE(schedule_id,schedule_version,due_at),FOREIGN KEY(schedule_id,user_id) REFERENCES report_schedules(id,user_id) ON DELETE CASCADE);
CREATE FUNCTION protect_schedule_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF; RAISE EXCEPTION 'Schedule receipts are immutable until account deletion'; END; $$;
CREATE TRIGGER schedule_edition_immutable BEFORE UPDATE OR DELETE ON report_schedule_editions FOR EACH ROW EXECUTE FUNCTION protect_schedule_receipt();
CREATE TRIGGER schedule_request_immutable BEFORE UPDATE OR DELETE ON report_schedule_requests FOR EACH ROW EXECUTE FUNCTION protect_schedule_receipt();
CREATE TRIGGER schedule_occurrence_immutable BEFORE UPDATE OR DELETE ON report_schedule_occurrences FOR EACH ROW EXECUTE FUNCTION protect_schedule_receipt();

CREATE INDEX report_schedule_editions_page ON report_schedule_editions(user_id,seq);
CREATE INDEX report_schedule_requests_page ON report_schedule_requests(user_id,seq);
CREATE INDEX report_schedule_occurrences_page ON report_schedule_occurrences(user_id,seq);
