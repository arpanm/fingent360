CREATE TABLE reading_follow_configs(user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,payload jsonb NOT NULL);
CREATE TABLE reading_follow_items(user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,item_id text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(user_id,item_id));
CREATE TABLE reading_follow_events(sequence bigserial PRIMARY KEY,user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,request_id uuid,payload jsonb NOT NULL,UNIQUE(user_id,request_id));
CREATE INDEX reading_follow_events_owner ON reading_follow_events(user_id,sequence);
CREATE FUNCTION protect_reading_follow_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF; RAISE EXCEPTION 'Reading follow history is immutable until account deletion'; END; $$;
CREATE TRIGGER reading_follow_event_immutable BEFORE UPDATE OR DELETE ON reading_follow_events FOR EACH ROW EXECUTE FUNCTION protect_reading_follow_event();
