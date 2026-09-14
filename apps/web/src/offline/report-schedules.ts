import {
  ScheduleExportQuerySchema,
  ReportScheduleSchema,
  ScheduleWriteSchema,
  ScheduleReceiptSchema,
  ScheduleExportSchema,
  ReportSchedulesSchema,
  ScheduleOccurrenceSchema,
  nextScheduleDue,
  latestScheduleDue,
  type ReportSchedule,
  type ScheduleOccurrence,
} from '@fingent360/contracts';
import {
  type OfflineBundle,
  type LocalState,
  type OfflineHandler,
  requireUser,
  fail,
} from './types';
import { parseLocal } from './finance';
import { reportsHandler } from './reports';
type Store = {
  schedules: ReportSchedule[];
  editions: ReportSchedule[];
  receipts: Array<{
    fingerprint: string;
    receipt: ReturnType<typeof ScheduleReceiptSchema.parse>;
  }>;
  occurrences: ScheduleOccurrence[];
};
function store(state: LocalState, userId: string): Store {
  const all = (state.data.localReportSchedules ??= {}) as Record<string, Store>;
  return (all[userId] ??= {
    schedules: [],
    editions: [],
    receipts: [],
    occurrences: [],
  });
}
export function exportOfflineReportSchedules(
  state: LocalState,
  userId: string,
  query: unknown = {},
) {
  const data = store(state, userId),
    q = parseLocal(ScheduleExportQuerySchema, query);
  const editionUntil = q.editionUntil ?? data.editions.length,
    receiptUntil = q.receiptUntil ?? data.receipts.length,
    occurrenceUntil = q.occurrenceUntil ?? data.occurrences.length;
  const next = {
    editionUntil,
    receiptUntil,
    occurrenceUntil,
    editionAfter: Math.min(editionUntil, q.editionAfter + 100),
    receiptAfter: Math.min(receiptUntil, q.receiptAfter + 100),
    occurrenceAfter: Math.min(occurrenceUntil, q.occurrenceAfter + 100),
  };
  return ScheduleExportSchema.parse({
    ownerId: userId,
    editions: data.editions.slice(q.editionAfter, next.editionAfter),
    receipts: data.receipts
      .slice(q.receiptAfter, next.receiptAfter)
      .map((r) => r.receipt),
    occurrences: data.occurrences.slice(
      q.occurrenceAfter,
      next.occurrenceAfter,
    ),
    next:
      next.editionAfter < editionUntil ||
      next.receiptAfter < receiptUntil ||
      next.occurrenceAfter < occurrenceUntil
        ? next
        : null,
  });
}
export async function materializeLocalSchedules(
  state: LocalState,
  bundle: OfflineBundle,
) {
  const user = requireUser(state),
    data = store(state, user.id),
    now = new Date().toISOString();
  for (const schedule of data.schedules) {
    if (
      schedule.status !== 'active' ||
      !schedule.nextDueAt ||
      schedule.nextDueAt > now
    )
      continue;
    const due = latestScheduleDue(schedule.config, schedule.nextDueAt, now),
      id = crypto.randomUUID();
    let status: 'queued' | 'capacity' | 'failed' = 'queued',
      message = 'Actual saved records captured on this device.';
    try {
      await reportsHandler(
        {
          method: 'POST',
          path: '/api/v1/account/reports',
          query: new URLSearchParams(),
          headers: new Headers(),
          body: { requestId: id, label: schedule.config.label, consent: true },
        },
        state,
        bundle,
      );
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'status' in error
          ? error.status
          : undefined;
      status = code === 400 || code === 429 ? 'capacity' : 'failed';
      message =
        status === 'capacity'
          ? 'Skipped: report history or hourly capacity was full.'
          : 'Capture failed. No background retry is promised; the next occurrence remains scheduled.';
    }
    data.occurrences.push(
      ScheduleOccurrenceSchema.parse({
        id,
        scheduleId: schedule.id,
        scheduleVersion: schedule.version,
        dueAt: due.dueAt,
        capturedAt: now,
        skipped: due.skipped,
        status,
        reportId: status === 'queued' ? id : null,
        message,
      }),
    );
    schedule.nextDueAt = due.nextDueAt;
    schedule.message = message;
  }
}
export const reportSchedulesHandler: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
  if (!request.path.startsWith('/api/v1/account/report-schedules')) return null;
  const user = requireUser(state),
    data = store(state, user.id),
    tail = request.path.slice('/api/v1/account/report-schedules'.length);
  if (request.method === 'GET' && tail === '/export')
    return {
      body: exportOfflineReportSchedules(
        state,
        user.id,
        Object.fromEntries(request.query),
      ),
    };
  if (request.method === 'GET' && !tail) {
    await materializeLocalSchedules(state, bundle);
    return {
      body: ReportSchedulesSchema.parse({
        schedules: [...data.schedules]
          .sort(
            (a, b) =>
              Number(a.status === 'deleted') - Number(b.status === 'deleted') ||
              b.savedAt.localeCompare(a.savedAt),
          )
          .slice(0, 105),
        occurrences: data.occurrences.slice(-100).reverse(),
        evaluatedAt: new Date().toISOString(),
        mode: 'device',
      }),
    };
  }
  if (request.method !== 'POST' || !/^\/[a-f0-9-]{36}$/.test(tail))
    fail(404, 'Schedule route not found.');
  const id = tail.slice(1),
    input = parseLocal(ScheduleWriteSchema, request.body),
    fingerprint = JSON.stringify({ id, input });
  const prior = data.receipts.find(
    (r) => r.receipt.requestId === input.requestId,
  );
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      fail(409, 'Request ID belongs to another change.');
    return { body: prior.receipt, status: 201 };
  }
  const all = state.data.localReportSchedules as Record<string, Store>;
  if (
    Object.entries(all).some(
      ([owner, d]) => owner !== user.id && d.schedules.some((s) => s.id === id),
    )
  )
    fail(404, 'Schedule not found.');
  const old = data.schedules.find((s) => s.id === id);
  if (!old && input.expectedVersion !== 0) fail(404, 'Schedule not found.');
  if (
    old?.status === 'deleted' ||
    (old?.version ?? 0) !== input.expectedVersion
  )
    fail(409, 'Schedule changed. Reload before changing it.');
  if (!old && input.action !== 'save') fail(404, 'Schedule not found.');
  if (
    (input.action === 'pause' && old?.status !== 'active') ||
    (input.action === 'resume' && old?.status !== 'paused')
  )
    fail(409, 'This schedule cannot perform that action.');
  if (!old && data.schedules.filter((s) => s.status !== 'deleted').length >= 5)
    fail(400, 'Keep at most five schedules.');
  const config = input.config ?? old!.config,
    status =
      input.action === 'delete'
        ? 'deleted'
        : input.action === 'pause'
          ? 'paused'
          : 'active',
    savedAt = new Date().toISOString();
  const schedule = ReportScheduleSchema.parse({
    id,
    version: (old?.version ?? 0) + 1,
    config,
    status,
    savedAt,
    nextDueAt: status === 'active' ? nextScheduleDue(config, savedAt) : null,
    message:
      status === 'active'
        ? 'Next future occurrence; captured only when this device is open.'
        : 'Existing reports remain.',
  });
  const receipt = ScheduleReceiptSchema.parse({
    requestId: input.requestId,
    schedule,
  });
  data.schedules = data.schedules
    .filter((s) => s.id !== id)
    .concat(structuredClone(schedule));
  data.editions.push(structuredClone(schedule));
  data.receipts.push({ fingerprint, receipt: structuredClone(receipt) });
  return { status: 201, body: receipt };
};
