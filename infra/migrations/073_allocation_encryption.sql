ALTER TABLE app_goal_allocation_revisions ALTER COLUMN payload DROP NOT NULL;
ALTER TABLE app_goal_allocation_revisions ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_goal_allocation_revisions ADD CONSTRAINT allocation_private_copy CHECK ((payload IS NOT NULL AND encrypted_payload IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL));
