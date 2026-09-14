CREATE TABLE identity_selection_plans(id uuid PRIMARY KEY, fingerprint text NOT NULL, payload jsonb NOT NULL);
CREATE TABLE identity_selection_heads(isin text PRIMARY KEY REFERENCES security_identities(isin), version integer NOT NULL CHECK(version>0));
CREATE TABLE identity_selection_revisions(isin text NOT NULL REFERENCES security_identities(isin), version integer NOT NULL, plan_id uuid NOT NULL UNIQUE REFERENCES identity_selection_plans(id), payload jsonb NOT NULL, PRIMARY KEY(isin,version));
CREATE TRIGGER identity_selection_plans_immutable BEFORE UPDATE OR DELETE ON identity_selection_plans FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER identity_selection_revisions_immutable BEFORE UPDATE OR DELETE ON identity_selection_revisions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
