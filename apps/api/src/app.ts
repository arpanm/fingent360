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
    json: (options: { limit: number }) => unknown;
    urlencoded: (options: { limit: number; extended: boolean }) => unknown;
  };
  app.use('/api/v1/ops/equities/import', express.json({ limit: 3_000_000 }));
  app.use('/api/v1/ops/funds/import', express.json({ limit: 10_000_000 }));
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
        (feedback && incoming === 'https://appassets.androidplatform.net');
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
