import type pg from 'pg';
import { z } from 'zod';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  ReportSnapshotSchema,
  ReportRequestSchema,
  RecordReportSchema,
} from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
const JobPayload = z.strictObject({
  label: ReportRequestSchema.shape.label,
  snapshot: ReportSnapshotSchema,
});
export function encryptReportJob(
  userId: string,
  id: string,
  label: unknown,
  snapshot: unknown,
  keys: PrivateDataKeys,
) {
  return sealPrivateJson(
    'report-job',
    userId,
    id,
    JobPayload.parse({ label, snapshot }),
    keys,
  );
}
export function encryptIssuedReport(
  userId: string,
  id: string,
  payload: unknown,
  keys: PrivateDataKeys,
) {
  const report = RecordReportSchema.parse(payload);
  if (report.id !== id)
    throw new ServiceUnavailableException(
      'Report identity could not be verified.',
    );
  return sealPrivateJson('issued-report', userId, id, report, keys);
}
export async function decryptIssuedReport(
  c: pg.PoolClient,
  userId: string,
  id: string,
  payload: unknown,
  encrypted: unknown,
  keys: PrivateDataKeys,
) {
  const value = RecordReportSchema.parse(
    encrypted == null
      ? payload
      : openPrivateJson('issued-report', userId, id, encrypted, keys),
  );
  if (value.id !== id)
    throw new ServiceUnavailableException(
      'Report identity could not be verified.',
    );
  if (encrypted == null || privatePayloadNeedsRotation(encrypted, keys)) {
    const changed = await c.query(
      'UPDATE record_reports r SET payload=NULL,encrypted_payload=$3 FROM record_report_jobs j WHERE r.job_id=$2 AND j.id=r.job_id AND j.user_id=$1',
      [userId, id, encryptIssuedReport(userId, id, value, keys)],
    );
    if (changed.rowCount !== 1)
      throw new ServiceUnavailableException(
        'Report owner could not be verified.',
      );
  }
  return value;
}
export async function decryptReportJob(
  c: pg.PoolClient,
  userId: string,
  row: Record<string, unknown>,
  keys: PrivateDataKeys,
) {
  if (row.user_id !== userId || typeof row.id !== 'string')
    throw new ServiceUnavailableException(
      'Report owner could not be verified.',
    );
  const value = JobPayload.parse(
    row.encrypted_payload == null
      ? { label: row.label, snapshot: row.snapshot }
      : openPrivateJson(
          'report-job',
          userId,
          row.id,
          row.encrypted_payload,
          keys,
        ),
  );
  if (
    row.encrypted_payload == null ||
    privatePayloadNeedsRotation(row.encrypted_payload, keys)
  ) {
    const changed = await c.query(
      'UPDATE record_report_jobs SET label=NULL,snapshot=NULL,encrypted_payload=$3 WHERE user_id=$1 AND id=$2',
      [
        userId,
        row.id,
        encryptReportJob(userId, row.id, value.label, value.snapshot, keys),
      ],
    );
    if (changed.rowCount !== 1)
      throw new ServiceUnavailableException(
        'Report owner could not be verified.',
      );
  }
  row.label = value.label;
  row.snapshot = value.snapshot;
  if (row.report != null || row.report_encrypted != null)
    row.report = await decryptIssuedReport(
      c,
      userId,
      row.id,
      row.report,
      row.report_encrypted,
      keys,
    );
}
