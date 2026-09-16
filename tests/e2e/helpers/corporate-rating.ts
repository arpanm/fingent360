import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CORPORATE_RATING_SOURCE,
  CORPORATE_RATING_VERSION,
} from '../../../packages/contracts/src/corporate-rating';
export const corporateRatingOriginal = new URL(
  '../fixtures/sources/icra/hudco-142975.pdf',
  import.meta.url,
);
export async function corporateRatingInput() {
  return {
    requestId: randomUUID(),
    body: (await readFile(corporateRatingOriginal)).toString('base64'),
    permissionReference:
      'ICRA142975 page11 permits contents use with acknowledgement; ICRA attribution retained.',
    originalConfirmed: true,
  };
}
export function corporateRatingReview(
  decision: 'publish' | 'withdraw' = 'publish',
) {
  return {
    requestId: randomUUID(),
    decision,
    reason:
      'Independent review of exact ICRA original and three instrument rows.',
    originalChecked: true,
    version: CORPORATE_RATING_VERSION,
    sourceHash: CORPORATE_RATING_SOURCE.hash,
  };
}
