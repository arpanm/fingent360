import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuditQuerySchema,
  AuditRowSchema,
  AuditPageSchema,
  auditEventInfo,
  projectAuditEvent,
  compareAuditPositions,
} from '../dist/index.js';
const row = {
  id: '00000000-0000-4000-8000-000000000001',
  recordedAt: '2026-09-14T01:02:03.123456Z',
  event: 'source.create.requested',
  module: 'sources',
};
test('audit projection admits fixed events only and never promotes unknown text or targets', () => {
  for (const action of [
    'https://secret.invalid/?password=private',
    '<script>private body</script>',
    '__proto__',
    'constructor',
    null,
    {},
  ])
    assert.equal(projectAuditEvent(action), 'other');
  assert.equal(projectAuditEvent(row.event), row.event);
  assert.equal(auditEventInfo[row.event].stage, 'request');
  assert.equal(auditEventInfo['retention-completed'].stage, 'record');
  assert.equal(
    AuditRowSchema.safeParse({ ...row, actor_hash: 'secret' }).success,
    false,
  );
  assert.equal(
    AuditRowSchema.safeParse({ ...row, target: 'private' }).success,
    false,
  );
  assert.equal(
    AuditRowSchema.safeParse({ ...row, module: 'macro' }).success,
    false,
  );
});
test('audit filters reject unknown repeated incompatible fields and invalid UTC calendar ranges', () => {
  assert.equal(
    AuditQuerySchema.safeParse({
      module: 'sources',
      event: row.event,
      from: '2024-02-29',
      through: '2026-09-14',
    }).success,
    true,
  );
  for (const value of [
    { from: '2025-02-29' },
    { from: '2026-02-31' },
    { from: '2026-09-15', through: '2026-09-14' },
    { module: ['sources'] },
    { module: 'sources', event: 'retention-completed' },
    { target: 'private' },
    { limit: 9999 },
    { offset: 1 },
    { cursor: 'a'.repeat(45) + '.' + 'b'.repeat(43), module: 'sources' },
  ])
    assert.equal(AuditQuerySchema.safeParse(value).success, false);
});
test('audit pages retain microseconds and UUID ties while rejecting duplicates ascending rows and upper-bound violations', () => {
  const newer = {
    ...row,
    id: '00000000-0000-4000-8000-000000000002',
    recordedAt: '2026-09-14T01:02:03.123457Z',
  };
  const tied = { ...row, id: '00000000-0000-4000-8000-000000000003' };
  const page = {
    items: [newer, tied, row],
    filters: {},
    upper: { id: newer.id, recordedAt: newer.recordedAt },
    nextCursor: null,
    pageSize: 50,
  };
  assert.equal(compareAuditPositions(newer, row), 1);
  assert.equal(AuditPageSchema.safeParse(page).success, true);
  for (const changed of [
    { ...page, items: [row, newer] },
    { ...page, upper: { id: row.id, recordedAt: row.recordedAt } },
    { ...page, items: [row, row] },
    { ...page, items: [{ ...row, recordedAt: '2026-09-14T01:02:03.123Z' }] },
  ])
    assert.equal(AuditPageSchema.safeParse(changed).success, false);
});
test('audit pages cannot imply a continuation from an incomplete bounded result or accept private extras', () => {
  const page = {
    items: [row],
    filters: {},
    upper: { id: row.id, recordedAt: row.recordedAt },
    nextCursor: null,
    pageSize: 50,
  };
  for (const changed of [
    { ...page, pageSize: 100 },
    { ...page, privateBody: 'secret' },
    { ...page, upper: null },
    { ...page, nextCursor: 'a'.repeat(45) + '.' + 'b'.repeat(43) },
  ])
    assert.equal(AuditPageSchema.safeParse(changed).success, false);
});
