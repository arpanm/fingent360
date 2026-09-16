CREATE TABLE sovereign_bond_editions(id uuid PRIMARY KEY, originals jsonb NOT NULL, error text, permission_reference text NOT NULL, prepared_by text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sovereign_bond_reviews(seq bigserial PRIMARY KEY,request_id uuid UNIQUE NOT NULL,edition_id uuid NOT NULL REFERENCES sovereign_bond_editions(id),fingerprint text NOT NULL,decision text NOT NULL CHECK(decision IN ('publish','withdraw')),reason text NOT NULL,reviewer text NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sovereign_bond_latest ON sovereign_bond_reviews(edition_id,seq DESC);
CREATE TRIGGER sovereign_bond_editions_immutable BEFORE UPDATE OR DELETE ON sovereign_bond_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER sovereign_bond_reviews_immutable BEFORE UPDATE OR DELETE ON sovereign_bond_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
