import {
  reportSelections,
  captureReportResearch,
  ResearchConnectionsSchema,
  ReportSelectionError,
  ReportDeleteInputSchema,
  ReportDeletionSchema,
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
import { handleResearchConnections } from './research-connections';
function records(state: LocalState, userId: string): ReportJob[] {
  const all = (state.data.localReports ??= {}) as Record<string, ReportJob[]>;
  return (all[userId] ??= []);
}
function deletions(state: LocalState, userId: string) {
  const all = (state.data.localReportTombstones ??= {}) as Record<
    string,
    Array<{ id: string; deletedAt: string }>
  >;
  return (all[userId] ??= []);
}
export function exportOfflineReports(
  state: LocalState,
  userId: string,
  includeDeletions = true,
) {
  const jobs = records(state, userId);
  return ReportJobsSchema.parse({
    jobs,
    capacity: { used: jobs.length, limit: 100 },
    deletions: includeDeletions ? deletions(state, userId) : [],
  });
}
export const reportsHandler: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
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
    const foreignJobs = state.data.localReports as Record<string, ReportJob[]>;
    const foreignDeletes = (state.data.localReportTombstones ?? {}) as Record<
      string,
      Array<{ id: string }>
    >;
    if (
      Object.entries(foreignJobs).some(
        ([owner, rows]) =>
          owner !== user.id && rows.some((r) => r.id === input.requestId),
      ) ||
      Object.entries(foreignDeletes).some(
        ([owner, rows]) =>
          owner !== user.id && rows.some((r) => r.id === input.requestId),
      )
    )
      fail(404, 'Report not found.');
    if (deletions(state, user.id).some((r) => r.id === input.requestId))
      fail(
        410,
        'This report was deleted. Use a new request for a new snapshot.',
      );
    const old = jobs.find((j) => j.id === input.requestId);
    if (old) {
      if (
        old.label !== input.label ||
        JSON.stringify(reportSelections(old.snapshot)) !==
          JSON.stringify(input.researchConnections ?? [])
      )
        fail(
          409,
          'This request ID already has a different label or research connection selection.',
        );
      return { body: old, status: 201 };
    }
    if (jobs.length >= 100)
      fail(400, 'Report history has reached its 100-record limit.');
    const limits = (state.data.localReportLimits ??= {}) as Record<
      string,
      { start: number; used: number }
    >;
    let limit = limits[user.id];
    if (!limit || limit.start <= Date.now() - 3600000)
      limit = { start: Date.now(), used: 0 };
    if (limit.used >= 100)
      fail(
        429,
        'New report request limit reached. Try again after one hour. Existing reports can still be deleted.',
      );
    let researchConnections;
    if (input.researchConnections) {
      const stateResult = await handleResearchConnections(
        {
          ...request,
          path: '/api/v1/account/research-connections',
          method: 'GET',
          query: new URLSearchParams(),
          body: undefined,
        },
        state,
        bundle,
      );
      const context = ResearchConnectionsSchema.parse(stateResult?.body);
      try {
        researchConnections = captureReportResearch(
          input.researchConnections,
          context.connections,
          now,
          context.bundleGeneratedAt,
        );
      } catch (error) {
        if (error instanceof ReportSelectionError)
          fail(error.status, error.message);
        throw error;
      }
    }
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
        ...(researchConnections ? { researchConnections } : {}),
      },
      report: null,
    });
    limits[user.id] = { ...limit, used: limit.used + 1 };
    jobs.unshift(job);
    return { body: job, status: 201 };
  }
  if (
    tail.length > 2 ||
    (tail.length === 2 && !['download', 'cancel', 'retry'].includes(tail[1]!))
  )
    fail(404, 'Report route not found.');
  if (request.method === 'DELETE' && tail.length === 1) {
    const input = parseLocal(ReportDeleteInputSchema, request.body);
    const old = deletions(state, user.id).find((r) => r.id === tail[0]);
    if (old) return { body: old };
    const index = jobs.findIndex((j) => j.id === tail[0]);
    const target = jobs[index];
    if (!target) fail(404, 'Report not found.');
    if (target.version !== input.expectedVersion)
      fail(409, 'Report changed. Refresh before deleting.');
    if (!['succeeded', 'failed', 'cancelled'].includes(target.status))
      fail(409, 'Cancel preparation before deleting this report.');
    const receipt = ReportDeletionSchema.parse({
      id: target.id,
      deletedAt: now,
    });
    deletions(state, user.id).push(receipt);
    jobs.splice(index, 1);
    return { body: receipt };
  }
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
    return { body: job ?? exportOfflineReports(state, user.id, false) };
  }
  return { status: 405, body: { message: 'Method not supported.' } };
};
