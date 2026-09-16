import { createHash } from 'node:crypto';
import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  ResearchConnectionRevisionSchema,
  ConnectionReviewInboxSchema,
  ConnectionReviewReceiptSchema,
  ImpactTraceReceiptSchema,
} from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
type Kind =
  | 'connection-revision'
  | 'connection-inbox'
  | 'connection-review'
  | 'impact-trace';
const tables = {
  'connection-revision': 'app_research_connection_revisions',
  'connection-inbox': 'app_connection_review_inboxes',
  'connection-review': 'app_connection_review_requests',
  'impact-trace': 'app_impact_traces',
} as const;
function validated(kind: Kind, data: unknown) {
  return kind === 'connection-revision'
    ? ResearchConnectionRevisionSchema.parse(data)
    : kind === 'connection-inbox'
      ? ConnectionReviewInboxSchema.parse(data)
      : kind === 'connection-review'
        ? ConnectionReviewReceiptSchema.parse(data)
        : ImpactTraceReceiptSchema.parse(data);
}
export function sealConnection(
  kind: Kind,
  userId: string,
  id: string,
  data: unknown,
  keys: PrivateDataKeys,
) {
  const value = validated(kind, data);
  return {
    envelope: sealPrivateJson(kind, userId, id, value, keys),
    hash: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  };
}
export async function decryptConnectionRows(
  c: pg.PoolClient,
  kind: Kind,
  userId: string,
  rows: Record<string, unknown>[],
  keys: PrivateDataKeys,
) {
  for (const row of rows) {
    if (row.user_id !== userId)
      throw new ServiceUnavailableException(
        'Private research owner could not be verified.',
      );
    const id =
      kind === 'connection-revision'
        ? `${row.connection_id}:${row.version}`
        : kind === 'connection-inbox'
          ? userId
          : String(kind === 'connection-review' ? row.request_id : row.id);
    const value = validated(
      kind,
      row.encrypted_payload == null
        ? row.payload
        : openPrivateJson(kind, userId, id, row.encrypted_payload, keys),
    );
    const decodedId =
      kind === 'connection-revision'
        ? `${ResearchConnectionRevisionSchema.parse(value).id}:${ResearchConnectionRevisionSchema.parse(value).version}`
        : kind === 'connection-review'
          ? ConnectionReviewReceiptSchema.parse(value).requestId
          : kind === 'impact-trace'
            ? ImpactTraceReceiptSchema.parse(value).id
            : userId;
    if (decodedId !== id)
      throw new ServiceUnavailableException(
        'Private research identity could not be verified.',
      );
    const hash = createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
    if (row.encrypted_payload != null && hash !== row.content_hash)
      throw new ServiceUnavailableException(
        'Private research integrity could not be verified.',
      );
    if (
      row.encrypted_payload == null ||
      privatePayloadNeedsRotation(row.encrypted_payload, keys)
    ) {
      const where =
        kind === 'connection-revision'
          ? 'connection_id=$2 AND version=$5'
          : kind === 'connection-inbox'
            ? 'user_id=$2'
            : kind === 'connection-review'
              ? 'request_id=$2'
              : 'id=$2';
      const values: unknown[] = [
        userId,
        kind === 'connection-revision' ? row.connection_id : id,
        sealConnection(kind, userId, id, value, keys).envelope,
        hash,
      ];
      if (kind === 'connection-revision') values.push(row.version);
      const changed = await c.query(
        `UPDATE ${tables[kind]} SET payload=NULL,encrypted_payload=$3,content_hash=$4 WHERE user_id=$1 AND ${where}`,
        values,
      );
      if (changed.rowCount !== 1)
        throw new ServiceUnavailableException(
          'Private research owner could not be verified.',
        );
    }
    row.payload = value;
  }
}
