CREATE TABLE equity_action_terms(id uuid PRIMARY KEY,old_isin text NOT NULL,new_isin text NOT NULL,actor_id text NOT NULL,fingerprint text NOT NULL,input jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE equity_action_terms_reviews(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid UNIQUE NOT NULL,action_id uuid NOT NULL REFERENCES equity_action_terms(id),actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX equity_action_terms_old ON equity_action_terms(old_isin,created_at DESC);
CREATE INDEX equity_action_terms_new ON equity_action_terms(new_isin,created_at DESC);
CREATE TRIGGER equity_action_terms_immutable BEFORE UPDATE OR DELETE ON equity_action_terms FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER equity_action_terms_reviews_immutable BEFORE UPDATE OR DELETE ON equity_action_terms_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
