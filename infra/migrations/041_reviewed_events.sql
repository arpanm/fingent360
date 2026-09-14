CREATE TABLE IF NOT EXISTS reviewed_events (
  id uuid PRIMARY KEY,
  head_version integer NOT NULL CHECK(head_version>0),
  published_version integer,
  status text NOT NULL DEFAULT 'never-published' CHECK(status IN ('never-published','published','withdrawn')),
  reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS reviewed_event_versions (
  event_id uuid NOT NULL REFERENCES reviewed_events(id),
  version integer NOT NULL CHECK(version>0),
  payload jsonb NOT NULL,
  PRIMARY KEY(event_id,version)
);
CREATE TABLE IF NOT EXISTS reviewed_event_requests (
  request_id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES reviewed_events(id),
  fingerprint text NOT NULL,
  payload jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS reviewed_event_reviews (
  request_id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES reviewed_events(id),
  fingerprint text NOT NULL,
  payload jsonb NOT NULL
);
CREATE OR REPLACE FUNCTION protect_reviewed_event_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Reviewed event history is immutable'; END;
$$;
CREATE TRIGGER reviewed_event_versions_immutable BEFORE UPDATE OR DELETE ON reviewed_event_versions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER reviewed_event_requests_immutable BEFORE UPDATE OR DELETE ON reviewed_event_requests FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER reviewed_event_reviews_immutable BEFORE UPDATE OR DELETE ON reviewed_event_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
