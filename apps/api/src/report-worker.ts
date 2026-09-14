import { Inject, Injectable } from '@nestjs/common';
import { ReportsStore } from './reports.js';
import { ReportSchedulesStore } from './report-schedules.js';
@Injectable()
export class ReportWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<void> | undefined;
  constructor(
    @Inject(ReportsStore) private readonly store: ReportsStore,
    @Inject(ReportSchedulesStore)
    private readonly schedules: ReportSchedulesStore,
  ) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.tick().finally(() => {
          this.active = undefined;
        });
    }, 2000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    // Drain workers before database stores close in application-shutdown hooks.
    await this.onApplicationShutdown();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
  async tick() {
    try {
      await this.store.observe('heartbeat');
      await this.schedules.workOne();
      await this.store.workOne();
    } catch {
      await this.store.observe('storage').catch(() => {});
    }
  }
}
