import { useEffect, useRef, useState } from 'react';
import { EventLineagePublicSchema } from '@fingent360/contracts';
import { json } from './net';
import './event-lineage.css';
export function EventLineage({ id }: { id: string }) {
  const [value, setValue] = useState<ReturnType<
    typeof EventLineagePublicSchema.parse
  > | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const ticket = ++generation.current;
    setValue(null);
    setError('');
    void json('/events/' + id + '/lineage')
      .then((body) => {
        const result = EventLineagePublicSchema.parse(body);
        if (result.eventId !== id) throw Error('Wrong event lineage returned.');
        if (ticket === generation.current) setValue(result);
      })
      .catch(() => {
        if (ticket === generation.current)
          setError(
            'Reviewed replacements are unavailable. Retry to read current context.',
          );
      });
    return () => {
      generation.current++;
    };
  }, [id, retry]);
  return (
    <section className="event-lineage" aria-label="Reviewed event lineage">
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRetry(retry + 1)}>
            Retry event lineage
          </button>
        </p>
      )}
      {value?.relations.map((relation) => (
        <article key={relation.id}>
          <h2>
            {relation.direction === 'replaced-by'
              ? 'This event has reviewed replacements'
              : 'Reviewed original context'}
          </h2>
          <p>
            {relation.kind} reviewed{' '}
            <time dateTime={relation.reviewedAt}>
              {new Date(relation.reviewedAt).toLocaleString()}
            </time>
            . {relation.reason}
          </p>
          <p>
            Original revisions and private records were not rewritten. Each
            linked event remains subject to its current source status.
          </p>
          <ul>
            {relation.related.map((related) => (
              <li key={related.id}>
                {related.available ? (
                  <a href={'#events/' + related.id}>
                    {related.title ?? 'Read reviewed event'}
                  </a>
                ) : (
                  'Related event currently unavailable; its source or publication state changed.'
                )}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
