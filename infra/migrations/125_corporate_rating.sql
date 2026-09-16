CREATE TABLE corporate_rating_editions(id uuid PRIMARY KEY,hash text NOT NULL,error text,permission_reference text NOT NULL,prepared_by text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE corporate_rating_reviews(seq bigserial PRIMARY KEY,request_id uuid UNIQUE NOT NULL,edition_id uuid NOT NULL REFERENCES corporate_rating_editions(id),fingerprint text NOT NULL,decision text NOT NULL CHECK(decision IN ('publish','withdraw')),reason text NOT NULL,reviewer text NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX corporate_rating_latest ON corporate_rating_reviews(edition_id,seq DESC);
CREATE TRIGGER corporate_rating_editions_immutable BEFORE UPDATE OR DELETE ON corporate_rating_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER corporate_rating_reviews_immutable BEFORE UPDATE OR DELETE ON corporate_rating_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
