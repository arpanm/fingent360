CREATE TABLE IF NOT EXISTS app_goal_allocations (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 0 CHECK(version >= 0)
);
CREATE TABLE IF NOT EXISTS app_goal_allocation_revisions (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version > 0),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,version)
);
