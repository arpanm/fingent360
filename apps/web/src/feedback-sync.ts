import {
  FeedbackReceiptSchema,
  FeedbackReportSchema,
} from '@fingent360/contracts';
import {
  feedbackBridge,
  mutateFeedback,
  normalizeFeedbackOrigin,
  type FeedbackEntry,
} from './feedback-store';
import { runtime, networkFetch } from './runtime';
let running: Promise<void> | null = null;
const leaseMs = 60000;
function delay(attempts: number) {
  return Math.min(3600000, 15000 * 2 ** Math.min(8, Math.max(0, attempts - 1)));
}
async function claim(
  force: boolean,
  seen: Set<string>,
): Promise<FeedbackEntry | null> {
  return mutateFeedback((state) => {
    if (!state.config.enabled || !state.config.apiOrigin) return null;
    const destination = normalizeFeedbackOrigin(state.config.apiOrigin),
      now = Date.now();
    const item = state.records.find(
      (entry) =>
        !seen.has(`${entry.submission.id}:${!!entry.deleteRequested}`) &&
        entry.state !== 'received' &&
        (!entry.leaseUntil || entry.leaseUntil <= now) &&
        (force ||
          (entry.nextAttemptAt !== null && entry.nextAttemptAt <= now)) &&
        (!entry.destination || entry.destination === destination),
    );
    if (!item) return null;
    item.destination ??= destination;
    item.leaseId = crypto.randomUUID();
    item.leaseUntil = now + leaseMs;
    item.attempts++;
    item.state = item.deleteRequested ? 'deleting' : 'sending';
    item.lastError = '';
    return structuredClone(item);
  });
}
async function send(
  entry: FeedbackEntry,
): Promise<{ status: number; body: unknown }> {
  const method = entry.deleteRequested ? 'DELETE' : 'POST',
    bridge = feedbackBridge();
  if (bridge)
    return bridge.sendFeedback(
      entry.destination!,
      method,
      method === 'POST' ? null : entry.submission.id,
      method === 'POST' ? null : entry.submission.receiptToken,
      method === 'POST' ? entry.submission : null,
    );
  if (runtime.native)
    throw Error('The native feedback transport is unavailable.');
  const response = await networkFetch(
    `${entry.destination}/api/v1/feedback${method === 'DELETE' ? `/${entry.submission.id}` : ''}`,
    {
      method,
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: {
        'Content-Type': 'application/json',
        'X-Feedback-Token': entry.submission.receiptToken,
      },
      ...(method === 'POST' ? { body: JSON.stringify(entry.submission) } : {}),
    },
  );
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}
async function deliver(entry: FeedbackEntry) {
  let status = 0,
    body: unknown = null,
    errorMessage = '';
  try {
    const result = await send(entry);
    status = result.status;
    body = result.body;
  } catch {
    errorMessage =
      'Could not reach the feedback server. Your report stays on this device and will retry.';
  }
  await mutateFeedback((state) => {
    const current = state.records.find(
      (v) => v.submission.id === entry.submission.id,
    );
    if (!current || current.leaseId !== entry.leaseId) return;
    delete current.leaseId;
    delete current.leaseUntil;
    if (
      entry.deleteRequested &&
      ((status >= 200 && status < 300) || status === 410)
    ) {
      state.records = state.records.filter((v) => v !== current);
      return;
    }
    if (!entry.deleteRequested && current.deleteRequested) {
      // A concurrent delete supersedes POST completion, including terminal errors.
      // The capability-bound DELETE determines whether server cleanup is complete.
      const receipt = FeedbackReceiptSchema.safeParse(body);
      if (
        status >= 200 &&
        status < 300 &&
        receipt.success &&
        receipt.data.id === entry.submission.id
      )
        current.receipt = receipt.data;
      current.state = 'deleting';
      current.nextAttemptAt = Date.now();
      current.lastError = 'Completing deletion with the original server.';
      return;
    }
    if (!entry.deleteRequested && status >= 200 && status < 300) {
      const receipt = FeedbackReceiptSchema.safeParse(body);
      if (receipt.success && receipt.data.id === entry.submission.id) {
        current.receipt = receipt.data;
        current.state = current.deleteRequested ? 'deleting' : 'received';
        current.nextAttemptAt = current.deleteRequested ? Date.now() : null;
        current.lastError = '';
        return;
      }
      status = 502;
      errorMessage =
        'The server receipt was unreadable. The same report ID will be retried safely.';
    }
    // A tombstoned report is not silently re-created. Keep the local history until explicitly deleted.
    const retryable =
      status === 0 || status === 408 || status === 429 || status >= 500;
    current.state = current.deleteRequested ? 'deleting' : 'failed';
    current.nextAttemptAt = retryable
      ? Date.now() + delay(current.attempts)
      : null;
    current.lastError =
      errorMessage ||
      (retryable
        ? `Feedback server returned ${status}. The same report will retry.`
        : `Feedback server rejected this operation (${status}). Review the report or destination before retrying.`);
  });
}
export function syncFeedback({
  force = false,
}: { force?: boolean } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    const seen = new Set<string>();
    for (let count = 0; count < 100; count++) {
      if (!force && document.visibilityState === 'hidden') break;
      const entry = await claim(force, seen);
      if (!entry) break;
      seen.add(`${entry.submission.id}:${!!entry.deleteRequested}`);
      await deliver(entry);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
export function startFeedbackSync(): () => void {
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    if (document.visibilityState === 'hidden') return;
    timer = setTimeout(() => {
      void syncFeedback()
        .catch(() => {
          /* Local persistence failure remains visible when queue is opened. */
        })
        .finally(() => {
          if (!stopped && document.visibilityState !== 'hidden') {
            timer = setTimeout(schedule, 15000);
          }
        });
    }, 250);
  };
  window.addEventListener('online', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('f360-feedback-changed', schedule);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('f360-native-resume', schedule);
  window.addEventListener('f360-resume', schedule);
  schedule();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    window.removeEventListener('online', schedule);
    window.removeEventListener('pageshow', schedule);
    window.removeEventListener('f360-feedback-changed', schedule);
    document.removeEventListener('visibilitychange', schedule);
    window.removeEventListener('f360-native-resume', schedule);
    window.removeEventListener('f360-resume', schedule);
  };
}

export async function refreshFeedbackReceipts(): Promise<void> {
  const { getFeedbackSettings, listFeedback } =
    await import('./feedback-store');
  const settings = await getFeedbackSettings();
  if (!settings.enabled || !settings.apiOrigin) return;
  const destination = normalizeFeedbackOrigin(settings.apiOrigin);
  for (const entry of await listFeedback()) {
    if (
      !entry.receipt ||
      entry.deleteRequested ||
      entry.destination !== destination
    )
      continue;
    let status = 0,
      body: unknown = null;
    try {
      const bridge = feedbackBridge();
      if (bridge) {
        const result = await bridge.sendFeedback(
          destination,
          'GET',
          entry.submission.id,
          entry.submission.receiptToken,
          null,
        );
        status = result.status;
        body = result.body;
      } else {
        if (runtime.native)
          throw Error('Native feedback transport unavailable.');
        const response = await networkFetch(
          `${destination}/api/v1/feedback/${entry.submission.id}`,
          {
            credentials: 'omit',
            redirect: 'error',
            signal: AbortSignal.timeout(20000),
            headers: { 'X-Feedback-Token': entry.submission.receiptToken },
          },
        );
        status = response.status;
        body = await response.json().catch(() => null);
      }
    } catch {
      /* Preserve receipt and report a retryable status-check failure. */
    }
    await mutateFeedback((state) => {
      const current = state.records.find(
        (v) => v.submission.id === entry.submission.id,
      );
      if (
        !current ||
        current.deleteRequested ||
        current.destination !== destination
      )
        return;
      const report = FeedbackReportSchema.safeParse(body);
      const parsed = report.success
        ? FeedbackReceiptSchema.safeParse({
            id: report.data.id,
            status: report.data.status,
            receivedAt: report.data.receivedAt,
            updatedAt: report.data.updatedAt,
            version: report.data.version,
            supportAccess: report.data.supportAccess,
          })
        : FeedbackReceiptSchema.safeParse(body);
      if (
        status === 200 &&
        parsed.success &&
        parsed.data.id === entry.submission.id
      ) {
        if (
          !current.receipt ||
          parsed.data.version >= current.receipt.version
        ) {
          current.receipt = parsed.data;
          current.lastError = '';
        }
      } else
        current.lastError =
          status === 410
            ? 'The server reports this feedback was deleted. The local copy remains until you delete it.'
            : `Delivery status could not be checked${status ? ` (${status})` : ''}. Your previous receipt is retained.`;
    });
  }
}
