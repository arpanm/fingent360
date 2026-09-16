import { IndiaGdpSnapshotSchema } from '@fingent360/contracts';
export function IndiaGdpReader({
  data,
  cutoff,
}: {
  data?: ReturnType<typeof IndiaGdpSnapshotSchema.parse>;
  cutoff: string | null;
}) {
  return (
    <section aria-label="India quarterly GDP">
      <h2>Quarterly economic output</h2>
      <p>
        Real GDP removes price changes using the stated base. Fiscal quarters
        and year-on-year growth are not calendar quarters or annualized growth.
        Different bases are never joined into one series.
      </p>
      {!data?.selected.length && (
        <p>
          No reviewed original quarterly GDP release is available for this
          cutoff.
        </p>
      )}
      {data?.selected.map((edition) => (
        <article key={edition.id}>
          <h3>
            {edition.point.quarter} FY{edition.point.fiscalYear} · base{' '}
            {edition.point.baseYear}
          </h3>
          <p>
            Real GDP {edition.point.value} lakh crore INR ·{' '}
            {edition.point.growthPercent}% year-on-year
          </p>
          <p>
            Same quarter FY{edition.point.previousFiscalYear}:{' '}
            {edition.point.previousYearValue} lakh crore INR at the same base.
            Benchmark-indicator estimate; subsequent revisions remain separate.
          </p>
          <p>
            Originally published {edition.publishedAt} · captured{' '}
            {edition.retrievedAt}. This is a publication-vintage view, not proof
            this app held the release then.
          </p>
          <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
            Original GDP release
          </a>
          {edition.nextRelease && (
            <p>
              Next release planned {edition.nextRelease.plannedOn}; day
              precision, actual publication not recorded by this schedule.
            </p>
          )}
          <details>
            <summary>GDP publication vintages</summary>
            {data.editions
              .filter(
                (value) =>
                  value.point.baseYear === edition.point.baseYear &&
                  value.point.fiscalYear === edition.point.fiscalYear &&
                  value.point.quarter === edition.point.quarter &&
                  (!cutoff || value.publishedAt <= cutoff),
              )
              .map((value) => (
                <p key={value.id}>
                  {value.publishedAt}: {value.point.value} lakh crore ·{' '}
                  {value.point.growthPercent}% · retained hash {value.hash}
                </p>
              ))}
          </details>
        </article>
      ))}
    </section>
  );
}
