CREATE TABLE fund_nav_editions(id uuid PRIMARY KEY,fingerprint text NOT NULL,actor_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE fund_nav_observations(edition_id uuid NOT NULL REFERENCES fund_nav_editions(id),scheme_code text NOT NULL,observed_on date NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(edition_id,scheme_code));
CREATE INDEX fund_nav_scheme_history ON fund_nav_observations(scheme_code,observed_on DESC);
CREATE TABLE fund_nav_reviews(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,request_id uuid UNIQUE NOT NULL,edition_id uuid NOT NULL REFERENCES fund_nav_editions(id),actor_id text NOT NULL,decision text NOT NULL CHECK(decision IN('publish','withdraw')),reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX fund_nav_review_head ON fund_nav_reviews(edition_id,seq DESC);
CREATE TRIGGER fund_nav_editions_immutable BEFORE UPDATE OR DELETE ON fund_nav_editions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER fund_nav_observations_immutable BEFORE UPDATE OR DELETE ON fund_nav_observations FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER fund_nav_reviews_immutable BEFORE UPDATE OR DELETE ON fund_nav_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TABLE app_bond_comparisons(user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,id uuid NOT NULL,fingerprint text NOT NULL,payload jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),deleted_at timestamptz,PRIMARY KEY(user_id,id),CHECK((payload IS NULL)=(deleted_at IS NOT NULL)));
