import {
  compareRecordReports,
  RecordReportSchema,
  reportComparisonReference,
  ReportComparisonOptionsSchema,
  ReportComparisonQuerySchema,
  type ReportJob,
} from '@fingent360/contracts';
import { requireUser, fail, type OfflineHandler } from './types';
import { parseLocal } from './finance';
export const handleReportComparison: OfflineHandler = (request, state) => {
  if (
    ![
      '/api/v1/account/report-comparison',
      '/api/v1/account/report-comparison/options',
    ].includes(request.path)
  )
    return null;
  const user = requireUser(state);
  if (request.method !== 'GET') fail(405, 'Method not supported.');
  const reports =
    ((state.data.localReports ?? {}) as Record<string, ReportJob[]>)[user.id] ??
    [];
  if (request.path.endsWith('/options')) {
    try {
      return {
        body: ReportComparisonOptionsSchema.parse({
          reports: reports
            .filter((j) => j.status === 'succeeded' && j.report)
            .map((j) => {
              const original = RecordReportSchema.parse(j.report);
              if (original.id !== j.id) throw Error('Mismatched original.');
              return reportComparisonReference(original);
            }),
        }),
      };
    } catch {
      fail(503, 'An issued original is unreadable. Try again later.');
    }
  }
  const entries = [...request.query.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length)
    fail(400, 'Provide each report ID once.');
  const input = parseLocal(
    ReportComparisonQuerySchema,
    Object.fromEntries(entries),
  );
  const first = reports.find((j) => j.id === input.first),
    second = reports.find((j) => j.id === input.second);
  if (!first || !second)
    fail(
      404,
      'One or both reports are unavailable. Choose two owned issued reports.',
    );
  if (
    first.status !== 'succeeded' ||
    second.status !== 'succeeded' ||
    !first.report ||
    !second.report
  )
    fail(
      409,
      'Both reports must be issued. Open Reports to check preparation.',
    );
  try {
    if (first.report.id !== first.id || second.report.id !== second.id)
      throw Error('Mismatched original.');
    return {
      body: compareRecordReports(
        first.report,
        second.report,
        new Date().toISOString(),
      ),
    };
  } catch {
    fail(503, 'An issued original is unreadable. Try again later.');
  }
};
