CREATE TABLE cpi_expectation_editions(id uuid PRIMARY KEY,fingerprint text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE cpi_expectation_reviews(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid UNIQUE NOT NULL,edition_id uuid NOT NULL REFERENCES cpi_expectation_editions(id),actor_id text NOT NULL,decision text NOT NULL CHECK(decision IN('publish','withdraw')),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX cpi_expectation_review_head ON cpi_expectation_reviews(edition_id,seq DESC);
CREATE TABLE cpi_expectation_views(hash text PRIMARY KEY,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TRIGGER cpi_expectation_editions_immutable BEFORE UPDATE OR DELETE ON cpi_expectation_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER cpi_expectation_reviews_immutable BEFORE UPDATE OR DELETE ON cpi_expectation_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER cpi_expectation_views_immutable BEFORE UPDATE OR DELETE ON cpi_expectation_views FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
