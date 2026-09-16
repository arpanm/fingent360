import { createHash } from 'node:crypto';
import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  ReportScheduleSchema,
  ScheduleReceiptSchema,
  ScheduleOccurrenceSchema,
} from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
type Kind =
  | 'schedule-head'
  | 'schedule-edition'
  | 'schedule-request'
  | 'schedule-occurrence';
const tables = {
  'schedule-head': 'report_schedules',
  'schedule-edition': 'report_schedule_editions',
  'schedule-request': 'report_schedule_requests',
  'schedule-occurrence': 'report_schedule_occurrences',
} as const;
function validated(kind: Kind, data: unknown) {
  return kind === 'schedule-request'
    ? ScheduleReceiptSchema.parse(data)
    : kind === 'schedule-occurrence'
      ? ScheduleOccurrenceSchema.parse(data)
      : ReportScheduleSchema.parse(data);
}
function identity(kind: Kind, data: unknown) {
  const value = validated(kind, data);
  return kind === 'schedule-request'
    ? ScheduleReceiptSchema.parse(value).requestId
    : kind === 'schedule-occurrence'
      ? ScheduleOccurrenceSchema.parse(value).id
      : kind === 'schedule-edition'
        ? `${ReportScheduleSchema.parse(value).id}:${ReportScheduleSchema.parse(value).version}`
        : ReportScheduleSchema.parse(value).id;
}
export function sealSchedule(
  kind: Kind,
  userId: string,
  data: unknown,
  keys: PrivateDataKeys,
) {
  const value = validated(kind, data);
  return {
    envelope: sealPrivateJson(kind, userId, identity(kind, value), value, keys),
    hash: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  };
}
export async function decryptScheduleRows(
  c: pg.PoolClient,
  kind: Kind,
  userId: string,
  rows: Record<string, unknown>[],
  keys: PrivateDataKeys,
) {
  for (const row of rows) {
    if (row.user_id !== userId)
      throw new ServiceUnavailableException(
        'Schedule owner could not be verified.',
      );
    const id = String(
      kind === 'schedule-edition'
        ? `${row.schedule_id}:${row.version}`
        : kind === 'schedule-request'
          ? row.request_id
          : row.id,
    );
    const value = validated(
      kind,
      row.encrypted_payload == null
        ? row.payload
        : openPrivateJson(kind, userId, id, row.encrypted_payload, keys),
    );
    const hash = createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
    if (
      identity(kind, value) !== id ||
      (row.encrypted_payload != null && hash !== row.content_hash)
    )
      throw new ServiceUnavailableException(
        'Schedule identity could not be verified.',
      );
    if (
      row.encrypted_payload == null ||
      privatePayloadNeedsRotation(row.encrypted_payload, keys)
    ) {
      const where =
        kind === 'schedule-edition'
          ? 'schedule_id=$2 AND version=$5'
          : kind === 'schedule-request'
            ? 'request_id=$2'
            : 'id=$2';
      const values: unknown[] = [
        userId,
        kind === 'schedule-edition' ? row.schedule_id : id,
        sealSchedule(kind, userId, value, keys).envelope,
        hash,
      ];
      if (kind === 'schedule-edition') values.push(row.version);
      const changed = await c.query(
        `UPDATE ${tables[kind]} SET payload=NULL,encrypted_payload=$3,content_hash=$4 WHERE user_id=$1 AND ${where}`,
        values,
      );
      if (changed.rowCount !== 1)
        throw new ServiceUnavailableException(
          'Schedule owner could not be verified.',
        );
    }
    row.payload = value;
  }
}
