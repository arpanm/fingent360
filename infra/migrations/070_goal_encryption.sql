ALTER TABLE app_goal_revisions ALTER COLUMN payload DROP NOT NULL;
ALTER TABLE app_goal_revisions ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_goal_revisions ADD CONSTRAINT goal_encryption_single_copy CHECK (
 (encrypted_payload IS NULL AND payload IS NOT NULL) OR
 (encrypted_payload IS NOT NULL AND payload IS NULL)
);
