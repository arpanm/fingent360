import { useEffect, useRef, useState } from 'react';
import {
  LearningCatalogSchema,
  LearningStateSchema,
  LearningAttemptSchema,
  LearningVoteSchema,
  type LearningQuestion,
  type LearningState,
} from '@fingent360/contracts';
import { AccountGate } from './AccountGate';
async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    method: body ? 'POST' : 'GET',
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 401)
    throw new Error('Sign in to keep your learning progress.');
  const payload: unknown = await response.json().catch(() => {
    throw new Error(
      'Learning service returned an unreadable response. Please retry.',
    );
  });
  if (!response.ok)
    throw new Error(
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Learning is unavailable. Please retry.',
    );
  return payload;
}
export function Learning() {
  const requests = useRef<Record<string, string>>({});
  const [items, setItems] = useState<LearningQuestion[]>([]);
  const [state, setState] = useState<LearningState | null>(null);
  const [guest, setGuest] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState('');
  async function load() {
    setState(
      LearningStateSchema.parse(
        await request('/api/v1/account/learning/state'),
      ),
    );
    setGuest(false);
  }
  useEffect(() => {
    let active = true;
    void request('/api/v1/learning/catalog')
      .then((v) => {
        if (active) setItems(LearningCatalogSchema.parse(v).items);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    void request('/api/v1/account/learning/state')
      .then((v) => {
        if (active) setState(LearningStateSchema.parse(v));
      })
      .catch((e: Error) => {
        if (active) {
          if (e.message.startsWith('Sign in')) setGuest(true);
          else setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(question: LearningQuestion) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const key = question.id + ':' + choices[question.id];
      const requestId = requests.current[key] ?? crypto.randomUUID();
      requests.current[key] = requestId;
      const result = await request(
        `/api/v1/account/learning/${question.kind === 'quiz' ? 'attempts' : 'vote'}`,
        {
          questionId: question.id,
          version: question.version,
          choiceId: choices[question.id],
          requestId,
          consent,
        },
      );
      if (question.kind === 'quiz') LearningAttemptSchema.parse(result);
      else LearningVoteSchema.parse(result);
      await load();
      delete requests.current[key];
      setNotice(
        question.kind === 'quiz'
          ? 'Answer saved. Read the explanation below.'
          : 'Your topic preference is saved.',
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Learning request failed.';
      if (message.startsWith('Sign in')) {
        setState(null);
        setGuest(true);
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="learning-page" aria-label="Learn and reflect">
      <header className="page-header">
        <p className="page-kicker">A LITTLE CLARITY</p>
        <h1>Understand one thing better</h1>
        <p className="page-description">
          Short questions about the terms behind your financial records. Learn
          at your pace; no score predicts investment success.
        </p>
      </header>
      {error && (
        <p role="alert">
          {error}
          <button
            className="secondary"
            onClick={() => {
              setError('');
              void load().catch((e: Error) => setError(e.message));
            }}
          >
            Retry progress
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {guest && (
        <AccountGate
          next="learning"
          title="Keep your learning progress"
          description="Sign in to answer questions and save a topic preference. You can read the questions and glossary explanations below without an account."
        />
      )}
      {state && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I agree to store my quiz answers and topic preferences until account
          deletion.
        </label>
      )}
      {items.map((question) => {
        const attempt = state?.attempts.find(
          (a) => a.questionId === question.id && a.version === question.version,
        );
        const vote = state?.votes.find(
          (v) => v.questionId === question.id && v.version === question.version,
        );
        const poll = state?.polls.find((p) => p.questionId === question.id);
        return (
          <article
            className="panel"
            key={question.id}
            aria-label={question.title}
          >
            <span className="badge">
              {question.kind === 'quiz'
                ? 'Quick question'
                : 'Your learning interests'}
            </span>
            <h2>{question.title}</h2>
            <p>{question.prompt}</p>
            <fieldset disabled={busy || !state}>
              <legend>Choose one answer</legend>
              {question.choices.map((choice) => (
                <label key={choice.id} className="check-label">
                  <input
                    type="radio"
                    name={question.id}
                    value={choice.id}
                    checked={choices[question.id] === choice.id}
                    onChange={() =>
                      setChoices({ ...choices, [question.id]: choice.id })
                    }
                  />
                  {choice.text}
                </label>
              ))}
              <button
                disabled={!choices[question.id] || !consent}
                onClick={() => void submit(question)}
              >
                {question.kind === 'quiz'
                  ? 'Check my answer'
                  : vote
                    ? 'Update my preference'
                    : 'Save my preference'}
              </button>
            </fieldset>
            {attempt && (
              <div className="learning-feedback" role="status">
                <h3>
                  {attempt.correct ? 'That’s right' : 'A useful distinction'}
                </h3>
                <p>{attempt.explanation}</p>
                <p className="muted">
                  Your last answer:{' '}
                  {
                    question.choices.find((c) => c.id === attempt.choiceId)
                      ?.text
                  }
                  . Saved {new Date(attempt.answeredAt).toLocaleString()}.
                </p>
              </div>
            )}
            {vote && (
              <p>
                Your saved preference:{' '}
                {question.choices.find((c) => c.id === vote.choiceId)?.text}
              </p>
            )}
            {poll && (
              <section aria-label="Topic preference results">
                <p>
                  {poll.total} participating{' '}
                  {poll.total === 1 ? 'account' : 'accounts'}
                </p>
                {poll.counts.map((result) => (
                  <p key={result.choiceId}>
                    {
                      question.choices.find((c) => c.id === result.choiceId)
                        ?.text
                    }
                    : {result.count}
                  </p>
                ))}
                <p className="muted">
                  Voluntary responses from accounts on this service, not a
                  representative survey or market forecast.
                </p>
              </section>
            )}
            <details>
              <summary>Read the glossary context</summary>
              <p>{question.source.excerpt}</p>
              <p className="muted">
                {question.source.title} · {question.source.revision} · question
                version {question.version}
              </p>
            </details>
          </article>
        );
      })}
      {state && (
        <details className="panel">
          <summary>Your recent answers ({state.attempts.length})</summary>
          {state.attempts.map((a) => (
            <p key={a.id}>
              {items.find((q) => q.id === a.questionId)?.title ?? a.questionId}:{' '}
              {a.correct ? 'Correct' : 'Review explanation'} ·{' '}
              {new Date(a.answeredAt).toLocaleString()} · question version{' '}
              {a.version}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
