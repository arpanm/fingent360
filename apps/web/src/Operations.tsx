import { FilingDiscoveryOperations } from './FilingDiscoveryOperations';
import { FilingWatchOperations } from './FilingWatchOperations';
import { CcilZeroOperations } from './CcilZero';
import { CorporateRatingsOperations } from './CorporateRatings';
import { EiaSpotOperations } from './EiaSpotOperations';
import { SovereignBondOperations } from './SovereignBonds';
import { ActionTermsOperations } from './ActionTermsOperations';
import { FundFactsheetOperations } from './FundFactsheetOperations';
import { FundMergerOperations } from './FundMergers';
import { EquityConsolidationOperations } from './EquityConsolidationOperations';
import { CommodityOperations } from './CommodityOperations';
import { RegulatorySourcesOperations } from './RegulatorySources';
import { CpiExpectationOperations } from './CpiExpectationOperations';
import { GdpExpectationOperations } from './GdpExpectationOperations';
import { IntelligenceBriefOperations } from './IntelligenceBriefOperations';
import { OilEducationOperations } from './OilEducationOperations';
import { ParticipantPositioningOperations } from './ParticipantPositioningOperations';
import { InstitutionalFlowOperations } from './InstitutionalFlowOperations';
import { EquityAdjustmentOperations } from './EquityAdjustmentOperations';
import { ClassificationCrosswalk } from './ClassificationCrosswalk';
import { IndiaMacroOperations } from './IndiaMacroOperations';
import { ResearchGovernance } from './ResearchGovernance';
import { CompanyNewsOperations } from './CompanyNewsOperations';
import { EventScenarioOperations } from './EventScenarioOperations';
import { EvaluationLineage } from './EvaluationLineage';
import { FundsBondsOperations } from './FundsBondsOperations';
import { StoryImageOperations } from './StoryImageOperations';
import { ResearchAutomation } from './ResearchAutomation';
import { EquityCoverageOperations } from './EquityCoverageOperations';
import { IdentitySelectionOperations } from './IdentitySelectionOperations';
import { EventLineageOperations } from './EventLineageOperations';
import { EventOperations } from './EventOperations';
import { NamedOperations } from './NamedOperations';
import { QualityOverview } from './QualityOverview';
import { EcbRateOperations } from './EcbRateOperations';
import { OilBenchmarkOperations } from './OilBenchmarkOperations';
import { EcbFxOperations } from './EcbFxOperations';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MediaAssetSchema,
  PublicationProposalSchema,
  type PublicationProposalInput,
  DiscoveryEvidenceSchema,
  ResearchCatalogSchema,
  ResearchRunsSchema,
  DiscoveryRunSchema,
  type ResearchCatalog,
  type MediaAsset,
  OperatorSessionSchema,
  FeedItemSchema,
  MacroDashboardSchema,
  MacroRunSchema,
  SourceListSchema,
  SourceInputSchema,
  SourceRecordSchema,
  type FeedItem,
  type SourceInput,
  type SourceRecord,
} from '@fingent360/contracts';
import { json, RequestError } from './net';
import { Dialog } from './Dialog';
import { shortDate } from './ui';
import { FeedbackInbox } from './FeedbackInbox';
import { SecurityOperations } from './Securities';
import { RetentionOperations } from './RetentionOperations';
import { WorkerHealth } from './WorkerHealth';
import { MaterialWorkerHealth } from './MaterialWorkerHealth';
import { OperatorAudit } from './OperatorAudit';
import { PublishingQueue } from './PublishingQueue';
class StaleOperationsRead extends Error {}
import { SourceReview } from './SourceReview';
import { BeaQuarantine } from './BeaQuarantine';
const blank: SourceInput = {
  name: '',
  category: '',
  sourceUrl: '',
  termsUrl: '',
  rightsStatus: 'unreviewed',
  constraints: '',
  reviewEvidence: '',
  reviewedAt: null,
  published: false,
};
export function Operations() {
  const [authenticated, setAuthenticated] = useState(false),
    [checking, setChecking] = useState(true),
    [key, setKey] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [namedMode, setNamedMode] = useState(false);
  const [namedUsername, setNamedUsername] = useState('');
  const [identity, setIdentity] = useState<NonNullable<
    typeof OperatorSessionSchema._output.identity
  > | null>(null);
  const proposalIntent = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const [tab, setTab] = useState('news');
  const [queueRefresh, setQueueRefresh] = useState(0),
    [review, setReview] = useState<FeedItem | null>(null);
  const [latest, setLatest] = useState('');
  const [retained, setRetained] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const sessionGeneration = useRef(0),
    live = useRef(true),
    sessionEnded = useRef(false);
  const clearProtected = useCallback(() => {
    setQueueRefresh((value) => value + 1);
    setRetained(null);
    setReview(null);
    setMedia(null);
    setLatest('');
    setNotice('');
    setKey('');
    setIdentity(null);
    proposalIntent.current = null;
  }, []);
  const sessionExpired = useCallback(() => {
    if (!live.current) return;
    sessionGeneration.current++;
    sessionEnded.current = true;
    clearProtected();
    setAuthenticated(false);
    setIdentity(null);
    setNamedUsername('');
    proposalIntent.current = null;
    setBusy(false);
    setChecking(false);
    setError(
      'Operations session ended. Sign in again to read protected activity.',
    );
  }, [clearProtected]);
  async function request(...args: Parameters<typeof json>) {
    if (!live.current || (sessionEnded.current && args[0] !== '/ops/session'))
      throw new StaleOperationsRead();
    const ticket = sessionGeneration.current;
    try {
      const value = await json(...args);
      if (!live.current || ticket !== sessionGeneration.current)
        throw new StaleOperationsRead();
      return value;
    } catch (cause) {
      if (!live.current || ticket !== sessionGeneration.current)
        throw new StaleOperationsRead();
      if (cause instanceof RequestError && cause.status === 401)
        sessionExpired();
      throw cause;
    }
  }
  const load = async () => {
    setQueueRefresh((value) => value + 1);
  };
  async function submitProposal(input: PublicationProposalInput) {
    const fingerprint = JSON.stringify(input);
    if (proposalIntent.current?.fingerprint !== fingerprint)
      proposalIntent.current = { fingerprint, id: crypto.randomUUID() };
    return PublicationProposalSchema.parse(
      await request(
        '/ops/proposals/' + proposalIntent.current.id,
        input,
        'PUT',
      ),
    );
  }
  useEffect(() => {
    let active = true;
    live.current = true;
    void request('/ops/session')
      .then((v) => {
        if (active) {
          const session = OperatorSessionSchema.parse(v);
          setAuthenticated(session.authenticated);
          setNamedMode(session.mode === 'named');
          setIdentity(session.identity ?? null);
        }
      })
      .catch((e: unknown) => {
        if (
          active &&
          !(e instanceof StaleOperationsRead) &&
          !sessionEnded.current
        )
          setError(e instanceof Error ? e.message : 'Operations unavailable.');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      live.current = false;
      sessionGeneration.current++;
    };
  }, []);
  useEffect(() => {
    if (authenticated)
      void load().catch((e: unknown) => {
        if (
          live.current &&
          !sessionEnded.current &&
          !(e instanceof StaleOperationsRead)
        )
          setError(
            e instanceof Error ? e.message : 'Could not load publications.',
          );
      });
  }, [authenticated]);
  const action = async (work: () => Promise<void>) => {
    if (busy) return;
    const ticket = sessionGeneration.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      if (
        ticket !== sessionGeneration.current ||
        !live.current ||
        e instanceof StaleOperationsRead
      )
        return;
      if (e instanceof RequestError && e.status === 401) sessionExpired();
      else setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      if (live.current && ticket === sessionGeneration.current) setBusy(false);
    }
  };
  return (
    <div className="operations">
      <header className="ops-header">
        <a href="#today">← Investor app</a>
        <strong>Fingent360 / Operations</strong>
        {authenticated && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await request('/ops/session', undefined, 'DELETE');
                sessionGeneration.current++;
                sessionEnded.current = true;
                clearProtected();
                setAuthenticated(false);
                setBusy(false);
                setNotice('Operations session ended.');
              })
            }
          >
            Sign out of operations
          </button>
        )}
      </header>
      <main>
        <p className="page-kicker">PUBLISHING & DATA OPERATIONS</p>
        <h1>
          {authenticated ? 'Keep the evidence clear.' : 'Operations sign-in'}
        </h1>
        {checking && <p role="status">Checking session…</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!checking && !authenticated && (
          <form
            className="panel ops-login"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const session = OperatorSessionSchema.parse(
                  await request(
                    '/ops/session',
                    namedMode
                      ? { username: namedUsername, password: key }
                      : { key },
                    'POST',
                  ),
                );
                clearProtected();
                sessionEnded.current = !session.authenticated;
                setAuthenticated(session.authenticated);
                setIdentity(session.identity ?? null);
                setNamedMode(session.mode === 'named');
              });
            }}
          >
            <p>
              For maintainers only. This credential opens a separate one-hour
              operations session.
            </p>
            {namedMode && (
              <label htmlFor="named-operator-signin">
                Named operator username
                <input
                  id="named-operator-signin"
                  autoComplete="username"
                  value={namedUsername}
                  required
                  onChange={(event) => setNamedUsername(event.target.value)}
                />
              </label>
            )}
            <label>
              {namedMode ? 'Named operator password' : 'Operator key'}
              <input
                type="password"
                autoComplete="off"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <div className="page-actions">
              <button disabled={busy || !key}>Sign in to operations</button>
              <button
                type="button"
                className="secondary"
                disabled={busy || !key}
                onClick={() => {
                  setKey('');
                  setNotice(
                    'Entered credential cleared. The configured credential has not been revoked.',
                  );
                }}
              >
                Clear entered credential
              </button>
            </div>
          </form>
        )}
        {authenticated && (
          <>
            <div
              className="segmented-control"
              role="group"
              aria-label="Operations sections"
            >
              {[
                ['news', 'Publishing'],
                ['company-news', 'Company news'],
                ['india-macro', 'India macro'],
                ['positioning', 'Participant positioning'],
                ['intelligence-briefs', 'Intelligence briefs'],
                ['institutional-flows', 'Institutional activity'],
                ['oil-education', 'Oil disclosure'],
                ['equity-adjustments', 'Price normalization'],
                ['equity-consolidations', 'Security consolidations'],
                ['equity-action-terms', 'Rights and mergers'],
                ['classification-crosswalks', 'Sector mappings'],
                ['evaluations', 'Research evaluation'],
                ['cpi-expectations', 'CPI model expectations'],
                ['gdp-expectations', 'GDP survey expectations'],
                ['research-auto', 'Automatic research'],
                ['bea-recovery', 'BEA recovery'],
                ['macro', 'Macro ingestion'],
                ['events', 'Event review'],
                ['event-scenarios', 'Event scenarios'],
                ['research-governance', 'Research policies and causal review'],
                ['event-lineage', 'Merge/split events'],
                ['ecb-rates', 'ECB policy rates'],
                ['oil-benchmarks', 'Oil benchmarks'],
                ['reference-fx', 'Reference exchange rates'],
                ['commodities', 'Commodities'],
                ['regulatory-sources', 'Regulatory originals'],
                ['sources', 'Source registry'],
                ['feedback', 'Feedback inbox'],
                ['securities', 'Security identities'],
                ['funds-bonds', 'Fund data'],
                ['fund-mergers', 'Fund mergers'],
                ['fund-factsheets', 'Fund factsheets'],
                ['sovereign-bonds', 'Sovereign bonds'],
                ['corporate-ratings', 'Corporate ratings'],
                ['bond-zero-curve', 'CCIL NSS'],
                ['filing-watch', 'Original filing watch'],
                ['filing-discovery', 'Filing discovery'],
                ['eia-spot', 'Daily oil source'],
                ['equity-coverage', 'Indian equity data'],
                ['identity-selections', 'Identity selections'],
                ['retention', 'Expired data cleanup'],
                ['workers', 'Worker health'],
                ['quality', 'Data quality'],
                ['audit', 'Audit activity'],
                ...(namedMode
                  ? [['named', 'Named operators and proposals']]
                  : []),
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={tab === value}
                  onClick={() => {
                    if (
                      value !== tab &&
                      !window.dispatchEvent(
                        new Event('f360-before-navigate', { cancelable: true }),
                      )
                    )
                      return;
                    setTab(value!);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'named' && identity ? (
              <NamedOperations request={request} identity={identity} />
            ) : tab === 'news' ? (
              <>
                <SourceRefresh
                  request={request}
                  action={action}
                  busy={busy}
                  afterRefresh={load}
                  latest={latest}
                />
                <p className="muted">
                  Preparing a visual may use the server-configured OpenAI,
                  Gemini or Anthropic model to select source excerpts. Missing
                  configuration or an unavailable provider uses the source
                  template. Each source edition is prepared once; publication
                  still requires your review.
                </p>
                <PublishingQueue
                  request={request}
                  refreshKey={queueRefresh}
                  onLatestRun={setLatest}
                  renderItem={(item) => (
                    <article className="panel" key={item.id}>
                      <span className="eyebrow">
                        {item.kind} · {item.status} · v{item.version}
                      </span>
                      <h2>{item.title}</h2>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const rows = FeedItemSchema.array().parse(
                              await request(
                                `/ops/discovery/items/${item.id}/history`,
                              ),
                            );
                            setRetained({
                              title: 'Retained publication history',
                              text: JSON.stringify(rows, null, 2),
                            });
                          })
                        }
                      >
                        Retained history
                      </button>
                      <button
                        disabled={busy || !item.sourceHash}
                        onClick={() =>
                          void action(async () => {
                            const raw = DiscoveryEvidenceSchema.parse(
                              await request(
                                `/ops/discovery/items/${item.id}/evidence?version=${item.version}`,
                              ),
                            );
                            setRetained({
                              title: 'Protected original evidence',
                              text: JSON.stringify(raw, null, 2),
                            });
                          })
                        }
                      >
                        Retained evidence
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const asset = MediaAssetSchema.parse(
                              await request(`/ops/media/${item.id}`),
                            );
                            setRetained({
                              title: 'Retained visual record',
                              text: JSON.stringify(asset, null, 2),
                            });
                          })
                        }
                      >
                        Retained visual
                      </button>
                      <p>{item.summary}</p>
                      <p>
                        {item.source.name} · {shortDate(item.publishedAt)}
                      </p>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          setReview(item);
                        }}
                      >
                        Review {item.title}
                      </button>
                      {item.status === 'published' && (
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() =>
                            void action(async () =>
                              setMedia(
                                MediaAssetSchema.parse(
                                  await request(
                                    `/ops/media/${item.id}`,
                                    {},
                                    'POST',
                                  ),
                                ),
                              ),
                            )
                          }
                        >
                          Prepare visual summary
                        </button>
                      )}
                    </article>
                  )}
                />
              </>
            ) : tab === 'audit' ? (
              <OperatorAudit
                request={request}
                onUnauthorized={sessionExpired}
                onBack={() => setTab('news')}
                onSection={setTab}
              />
            ) : tab === 'bea-recovery' ? (
              <BeaQuarantine
                request={request}
                onReview={async () => {
                  await load();
                  setTab('news');
                }}
                onBack={() => setTab('news')}
                onUnauthorized={sessionExpired}
              />
            ) : tab === 'events' ? (
              <EventOperations
                request={request}
                onPropose={namedMode ? submitProposal : undefined}
              />
            ) : tab === 'research-governance' ? (
              <ResearchGovernance request={request} />
            ) : tab === 'classification-crosswalks' ? (
              <ClassificationCrosswalk request={request} />
            ) : tab === 'event-scenarios' ? (
              <EventScenarioOperations request={request} />
            ) : tab === 'event-lineage' ? (
              <EventLineageOperations request={request} named={namedMode} />
            ) : tab === 'ecb-rates' ? (
              <EcbRateOperations
                request={request}
                onDenied={sessionExpired}
                onPropose={namedMode ? submitProposal : undefined}
              />
            ) : tab === 'oil-benchmarks' ? (
              <OilBenchmarkOperations
                request={request}
                onDenied={sessionExpired}
                onPropose={namedMode ? submitProposal : undefined}
              />
            ) : tab === 'reference-fx' ? (
              <EcbFxOperations
                request={request}
                onDenied={sessionExpired}
                onPropose={namedMode ? submitProposal : undefined}
              />
            ) : tab === 'macro' ? (
              <MacroOperations action={action} busy={busy} />
            ) : tab === 'evaluations' ? (
              <EvaluationLineage request={request} />
            ) : tab === 'commodities' ? (
              <CommodityOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'regulatory-sources' ? (
              <RegulatorySourcesOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'cpi-expectations' ? (
              <CpiExpectationOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'gdp-expectations' ? (
              <GdpExpectationOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'research-auto' ? (
              <ResearchAutomation request={request} />
            ) : tab === 'positioning' ? (
              <ParticipantPositioningOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'oil-education' ? (
              <OilEducationOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'intelligence-briefs' ? (
              <IntelligenceBriefOperations request={request} />
            ) : tab === 'institutional-flows' ? (
              <InstitutionalFlowOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'equity-action-terms' ? (
              <ActionTermsOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'equity-consolidations' ? (
              <EquityConsolidationOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'equity-adjustments' ? (
              <EquityAdjustmentOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'india-macro' ? (
              <IndiaMacroOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'company-news' ? (
              <CompanyNewsOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'eia-spot' ? (
              <EiaSpotOperations request={request} onDenied={sessionExpired} />
            ) : tab === 'filing-discovery' ? (
              <FilingDiscoveryOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'filing-watch' ? (
              <FilingWatchOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'bond-zero-curve' ? (
              <CcilZeroOperations request={request} onDenied={sessionExpired} />
            ) : tab === 'corporate-ratings' ? (
              <CorporateRatingsOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'sovereign-bonds' ? (
              <SovereignBondOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'fund-factsheets' ? (
              <FundFactsheetOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'fund-mergers' ? (
              <FundMergerOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'funds-bonds' ? (
              <FundsBondsOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'equity-coverage' ? (
              <EquityCoverageOperations
                request={request}
                onDenied={sessionExpired}
              />
            ) : tab === 'securities' ? (
              <SecurityOperations />
            ) : tab === 'identity-selections' ? (
              <IdentitySelectionOperations
                request={request}
                named={namedMode}
              />
            ) : tab === 'retention' ? (
              <RetentionOperations
                onSessionExpired={() => {
                  sessionExpired();
                  setError(
                    'Operations session ended. Sign in again to reopen saved cleanup history.',
                  );
                }}
              />
            ) : tab === 'quality' ? (
              <QualityOverview
                onSessionExpired={sessionExpired}
                onPublishing={() => setTab('news')}
              />
            ) : tab === 'workers' ? (
              <>
                <WorkerHealth onSessionExpired={sessionExpired} />
                <MaterialWorkerHealth request={request} />
              </>
            ) : tab === 'feedback' ? (
              <FeedbackInbox />
            ) : (
              <SourceEditor
                request={request}
                onPropose={namedMode ? submitProposal : undefined}
              />
            )}
          </>
        )}
        {authenticated && retained && (
          <Dialog title={retained.title} onClose={() => setRetained(null)}>
            <p>
              Protected retained original. Public withdrawal does not rewrite
              this record.
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {retained.text}
            </pre>
          </Dialog>
        )}
        {authenticated && media && (
          <Dialog title="Review visual summary" onClose={() => setMedia(null)}>
            <img
              alt={media.title}
              style={{ width: '100%', height: 'auto' }}
              src={
                media.image
                  ? `data:${media.image.mime};base64,${media.image.base64}`
                  : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(media.svg)}`
              }
            />
            <p>{media.image?.label ?? media.label}</p>
            <StoryImageOperations
              asset={media}
              request={request}
              onUpdated={setMedia}
            />
            <p>
              Caption preparation: {media.generation.provider}
              {media.generation.model
                ? ` · ${media.generation.model}`
                : ''}.{' '}
              {media.generation.fallbackReason
                ? `Template fallback: ${media.generation.fallbackReason.replaceAll('_', ' ')}.`
                : ''}
            </p>
            <ol>
              {media.captions.map((c) => (
                <li key={c.startMs}>{c.text}</li>
              ))}
            </ol>
            <a href={media.sourceUrl} target="_blank" rel="noreferrer">
              Check source
            </a>
            <div className="page-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    if (namedMode)
                      await submitProposal({
                        kind: 'media',
                        target: media.itemId,
                        body: {
                          assetId: media.id,
                          publish: true,
                          ...(media.image
                            ? { imageAttemptId: media.image.attemptId }
                            : {}),
                        },
                      });
                    else
                      await request(
                        `/ops/media/${media.itemId}`,
                        {
                          assetId: media.id,
                          publish: true,
                          ...(media.image
                            ? { imageAttemptId: media.image.attemptId }
                            : {}),
                        },
                        'PUT',
                      );
                    setMedia(null);
                    setNotice(
                      namedMode
                        ? 'Publication proposal saved. Another named reviewer must approve it in Named operators and proposals.'
                        : 'Reviewed visual published.',
                    );
                  })
                }
              >
                {namedMode
                  ? 'Propose visual publication'
                  : 'Publish reviewed visual'}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    if (namedMode)
                      await submitProposal({
                        kind: 'media',
                        target: media.itemId,
                        body: {
                          assetId: media.id,
                          publish: false,
                          ...(media.image
                            ? { imageAttemptId: media.image.attemptId }
                            : {}),
                        },
                      });
                    else
                      await request(
                        `/ops/media/${media.itemId}`,
                        {
                          assetId: media.id,
                          publish: false,
                          ...(media.image
                            ? { imageAttemptId: media.image.attemptId }
                            : {}),
                        },
                        'PUT',
                      );
                    setMedia(null);
                    setNotice(
                      namedMode
                        ? 'Publication proposal saved. Another named reviewer must approve it in Named operators and proposals.'
                        : 'Visual unpublished.',
                    );
                  })
                }
              >
                {namedMode ? 'Propose visual withdrawal' : 'Unpublish visual'}
              </button>
            </div>
          </Dialog>
        )}
        {authenticated && review && (
          <SourceReview
            key={`${review.id}:${review.version}`}
            id={review.id}
            version={review.version}
            onPropose={namedMode ? submitProposal : undefined}
            request={request}
            onClose={() => {
              setReview(null);
              requestAnimationFrame(() => {
                if (
                  !document.querySelector('dialog[open]') &&
                  (!document.activeElement ||
                    document.activeElement === document.body)
                )
                  document.getElementById('publishing-queue-heading')?.focus();
              });
            }}
            onDenied={sessionExpired}
            onSaved={() => {
              void load().catch((e: unknown) => {
                if (
                  live.current &&
                  !sessionEnded.current &&
                  !(e instanceof StaleOperationsRead)
                )
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'Saved; reload the publications list.',
                  );
              });
            }}
          />
        )}
      </main>
    </div>
  );
}
function MacroOperations({
  action,
  busy,
}: {
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [items, setItems] = useState<
      ReturnType<typeof MacroDashboardSchema.parse>['sources']
    >([]),
    [message, setMessage] = useState('');
  useEffect(() => {
    void json('/macro')
      .then((v) => setItems(MacroDashboardSchema.parse(v).sources))
      .catch(() => setMessage('Macro sources could not be loaded.'));
  }, []);
  return (
    <section>
      <h2>Macro ingestion</h2>
      <p>
        Refresh the actual provider and retain accepted observation revisions
        and original evidence.
      </p>
      <p role="status">{message}</p>
      {items.map((s) => (
        <article className="panel" key={s.indicator}>
          <h3>{s.title}</h3>
          <p>Last success {shortDate(s.lastSuccessAt)}</p>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const result = MacroRunSchema.parse(
                  await json(
                    '/ops/macro/refresh',
                    { indicator: s.indicator },
                    'POST',
                  ),
                );
                setMessage(`${s.title}: ${result.status}. ${result.message}`);
                setItems(
                  MacroDashboardSchema.parse(await json('/macro')).sources,
                );
              })
            }
          >
            Refresh {s.title}
          </button>
        </article>
      ))}
    </section>
  );
}
function SourceEditor({
  request,
  onPropose,
}: {
  request: typeof json;
  onPropose?:
    ((input: PublicationProposalInput) => Promise<unknown>) | undefined;
}) {
  const [sources, setSources] = useState<SourceRecord[]>([]),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState<SourceRecord | null>(null),
    [history, setHistory] = useState<SourceRecord[] | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () =>
    setSources(SourceListSchema.parse(await request('/ops/sources')));
  useEffect(() => {
    void load().catch(() => setError('Registry unavailable.'));
  }, []);
  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registry operation failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h2>Source registry</h2>
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice}</p>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            const data = SourceInputSchema.parse(form);
            if (onPropose) {
              await onPropose(
                editing
                  ? {
                      kind: 'source-update',
                      target: editing.id,
                      body: { data, expectedRevision: editing.revision },
                    }
                  : { kind: 'source-create', target: 'new', body: data },
              );
              setNotice(
                'Source proposal saved; public state is unchanged. Another named reviewer must approve it in Named operators and proposals.',
              );
              return;
            }
            const record = SourceRecordSchema.parse(
              await request(
                `/ops/sources${editing ? `/${editing.id}` : ''}`,
                editing ? { data, expectedRevision: editing.revision } : data,
                editing ? 'PUT' : 'POST',
              ),
            );
            setEditing(record);
            setForm(record.data);
            await load();
            setNotice(`Saved source revision ${record.revision}.`);
          });
        }}
      >
        <h3>{editing ? 'Edit source metadata' : 'Add source metadata'}</h3>
        {(
          [
            'name',
            'category',
            'sourceUrl',
            'termsUrl',
            'constraints',
            'reviewEvidence',
          ] as const
        ).map((field) => (
          <label key={field}>
            {
              {
                name: 'Source name',
                category: 'Source category',
                sourceUrl: 'Source URL',
                termsUrl: 'Terms URL',
                constraints: 'Usage constraints',
                reviewEvidence: 'Review evidence',
              }[field]
            }
            <textarea
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Rights status
          <select
            value={form.rightsStatus}
            onChange={(e) =>
              setForm({
                ...form,
                rightsStatus: e.target.value as SourceInput['rightsStatus'],
              })
            }
          >
            <option value="unreviewed">Unreviewed</option>
            <option value="restricted">Restricted</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <label>
          Review time (UTC ISO)
          <input
            value={form.reviewedAt ?? ''}
            onChange={(e) =>
              setForm({ ...form, reviewedAt: e.target.value || null })
            }
          />
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Publish approved metadata
        </label>
        <div className="page-actions">
          <button disabled={busy}>Save source metadata</button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setForm(blank);
              setEditing(null);
            }}
          >
            New source
          </button>
        </div>
      </form>
      <div>
        {sources.map((s) => (
          <article className="panel" key={s.id}>
            <h3>{s.data.name}</h3>
            <p>
              Revision {s.revision} · {s.data.rightsStatus} ·{' '}
              {s.data.published ? 'Published' : 'Private'}
            </p>
            <div className="page-actions">
              <button
                className="secondary"
                onClick={() => {
                  setEditing(s);
                  setForm(s.data);
                  document
                    .querySelector('form')
                    ?.scrollIntoView({ block: 'start' });
                }}
              >
                Edit {s.data.name}
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void action(async () =>
                    setHistory(
                      SourceListSchema.parse(
                        await request(`/ops/sources/${s.id}/history`),
                      ),
                    ),
                  )
                }
              >
                History {s.data.name}
              </button>
            </div>
          </article>
        ))}
      </div>
      {history && (
        <Dialog
          title="Source revision history"
          onClose={() => setHistory(null)}
        >
          {history.map((s) => (
            <div key={s.revision}>
              <h3>
                Revision {s.revision}: {s.data.name}
              </h3>
              <p>{s.data.constraints}</p>
              <p>{s.data.reviewEvidence}</p>
            </div>
          ))}
        </Dialog>
      )}
    </section>
  );
}

function SourceRefresh({
  request,
  action,
  busy,
  afterRefresh,
  latest,
}: {
  request: typeof json;
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
  afterRefresh: () => Promise<void>;
  latest: string;
}) {
  const [catalog, setCatalog] = useState<ResearchCatalog | null>(null),
    [runs, setRuns] = useState<
      ReturnType<typeof ResearchRunsSchema.parse>['runs']
    >([]),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void Promise.all([
      request('/discovery/catalog'),
      request('/ops/discovery/runs'),
    ])
      .then(([c, r]) => {
        const next = ResearchCatalogSchema.parse(c);
        const history = ResearchRunsSchema.parse(r);
        if (active) {
          setCatalog(next);
          setRuns(history.runs);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'Source status could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section className="panel" aria-label="Source refresh">
      <h2>Source ingestion and editorial review</h2>
      <p>
        Select fixed, approved adapters. New or changed items stay in draft;
        each source reports its own outcome. A failed source does not erase
        previous publications.
      </p>
      {error && <p role="alert">{error}</p>}
      {!catalog && !error && <p role="status">Loading source adapters…</p>}
      <fieldset disabled={busy}>
        <legend>Sources to check</legend>
        {catalog?.sources.map((source) => {
          const run = runs.find((r) => r.sourceId === source.id);
          return (
            <div key={source.id} className="research-source-status">
              <label className="consent">
                <input
                  type="checkbox"
                  disabled={source.access !== 'enabled'}
                  checked={selected.includes(source.id)}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, source.id]
                        : old.filter((id) => id !== source.id),
                    )
                  }
                />
                {source.name}
              </label>
              <p>
                {source.accessNote} · {source.publishedCount} published
              </p>
              {run ? (
                <p>
                  {run.status} · {run.checked} checked · {run.inserted} new
                  drafts · {shortDate(run.finishedAt ?? run.startedAt)}
                  <br />
                  {run.message}
                </p>
              ) : (
                <p>No source run recorded.</p>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="page-actions">
        <button
          disabled={busy || !selected.length}
          onClick={() =>
            void action(async () => {
              setMessage(
                'Checking selected sources. This can take several minutes.',
              );
              try {
                const run = DiscoveryRunSchema.parse(
                  await request(
                    '/ops/discovery/refresh',
                    { sourceIds: selected },
                    'POST',
                    AbortSignal.timeout(300000),
                  ),
                );
                setMessage(`${run.status}: ${run.message}`);
              } finally {
                setRetry((n) => n + 1);
                await afterRefresh();
              }
            })
          }
        >
          {busy ? 'Checking sources…' : 'Refresh discovery sources'}
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setRetry((n) => n + 1)}
        >
          Reload source status
        </button>
      </div>
      <p role="status">{message || latest}</p>
      <p className="muted">
        If the connection times out, reload status before starting another run.
        Publication remains a separate per-item review below.
      </p>
    </section>
  );
}
