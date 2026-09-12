import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export const CP_WEAVE_QUERY = 'CP_WEAVE_QUERY';

export interface CpWeaveQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

@Injectable()
export class CpWeaveRepository implements CpWeaveQueryPort, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}
