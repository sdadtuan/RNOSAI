import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  KPI_GROUPS_TENANT_ID,
  type KpiGroupAuditQuery,
  type KpiGroupAuditRow,
} from './kpi-groups.types';

export type KpiGroupAuditInsert = {
  entity_id: string;
  action: string;
  before_json?: Record<string, unknown> | null;
  after_json?: Record<string, unknown> | null;
  performed_by_staff_id: number;
  ip_address?: string | null;
  request_id?: string | null;
};

@Injectable()
export class KpiGroupAuditRepository implements OnModuleDestroy {
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

  async insert(input: KpiGroupAuditInsert): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_kpi_group_audit_logs (
         tenant_id, entity_id, action, before_json, after_json,
         performed_by_staff_id, ip_address, request_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        KPI_GROUPS_TENANT_ID,
        input.entity_id,
        input.action,
        input.before_json ?? null,
        input.after_json ?? null,
        input.performed_by_staff_id,
        input.ip_address ?? null,
        input.request_id ?? null,
      ],
    );
  }

  async listByEntity(
    entityId: string,
    query: KpiGroupAuditQuery,
  ): Promise<{ rows: KpiGroupAuditRow[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = [20, 50, 100].includes(Number(query.page_size))
      ? Number(query.page_size)
      : 20;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM crm_kpi_group_audit_logs
       WHERE tenant_id = $1 AND entity_id = $2`,
      [KPI_GROUPS_TENANT_ID, entityId],
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const result = await this.db.query(
      `SELECT a.*, s.name AS performed_by_name
       FROM crm_kpi_group_audit_logs a
       LEFT JOIN crm_staff s ON s.id = a.performed_by_staff_id
       WHERE a.tenant_id = $1 AND a.entity_id = $2
       ORDER BY a.performed_at DESC
       LIMIT $3 OFFSET $4`,
      [KPI_GROUPS_TENANT_ID, entityId, pageSize, offset],
    );

    const rows = (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      entity_id: String(row.entity_id),
      action: String(row.action),
      before_json: (row.before_json as Record<string, unknown> | null) ?? null,
      after_json: (row.after_json as Record<string, unknown> | null) ?? null,
      performed_by_staff_id: Number(row.performed_by_staff_id),
      performed_by_name: row.performed_by_name != null ? String(row.performed_by_name) : null,
      performed_at: new Date(String(row.performed_at)).toISOString(),
      ip_address: row.ip_address != null ? String(row.ip_address) : null,
      request_id: row.request_id != null ? String(row.request_id) : null,
    }));

    return { rows, total };
  }
}
