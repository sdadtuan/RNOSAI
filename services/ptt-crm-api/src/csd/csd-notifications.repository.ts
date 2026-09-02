import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CSD_TENANT_ID, CsdNotificationRow } from './csd.types';

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapNotification(row: Record<string, unknown>): CsdNotificationRow {
  return {
    id: text(row.id),
    staff_id: Number(row.staff_id),
    event_key: text(row.event_key),
    title_vi: text(row.title_vi),
    body_vi: text(row.body_vi),
    entity_type: row.entity_type != null ? text(row.entity_type) : null,
    entity_id: row.entity_id != null ? text(row.entity_id) : null,
    severity: text(row.severity) as CsdNotificationRow['severity'],
    read_at: row.read_at ? text(row.read_at) : null,
    created_at: text(row.created_at),
  };
}

@Injectable()
export class CsdNotificationsRepository implements OnModuleDestroy {
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

  async listForStaff(staffId: number, unreadOnly = false, limit = 50): Promise<CsdNotificationRow[]> {
    const params: unknown[] = [CSD_TENANT_ID, staffId];
    let extra = '';
    if (unreadOnly) extra = ' AND read_at IS NULL';
    params.push(Math.min(Math.max(limit, 1), 200));
    const res = await this.db.query(
      `SELECT * FROM csd_notifications
        WHERE tenant_id = $1 AND staff_id = $2 ${extra}
        ORDER BY created_at DESC
        LIMIT $3`,
      params,
    );
    return res.rows.map(mapNotification);
  }

  async countUnread(staffId: number): Promise<number> {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM csd_notifications
        WHERE tenant_id = $1 AND staff_id = $2 AND read_at IS NULL`,
      [CSD_TENANT_ID, staffId],
    );
    return Number(res.rows[0]?.c ?? 0);
  }

  async markRead(id: string, staffId: number): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE csd_notifications
          SET read_at = NOW()
        WHERE tenant_id = $1 AND id = $2 AND staff_id = $3 AND read_at IS NULL
        RETURNING id`,
      [CSD_TENANT_ID, id, staffId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
