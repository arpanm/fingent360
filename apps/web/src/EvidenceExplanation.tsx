import { useEffect, useRef, useState } from 'react';
import {
  EvidenceExplanationSchema,
  FeedItemSchema,
  ResearchConnectionsSchema,
  connectionSource,
  type EvidenceExplanation as Explanation,
  type FeedItem,
  type ResearchConnections,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { TermLink } from './TermLink';
import './evidence-explanations.css';

export function EvidenceExplanation({
  item,
  onRefresh,
  onEvidence,
  onHistory,
  onTerm,
  onSignOut,
}: {
  item: FeedItem;
  onRefresh: () => void;
  onEvidence: () => void;
  onHistory: () => void;
  onTerm: (id: string) => void;
  onSignOut: () => void;
}) {
  const [value, setValue] = useState<Explanation | null>(null);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const [reload, setReload] = useState(0);
  const [connections, setConnections] = useState<ResearchConnections | null>(
    null,
  );
  const [privateState, setPrivateState] = useState<
    'idle' | 'loading' | 'ready' | 'error' | 'guest'
  >('idle');
  const [privateError, setPrivateError] = useState('');
  const generation = useRef(0);
  const privateRequest = useRef(0);
  const sourceDetails = useRef<HTMLDetailsElement>(null);
  function showBasis(field: string) {
    if (!sourceDetails.current) return;
    sourceDetails.current.open = true;
    const target = document.getElementById(
      `explanation-source-${item.id}-${field}`,
    );
    target?.focus();
    target?.scrollIntoView({ block: 'nearest' });
  }
  useEffect(() => {
    const ticket = ++generation.current;
    setValue(null);
    setError('');
    setChanged(false);
    setConnections(null);
    setPrivateState('idle');
    void json(
      `/discovery/items/${item.id}/explanation?expectedVersion=${item.version}`,
    )
      .then((raw) => {
        const parsed = EvidenceExplanationSchema.safeParse(raw);
        if (!parsed.success)
          throw Error(
            'The explanation response was invalid. Retry reading its evidence.',
          );
        if (
          JSON.stringify(parsed.data.edition) !==
          JSON.stringify(FeedItemSchema.parse(item))
        )
          throw new RequestError(
            'This explanation belongs to another edition. Refresh reading.',
            409,
          );
        if (ticket === generation.current) setValue(parsed.data);
      })
      .catch((failure: unknown) => {
        if (ticket !== generation.current) return;
        setError(
          failure instanceof Error
            ? failure.message
            : 'Explanation unavailable.',
        );
        setChanged(
          failure instanceof RequestError &&
            [404, 409].includes(failure.status),
        );
      });
    const session = () => {
      privateRequest.current++;
      setConnections(null);
      setPrivateError('');
      setPrivateState('idle');
    };
    window.addEventListener('f360-session-changed', session);
    return () => {
      generation.current++;
      privateRequest.current++;
      window.removeEventListener('f360-session-changed', session);
    };
  }, [item.id, item.version, item.sourceHash, reload]);

  async function loadConnections() {
    const epoch = generation.current,
      ticket = ++privateRequest.current;
    setConnections(null);
    setPrivateError('');
    setPrivateState('loading');
    try {
      const raw = await json(`/account/research-connections?itemId=${item.id}`);
      const parsed = ResearchConnectionsSchema.safeParse(raw);
      if (!parsed.success)
        throw Error(
          'Your connections returned an invalid response. Retry your records.',
        );
      if (epoch !== generation.current || ticket !== privateRequest.current)
        return;
      setConnections(parsed.data);
      setPrivateState('ready');
    } catch (failure) {
      if (epoch !== generation.current || ticket !== privateRequest.current)
        return;
      setConnections(null);
      if (failure instanceof RequestError && failure.status === 401) {
        privateRequest.current++;
        setPrivateState('guest');
        onSignOut();
      } else {
        setPrivateState('error');
        setPrivateError(
          failure instanceof Error
            ? failure.message
            : 'Your connections are unavailable.',
        );
      }
    }
  }
  const own =
    connections?.connections.filter(
      (c) => c.revision.source.itemId === item.id,
    ) ?? [];
  const sourceMatches =
    connections?.selectedSource?.version === item.version &&
    connections.selectedSource.sourceHash === item.sourceHash;
  return (
    <section className="evidence-layers" aria-label="Explanation layers">
      <h2>Understand this reading</h2>
      {!value && !error && (
        <p role="status" aria-label="Explanation progress">
          Loading the edition’s evidence…
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={changed ? onRefresh : () => setReload((v) => v + 1)}>
            {changed ? 'Refresh explanation reading' : 'Retry explanation'}
          </button>
        </div>
      )}
      {value && (
        <>
          <h3>One line</h3>
          <p>
            Recorded statement in the reviewed edition; not independently
            verified here.
          </p>
          <blockquote>
            {value.excerpts.find((v) => v.field === 'title')!.text}
          </blockquote>
          <button onClick={() => showBasis('title')}>
            Basis: edition {item.version}, title
          </button>
          <details>
            <summary>Beginner — read it with context</summary>
            <p>
              The effective period tells you what time the reading concerns. The
              retrieval date tells you when the app obtained its evidence; it
              does not make an older release current.
            </p>
            {value.excerpts
              .filter((v) => v.field !== 'title')
              .map((excerpt) => (
                <div key={excerpt.field}>
                  <blockquote>{excerpt.text}</blockquote>
                  <button onClick={() => showBasis(excerpt.field)}>
                    Basis: edition {item.version}, {excerpt.field}
                  </button>
                </div>
              ))}
            {value.excerpts.length === 1 && (
              <p>
                Only the headline is stored. Open the source for its complete
                context.
              </p>
            )}
            <p>
              These are recorded statements, not a prediction about your
              investments.
            </p>
            {item.relatedIds
              .filter((id) => id.startsWith('term-'))
              .map((id) => (
                <TermLink key={id} id={id} onOpen={() => onTerm(id)} />
              ))}
          </details>
          <details
            onToggle={(event) => {
              if (event.currentTarget.open && privateState === 'idle')
                void loadConnections();
            }}
          >
            <summary>Portfolio — your own research connections</summary>
            <p>
              No financial change or measured impact is established by this
              reading. Your saved reasons are personal notes.
            </p>
            <div data-feedback-private>
              {privateState === 'loading' && (
                <p role="status" aria-label="Connection progress">
                  Loading your connections…
                </p>
              )}
              {privateState === 'guest' && (
                <p>
                  <a href={`#account?next=read/${item.id}`}>
                    Sign in to view your connections
                  </a>
                </p>
              )}
              {privateState === 'idle' && (
                <button onClick={() => void loadConnections()}>
                  Load your connections
                </button>
              )}
              {privateError && <p role="alert">{privateError}</p>}
              {privateState === 'error' && (
                <button onClick={() => void loadConnections()}>
                  Retry your connections
                </button>
              )}
              {privateState === 'ready' && (
                <>
                  {!sourceMatches && (
                    <p>
                      Review your connection: this reading’s source context is
                      no longer current. Refresh reading before making a new
                      connection.
                    </p>
                  )}
                  {own.length === 0 && (
                    <p>
                      You have no saved research connections for this reading.
                    </p>
                  )}
                  {own.map((entry) => (
                    <article key={entry.revision.id}>
                      <h3>
                        Your research connection · {entry.revision.target.label}
                      </h3>
                      <p>{entry.revision.note}</p>
                      <p>
                        Personal note saved {entry.revision.savedAt} · source
                        edition {entry.revision.source.version} ·{' '}
                        {entry.revision.target.binding.kind} version{' '}
                        {entry.revision.target.binding.version}
                      </p>
                      {entry.reviewReasons.length > 0 || !sourceMatches ? (
                        <div>
                          <strong>Review your connection</strong>
                          <ul>
                            {entry.reviewReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p>
                          Source and record versions match when checked; this
                          does not verify your personal reason.
                        </p>
                      )}
                    </article>
                  ))}
                  <p>Connections checked {connections?.evaluatedAt}</p>
                  <button onClick={() => void loadConnections()}>
                    Refresh your connections
                  </button>
                </>
              )}
            </div>
            <a
              href={
                connectionSource(item)
                  ? `#connections?itemId=${item.id}&sourceVersion=${item.version}&sourceHash=${item.sourceHash}`
                  : '#connections'
              }
            >
              Manage research connections and history
            </a>
          </details>
          <details>
            <summary>Analytical — evidence and limits</summary>
            <dl>
              <dt>Independent verification</dt>
              <dd>
                Unavailable. Publication records an editorial decision, not
                independent confirmation.
              </dd>
              <dt>Expectations</dt>
              <dd>
                {value.analysis.expectations === 'reviewed'
                  ? 'A reviewed published-expectation comparison is retained below.'
                  : 'Unavailable as a separately validated expectation.'}
              </dd>
              <dt>Scenarios</dt>
              <dd>
                {value.analysis.scenarios === 'reviewed'
                  ? 'Reviewed source-bound scenarios are retained below.'
                  : 'Unavailable as a reviewed scenario.'}
              </dd>
              <dt>Causal inference and quantified portfolio impact</dt>
              <dd>
                {value.analysis.causalInference === 'reviewed-qualitative'
                  ? 'Released qualitative interpretations are shown below. No numerical portfolio effect is established.'
                  : 'Unavailable. No approved mapping supports either for this edition.'}
              </dd>
              <dt>Cross-source conflicts</dt>
              <dd>
                {value.conflictAssessment === 'opposing-reviewed-directions'
                  ? 'Opposing reviewed directions exist for the same sector, company and horizon. Both interpretations are retained; no resolution or net effect is inferred.'
                  : 'Not assessed. Absence of a recorded comparison does not establish agreement.'}
              </dd>
            </dl>
            {value.reviewedScenarios.map((scenario) => {
              const receipt = scenario.receipt!,
                event = receipt.event.event!;
              return (
                <article key={scenario.id} aria-label="Reviewed scenario">
                  <h4>{event.editorial.title}</h4>
                  <p>
                    {receipt.result.comparison} · {receipt.result.meaning}
                  </p>
                  <p>
                    {receipt.result.delta === null
                      ? 'Not quantified'
                      : `${receipt.result.delta} ${receipt.result.unit}`}{' '}
                    · {receipt.result.direction}
                  </p>
                  <p>
                    Scenario edition {receipt.version} · reviewed{' '}
                    {scenario.reviewedAt}
                  </p>
                  {[...scenario.reviewReasons, ...receipt.result.warnings].map(
                    (warning, index) => (
                      <p key={index}>{warning}</p>
                    ),
                  )}
                  <p>{receipt.result.noAction}</p>
                  {event.editorial.citations.map((citation, index) => {
                    const source = event.sources.find(
                      (s) => s.id === citation.sourceId,
                    )!;
                    return (
                      <div key={index}>
                        <blockquote>{citation.quote}</blockquote>
                        <a href={'#read/' + source.id}>
                          {source.source.name} · source edition{' '}
                          {citation.version}
                        </a>
                        <p>
                          {source.effectiveLabel} · retrieved{' '}
                          {source.source.retrievedAt}
                        </p>
                      </div>
                    );
                  })}
                  <a href={'#event-scenarios/' + scenario.id}>
                    Open reviewed scenario
                  </a>{' '}
                  · <a href={'#events/' + event.id}>Open reviewed event</a>
                </article>
              );
            })}
            {value.reviewedContexts.map((revision) => {
              const content = revision.input.content;
              if (content.kind !== 'causal-context') return null;
              const event = revision.event.event!;
              return (
                <article
                  key={revision.id}
                  aria-label="Released qualitative context"
                >
                  <h4>{revision.input.title}</h4>
                  <p>
                    Qualitative inference · {content.direction} ·{' '}
                    {content.sector}
                    {content.isin ? ' · ' + content.isin : ''} ·{' '}
                    {content.horizon}
                  </p>
                  <p>{revision.input.rationale}</p>
                  <p>{content.limitations}</p>
                  <p>
                    Release edition {revision.version} · review by{' '}
                    {revision.input.reviewBy}. No quantified impact.
                  </p>
                  {event.sources.some(
                    (source) =>
                      Date.parse(value.evaluatedAt) -
                        Date.parse(source.publishedAt) >
                      30 * 86400000,
                  ) && (
                    <p>Historical evidence beyond the 30-day context window.</p>
                  )}
                  {revision.input.citations.map((index) => {
                    const citation = event.editorial.citations[index]!,
                      source = event.sources.find(
                        (s) => s.id === citation.sourceId,
                      )!;
                    return (
                      <div key={index}>
                        <blockquote>{citation.quote}</blockquote>
                        <a href={'#read/' + source.id}>
                          {source.source.name} · source edition{' '}
                          {citation.version}
                        </a>
                        <p>
                          {source.effectiveLabel} · retrieved{' '}
                          {source.source.retrievedAt}
                        </p>
                      </div>
                    );
                  })}
                  <a href={'#events/' + event.id}>
                    Open reviewed context event
                  </a>
                </article>
              );
            })}
            {value.previous ? (
              <p>
                Preceding reviewed edition {value.previous.version} ·{' '}
                {value.previous.status} · dated {value.previous.publishedAt}.{' '}
                {value.previous.status === 'withdrawn'
                  ? 'Withdrawn text is not displayed or compared.'
                  : `Changed fields: ${value.previous.changedFields.join(', ') || 'none of the compared fields'}. A revision is not necessarily a contradiction.`}
              </p>
            ) : (
              <p>No preceding reviewed edition is retained here.</p>
            )}
            {item.correctionNote && (
              <p>Current editorial note: {item.correctionNote}</p>
            )}
            <button onClick={onHistory}>Inspect explanation revisions</button>
          </details>
          <details ref={sourceDetails} id={`explanation-sources-${item.id}`}>
            <summary>Sources — trace every excerpt</summary>
            <p>
              {item.source.name} · edition {item.version}
            </p>
            <dl>
              <dt>Effective period</dt>
              <dd>{item.effectiveLabel}</dd>
              <dt>
                {item.kind === 'annual'
                  ? 'Period-end ordering date (not release date)'
                  : 'Published'}
              </dt>
              <dd>{item.publishedAt}</dd>
              <dt>Retrieved</dt>
              <dd>{item.source.retrievedAt}</dd>
              <dt>Reviewed</dt>
              <dd>{item.reviewedAt ?? 'Review date unavailable'}</dd>
              <dt>Explanation evaluated</dt>
              <dd>{value.evaluatedAt}</dd>
              {value.bundleGeneratedAt && (
                <>
                  <dt>On-device bundle generated</dt>
                  <dd>
                    {value.bundleGeneratedAt} · later server changes are unknown
                    on this device.
                  </dd>
                </>
              )}
              <dt>Retained response hash</dt>
              <dd>
                {item.sourceHash ?? 'Unavailable'} · identifies the stored
                response, not independent verification or a hash of this
                excerpt.
              </dd>
            </dl>
            <p>
              References below identify fields in the stored reviewed edition.
              Original document page or section numbers are unavailable unless
              the original source supplies them.
            </p>
            <ol>
              {value.excerpts.map((excerpt) => (
                <li
                  id={`explanation-source-${item.id}-${excerpt.field}`}
                  key={excerpt.field}
                  tabIndex={-1}
                >
                  <strong>{excerpt.field}</strong> · item {item.id}, edition{' '}
                  {item.version}, text offsets {excerpt.start}–{excerpt.end}{' '}
                  (UTF-16 code units; start included, end excluded).
                  <blockquote>{excerpt.text}</blockquote>
                </li>
              ))}
            </ol>
            <a href={item.source.url} target="_blank" rel="noreferrer">
              Open explanation original source
            </a>
            {item.sourceHash && (
              <button onClick={onEvidence}>Inspect explanation evidence</button>
            )}
            <p>{item.source.rights}</p>
          </details>
          {connectionSource(item) && (
            <p>
              <a
                href={`#connections?itemId=${item.id}&sourceVersion=${item.version}&sourceHash=${item.sourceHash}`}
              >
                Connect this edition to my records
              </a>
            </p>
          )}
        </>
      )}
    </section>
  );
}
