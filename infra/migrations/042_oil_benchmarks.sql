CREATE TABLE oil_benchmark_editions (
 edition integer PRIMARY KEY CHECK(edition>0),
 retrieved_at timestamptz NOT NULL,
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 canonical_hash text NOT NULL CHECK(canonical_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL
);
CREATE TABLE oil_benchmark_observations (
 edition integer NOT NULL REFERENCES oil_benchmark_editions(edition),
 series text NOT NULL CHECK(series IN ('BRENT','WTI')),
 period text NOT NULL CHECK(period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 value numeric(13,1),
 source_value text,
 CHECK((value IS NULL)=(source_value IS NULL)),
 PRIMARY KEY(edition,series,period)
);
CREATE TABLE oil_benchmark_head (
 id text PRIMARY KEY CHECK(id='world-bank-oil-benchmarks'),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 edition integer REFERENCES oil_benchmark_editions(edition),
 published_edition integer REFERENCES oil_benchmark_editions(edition),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawn')),
 checked_at timestamptz, reviewed_at timestamptz,
 CHECK(status<>'published' OR published_edition IS NOT NULL)
);
INSERT INTO oil_benchmark_head(id) VALUES('world-bank-oil-benchmarks');
CREATE TABLE oil_benchmark_runs (
 request_id uuid PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
 category text NOT NULL CHECK(category IN ('pending','changed','unchanged','fetch','parse','storage','interrupted')),
 edition integer REFERENCES oil_benchmark_editions(edition),
 source_hash text CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 observation_count integer NOT NULL DEFAULT 0 CHECK(observation_count BETWEEN 0 AND 2400),
 CHECK((status='running')=(finished_at IS NULL))
);
CREATE TABLE oil_benchmark_reviews (
 request_id uuid PRIMARY KEY,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 edition integer NOT NULL REFERENCES oil_benchmark_editions(edition),
 status text NOT NULL CHECK(status IN ('published','withdrawn')),
 head_version integer NOT NULL UNIQUE,
 reviewed_at timestamptz NOT NULL,
 payload jsonb NOT NULL
);
CREATE INDEX oil_benchmark_public_editions ON oil_benchmark_reviews(edition DESC) WHERE status='published';
CREATE FUNCTION protect_oil_benchmark_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Oil numerical editions and review receipts are immutable'; END; $$;
CREATE TRIGGER oil_benchmark_editions_immutable BEFORE UPDATE OR DELETE ON oil_benchmark_editions FOR EACH ROW EXECUTE FUNCTION protect_oil_benchmark_immutable();
CREATE TRIGGER oil_benchmark_observations_immutable BEFORE UPDATE OR DELETE ON oil_benchmark_observations FOR EACH ROW EXECUTE FUNCTION protect_oil_benchmark_immutable();
CREATE TRIGGER oil_benchmark_reviews_immutable BEFORE UPDATE OR DELETE ON oil_benchmark_reviews FOR EACH ROW EXECUTE FUNCTION protect_oil_benchmark_immutable();
CREATE FUNCTION protect_oil_benchmark_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='running' AND NEW.status<>'running'
   AND OLD.request_id=NEW.request_id AND OLD.started_at=NEW.started_at THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Completed oil capture receipts are immutable';
END; $$;
CREATE TRIGGER oil_benchmark_runs_immutable BEFORE UPDATE OR DELETE ON oil_benchmark_runs FOR EACH ROW EXECUTE FUNCTION protect_oil_benchmark_run();
