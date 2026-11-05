import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export const QT_TENANT_ID = 'PTT';
export const QT_SETTINGS_QUERY = 'QT_SETTINGS_QUERY';

export interface QuoteSettingsQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
  withTransaction?<T>(
    fn: (
      query: QuoteSettingsQueryPort['query'],
    ) => Promise<T>,
  ): Promise<T>;
}

@Injectable()
export class QuoteSettingsRepository
  implements QuoteSettingsQueryPort, OnModuleDestroy
{
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  async withTransaction<T>(
    fn: (query: QuoteSettingsQueryPort['query']) => Promise<T>,
  ): Promise<T> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn((sql, params) => client.query(sql, params));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection may already be broken */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}
