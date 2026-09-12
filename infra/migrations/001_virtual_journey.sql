-- Applied manually by pnpm db:migrate. All data in these tables is virtual.
CREATE TABLE IF NOT EXISTS virtual_workspaces (
  token_hash text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  portfolio jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS virtual_previews (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL REFERENCES virtual_workspaces(token_hash) ON DELETE CASCADE,
  content_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS virtual_mutations (
  owner_hash text NOT NULL REFERENCES virtual_workspaces(token_hash) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  response jsonb NOT NULL,
  PRIMARY KEY(owner_hash, idempotency_key)
);
CREATE TABLE IF NOT EXISTS virtual_imports (
  owner_hash text NOT NULL REFERENCES virtual_workspaces(token_hash) ON DELETE CASCADE,
  content_hash text NOT NULL,
  response jsonb NOT NULL,
  PRIMARY KEY(owner_hash, content_hash)
);
CREATE TABLE IF NOT EXISTS virtual_reviews (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL REFERENCES virtual_workspaces(token_hash) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS virtual_reviews_owner ON virtual_reviews(owner_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS virtual_previews_owner ON virtual_previews(owner_hash);
