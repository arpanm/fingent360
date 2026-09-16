ALTER TABLE app_users ALTER COLUMN username DROP NOT NULL;
ALTER TABLE app_users ADD COLUMN username_lookup text UNIQUE;
ALTER TABLE app_users ADD COLUMN encrypted_identity jsonb;
ALTER TABLE app_users ADD CONSTRAINT account_identity_single_copy CHECK (
 (username IS NOT NULL AND encrypted_identity IS NULL AND username_lookup IS NULL)
 OR (username IS NULL AND encrypted_identity IS NOT NULL AND username_lookup IS NOT NULL)
);
