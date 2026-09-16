import { useState } from 'react';
import { AMFI_HISTORY_CATALOG, amfiHistoryUrl } from '@fingent360/contracts';
export function AmfiHistorySelector({
  onChoose,
  disabled,
}: {
  onChoose: (url: string) => void;
  disabled: boolean;
}) {
  const [amc, setAmc] = useState(''),
    [type, setType] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState('');
  return (
    <fieldset disabled={disabled}>
      <legend>Build an official historical NAV request</legend>
      <p>
        Published source choices recorded {AMFI_HISTORY_CATALOG.observedOn}.
        Historic or inactive AMCs remain listed as the source lists them; this
        does not establish available observations or permission.
      </p>
      <label>
        History mutual fund
        <select
          value={amc}
          onChange={(event) => {
            setAmc(event.target.value);
            setError('');
          }}
        >
          <option value="">All mutual funds (one date)</option>
          {AMFI_HISTORY_CATALOG.amcs.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        History scheme type
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          {AMFI_HISTORY_CATALOG.types.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {amc ? 'History from date' : 'History NAV date'}
        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      {amc && (
        <label>
          History to date
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      )}
      <button
        type="button"
        disabled={!from || (Boolean(amc) && !to)}
        onClick={() => {
          try {
            const url = amfiHistoryUrl(amc, type, from, to);
            onChoose(url);
            setError('');
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : 'Choose a valid source interval.',
            );
          }
        }}
      >
        Use this history request
      </button>
      {error && <p role="alert">{error}</p>}
      <p>
        One AMC accepts up to 90 inclusive days. All AMCs uses the provider’s
        single-date report. Use another request for another interval; source
        bytes and reviews remain separate.
      </p>
      <details>
        <summary>History catalog provenance</summary>
        <a
          href={AMFI_HISTORY_CATALOG.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Official AMFI source form
        </a>
        <p>{AMFI_HISTORY_CATALOG.version}</p>
        <code>{AMFI_HISTORY_CATALOG.sourceHash}</code>
      </details>
    </fieldset>
  );
}
