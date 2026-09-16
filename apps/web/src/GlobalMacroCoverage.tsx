import { useEffect, useRef, useState } from 'react';
import {
  ResearchCatalogSchema,
  EcbRatePublicSchema,
  EcbFxPublicSchema,
  ReleaseCalendarSchema,
} from '@fingent360/contracts';
import { json } from './net';
import './source-workflows.css';
type Row = {
  id: string;
  title: string;
  details: string[];
  links: { label: string; href: string }[];
  error?: string;
};
export function GlobalMacroCoverage() {
  const [rows, setRows] = useState<Row[]>([]),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load() {
    const ticket = ++generation.current;
    setBusy(true);
    const jobs = [
      {
        id: 'releases',
        title: 'Reviewed global releases',
        read: async () => {
          const value = ResearchCatalogSchema.parse(
            await json('/discovery/catalog'),
          );
          const sources = value.sources.filter((s) =>
            [
              'fed',
              'fed-policy-history',
              'bea-gdp-history',
              'bea-gdp-original',
              'ecb-press',
              'ecb-statistics',
              'bls',
              'bea',
            ].includes(s.id),
          );
          return {
            details: sources.map(
              (s) =>
                `${s.name}: ${s.publishedCount} published items. Latest publication ${s.latestPublishedAt ?? 'unavailable'}; last successful refresh ${s.lastSuccessAt ?? 'not recorded'}.`,
            ),
            links: sources.map((s) => ({
              label: `Read ${s.name}`,
              href: '#explore?source=' + encodeURIComponent(s.id),
            })),
          };
        },
      },
      {
        id: 'rates',
        title: 'ECB numerical policy rates',
        read: async () => {
          const value = EcbRatePublicSchema.parse(await json('/policy-rates'));
          return {
            details: [
              `Status: ${value.status}. Published edition ${value.edition?.edition ?? 'unavailable'}.`,
              `Deposit facility, main refinancing fixed rate and marginal lending facility; percent per annum, effective dates retained.`,
              `Retrieved ${value.edition?.retrievedAt ?? 'not captured'}. Stored retrieval revisions do not establish original historical publication vintages.`,
            ],
            links: [
              {
                label: 'Open policy rates and evidence',
                href: '#policy-rates',
              },
              {
                label: 'Review rate edition history',
                href: '#policy-rates/history',
              },
            ],
          };
        },
      },
      {
        id: 'fx',
        title: 'ECB INR/USD reference context',
        read: async () => {
          const value = EcbFxPublicSchema.parse(await json('/reference-fx'));
          return {
            details: [
              `Status: ${value.status}. Published edition ${value.edition?.edition ?? 'unavailable'}.`,
              `INR per USD derived from exact EUR reference legs; daily source dates, eight-decimal rounding. It is not an executable trading quote.`,
              `Retrieved ${value.edition?.retrievedAt ?? 'not captured'}; rolling 90-day source, not original known-at vintages.`,
            ],
            links: [
              {
                label: 'Open reference FX and evidence',
                href: '#reference-fx',
              },
            ],
          };
        },
      },
      ...(['bea-calendar', 'bls-calendar'] as const).map((source) => ({
        id: source,
        title:
          source === 'bea-calendar'
            ? 'BEA release calendar'
            : 'BLS release calendar',
        read: async () => {
          const value = ReleaseCalendarSchema.parse(
            await json('/research-calendar?source=' + source),
          );
          return {
            details: [
              `${value.events.length} events in selected retained capture. Retrieved ${value.retrievedAt ?? 'not captured'}.`,
              `Edition ${value.edition ?? 'unavailable'}. These are announced release times, not published economic observations or market expectations.`,
            ],
            links: [
              {
                label: 'Open release calendar and editions',
                href: '#research-calendar',
              },
              { label: 'Official calendar source', href: value.sourceUrl },
            ],
          };
        },
      })),
    ];
    const result = await Promise.all(
      jobs.map(async (job) => {
        try {
          return { id: job.id, title: job.title, ...(await job.read()) };
        } catch (error) {
          return {
            id: job.id,
            title: job.title,
            details: [],
            links: [],
            error:
              error instanceof Error
                ? error.message
                : 'Source coverage unavailable.',
          };
        }
      }),
    );
    if (generation.current === ticket) {
      setRows(result);
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, []);
  return (
    <main
      className="panel source-workflow"
      aria-label="Global macro coverage"
      aria-busy={busy}
    >
      <a href="#more">Back to More</a>
      <h1>Global context, with clear coverage</h1>
      <p>
        See what this installation actually holds before interpreting global
        news. An available adapter is not proof of a successful source capture
        or verified economic impact on your holdings.
      </p>
      {busy && <p role="status">Loading source coverage…</p>}
      <button disabled={busy} onClick={() => void load()}>
        {busy ? 'Loading source coverage…' : 'Refresh source coverage'}
      </button>
      {rows.map((row) => (
        <section key={row.id} aria-label={row.title}>
          <h2>{row.title}</h2>
          {row.error ? (
            <p role="alert">
              {row.error} Use Refresh source coverage to retry.
            </p>
          ) : row.details.length ? (
            row.details.map((line) => <p key={line}>{line}</p>)
          ) : (
            <p>
              No selected global sources are registered in this installation.
            </p>
          )}
          <ul>
            {row.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  {...(link.href.startsWith('https:')
                    ? { target: '_blank', rel: 'noreferrer' }
                    : {})}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <h2>Coverage boundaries</h2>
        <p>
          Release headlines, numerical observations and announced release times
          are different records. No missing series, consensus expectation or
          historical vintage is inferred. FRED and Treasury numerical adapters
          are not enabled by this initial source selection. Paid/global
          expansion is separate.
        </p>
        <a href="#sources">Inspect source access and attribution</a>
      </section>
    </main>
  );
}
