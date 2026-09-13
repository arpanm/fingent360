CREATE TABLE IF NOT EXISTS discovery_media (
 id uuid PRIMARY KEY,
 item_id text NOT NULL,
 item_version integer NOT NULL,
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(item_id,item_version) REFERENCES discovery_versions(item_id,version),
 UNIQUE(item_id,item_version)
);
CREATE TABLE IF NOT EXISTS discovery_media_reviews (
 id uuid PRIMARY KEY,
 asset_id uuid NOT NULL REFERENCES discovery_media(id),
 published boolean NOT NULL,
 actor_hash text NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS discovery_media_immutable ON discovery_media;
CREATE TRIGGER discovery_media_immutable BEFORE UPDATE OR DELETE ON discovery_media FOR EACH ROW EXECUTE FUNCTION prevent_discovery_revision_mutation();
DROP TRIGGER IF EXISTS discovery_media_review_immutable ON discovery_media_reviews;
CREATE TRIGGER discovery_media_review_immutable BEFORE UPDATE OR DELETE ON discovery_media_reviews FOR EACH ROW EXECUTE FUNCTION prevent_discovery_revision_mutation();
