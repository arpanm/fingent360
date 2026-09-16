import {
  EventPublicSchema,
  ResearchGovernanceSnapshotSchema,
  type ResearchGovernanceRevision,
} from '@fingent360/contracts';
import type { OfflineBundle, LocalState, OfflineRequest } from './types';
import { OfflineError } from './types';
import { handleEvents } from './events';
export async function downloadedResearchPolicies(
  bundle: OfflineBundle,
  state: LocalState,
  request: OfflineRequest,
  kind: 'educational-policy' | 'causal-context' = 'educational-policy',
): Promise<ResearchGovernanceRevision[]> {
  const snapshot = ResearchGovernanceSnapshotSchema.safeParse(
    bundle.researchGovernance,
  );
  if (!snapshot.success) return [];
  const result: ResearchGovernanceRevision[] = [];
  for (const revision of kind === 'educational-policy'
    ? snapshot.data.policies
    : snapshot.data.contexts) {
    if (
      revision.input.content.kind !== kind ||
      revision.input.reviewBy < new Date().toISOString().slice(0, 10)
    )
      continue;
    let raw;
    try {
      raw = await handleEvents(
        {
          ...request,
          path: '/api/v1/events/' + revision.input.eventId,
          method: 'GET',
          query: new URLSearchParams(),
        },
        state,
        bundle,
      );
    } catch (error) {
      if (
        error instanceof OfflineError &&
        (error.status === 404 || error.status === 409)
      )
        continue;
      throw error;
    }
    const event = EventPublicSchema.safeParse(raw?.body);
    if (
      event.success &&
      event.data.event &&
      JSON.stringify(event.data.event) === JSON.stringify(revision.event.event)
    )
      result.push(revision);
  }
  return result;
}
