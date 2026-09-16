-- Additive only: the server upgrades legacy rows on authorized access with configured keys.
-- Never put encryption keys in a migration, database, committed fixture or browser bundle.
ALTER TABLE private_ai_history ADD COLUMN encrypted_payload jsonb;
ALTER TABLE private_ai_history ADD CONSTRAINT private_history_ciphertext_cleartext_exclusive
CHECK (encrypted_payload IS NULL OR (instructions='' AND input='' AND raw_output IS NULL AND text_output IS NULL));
