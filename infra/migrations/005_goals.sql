CREATE TABLE IF NOT EXISTS app_goals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS app_goals_owner ON app_goals(user_id);
CREATE TABLE IF NOT EXISTS app_goal_revisions (
  goal_id uuid NOT NULL REFERENCES app_goals(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(goal_id,version)
);
