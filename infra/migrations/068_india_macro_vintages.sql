CREATE TABLE india_macro_editions(id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('cpi','calendar')),fingerprint text NOT NULL,actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE india_macro_reviews(request_id uuid PRIMARY KEY,edition_id uuid NOT NULL REFERENCES india_macro_editions(id),actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX india_macro_review_latest ON india_macro_reviews(edition_id,created_at DESC,request_id DESC);
CREATE TRIGGER india_macro_editions_immutable BEFORE UPDATE OR DELETE ON india_macro_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER india_macro_reviews_immutable BEFORE UPDATE OR DELETE ON india_macro_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TABLE india_macro_attempts(id uuid PRIMARY KEY,fingerprint text NOT NULL,hash text NOT NULL,reason text NOT NULL,actor_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TRIGGER india_macro_attempts_immutable BEFORE UPDATE OR DELETE ON india_macro_attempts FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
