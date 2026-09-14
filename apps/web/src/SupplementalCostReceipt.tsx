import {
  goalMinorToRupees,
  type HoldingsSnapshot,
} from '@fingent360/contracts';

export const supplementalBasisLabels = {
  'trade-confirmations': 'Trade confirmations',
  'prior-broker-records': 'Prior broker records',
  'personal-acquisition-records': 'Personal acquisition records',
} as const;

export function SupplementalCostReceipt({
  imported,
}: {
  imported: HoldingsSnapshot['import'];
}) {
  const receipt = imported?.supplement;
  if (!imported || !receipt) return null;
  return (
    <section
      aria-label="Supplemental acquisition-cost receipt"
      data-feedback-private
    >
      <p>
        Acquisition costs supplied and attested by you using{' '}
        {supplementalBasisLabels[receipt.basis].toLowerCase()}. Source averages
        and market values were not used as acquisition costs. This is not a
        verified broker import.
      </p>
      <details>
        <summary>View supplied cost receipts</summary>
        <p>
          {imported.declaredRowCount} source rows ·{' '}
          {imported.consolidatedRowCount} holdings · reconciled total INR{' '}
          {goalMinorToRupees(imported.declaredTotalMinor!)}.
        </p>
        {receipt.rows.map((row) => (
          <p key={row.sourceRow}>
            Source row {row.sourceRow} · {row.isin} · quantity {row.quantity} ·
            supplied acquisition cost INR{' '}
            {goalMinorToRupees(row.totalCostMinor)}.
          </p>
        ))}
      </details>
    </section>
  );
}
