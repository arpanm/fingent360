import { z } from 'zod';
import {
  IdentitySelectionPublicSchema,
  IdentitySelectionReceiptSchema,
  IdentitySelectionHistorySchema,
  selectionMatchesProvider,
} from '@fingent360/contracts';
import {
  SecurityDirectorySchema,
  SecurityHistorySchema,
  SecurityIdentitySchema,
  SecurityEvidenceSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleSecurities: OfflineHandler = (req, _state, bundle) => {
  if (req.path.startsWith('/api/v1/ops/identity-selections'))
    return fail(
      503,
      'Identity selection requires connected independent Operations review.',
    );
  if (!req.path.startsWith('/api/v1/securities')) return null;
  if (req.method !== 'GET')
    return fail(405, 'Identity reads do not modify the device workspace.');
  const directory = SecurityDirectorySchema.parse(
    bundle.securities ?? { items: [], limited: false },
  );
  if (req.path === '/api/v1/securities') {
    const q = (req.query.get('q') ?? '').trim().toLowerCase();
    if (q.length > 100) return fail(400, 'Search is too long.');
    return {
      body: {
        ...directory,
        items: directory.items.filter(
          (v) =>
            v.isin.toLowerCase().includes(q) ||
            v.candidates.some(
              (c) =>
                c.name.toLowerCase().includes(q) ||
                c.ticker.toLowerCase().includes(q),
            ),
        ),
      },
    };
  }
  const selection =
    /^\/api\/v1\/securities\/([^/]+)\/selection(?:\/(history))?$/.exec(
      req.path,
    );
  if (selection) {
    const provider = directory.items.find((item) => item.isin === selection[1]);
    if (!provider)
      return fail(404, 'Provider identity is not in this snapshot.');
    if (selection[2]) {
      const query = z
        .strictObject({
          before: z.coerce.number().int().positive().max(2147483647).optional(),
        })
        .parse(Object.fromEntries(req.query));
      const rows = z
        .array(IdentitySelectionReceiptSchema)
        .max(1000)
        .parse(bundle.identitySelectionHistories?.[provider.isin] ?? []);
      if (rows.some((row) => row.isin !== provider.isin))
        return fail(503, 'Invalid installed selection history.');
      const filtered = rows
        .filter((row) => !query.before || row.version < query.before)
        .sort((a, b) => b.version - a.version);
      return {
        body: IdentitySelectionHistorySchema.parse({
          receipts: filtered.slice(0, 20),
          nextBefore: filtered.length > 20 ? filtered[19]!.version : null,
        }),
      };
    }
    if (req.query.size) return fail(400, 'Unknown selection query.');
    const value = IdentitySelectionPublicSchema.parse(
      bundle.identitySelections?.[provider.isin] ?? {
        isin: provider.isin,
        state: 'none',
        receipt: null,
        evaluatedAt: bundle.generatedAt,
      },
    );
    if (value.isin !== provider.isin)
      return fail(503, 'Invalid installed selection identity.');
    return {
      body: IdentitySelectionPublicSchema.parse({
        ...value,
        state:
          value.receipt?.status === 'approved' &&
          !selectionMatchesProvider(value.receipt, provider)
            ? 'stale'
            : value.state,
      }),
    };
  }
  const match =
    /^\/api\/v1\/securities\/([^/]+)(?:\/(history|evidence)(?:\/([a-f0-9]{64}))?)?$/.exec(
      req.path,
    );
  const item = directory.items.find((v) => v.isin === match?.[1]);
  if (!match || !item)
    return fail(
      404,
      'No identity for this ISIN in this dated device snapshot. Your holdings are unchanged.',
    );
  if (match[2] === 'history')
    return {
      body: SecurityHistorySchema.parse(
        bundle.securityHistories?.[item.isin] ?? { revisions: [item] },
      ),
    };
  if (match[2] === 'evidence') {
    const history = SecurityHistorySchema.parse(
      bundle.securityHistories?.[item.isin] ?? { revisions: [item] },
    );
    if (!history.revisions.some((v) => v.sourceHash === match[3]))
      return fail(404, 'Evidence is not part of this identity.');
    const evidence = bundle.securityEvidence?.[match[3]!];
    if (!evidence)
      return fail(404, 'Original evidence was not included in this snapshot.');
    return { body: SecurityEvidenceSchema.parse(evidence) };
  }
  return { body: SecurityIdentitySchema.parse(item) };
};
