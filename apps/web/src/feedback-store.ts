import {
  FeedbackSubmissionSchema,
  type FeedbackSubmission,
  type FeedbackReceipt,
} from '@fingent360/contracts';
import { runtime } from './runtime';
export interface FeedbackSettings {
  enabled: boolean;
  apiOrigin: string;
}
export interface FeedbackEntry {
  submission: FeedbackSubmission;
  state: 'pending' | 'sending' | 'received' | 'failed' | 'deleting';
  receipt: FeedbackReceipt | null;
  attempts: number;
  nextAttemptAt: number | null;
  lastError: string;
  destination: string | null;
  createdAt: string;
  leaseId?: string;
  leaseUntil?: number;
  deleteRequested?: boolean;
}
interface FeedbackState {
  records: FeedbackEntry[];
  config: FeedbackSettings;
}
interface Stored extends FeedbackState {
  revision: number;
}
interface Bridge {
  feedbackRead(): Promise<Stored>;
  feedbackWrite(
    expectedRevision: number,
    state: FeedbackState,
  ): Promise<{ revision: number }>;
  sendFeedback(
    apiOrigin: string,
    method: string,
    id: string | null,
    receiptToken: string | null,
    body: unknown,
  ): Promise<{ status: number; body: unknown }>;
}
export function feedbackBridge(): Bridge | undefined {
  const bridge = (window.FingentAndroid ?? window.FingentIOS) as unknown as
    Partial<Bridge> | undefined;
  return bridge?.feedbackRead && bridge.feedbackWrite && bridge.sendFeedback
    ? (bridge as Bridge)
    : undefined;
}
export function normalizeFeedbackOrigin(value: string): string {
  if (!value.trim()) return '';
  const url = new URL(value);
  const local =
    !runtime.native &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    url.protocol === 'http:';
  if (
    (url.protocol !== 'https:' && !local) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw Error('Use an HTTPS server origin without a path or credentials.');
  return url.origin;
}
function defaults(): Stored {
  return {
    revision: 0,
    records: [],
    config:
      runtime.mode === 'offline'
        ? { enabled: false, apiOrigin: '' }
        : {
            enabled: true,
            apiOrigin: normalizeFeedbackOrigin(
              runtime.apiUrl || location.origin,
            ),
          },
  };
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('fingent360-feedback', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('outbox');
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      database = undefined;
      reject(
        Error(
          'Feedback storage could not open. Keep this draft and free device storage before trying again.',
        ),
      );
    };
  }));
}
function bounded(state: FeedbackState) {
  if (
    state.records.length > 100 ||
    new Blob([JSON.stringify(state)]).size > 32 * 1024 * 1024
  )
    throw Error(
      'Feedback storage is full. Delete old reports or remove attachments, then submit again. Existing reports were preserved.',
    );
}
let channel: BroadcastChannel | undefined;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('fingent360-feedback-changes');
    // Only an invalidation signal crosses tabs; never reports or capabilities.
    channel.onmessage = (event) => {
      if (event.data === 'changed')
        window.dispatchEvent(new Event('f360-feedback-changed'));
    };
  }
} catch {
  /* Native WebViews may not provide cross-context channels. */
}
window.addEventListener('storage', (event) => {
  if (event.key === 'f360-feedback-change')
    window.dispatchEvent(new Event('f360-feedback-changed'));
});
function changed() {
  window.dispatchEvent(new Event('f360-feedback-changed'));
  try {
    if (channel) channel.postMessage('changed');
    else localStorage.setItem('f360-feedback-change', crypto.randomUUID());
  } catch {
    /* Local notification still succeeds in restricted native WebViews. */
  }
}
export async function mutateFeedback<T>(
  mutator: (state: FeedbackState) => T,
): Promise<T> {
  const bridge = feedbackBridge();
  if (runtime.native && !bridge)
    throw Error('Update the app to enable durable native feedback storage.');
  if (bridge) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await bridge.feedbackRead();
      const state: FeedbackState = structuredClone({
        records: current.records,
        config: current.config,
      });
      const before = JSON.stringify(state);
      const result = mutator(state);
      if (before === JSON.stringify(state)) return result;
      bounded(state);
      try {
        await bridge.feedbackWrite(current.revision, state);
        changed();
        return result;
      } catch (error) {
        if (
          !/conflict|revision|changed in another view/i.test(
            error instanceof Error ? error.message : String(error),
          )
        )
          throw error;
      }
    }
    throw Error('Feedback changed in another view. Please try again.');
  }
  const database = await db();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const request = store.get('state');
    let result: T;
    let failure: unknown;
    let modified = false;
    request.onsuccess = () => {
      try {
        const current = (request.result as Stored | undefined) ?? defaults();
        const before = JSON.stringify(current);
        result = mutator(current);
        if (before === JSON.stringify(current)) return;
        bounded(current);
        modified = true;
        store.put({ ...current, revision: current.revision + 1 }, 'state');
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => {
      if (modified) changed();
      resolve(result!);
    };
    transaction.onabort = transaction.onerror = () =>
      reject(
        failure ??
          Error(
            'Feedback could not be saved. Existing reports were preserved; check available device storage.',
          ),
      );
  });
}
async function read(): Promise<Stored> {
  const bridge = feedbackBridge();
  if (runtime.native && !bridge)
    throw Error('Update the app to enable durable native feedback storage.');
  if (bridge) return bridge.feedbackRead();
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('outbox', 'readonly');
    const request = transaction.objectStore('outbox').get('state');
    request.onsuccess = () =>
      resolve((request.result as Stored | undefined) ?? defaults());
    request.onerror = () => reject(Error('Saved feedback could not be read.'));
  });
}
export async function listFeedback(): Promise<FeedbackEntry[]> {
  return structuredClone((await read()).records).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export async function getFeedbackSettings(): Promise<FeedbackSettings> {
  return structuredClone((await read()).config);
}
export async function saveFeedbackSettings(
  settings: FeedbackSettings,
): Promise<void> {
  if (typeof settings.enabled !== 'boolean')
    throw Error('Choose whether feedback delivery is enabled.');
  const apiOrigin = normalizeFeedbackOrigin(settings.apiOrigin);
  if (settings.enabled && !apiOrigin)
    throw Error('Choose a feedback server before enabling delivery.');
  await mutateFeedback((state) => {
    state.config = { enabled: settings.enabled, apiOrigin };
  });
}
export async function queueFeedback(
  raw: FeedbackSubmission,
): Promise<FeedbackEntry> {
  const submission = FeedbackSubmissionSchema.parse(raw);
  return mutateFeedback((state) => {
    const prior = state.records.find((v) => v.submission.id === submission.id);
    if (prior) {
      if (JSON.stringify(prior.submission) !== JSON.stringify(submission))
        throw Error(
          'This report ID already belongs to another submission. Create a new report.',
        );
      return structuredClone(prior);
    }
    const entry: FeedbackEntry = {
      submission: structuredClone(submission),
      state: 'pending',
      receipt: null,
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: '',
      destination: null,
      createdAt: new Date().toISOString(),
    };
    state.records.push(entry);
    // Preserve room for leases, receipts and deletion intents at capacity.
    if (
      state.records.length > 100 ||
      new Blob([JSON.stringify(state)]).size > 32 * 1024 * 1024 - 256 * 1024
    )
      throw Error(
        'Feedback queue is full. Delete older reports or reduce attachments before submitting. Existing reports and pending deletions are preserved.',
      );
    return structuredClone(entry);
  });
}
export async function deleteFeedback(id: string): Promise<void> {
  await mutateFeedback((state) => {
    const item = state.records.find((v) => v.submission.id === id);
    if (!item) return;
    if (!item.attempts && !item.leaseId) {
      state.records = state.records.filter((v) => v !== item);
      return;
    }
    item.deleteRequested = true;
    item.state = 'deleting';
    item.nextAttemptAt = Date.now();
    item.lastError =
      'Deletion will complete when the original server acknowledges it.';
  });
}
export async function retryFeedback(id: string): Promise<void> {
  await mutateFeedback((state) => {
    const item = state.records.find((v) => v.submission.id === id);
    if (!item || item.state === 'received') return;
    item.state = item.deleteRequested ? 'deleting' : 'pending';
    item.nextAttemptAt = Date.now();
    item.lastError = '';
  });
}
