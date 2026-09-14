CREATE TABLE event_extraction_requests (
 id uuid PRIMARY KEY,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 input jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('running','prepared','failed')),
 payload jsonb NOT NULL
);
CREATE TABLE event_extraction_decisions (
 request_id uuid PRIMARY KEY,
 extraction_id uuid NOT NULL UNIQUE REFERENCES event_extraction_requests(id),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL
);
CREATE TABLE event_extraction_remote_window (
 id integer PRIMARY KEY CHECK(id=1),
 starts integer NOT NULL CHECK(starts BETWEEN 1 AND 20),
 resets_at timestamptz NOT NULL
);
CREATE FUNCTION protect_event_extraction_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='running' AND NEW.status IN ('prepared','failed')
   AND OLD.id=NEW.id AND OLD.fingerprint=NEW.fingerprint AND OLD.input=NEW.input THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Completed extraction receipts are immutable';
END; $$;
CREATE TRIGGER event_extraction_requests_immutable BEFORE UPDATE OR DELETE ON event_extraction_requests
 FOR EACH ROW EXECUTE FUNCTION protect_event_extraction_request();
CREATE TRIGGER event_extraction_decisions_immutable BEFORE UPDATE OR DELETE ON event_extraction_decisions
 FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
