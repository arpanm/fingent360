CREATE TABLE IF NOT EXISTS security_identities (
  isin text PRIMARY KEY,
  version integer NOT NULL CHECK(version > 0),
  checked_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS security_identity_revisions (
  isin text NOT NULL REFERENCES security_identities(isin),
  version integer NOT NULL CHECK(version > 0),
  fingerprint text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY(isin,version)
);
CREATE TABLE IF NOT EXISTS security_refresh_runs (
  id uuid PRIMARY KEY,
  payload jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS security_provider_pacing (
  provider text PRIMARY KEY,
  next_allowed_at timestamptz NOT NULL
);
