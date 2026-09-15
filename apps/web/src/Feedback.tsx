import { currentPublicView } from './eval-lineage-view';
import { useEffect, useRef, useState } from 'react';
import {
  feedbackLimits,
  type FeedbackAudio,
  type FeedbackContextSchema,
  type FeedbackImage,
  type FeedbackSubmission,
} from '@fingent360/contracts';
import type { z } from 'zod';
import { Dialog } from './Dialog';
import { Icon } from './ui';
import { runtime } from './runtime';
import { go } from './navigation';
import { captureViewport } from './feedback-capture';
import { FeedbackCrop } from './FeedbackCrop';
import { VoiceFeedback } from './FeedbackVoice';
import {
  deleteFeedback,
  getFeedbackSettings,
  listFeedback,
  queueFeedback,
  retryFeedback,
  saveFeedbackSettings,
  type FeedbackEntry,
} from './feedback-store';
import { refreshFeedbackReceipts, syncFeedback } from './feedback-sync';
import './feedback.css';

function FeedbackGlyph({ camera = false }: { camera?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {camera ? (
        <>
          <path d="M8 5l2-2h4l2 2h4v15H4V5z" />
          <circle cx="12" cy="12" r="4" />
        </>
      ) : (
        <path d="M4 4h16v13H9l-5 4zM8 8h8M8 12h5" />
      )}
    </svg>
  );
}
function Finger({ close = false }: { close?: boolean }) {
  return close ? (
    <Icon name="close" />
  ) : (
    <img src="/feedback-finger.jpeg" alt="" />
  );
}
function context(): z.infer<typeof FeedbackContextSchema> {
  return {
    screen: (location.hash.slice(1).split('?')[0] || 'today')
      .replace(/[^A-Za-z0-9/_-]/g, '')
      .slice(0, 100),
    runtime: runtime.mode,
    appVersion: '0.4.0-planning',
    viewport: { width: innerWidth, height: innerHeight },
    capturedAt: new Date().toISOString(),
    ...(currentPublicView() ? { publicView: currentPublicView() } : {}),
  };
}
function token() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function FeedbackWidget() {
  const [view, setView] = useState<
    'closed' | 'choices' | 'capture' | 'crop' | 'compose' | 'success'
  >('closed');
  const [text, setText] = useState(''),
    [audio, setAudio] = useState<FeedbackAudio | null>(null),
    [image, setImage] = useState<FeedbackImage | null>(null);
  const [source, setSource] = useState(''),
    [error, setError] = useState(''),
    [recording, setRecording] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [discarding, setDiscarding] = useState(false);
  const origin = useRef(context()),
    submission = useRef<FeedbackSubmission | null>(null);
  const choices = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (view !== 'choices') return;
    const dialog = choices.current;
    dialog?.showModal();
    const close = (event: Event) => {
      if (!event.defaultPrevented) {
        event.preventDefault();
        setView('closed');
      }
    };
    window.addEventListener('f360-before-navigate', close);
    return () => {
      dialog?.close();
      window.removeEventListener('f360-before-navigate', close);
      trigger.current?.focus({ preventScroll: true });
    };
  }, [view]);
  useEffect(() => {
    const open = () => {
      origin.current = context();
      setView('choices');
    };
    window.addEventListener('f360-open-feedback', open);
    return () => window.removeEventListener('f360-open-feedback', open);
  }, []);
  function clear() {
    setText('');
    setAudio(null);
    setImage(null);
    setSource('');
    setConsent(false);
    setDiscarding(false);
    setError('');
    submission.current = null;
  }
  function close() {
    if (busy) return;
    window.dispatchEvent(new Event('f360-feedback-stop-voice'));
    if (text.trim() || audio || image || recording) setDiscarding(true);
    else {
      clear();
      setView('closed');
    }
  }
  async function capture() {
    setError('');
    setView('capture');
    try {
      const result = await captureViewport();
      setSource(result);
      setView('crop');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Screenshot capture failed. You can still send text or voice.',
      );
      setView('compose');
    }
  }
  async function submit() {
    if (busy || recording) return;
    setBusy(true);
    setError('');
    try {
      // Preserve the same ID after a failed/uncertain storage acknowledgement.
      const draft = {
        text: text.trim(),
        image,
        audio,
        context: origin.current,
        consent: true as const,
      };
      const previous = submission.current;
      submission.current =
        previous &&
        previous.text === draft.text &&
        previous.image === image &&
        previous.audio === audio
          ? previous
          : { id: crypto.randomUUID(), receiptToken: token(), ...draft };
      await queueFeedback(submission.current);
      setView('success');
      setSource('');
      void syncFeedback().catch(() => {});
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Your feedback could not be saved. Keep this draft and retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="feedback-widget" data-feedback-exclude>
      <button
        ref={trigger}
        className="feedback-bubble"
        aria-label="Give feedback"
        aria-haspopup="dialog"
        aria-expanded={view === 'choices'}
        hidden={view !== 'closed'}
        onClick={() => {
          origin.current = context();
          setView('choices');
        }}
      >
        <Finger />
        <span className="feedback-bubble-label">Feedback</span>
      </button>
      {view === 'choices' && (
        <dialog
          ref={choices}
          className="feedback-choices-dialog"
          aria-label="Choose feedback type"
          onCancel={(event) => {
            event.preventDefault();
            setView('closed');
          }}
          onClick={(event) => {
            if (event.target === choices.current) setView('closed');
          }}
        >
          <div className="feedback-choices-cluster">
            <div className="feedback-choice-buttons">
              <button onClick={() => void capture()}>
                <span>
                  <FeedbackGlyph camera />
                </span>
                Screenshot + feedback
              </button>
              <button
                onClick={() => {
                  setError('');
                  setView('compose');
                }}
              >
                <span>
                  <FeedbackGlyph />
                </span>
                Feedback only
              </button>
            </div>
            <svg
              className="feedback-connectors"
              viewBox="0 0 62 142"
              aria-hidden="true"
            >
              <path d="M0 33C45 33 10 71 62 71M0 108C45 108 10 71 62 71" />
            </svg>
            <button
              className="feedback-bubble expanded"
              aria-label="Close feedback options"
              onClick={() => setView('closed')}
            >
              <Finger />
            </button>
            <a
              className="feedback-history-link"
              href="#feedback"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setView('closed');
                window.setTimeout(() => go('feedback'), 0);
              }}
            >
              Your feedback & delivery
            </a>
          </div>
        </dialog>
      )}
      {view === 'capture' && (
        <div className="feedback-capturing" role="status">
          Preparing your screenshot…
        </div>
      )}
      {view === 'crop' && (
        <FeedbackCrop
          source={source}
          onUse={(value) => {
            setImage(value);
            setSource('');
            setView('compose');
          }}
          onCancel={() => {
            setSource('');
            setView('compose');
          }}
          onRetake={() => void capture()}
        />
      )}
      {view === 'compose' && (
        <Dialog title="Share feedback" onClose={close}>
          <form
            className="feedback-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className="feedback-composer-intro">
              A thought, a snag, a better way?
              <br />
              <strong>Tell us while it’s fresh.</strong>
            </p>
            <p className="feedback-context">
              From {origin.current.screen} ·{' '}
              {origin.current.runtime === 'offline'
                ? 'On this device'
                : 'Connected app'}
            </p>
            {image && (
              <div className="feedback-attachment">
                <img
                  src={`data:image/png;base64,${image.base64}`}
                  alt="Screenshot attached to your feedback"
                />
                <div>
                  <strong>Screenshot attached</strong>
                  <span>
                    {image.width} × {image.height}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setImage(null)}
                  >
                    Remove screenshot
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={recording}
                    onClick={() => void capture()}
                  >
                    Retake screenshot
                  </button>
                </div>
              </div>
            )}
            <label className="feedback-text-label" htmlFor="feedback-text">
              Your feedback
            </label>
            <textarea
              id="feedback-text"
              rows={5}
              maxLength={feedbackLimits.text}
              placeholder="What happened, or what could be better?"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <span className="feedback-character-count">
              {text.length}/{feedbackLimits.text}
            </span>
            <VoiceFeedback
              value={audio}
              onChange={setAudio}
              onRecording={setRecording}
            />
            {!image && (
              <button
                type="button"
                className="text-button"
                disabled={recording}
                onClick={() => void capture()}
              >
                Add a screenshot
              </button>
            )}
            <label className="feedback-consent">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              Send this feedback and its attachments to the feedback team.
            </label>
            <p className="feedback-hint">
              Check your screenshot and recording for private details. Reports
              stay on this device until an enabled server receives them.
              Submitted reports are kept by the server for 30 days.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="feedback-actions">
              <button
                type="submit"
                disabled={
                  busy || recording || !consent || (!text.trim() && !audio)
                }
              >
                {busy ? 'Saving…' : 'Submit feedback'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {discarding && (
        <Dialog
          title="Discard this feedback draft?"
          onClose={() => setDiscarding(false)}
        >
          <p>Your unsubmitted text and attachments will be removed.</p>
          <div className="feedback-actions">
            <button
              onClick={() => {
                clear();
                setView('closed');
              }}
            >
              Discard draft
            </button>
            <button className="secondary" onClick={() => setDiscarding(false)}>
              Keep editing
            </button>
          </div>
        </Dialog>
      )}
      {view === 'success' && (
        <Dialog
          title="Saved on this device"
          onClose={() => {
            clear();
            setView('closed');
          }}
        >
          <div className="feedback-success">
            <span className="feedback-success-mark" aria-hidden="true">
              ✓
            </span>
            <h3>Thanks for helping shape Fingent360.</h3>
            <p>
              Your feedback is saved. Delivery status will change to Received
              only after the server confirms it.
            </p>
            <a
              className="button"
              href="#feedback"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                clear();
                setView('closed');
                window.setTimeout(() => go('feedback'), 0);
              }}
            >
              View feedback
            </a>
            <button
              className="text-button"
              onClick={() => {
                clear();
                setView('closed');
              }}
            >
              Back to the app
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

const stateLabel = (entry: FeedbackEntry) =>
  entry.state === 'received'
    ? entry.receipt?.status === 'reviewing'
      ? 'Being reviewed'
      : entry.receipt?.status === 'resolved'
        ? 'Resolved'
        : 'Received'
    : {
        pending: 'Pending delivery',
        sending: 'Sending',
        failed: 'Needs attention',
        deleting: 'Deleting',
      }[entry.state];
export function FeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]),
    [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>(
      'loading',
    ),
    [loadAttempt, setLoadAttempt] = useState(0),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false),
    [apiOrigin, setApiOrigin] = useState(''),
    [activeOrigin, setActiveOrigin] = useState('');
  const [remove, setRemove] = useState<FeedbackEntry | null>(null),
    [expanded, setExpanded] = useState<string | null>(null);
  async function reload() {
    const items = await listFeedback();
    setEntries(items);
  }
  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    void Promise.all([listFeedback(), getFeedbackSettings()])
      .then(([items, settings]) => {
        if (active) {
          setEntries(items);
          setEnabled(settings.enabled);
          setApiOrigin(settings.apiOrigin);
          setActiveOrigin(settings.apiOrigin);
          setLoadState('ready');
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error ? e.message : 'Feedback could not be opened.',
          );
          setLoadState('failed');
        }
      });
    const changed = () => {
      void listFeedback()
        .then((items) => {
          if (active) setEntries(items);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    };
    window.addEventListener('f360-feedback-changed', changed);
    return () => {
      active = false;
      window.removeEventListener('f360-feedback-changed', changed);
    };
  }, [loadAttempt]);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feedback action failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feedback-page">
      <p className="page-kicker">MADE BETTER TOGETHER</p>
      <h1>Your feedback</h1>
      <p>
        Ideas and issues you’ve shared from this browser or device. Your private
        receipts stay here, separate from your account.
      </p>
      <div className="feedback-tools">
        <button
          onClick={() => window.dispatchEvent(new Event('f360-open-feedback'))}
        >
          New feedback
        </button>
        <button
          className="secondary"
          disabled={busy || loadState !== 'ready'}
          onClick={() =>
            void action(async () => {
              await syncFeedback({ force: true });
              await refreshFeedbackReceipts();
              setNotice(
                'Delivery checked. Pending reports stay saved until acknowledged.',
              );
            })
          }
        >
          Check delivery
        </button>
      </div>
      {loadState === 'loading' && <p role="status">Opening saved feedback…</p>}
      {error && <p role="alert">{error}</p>}
      {loadState === 'failed' && (
        <button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
          Retry opening feedback
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
      {loadState === 'ready' && entries.length === 0 && (
        <div className="feedback-empty">
          <FeedbackGlyph />
          <h2>Every detail helps.</h2>
          <p>
            Share what works, what doesn’t, or what you wish you could do. Your
            submitted feedback will appear here.
          </p>
        </div>
      )}
      <div className="feedback-list">
        {entries.map((entry) => (
          <article
            key={entry.submission.id}
            aria-label={`Feedback ${entry.submission.id.slice(0, 8)}`}
            className="feedback-card"
          >
            <header>
              <span className={`feedback-status ${entry.state}`}>
                {stateLabel(entry)}
              </span>
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString()}
              </time>
            </header>
            <p className="feedback-body-text">
              {entry.submission.text || 'Voice feedback'}
            </p>
            <small>
              {entry.submission.context.screen} · Receipt{' '}
              {entry.submission.id.slice(0, 8)}
            </small>
            {entry.lastError && <p>{entry.lastError}</p>}
            {entry.destination && entry.destination !== activeOrigin && (
              <p>
                Waiting for the original destination:{' '}
                <strong>{entry.destination}</strong>. Changing the setting does
                not redirect this report.
              </p>
            )}
            {entry.state === 'pending' && (
              <p>
                Waiting for enabled feedback delivery and an available
                connection.
              </p>
            )}
            <div className="feedback-tools">
              <button
                className="text-button"
                aria-expanded={expanded === entry.submission.id}
                onClick={() =>
                  setExpanded(
                    expanded === entry.submission.id
                      ? null
                      : entry.submission.id,
                  )
                }
              >
                View attachments & details
              </button>
              {entry.state !== 'received' && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await retryFeedback(entry.submission.id);
                      await syncFeedback();
                    })
                  }
                >
                  Retry delivery
                </button>
              )}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setRemove(entry)}
              >
                Delete feedback
              </button>
            </div>
            {expanded === entry.submission.id && (
              <div className="feedback-record-details">
                {entry.submission.image && (
                  <img
                    src={`data:image/png;base64,${entry.submission.image.base64}`}
                    alt="Submitted screenshot"
                  />
                )}
                {entry.submission.audio && (
                  <audio
                    controls
                    src={`data:${entry.submission.audio.mime};base64,${entry.submission.audio.base64}`}
                    aria-label="Submitted voice feedback"
                  />
                )}
                <p>
                  Capture date:{' '}
                  {new Date(
                    entry.submission.context.capturedAt,
                  ).toLocaleString()}{' '}
                  · App {entry.submission.context.appVersion}
                </p>
                <p>Destination: {entry.destination || 'Not yet assigned'}</p>
                {entry.receipt && (
                  <p>
                    Received:{' '}
                    {new Date(entry.receipt.receivedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {loadState === 'ready' && (
        <form
          className="feedback-settings device-card"
          onSubmit={(event) => {
            event.preventDefault();
            void action(async () => {
              await saveFeedbackSettings({ enabled, apiOrigin });
              const settings = await getFeedbackSettings();
              setActiveOrigin(settings.apiOrigin);
              setApiOrigin(settings.apiOrigin);
              setNotice(
                settings.enabled
                  ? 'Feedback delivery enabled. Submitted reports will retry while the app is open.'
                  : 'Feedback delivery paused. Reports remain on this device.',
              );
              void syncFeedback().catch(() => {});
            });
          }}
        >
          <h2>Feedback delivery</h2>
          <p>
            Only feedback you explicitly submit is sent. Accounts, holdings and
            other private records are not synchronized.
          </p>
          <label className="feedback-consent">
            <input
              type="checkbox"
              disabled={busy}
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Automatically deliver submitted feedback
          </label>
          <label>
            Feedback API URL
            <input
              type="url"
              disabled={busy}
              placeholder="https://api.example.com"
              value={apiOrigin}
              required={enabled}
              onChange={(event) => setApiOrigin(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <p className="feedback-hint">
            Use your Fingent360 API origin. On Android it must use HTTPS.
            Pending reports with no destination will use this server; reports
            already attempted stay bound to their original server. Retries run
            while the app is open and on return.
          </p>
          <button disabled={busy}>Save feedback delivery settings</button>
        </form>
      )}
      {remove && (
        <Dialog title="Delete this feedback?" onClose={() => setRemove(null)}>
          <p>
            Unsent feedback is removed from this device. If delivery was
            attempted, deletion stays queued until the original server
            acknowledges it.
          </p>
          <div className="feedback-actions">
            <button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await deleteFeedback(remove.submission.id);
                  setRemove(null);
                  await syncFeedback();
                })
              }
            >
              Confirm deletion
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              Keep feedback
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
