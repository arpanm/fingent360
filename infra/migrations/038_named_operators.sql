CREATE TABLE named_operators (
 id uuid PRIMARY KEY,
 username text NOT NULL UNIQUE CHECK(username ~ '^[a-z][a-z0-9_]{2,39}$'),
 password_hash text NOT NULL CHECK(password_hash ~ '^[a-f0-9]{128}$'),
 password_salt text NOT NULL CHECK(password_salt ~ '^[a-f0-9]{64}$'),
 role text NOT NULL CHECK(role IN ('viewer','researcher','publisher','admin')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE operator_sessions ADD COLUMN operator_id uuid REFERENCES named_operators(id);
ALTER TABLE operator_sessions ADD COLUMN operator_version integer;
ALTER TABLE operator_sessions ADD CONSTRAINT named_session_binding CHECK(
 (operator_id IS NULL AND operator_version IS NULL) OR (operator_id IS NOT NULL AND operator_version>0)
);
CREATE TABLE named_operator_gate(id integer PRIMARY KEY CHECK(id=1));
INSERT INTO named_operator_gate VALUES(1);
CREATE TABLE named_operator_changes (
 sequence bigserial PRIMARY KEY,
 operator_id uuid NOT NULL REFERENCES named_operators(id),
 actor_id uuid REFERENCES named_operators(id),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE publication_proposals (
 id uuid PRIMARY KEY,
 sequence bigserial UNIQUE NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 proposer_id uuid NOT NULL REFERENCES named_operators(id),
 input jsonb NOT NULL,
 proposer jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 reviewer_id uuid REFERENCES named_operators(id),
 reviewer jsonb,
 reviewed_at timestamptz,
 note text,
 action_result jsonb,
 CHECK((state='pending' AND reviewer_id IS NULL AND reviewer IS NULL AND reviewed_at IS NULL AND note IS NULL)
 OR (state<>'pending' AND reviewer_id IS NOT NULL AND reviewer_id<>proposer_id AND reviewer IS NOT NULL AND reviewed_at IS NOT NULL AND note IS NOT NULL))
);
CREATE FUNCTION protect_named_operator_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Named operator history is immutable'; END; $$;
CREATE TRIGGER named_operator_history_immutable BEFORE UPDATE OR DELETE ON named_operator_changes
 FOR EACH ROW EXECUTE FUNCTION protect_named_operator_history();
CREATE FUNCTION protect_publication_proposal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.state='pending' AND NEW.state IN ('approved','rejected')
 AND NEW.id=OLD.id AND NEW.sequence=OLD.sequence AND NEW.input=OLD.input
 AND NEW.proposer_id=OLD.proposer_id AND NEW.proposer=OLD.proposer
 AND NEW.fingerprint=OLD.fingerprint AND NEW.created_at=OLD.created_at THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Proposal input and completed decisions are immutable';
END; $$;
CREATE TRIGGER publication_proposal_immutable BEFORE UPDATE OR DELETE ON publication_proposals
 FOR EACH ROW EXECUTE FUNCTION protect_publication_proposal();
