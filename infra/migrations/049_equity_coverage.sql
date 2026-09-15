CREATE TABLE equity_editions (
  id uuid PRIMARY KEY, fingerprint text NOT NULL, actor_hash text NOT NULL,
  payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE equity_observations (
  edition_id uuid NOT NULL REFERENCES equity_editions(id), ordinal integer NOT NULL,
  isin text NOT NULL, kind text NOT NULL, effective_on date NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY(edition_id,ordinal)
);
CREATE INDEX equity_observation_company ON equity_observations(isin,effective_on DESC);
CREATE TABLE equity_reviews (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_id uuid UNIQUE NOT NULL,
  edition_id uuid NOT NULL REFERENCES equity_editions(id), actor_hash text NOT NULL,
  decision text NOT NULL CHECK(decision IN ('publish','withdraw')), reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX equity_review_head ON equity_reviews(edition_id,seq DESC);
CREATE TRIGGER equity_editions_immutable BEFORE UPDATE OR DELETE ON equity_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER equity_observations_immutable BEFORE UPDATE OR DELETE ON equity_observations FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER equity_reviews_immutable BEFORE UPDATE OR DELETE ON equity_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
