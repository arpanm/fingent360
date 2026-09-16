import { randomUUID, createHash } from 'node:crypto';
import { SOVEREIGN_ORIGINALS } from '../../../packages/contracts/src/sovereign-bond';
export function sovereignInput() {
  return {
    requestId: randomUUID(),
    originals: SOVEREIGN_ORIGINALS.map((source) => ({
      kind: source.kind,
      body: Buffer.from(
        source.mime === 'application/pdf'
          ? '%PDF-1.4\n% TEST-SIMULATION envelope only, not a genuine original.\n%%EOF'
          : '<!DOCTYPE html><html><body>TEST-SIMULATION original envelope only.</body></html>',
      ).toString('base64'),
    })),
    permissionReference:
      'TEST-SIMULATION synthetic envelopes, no actual source permission claimed.',
    originalsConfirmed: true,
  };
}
export function sovereignReview(decision: 'publish' | 'withdraw' = 'publish') {
  return {
    requestId: randomUUID(),
    decision,
    reason: 'TEST-SIMULATION independent source pack review.',
    allOriginalsChecked: true,
    termsVersion: 'goi-648-2035-auction-20260410-v1',
    sourceHashes: sovereignInput().originals.map((o) =>
      createHash('sha256').update(Buffer.from(o.body, 'base64')).digest('hex'),
    ),
  };
}
