import {
  SecurityDirectorySchema,
  SecurityHistorySchema,
  SecurityIdentitySchema,
  SecurityEvidenceSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleSecurities: OfflineHandler = (req, _state, bundle) => {
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
