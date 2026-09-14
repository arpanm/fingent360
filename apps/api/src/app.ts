import {
  ReportSchedulesController,
  ReportSchedulesStore,
} from './report-schedules.js';
import { createRequire } from 'node:module';
import {
  FeedbackController,
  OpsFeedbackController,
  feedbackProvider,
} from './feedback.js';
import { MediaController, OpsMediaController, mediaProvider } from './media.js';
import { AssistanceController, assistanceProvider } from './assistance.js';
import {
  DiscoveryController,
  OpsDiscoveryController,
  discoveryProvider,
} from './discovery.js';
import { OperatorController, operatorProvider } from './operator.js';
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
        WorkerHealthController,
        FeedbackController,
        OpsFeedbackController,
        JourneyController,
        MacroController,
        AccountController,
        GoalsController,
        GoalScenariosController,
        ConnectionReviewsController,
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
        ReportComparisonController,
        SecuritiesController,
        OpsSecuritiesController,
        AssistanceController,
        DiscoveryController,
        OpsDiscoveryController,
        OperatorController,
        OpsLegacyController,
        LibraryController,
        LearningController,
        AccountLearningController,
        MediaController,
        OpsMediaController,
      ],
      providers: [
        { provide: DEPENDENCY_PROBE, useValue: probe },
        feedbackProvider(config),
        journeyProvider(config),
        macroProvider(config),
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
        WorkerHealthStore,
        mediaProvider(config),
        sourcesProvider(config),
        assistanceProvider(config),
      ],
    },
    { logger: ['error', 'warn', 'log'], bodyParser: false },
  );
  // The Express adapter mounts its not-found router with this exact prefix.
  app.setGlobalPrefix('/api/v1');
  // Parse only feedback with the larger explicit upload bound. Other routes retain Nest's default.
  const requireExpress = createRequire(
    import.meta.resolve('@nestjs/platform-express'),
  );
  const express = requireExpress('express') as {
    json: (options: { limit: number }) => unknown;
    urlencoded: (options: { limit: number; extended: boolean }) => unknown;
  };
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
