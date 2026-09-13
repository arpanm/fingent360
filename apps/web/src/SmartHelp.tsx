import { useEffect, useId, useState } from 'react';
import {
  AssistanceOptionsSchema,
  AssistanceResultSchema,
  type AssistanceInput,
  type AssistanceResult,
} from '@fingent360/contracts';
export function SmartHelp({
  scope,
  onApplyName,
}: {
  scope: AssistanceInput['scope'];
  onApplyName?: (name: string) => void;
}) {
  const controlId = useId();
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [provider, setProvider] =
    useState<AssistanceInput['provider']>('query');
  const [history, setHistory] = useState(false);
  const [options, setOptions] = useState<
    { provider: 'openai' | 'gemini' | 'anthropic'; model: string }[]
  >([]);
  const [result, setResult] = useState<AssistanceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetch('/api/v1/account/assistance/options', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15000),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const value = AssistanceOptionsSchema.parse(await response.json());
        if (active) {
          setOptions(value.providers);
          setProvider(value.defaultProvider);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function ask() {
    if (busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/v1/account/assistance', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, provider, scope, useHistory: history }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Sign in to get help with saved information.'
            : response.status === 429
              ? 'Please wait a minute before asking again.'
              : 'Help is unavailable. Please try again.',
        );
      setResult(AssistanceResultSchema.parse(await response.json()));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Help is unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel smart-help">
      <summary>Help me with this</summary>
      <p>
        Search explanations and draft names from reviewed content and, if you
        choose, your saved entries. Nothing is changed automatically.
      </p>
      <label htmlFor={`${controlId}-query`}>
        What would you like help with?
      </label>
      <input
        id={`${controlId}-query`}
        disabled={busy}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (loaded && query.trim().length >= 2) void ask();
          }
        }}
        value={query}
        maxLength={500}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          scope === 'goals'
            ? 'For example: name my education goal'
            : 'For example: what is an ISIN?'
        }
      />
      <label htmlFor={`${controlId}-provider`}>Assistance provider</label>
      <select
        id={`${controlId}-provider`}
        disabled={busy || !loaded}
        value={provider}
        onChange={(event) => {
          setProvider(event.target.value as AssistanceInput['provider']);
          setResult(null);
        }}
      >
        <option value="query">Query-based suggestions</option>
        <option value="auto">Configured default</option>
        {options.map((value) => (
          <option key={value.provider} value={value.provider}>
            {value.provider} · {value.model}
          </option>
        ))}
      </select>
      <p>
        {provider === 'query'
          ? 'Your question is matched on this server without calling an AI provider.'
          : 'Your question and relevant reference excerpts may be sent to the configured provider. Avoid including private documents or secrets in your question.'}
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          disabled={busy}
          checked={history}
          onChange={(event) => {
            setHistory(event.target.checked);
            setResult(null);
          }}
        />
        Use my saved{' '}
        {scope === 'goals'
          ? 'goal names'
          : scope === 'holdings'
            ? 'holding identifiers'
            : 'entries'}{' '}
        for this request
        {provider !== 'query'
          ? ' and share relevant matches with the selected provider'
          : ''}
        .
      </label>
      <button
        type="button"
        disabled={busy || !loaded || query.trim().length < 2}
        onClick={() => void ask()}
      >
        {busy ? 'Finding help…' : 'Get suggestions'}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <section aria-label="Assistance results">
          <p role="status">{result.message}</p>
          <p className="muted">
            {result.provider === 'query'
              ? 'Query-based'
              : `${result.provider} · ${result.model}`}{' '}
            ·{' '}
            {result.usedHistory
              ? 'Saved history used'
              : 'No saved history used'}
          </p>
          {result.suggestions.map((value, index) => (
            <article key={`${value.source.id}-${index}`}>
              <p>{value.text}</p>
              <a href={value.source.href}>
                {value.source.title}
                {value.source.private ? ' · your saved entry' : ''}
              </a>
              {value.type === 'goal_name' && onApplyName && (
                <button type="button" onClick={() => onApplyName(value.text)}>
                  Apply name suggestion
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </details>
  );
}
