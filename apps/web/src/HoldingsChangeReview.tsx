import type { HoldingsPreview } from '@fingent360/contracts';
import { goalMinorToRupees } from '@fingent360/contracts';
const amount = (value: string) =>
  `${value.startsWith('-') ? '-' : ''}₹${goalMinorToRupees(value.replace(/^-/, ''))}`;
export function HoldingsChangeReview({
  preview,
  acknowledged,
  onAcknowledge,
}: {
  preview: HoldingsPreview;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) {
  const review = preview.reconciliation;
  if (!review)
    return (
      <p role="alert">
        This older preview has no saved change review. Cancel it and create a
        fresh preview.
      </p>
    );
  const groups = ['added', 'removed', 'changed', 'unchanged'] as const;
  const removed = review.changes.filter((c) => c.status === 'removed');
  return (
    <section aria-label="Changes to your holdings">
      <h3>What will change</h3>
      <p>
        Compared with saved revision {review.baseline.version}. Total
        acquisition cost: {amount(review.baseline.totalCostMinor)} →{' '}
        {amount(preview.totalCostMinor)}; difference{' '}
        {amount(review.totalCostDeltaMinor)}.
      </p>
      <p>
        These are changes in recorded quantities and purchase costs, not market
        value, return or investment performance. “Absent” means no row exists in
        that list.
      </p>
      {groups.map((group) => (
        <section key={group} aria-label={`${group} holdings`}>
          <h4>
            {group[0]!.toUpperCase() + group.slice(1)} (
            {review.changes.filter((c) => c.status === group).length})
          </h4>
          {review.changes
            .filter((c) => c.status === group)
            .map((change) => (
              <article key={change.isin} className="panel">
                <h5>{change.isin}</h5>
                <p>
                  Quantity: {change.before?.quantity ?? 'Absent'} →{' '}
                  {change.after?.quantity ?? 'Absent'} · difference{' '}
                  {change.quantityDelta}
                </p>
                <p>
                  Acquisition cost:{' '}
                  {change.before
                    ? amount(change.before.totalCostMinor)
                    : 'Absent'}{' '}
                  →{' '}
                  {change.after
                    ? amount(change.after.totalCostMinor)
                    : 'Absent'}{' '}
                  · difference {amount(change.costDeltaMinor)}
                </p>
              </article>
            ))}
        </section>
      ))}
      <p>
        At preview time (
        {new Date(review.dependencies.checkedAt).toLocaleString()}),{' '}
        {review.dependencies.allocationRows} saved allocation rows and{' '}
        {review.dependencies.holdingConnections} active holding research
        connections use existing holdings. Any new holdings revision makes
        existing version bindings require review, including retained ISINs.
        Those records are not changed here.
      </p>
      <p>
        <a href="#allocations">Review goal allocations</a> ·{' '}
        <a href="#connections">Review research connections</a>
      </p>
      {removed.length > 0 && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
          />
          I acknowledge removing all {removed.length} listed holdings from this
          replacement.
        </label>
      )}
    </section>
  );
}
