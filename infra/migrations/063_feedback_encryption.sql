ALTER TABLE feedback_reports ADD COLUMN encrypted_payload jsonb;
ALTER TABLE feedback_reports ADD COLUMN public_source_id text;
UPDATE feedback_reports SET public_source_id=context->'publicView'->'item'->>'id' WHERE context IS NOT NULL;
CREATE INDEX feedback_public_source ON feedback_reports(public_source_id,received_at DESC) WHERE deleted_at IS NULL;
ALTER TABLE feedback_reports ADD CONSTRAINT feedback_encrypted_plaintext_exclusion
CHECK (encrypted_payload IS NULL OR (text IS NULL AND context IS NULL AND image_meta IS NULL AND image_bytes IS NULL AND audio_meta IS NULL AND audio_bytes IS NULL));
