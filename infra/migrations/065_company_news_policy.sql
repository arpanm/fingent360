CREATE TABLE company_news_inputs (
 item_id text PRIMARY KEY REFERENCES discovery_items(id),
 request_id uuid UNIQUE NOT NULL,
 fingerprint text NOT NULL,
 actor_id text NOT NULL,
 company_name text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE company_news_reviews (
 request_id uuid PRIMARY KEY,
 item_id text NOT NULL REFERENCES company_news_inputs(item_id),
 actor_id text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER company_news_inputs_immutable BEFORE UPDATE OR DELETE ON company_news_inputs FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER company_news_reviews_immutable BEFORE UPDATE OR DELETE ON company_news_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
