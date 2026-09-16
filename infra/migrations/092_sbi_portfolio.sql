CREATE TABLE fund_portfolio_editions(id uuid PRIMARY KEY,hash text NOT NULL,source_url text NOT NULL,retrieved_at timestamptz NOT NULL,portfolio jsonb,error text,prepared_by text NOT NULL,permission_reference text NOT NULL);
CREATE TABLE fund_portfolio_reviews(seq bigserial PRIMARY KEY,request_id uuid NOT NULL UNIQUE,edition_id uuid NOT NULL REFERENCES fund_portfolio_editions(id),fingerprint text NOT NULL,decision text NOT NULL CHECK(decision IN ('publish','withdraw')),mapping jsonb,reason text NOT NULL,acknowledged_discrepancy boolean NOT NULL,reviewer text NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX fund_portfolio_latest_review ON fund_portfolio_reviews(edition_id,seq DESC);

CREATE TRIGGER fund_portfolio_editions_immutable BEFORE UPDATE OR DELETE ON fund_portfolio_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER fund_portfolio_reviews_immutable BEFORE UPDATE OR DELETE ON fund_portfolio_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
