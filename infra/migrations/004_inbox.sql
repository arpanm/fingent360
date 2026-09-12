CREATE TABLE IF NOT EXISTS app_observation_receipts (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  observation_id uuid NOT NULL REFERENCES macro_observations(id),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,observation_id)
);
