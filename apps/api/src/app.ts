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
import { GoalsController } from './goals.js';
import { PrivacyController } from './privacy.js';
import { SourcesController, sourcesProvider } from './sources.js';
import { AlertPreferencesController } from './alert-preferences.js';
import { HoldingsController } from './holdings.js';
import { OverviewController } from './overview.js';

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
        JourneyController,
        MacroController,
        AccountController,
        GoalsController,
        PrivacyController,
        SourcesController,
        AlertPreferencesController,
        HoldingsController,
        OverviewController,
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
        journeyProvider(config),
        macroProvider(config),
        accountProvider(config),
        discoveryProvider(config),
        operatorProvider(config),
        LibraryReminderWorker,
        mediaProvider(config),
        sourcesProvider(config),
        assistanceProvider(config),
      ],
    },
    { logger: ['error', 'warn', 'log'] },
  );
  // The Express adapter mounts its not-found router with this exact prefix.
  app.setGlobalPrefix('/api/v1');
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: true });
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
