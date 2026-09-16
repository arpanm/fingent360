import { handleFilingDiscovery } from './filing-discovery';
import { handleFilingWatch } from './filing-watch';
import { handleCcilZero } from './ccil-zero-curve';
import { handleCorporateRatings } from './corporate-rating';
import { handleEiaSpot } from './eia-spot';
import { handleSovereignBonds } from './sovereign-bond';
import { handleEquityActionTerms } from './equity-action-terms';
import { handleFundFactsheet } from './fund-factsheet';
import { handleFundMergers } from './fund-mergers';
import { handleEquityConsolidations } from './equity-consolidation';
import { handleCommodityBenchmarks } from './commodity-benchmarks';
import { handleRegulatorySources } from './regulatory-sources';
import { handleCpiExpectations } from './cpi-expectations';
import { handleGdpExpectations } from './gdp-expectations';
import { handleWhatsappChannel } from './whatsapp-channel';
import { handleCcilYields } from './ccil-yields';
import { handleSbiPortfolio } from './sbi-portfolio';
import { handleRbiCalendar } from './rbi-calendar';
import { handleIntelligenceBriefs } from './intelligence-brief';
import { handlePolicyCalendar } from './policy-calendar';
import { handleIndiaMacro } from './india-macro';
import { handleEquityAdjustments } from './equity-adjustments';
import { handleClassificationCrosswalks } from './classification-crosswalk';
import { handleParticipantPositioning } from './participant-positioning';
import { handleInstitutionalFlows } from './institutional-flows';
import { handleImpactCalibrations } from './impact-calibration';
import { handleEventScenarios } from './event-scenarios';
import { handleActionCentre } from './action-centre';
import { handleFundsBonds } from './funds-bonds';
import { handleResearchCalendar } from './research-calendar';
import { handleImpactTraces } from './impact-trace';
import { handleEquityCoverage } from './equity-coverage';
import { handleEvents } from './events';
import { handleConsents } from './consents';
import {
  reportSchedulesHandler,
  materializeLocalSchedules,
} from './report-schedules';
import { handleReadingFollow } from './reading-follow';
import {
  handleMaterialAlerts,
  materializeLocalMaterial,
} from './material-alerts';
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
import { handleGoalFeasibility } from './goal-feasibility';
import { handleGoalScenarios } from './goal-scenarios';
import { handleConnectionReviews } from './connection-reviews';
import { handleFinance } from './finance';
import { handleContent } from './content';
import { handleLibrary, deliverOfflineReminders } from './library';
import { handleLearning } from './learning';
import { handleAssistance } from './assistance';
import { handleJourney } from './journey';
import { handleResearchConnections } from './research-connections';
import { handleAllocations } from './allocations';
import { handleRecovery } from './recovery';
import { handleSecurities } from './securities';
import { reportsHandler } from './reports';
import { handleReportComparison } from './report-comparison';
import { handleRetention } from './retention';
import { handleWorkerHealth } from './worker-health';
import { handleEcbRates } from './ecb-rates';
import { handleOilBenchmarks } from './oil-benchmarks';
import { handleEcbFx } from './ecb-fx';
import { handleOperatorAudit } from './operator-audit';

const bundle = snapshot as OfflineBundle;
const handlers: OfflineHandler[] = [
  handleEvents,
  handleEcbRates,
  handleOilBenchmarks,
  handleEcbFx,
  handleEventScenarios,
  handleActionCentre,
  handleIndiaMacro,
  handleEquityConsolidations,
  handleEquityActionTerms,
  handleEquityAdjustments,
  handleClassificationCrosswalks,
  handleParticipantPositioning,
  handleCommodityBenchmarks,
  handleRegulatorySources,
  handleCpiExpectations,
  handleGdpExpectations,
  handleWhatsappChannel,
  handleCcilYields,
  handleFilingDiscovery,
  handleFilingWatch,
  handleCcilZero,
  handleCorporateRatings,
  handleEiaSpot,
  handleSovereignBonds,
  handleFundFactsheet,
  handleFundMergers,
  handleSbiPortfolio,
  handleRbiCalendar,
  handleIntelligenceBriefs,
  handleInstitutionalFlows,
  handleImpactCalibrations,
  handleFundsBonds,
  handlePolicyCalendar,
  handleResearchCalendar,
  handleImpactTraces,
  handleEquityCoverage,
  handleWorkerHealth,
  handleOperatorAudit,
  handleRetention,
  handleRecovery,
  handleSecurities,
  handleAccounts,
  handleConsents,
  handleMaterialAlerts,
  reportSchedulesHandler,
  async (request, state, bundle) => {
    if (
      request.method === 'GET' &&
      /^\/api\/v1\/account\/reports(?:\/|$)/.test(request.path)
    )
      await materializeLocalSchedules(state, bundle);
    return reportsHandler(request, state, bundle);
  },
  handleReportComparison,
  handleAllocations,
  handleResearchConnections,
  handleFinance,
  handleGoalScenarios,
  handleGoalFeasibility,
  handleConnectionReviews,
  handleReadingFollow,
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
  await withState(async (state) => {
    await deliverOfflineReminders(state, bundle);
    materializeLocalMaterial(state, bundle);
  });
  const refresh = () => {
    if (document.visibilityState === 'visible')
      void withState(async (state) => {
        await deliverOfflineReminders(state, bundle);
        materializeLocalMaterial(state, bundle);
      }).catch(() => {
        window.dispatchEvent(
          new CustomEvent('f360-storage-error', {
            detail:
              'Local reminders or observation checks could not be saved. Check free device storage and reopen the app.',
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
    if (
      ['kite', 'upstox', 'angel'].some(
        (provider) =>
          url.pathname === `/api/v1/account/broker-connections/${provider}` ||
          url.pathname.startsWith(
            `/api/v1/account/broker-connections/${provider}/`,
          ),
      )
    )
      fail(503, 'Broker connectivity requires connected mode.');
    if (
      url.pathname === '/api/v1/ops/oil-education' ||
      url.pathname.startsWith('/api/v1/ops/oil-education/')
    )
      fail(
        503,
        'Oil disclosure capture and review require connected Operations.',
      );
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
