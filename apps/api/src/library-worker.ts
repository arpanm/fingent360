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
  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  async deliver() {
    await this.store.transaction(async (client) => {
      if (!(await admitWorker(client, 'reminders'))) return;
      const due = await client.query<{
        id: string;
        user_id: string;
        item_id: string;
        title: string;
      }>(
        "SELECT id,user_id,item_id,title FROM library_reminders WHERE status='pending' AND due_at<=now() ORDER BY due_at,id LIMIT 50 FOR UPDATE SKIP LOCKED",
      );
      for (const row of due.rows) {
        // Serialize with editorial publication so a withdrawal cannot race delivery.
        await client.query(
          'SELECT id FROM discovery_items WHERE id=$1 FOR SHARE',
          [row.item_id],
        );
        const visible = await client.query<{ status: string; title: string }>(
          "SELECT data->>'status' AS status,data->>'title' AS title FROM discovery_versions WHERE item_id=$1 AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1",
          [row.item_id],
        );
        if (visible.rows[0]?.status !== 'published') {
          await client.query(
            "UPDATE library_reminders SET status='cancelled',version=version+1 WHERE id=$1",
            [row.id],
          );
          continue;
        }
        await client.query(
          'INSERT INTO library_notifications(id,user_id,reminder_id,item_id,title) VALUES($1,$2,$3,$4,$5) ON CONFLICT(reminder_id) DO NOTHING',
          [
            randomUUID(),
            row.user_id,
            row.id,
            row.item_id,
            visible.rows[0].title,
          ],
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
