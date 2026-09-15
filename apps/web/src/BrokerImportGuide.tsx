import { useState } from 'react';
import { brokerCapabilities, BrokerIdSchema } from '@fingent360/contracts';

export const brokerImportResearch = brokerCapabilities().brokers;

export function BrokerImportGuide({
  onMap,
  disabled = false,
}: {
  onMap?: () => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState('');
  const broker = brokerImportResearch.find((item) => item.id === selected);
  return (
    <details className="broker-import-guide">
      <summary>Broker export help and supported imports</summary>
      <label className="field">
        Your broker
        <select
          value={selected}
          onChange={(event) => {
            const value = event.target.value;
            setSelected(value ? BrokerIdSchema.parse(value) : '');
          }}
        >
          <option value="">Choose a broker for export instructions</option>
          {brokerImportResearch.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {broker ? (
        <section key={broker.id} aria-label={`${broker.name} import guidance`}>
          <h4>{broker.name}</h4>
          <p role="status">Automatic {broker.name} format is not enabled.</p>
          <p>{broker.evidence}</p>
          <a href={broker.url} target="_blank" rel="noopener noreferrer">
            {broker.name} official export help (opens a new tab)
          </a>
          {broker.caution && <p>{broker.caution}</p>}
          {broker.detailUrl && (
            <a
              href={broker.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {broker.name} additional guidance (opens a new tab)
            </a>
          )}
          <details>
            <summary>Why does this need a review?</summary>
            <p>{broker.gap}</p>
            <p>
              Public documentation reviewed {broker.evidenceReviewedOn}.
              Selecting a broker does not verify your file or its acquisition
              costs.
            </p>
          </details>
        </section>
      ) : (
        <p>
          Select your broker to see its download instructions and supported
          route.
        </p>
      )}
      <p>
        Use a complete holdings list with ISIN, quantity and exact total
        acquisition cost. Convert the intended workbook sheet to CSV before
        mapping. If costs are missing, choose Supply exact costs from my
        records. Average prices, valuations and transfer-day prices must not
        replace acquisition costs.
      </p>
      {onMap && (
        <button type="button" disabled={disabled} onClick={onMap}>
          Continue with reviewed CSV mapping
        </button>
      )}
      <p>
        The mapping, reconciliation and explicit replacement review work on this
        device without a broker connection. No login to your broker is required.
        Raw files are not retained. Supplied cost receipts are saved only when
        you confirm the holdings replacement.
      </p>
    </details>
  );
}
