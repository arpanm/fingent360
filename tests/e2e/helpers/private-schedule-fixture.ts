import type { FeedbackSandbox } from './feedback-fixture';
type Database = {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
};
export async function setSyntheticScheduleDue(
  db: Database,
  sandbox: FeedbackSandbox,
  id: string,
  due: string,
) {
  if (!/^e2e_feedback_[a-f0-9]+$/.test(sandbox.schema))
    throw Error('Owned synthetic schedule required.');
  const row = (
    await db.query('SELECT * FROM report_schedules WHERE id=$1', [id])
  ).rows[0];
  if (!row || typeof row.user_id !== 'string')
    throw Error('Synthetic schedule unavailable.');
  const cryptoUrl = new URL(
    '../../../apps/api/dist/private-data-crypto.js',
    import.meta.url,
  ).href;
  const { openPrivateJson } = await import(cryptoUrl);
  const schedulesUrl = new URL(
    '../../../apps/api/dist/private-schedules.js',
    import.meta.url,
  ).href;
  const { sealSchedule } = await import(schedulesUrl);
  const value =
    row.encrypted_payload == null
      ? row.payload
      : openPrivateJson(
          'schedule-head',
          row.user_id,
          id,
          row.encrypted_payload,
          sandbox.privateDataKeys,
        );
  const encrypted = sealSchedule(
    'schedule-head',
    row.user_id,
    { ...(value as object), nextDueAt: due },
    sandbox.privateDataKeys,
  );
  await db.query(
    'UPDATE report_schedules SET next_due_at=$2,payload=NULL,encrypted_payload=$3,content_hash=$4 WHERE id=$1',
    [id, due, encrypted.envelope, encrypted.hash],
  );
}
