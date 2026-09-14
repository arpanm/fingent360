import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
// Fixed route families prevent URLs, account IDs and query strings entering logs.
const families = new Set([
  'health',
  'ready',
  'account',
  'journey',
  'macro',
  'discovery',
  'ops',
  'feedback',
  'sources',
  'securities',
  'learning',
  'media',
  'assistance',
  'events',
  'policy-rates',
  'oil-benchmarks',
  'reference-fx',
]);
export function requestFamily(url: string): string {
  const match = /^\/api\/v1\/([a-z-]+)(?:[/?]|$)/.exec(url);
  return match && families.has(match[1]!) ? match[1]! : 'other';
}
export type RequestSummary = {
  requestId: string;
  family: string;
  method: string;
  status: number;
  durationMs: number;
  completed: boolean;
};
const observedSince = new Date().toISOString();
const totals = {
  completed: 0,
  disconnected: 0,
  serverErrors: 0,
  under100ms: 0,
  under1000ms: 0,
  slow: 0,
};
const increment = (key: keyof typeof totals) => {
  totals[key] = Math.min(Number.MAX_SAFE_INTEGER, totals[key] + 1);
};
export function requestMetrics() {
  return { observedSince, scope: 'this-api-process' as const, ...totals };
}
export function recordRequest(record: RequestSummary) {
  increment(record.completed ? 'completed' : 'disconnected');
  if (record.status >= 500 && record.completed) increment('serverErrors');
  if (record.completed)
    increment(
      record.durationMs < 100
        ? 'under100ms'
        : record.durationMs < 1000
          ? 'under1000ms'
          : 'slow',
    );
  process.stdout.write(
    `${JSON.stringify({ event: 'http.request', ...record })}\n`,
  );
}
export function requestObservation(
  write: (record: RequestSummary) => void = recordRequest,
) {
  return (
    request: { url: string; method: string },
    response: {
      statusCode: number;
      setHeader: (key: string, value: string) => void;
      once: (event: string, callback: () => void) => void;
    },
    next: () => void,
  ) => {
    const started = performance.now();
    const requestId = randomUUID();
    const family = requestFamily(request.url);
    const method = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
      'HEAD',
    ].includes(request.method)
      ? request.method
      : 'OTHER';
    response.setHeader('X-Request-ID', requestId);
    let recorded = false;
    const finish = (completed: boolean) => {
      if (recorded) return;
      recorded = true;
      write({
        requestId,
        family,
        method,
        status: response.statusCode,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        completed,
      });
    };
    response.once('finish', () => finish(true));
    response.once('close', () => finish(false));
    next();
  };
}
