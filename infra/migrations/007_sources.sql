CREATE TABLE IF NOT EXISTS research_sources (
  id uuid PRIMARY KEY,
  revision integer NOT NULL CHECK (revision > 0)
);
CREATE TABLE IF NOT EXISTS research_source_revisions (
  source_id uuid NOT NULL REFERENCES research_sources(id),
  revision integer NOT NULL CHECK (revision > 0),
  data jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL DEFAULT 'research_operator',
  PRIMARY KEY (source_id, revision)
);
CREATE OR REPLACE FUNCTION prevent_source_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Source revisions are append only';
END;
$$;
DROP TRIGGER IF EXISTS research_source_revision_immutable ON research_source_revisions;
CREATE TRIGGER research_source_revision_immutable BEFORE UPDATE OR DELETE ON research_source_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_source_revision_mutation();
