import { Inject, Injectable } from '@nestjs/common';
import { ReportsStore } from './reports.js';
@Injectable()
export class ReportWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private active: Promise<void> | undefined;
  constructor(@Inject(ReportsStore) private readonly store: ReportsStore) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.store
          .workOne()
          .then(() => {})
          .catch(() => {
            /* Missing migration or temporary storage failure retries next interval. */
          })
          .finally(() => {
            this.active = undefined;
          });
    }, 2000);
    this.timer.unref();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
