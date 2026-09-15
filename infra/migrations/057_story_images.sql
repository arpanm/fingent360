CREATE TABLE story_image_attempts(id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES discovery_media(id), provider text NOT NULL, model text NOT NULL, prompt text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, status text NOT NULL CHECK(status IN ('running','succeeded','failed')), output jsonb, provider_output text, message text NOT NULL DEFAULT '');
CREATE INDEX story_image_asset ON story_image_attempts(asset_id,started_at DESC);
CREATE TABLE story_image_reviews(id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES story_image_attempts(id), published boolean NOT NULL, actor_hash text NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER story_image_review_immutable BEFORE UPDATE OR DELETE ON story_image_reviews FOR EACH ROW EXECUTE FUNCTION prevent_discovery_revision_mutation();
CREATE OR REPLACE FUNCTION protect_story_image_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status<>'running' THEN RAISE EXCEPTION 'Completed image attempts are immutable'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER story_image_attempt_immutable BEFORE UPDATE OR DELETE ON story_image_attempts FOR EACH ROW EXECUTE FUNCTION protect_story_image_receipt();

ALTER TABLE evaluation_public_compositions ADD CONSTRAINT evaluation_composition_image_fk FOREIGN KEY(image_attempt_id) REFERENCES story_image_attempts(id);
