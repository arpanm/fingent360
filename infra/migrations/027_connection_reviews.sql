CREATE TABLE app_connection_review_inboxes(
 user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object')
);
CREATE TABLE app_connection_review_requests(
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 fingerprint text NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_id)
);
CREATE INDEX connection_review_request_retention ON app_connection_review_requests(user_id,created_at);
