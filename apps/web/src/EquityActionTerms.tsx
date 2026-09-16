import { useEffect, useState } from 'react';
import {
  ActionTermsPublicSchema,
  type ActionTermsReceiptSchema,
} from '@fingent360/contracts';
import { json } from './net';
export function ActionTermsView({
  receipt: r,
}: {
  receipt: ReturnType<typeof ActionTermsReceiptSchema.parse>;
}) {
  return (
    <article className="source-workflow">
      <h3>
        {r.terms.kind === 'rights' ? 'Rights issue' : 'Stock-swap merger'} ·{' '}
        {r.terms.newUnits} for {r.terms.oldUnits}
      </h3>
      <p>
        Ex-date {r.terms.exOn} · record {r.terms.recordOn} · effective{' '}
        {r.terms.effectiveOn}
      </p>
      <p>
        Reference close on {r.terms.priceOn}: ₹{r.oldClose}.{' '}
        {r.terms.kind === 'rights'
          ? `Subscription ₹${r.terms.subscriptionPrice} per new share.`
          : `Separate transferee close ₹${r.newClose}.`}
      </p>
      <p>
        {r.terms.kind === 'rights'
          ? 'Theoretical fully-subscribed value'
          : 'Transferor close in transferee share units'}
        : ₹{r.comparison.display}.
      </p>
      <p>
        This conditional comparison is not an exchange quote, return series or
        forecast. It does not change your holdings or qualify daily calibration.
      </p>
      {r.terms.kind === 'rights' && (
        <p>
          Opens {r.terms.opensOn}; on-market renunciation ends{' '}
          {r.terms.renunciationEndsOn}; closes {r.terms.closesOn}. An
          unexercised right is not assumed subscribed.
        </p>
      )}
      <p>Fraction treatment: {r.terms.fractionTreatment}</p>
      <a href={`?equity=${r.terms.oldIsin}#equities`}>Original issuer</a>
      {r.terms.newIsin !== r.terms.oldIsin && (
        <>
          {' '}
          · <a href={`?equity=${r.terms.newIsin}#equities`}>Receiving issuer</a>
        </>
      )}
      <details>
        <summary>Original terms and arithmetic</summary>
        <p>
          Exact ratio {r.comparison.numerator}/{r.comparison.denominator};
          displayed to12 decimals, half-up.
        </p>
        <a href={r.original.url} target="_blank" rel="noreferrer">
          Original terms · {r.original.publishedOn}
        </a>
        <p>
          Section {r.original.section}: {r.original.transcription}
        </p>
        <p>
          Captured {r.createdAt}; reviewed {r.reviewedAt ?? 'not published'}.
        </p>
        <code>{r.original.hash}</code>
        <p>
          Only explicit terms are shown. Fractional proceeds, investor
          elections, taxes and cash payments require actual owner records.
        </p>
      </details>
    </article>
  );
}
export function EquityActionTerms({ isin }: { isin: string }) {
  const [data, setData] = useState<ReturnType<
      typeof ActionTermsPublicSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    void json(`/equity-action-terms/${isin}`)
      .then((v) => {
        if (live) setData(ActionTermsPublicSchema.parse(v));
      })
      .catch((e) => {
        if (live)
          setError(
            e instanceof Error ? e.message : 'Action terms unavailable.',
          );
      });
    return () => {
      live = false;
    };
  }, [isin, retry]);
  return (
    <section aria-label="Reviewed rights and merger terms">
      <h2>Rights and merger terms</h2>
      {error ? (
        <div role="alert">
          {error}
          <button onClick={() => setRetry((v) => v + 1)}>
            Retry action terms
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading reviewed terms…</p>
      ) : !data.actions.length ? (
        <p>No currently admitted rights or merger terms.</p>
      ) : (
        data.actions.map((r) => <ActionTermsView key={r.id} receipt={r} />)
      )}
      <p>
        Downloaded copies reflect their capture date; connect for source
        withdrawal updates.
      </p>
    </section>
  );
}
