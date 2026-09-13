import { useEffect, useState } from 'react';
import {
  LearningSuggestionsSchema,
  goalMinorToRupees,
  type LearningSuggestion,
} from '@fingent360/contracts';
export function Assist({
  kind,
  onApply,
}: {
  kind: 'goal' | 'holding';
  onApply: (suggestion: LearningSuggestion) => void;
}) {
  const [items, setItems] = useState<LearningSuggestion[]>([]);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch('/api/v1/account/learning/suggestions', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15000),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'Previous entries could not be loaded. You can still enter your details.',
          );
        const result = LearningSuggestionsSchema.parse(await response.json());
        if (active) setItems(result.suggestions.filter((s) => s.kind === kind));
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Previous entries unavailable.',
          );
      });
    return () => {
      active = false;
    };
  }, [kind]);
  if (hidden) return null;
  if (error) return <p className="muted">{error}</p>;
  if (!items.length)
    return (
      <p className="muted">
        No previous {kind === 'goal' ? 'goal plans' : 'holdings'} to reuse yet.
        Start with your own details.
      </p>
    );
  return (
    <aside
      className="assist-panel panel"
      aria-label="Previous entry suggestions"
    >
      <div className="section-heading">
        <h3>Start from something you saved</h3>
        <button
          type="button"
          className="secondary"
          onClick={() => setHidden(true)}
        >
          Dismiss suggestions
        </button>
      </div>
      <p>
        Nothing changes until you choose Apply. These are your previous inputs,
        not a recommendation.
      </p>
      {items.map((item) => (
        <div key={item.sourceId} className="suggestion">
          <p>
            <strong>{item.sourceName}</strong> · saved{' '}
            {new Date(item.savedAt).toLocaleDateString()} · revision{' '}
            {item.sourceVersion}
          </p>
          <p>
            {item.kind === 'goal'
              ? `INR ${goalMinorToRupees(item.values.monthlyMinor)} monthly over ${item.values.horizonMonths} months`
              : `${item.values.quantity} units · total purchase cost INR ${goalMinorToRupees(item.values.totalCostMinor)}`}
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => onApply(item)}
          >
            Apply previous {item.kind === 'goal' ? 'plan' : 'holding'}
          </button>
        </div>
      ))}
    </aside>
  );
}
