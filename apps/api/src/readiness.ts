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
  async check(): Promise<Readiness> {
    const [postgres, mongodb] = await Promise.allSettled([
      this.postgres.query('SELECT 1'),
      this.mongo.db().command({ ping: 1 }),
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
  async close(): Promise<void> {
    await Promise.allSettled([this.postgres.end(), this.mongo.close()]);
  }
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
