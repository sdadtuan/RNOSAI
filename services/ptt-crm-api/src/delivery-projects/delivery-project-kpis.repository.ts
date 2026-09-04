import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';

export type DeliveryProjectKpiRow = {
  id: string;
  project_id: string;
  dictionary_id: string;
  dictionary_code: string;
  dictionary_name: string;
  kpi_version_id: string | null;
  target_id: string | null;
  cycle: string;
  owner_staff_id: number | null;
  baseline: string | null;
  warning_value: string | null;
  critical_value: string | null;
  inherit_alert: boolean;
  created_at: string;
  updated_at: string;
};

function mapRow(raw: Record<string, unknown>): DeliveryProjectKpiRow {
  return {
    id: String(raw.id),
    project_id: String(raw.project_id),
    dictionary_id: String(raw.dictionary_id),
    dictionary_code: String(raw.dictionary_code ?? ''),
    dictionary_name: String(raw.dictionary_name ?? ''),
    kpi_version_id: raw.kpi_version_id != null ? String(raw.kpi_version_id) : null,
    target_id: raw.target_id != null ? String(raw.target_id) : null,
    cycle: String(raw.cycle ?? 'MONTH'),
    owner_staff_id: raw.owner_staff_id != null ? Number(raw.owner_staff_id) : null,
    baseline: raw.baseline != null ? String(raw.baseline) : null,
    warning_value: raw.warning_value != null ? String(raw.warning_value) : null,
    critical_value: raw.critical_value != null ? String(raw.critical_value) : null,
    inherit_alert: Boolean(raw.inherit_alert ?? true),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
}

const SELECT_KPI = `
  SELECT k.id::text,
         k.project_id::text,
         k.dictionary_id::text,
         d.code AS dictionary_code,
         d.name AS dictionary_name,
         k.kpi_version_id::text,
         k.target_id::text,
         k.cycle,
         k.owner_staff_id,
         k.baseline::text,
         k.warning_value::text,
         k.critical_value::text,
         k.inherit_alert,
         k.created_at::text,
         k.updated_at::text
  FROM crm_delivery_project_kpis k
  LEFT JOIN crm_kpi_dictionary d ON d.id = k.dictionary_id
`;

@Injectable()
export class DeliveryProjectKpisRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if ('query' in this.config && !('databaseUrl' in this.config)) {
      return this.config as unknown as Pool;
    }
    if (!this.pool) {
      this.pool = new Pool({ connectionString: (this.config as AppConfigService).databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async tablesReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_delivery_project_kpis' LIMIT 1`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async list(projectId: string): Promise<DeliveryProjectKpiRow[]> {
    const result = await this.db.query(
      `${SELECT_KPI} WHERE k.project_id = $1::uuid AND k.deleted_at IS NULL ORDER BY d.code ASC`,
      [projectId],
    );
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async listDictionaryIds(projectId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT dictionary_id::text FROM crm_delivery_project_kpis
       WHERE project_id = $1::uuid AND deleted_at IS NULL`,
      [projectId],
    );
    return result.rows.map((r) => String((r as { dictionary_id: string }).dictionary_id));
  }

  async addMany(
    projectId: string,
    rows: Array<{
      dictionary_id: string;
      kpi_version_id?: string | null;
      target_id?: string | null;
      inherit_alert?: boolean;
    }>,
  ): Promise<DeliveryProjectKpiRow[]> {
    const inserted: DeliveryProjectKpiRow[] = [];
    for (const row of rows) {
      const result = await this.db.query(
        `INSERT INTO crm_delivery_project_kpis (
           project_id, dictionary_id, kpi_version_id, target_id, inherit_alert
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, COALESCE($5, true))
         RETURNING id::text`,
        [
          projectId,
          row.dictionary_id,
          row.kpi_version_id ?? null,
          row.target_id ?? null,
          row.inherit_alert ?? true,
        ],
      );
      const id = String((result.rows[0] as { id: string }).id);
      const list = await this.db.query(`${SELECT_KPI} WHERE k.id = $1::uuid LIMIT 1`, [id]);
      const mapped = list.rows[0] as Record<string, unknown> | undefined;
      if (mapped) inserted.push(mapRow(mapped));
    }
    return inserted;
  }
}
