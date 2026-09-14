import { useEffect, useRef, useState } from 'react';
import {
  AuditFiltersSchema,
  AuditPageSchema,
  auditEvents,
  auditEventInfo,
  auditModules,
  auditModuleLabels,
  type AuditFilters,
  type AuditModule,
  type AuditPage,
  type AuditRow,
} from '@fingent360/contracts';
import { json, RequestError } from './net';

type Draft = { module: string; event: string; from: string; through: string };
const blank: Draft = { module: '', event: '', from: '', through: '' };
const sections: Partial<Record<AuditModule, string>> = {
  publishing: 'news',
  macro: 'macro',
  sources: 'sources',
  media: 'news',
  identities: 'securities',
  retention: 'retention',
};
export function OperatorAudit({
  request,
  onUnauthorized,
  onBack,
  onSection,
}: {
  request: typeof json;
  onUnauthorized: () => void;
  onBack: () => void;
  onSection: (section: string) => void;
}) {
  const [draft, setDraft] = useState(blank),
    [items, setItems] = useState<AuditRow[]>([]);
  const [page, setPage] = useState<AuditPage | null>(null),
    [busy, setBusy] = useState(true);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [invalidFilters, setInvalidFilters] = useState(false);
  const retry = useRef<{ filters: AuditFilters; cursor?: string }>({
    filters: {},
  });
  const generation = useRef(0),
    mounted = useRef(false),
    denied = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null),
    focusRow = useRef<string | null>(null);
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;
  useEffect(() => {
    mounted.current = true;
    heading.current?.focus();
    void load({});
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (focusRow.current)
      document.getElementById(`audit-${focusRow.current}`)?.focus();
    focusRow.current = null;
  }, [items]);
  function edit(next: Draft) {
    generation.current++;
    setDraft(next);
    setPage(null);
    setItems([]);
    setBusy(false);
    setError('');
    setInvalidFilters(false);
    setNotice('Filters changed. Apply filters to read matching activity.');
  }
  async function load(filters: AuditFilters, cursor?: string) {
    if (!mounted.current || denied.current) return;
    const ticket = ++generation.current;
    retry.current = { filters, ...(cursor === undefined ? {} : { cursor }) };
    setBusy(true);
    setError('');
    setNotice('');
    setInvalidFilters(false);
    if (!cursor) {
      setItems([]);
      setPage(null);
    }
    try {
      const query = new URLSearchParams(
        cursor
          ? { cursor }
          : Object.entries(filters).flatMap(([key, value]) =>
              value === undefined ? [] : [[key, value]],
            ),
      );
      const result = AuditPageSchema.parse(
        await request(`/ops/audit?${query}`),
      );
      if (
        JSON.stringify(result.filters) !==
        JSON.stringify(AuditFiltersSchema.parse(filters))
      )
        throw Error('Filter mismatch');
      if (!mounted.current || denied.current || ticket !== generation.current)
        return;
      if (
        cursor &&
        (JSON.stringify(result.upper) !== JSON.stringify(page?.upper) ||
          result.items.some((row) => items.some((old) => old.id === row.id)))
      )
        throw Error('Page mismatch');
      focusRow.current = cursor ? (result.items[0]?.id ?? null) : null;
      setItems((old) => (cursor ? [...old, ...result.items] : result.items));
      setPage(result);
      setNotice(
        cursor
          ? `${result.items.length} older records loaded.`
          : 'Filters applied. Recorded activity loaded.',
      );
    } catch (cause) {
      if (!mounted.current || denied.current) return;
      // Any authentication denial in this mounted session is a barrier, even
      // when a later filter request has overtaken the denied read.
      if (cause instanceof RequestError && cause.status === 401) {
        denied.current = true;
        generation.current++;
        setItems([]);
        setPage(null);
        setDraft(blank);
        setError('');
        setNotice('');
        setBusy(false);
        unauthorized.current();
      } else if (ticket === generation.current) {
        setError(
          cursor
            ? 'The older page could not be read. Displayed records are incomplete. Retry this page.'
            : 'Audit activity could not be read. Retry this page.',
        );
      }
    } finally {
      if (mounted.current && !denied.current && ticket === generation.current)
        setBusy(false);
    }
  }
  return (
    <section aria-label="Audit activity" className="account">
      <h2 ref={heading} tabIndex={-1}>
        Audit activity
      </h2>
      <p>
        Requests are recorded before validation or execution finishes. A request
        does not prove completed work, a named operator or the current state.
      </p>
      <p>
        Coverage: publishing, macro, source metadata, visual preparation,
        identity refresh requests and cleanup events. Feedback reviews and
        worker controls have separate histories. Targets and operator
        identifiers are withheld.
      </p>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = AuditFiltersSchema.safeParse(
            Object.fromEntries(
              Object.entries(draft).filter(([, value]) => value !== ''),
            ),
          );
          if (!parsed.success) {
            setInvalidFilters(true);
            setError(
              'Choose compatible section/event filters and a valid UTC date range.',
            );
            return;
          }
          void load(parsed.data);
        }}
      >
        <label htmlFor="audit-module">Activity section</label>
        <select
          id="audit-module"
          value={draft.module}
          onChange={(e) =>
            edit({ ...draft, module: e.target.value, event: '' })
          }
        >
          <option value="">All sections</option>
          {auditModules.map((module) => (
            <option key={module} value={module}>
              {auditModuleLabels[module]}
            </option>
          ))}
        </select>
        <label htmlFor="audit-event">Recorded event</label>
        <select
          id="audit-event"
          value={draft.event}
          onChange={(e) => edit({ ...draft, event: e.target.value })}
        >
          <option value="">All events</option>
          {auditEvents
            .filter(
              (event) =>
                !draft.module || auditEventInfo[event].module === draft.module,
            )
            .map((event) => (
              <option key={event} value={event}>
                {auditEventInfo[event].label}
              </option>
            ))}
        </select>
        <label htmlFor="audit-from">From date (UTC, inclusive)</label>
        <input
          id="audit-from"
          type="date"
          value={draft.from}
          onChange={(e) => edit({ ...draft, from: e.target.value })}
        />
        <label htmlFor="audit-through">Through date (UTC, inclusive)</label>
        <input
          id="audit-through"
          type="date"
          value={draft.through}
          onChange={(e) => edit({ ...draft, through: e.target.value })}
        />
        <div className="page-actions">
          <button disabled={busy}>Apply filters</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraft(blank);
              void load({});
            }}
          >
            Reset and read latest
          </button>
        </div>
      </form>
      {busy && <p role="status">Loading audit activity…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!invalidFilters && (
            <button
              disabled={busy}
              onClick={() =>
                void load(retry.current.filters, retry.current.cursor)
              }
            >
              Retry audit page
            </button>
          )}
        </div>
      )}
      {page?.upper && (
        <p>
          Browsing recorded times through{' '}
          <time dateTime={page.upper.recordedAt}>{page.upper.recordedAt}</time>.
          Reset starts a new window. This is not a complete as-of export;
          earlier requests may commit later.
        </p>
      )}
      {page && !items.length && !busy && !error && (
        <p>No activity matches these filters.</p>
      )}
      <ol aria-label="Recorded audit activity">
        {items.map((row) => (
          <li
            className="panel"
            key={row.id}
            id={`audit-${row.id}`}
            tabIndex={-1}
            style={{ overflowWrap: 'anywhere' }}
          >
            <h3>{auditEventInfo[row.event].label}</h3>
            <p>
              <time dateTime={row.recordedAt}>{row.recordedAt}</time> · UTC
              recorded time
            </p>
            <p>
              {auditModuleLabels[row.module]} ·{' '}
              {auditEventInfo[row.event].stage === 'request'
                ? 'Request only — outcome not established here.'
                : 'Historical event — current state not established here.'}
            </p>
            {sections[row.module] && (
              <button
                className="secondary"
                onClick={() => onSection(sections[row.module]!)}
              >
                Open {auditModuleLabels[row.module]} results and history
              </button>
            )}
          </li>
        ))}
      </ol>
      <p>
        Section links open existing module results; this ledger does not
        establish a matching completion receipt.
      </p>
      {page?.nextCursor && (
        <button
          disabled={busy || !!error}
          onClick={() => void load(page.filters, page.nextCursor!)}
        >
          Older activity
        </button>
      )}
      {page && !page.nextCursor && items.length > 0 && !error && (
        <p>End of this activity window.</p>
      )}
      <button className="secondary" onClick={onBack}>
        Back to Publishing
      </button>
    </section>
  );
}
