import { DiscoveryIdSchema } from './discovery.js';
import {
  IdentitySelectionReceiptSchema,
  selectionMatchesProvider,
} from './identity-selection.js';
import { z } from 'zod';
import { DomainEvidenceGraphSchema } from './domain-records.js';
import { FeedItemSchema, type FeedItem } from './discovery.js';
import { IndianIsinSchema, SecurityIdentitySchema } from './securities.js';
import { publicEdition } from './publication.js';

export const EventCitationSchema = z.strictObject({
  sourceId: z.string().min(1).max(180),
  version: z.number().int().positive(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  field: z.enum(['title', 'summary', 'body']),
  quote: z
    .string()
    .refine(
      (value) => value.length >= 8 && value.length <= 800,
      'Quote must contain 8–800 UTF-16 units.',
    ),
});
export const EventLinkSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('sector'),
    label: z.string().trim().min(1).max(100),
    citation: z.number().int().min(0).max(4),
    rationale: z.string().trim().min(1).max(1000),
  }),
  z.strictObject({
    kind: z.literal('instrument'),
    isin: IndianIsinSchema,
    identityVersion: z.number().int().positive(),
    selection: IdentitySelectionReceiptSchema.optional(),
    citation: z.number().int().min(0).max(4),
    rationale: z.string().trim().min(1).max(1000),
  }),
]);
export const EventEditorialSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    family: z.string().trim().min(1).max(80),
    geography: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
    claimKind: z.enum(['fact', 'expectation', 'scenario', 'inference']),
    explanation: z.string().trim().min(1).max(2000),
    announcedAt: z.iso.datetime().nullable(),
    effectiveAt: z.iso.datetime().nullable(),
    citations: z.array(EventCitationSchema).min(1).max(5),
    links: z.array(EventLinkSchema).max(10),
    releaseGroup: z
      .strictObject({
        sourceIds: z.array(DiscoveryIdSchema).min(2).max(5),
        rationale: z.string().trim().min(12).max(1000),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      value.releaseGroup &&
      (value.claimKind !== 'fact' ||
        new Set(value.releaseGroup.sourceIds).size !==
          value.releaseGroup.sourceIds.length ||
        value.releaseGroup.sourceIds.some(
          (id) => !value.citations.some((citation) => citation.sourceId === id),
        ))
    )
      context.addIssue({
        code: 'custom',
        path: ['releaseGroup'],
        message:
          'A same-event group needs two to five distinct cited releases of a fact event.',
      });
    if (value.links.some((link) => link.citation >= value.citations.length))
      context.addIssue({
        code: 'custom',
        message: 'Each context link needs an actual listed citation.',
      });
  });
export const EventSaveSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  revisionReason: z.string().trim().min(1).max(1000),
  editorial: EventEditorialSchema,
});
export const EventReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  status: z.enum(['published', 'withdrawn']),
  note: z.string().trim().min(1).max(1000),
});
const EventRevisionBaseSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
  recordedAt: z.iso.datetime(),
  revisionReason: z.string().min(1).max(1000),
  editorial: EventEditorialSchema,
  sources: z.array(FeedItemSchema).min(1).max(5),
  identities: z.array(SecurityIdentitySchema).max(10),
  sourceBindings: z
    .array(
      z.strictObject({
        citationIndex: z.number().int().nonnegative(),
        sourceId: z.string().min(1).max(180),
        documentId: z.uuid(),
        evidenceId: z.uuid(),
      }),
    )
    .min(1)
    .max(5),
  graph: DomainEvidenceGraphSchema,
});
export const EventRevisionSchema = EventRevisionBaseSchema.superRefine(
  (value, context) => {
    const invalid = () =>
      context.addIssue({
        code: 'custom',
        message:
          'Event, source, identity and graph revisions do not reconcile.',
      });
    const sourceIds = new Set(
      value.editorial.citations.map((citation) => citation.sourceId),
    );
    const identityIds = new Set(
      value.editorial.links
        .filter((link) => link.kind === 'instrument')
        .map((link) => link.isin),
    );
    if (
      value.editorial.links.some(
        (link) =>
          link.kind === 'instrument' &&
          link.selection &&
          Date.parse(link.selection.reviewedAt) > Date.parse(value.recordedAt),
      )
    )
      invalid();
    if (
      value.sources.length !== sourceIds.size ||
      new Set(value.sources.map((source) => source.id)).size !==
        sourceIds.size ||
      value.identities.length !== identityIds.size ||
      new Set(value.identities.map((identity) => identity.isin)).size !==
        identityIds.size
    )
      invalid();
    if (
      !eventSourcesCurrent(value, value.sources) ||
      value.identities.some(
        (identity) =>
          !value.editorial.links.some(
            (link) =>
              link.kind === 'instrument' &&
              link.isin === identity.isin &&
              link.identityVersion === identity.version,
          ) ||
          value.editorial.links.some(
            (link) =>
              link.kind === 'instrument' &&
              link.isin === identity.isin &&
              (link.identityVersion !== identity.version ||
                (link.selection
                  ? !selectionMatchesProvider(link.selection, identity)
                  : identity.resolution !== 'matched' ||
                    identity.candidates.length !== 1)),
          ),
      )
    )
      invalid();
    try {
      const ids = [
        ...value.graph.documents.map((row) => row.id),
        ...value.graph.evidence
          .slice(0, value.editorial.citations.length)
          .map((row) => row.id),
        ...value.graph.nodes.slice(1).map((row) => row.id),
        ...value.graph.edges.flatMap((row) => [row.id, row.evidence[0]!.id]),
      ];
      let at = 0;
      const expected = buildEventRevisionRaw(
        value.id,
        value.version,
        value.recordedAt,
        {
          requestId: value.id,
          expectedVersion: value.version - 1,
          revisionReason: value.revisionReason,
          editorial: value.editorial,
        },
        value.sources,
        value.identities,
        () => ids[at++]!,
      );
      const state = value.graph.events[0]?.publicationState;
      if (
        state !== 'candidate' &&
        state !== 'published' &&
        state !== 'withdrawn'
      ) {
        invalid();
        return;
      }
      expected.graph.events[0]!.publicationState = state;
      for (const edge of expected.graph.edges)
        edge.reviewState =
          state === 'published'
            ? 'reviewed'
            : state === 'withdrawn'
              ? 'withdrawn'
              : 'candidate';
      if (
        JSON.stringify(DomainEvidenceGraphSchema.parse(expected.graph)) !==
          JSON.stringify(value.graph) ||
        JSON.stringify(expected.sourceBindings) !==
          JSON.stringify(value.sourceBindings)
      )
        invalid();
    } catch {
      invalid();
    }
  },
);
export type EventRevision = z.infer<typeof EventRevisionBaseSchema>;
export const EventStateSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  headVersion: z.number().int().positive(),
  publishedVersion: z.number().int().positive().nullable(),
  status: z.enum(['never-published', 'published', 'withdrawn']),
  reviewedAt: z.iso.datetime().nullable(),
});
export const EventOperationsSchema = z.strictObject({
  state: EventStateSchema,
  latest: EventRevisionSchema,
});
export const EventReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(['published', 'withdrawn']),
  note: z.string().min(1).max(1000),
  reviewedAt: z.iso.datetime(),
});
export const EventPublicSchema = z
  .strictObject({
    id: z.uuid(),
    status: z.enum(['published', 'withdrawn', 'unavailable']),
    event: EventRevisionSchema.nullable(),
    evaluatedAt: z.iso.datetime(),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .superRefine((value, context) => {
    if (
      (value.status === 'published') !== (value.event !== null) ||
      (value.event &&
        (value.event.id !== value.id ||
          value.event.graph.events[0]?.publicationState !== 'published' ||
          !value.reviewedAt ||
          Date.parse(value.reviewedAt) < Date.parse(value.event.recordedAt)))
    )
      context.addIssue({
        code: 'custom',
        message: 'Unavailable event content must not be disclosed.',
      });
  });
export const EventListSchema = z.strictObject({
  items: z.array(EventPublicSchema).max(50),
  next: z.uuid().nullable(),
  evaluatedAt: z.iso.datetime(),
});
export const EventHistorySchema = z.strictObject({
  revisions: z
    .array(
      z.strictObject({
        version: z.number().int().positive(),
        recordedAt: z.iso.datetime(),
      }),
    )
    .max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const EventQuerySchema = z.strictObject({
  after: z.uuid().optional(),
  family: z.string().trim().min(1).max(80).optional(),
  sector: z.string().trim().min(1).max(100).optional(),
  isin: IndianIsinSchema.optional(),
});
export function eventSourcesCurrent(event: EventRevision, current: FeedItem[]) {
  return (
    event.sources.every((source) => {
      const actual = current.find((row) => row.id === source.id);
      return (
        actual &&
        JSON.stringify(FeedItemSchema.parse(publicEdition(actual))) ===
          JSON.stringify(FeedItemSchema.parse(source))
      );
    }) &&
    event.editorial.citations.every((citation) => {
      const actual = current.find((row) => row.id === citation.sourceId);
      return (
        actual?.status === 'published' &&
        actual.version === citation.version &&
        actual.sourceHash === citation.hash &&
        publicEdition(actual)?.[citation.field].includes(citation.quote)
      );
    })
  );
}

/** Explicit adapter: discovery string IDs remain in citations; UUID document IDs identify this captured graph only. */
function buildEventRevisionRaw(
  id: string,
  version: number,
  savedAt: string,
  input: z.infer<typeof EventSaveSchema>,
  sources: FeedItem[],
  identities: z.infer<typeof SecurityIdentitySchema>[],
  uuid: () => string,
): EventRevision {
  const documents = input.editorial.citations.map((citation) => {
    const source = sources.find((row) => row.id === citation.sourceId)!;
    return {
      id: uuid(),
      version: 1,
      createdAt: savedAt,
      supersedesVersion: null,
      revisionReason: null,
      source: source.source,
      contentHash: citation.hash,
      publishedAt: source.publishedAt,
      claimKind: 'fact' as const,
    };
  });
  const eventEvidence = documents.map((document, index) => ({
    id: uuid(),
    version: 1,
    createdAt: savedAt,
    supersedesVersion: null,
    revisionReason: null,
    document: { id: document.id, version: 1 },
    contentHash: document.contentHash,
    claim: { id, version },
    relation: 'supports' as const,
    locator:
      input.editorial.citations[index]!.field +
      ': ' +
      input.editorial.citations[index]!.quote,
  }));
  const event = {
    id,
    version,
    createdAt: savedAt,
    supersedesVersion: version === 1 ? null : version - 1,
    revisionReason: version === 1 ? null : input.revisionReason,
    title: input.editorial.title,
    family: input.editorial.family,
    geography: input.editorial.geography,
    claimKind: input.editorial.claimKind,
    publicationState: 'candidate' as const,
    announcedAt: input.editorial.announcedAt,
    effectiveAt: input.editorial.effectiveAt,
    evidence: eventEvidence.map((item) => ({ id: item.id, version: 1 })),
  };
  const nodes = input.editorial.links.map((link) => ({
    id: uuid(),
    version: 1,
    kind: link.kind,
    label:
      link.kind === 'sector'
        ? link.label
        : (
            link.selection?.candidate ??
            identities.find((row) => row.isin === link.isin)!.candidates[0]!
          ).name.slice(0, 200),
    isin: link.kind === 'instrument' ? link.isin : null,
  }));
  const edges = input.editorial.links.map((link, index) => ({
    id: uuid(),
    version: 1,
    createdAt: savedAt,
    supersedesVersion: null,
    revisionReason: null,
    from: { id, version },
    to: { id: nodes[index]!.id, version: 1 },
    direction: 'unknown' as const,
    mechanism:
      'Editorial context only; no causal impact asserted. ' + link.rationale,
    horizon: null,
    evidence: [{ id: uuid(), version: 1 }],
    reviewState: 'candidate' as const,
    modelVersion: 'editorial-context-v1',
    invalidation:
      'Source edition withdrawal/change or security identity revision requires new review.',
    claimKind: 'inference' as const,
  }));
  const edgeEvidence = edges.map((edge, index) => {
    const citation = input.editorial.links[index]!.citation,
      document = documents[citation]!;
    return {
      ...eventEvidence[citation]!,
      id: edge.evidence[0]!.id,
      document: { id: document.id, version: 1 },
      claim: { id: edge.id, version: 1 },
    };
  });
  return {
    id,
    version,
    recordedAt: savedAt,
    revisionReason: input.revisionReason,
    editorial: input.editorial,
    sources,
    identities,
    sourceBindings: documents.map((document, index) => ({
      citationIndex: index,
      sourceId: input.editorial.citations[index]!.sourceId,
      documentId: document.id,
      evidenceId: eventEvidence[index]!.id,
    })),
    graph: {
      documents,
      evidence: [...eventEvidence, ...edgeEvidence],
      events: [event],
      nodes: [
        {
          id,
          version,
          kind: 'event',
          label: input.editorial.title,
          isin: null,
        },
        ...nodes,
      ],
      edges,
    },
  };
}

export const EventOperationsListSchema = z.strictObject({
  items: z.array(EventStateSchema).max(50),
  next: z.uuid().nullable(),
});

export const EventSnapshotHistorySchema = EventHistorySchema.extend({
  revisions: z.array(EventHistorySchema.shape.revisions.element).max(1000),
  nextBefore: z.null(),
});

export function buildEventRevision(
  ...args: Parameters<typeof buildEventRevisionRaw>
): EventRevision {
  return EventRevisionSchema.parse(buildEventRevisionRaw(...args));
}
