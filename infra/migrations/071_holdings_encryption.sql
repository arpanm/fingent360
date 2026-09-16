ALTER TABLE app_holdings_revisions ALTER COLUMN payload DROP NOT NULL;
ALTER TABLE app_holdings_revisions ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_holdings_revisions ADD CONSTRAINT holdings_encryption_single_copy CHECK ((encrypted_payload IS NULL AND payload IS NOT NULL) OR (encrypted_payload IS NOT NULL AND payload IS NULL));
ALTER TABLE app_holdings_previews ALTER COLUMN payload DROP NOT NULL;
ALTER TABLE app_holdings_previews ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_holdings_previews ADD CONSTRAINT preview_encryption_single_copy CHECK ((encrypted_payload IS NULL AND payload IS NOT NULL) OR (encrypted_payload IS NOT NULL AND payload IS NULL));
