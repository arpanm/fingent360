import { useEffect, useRef, useState } from 'react';
import './mapped-import.css';
import {
  inspectMappedCsv,
  parseMappedHoldings,
  MappedHoldingsInputSchema,
  SupplementedHoldingsInputSchema,
  goalMinorToRupees,
  type MappedHoldingsInput,
  type Holding,
} from '@fingent360/contracts';
import { supplementalBasisLabels } from './SupplementalCostReceipt';

export function MappedCsvImport({
  disabled,
  onPrepared,
  onInvalidate,
  onDirty,
  onReading,
  onCancel,
}: {
  disabled: boolean;
  onPrepared: (input: MappedHoldingsInput, holdings: Holding[]) => void;
  onInvalidate: () => void;
  onDirty: (value: boolean) => void;
  onReading: (value: boolean) => void;
  onCancel: () => void;
}) {
  const generation = useRef(0);
  const [csv, setCsv] = useState(''),
    [headers, setHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<string[][]>([]);
  const [costMode, setCostMode] = useState<'column' | 'supplemental'>('column');
  const [costs, setCosts] = useState<string[]>([]),
    [basis, setBasis] = useState('');
  const [attested, setAttested] = useState(false);
  const [columns, setColumns] = useState({
    isinColumn: '',
    quantityColumn: '',
    costColumn: '',
  });
  const [unit, setUnit] = useState(''),
    [combine, setCombine] = useState(false);
  const [count, setCount] = useState(''),
    [total, setTotal] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [review, setReview] = useState<ReturnType<
    typeof parseMappedHoldings
  > | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      onReading(false);
    },
    [onReading],
  );
  function changed() {
    setReview(null);
    setError('');
    setAttested(false);
    onInvalidate();
    onDirty(true);
  }
  function resetCosts() {
    setCosts(sourceRows.map(() => ''));
    setTotal('');
    setAttested(false);
  }
  const selectedNames =
    costMode === 'column'
      ? (['isinColumn', 'quantityColumn', 'costColumn'] as const)
      : (['isinColumn', 'quantityColumn'] as const);
  return (
    <section
      className="panel mapped-import"
      aria-label="Map CSV columns"
      data-feedback-private
    >
      <h3>Map your CSV columns</h3>
      <p>
        Choose the columns yourself. This is a user-defined mapping, not a
        verified broker adapter. Use a complete holdings list. Acquisition costs
        must come from an exact cost column or your own reconciled records.
        Average prices and market values are never converted into acquisition
        costs. Raw files, extra column values and column names are not stored.
      </p>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Reading CSV columns…</p>}
      <fieldset disabled={disabled || busy}>
        <legend>Source file and mapping</legend>
        <fieldset>
          <legend>Where will acquisition costs come from?</legend>
          <label className="check-label">
            <input
              type="radio"
              name="mapped-cost-mode"
              checked={costMode === 'column'}
              onChange={() => {
                changed();
                setCostMode('column');
                resetCosts();
              }}
            />
            Use a total acquisition cost column
          </label>
          <label className="check-label">
            <input
              type="radio"
              name="mapped-cost-mode"
              checked={costMode === 'supplemental'}
              onChange={() => {
                changed();
                setCostMode('supplemental');
                resetCosts();
              }}
            />
            Supply exact costs from my records
          </label>
        </fieldset>
        <label className="field" htmlFor="mapped-csv-file">
          Upload CSV to map
        </label>
        <input
          id="mapped-csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const ticket = ++generation.current;
            setBusy(true);
            onReading(true);
            setError('');
            void (async () => {
              try {
                if (
                  !file.name.toLowerCase().endsWith('.csv') ||
                  file.size > 50000
                )
                  throw Error('Choose a UTF-8 CSV file no larger than 50 KB.');
                const text = new TextDecoder('utf-8', { fatal: true }).decode(
                  await file.arrayBuffer(),
                );
                const inspected = inspectMappedCsv(text, 2);
                if (ticket !== generation.current) return;
                changed();
                setCsv(text);
                setHeaders(inspected.headers);
                setSourceRows(inspected.rows);
                setCosts(inspected.rows.map(() => ''));
                setBasis('');
                setColumns({
                  isinColumn: '',
                  quantityColumn: '',
                  costColumn: '',
                });
                setUnit('');
                setCombine(false);
                setCount('');
                setTotal('');
              } catch (e) {
                if (ticket === generation.current)
                  setError(
                    `${e instanceof Error ? e.message : 'Unreadable CSV.'} The previous mapping and saved holdings are unchanged.`,
                  );
              } finally {
                if (ticket === generation.current) {
                  setBusy(false);
                  onReading(false);
                }
              }
            })();
          }}
        />
        {headers.length > 0 && (
          <>
            <p>
              {headers.length} source columns. Only the{' '}
              {costMode === 'column' ? 'three' : 'two'} selected columns will be
              used; {Math.max(0, headers.length - selectedNames.length)} others
              will be discarded.
            </p>
            <div className="form-grid">
              {selectedNames.map((name, index) => (
                <div className="field" key={name}>
                  <label htmlFor={`mapped-${name}`}>
                    {
                      [
                        'ISIN column',
                        'Quantity column',
                        'Total acquisition cost column',
                      ][index]
                    }
                  </label>
                  <select
                    id={`mapped-${name}`}
                    value={columns[name]}
                    onChange={(e) => {
                      changed();
                      setColumns({ ...columns, [name]: e.target.value });
                      if (costMode === 'supplemental') resetCosts();
                    }}
                  >
                    <option value="">Choose a column</option>
                    {headers.map((header, i) => (
                      <option key={i} value={String(i)}>
                        {i + 1}. {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="field">
                <label htmlFor="mapped-cost-unit">
                  {costMode === 'column'
                    ? 'Source cost unit'
                    : 'Supplied cost unit'}
                </label>
                <select
                  id="mapped-cost-unit"
                  value={unit}
                  onChange={(e) => {
                    changed();
                    setUnit(e.target.value);
                    resetCosts();
                  }}
                >
                  <option value="">Choose a unit</option>
                  <option value="INR-rupees">
                    INR rupees (up to two decimals)
                  </option>
                  <option value="INR-paise">Whole INR paise</option>
                </select>
              </div>
              {costMode === 'supplemental' && (
                <div className="field">
                  <label htmlFor="mapped-cost-basis">
                    Records used for supplied costs
                  </label>
                  <select
                    id="mapped-cost-basis"
                    value={basis}
                    onChange={(e) => {
                      changed();
                      setBasis(e.target.value);
                      resetCosts();
                    }}
                  >
                    <option value="">Choose your records</option>
                    {Object.entries(supplementalBasisLabels).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="mapped-row-count">
                  Declared source row count
                </label>
                <input
                  id="mapped-row-count"
                  inputMode="numeric"
                  maxLength={3}
                  value={count}
                  onChange={(e) => {
                    changed();
                    setCount(e.target.value);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="mapped-total">
                  {costMode === 'column'
                    ? 'Declared source acquisition-cost total'
                    : 'Declared reconciled acquisition-cost total'}
                </label>
                <input
                  id="mapped-total"
                  inputMode="decimal"
                  maxLength={24}
                  value={total}
                  onChange={(e) => {
                    changed();
                    setTotal(e.target.value);
                  }}
                />
              </div>
            </div>
            {costMode === 'column' ? (
              <p>
                Copy the number of data rows (excluding the header) and
                purchase-cost total from your source. The total uses your
                selected unit. Reconcile your source first if it does not
                provide a total.
              </p>
            ) : (
              <>
                <p>
                  Copy the source row count, then enter the independently
                  reconciled total from your acquisition records in the selected
                  unit. Supplied costs are saved as your attestation. Broker
                  averages, valuations and other unselected columns are
                  discarded.
                </p>
                {columns.isinColumn !== '' &&
                  columns.quantityColumn !== '' &&
                  unit && (
                    <ol
                      className="supplemental-cost-rows"
                      aria-label="Costs supplied for source rows"
                    >
                      {sourceRows.map((cells, index) => (
                        <li key={index}>
                          <p>
                            Source row {index + 2} · ISIN{' '}
                            {cells[Number(columns.isinColumn)]
                              ?.trim()
                              .toUpperCase()}{' '}
                            · quantity{' '}
                            {cells[Number(columns.quantityColumn)]?.trim()}
                          </p>
                          <label htmlFor={`supplemental-cost-${index}`}>
                            Total acquisition cost for source row {index + 2} (
                            {unit === 'INR-paise' ? 'paise' : 'rupees'})
                          </label>
                          <input
                            id={`supplemental-cost-${index}`}
                            inputMode="decimal"
                            maxLength={24}
                            value={costs[index] ?? ''}
                            onChange={(e) => {
                              changed();
                              setCosts(
                                costs.map((value, i) =>
                                  i === index ? e.target.value : value,
                                ),
                              );
                            }}
                          />
                        </li>
                      ))}
                    </ol>
                  )}
                {sourceRows.length === 0 && (
                  <p>
                    This file has no data rows. A zero-row replacement requires
                    count 0 and total 0, and the existing removal review.
                  </p>
                )}
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => {
                      changed();
                      setAttested(e.target.checked);
                    }}
                  />
                  I attest that each supplied cost is the exact total
                  acquisition cost for its stated quantity from my selected
                  records, not an estimate from average prices or market values.
                </label>
              </>
            )}
            <label className="check-label">
              <input
                type="checkbox"
                checked={combine}
                onChange={(e) => {
                  changed();
                  setCombine(e.target.checked);
                }}
              />
              Combine duplicate ISIN rows by adding their quantities and total
              acquisition costs
            </label>
            <button
              type="button"
              onClick={() => {
                try {
                  if (
                    selectedNames.some((name) => columns[name] === '') ||
                    !unit ||
                    !/^(0|[1-9][0-9]{0,2})$/.test(count)
                  )
                    throw Error(
                      'Choose every column and the cost unit, then enter the declared source count and total.',
                    );
                  if (
                    costMode === 'supplemental' &&
                    (!basis || !attested || costs.some((cost) => !cost.trim()))
                  )
                    throw Error(
                      'Supply every row cost, choose your records and explicitly attest to the acquisition costs.',
                    );
                  const input: MappedHoldingsInput =
                    costMode === 'column'
                      ? MappedHoldingsInputSchema.parse({
                          format: 'mapped-csv',
                          csv,
                          mapping: {
                            isinColumn: Number(columns.isinColumn),
                            quantityColumn: Number(columns.quantityColumn),
                            costColumn: Number(columns.costColumn),
                            costUnit: unit,
                            duplicates: combine ? 'combine' : 'reject',
                          },
                          declaredRowCount: Number(count),
                          declaredTotal: total.trim(),
                        })
                      : SupplementedHoldingsInputSchema.parse({
                          format: 'supplemented-csv',
                          csv,
                          mapping: {
                            isinColumn: Number(columns.isinColumn),
                            quantityColumn: Number(columns.quantityColumn),
                            costUnit: unit,
                            duplicates: combine ? 'combine' : 'reject',
                          },
                          declaredRowCount: Number(count),
                          declaredTotal: total.trim(),
                          supplement: {
                            origin: 'user-attested-acquisition-cost',
                            basis,
                            attested,
                            rows: sourceRows.map((cells, i) => ({
                              sourceRow: i + 2,
                              isin: cells[
                                Number(columns.isinColumn)
                              ]!.trim().toUpperCase(),
                              quantity:
                                cells[Number(columns.quantityColumn)]!.trim(),
                              totalCost: costs[i]!.trim(),
                            })),
                          },
                        });
                  const result = parseMappedHoldings(input);
                  setError('');
                  setReview(result);
                  onPrepared(input, result.holdings);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'Check your mapping.',
                  );
                }
              }}
            >
              Prepare mapped draft
            </button>
          </>
        )}
      </fieldset>
      {review && (
        <section aria-label="Mapped CSV review">
          <p role="status">
            {review.import.supplement
              ? 'Supplied costs reconciled; user-attested.'
              : 'Source totals reconciled.'}{' '}
            {review.import.declaredRowCount} source rows →{' '}
            {review.holdings.length} holdings. Total purchase cost INR{' '}
            {goalMinorToRupees(review.import.declaredTotalMinor!)}. Nothing
            saved yet.
          </p>
          <p>
            Review the normalized rows below, then consent and preview the full
            replacement.
          </p>
        </section>
      )}
      <button
        type="button"
        className="secondary"
        disabled={disabled}
        onClick={onCancel}
      >
        Cancel mapping and restore draft
      </button>
    </section>
  );
}
