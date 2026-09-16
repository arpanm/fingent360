import {
  ClassificationCrosswalkPublicSchema,
  ClassificationCrosswalkSnapshotSchema,
  EquitySnapshotSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleClassificationCrosswalks: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/classification-crosswalks' ||
    request.path.startsWith('/api/v1/ops/classification-crosswalks/')
  )
    fail(503, 'Classification changes require connected independent review.');
  const base = '/api/v1/classifications';
  if (!request.path.startsWith(base + '/')) return null;
  if (request.method !== 'GET') fail(404, 'Unknown classification operation.');
  const isin = decodeURIComponent(request.path.slice(base.length + 1));
  if (!/^IN[A-Z0-9]{9}[0-9]$/.test(isin))
    fail(400, 'Invalid company identity.');
  const snapshot = ClassificationCrosswalkSnapshotSchema.parse(
      bundle.classificationCrosswalks ?? {
        capturedAt: bundle.generatedAt,
        companies: [],
      },
    ),
    company = EquitySnapshotSchema.parse(
      bundle.equityCoverage ?? {
        capturedAt: bundle.generatedAt,
        companies: [],
      },
    ).companies.find((c) => c.isin === isin),
    now = new Date().toISOString();
  const mappings = (
    snapshot.companies.find((c) => c.isin === isin)?.mappings ?? []
  ).filter(
    (r) =>
      r.input.reviewBy >= now.slice(0, 10) &&
      r.input.effectiveOn <= now.slice(0, 10) &&
      company?.records.some(
        (source) => JSON.stringify(source) === JSON.stringify(r.source),
      ),
  );
  return {
    body: ClassificationCrosswalkPublicSchema.parse({
      isin,
      evaluatedAt: now,
      mappings,
      conflict:
        new Set(mappings.map((r) => r.input.applicationSector)).size > 1,
    }),
  };
};
