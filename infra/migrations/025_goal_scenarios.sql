CREATE TABLE app_goal_comparisons(
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id)
);
CREATE TABLE app_goal_adoptions(
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 comparison_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_id),
 FOREIGN KEY(comparison_id,user_id) REFERENCES app_goal_comparisons(id,user_id) ON DELETE CASCADE
);
CREATE FUNCTION protect_goal_comparison_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Goal comparison receipts are immutable until account deletion';
END; $$;
CREATE TRIGGER goal_comparison_immutable BEFORE UPDATE OR DELETE ON app_goal_comparisons FOR EACH ROW EXECUTE FUNCTION protect_goal_comparison_receipt();
CREATE TRIGGER goal_adoption_immutable BEFORE UPDATE OR DELETE ON app_goal_adoptions FOR EACH ROW EXECUTE FUNCTION protect_goal_comparison_receipt();
