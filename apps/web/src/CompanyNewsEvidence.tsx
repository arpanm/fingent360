import './source-workflows.css';
import { CompanyNewsProofSchema } from '@fingent360/contracts';
export function CompanyNewsEvidence({
  proof,
}: {
  proof: ReturnType<typeof CompanyNewsProofSchema.parse>;
}) {
  return (
    <section
      aria-label="Company news verification"
      className="reader-source source-workflow"
    >
      <h2>Compare the evidence</h2>
      <p>
        Editors recorded the source relationship and a reviewer checked
        publication. This is an editorial verification record, not a guarantee
        that a claim is correct.
      </p>
      <a href={`?equity=${encodeURIComponent(proof.isin)}#equities`}>
        {proof.companyName} · company evidence
      </a>
      <ul>
        {proof.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.name}
            </a>
            <p>
              {source.originator} ·{' '}
              {source.primary ? 'Primary release' : 'Supporting report'} ·{' '}
              {source.independentReporting
                ? 'Recorded as independently originated'
                : 'Related or syndicated report'}
            </p>
            <p>
              Published {source.publishedAt.slice(0, 10)} · retrieved{' '}
              {source.retrievedAt.slice(0, 10)} ·{' '}
              {source.rightsMode === 'link-only'
                ? 'Link and original summary only'
                : 'Source-specific reproduction permission recorded'}
            </p>
          </li>
        ))}
      </ul>
      <small>
        Evidence captured {proof.checkedAt.slice(0, 10)} · {proof.policy}
      </small>
    </section>
  );
}
