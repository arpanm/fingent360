CREATE TABLE event_scenarios (
 id uuid PRIMARY KEY, head_version integer NOT NULL CHECK(head_version>0),
 published_version integer, state text NOT NULL CHECK(state IN ('draft','published','withdrawn')),
 reviewed_at timestamptz
);
CREATE TABLE event_scenario_versions (
 scenario_id uuid NOT NULL REFERENCES event_scenarios(id), version integer NOT NULL,
 request_id uuid NOT NULL UNIQUE, fingerprint text NOT NULL, actor_hash text NOT NULL,
 payload jsonb NOT NULL, PRIMARY KEY(scenario_id,version)
);
CREATE TABLE event_scenario_reviews (
 request_id uuid PRIMARY KEY, scenario_id uuid NOT NULL REFERENCES event_scenarios(id),
 version integer NOT NULL, decision text NOT NULL CHECK(decision IN ('publish','withdraw')),
 reason text NOT NULL, actor_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(scenario_id,version) REFERENCES event_scenario_versions(scenario_id,version)
);
CREATE TRIGGER event_scenario_version_immutable BEFORE UPDATE OR DELETE ON event_scenario_versions FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER event_scenario_review_immutable BEFORE UPDATE OR DELETE ON event_scenario_reviews FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
