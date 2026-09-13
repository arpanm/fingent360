CREATE TABLE IF NOT EXISTS library_preferences (
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 data jsonb NOT NULL DEFAULT '{"topics":[],"mutedTopics":[],"mode":"chronological"}'
);
CREATE TABLE IF NOT EXISTS library_saved (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 item_id text NOT NULL, item_version integer NOT NULL, snapshot jsonb NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS library_reactions (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 item_id text NOT NULL, reaction text NOT NULL CHECK(reaction IN ('more','less')),
 PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS library_positions (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 item_id text NOT NULL, item_version integer NOT NULL, percent integer NOT NULL CHECK(percent BETWEEN 0 AND 100),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS library_reminders (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 item_id text NOT NULL, title text NOT NULL, due_at timestamptz NOT NULL, time_zone text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered','cancelled')),
 version integer NOT NULL DEFAULT 1, idempotency_key uuid NOT NULL, request jsonb NOT NULL,
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS library_reminders_due ON library_reminders(due_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS library_notifications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 reminder_id uuid NOT NULL UNIQUE REFERENCES library_reminders(id) ON DELETE CASCADE,
 item_id text NOT NULL, title text NOT NULL, delivered_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
