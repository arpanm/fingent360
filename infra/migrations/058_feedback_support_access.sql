-- Support access contains identifiers/actions only; no feedback content or credentials.
-- Existing append-only feedback_audit retains receipt/deletion history.
CREATE INDEX IF NOT EXISTS feedback_audit_support_history
ON feedback_audit(report_id,created_at DESC,id DESC)
WHERE action IN ('support:list','support:detail');
