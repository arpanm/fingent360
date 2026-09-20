import { MongoClient } from 'mongodb';
import pg from 'pg';
import type { Readiness } from '@fingent360/contracts';
import type { AppConfig } from './config.js';

export interface DependencyProbe {
  check(): Promise<Readiness>;
  close(): Promise<void>;
}
export const DEPENDENCY_PROBE = Symbol('DEPENDENCY_PROBE');
export class DatabaseProbe implements DependencyProbe {
  private readonly postgres: pg.Pool;
  private readonly mongo: MongoClient;
  private closing = false;
  private pending: Promise<Readiness> | undefined;
  private shutdown: Promise<void> | undefined;
  constructor(config: AppConfig) {
    this.postgres = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 2000,
      query_timeout: 2000,
      statement_timeout: 2000,
    });
    this.postgres.on('error', () => {
      /* A future readiness probe reports down; never log credentials. */
    });
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      socketTimeoutMS: 2000,
      maxPoolSize: 2,
    });
  }
  check(): Promise<Readiness> {
    if (this.closing) {
      return Promise.resolve({
        status: 'unavailable',
        dependencies: { postgres: 'down', mongodb: 'down' },
      });
    }
    // Readiness polls may overlap. Share one bounded probe rather than queuing
    // another query behind the small readiness pool during an outage.
    this.pending ??= this.probe().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  private async probe(): Promise<Readiness> {
    const [postgres, mongodb] = await Promise.allSettled([
      this.postgres.query('SELECT 1'),
      // Explicit connect is idempotent when connected and repairs a closed
      // topology after an unsuccessful initial connection. Implicit command
      // connection only handles an absent topology in the installed driver.
      this.mongo.connect().then((client) => client.db().command({ ping: 1 })),
    ]);
    const pgUp = postgres.status === 'fulfilled';
    const mongoUp = mongodb.status === 'fulfilled';
    return {
      status: pgUp && mongoUp ? 'ready' : 'unavailable',
      dependencies: {
        postgres: pgUp ? 'up' : 'down',
        mongodb: mongoUp ? 'up' : 'down',
      },
    };
  }
  close(): Promise<void> {
    this.closing = true;
    this.shutdown ??= this.finishShutdown();
    return this.shutdown;
  }
  private async finishShutdown(): Promise<void> {
    // Do not let an in-flight connect reopen the client after shutdown.
    await this.pending;
    await Promise.allSettled([this.postgres.end(), this.mongo.close()]);
  }
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
