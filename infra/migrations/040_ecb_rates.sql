CREATE TABLE ecb_rate_editions (
 edition integer PRIMARY KEY CHECK(edition>0),
 retrieved_at timestamptz NOT NULL,
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 canonical_hash text NOT NULL CHECK(canonical_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL
);
CREATE TABLE ecb_rate_observations (
 edition integer NOT NULL REFERENCES ecb_rate_editions(edition),
 series text NOT NULL CHECK(series IN ('DFR','MRR_FR','MLFR')),
 effective_on date NOT NULL CHECK(effective_on>='2008-10-15' AND effective_on<='2200-12-31'),
 value numeric(20,7) NOT NULL,
 PRIMARY KEY(edition,series,effective_on)
);
CREATE TABLE ecb_rate_head (
 id text PRIMARY KEY CHECK(id='ecb-policy-rates'),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 edition integer REFERENCES ecb_rate_editions(edition),
 published_edition integer REFERENCES ecb_rate_editions(edition),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawn')),
 checked_at timestamptz, reviewed_at timestamptz,
 CHECK(status<>'published' OR published_edition IS NOT NULL)
);
INSERT INTO ecb_rate_head(id) VALUES('ecb-policy-rates');
CREATE TABLE ecb_rate_runs (
 request_id uuid PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
 category text NOT NULL CHECK(category IN ('pending','changed','unchanged','fetch','parse','storage','interrupted')),
 edition integer REFERENCES ecb_rate_editions(edition),
 source_hash text CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 observation_count integer NOT NULL DEFAULT 0 CHECK(observation_count BETWEEN 0 AND 1500),
 CHECK((status='running')=(finished_at IS NULL))
);
CREATE TABLE ecb_rate_reviews (
 request_id uuid PRIMARY KEY,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 edition integer NOT NULL REFERENCES ecb_rate_editions(edition),
 status text NOT NULL CHECK(status IN ('published','withdrawn')),
 head_version integer NOT NULL UNIQUE,
 reviewed_at timestamptz NOT NULL,
 payload jsonb NOT NULL
);
CREATE INDEX ecb_rate_public_editions ON ecb_rate_reviews(edition DESC) WHERE status='published';
CREATE FUNCTION protect_ecb_rate_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ECB numerical editions and review receipts are immutable'; END; $$;
CREATE TRIGGER ecb_rate_editions_immutable BEFORE UPDATE OR DELETE ON ecb_rate_editions FOR EACH ROW EXECUTE FUNCTION protect_ecb_rate_immutable();
CREATE TRIGGER ecb_rate_observations_immutable BEFORE UPDATE OR DELETE ON ecb_rate_observations FOR EACH ROW EXECUTE FUNCTION protect_ecb_rate_immutable();
CREATE TRIGGER ecb_rate_reviews_immutable BEFORE UPDATE OR DELETE ON ecb_rate_reviews FOR EACH ROW EXECUTE FUNCTION protect_ecb_rate_immutable();
CREATE FUNCTION protect_ecb_rate_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='running' AND NEW.status<>'running'
   AND OLD.request_id=NEW.request_id AND OLD.started_at=NEW.started_at THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Completed ECB refresh receipts are immutable';
END; $$;
CREATE TRIGGER ecb_rate_runs_immutable BEFORE UPDATE OR DELETE ON ecb_rate_runs FOR EACH ROW EXECUTE FUNCTION protect_ecb_rate_run();
