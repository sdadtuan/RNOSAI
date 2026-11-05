import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { isMissingRelationError, kpiHubMemory, markPgActive, withDbFallback } from '../kpi-hub.memory-store';
import { KPI_HUB_DEFAULT_WORKSPACE_ID, KPI_HUB_TENANT_ID, type HubNotificationRow } from '../kpi-hub.types';

@Injectable()
export class KpiHubNotificationsRepository implements OnModuleDestroy {
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

  async list(staffId: number, unreadOnly: boolean): Promise<HubNotificationRow[]> {
    return withDbFallback(async () => {
      const params: unknown[] = [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, staffId];
      let where = 'tenant_id = $1 AND workspace_id = $2::uuid AND staff_id = $3';
      if (unreadOnly) where += ' AND read_at IS NULL';
      const res = await this.db.query(
        `SELECT id, staff_id, level, title, body, link, read_at, created_at
         FROM crm_kpi_notifications WHERE ${where}
         ORDER BY created_at DESC LIMIT 100`,
        params,
      );
      markPgActive();
      return res.rows.map((r) => this.mapRow(r as Record<string, unknown>));
    }, () => {
      let items = kpiHubMemory.notifications.filter((n) => n.staff_id === staffId);
      if (unreadOnly) items = items.filter((n) => !n.read_at);
      return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  }

  async create(row: Omit<HubNotificationRow, 'id' | 'created_at' | 'read_at'>): Promise<HubNotificationRow> {
    return withDbFallback(async () => {
      const id = randomUUID();
      const res = await this.db.query(
        `INSERT INTO crm_kpi_notifications (id, tenant_id, workspace_id, staff_id, level, title, body, link)
         VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8)
         RETURNING id, staff_id, level, title, body, link, read_at, created_at`,
        [id, KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, row.staff_id, row.level, row.title, row.body, row.link],
      );
      markPgActive();
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => {
      const created: HubNotificationRow = {
        id: randomUUID(),
        ...row,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      kpiHubMemory.notifications.unshift(created);
      return created;
    });
  }

  async markRead(id: string, staffId: number): Promise<HubNotificationRow | null> {
    return withDbFallback(async () => {
      const res = await this.db.query(
        `UPDATE crm_kpi_notifications SET read_at = NOW()
         WHERE id = $1::uuid AND staff_id = $2 AND tenant_id = $3
         RETURNING id, staff_id, level, title, body, link, read_at, created_at`,
        [id, staffId, KPI_HUB_TENANT_ID],
      );
      if (res.rows.length === 0) return null;
      markPgActive();
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => {
      const idx = kpiHubMemory.notifications.findIndex((n) => n.id === id && n.staff_id === staffId);
      if (idx < 0) return null;
      kpiHubMemory.notifications[idx] = {
        ...kpiHubMemory.notifications[idx],
        read_at: new Date().toISOString(),
      };
      return { ...kpiHubMemory.notifications[idx] };
    });
  }

  private mapRow(row: Record<string, unknown>): HubNotificationRow {
    return {
      id: String(row.id),
      staff_id: Number(row.staff_id),
      level: String(row.level) as HubNotificationRow['level'],
      title: String(row.title),
      body: row.body != null ? String(row.body) : null,
      link: row.link != null ? String(row.link) : null,
      read_at: row.read_at != null ? new Date(String(row.read_at)).toISOString() : null,
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }
}
