CREATE TABLE ccil_zero_editions(id uuid PRIMARY KEY,hash text NOT NULL,source_url text NOT NULL,retrieved_at timestamptz NOT NULL,data jsonb,error text,prepared_by text NOT NULL,permission_reference text NOT NULL);
CREATE TABLE ccil_zero_reviews(seq bigserial PRIMARY KEY,request_id uuid NOT NULL UNIQUE,edition_id uuid NOT NULL REFERENCES ccil_zero_editions(id),fingerprint text NOT NULL,decision text NOT NULL CHECK(decision IN ('publish','withdraw')),reason text NOT NULL,reviewer text NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ccil_zero_review_head ON ccil_zero_reviews(edition_id,seq DESC);
CREATE TRIGGER ccil_zero_editions_immutable BEFORE UPDATE OR DELETE ON ccil_zero_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER ccil_zero_reviews_immutable BEFORE UPDATE OR DELETE ON ccil_zero_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
