import {
  EcbFxPublicSchema,
  EcbFxEditionSchema,
  EcbFxHistorySchema,
  EcbFxEvidenceSchema,
  ecbFxEvaluationDay,
} from '@fingent360/contracts';
import { z } from 'zod';
import { fail, type OfflineHandler } from './types';
export const handleEcbFx: OfflineHandler = (request, _state, bundle) => {
  const base = '/api/v1/reference-fx';
  if (
    request.path === '/api/v1/ops/reference-fx' ||
    request.path.startsWith('/api/v1/ops/reference-fx/')
  )
    fail(
      503,
      'ECB reference FX refresh and review require connected Operations.',
    );
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown FX operation.');
  const now = new Date();
  const captured = EcbFxPublicSchema.safeParse(
    bundle.ecbFx ?? {
      status: 'never-published',
      edition: null,
      checkedAt: null,
      reviewedAt: null,
      evaluatedAt: now.toISOString(),
      evaluatedOn: ecbFxEvaluationDay(now),
      timeZone: 'Europe/Berlin',
    },
  );
  if (!captured.success)
    fail(
      503,
      'The bundled FX snapshot is unreadable. Rebuild the device bundle.',
    );
  const current = {
    ...captured.data,
    evaluatedAt: now.toISOString(),
    evaluatedOn: ecbFxEvaluationDay(now),
  };
  if (request.path === base) return { body: EcbFxPublicSchema.parse(current) };
  if (current.status !== 'published')
    fail(
      404,
      'Reviewed FX history and evidence are unavailable in this snapshot.',
    );
  const admission = z
    .array(z.number().int().positive())
    .max(500)
    .safeParse(bundle.ecbFxAdmittedEditions ?? [current.edition!.edition]);
  if (
    !admission.success ||
    new Set(admission.data).size !== admission.data.length
  )
    fail(503, 'Bundled FX publication admission is unreadable.');
  const rows = (bundle.ecbFxHistory ?? [current.edition])
    .map((value) => {
      const parsed = EcbFxEditionSchema.safeParse(value);
      if (!parsed.success) fail(503, 'Bundled FX history is unreadable.');
      return parsed.data;
    })
    .filter((row) => admission.data.includes(row.edition))
    .sort((a, b) => b.edition - a.edition);
  if (
    rows.length !== admission.data.length ||
    new Set(rows.map((row) => row.edition)).size !== rows.length ||
    !rows.some(
      (row) =>
        row.edition === current.edition!.edition &&
        row.sourceHash === current.edition!.sourceHash,
    )
  )
    fail(503, 'Bundled FX history does not reconcile.');
  if (request.path === base + '/history') {
    const keys = [...request.query.keys()];
    if (
      keys.some((key) => key !== 'before') ||
      request.query.getAll('before').length > 1
    )
      fail(400, 'Invalid FX history page.');
    const before = request.query.get('before');
    if (before !== null && !/^[1-9][0-9]{0,8}$/.test(before))
      fail(400, 'Invalid FX history page.');
    const selected = rows.filter(
      (row) => before === null || row.edition < Number(before),
    );
    return {
      body: EcbFxHistorySchema.parse({
        editions: selected.slice(0, 50),
        nextBefore: selected.length > 50 ? selected[49]!.edition : null,
      }),
    };
  }
  const match =
    /^\/api\/v1\/reference-fx\/(editions|evidence)\/([1-9][0-9]{0,8})$/.exec(
      request.path,
    );
  if (!match || request.query.size) fail(404, 'Unknown FX edition.');
  const edition = rows.find((row) => row.edition === Number(match[2]));
  if (!edition) fail(404, 'Reviewed FX edition unavailable in this snapshot.');
  return {
    body:
      match[1] === 'evidence'
        ? EcbFxEvidenceSchema.parse({
            scope: 'reviewed-numerical-edition',
            edition,
          })
        : edition,
  };
};
