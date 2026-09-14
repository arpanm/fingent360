CREATE TABLE ecb_fx_editions (
 edition integer PRIMARY KEY CHECK(edition>0),
 retrieved_at timestamptz NOT NULL,
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 canonical_hash text NOT NULL CHECK(canonical_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL
);
CREATE TABLE ecb_fx_observations (
 edition integer NOT NULL REFERENCES ecb_fx_editions(edition),
 observed_on date NOT NULL,
 usd_per_eur numeric(20,8) NOT NULL CHECK(usd_per_eur>0),
 inr_per_eur numeric(20,8) NOT NULL CHECK(inr_per_eur>0),
 usd_source text NOT NULL, inr_source text NOT NULL,
 derived_inr_per_usd numeric(29,8) NOT NULL CHECK(derived_inr_per_usd>=0),
 PRIMARY KEY(edition,observed_on)
);
CREATE TABLE ecb_fx_head (
 id text PRIMARY KEY CHECK(id='ecb-reference-fx'),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 edition integer REFERENCES ecb_fx_editions(edition),
 published_edition integer REFERENCES ecb_fx_editions(edition),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawn')),
 checked_at timestamptz, reviewed_at timestamptz,
 CHECK(status<>'published' OR published_edition IS NOT NULL)
);
INSERT INTO ecb_fx_head(id) VALUES('ecb-reference-fx');
CREATE TABLE ecb_fx_runs (
 request_id uuid PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 status text NOT NULL CHECK(status IN ('running','succeeded','failed')),
 category text NOT NULL CHECK(category IN ('pending','changed','unchanged','fetch','parse','storage','interrupted')),
 edition integer REFERENCES ecb_fx_editions(edition),
 source_hash text CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 observation_count integer NOT NULL DEFAULT 0 CHECK(observation_count BETWEEN 0 AND 92),
 CHECK((status='running')=(finished_at IS NULL))
);
CREATE TABLE ecb_fx_reviews (
 request_id uuid PRIMARY KEY,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 edition integer NOT NULL REFERENCES ecb_fx_editions(edition),
 status text NOT NULL CHECK(status IN ('published','withdrawn')),
 head_version integer NOT NULL UNIQUE,
 reviewed_at timestamptz NOT NULL,
 payload jsonb NOT NULL
);
CREATE INDEX ecb_fx_public_editions ON ecb_fx_reviews(edition DESC) WHERE status='published';
CREATE FUNCTION protect_ecb_fx_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ECB FX numerical editions and review receipts are immutable'; END; $$;
CREATE TRIGGER ecb_fx_editions_immutable BEFORE UPDATE OR DELETE ON ecb_fx_editions FOR EACH ROW EXECUTE FUNCTION protect_ecb_fx_immutable();
CREATE TRIGGER ecb_fx_observations_immutable BEFORE UPDATE OR DELETE ON ecb_fx_observations FOR EACH ROW EXECUTE FUNCTION protect_ecb_fx_immutable();
CREATE TRIGGER ecb_fx_reviews_immutable BEFORE UPDATE OR DELETE ON ecb_fx_reviews FOR EACH ROW EXECUTE FUNCTION protect_ecb_fx_immutable();
CREATE FUNCTION protect_ecb_fx_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='running' AND NEW.status<>'running'
   AND OLD.request_id=NEW.request_id AND OLD.started_at=NEW.started_at THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Completed ECB FX capture receipts are immutable';
END; $$;
CREATE TRIGGER ecb_fx_runs_immutable BEFORE UPDATE OR DELETE ON ecb_fx_runs FOR EACH ROW EXECUTE FUNCTION protect_ecb_fx_run();
