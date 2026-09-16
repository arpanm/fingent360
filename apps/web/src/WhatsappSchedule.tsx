import { useEffect, useRef, useState } from 'react';
import {
  WhatsappScheduleViewSchema,
  WhatsappScheduleConfigSchema,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
const sourceNames: Record<string, string> = {
  glossary: 'Learning glossary',
  fed: 'Federal Reserve',
  pib: 'India government releases',
  bea: 'US economic releases',
  'ecb-statistics': 'European statistics',
  'ecb-press': 'European central bank releases',
  'world-bank': 'World Bank',
  'bea-gdp-original': 'Original US GDP releases',
};
export function WhatsappSchedule() {
  const [value, setValue] = useState<ReturnType<
      typeof WhatsappScheduleViewSchema.parse
    > | null>(null),
    [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily'),
    [time, setTime] = useState('09:00'),
    [timezone, setTimezone] = useState('Asia/Kolkata'),
    [weekday, setWeekday] = useState(1),
    [maxItems, setMaxItems] = useState(1),
    [maxAgeHours, setMaxAgeHours] = useState(24),
    [selected, setSelected] = useState<string[]>([]),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const live = useRef(true),
    intent = useRef<{ key: string; id: string } | null>(null);
  async function load() {
    const reply = WhatsappScheduleViewSchema.parse(
      await json('/account/whatsapp/schedule'),
    );
    if (live.current) {
      setValue(reply);
      const cfg = reply.schedule?.config;
      if (cfg) {
        setFrequency(cfg.frequency);
        setTime(cfg.time);
        setTimezone(cfg.timezone);
        setWeekday(cfg.weekday);
        setMaxItems(cfg.maxItems);
        setMaxAgeHours(cfg.maxAgeHours);
        setSelected(cfg.sourceIds);
      }
    }
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (live.current) {
        setError(
          cause instanceof Error ? cause.message : 'Schedule unavailable.',
        );
        if (cause instanceof RequestError && cause.status === 401) {
          setValue(null);
          setConsent(false);
          setSelected([]);
          intent.current = null;
        }
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void run(load);
    return () => {
      live.current = false;
    };
  }, []);
  async function change(action: 'save' | 'pause' | 'resume' | 'delete') {
    const cfg =
      action === 'save'
        ? WhatsappScheduleConfigSchema.parse({
            frequency,
            time,
            timezone,
            weekday,
            maxItems,
            maxAgeHours,
            sourceIds: selected,
          })
        : undefined;
    const body = {
        action,
        expectedVersion: value?.schedule?.version ?? 0,
        consent: true as const,
        ...(cfg ? { config: cfg } : {}),
      },
      key = JSON.stringify(body);
    if (intent.current?.key !== key)
      intent.current = { key, id: crypto.randomUUID() };
    await json(
      '/account/whatsapp/schedule',
      { ...body, requestId: intent.current.id },
      'POST',
    );
    intent.current = null;
    if (live.current) setConsent(false);
    await load();
  }
  return (
    <section
      className="panel"
      aria-label="Recurring WhatsApp summaries"
      aria-busy={busy}
    >
      <h2>Your recurring public summaries</h2>
      <p>
        One daily or weekly digest, up to three separate public-summary
        messages. Missed runs over ten minutes are skipped; nothing catches up
        later. No private reports or portfolio data are included. At most three
        scheduled summaries in 24 hours, separate from single-summary requests.
      </p>
      {busy && <p role="status">Updating schedule…</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void run(load)}>
        Refresh recurring schedule
      </button>
      {value && (
        <>
          <p>
            Schedule: {value.schedule?.state ?? 'Not saved'} · Next:{' '}
            {value.schedule?.nextDueAt ?? 'none'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => change('save'));
            }}
            onChange={() => setConsent(false)}
          >
            <fieldset disabled={busy}>
              <label>
                Frequency
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as 'daily' | 'weekly')
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <label>
                Local delivery time
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label>
                IANA timezone
                <input
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
              {frequency === 'weekly' && (
                <label>
                  Weekday
                  <select
                    value={weekday}
                    onChange={(e) => setWeekday(Number(e.target.value))}
                  >
                    {[
                      'Sunday',
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                    ].map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Maximum summaries
                <input
                  type="number"
                  min="1"
                  max="3"
                  required
                  value={maxItems}
                  onChange={(e) => setMaxItems(Number(e.target.value))}
                />
              </label>
              <label>
                Maximum age in hours
                <input
                  type="number"
                  min="1"
                  max="168"
                  required
                  value={maxAgeHours}
                  onChange={(e) => setMaxAgeHours(Number(e.target.value))}
                />
              </label>
              <fieldset>
                <legend>Admitted public sources</legend>
                {value.availableSources.map((source) => (
                  <label key={source}>
                    <input
                      type="checkbox"
                      checked={selected.includes(source)}
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, source]
                            : v.filter((s) => s !== source),
                        )
                      }
                    />
                    {sourceNames[source] ?? source}
                  </label>
                ))}
                {!value.availableSources.length && (
                  <p>No sources approved for this channel.</p>
                )}
              </fieldset>
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => {
                  e.stopPropagation();
                  setConsent(e.target.checked);
                }}
              />
              I consent to this recurring public-summary schedule on my verified
              WhatsApp number.
            </label>
            <button disabled={busy || !consent || !selected.length}>
              Save recurring schedule
            </button>
          </form>
          {value.schedule?.state === 'active' && (
            <button
              disabled={busy}
              onClick={() => void run(() => change('pause'))}
            >
              Pause recurring summaries
            </button>
          )}
          {value.schedule?.state === 'paused' && (
            <button
              disabled={busy || !consent}
              onClick={() => void run(() => change('resume'))}
            >
              Resume recurring summaries
            </button>
          )}
          {value.schedule && value.schedule.state !== 'deleted' && (
            <button
              disabled={busy}
              onClick={() => void run(() => change('delete'))}
            >
              Delete recurring schedule
            </button>
          )}
          <h3>Latest 100 occurrences</h3>
          {!value.occurrences.length ? (
            <p>No recorded occurrences yet.</p>
          ) : (
            <ol>
              {value.occurrences.map((row) => (
                <li key={row.id}>
                  {row.dueAt} · {row.outcome} · {row.detail}
                  <p>
                    {row.jobIds.length} delivery records; see delivery history
                    for actual receipts.
                  </p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
