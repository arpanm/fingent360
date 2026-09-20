CREATE TABLE index_levels_editions(id uuid PRIMARY KEY,actor_id text NOT NULL,fingerprint text NOT NULL,source_hash text NOT NULL,input jsonb NOT NULL,receipt jsonb,error text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK((receipt IS NULL)=(error IS NOT NULL)));
CREATE TABLE index_levels_reviews(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid UNIQUE NOT NULL,edition_id uuid NOT NULL REFERENCES index_levels_editions(id),actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX index_levels_date ON index_levels_editions((receipt->>'effectiveOn'));
CREATE TRIGGER index_levels_editions_immutable BEFORE UPDATE OR DELETE ON index_levels_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER index_levels_reviews_immutable BEFORE UPDATE OR DELETE ON index_levels_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE INDEX index_levels_capture_queue ON index_levels_editions(created_at DESC,id DESC);
