import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { buildWorkspaceFixture } from '../kpi-hub.fixtures';
import { isMissingRelationError, kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import {
  KPI_HUB_DEFAULT_WORKSPACE_ID,
  KPI_HUB_TENANT_ID,
  type HubWorkspaceRow,
  type PatchHubWorkspaceBody,
} from '../kpi-hub.types';

@Injectable()
export class KpiHubWorkspaceRepository implements OnModuleDestroy {
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

  private mapRow(row: Record<string, unknown>): HubWorkspaceRow {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      name: String(row.name),
      company: String(row.company ?? ''),
      logo_url: row.logo_url != null ? String(row.logo_url) : null,
      timezone: String(row.timezone ?? 'Asia/Ho_Chi_Minh'),
      locale: String(row.locale ?? 'vi'),
      currency: String(row.currency ?? 'VND'),
      week_start: String(row.week_start ?? 'MONDAY'),
      default_period_grain: String(row.default_period_grain ?? 'MONTH') as HubWorkspaceRow['default_period_grain'],
      close_day: Number(row.close_day ?? 3),
      reconcile_day: Number(row.reconcile_day ?? 5),
      lock_closed_periods: Boolean(row.lock_closed_periods),
      allow_reopen: Boolean(row.allow_reopen),
      require_kpi_approval: Boolean(row.require_kpi_approval),
      auto_quality: Boolean(row.auto_quality),
      alerts_enabled: Boolean(row.alerts_enabled),
      maintenance_mode: Boolean(row.maintenance_mode),
      row_version: Number(row.row_version ?? 1),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async get(): Promise<HubWorkspaceRow> {
    return withDbFallback(async () => {
      const res = await this.db.query(
        `SELECT * FROM crm_kpi_hub_workspaces
         WHERE tenant_id = $1 AND id = $2::uuid AND deleted_at IS NULL
         LIMIT 1`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID],
      );
      if (res.rows.length === 0) return null;
      kpiHubMemory.useDb = true;
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => kpiHubMemory.workspace);
  }

  async patch(body: PatchHubWorkspaceBody, rowVersion: number): Promise<HubWorkspaceRow | null> {
    return withDbFallback(async () => {
      const fields: string[] = [];
      const values: unknown[] = [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, rowVersion];
      let idx = 4;
      for (const [key, val] of Object.entries(body)) {
        if (val !== undefined) {
          fields.push(`${key} = $${idx}`);
          values.push(val);
          idx += 1;
        }
      }
      if (fields.length === 0) return this.get();
      fields.push('updated_at = NOW()', 'row_version = row_version + 1');
      const res = await this.db.query(
        `UPDATE crm_kpi_hub_workspaces SET ${fields.join(', ')}
         WHERE tenant_id = $1 AND id = $2::uuid AND row_version = $3 AND deleted_at IS NULL
         RETURNING *`,
        values,
      );
      if (res.rows.length === 0) return null;
      kpiHubMemory.useDb = true;
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => {
      if (kpiHubMemory.workspace.row_version !== rowVersion) return null;
      kpiHubMemory.workspace = {
        ...kpiHubMemory.workspace,
        ...body,
        updated_at: new Date().toISOString(),
        row_version: rowVersion + 1,
      };
      return kpiHubMemory.workspace;
    });
  }

  async ensureSeed(): Promise<void> {
    try {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM crm_kpi_hub_workspaces WHERE tenant_id = $1`,
        [KPI_HUB_TENANT_ID],
      );
      if (Number(res.rows[0]?.c) > 0) {
        kpiHubMemory.useDb = true;
        return;
      }
      const ws = buildWorkspaceFixture();
      await this.db.query(
        `INSERT INTO crm_kpi_hub_workspaces (
          id, tenant_id, name, company, timezone, locale, currency, week_start,
          default_period_grain, close_day, reconcile_day, lock_closed_periods,
          allow_reopen, require_kpi_approval, auto_quality, alerts_enabled, maintenance_mode
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) ON CONFLICT (id) DO NOTHING`,
        [
          ws.id,
          ws.tenant_id,
          ws.name,
          ws.company,
          ws.timezone,
          ws.locale,
          ws.currency,
          ws.week_start,
          ws.default_period_grain,
          ws.close_day,
          ws.reconcile_day,
          ws.lock_closed_periods,
          ws.allow_reopen,
          ws.require_kpi_approval,
          ws.auto_quality,
          ws.alerts_enabled,
          ws.maintenance_mode,
        ],
      );
      kpiHubMemory.useDb = true;
    } catch (err) {
      if (!isMissingRelationError(err)) throw err;
    }
  }
}
