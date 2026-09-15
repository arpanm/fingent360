CREATE TABLE research_auto_schedules(source_id text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, interval_minutes integer NOT NULL DEFAULT 360 CHECK(interval_minutes BETWEEN 60 AND 10080), next_at timestamptz NOT NULL DEFAULT now(), last_status text NOT NULL DEFAULT 'never' CHECK(last_status IN ('never','running','succeeded','failed')), last_run_id uuid, message text NOT NULL DEFAULT 'Automatic capture enabled; publication still requires review.');
CREATE TABLE research_auto_runs(id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES research_auto_schedules(source_id), started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, status text NOT NULL CHECK(status IN ('running','succeeded','failed')), discovery_run_id uuid REFERENCES discovery_runs(id), capture_hash text, message text NOT NULL DEFAULT '');
CREATE TABLE research_calendar_editions(hash text PRIMARY KEY, retrieved_at timestamptz NOT NULL, data jsonb NOT NULL);
CREATE TRIGGER research_calendar_immutable BEFORE UPDATE OR DELETE ON research_calendar_editions FOR EACH ROW EXECUTE FUNCTION prevent_discovery_revision_mutation();
CREATE INDEX research_auto_due ON research_auto_schedules(next_at) WHERE enabled;
CREATE TABLE research_publication_plans(id uuid PRIMARY KEY,source_id text NOT NULL,payload jsonb NOT NULL);
CREATE TABLE research_publication_heads(source_id text PRIMARY KEY,version integer NOT NULL,plan_id uuid NOT NULL REFERENCES research_publication_plans(id),payload jsonb NOT NULL);
CREATE TABLE research_publication_approvals(plan_id uuid PRIMARY KEY REFERENCES research_publication_plans(id),payload jsonb NOT NULL);
CREATE TABLE research_publication_receipts(id uuid PRIMARY KEY,run_id uuid NOT NULL REFERENCES research_auto_runs(id),plan_id uuid NOT NULL REFERENCES research_publication_plans(id),item_id text NOT NULL,item_version integer NOT NULL,status text NOT NULL,message text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER research_publication_plans_immutable BEFORE UPDATE OR DELETE ON research_publication_plans FOR EACH ROW EXECUTE FUNCTION prevent_discovery_revision_mutation();
CREATE TRIGGER research_publication_approvals_immutable BEFORE UPDATE OR DELETE ON research_publication_approvals FOR EACH ROW EXECUTE FUNCTION prevent_discovery_revision_mutation();
CREATE TRIGGER research_publication_receipts_immutable BEFORE UPDATE OR DELETE ON research_publication_receipts FOR EACH ROW EXECUTE FUNCTION prevent_discovery_revision_mutation();

-- Keep all exclusion attempts so retry order advances; successful editions remain unique.
CREATE UNIQUE INDEX research_publication_success ON research_publication_receipts(plan_id,item_id,item_version) WHERE status='published';
CREATE INDEX research_publication_attempt_order ON research_publication_receipts(plan_id,item_id,item_version,created_at DESC,id DESC);
CREATE INDEX discovery_auto_source_prefix ON discovery_items(id text_pattern_ops);
CREATE INDEX discovery_auto_drafts ON discovery_versions(item_id,version) WHERE data->>'status'='draft';
