CREATE TABLE event_lineage_plans (
  id uuid PRIMARY KEY,
  fingerprint text NOT NULL,
  payload jsonb NOT NULL
);
CREATE TABLE event_lineage_receipts (
  id uuid PRIMARY KEY REFERENCES event_lineage_plans(id),
  payload jsonb NOT NULL
);
CREATE TABLE event_lineage_members (
  plan_id uuid NOT NULL REFERENCES event_lineage_receipts(id),
  event_id uuid NOT NULL REFERENCES reviewed_events(id),
  direction text NOT NULL CHECK(direction IN ('input','output')),
  PRIMARY KEY(plan_id,event_id)
);
CREATE UNIQUE INDEX event_lineage_one_successor ON event_lineage_members(event_id) WHERE direction='input';
CREATE UNIQUE INDEX event_lineage_one_origin ON event_lineage_members(event_id) WHERE direction='output';
CREATE TRIGGER event_lineage_plan_immutable BEFORE UPDATE OR DELETE ON event_lineage_plans FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER event_lineage_receipt_immutable BEFORE UPDATE OR DELETE ON event_lineage_receipts FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
CREATE TRIGGER event_lineage_member_immutable BEFORE UPDATE OR DELETE ON event_lineage_members FOR EACH ROW EXECUTE FUNCTION protect_reviewed_event_history();
