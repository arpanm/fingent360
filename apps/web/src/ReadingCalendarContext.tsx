import { ReadingCalendarContextSchema } from '@fingent360/contracts';
type Context = ReturnType<typeof ReadingCalendarContextSchema.parse>;
export function ReadingCalendarContext({ value }: { value: Context }) {
  return (
    <section className="panel" aria-label="Reading release context">
      <h2>What is scheduled next</h2>
      <p>
        Planned publication dates for supported sources you follow. A schedule
        is not a released observation, a reading alert or an investment signal.
      </p>
      {value.state === 'not-selected' ? (
        <p>
          No exact calendar association for your selected sources. Topics and
          historical-only sources do not imply one.
        </p>
      ) : value.state === 'muted' ? (
        <p>Calendar context is paused while reading updates are muted.</p>
      ) : value.state === 'unavailable' ? (
        <p>
          No retained calendar is available for these follows. Reload after a
          permitted capture or refresh the downloaded app snapshot.
        </p>
      ) : (
        <>
          <p>
            {value.state === 'stale'
              ? 'This capture is stale; planned dates may have changed.'
              : 'Dates are from the retained capture and may change.'}{' '}
            Retrieved {value.retrievedAt}.
          </p>
          {value.events.length ? (
            <ul>
              {value.events.map((event) => (
                <li key={event.uid}>
                  <strong>{event.title}</strong> · {event.scheduledAt} ·{' '}
                  {event.cancelled ? 'Cancelled' : 'Scheduled'} · source
                  revision {event.sequence}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No upcoming entries match this capture and your exact source
              selection.
            </p>
          )}
          {value.additional > 0 && (
            <p>
              {value.additional} additional planned entries are available in the
              calendar.
            </p>
          )}
          <details>
            <summary>Calendar provenance</summary>
            <p>
              Edition {value.edition}; view captured {value.observedAt}. Event
              identifiers:{' '}
              {value.events.map((event) => event.uid).join(', ') || 'None'}.
            </p>
            <a href={value.sourceUrl} target="_blank" rel="noreferrer">
              Original BEA calendar
            </a>
          </details>
        </>
      )}
      <a href="#research-calendar">Open release calendars</a>
    </section>
  );
}
