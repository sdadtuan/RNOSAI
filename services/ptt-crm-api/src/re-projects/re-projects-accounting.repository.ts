import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class ReProjectsAccountingRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  async ensureAccountingSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.db.query(`
        CREATE TABLE IF NOT EXISTS crm_re_project_cash_flow_lines (
          id BIGSERIAL PRIMARY KEY,
          project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
          flow_type TEXT NOT NULL DEFAULT 'outflow', category TEXT NOT NULL DEFAULT 'other',
          sub_category TEXT NOT NULL DEFAULT '', line_item TEXT NOT NULL DEFAULT '',
          amount_vnd BIGINT NOT NULL DEFAULT 0, period_month TEXT NOT NULL DEFAULT '',
          transaction_date TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT '',
          paid_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned',
          source_type TEXT NOT NULL DEFAULT 'manual', source_ref TEXT NOT NULL DEFAULT '',
          counterparty TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT ''
        );
        ALTER TABLE crm_re_project_budget_lines ADD COLUMN IF NOT EXISTS sub_category TEXT NOT NULL DEFAULT '';
        ALTER TABLE crm_re_project_budget_lines ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
        ALTER TABLE crm_re_project_budget_lines ADD COLUMN IF NOT EXISTS source_ref TEXT NOT NULL DEFAULT '';
        CREATE INDEX IF NOT EXISTS idx_crm_re_cash_flow_project
          ON crm_re_project_cash_flow_lines(project_id,period_month,status);
        CREATE INDEX IF NOT EXISTS idx_crm_re_cash_flow_category
          ON crm_re_project_cash_flow_lines(project_id,category,flow_type);
      `).then(() => undefined);
    }
    await this.schemaReady;
  }

  async queryCashFlowRows(
    projectId: number,
    filters: { flow_type?: string; category?: string; status?: string },
  ): Promise<Array<Record<string, unknown>>> {
    await this.ensureAccountingSchema();
    const clauses = ['project_id=$1'];
    const params: unknown[] = [projectId];
    for (const [column, value] of Object.entries(filters)) {
      if (!value) continue;
      params.push(value);
      clauses.push(`${column}=$${params.length}`);
    }
    const result = await this.db.query(
      `SELECT * FROM crm_re_project_cash_flow_lines WHERE ${clauses.join(' AND ')}
       ORDER BY COALESCE(NULLIF(transaction_date,''),period_month) DESC,id DESC`,
      params,
    );
    return result.rows;
  }

  async getCashFlowRow(lineId: number): Promise<Record<string, unknown> | undefined> {
    await this.ensureAccountingSchema();
    return (await this.db.query('SELECT * FROM crm_re_project_cash_flow_lines WHERE id=$1', [lineId])).rows[0];
  }

  async insertCashFlowLine(projectId: number, fields: Array<string | number>, ts: string): Promise<number> {
    await this.ensureAccountingSchema();
    const result = await this.db.query(
      `INSERT INTO crm_re_project_cash_flow_lines(project_id,flow_type,category,sub_category,line_item,
       amount_vnd,period_month,transaction_date,due_date,paid_date,status,source_type,source_ref,
       counterparty,notes,created_by,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) RETURNING id`,
      [projectId, ...fields, ts],
    );
    return Number(result.rows[0].id);
  }

  async updateCashFlowLine(projectId: number, lineId: number, fields: Array<string | number>, ts: string): Promise<void> {
    await this.ensureAccountingSchema();
    await this.db.query(
      `UPDATE crm_re_project_cash_flow_lines SET flow_type=$1,category=$2,sub_category=$3,
       line_item=$4,amount_vnd=$5,period_month=$6,transaction_date=$7,due_date=$8,paid_date=$9,
       status=$10,source_type=$11,source_ref=$12,counterparty=$13,notes=$14,updated_at=$15
       WHERE id=$16 AND project_id=$17`,
      [...fields, ts, lineId, projectId],
    );
  }

  async deleteCashFlowLine(projectId: number, lineId: number): Promise<void> {
    await this.ensureAccountingSchema();
    await this.db.query('DELETE FROM crm_re_project_cash_flow_lines WHERE id=$1 AND project_id=$2', [lineId, projectId]);
  }

  async findCashFlowBySourceRef(projectId: number, sourceRef: string): Promise<{ id: number } | undefined> {
    await this.ensureAccountingSchema();
    const row = (await this.db.query(
      'SELECT id FROM crm_re_project_cash_flow_lines WHERE project_id=$1 AND source_ref=$2', [projectId, sourceRef],
    )).rows[0];
    return row ? { id: Number(row.id) } : undefined;
  }

  async findBudgetBySourceRef(projectId: number, sourceRef: string): Promise<{ id: number; planned_vnd: number } | undefined> {
    await this.ensureAccountingSchema();
    const row = (await this.db.query(
      'SELECT id,planned_vnd FROM crm_re_project_budget_lines WHERE project_id=$1 AND source_ref=$2', [projectId, sourceRef],
    )).rows[0];
    return row ? { id: Number(row.id), planned_vnd: Number(row.planned_vnd) } : undefined;
  }

  async upsertBudgetByRef(projectId: number, data: {
    category: string; lineItem: string; plannedVnd: number; sourceRef: string;
    sourceType?: string; subCategory?: string;
  }, ts: string): Promise<['created' | 'updated' | 'skipped', number]> {
    const ref = String(data.sourceRef ?? '').trim();
    if (!ref) return ['skipped', 0];
    const existing = await this.findBudgetBySourceRef(projectId, ref);
    if (existing) {
      if (existing.planned_vnd === Number(data.plannedVnd)) return ['skipped', existing.id];
      await this.db.query(
        `UPDATE crm_re_project_budget_lines SET category=$1,line_item=$2,planned_vnd=$3,
         source_type=$4,sub_category=$5,updated_at=$6 WHERE id=$7 AND project_id=$8`,
        [data.category, data.lineItem.slice(0, 200), Number(data.plannedVnd), data.sourceType ?? 'plan_sync',
          (data.subCategory ?? '').slice(0, 40), ts, existing.id, projectId],
      );
      return ['updated', existing.id];
    }
    const saved = await this.db.query(
      `INSERT INTO crm_re_project_budget_lines(project_id,category,line_item,period_month,planned_vnd,
       actual_vnd,notes,sub_category,source_type,source_ref,created_at,updated_at)
       VALUES($1,$2,$3,'',$4,0,'',$5,$6,$7,$8,$8) RETURNING id`,
      [projectId, data.category, data.lineItem.slice(0, 200), Number(data.plannedVnd),
        (data.subCategory ?? '').slice(0, 40), data.sourceType ?? 'plan_sync', ref, ts],
    );
    return ['created', Number(saved.rows[0].id)];
  }

  async updateBudgetActual(projectId: number, budgetId: number, actualVnd: number, lineItem: string, ts: string): Promise<void> {
    await this.ensureAccountingSchema();
    await this.db.query(
      'UPDATE crm_re_project_budget_lines SET actual_vnd=$1,line_item=$2,updated_at=$3 WHERE id=$4 AND project_id=$5',
      [actualVnd, lineItem.slice(0, 200), ts, budgetId, projectId],
    );
  }

  async insertInventoryBudgetLine(projectId: number, lineItem: string, period: string, actualVnd: number, ts: string): Promise<void> {
    await this.ensureAccountingSchema();
    await this.db.query(
      `INSERT INTO crm_re_project_budget_lines(project_id,category,line_item,period_month,planned_vnd,
       actual_vnd,notes,sub_category,source_type,source_ref,created_at,updated_at)
       VALUES($1,'revenue',$2,$3,0,$4,'','','inventory','inventory:revenue',$5,$5)`,
      [projectId, lineItem.slice(0, 200), period, actualVnd, ts],
    );
  }

  nowTs(): string {
    return catalogTs();
  }
}
