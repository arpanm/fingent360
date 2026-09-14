import { admitPublications } from './publication.js';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AccountStore, STORE } from './accounts.js';
import { admitWorker, recordWorkerObservation } from './worker-control.js';
/** In-app delivery only. Row locks + unique reminder_id make crashed/retried batches atomic. */
@Injectable()
export class LibraryReminderWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      if (!this.running) {
        this.running = this.tick().finally(() => {
          this.running = undefined;
        });
      }
    }, 5000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    // Drain workers before database stores close in application-shutdown hooks.
    await this.onApplicationShutdown();
  }
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  async deliver() {
    await this.store.transaction(async (client) => {
      if (!(await admitWorker(client, 'reminders'))) return;
      // Select a bounded candidate set before claiming work. Lock order matches
      // private edits/deletion: sorted accounts → sorted sources → reminders.
      const candidates = await client.query<{
        id: string;
        user_id: string;
        item_id: string;
      }>(
        "SELECT id,user_id,item_id FROM library_reminders WHERE status='pending' AND due_at<=now() ORDER BY due_at,id LIMIT 50",
      );
      const owners = await client.query<{ id: string }>(
        'SELECT id FROM app_users WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE SKIP LOCKED',
        [candidates.rows.map((row) => row.user_id)],
      );
      const eligible = candidates.rows.filter((row) =>
        owners.rows.some((owner) => owner.id === row.user_id),
      );
      const publications = await admitPublications(
        client,
        eligible.map((row) => row.item_id),
      );
      const due = await client.query<{
        id: string;
        user_id: string;
        item_id: string;
      }>(
        "SELECT id,user_id,item_id FROM library_reminders WHERE id=ANY($1::uuid[]) AND status='pending' AND due_at<=now() ORDER BY due_at,id LIMIT 50 FOR UPDATE SKIP LOCKED",
        [eligible.map((row) => row.id)],
      );
      for (const row of due.rows) {
        const visible = publications.find((item) => item.id === row.item_id);
        if (visible?.status !== 'published') {
          await client.query(
            "UPDATE library_reminders SET status='cancelled',version=version+1 WHERE id=$1",
            [row.id],
          );
          continue;
        }
        await client.query(
          'INSERT INTO library_notifications(id,user_id,reminder_id,item_id,title) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reminder_id) DO NOTHING',
          [randomUUID(), row.user_id, row.id, row.item_id, visible.title],
        );
        await client.query(
          "UPDATE library_reminders SET status='delivered',version=version+1 WHERE id=$1",
          [row.id],
        );
      }
      if (due.rows.length)
        await recordWorkerObservation(client, 'reminders', 'success');
    });
  }
  async tick() {
    try {
      await this.store.transaction((c) =>
        recordWorkerObservation(c, 'reminders', 'heartbeat'),
      );
      await this.deliver();
    } catch {
      await this.store
        .transaction((c) => recordWorkerObservation(c, 'reminders', 'storage'))
        .catch(() => {});
    }
  }
}
