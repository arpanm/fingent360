CREATE TABLE fund_merger_editions(id uuid PRIMARY KEY, hash text NOT NULL, terms jsonb NOT NULL, error text, permission_reference text NOT NULL, prepared_by text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE fund_merger_reviews(seq bigserial PRIMARY KEY, request_id uuid NOT NULL UNIQUE, edition_id uuid NOT NULL REFERENCES fund_merger_editions(id), fingerprint text NOT NULL, decision text NOT NULL CHECK(decision IN ('publish','withdraw')), mapping jsonb, reason text NOT NULL, reviewer text NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX fund_merger_reviews_latest ON fund_merger_reviews(edition_id,seq DESC);
CREATE TRIGGER fund_merger_editions_immutable BEFORE UPDATE OR DELETE ON fund_merger_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER fund_merger_reviews_immutable BEFORE UPDATE OR DELETE ON fund_merger_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
