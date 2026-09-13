import {
  ReportRequestSchema,
  ReportMutationSchema,
  ReportJobsSchema,
  ReportJobSchema,
  issueRecordReport,
  type ReportJob,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type LocalState,
  type OfflineHandler,
} from './types';
import { localGoals, localHoldings, parseLocal } from './finance';
import { localAllocation } from './allocations';
function records(state: LocalState, userId: string): ReportJob[] {
  const all = (state.data.localReports ??= {}) as Record<string, ReportJob[]>;
  return (all[userId] ??= []);
}
export function exportOfflineReports(state: LocalState, userId: string) {
  return ReportJobsSchema.parse({ jobs: records(state, userId) });
}
export const reportsHandler: OfflineHandler = (request, state) => {
  if (!/^\/api\/v1\/account\/reports(?:\/|$)/.test(request.path)) return null;
  const user = requireUser(state);
  const jobs = records(state, user.id);
  const tail = request.path
    .slice('/api/v1/account/reports'.length)
    .split('/')
    .filter(Boolean);
  const now = new Date().toISOString();
  if (request.method === 'POST' && !tail.length) {
    const input = parseLocal(ReportRequestSchema, request.body);
    const old = jobs.find((j) => j.id === input.requestId);
    if (old) {
      if (old.label !== input.label)
        fail(409, 'This request ID already has a different label.');
      return { body: old, status: 201 };
    }
    if (jobs.length >= 100)
      fail(400, 'Report history has reached its 100-record limit.');
    const job = ReportJobSchema.parse({
      id: input.requestId,
      label: input.label,
      status: 'queued',
      version: 1,
      requestedAt: now,
      updatedAt: now,
      attempts: 0,
      nextAttemptAt: now,
      message:
        'Queued on this device. Open reports to prepare the captured records.',
      snapshot: {
        capturedAt: now,
        goals: localGoals(state, user.id),
        holdings: localHoldings(state, user.id),
        allocations: localAllocation(state, user.id),
      },
      report: null,
    });
    jobs.unshift(job);
    return { body: job, status: 201 };
  }
  if (
    tail.length > 2 ||
    (tail.length === 2 && !['download', 'cancel', 'retry'].includes(tail[1]!))
  )
    fail(404, 'Report route not found.');
  const job = tail.length ? jobs.find((j) => j.id === tail[0]) : undefined;
  if (tail.length && !job) fail(404, 'Report not found.');
  if (
    request.method === 'POST' &&
    job &&
    ['cancel', 'retry'].includes(tail[1] ?? '')
  ) {
    const input = parseLocal(ReportMutationSchema, request.body);
    if (input.expectedVersion !== job.version)
      fail(409, 'Report changed. Refresh its status.');
    const retry = tail[1] === 'retry';
    if (
      retry
        ? job.status !== 'failed'
        : !['queued', 'running'].includes(job.status)
    )
      fail(409, 'This report cannot perform that action.');
    job.status = retry ? 'queued' : 'cancelled';
    job.version++;
    job.updatedAt = now;
    job.nextAttemptAt = retry ? now : null;
    if (retry) job.attempts = 0;
    job.message = retry
      ? 'Retry requested for original snapshot.'
      : 'Cancelled before issuance.';
    return { body: job, status: 201 };
  }
  if (request.method === 'GET' && (!tail[1] || tail[1] === 'download')) {
    // Device work is explicitly resumed by reading this surface; no background or network worker.
    for (const current of job ? [job] : jobs) {
      if (!['queued', 'running'].includes(current.status)) continue;
      try {
        current.attempts++;
        current.report = issueRecordReport(
          current.id,
          current.label,
          current.snapshot,
          now,
        );
        current.status = 'succeeded';
        current.message =
          'Your immutable saved-record review is ready on this device.';
      } catch {
        current.status = current.attempts >= 3 ? 'failed' : 'queued';
        current.message =
          'Preparation interrupted. Open reports again to retry, up to three attempts.';
      }
      current.updatedAt = now;
      current.version++;
      current.nextAttemptAt = current.status === 'queued' ? now : null;
    }
    if (tail[1] === 'download') {
      if (!job?.report) fail(409, 'Report is not ready to download.');
      return { body: job.report };
    }
    return { body: job ?? exportOfflineReports(state, user.id) };
  }
  return { status: 405, body: { message: 'Method not supported.' } };
};
