CREATE TABLE equity_consolidations(id uuid PRIMARY KEY,old_isin text NOT NULL,new_isin text NOT NULL,actor_id text NOT NULL,fingerprint text NOT NULL,input jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE equity_consolidation_reviews(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid UNIQUE NOT NULL,bridge_id uuid NOT NULL REFERENCES equity_consolidations(id),actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX equity_consolidations_old ON equity_consolidations(old_isin,created_at DESC);
CREATE INDEX equity_consolidations_new ON equity_consolidations(new_isin,created_at DESC);
CREATE TRIGGER equity_consolidations_immutable BEFORE UPDATE OR DELETE ON equity_consolidations FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER equity_consolidation_reviews_immutable BEFORE UPDATE OR DELETE ON equity_consolidation_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
