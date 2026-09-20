import {
  CcilLiquidityController,
  OpsCcilLiquidityController,
  CCIL_LIQUIDITY_GATE,
} from './ccil-liquidity.js';
import {
  IndexLevelsController,
  IndexLevelsOperationsController,
  indexLevelsProvider,
} from './index-levels.js';
import {
  FilingDiscoveryOperationsController,
  filingDiscoveryProvider,
} from './filing-discovery.js';
import {
  FilingWatchOperationsController,
  filingWatchProvider,
} from './filing-watch.js';
import {
  CcilZeroController,
  OpsCcilZeroController,
  CCIL_ZERO_GATE,
} from './ccil-zero-curve.js';
import {
  CorporateRatingsController,
  CorporateRatingsOperationsController,
} from './corporate-rating.js';
import {
  EiaSpotController,
  EiaSpotOperationsController,
  eiaSpotProvider,
} from './eia-spot.js';
import {
  EquityActionTermsController,
  EquityActionTermsOperationsController,
  actionTermsProvider,
} from './equity-action-terms.js';
import {
  SovereignBondsController,
  SovereignBondsOperationsController,
} from './sovereign-bond.js';
import {
  FundFactsheetController,
  OpsFundFactsheetController,
} from './fund-factsheet.js';
import {
  FundMergersController,
  FundMergersOperationsController,
} from './fund-mergers.js';
import {
  EquityConsolidationsController,
  EquityConsolidationOperationsController,
  consolidationProvider,
} from './equity-consolidation.js';
import {
  CommodityOperationsController,
  CommodityPublicController,
  commodityProvider,
} from './commodity-benchmarks.js';
import {
  RegulatorySourcesController,
  OpsRegulatorySourcesController,
  REGULATORY_GATE,
} from './regulatory-sources.js';
import {
  CpiExpectationsController,
  CpiExpectationOperationsController,
  cpiExpectationProvider,
} from './cpi-expectations.js';
import {
  GdpExpectationsController,
  GdpExpectationOperationsController,
  gdpExpectationProvider,
} from './gdp-expectations.js';
import {
  WhatsappAccountController,
  WhatsappWebhookController,
  whatsappProvider,
} from './whatsapp-channel.js';
import {
  CcilYieldsController,
  OpsCcilYieldsController,
  CCIL_GATE,
} from './ccil-yields.js';
import {
  IntelligenceBriefController,
  IntelligenceBriefOperationsController,
  intelligenceBriefProvider,
} from './intelligence-brief.js';
import {
  FundLookthroughController,
  OpsFundLookthroughController,
} from './sbi-portfolio.js';
import {
  AngelConnectionController,
  angelConnectionProvider,
} from './angel-connection.js';
import {
  OilEducationController,
  oilEducationProvider,
} from './oil-education.js';
import {
  UpstoxConnectionController,
  upstoxConnectionProvider,
} from './upstox-connection.js';
import {
  IndiaMacroController,
  IndiaMacroOperationsController,
  indiaMacroProvider,
} from './india-macro.js';
import {
  EquityAdjustmentsController,
  EquityAdjustmentOperationsController,
  equityAdjustmentProvider,
} from './equity-adjustments.js';
import {
  ClassificationCrosswalkStore,
  ClassificationCrosswalkController,
  ClassificationCrosswalkPublicController,
} from './classification-crosswalk.js';
import {
  ParticipantPositioningController,
  ParticipantPositioningOperationsController,
  participantPositioningProvider,
} from './participant-positioning.js';
import {
  KiteConnectionController,
  kiteConnectionProvider,
} from './kite-connection.js';
import {
  InstitutionalFlowController,
  InstitutionalFlowOperationsController,
  institutionalFlowProvider,
} from './institutional-flows.js';
import { ImpactCalibrationController } from './impact-calibration.js';
import { AccountMfaController } from './account-mfa.js';
import {
  ResearchGovernanceStore,
  ResearchGovernanceController,
  ResearchGovernancePublicController,
} from './research-governance.js';
import { CompanyNewsController, companyNewsProvider } from './company-news.js';
import {
  DeploymentMonitoringController,
  DeploymentMonitoringStore,
  DeploymentMonitoringWorker,
} from './deployment-monitoring.js';
import {
  RESEARCH_AUTO_POLICY,
  ResearchAutoPolicyStore,
  ResearchAutoPolicyController,
} from './research-auto-policy.js';
import {
  PrivateAiHistoryController,
  PrivateAiHistoryExpiry,
} from './private-ai-history.js';
import {
  EventScenariosController,
  OpsEventScenariosController,
  eventScenarioProvider,
} from './event-scenarios.js';
import {
  EVAL_LINEAGE_STORE,
  EvalLineageStore,
  EvalLineageController,
} from './eval-lineage.js';
import { ActionCentreController } from './action-centre.js';
import {
  FundsController,
  OpsFundsController,
  BondComparisonsController,
  fundsBondsProvider,
} from './funds-bonds.js';
import {
  RESEARCH_AUTO_STORE,
  ResearchAutoStore,
  ResearchAutoWorker,
  ResearchAutoController,
  ResearchCalendarController,
} from './research-auto.js';
import { ImpactTraceController } from './impact-trace.js';
import {
  EquityCoverageController,
  OpsEquityCoverageController,
  equityCoverageProvider,
} from './equity-coverage.js';
import {
  IdentitySelectionController,
  OpsIdentitySelectionController,
  identitySelectionProvider,
} from './identity-selection.js';
import {
  EventLineageController,
  OpsEventLineageController,
  eventLineageProvider,
} from './event-lineage.js';
import { MaterialWorker, MaterialWorkerController } from './material-worker.js';
import { ConsentsController } from './consents.js';
import {
  EventsController,
  OpsEventsController,
  eventProvider,
} from './events.js';
import { NamedOperatorsController } from './named-operators.js';
import { PublicationProposalsController } from './publication-proposals.js';
import { OperatorPermissionGuard } from './operator-permissions.js';
import { requestObservation } from './request-observability.js';
import { QualityOverviewController } from './quality-overview.js';
import { GoalFeasibilityController } from './goal-feasibility.js';
import {
  ReportSchedulesController,
  ReportSchedulesStore,
} from './report-schedules.js';
import { ReadingFollowController } from './reading-follow.js';
import { createRequire } from 'node:module';
import {
  FeedbackController,
  OpsFeedbackController,
  feedbackProvider,
} from './feedback.js';
import { MediaController, OpsMediaController, mediaProvider } from './media.js';
import { AssistanceController, assistanceProvider } from './assistance.js';
import {
  EventExtractionController,
  eventExtractionProvider,
} from './event-extraction.js';
import {
  DISCOVERY_STORE,
  DiscoveryStore,
  DiscoveryController,
  OpsDiscoveryController,
  discoveryProvider,
} from './discovery.js';
import {
  OPERATOR_STORE,
  OperatorController,
  operatorProvider,
} from './operator.js';
import { OperatorAuditController } from './operator-audit.js';
import { PublishingQueueController } from './publishing-queue.js';
import { EvidenceExplanationsController } from './evidence-explanations.js';
import { MaterialAlertsController } from './material-alerts.js';
import { OpsLegacyController } from './ops-legacy.js';
import { LibraryController } from './library.js';
import { LibraryReminderWorker } from './library-worker.js';
import { LearningController, AccountLearningController } from './learning.js';
import 'reflect-metadata';
import {
  Controller,
  Get,
  Inject,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HealthSchema, ReadinessSchema } from '@fingent360/contracts';
import { DatabaseProbe, DEPENDENCY_PROBE } from './readiness.js';
import type { DependencyProbe } from './readiness.js';
import type { AppConfig } from './config.js';
import { JourneyController, journeyProvider } from './journey.js';
import { MacroController, macroProvider } from './macro.js';
import {
  EcbRateController,
  OpsEcbRateController,
  ecbRateProvider,
} from './ecb-rates.js';
import {
  OilBenchmarkController,
  OpsOilBenchmarkController,
  oilBenchmarkProvider,
} from './oil-benchmarks.js';
import {
  EcbFxController,
  OpsEcbFxController,
  ecbFxProvider,
} from './ecb-fx.js';
import { AccountController, accountProvider } from './accounts.js';
import { GoalScenariosController } from './goal-scenarios.js';
import { ConnectionReviewsController } from './connection-reviews.js';
import { GoalsController } from './goals.js';
import { PrivacyController } from './privacy.js';
import { SourcesController, sourcesProvider } from './sources.js';
import { AlertPreferencesController } from './alert-preferences.js';
import { HoldingsController } from './holdings.js';
import { OverviewController } from './overview.js';
import { ResearchConnectionsController } from './research-connections.js';
import { AllocationsController } from './allocations.js';
import { RecoveryController } from './recovery.js';
import { ReportsController, ReportsStore } from './reports.js';
import {
  ReportComparisonController,
  ReportComparisonStore,
} from './report-comparison.js';
import { ReportWorker } from './report-worker.js';
import { WorkerHealthController, WorkerHealthStore } from './worker-health.js';
import { RetentionController, retentionProvider } from './retention.js';
import {
  SecuritiesController,
  OpsSecuritiesController,
  securitiesProvider,
} from './securities.js';

@Controller()
class HealthController {
  constructor(
    @Inject(DEPENDENCY_PROBE) private readonly probe: DependencyProbe,
  ) {}
  @Get('health')
  health() {
    return HealthSchema.parse({
      status: 'ok',
      service: 'fingent360-api',
      timestamp: new Date().toISOString(),
    });
  }
  @Get('ready')
  async ready() {
    const result = ReadinessSchema.parse(await this.probe.check());
    if (result.status !== 'ready')
      throw new ServiceUnavailableException(result);
    return result;
  }
}
@Module({})
class AppModule {}

export async function createApp(
  config: AppConfig,
  probe: DependencyProbe = new DatabaseProbe(config),
) {
  const app = await NestFactory.create(
    {
      module: AppModule,
      controllers: [
        HealthController,
        IndiaMacroController,
        FilingDiscoveryOperationsController,
        FilingWatchOperationsController,
        CcilLiquidityController,
        OpsCcilLiquidityController,
        CcilZeroController,
        OpsCcilZeroController,
        CorporateRatingsController,
        CorporateRatingsOperationsController,
        EiaSpotController,
        EiaSpotOperationsController,
        EquityActionTermsController,
        EquityActionTermsOperationsController,
        SovereignBondsController,
        SovereignBondsOperationsController,
        EquityConsolidationsController,
        EquityConsolidationOperationsController,
        EquityAdjustmentsController,
        ClassificationCrosswalkController,
        ClassificationCrosswalkPublicController,
        IndexLevelsController,
        IndexLevelsOperationsController,
        ParticipantPositioningController,
        IntelligenceBriefController,
        IntelligenceBriefOperationsController,
        FundFactsheetController,
        OpsFundFactsheetController,
        FundMergersController,
        FundMergersOperationsController,
        CommodityOperationsController,
        CommodityPublicController,
        RegulatorySourcesController,
        OpsRegulatorySourcesController,
        CpiExpectationsController,
        CpiExpectationOperationsController,
        GdpExpectationsController,
        GdpExpectationOperationsController,
        WhatsappAccountController,
        WhatsappWebhookController,
        CcilYieldsController,
        OpsCcilYieldsController,
        FundLookthroughController,
        OpsFundLookthroughController,
        OilEducationController,
        AngelConnectionController,
        KiteConnectionController,
        UpstoxConnectionController,
        InstitutionalFlowController,
        InstitutionalFlowOperationsController,
        ParticipantPositioningOperationsController,
        EquityAdjustmentOperationsController,
        IndiaMacroOperationsController,
        ImpactCalibrationController,
        ResearchGovernanceController,
        ResearchGovernancePublicController,
        CompanyNewsController,
        ResearchAutoPolicyController,
        PrivateAiHistoryController,
        EventScenariosController,
        OpsEventScenariosController,
        EvalLineageController,
        ActionCentreController,
        FundsController,
        OpsFundsController,
        BondComparisonsController,
        ResearchAutoController,
        ResearchCalendarController,
        ImpactTraceController,
        EquityCoverageController,
        OpsEquityCoverageController,
        EventsController,
        EventLineageController,
        IdentitySelectionController,
        OpsIdentitySelectionController,
        OpsEventLineageController,
        OpsEventsController,
        EventExtractionController,
        QualityOverviewController,
        DeploymentMonitoringController,
        WorkerHealthController,
        FeedbackController,
        OpsFeedbackController,
        JourneyController,
        MacroController,
        EcbRateController,
        OpsEcbRateController,
        OilBenchmarkController,
        OpsOilBenchmarkController,
        EcbFxController,
        OpsEcbFxController,
        AccountController,
        AccountMfaController,
        GoalsController,
        GoalScenariosController,
        GoalFeasibilityController,
        ConnectionReviewsController,
        ReadingFollowController,
        PrivacyController,
        SourcesController,
        AlertPreferencesController,
        HoldingsController,
        OverviewController,
        AllocationsController,
        ResearchConnectionsController,
        RecoveryController,
        RetentionController,
        ReportsController,
        ReportSchedulesController,
        ConsentsController,
        ReportComparisonController,
        SecuritiesController,
        OpsSecuritiesController,
        AssistanceController,
        DiscoveryController,
        OpsDiscoveryController,
        OperatorController,
        NamedOperatorsController,
        PublicationProposalsController,
        OperatorAuditController,
        PublishingQueueController,
        EvidenceExplanationsController,
        MaterialAlertsController,
        MaterialWorkerController,
        OpsLegacyController,
        LibraryController,
        LearningController,
        AccountLearningController,
        MediaController,
        OpsMediaController,
      ],
      providers: [
        equityCoverageProvider(config),
        ResearchGovernanceStore,
        companyNewsProvider(config),
        indiaMacroProvider(config),
        {
          provide: CCIL_LIQUIDITY_GATE,
          useValue: {
            enabled: config.CCIL_LIQUIDITY_ENABLED,
            permissionReference: config.CCIL_LIQUIDITY_PERMISSION_REFERENCE,
          },
        },
        {
          provide: CCIL_ZERO_GATE,
          useValue: {
            enabled: config.CCIL_ZERO_ENABLED,
            permissionReference: config.CCIL_ZERO_PERMISSION_REFERENCE,
          },
        },
        filingDiscoveryProvider(config),
        filingWatchProvider(config),
        eiaSpotProvider(config),
        actionTermsProvider(config),
        consolidationProvider(config),
        equityAdjustmentProvider(config),
        ClassificationCrosswalkStore,
        indexLevelsProvider(config),
        participantPositioningProvider(config),
        {
          provide: CCIL_GATE,
          useValue: {
            enabled: config.CCIL_ENABLED,
            permissionReference: config.CCIL_PERMISSION_REFERENCE,
          },
        },
        {
          provide: REGULATORY_GATE,
          useValue: {
            enabled: config.REGULATORY_SOURCES_ENABLED,
            permissionReference: config.REGULATORY_SOURCES_PERMISSION_REFERENCE,
          },
        },
        commodityProvider(config),
        cpiExpectationProvider(config),
        gdpExpectationProvider(config),
        whatsappProvider(config),
        intelligenceBriefProvider,
        oilEducationProvider(config),
        angelConnectionProvider(config),
        kiteConnectionProvider(config),
        upstoxConnectionProvider(config),
        institutionalFlowProvider(config),
        {
          provide: RESEARCH_AUTO_POLICY,
          inject: [DISCOVERY_STORE],
          useFactory: (discovery: DiscoveryStore) =>
            new ResearchAutoPolicyStore(config, discovery),
        },
        {
          provide: RESEARCH_AUTO_STORE,
          inject: [DISCOVERY_STORE, RESEARCH_AUTO_POLICY],
          useFactory: (
            discovery: DiscoveryStore,
            policies: ResearchAutoPolicyStore,
          ) =>
            new ResearchAutoStore(
              config,
              discovery,
              config.RESEARCH_AUTO_ENABLED !== false,
              policies,
            ),
        },
        ResearchAutoWorker,
        fundsBondsProvider(config),
        {
          provide: EVAL_LINEAGE_STORE,
          useFactory: () => new EvalLineageStore(config),
        },
        eventScenarioProvider,
        PrivateAiHistoryExpiry,
        eventProvider,
        eventLineageProvider,
        identitySelectionProvider,
        { provide: DEPENDENCY_PROBE, useValue: probe },
        feedbackProvider(config),
        journeyProvider(config),
        macroProvider(config),
        ecbRateProvider(config),
        oilBenchmarkProvider(config),
        ecbFxProvider(config),
        accountProvider(config),
        retentionProvider(config),
        securitiesProvider(config),
        discoveryProvider(config),
        operatorProvider(config),
        LibraryReminderWorker,
        ReportsStore,
        ReportSchedulesStore,
        ReportComparisonStore,
        ReportWorker,
        MaterialWorker,
        WorkerHealthStore,
        DeploymentMonitoringStore,
        DeploymentMonitoringWorker,
        mediaProvider(config),
        sourcesProvider(config),
        assistanceProvider(config),
        eventExtractionProvider(config),
      ],
    },
    { logger: ['error', 'warn', 'log'], bodyParser: false },
  );
  // The Express adapter mounts its not-found router with this exact prefix.
  app.useGlobalGuards(new OperatorPermissionGuard(app.get(OPERATOR_STORE)));
  app.setGlobalPrefix('/api/v1');
  app.use(requestObservation());
  // Parse only feedback with the larger explicit upload bound. Other routes retain Nest's default.
  const requireExpress = createRequire(
    import.meta.resolve('@nestjs/platform-express'),
  );
  const express = requireExpress('express') as {
    json: (options: {
      limit: number;
      verify?: (
        request: { rawBody?: Buffer },
        response: unknown,
        buffer: Buffer,
      ) => void;
    }) => unknown;
    urlencoded: (options: { limit: number; extended: boolean }) => unknown;
  };
  app.use(
    '/api/v1/whatsapp/webhook',
    express.json({
      limit: 256_000,
      verify: (request, _response, buffer) => {
        request.rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use('/api/v1/ops/equities/import', express.json({ limit: 3_000_000 }));
  app.use('/api/v1/ops/funds/import', express.json({ limit: 10_000_000 }));
  // Source-specific contracts cap decoded fields; transport also permits JSON escaping.
  for (const [path, limit] of [
    ['/api/v1/ops/filing-discovery/capture', 12_100_000],
    ['/api/v1/ops/bond-zero-curve/import', 3_100_000],
    ['/api/v1/ops/corporate-ratings/import', 2_900_000],
    ['/api/v1/ops/eia-spot/capture', 6_100_000],
    ['/api/v1/ops/equity-action-terms/prepare', 12_000_000],
    ['/api/v1/ops/sovereign-bonds/import', 11_500_000],
    ['/api/v1/ops/fund-factsheets/import', 4_100_000],
    ['/api/v1/ops/fund-mergers/import', 2_100_000],
    ['/api/v1/ops/commodity-benchmarks/capture', 4_100_000],
    ['/api/v1/ops/regulatory-sources/import', 2_100_000],
    ['/api/v1/ops/cpi-expectations/import', 12_100_000],
    ['/api/v1/ops/gdp-expectations/import', 12_100_000],
    ['/api/v1/ops/india-macro/gdp', 8_100_000],
    ['/api/v1/ops/india-macro/import', 18_100_000],
    ['/api/v1/ops/india-macro/calendar', 9_000_000],
    ['/api/v1/ops/positioning/capture', 12_100_000],
    ['/api/v1/ops/bond-liquidity/import', 2_700_000],
    ['/api/v1/ops/index-levels/capture', 12_100_000],
    ['/api/v1/ops/institutional-flows/capture', 6_100_000],
    ['/api/v1/ops/oil-education/capture', 6_100_000],
    ['/api/v1/ops/fund-lookthrough/import', 2_800_000],
    ['/api/v1/ops/bond-yields/import', 3_100_000],
    ['/api/v1/ops/equity-consolidations/prepare', 9_000_000],
    ['/api/v1/ops/equity-adjustments/prepare', 12_100_000],
  ] as const)
    app.use(path, express.json({ limit }));
  app.use('/api/v1/feedback', express.json({ limit: 8_500_000 }));
  // Explicitly mount the defaults: Nest detects any named jsonParser as global,
  // even a path-scoped one, and would otherwise skip parsing every other route.
  app.use(express.json({ limit: 102400 }));
  app.use(express.urlencoded({ limit: 102400, extended: true }));
  app.enableCors(
    (
      request: { url: string; headers: { origin?: string } },
      callback: (
        error: null,
        options: {
          origin: string | false;
          credentials: boolean;
          allowedHeaders?: string[];
        },
      ) => void,
    ) => {
      const feedback = /^\/api\/v1\/feedback(?:\/|\?|$)/.test(request.url);
      const incoming = request.headers.origin;
      const allowed =
        incoming === config.WEB_ORIGIN ||
        (feedback &&
          (incoming === 'https://appassets.androidplatform.net' ||
            incoming === 'https://ios.fingent360.invalid'));
      callback(null, {
        origin: feedback ? (allowed ? incoming! : false) : config.WEB_ORIGIN,
        credentials: true,
        ...(feedback
          ? { allowedHeaders: ['Content-Type', 'X-Feedback-Token'] }
          : {}),
      });
    },
  );
  // Workspace capabilities and private responses must never enter shared caches.
  app.use(
    (
      _request: unknown,
      response: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
  );
  app.enableShutdownHooks();
  return app;
}
