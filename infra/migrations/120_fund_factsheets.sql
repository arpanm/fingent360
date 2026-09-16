CREATE TABLE fund_factsheet_editions(id uuid PRIMARY KEY, hash text NOT NULL, source_url text NOT NULL, retrieved_at timestamptz NOT NULL, parsed_values jsonb, error text, prepared_by text NOT NULL, permission_reference text NOT NULL);
CREATE TABLE fund_factsheet_reviews(seq bigserial PRIMARY KEY, request_id uuid NOT NULL UNIQUE, edition_id uuid NOT NULL REFERENCES fund_factsheet_editions(id), fingerprint text NOT NULL, decision text NOT NULL CHECK(decision IN ('publish','withdraw')), mappings jsonb NOT NULL, reason text NOT NULL, reviewer text NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX fund_factsheet_review_latest ON fund_factsheet_reviews(edition_id,seq DESC);
CREATE INDEX fund_factsheet_capture_order ON fund_factsheet_editions(retrieved_at DESC,id);
CREATE TRIGGER fund_factsheet_editions_immutable BEFORE UPDATE OR DELETE ON fund_factsheet_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER fund_factsheet_reviews_immutable BEFORE UPDATE OR DELETE ON fund_factsheet_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
