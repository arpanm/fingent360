import type { FeedbackReceipt } from '@fingent360/contracts';

export function FeedbackAccess({
  receipt,
}: {
  receipt: FeedbackReceipt | null;
}) {
  const history = receipt?.supportAccess;
  return (
    <section aria-label="Support access history">
      <h3>Who has opened my feedback?</h3>
      {!receipt ? (
        <p>
          This device has no server receipt yet. Support history is available
          after delivery.
        </p>
      ) : !history ? (
        <p>History has not been checked. Use Check delivery when connected.</p>
      ) : (
        <>
          <p>
            Last checked: {new Date(history.checkedAt).toLocaleString()}. Saved
            on this device; connect and use Check delivery to refresh.
          </p>
          <p>
            {history.total === 0
              ? 'No recorded support access as of this check.'
              : `${history.total} recorded support accesses. Showing the latest ${history.events.length}.`}
          </p>
          <ol>
            {history.events.map((event, index) => (
              <li key={`${event.accessedAt}-${index}`}>
                {event.action === 'support:list'
                  ? 'Administrator opened the inbox containing your feedback'
                  : 'Administrator opened your full feedback and attachments'}
                {' — '}
                {new Date(event.accessedAt).toLocaleString()}
              </li>
            ))}
          </ol>
          <p>
            Only access recorded after support auditing was enabled is included.
            Operator identities remain private. These events record authorized
            delivery by the server, not proof a person read every word.
          </p>
        </>
      )}
    </section>
  );
}
