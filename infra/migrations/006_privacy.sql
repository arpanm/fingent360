-- Independent, opaque public identifiers. Never expose token hashes to clients.
ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS public_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS app_sessions_public_id ON app_sessions(public_id);
