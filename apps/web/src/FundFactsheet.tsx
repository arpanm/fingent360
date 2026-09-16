import { useEffect, useState } from 'react';
import {
  FactsheetListSchema,
  type FactsheetValuesSchema,
} from '@fingent360/contracts';
import type { z } from 'zod';
import { json } from './net';
export function FactsheetValues({
  values,
  plan,
}: {
  values: z.infer<typeof FactsheetValuesSchema>;
  plan?: 'Direct' | 'Regular' | undefined;
}) {
  return (
    <>
      <p>
        Disclosure as of {values.observedOn}. Fund AUM {values.aumCrore} INR
        crore; average AUM {values.averageAumCrore} INR crore. These are dated
        fund-level sizes, not this plan's assets or your investment value.
      </p>
      <p>
        Base expense ratio (BER) excludes brokerage, transaction costs and
        related statutory levies. Total expense ratio and your actual total cost
        are not established.
      </p>
      {values.plans
        .filter((p) => !plan || p.plan === plan)
        .map((p) => (
          <p key={p.plan}>
            {p.plan}: scheme BER {p.schemePercent}% + underlying fund BER{' '}
            {p.underlyingPercent}% = combined BER {p.combinedPercent}%.
          </p>
        ))}
    </>
  );
}
export function FundFactsheetReader({ schemeCode }: { schemeCode: string }) {
  const [value, setValue] = useState<ReturnType<
      typeof FactsheetListSchema.parse
    > | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [cursor, setCursor] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  useEffect(() => {
    setCursor(null);
    setHistory([]);
  }, [schemeCode]);
  useEffect(() => {
    const abort = new AbortController();
    setValue(null);
    setError('');
    json(
      '/fund-factsheets?schemeCode=' +
        schemeCode +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      undefined,
      'GET',
      abort.signal,
    )
      .then((raw) => {
        if (!abort.signal.aborted) setValue(FactsheetListSchema.parse(raw));
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Factsheets unavailable.');
      });
    return () => abort.abort();
  }, [schemeCode, retry, cursor]);
  return (
    <section aria-label="Reviewed fund factsheet">
      <h3>Fund size and disclosed fees</h3>
      {!value && !error && <p role="status">Loading reviewed factsheet…</p>}
      {error && (
        <div role="alert">
          {error}
          <button onClick={() => setRetry((x) => x + 1)}>
            Retry factsheets
          </button>
        </div>
      )}
      {value?.editions.length === 0 && (
        <p>
          No currently admitted factsheet and plan mapping is available. Fees
          are not inferred from the fund name.
        </p>
      )}
      {value?.editions.map((e) => (
        <article key={e.id}>
          <h4>{e.values?.scheme}</h4>
          {e.values && (
            <FactsheetValues
              values={e.values}
              plan={e.mappings.find((m) => m.schemeCode === schemeCode)?.plan}
            />
          )}
          <details>
            <summary>Factsheet source and review</summary>
            <p>
              Retrieved {e.retrievedAt}; independently reviewed {e.reviewedAt}.
              Original source hash {e.hash}. Installed offline copies reflect
              their snapshot time.
            </p>
            <a href={e.sourceUrl} target="_blank" rel="noreferrer">
              Original AMC factsheet
            </a>
          </details>
        </article>
      ))}
      <nav aria-label="Factsheet history pages">
        <button
          disabled={!value || history.length === 0}
          onClick={() => {
            setCursor(history.at(-1) ?? null);
            setHistory((v) => v.slice(0, -1));
          }}
        >
          Previous factsheets
        </button>
        <button
          disabled={!value?.nextCursor}
          onClick={() => {
            setHistory((v) => [...v, cursor]);
            setCursor(value?.nextCursor ?? null);
          }}
        >
          Older factsheets
        </button>
      </nav>
    </section>
  );
}
