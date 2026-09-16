import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  PreviewSchema,
  ReviewSchema,
  WorkspaceSchema,
} from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
const stores = {
  workspace: {
    table: 'virtual_workspaces',
    owner: 'token_hash',
    id: 'token_hash',
    column: 'portfolio',
    purpose: 'virtual-workspace',
    schema: WorkspaceSchema.shape.portfolio,
  },
  preview: {
    table: 'virtual_previews',
    owner: 'owner_hash',
    id: 'id',
    column: 'payload',
    purpose: 'virtual-preview',
    schema: PreviewSchema,
  },
  mutation: {
    table: 'virtual_mutations',
    owner: 'owner_hash',
    id: 'idempotency_key',
    column: 'response',
    purpose: 'virtual-mutation',
    schema: WorkspaceSchema,
  },
  review: {
    table: 'virtual_reviews',
    owner: 'owner_hash',
    id: 'id',
    column: 'payload',
    purpose: 'virtual-review',
    schema: ReviewSchema,
  },
  import: {
    table: 'virtual_imports',
    owner: 'owner_hash',
    id: 'content_hash',
    column: 'response',
    purpose: 'virtual-import',
    schema: WorkspaceSchema,
  },
} as const;
type Kind = keyof typeof stores;
export function encryptJourney(
  kind: Kind,
  owner: string,
  id: string,
  payload: unknown,
  keys: PrivateDataKeys,
) {
  const store = stores[kind];
  return sealPrivateJson(
    store.purpose,
    owner,
    id,
    store.schema.parse(payload),
    keys,
  );
}
export async function decryptJourney(
  c: pg.PoolClient,
  kind: Kind,
  owner: string,
  row: Record<string, unknown>,
  keys: PrivateDataKeys,
) {
  const store = stores[kind];
  const id = row[store.id];
  if (row[store.owner] !== owner || typeof id !== 'string')
    throw new ServiceUnavailableException(
      'Workspace ownership could not be verified.',
    );
  const result = store.schema.safeParse(
    row.encrypted_payload == null
      ? row[store.column]
      : openPrivateJson(store.purpose, owner, id, row.encrypted_payload, keys),
  );
  if (!result.success)
    throw new ServiceUnavailableException(
      'Stored workspace data is unreadable.',
    );
  const value = result.data;
  if (
    row.encrypted_payload == null ||
    privatePayloadNeedsRotation(row.encrypted_payload, keys)
  ) {
    const updated = await c.query(
      `UPDATE ${store.table} SET ${store.column}=NULL,encrypted_payload=$3 WHERE ${store.owner}=$1 AND ${store.id}=$2`,
      [owner, id, encryptJourney(kind, owner, id, value, keys)],
    );
    if (updated.rowCount !== 1)
      throw new ServiceUnavailableException(
        'Workspace ownership could not be verified.',
      );
  }
  return value;
}
