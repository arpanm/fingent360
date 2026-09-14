import {
  EcbRatePublicSchema,
  EcbRateEditionSchema,
  EcbRateHistorySchema,
  EcbRateEvidenceSchema,
  ecbEvaluationDay,
} from '@fingent360/contracts';
import { z } from 'zod';
import { fail, type OfflineHandler } from './types';
export const handleEcbRates: OfflineHandler = (request, _state, bundle) => {
  const base = '/api/v1/policy-rates';
  if (
    request.path === '/api/v1/ops/policy-rates' ||
    request.path.startsWith('/api/v1/ops/policy-rates/')
  )
    fail(503, 'Policy-rate refresh and review require connected Operations.');
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown policy-rate operation.');
  const now = new Date();
  const captured = EcbRatePublicSchema.safeParse(
    bundle.policyRates ?? {
      status: 'never-published',
      edition: null,
      checkedAt: null,
      reviewedAt: null,
      evaluatedAt: now.toISOString(),
      evaluatedOn: ecbEvaluationDay(now),
      timeZone: 'Europe/Berlin',
    },
  );
  if (!captured.success)
    fail(
      503,
      'The bundled policy-rate snapshot is unreadable. Rebuild the device bundle.',
    );
  const current = {
    ...captured.data,
    evaluatedAt: now.toISOString(),
    evaluatedOn: ecbEvaluationDay(now),
  };
  if (request.path === base)
    return { body: EcbRatePublicSchema.parse(current) };
  if (current.status !== 'published')
    fail(
      404,
      'Reviewed rate history and evidence are unavailable in this snapshot.',
    );
  const admission = z
    .array(z.number().int().positive())
    .max(500)
    .safeParse(bundle.policyRateAdmittedEditions ?? [current.edition!.edition]);
  if (
    !admission.success ||
    new Set(admission.data).size !== admission.data.length
  )
    fail(503, 'Bundled rate publication admission is unreadable.');
  const rows = (bundle.policyRateHistory ?? [current.edition])
    .map((value) => {
      const parsed = EcbRateEditionSchema.safeParse(value);
      if (!parsed.success) fail(503, 'Bundled rate history is unreadable.');
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
    fail(503, 'Bundled rate history does not reconcile.');
  if (request.path === base + '/history') {
    const keys = [...request.query.keys()];
    if (
      keys.some((key) => key !== 'before') ||
      request.query.getAll('before').length > 1
    )
      fail(400, 'Invalid rate history page.');
    const before = request.query.get('before');
    if (before !== null && !/^[1-9][0-9]{0,8}$/.test(before))
      fail(400, 'Invalid rate history page.');
    const selected = rows.filter(
      (row) => before === null || row.edition < Number(before),
    );
    return {
      body: EcbRateHistorySchema.parse({
        editions: selected.slice(0, 50),
        nextBefore: selected.length > 50 ? selected[49]!.edition : null,
      }),
    };
  }
  const match =
    /^\/api\/v1\/policy-rates\/(editions|evidence)\/([1-9][0-9]{0,8})$/.exec(
      request.path,
    );
  if (!match || request.query.size) fail(404, 'Unknown rate edition.');
  const edition = rows.find((row) => row.edition === Number(match[2]));
  if (!edition)
    fail(404, 'Reviewed rate edition unavailable in this snapshot.');
  return {
    body:
      match[1] === 'evidence'
        ? EcbRateEvidenceSchema.parse({
            scope: 'reviewed-numerical-edition',
            edition,
          })
        : edition,
  };
};
