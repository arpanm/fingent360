CREATE TABLE app_research_connections (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version > 0),
 removed boolean NOT NULL DEFAULT false,
 UNIQUE(id,user_id)
);
CREATE INDEX app_research_connections_owner ON app_research_connections(user_id,removed);
CREATE TABLE app_research_connection_revisions (
 connection_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 version integer NOT NULL CHECK(version > 0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,version),
 FOREIGN KEY(connection_id,user_id) REFERENCES app_research_connections(id,user_id) ON DELETE CASCADE
);
CREATE TABLE app_research_connection_requests (
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 connection_id uuid NOT NULL,
 version integer NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(user_id,request_id),
 FOREIGN KEY(connection_id,version) REFERENCES app_research_connection_revisions(connection_id,version) ON DELETE CASCADE
);
CREATE FUNCTION protect_research_connection_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM app_users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Research connection receipts are immutable until account deletion';
END; $$;
CREATE TRIGGER research_connection_revision_immutable BEFORE UPDATE OR DELETE ON app_research_connection_revisions FOR EACH ROW EXECUTE FUNCTION protect_research_connection_revision();
CREATE TRIGGER research_connection_request_immutable BEFORE UPDATE OR DELETE ON app_research_connection_requests FOR EACH ROW EXECUTE FUNCTION protect_research_connection_revision();
