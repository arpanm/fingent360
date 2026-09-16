CREATE TABLE equity_adjustment_windows(id uuid PRIMARY KEY,isin text NOT NULL,actor_id text NOT NULL,fingerprint text NOT NULL,input jsonb NOT NULL,receipt jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE equity_adjustment_reviews(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid UNIQUE NOT NULL,window_id uuid NOT NULL REFERENCES equity_adjustment_windows(id),actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX equity_adjustment_window_company ON equity_adjustment_windows(isin,created_at DESC);
CREATE TRIGGER equity_adjustment_windows_immutable BEFORE UPDATE OR DELETE ON equity_adjustment_windows FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER equity_adjustment_reviews_immutable BEFORE UPDATE OR DELETE ON equity_adjustment_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
