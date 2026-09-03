import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { IWR_TENANT_ID } from './iwr.types';

@Injectable()
export class IwrLeaveAdapter implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async isOnLeave(staffId: number, ymd: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1
         FROM staff_leave_requests slr
         JOIN crm_staff cs ON lower(trim(cs.email)) = lower(trim(slr.staff_email))
        WHERE cs.id = $1
          AND cs.active = TRUE
          AND slr.status = 'approved'
          AND $2::date BETWEEN slr.date_from AND slr.date_to
        LIMIT 1`,
      [staffId, ymd],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
