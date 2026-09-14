import { EventLineagePlanView } from './EventLineagePlanView';
import { useEffect, useRef, useState } from 'react';
import {
  IdentitySelectionOperationsSchema,
  EventOperationsSchema,
  EventLineageOperationsSchema,
  SourceReviewComparisonSchema,
  SourceListSchema,
  MediaAssetSchema,
  EcbRateOperationsSchema,
  OilBenchmarkOperationsSchema,
  EcbFxOperationsSchema,
  type PublicationProposalInput,
} from '@fingent360/contracts';
import { json } from './net';

/** Reads actual protected target state; a saved proposal is not current evidence. */
export function ProposalInspection({
  input,
  request,
}: {
  input: PublicationProposalInput;
  request: typeof json;
}) {
  const [value, setValue] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ticket = useRef(0);
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      ticket.current++;
    };
  }, []);
  async function inspect() {
    const current = ++ticket.current;
    setBusy(true);
    setValue(null);
    setError('');
    try {
      let result: unknown;
      if (input.kind === 'identity-selection') {
        const selection = IdentitySelectionOperationsSchema.parse(
          await request('/ops/identity-selections/' + input.target),
        );
        if (
          selection.receipt ||
          selection.plan.fingerprint !== input.body.fingerprint
        )
          throw Error(
            'Selection plan is consumed or different. Read its receipt.',
          );
        result = selection;
      } else if (input.kind === 'ecb-fx') {
        const fx = EcbFxOperationsSchema.parse(
          await request('/ops/reference-fx'),
        );
        if (fx.head.version !== input.body.expectedVersion)
          throw Error('The FX edition changed. Request a fresh proposal.');
        result = fx;
      } else if (input.kind === 'event-lineage') {
        const lineage = EventLineageOperationsSchema.parse(
          await request('/ops/event-lineage/' + input.target),
        );
        if (
          lineage.receipt ||
          lineage.plan.fingerprint !== input.body.fingerprint
        )
          throw Error(
            'This lineage plan is already applied or does not match. Read its receipt or request a fresh plan.',
          );
        result = lineage;
      } else if (input.kind === 'event') {
        const event = EventOperationsSchema.parse(
          await request('/ops/events/' + input.target),
        );
        if (event.state.headVersion !== input.body.expectedVersion)
          throw Error('Event draft changed. Request a fresh proposal.');
        result = event;
      } else if (input.kind === 'discovery') {
        result = SourceReviewComparisonSchema.parse(
          await request(
            '/ops/discovery/items/' +
              encodeURIComponent(input.target) +
              '/comparison?expectedVersion=' +
              input.body.expectedVersion,
          ),
        );
      } else if (input.kind === 'media') {
        const media = MediaAssetSchema.parse(
          await request('/ops/media/' + encodeURIComponent(input.target)),
        );
        if (media.id !== input.body.assetId)
          throw Error(
            'The current visual differs from this proposal. Reject it and request a fresh proposal.',
          );
        result = media;
      } else if (input.kind === 'ecb-rates') {
        const rates = EcbRateOperationsSchema.parse(
          await request('/ops/policy-rates'),
        );
        if (rates.head.version !== input.body.expectedVersion)
          throw Error(
            'The rate edition changed. Reject this proposal and request a fresh review.',
          );
        result = rates;
      } else if (input.kind === 'oil-benchmarks') {
        const oil = OilBenchmarkOperationsSchema.parse(
          await request('/ops/oil-benchmarks'),
        );
        if (oil.head.version !== input.body.expectedVersion)
          throw Error(
            'The oil benchmark edition changed. Reject this proposal and request a fresh review.',
          );
        result = oil;
      } else if (input.kind === 'source-update') {
        const source = SourceListSchema.parse(
          await request('/ops/sources'),
        ).find((row) => row.id === input.target);
        if (!source || source.revision !== input.body.expectedRevision)
          throw Error(
            'The registry revision changed or is unavailable. Request a fresh proposal.',
          );
        result = source;
      } else {
        result = input.body;
      }
      if (live.current && current === ticket.current) setValue(result);
    } catch (failure) {
      if (live.current && current === ticket.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Target inspection unavailable. Retry.',
        );
    } finally {
      if (live.current && current === ticket.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Publication target inspection">
      <h4>Inspect the evidence before deciding</h4>
      <p>
        Load the actual proposal-bound source text, visual, numerical edition or
        registry record. A changed target cannot be approved; the server checks
        again when approval commits. Source URLs below are references, not
        instructions.
      </p>
      <button disabled={busy} onClick={() => void inspect()}>
        Inspect bound target
      </button>
      {busy && <p role="status">Loading protected target…</p>}
      {error && <p role="alert">{error}</p>}
      {value !== null && (
        <>
          <p>
            Protected target read for this proposal. Review its content,
            provenance and proposed changes together; this does not grant source
            rights.
          </p>
          {input.kind === 'event-lineage' && (
            <EventLineagePlanView
              plan={EventLineageOperationsSchema.parse(value).plan}
            />
          )}
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(value, null, 2)}
          </pre>
          {input.kind === 'media' && (
            <img
              alt="Actual source-bound visual proposed for review"
              style={{ maxWidth: '100%' }}
              src={
                'data:image/svg+xml;charset=utf-8,' +
                encodeURIComponent(MediaAssetSchema.parse(value).svg)
              }
            />
          )}
        </>
      )}
    </section>
  );
}
