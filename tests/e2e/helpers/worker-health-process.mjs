// Selected isolated tests only. IPC returns booleans, never private work payloads.
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../../../apps/api/package.json', import.meta.url),
);
require('reflect-metadata');
let account, reports, reminders, reportWorker, schedules, claim;
let chain = Promise.resolve();
async function command(message) {
  if (message.action === 'start') {
    const url = new URL(message.databaseUrl);
    if (
      !/^e2e_feedback_[a-f0-9]{32}$/.test(message.schema) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.searchParams.get('options') !== `-c search_path=${message.schema}`
    )
      throw Error('Unowned worker database.');
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: message.databaseUrl, max: 1 });
    let schedulesEnabled;
    try {
      if (
        (await pool.query('SELECT current_schema() AS schema')).rows[0]
          ?.schema !== message.schema
      )
        throw Error('Unowned schema.');
      schedulesEnabled = (
        await pool.query(
          "SELECT to_regclass(format('%I.report_schedules',current_schema())) IS NOT NULL AS enabled",
        )
      ).rows[0].enabled;
    } finally {
      await pool.end();
    }
    const { AccountStore } = await import('../../../apps/api/dist/accounts.js');
    const { ReportsStore } = await import('../../../apps/api/dist/reports.js');
    const { LibraryReminderWorker } =
      await import('../../../apps/api/dist/library-worker.js');
    const { ReportWorker } =
      await import('../../../apps/api/dist/report-worker.js');
    account = new AccountStore({ DATABASE_URL: message.databaseUrl });
    reports = new ReportsStore(account);
    reminders = new LibraryReminderWorker(account);
    if (schedulesEnabled) {
      const { ReportSchedulesStore } =
        await import('../../../apps/api/dist/report-schedules.js');
      schedules = new ReportSchedulesStore(account);
    }
    // Optional schedule integration supplies the second worker dependency later.
    reportWorker = new ReportWorker(reports, schedules);
    return true;
  }
  if (!account) throw Error('Worker not initialized.');
  if (message.action === 'material') {
    const { MaterialWorker } =
      await import('../../../apps/api/dist/material-worker.js');
    return new MaterialWorker(account).workOne();
  }
  if (message.action === 'claim') {
    claim = await reports.claim();
    return !!claim;
  }
  if (message.action === 'finish') {
    if (!claim) throw Error('No actual claim.');
    const { issueRecordReport, ReportSnapshotSchema } =
      await import('../../../packages/contracts/dist/index.js');
    await reports.finish(
      claim.id,
      claim.lease,
      issueRecordReport(
        claim.id,
        claim.label,
        ReportSnapshotSchema.parse(claim.snapshot),
        new Date().toISOString(),
      ),
    );
    claim = undefined;
    return true;
  }
  if (message.action === 'work') return reports.workOne();
  if (message.action === 'schedule') {
    if (!schedules) throw Error('Scheduling not enabled.');
    return schedules.workOne();
  }
  if (message.action === 'reminders') {
    await reminders.deliver();
    return true;
  }
  if (message.action === 'tick-report') {
    await reportWorker.tick();
    return true;
  }
  if (message.action === 'tick-reminders') {
    await reminders.tick();
    return true;
  }
  if (message.action === 'close') {
    await account.onApplicationShutdown();
    account = undefined;
    return true;
  }
  throw Error('Unsupported isolated worker action.');
}
process.on('message', (message) => {
  chain = chain.then(async () => {
    try {
      const result = await command(message);
      process.send?.({ id: message.id, result });
    } catch {
      process.send?.({
        id: message.id,
        error:
          'Owned worker operation failed. No private error details are recorded.',
      });
    }
    if (message.action === 'close') process.disconnect();
  });
});
process.on('disconnect', () => {
  void chain.then(async () => {
    await account?.onApplicationShutdown();
    process.exit(0);
  });
});
