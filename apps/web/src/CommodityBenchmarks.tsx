import { downloadCommodityOriginal } from './commodity-download';
import { useEffect, useRef, useState } from 'react';
import {
  CommodityPublicSchema,
  COMMODITY_SERIES,
  CommoditySeriesSchema,
} from '@fingent360/contracts';
import { json } from './net';
import './source-workflows.css';
export function CommodityBenchmarks() {
  const [value, setValue] = useState<ReturnType<
      typeof CommodityPublicSchema.parse
    > | null>(null),
    [series, setSeries] = useState<'GOLD' | 'SILVER' | 'COPPER'>('GOLD'),
    [year, setYear] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const live = useRef(true),
    epoch = useRef(0),
    targetEdition = useRef<string | undefined>(undefined),
    focusAfterLoad = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    errorSummary = useRef<HTMLParagraphElement>(null);
  async function load(edition?: string, moveFocus = false) {
    targetEdition.current = edition;
    focusAfterLoad.current = moveFocus;
    const current = ++epoch.current;
    setBusy(true);
    setError('');
    setValue(null);
    try {
      const result = CommodityPublicSchema.parse(
        await json(
          '/commodity-benchmarks' +
            (edition ? '?edition=' + encodeURIComponent(edition) : ''),
        ),
      );
      if (live.current && epoch.current === current) {
        setValue(result);
        setYear(result.receipt.observations.at(-1)!.period.slice(0, 4));
      }
    } catch (cause) {
      if (live.current && epoch.current === current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Commodity observations unavailable.',
        );
    } finally {
      if (live.current && epoch.current === current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!busy && focusAfterLoad.current) {
      focusAfterLoad.current = false;
      if (error) errorSummary.current?.focus();
      else if (value) heading.current?.focus();
    }
  }, [busy, error, value]);
  useEffect(() => {
    live.current = true;
    function readRoute(moveFocus = false) {
      if (location.hash.split('?')[0] !== '#commodities') return;
      const edition = new URLSearchParams(
        location.hash.split('?')[1] ?? '',
      ).get('edition');
      void load(edition ?? undefined, moveFocus);
    }
    const changed = () => readRoute(true);
    readRoute();
    window.addEventListener('hashchange', changed);
    return () => {
      live.current = false;
      epoch.current++;
      window.removeEventListener('hashchange', changed);
    };
  }, []);
  function selectEdition(edition?: string) {
    const next =
      '#commodities' +
      (edition ? '?edition=' + encodeURIComponent(edition) : '');
    if (location.hash === next) void load(edition, true);
    else location.hash = next;
  }
  return (
    <main
      className="panel source-workflow"
      aria-label="Monthly commodities"
      aria-busy={busy}
    >
      <h1 tabIndex={-1} ref={heading}>
        Monthly commodity context
      </h1>
      <p>
        World Bank monthly global benchmarks. Not today's price, an executable
        quote or an Indian retail bullion price. No monthly-to-daily
        interpolation or currency conversion is applied.
      </p>
      {busy && <p role="status">Loading reviewed monthly observations…</p>}
      {error && (
        <p role="alert" tabIndex={-1} ref={errorSummary}>
          {error}
        </p>
      )}
      <button disabled={busy} onClick={() => selectEdition()}>
        Refresh current commodities
      </button>
      {error && (
        <button
          disabled={busy}
          onClick={() => void load(targetEdition.current, true)}
        >
          Retry selected commodity edition
        </button>
      )}
      {value && (
        <>
          <p>
            Source updated {value.receipt.reportedUpdatedOn}; retained{' '}
            {value.receipt.retainedAt}. Original retrieval:{' '}
            {value.receipt.retrievedAt ?? 'unknown (operator upload)'}. Review:{' '}
            {value.reviewedAt}.
          </p>
          <p>
            {Date.now() - Date.parse(value.receipt.reportedUpdatedOn) >
            62 * 86400000
              ? 'Stale source edition: check a newer original before relying on this context.'
              : 'Monthly edition; source publication time is not reconstructed.'}
          </p>
          <label>
            Commodity
            <select
              value={series}
              onChange={(e) =>
                setSeries(CommoditySeriesSchema.parse(e.target.value))
              }
            >
              {Object.entries(COMMODITY_SERIES).map(([id, v]) => (
                <option value={id} key={id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observation year
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {[
                ...new Set(
                  value.receipt.observations.map((v) => v.period.slice(0, 4)),
                ),
              ]
                .reverse()
                .map((y) => (
                  <option key={y}>{y}</option>
                ))}
            </select>
          </label>
          <p>{COMMODITY_SERIES[series].description}</p>
          <p>
            Unit: {COMMODITY_SERIES[series].unit}. Display precision:{' '}
            {COMMODITY_SERIES[series].precision}; original cells remain
            alongside rounded displays.
          </p>
          <ul aria-label="Monthly source observations">
            {value.receipt.observations
              .filter(
                (v) => v.series === series && v.period.startsWith(year + '-'),
              )
              .map((row) => (
                <li key={row.period}>
                  <strong>
                    {row.period}: {row.value ?? 'Unavailable'}
                  </strong>
                  <small>
                    {' '}
                    Original cell: {row.sourceValue ?? 'Missing in original'}
                  </small>
                </li>
              ))}
          </ul>
          <details>
            <summary>Source and retained edition evidence</summary>
            <p>{value.receipt.attribution}</p>
            <p>
              Selected series providers: {COMMODITY_SERIES[series].providers}
            </p>
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void downloadCommodityOriginal(
                  value.receipt.id,
                  value.receipt.bodyHash,
                )
                  .catch((cause) => {
                    if (live.current)
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : 'Original unavailable.',
                      );
                  })
                  .finally(() => {
                    if (live.current) setBusy(false);
                  });
              }}
            >
              Download this retained original
            </button>
            <p>
              SHA256 {value.receipt.bodyHash}. Known historical publication
              time: unavailable; retained revisions only.
            </p>
            <a href={value.receipt.sourceUrl} target="_blank" rel="noreferrer">
              World Bank current original workbook
            </a>
            <p>
              <a href={value.receipt.termsUrl} target="_blank" rel="noreferrer">
                World Bank dataset terms and attribution
              </a>{' '}
              ·{' '}
              <a href={value.receipt.license} target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>
            </p>
            <label>
              Retained reviewed edition
              <select
                value={value.receipt.id}
                disabled={busy}
                onChange={(e) => selectEdition(e.target.value)}
              >
                {value.editions.map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </label>
          </details>
        </>
      )}
      <a href="#explore">Back to Explore</a>
    </main>
  );
}
