import { decryptIssuedReport } from './private-reports.js';
import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  NotFoundException,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  compareRecordReports,
  RecordReportSchema,
  reportComparisonReference,
  ReportComparisonOptionsSchema,
  ReportComparisonQuerySchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';

@Injectable()
export class ReportComparisonStore {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  async options(cookie?: string) {
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      const found = await c.query(
        "SELECT j.id,r.payload,r.encrypted_payload FROM record_report_jobs j JOIN record_reports r ON r.job_id=j.id WHERE j.user_id=$1 AND j.status='succeeded' ORDER BY j.requested_at DESC,j.id LIMIT 100",
        [user.id],
      );
      try {
        for (const row of found.rows) {
          row.payload = await decryptIssuedReport(
            c,
            user.id,
            row.id,
            row.payload,
            row.encrypted_payload,
            this.account.privateDataKeys,
          );
        }
        return ReportComparisonOptionsSchema.parse({
          reports: found.rows.map((r) => {
            const report = RecordReportSchema.parse(r.payload);
            if (report.id !== r.id) throw Error('Mismatched original.');
            return reportComparisonReference(report);
          }),
        });
      } catch {
        throw new ServiceUnavailableException(
          'An issued original is unreadable. Try again later.',
        );
      }
    });
  }
  async compare(query: unknown, cookie?: string) {
    const parsed = ReportComparisonQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException(
        'Choose two different valid issued report IDs; extra query fields are not supported.',
      );
    return this.account.transaction(async (c) => {
      const user = await this.account.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.account.require(c, cookie);
      // Deletion/reset use account-first order; workers may still hold jobs. Reauthorize after that final wait.
      const jobs = await c.query(
        'SELECT id,status FROM record_report_jobs WHERE user_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE',
        [user.id, [parsed.data.first, parsed.data.second]],
      );
      await this.account.require(c, cookie);
      if (jobs.rows.length !== 2)
        throw new NotFoundException(
          'One or both reports are unavailable. Choose two owned issued reports.',
        );
      if (jobs.rows.some((r) => r.status !== 'succeeded'))
        throw new ConflictException(
          'Both reports must be issued. Open Reports to check preparation.',
        );
      const originals = await c.query(
        'SELECT job_id,payload,encrypted_payload FROM record_reports WHERE job_id=ANY($1::uuid[]) ORDER BY job_id',
        [[parsed.data.first, parsed.data.second]],
      );
      if (originals.rows.length !== 2)
        throw new ConflictException(
          'Both reports must have an issued original.',
        );
      try {
        for (const row of originals.rows) {
          row.payload = await decryptIssuedReport(
            c,
            user.id,
            row.job_id,
            row.payload,
            row.encrypted_payload,
            this.account.privateDataKeys,
          );
        }
        const reports = originals.rows.map((r) => {
          const report = RecordReportSchema.parse(r.payload);
          if (report.id !== r.job_id) throw Error('Mismatched original.');
          return report;
        });
        return compareRecordReports(
          reports[0]!,
          reports[1]!,
          new Date().toISOString(),
        );
      } catch {
        throw new ServiceUnavailableException(
          'An issued original is unreadable. Try again later.',
        );
      }
    });
  }
}
@Controller('account/report-comparison')
export class ReportComparisonController {
  constructor(
    @Inject(ReportComparisonStore)
    private readonly store: ReportComparisonStore,
  ) {}
  @Get('options') options(@Headers('cookie') cookie?: string) {
    return this.store.options(cookie);
  }
  @Get() compare(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    return this.store.compare(query, cookie);
  }
}
