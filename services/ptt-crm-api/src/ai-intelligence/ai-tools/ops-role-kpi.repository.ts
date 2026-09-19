import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import {
  isRoleKpiStatus,
  OpsRoleKpiTargetRow,
  RoleKpiStatus,
} from './ops-kpi-target.types';

export type OpsRoleKpiInsert = {
  plan_id?: number | null;
  lifecycle_id?: number | null;
  client_id?: string | null;
  campaign_id?: number | null;
  role_key: string;
  kpi_key: string;
  kpi_label: string;
  period_start?: string | null;
  period_end?: string | null;
  target_value?: number | null;
  target_unit: string;
  status: RoleKpiStatus;
  owner_staff_id?: string | null;
  form_data: Record<string, unknown>;
  notes?: string;
  upsert_key?: string | null;
};

export type OpsRoleKpiPatch = {
  kpi_label?: string;
  period_start?: string | null;
  period_end?: string | null;
  target_value?: number | null;
  target_unit?: string;
  owner_staff_id?: string | null;
  form_data?: Record<string, unknown>;
  notes?: string;
  status?: RoleKpiStatus;
};

export type OpsRoleKpiListFilter = {
  plan_id?: number;
  lifecycle_id?: number;
  client_id?: string;
  role_key?: string;
  status?: string;
  limit?: number;
};

@Injectable()
export class OpsRoleKpiRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private ensured = false;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
  }

  async ensureSchema(): Promise<void> {
    if (this.ensured) return;
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_role_kpi_targets (
        id              BIGSERIAL PRIMARY KEY,
        plan_id         INTEGER NULL,
        lifecycle_id    INTEGER NULL,
        client_id       UUID NULL,
        campaign_id     INTEGER NULL,
        role_key        TEXT NOT NULL,
        kpi_key         TEXT NOT NULL,
        kpi_label       TEXT NOT NULL DEFAULT '',
        period_start    DATE NULL,
        period_end      DATE NULL,
        target_value    NUMERIC NULL,
        target_unit     TEXT NOT NULL DEFAULT 'count',
        actual_value    NUMERIC NULL,
        status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'review', 'approved', 'locked', 'cancelled')),
        owner_staff_id  TEXT NULL,
        form_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
        notes           TEXT NOT NULL DEFAULT '',
        upsert_key      TEXT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crm_role_kpi_targets_plan_role
        ON crm_role_kpi_targets (plan_id, role_key);
      CREATE INDEX IF NOT EXISTS idx_crm_role_kpi_targets_lifecycle_role
        ON crm_role_kpi_targets (lifecycle_id, role_key);
      CREATE INDEX IF NOT EXISTS idx_crm_role_kpi_targets_status_period
        ON crm_role_kpi_targets (status, period_end);
    `);
    this.ensured = true;
  }

  private mapRow(row: Record<string, unknown>): OpsRoleKpiTargetRow {
    const statusRaw = String(row.status ?? 'draft');
    const status: RoleKpiStatus = isRoleKpiStatus(statusRaw) ? statusRaw : 'draft';
    const form =
      row.form_data && typeof row.form_data === 'object' && !Array.isArray(row.form_data)
        ? (row.form_data as Record<string, unknown>)
        : {};
    const tv = row.target_value;
    const av = row.actual_value;
    return {
      id: Number(row.id),
      plan_id: row.plan_id == null ? null : Number(row.plan_id),
      lifecycle_id: row.lifecycle_id == null ? null : Number(row.lifecycle_id),
      client_id: row.client_id == null ? null : String(row.client_id),
      campaign_id: row.campaign_id == null ? null : Number(row.campaign_id),
      role_key: String(row.role_key ?? ''),
      kpi_key: String(row.kpi_key ?? ''),
      kpi_label: String(row.kpi_label ?? ''),
      period_start: row.period_start == null ? null : String(row.period_start).slice(0, 10),
      period_end: row.period_end == null ? null : String(row.period_end).slice(0, 10),
      target_value: tv == null || tv === '' ? null : Number(tv),
      target_unit: String(row.target_unit ?? 'count'),
      actual_value: av == null || av === '' ? null : Number(av),
      status,
      owner_staff_id: row.owner_staff_id == null ? null : String(row.owner_staff_id),
      form_data: form,
      notes: String(row.notes ?? ''),
      upsert_key: row.upsert_key == null ? null : String(row.upsert_key),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async getById(id: number): Promise<OpsRoleKpiTargetRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(`SELECT * FROM crm_role_kpi_targets WHERE id = $1 LIMIT 1`, [
      id,
    ]);
    const row = r.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async findUpsertMatch(input: {
    plan_id?: number | null;
    role_key: string;
    kpi_key: string;
    upsert_key?: string | null;
    period_start?: string | null;
  }): Promise<OpsRoleKpiTargetRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT * FROM crm_role_kpi_targets
       WHERE status <> 'cancelled'
         AND role_key = $1
         AND kpi_key = $2
         AND plan_id IS NOT DISTINCT FROM $3
         AND COALESCE(upsert_key, '') = COALESCE($4, '')
         AND period_start IS NOT DISTINCT FROM $5::date
       ORDER BY id DESC
       LIMIT 1`,
      [
        input.role_key,
        input.kpi_key,
        input.plan_id ?? null,
        input.upsert_key ?? null,
        input.period_start ?? null,
      ],
    );
    const row = r.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async insert(input: OpsRoleKpiInsert): Promise<OpsRoleKpiTargetRow> {
    await this.ensureSchema();
    const r = await this.db.query(
      `INSERT INTO crm_role_kpi_targets (
         plan_id, lifecycle_id, client_id, campaign_id,
         role_key, kpi_key, kpi_label, period_start, period_end,
         target_value, target_unit, status, owner_staff_id, form_data, notes, upsert_key
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8::date, $9::date,
         $10, $11, $12, $13, $14::jsonb, $15, $16
       ) RETURNING id`,
      [
        input.plan_id ?? null,
        input.lifecycle_id ?? null,
        input.client_id ?? null,
        input.campaign_id ?? null,
        input.role_key,
        input.kpi_key,
        input.kpi_label.slice(0, 400),
        input.period_start ?? null,
        input.period_end ?? null,
        input.target_value ?? null,
        input.target_unit.slice(0, 40),
        input.status,
        input.owner_staff_id ?? null,
        JSON.stringify(input.form_data ?? {}),
        String(input.notes ?? '').slice(0, 32000),
        input.upsert_key ?? null,
      ],
    );
    const row = await this.getById(Number(r.rows[0]?.id));
    if (!row) throw new Error('insert role kpi failed');
    return row;
  }

  async patch(id: number, fields: OpsRoleKpiPatch): Promise<OpsRoleKpiTargetRow | null> {
    await this.ensureSchema();
    const sets: string[] = [];
    const params: unknown[] = [id];
    const push = (sql: string, value: unknown) => {
      params.push(value);
      sets.push(`${sql} = $${params.length}`);
    };
    if (fields.kpi_label != null) push('kpi_label', String(fields.kpi_label).slice(0, 400));
    if (fields.period_start !== undefined) {
      params.push(fields.period_start);
      sets.push(`period_start = $${params.length}::date`);
    }
    if (fields.period_end !== undefined) {
      params.push(fields.period_end);
      sets.push(`period_end = $${params.length}::date`);
    }
    if (fields.target_value !== undefined) push('target_value', fields.target_value);
    if (fields.target_unit != null) push('target_unit', String(fields.target_unit).slice(0, 40));
    if (fields.owner_staff_id !== undefined) push('owner_staff_id', fields.owner_staff_id);
    if (fields.notes != null) push('notes', String(fields.notes).slice(0, 32000));
    if (fields.status != null) push('status', fields.status);
    if (fields.form_data != null) {
      params.push(JSON.stringify(fields.form_data));
      sets.push(
        `form_data = COALESCE(form_data, '{}'::jsonb) || $${params.length}::jsonb`,
      );
    }
    if (sets.length === 0) return this.getById(id);
    sets.push('updated_at = NOW()');
    await this.db.query(
      `UPDATE crm_role_kpi_targets SET ${sets.join(', ')} WHERE id = $1`,
      params,
    );
    return this.getById(id);
  }

  async list(filter: OpsRoleKpiListFilter): Promise<OpsRoleKpiTargetRow[]> {
    await this.ensureSchema();
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(`${sql} $${params.length}`);
    };
    if (filter.plan_id != null) add('plan_id =', filter.plan_id);
    if (filter.lifecycle_id != null) add('lifecycle_id =', filter.lifecycle_id);
    if (filter.client_id) add('client_id =', filter.client_id);
    if (filter.role_key) add('role_key =', filter.role_key);
    if (filter.status) add('status =', filter.status);
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    params.push(limit);
    const sql = `
      SELECT * FROM crm_role_kpi_targets
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY role_key, kpi_key, id DESC
      LIMIT $${params.length}
    `;
    const r = await this.db.query(sql, params);
    return (r.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
  }

  async countByPlanAndStatus(planId: number, status: RoleKpiStatus): Promise<number> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_role_kpi_targets WHERE plan_id = $1 AND status = $2`,
      [planId, status],
    );
    return Number(r.rows[0]?.c ?? 0);
  }
}
