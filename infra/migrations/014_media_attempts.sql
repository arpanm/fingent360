-- Reserve one optional paid caption-selection attempt per immutable source edition.
-- A committed reservation survives worker/process failure; retries use a local
-- template after the interrupted-attempt grace period, never another paid call.
CREATE TABLE discovery_media_attempts (
  item_id text NOT NULL,
  item_version integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, item_version),
  FOREIGN KEY (item_id, item_version)
    REFERENCES discovery_versions(item_id, version)
);
