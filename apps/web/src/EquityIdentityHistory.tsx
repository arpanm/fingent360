import {
  EquityCompanySchema,
  reconcileEquityIdentity,
} from '@fingent360/contracts';
export function EquityIdentityHistory({
  company,
}: {
  company: ReturnType<typeof EquityCompanySchema.parse>;
}) {
  const result = reconcileEquityIdentity(company.records, company.truncated);
  return (
    <section aria-label="Exchange identity reconciliation">
      <h2>
        {result.status === 'review-required'
          ? 'Identity records need review'
          : 'Dated exchange identity'}
      </h2>
      {result.status === 'no-identity' ? (
        <p>No reviewed master identity is available for this ISIN.</p>
      ) : (
        <>
          <p>
            {result.editions} retained identity editions for {company.isin}.
          </p>
          <p>{result.symbols.join(' · ')}</p>
          {result.conflicts.length > 0 && (
            <p role="alert">
              Same-date identity disagreements: {result.conflicts.join(', ')}.
              No conflicting identity is selected as authoritative.
            </p>
          )}
          <details>
            <summary>Names and identity limitations</summary>
            <p>{result.names.join(' · ')}</p>
            {result.limitations.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
