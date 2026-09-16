ALTER TABLE app_bond_comparisons ADD COLUMN encrypted_payload jsonb;
ALTER TABLE app_bond_comparisons DROP CONSTRAINT app_bond_comparisons_check;
ALTER TABLE app_bond_comparisons ADD CONSTRAINT bond_receipt_private_copy CHECK ((deleted_at IS NOT NULL AND payload IS NULL AND encrypted_payload IS NULL) OR (deleted_at IS NULL AND ((payload IS NOT NULL AND encrypted_payload IS NULL) OR (payload IS NULL AND encrypted_payload IS NOT NULL))));
