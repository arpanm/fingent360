CREATE TABLE IF NOT EXISTS app_learning_attempts (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 question_id text NOT NULL,
 question_version integer NOT NULL,
 choice_id text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS app_learning_attempts_owner ON app_learning_attempts(user_id,created_at);
CREATE TABLE IF NOT EXISTS app_learning_votes (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 question_id text NOT NULL,
 question_version integer NOT NULL,
 choice_id text NOT NULL,
 voted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,question_id,question_version)
);
