import { EventLineagePlanSchema } from '@fingent360/contracts';
import './event-lineage.css';

export function EventLineagePlanView({
  plan,
}: {
  plan: ReturnType<typeof EventLineagePlanSchema.parse>;
}) {
  return (
    <section
      className="event-lineage"
      aria-label="Stored lineage before and after"
    >
      <p>
        These are the exact saved editorials, not a fresh source reading.
        Approval checks their versions and evidence again.
      </p>
      {(['originals', 'outputs'] as const).map((group) => (
        <section
          key={group}
          aria-label={
            group === 'originals' ? 'Stored originals' : 'Stored replacements'
          }
        >
          <h4>{group === 'originals' ? 'Originals' : 'Replacement outputs'}</h4>
          {plan[group].map((record) => (
            <article key={record.id}>
              <h5>{record.editorial.title}</h5>
              <p>
                {record.id} · revision {record.version} ·{' '}
                {record.editorial.claimKind}
              </p>
              <p>
                {record.editorial.family} ·{' '}
                {record.editorial.geography.join(', ')}
              </p>
              <p>{record.editorial.explanation}</p>
              <p>
                Announced: {record.editorial.announcedAt ?? 'Unknown'}.
                Effective: {record.editorial.effectiveAt ?? 'Unknown'}.
              </p>
              {record.editorial.citations.map((citation, index) => (
                <blockquote key={index}>
                  <p>{citation.quote}</p>
                  <footer>
                    {citation.sourceId} · revision {citation.version} ·{' '}
                    {citation.field} · hash {citation.hash}
                  </footer>
                </blockquote>
              ))}
              <details>
                <summary>
                  Complete stored provenance and contextual links
                </summary>
                <pre>
                  {JSON.stringify(
                    {
                      sources: record.sources,
                      identities: record.identities,
                      graph: record.graph,
                      links: record.editorial.links,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </article>
          ))}
        </section>
      ))}
    </section>
  );
}
