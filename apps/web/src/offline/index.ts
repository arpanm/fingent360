import { ZodError } from 'zod';
import snapshot from './content-bundle.json';
import {
  OfflineError,
  fail,
  type OfflineBundle,
  type OfflineRequest,
  type OfflineHandler,
} from './types';
import { withState } from './storage';
import { handleAccounts } from './accounts';
import { handleFinance } from './finance';
import { handleContent } from './content';
import { handleLibrary, deliverOfflineReminders } from './library';
import { handleLearning } from './learning';
import { handleAssistance } from './assistance';
import { handleJourney } from './journey';
import { handleAllocations } from './allocations';
import { handleRecovery } from './recovery';
import { handleSecurities } from './securities';
import { reportsHandler } from './reports';

const bundle = snapshot as OfflineBundle;
const handlers: OfflineHandler[] = [
  handleRecovery,
  handleSecurities,
  handleAccounts,
  reportsHandler,
  handleAllocations,
  handleFinance,
  handleLibrary,
  handleLearning,
  handleContent,
  handleAssistance,
  handleJourney,
];
export const snapshotInfo = {
  generatedAt: bundle.generatedAt,
  items: bundle.feed.length,
};
export async function initializeOffline() {
  await withState(async (state) => deliverOfflineReminders(state, bundle));
  const refresh = () => {
    if (document.visibilityState === 'visible')
      void withState(async (state) =>
        deliverOfflineReminders(state, bundle),
      ).catch(() => {
        window.dispatchEvent(
          new CustomEvent('f360-storage-error', {
            detail:
              'Reading reminders could not be saved. Check free device storage and reopen Saved.',
          }),
        );
      });
  };
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.setInterval(refresh, 15000);
}
export async function offlineResponse(request: Request): Promise<Response> {
  try {
    request.signal.throwIfAborted();
    const url = new URL(request.url);
    const text = await request.text();
    if (text.length > 2_000_000)
      fail(413, 'This upload exceeds the device workspace limit.');
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        fail(400, 'Send a valid JSON request.');
      }
    }
    const req: OfflineRequest = {
      method: request.method.toUpperCase(),
      path: url.pathname,
      query: url.searchParams,
      body,
      headers: request.headers,
    };
    const result = await withState(async (state) => {
      for (const handler of handlers) {
        const response = await handler(req, state, bundle);
        if (response) {
          request.signal.throwIfAborted();
          return response;
        }
      }
      if (req.method === 'GET' && req.path === '/api/v1/health')
        return {
          body: {
            status: 'ok',
            service: 'fingent360-api',
            timestamp: new Date().toISOString(),
          },
        };
      if (req.path === '/api/v1/ready')
        fail(
          503,
          'This is an on-device workspace. Server database readiness is not applicable.',
        );
      fail(
        503,
        'This action needs a connected server. Your on-device data is unchanged. Open App settings for connection options.',
      );
    });
    return Response.json(result.body, {
      status: result.status ?? 200,
      headers: { 'Cache-Control': 'no-store', ...result.headers },
    });
  } catch (error) {
    if (request.signal.aborted) throw request.signal.reason;
    const status =
      error instanceof OfflineError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 503;
    const message =
      error instanceof ZodError
        ? error.issues
            .map(
              (issue) => `${issue.path.join('.') || 'Input'}: ${issue.message}`,
            )
            .join('; ')
        : error instanceof Error
          ? error.message
          : 'Device request could not finish. Reopen the app and retry.';
    return Response.json(
      { message, statusCode: status },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
