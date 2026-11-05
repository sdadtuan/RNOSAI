import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CapacityAssignmentRow,
  CreateDeliveryChangeRequestBody,
  CreateDeliveryRiskBody,
  DeliveryChangeRequestRow,
  DeliveryQualitySnapshotRow,
  DeliveryRiskRow,
  PatchDeliveryRiskBody,
} from './delivery-ops.types';

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}

@Injectable()
export class DeliveryOpsRepository implements OnModuleDestroy {
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

  private mapRisk(row: Record<string, unknown>): DeliveryRiskRow {
    return {
      id: String(row.id),
      project_id: String(row.project_id),
      project_code: row.project_code != null ? String(row.project_code) : null,
      project_name: String(row.project_name ?? ''),
      severity: row.severity as DeliveryRiskRow['severity'],
      title: String(row.title),
      owner_staff_id: numOrNull(row.owner_staff_id),
      sla_due: row.sla_due != null ? new Date(String(row.sla_due)).toISOString() : null,
      status: row.status as DeliveryRiskRow['status'],
      note: row.note != null ? String(row.note) : null,
      row_version: Number(row.row_version ?? 1),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  private mapChangeRequest(row: Record<string, unknown>): DeliveryChangeRequestRow {
    return {
      id: String(row.id),
      project_id: String(row.project_id),
      project_code: row.project_code != null ? String(row.project_code) : null,
      project_name: String(row.project_name ?? ''),
      kind: row.kind as DeliveryChangeRequestRow['kind'],
      payload_json:
        row.payload_json && typeof row.payload_json === 'object'
          ? (row.payload_json as Record<string, unknown>)
          : {},
      status: row.status as DeliveryChangeRequestRow['status'],
      baseline_version: Number(row.baseline_version ?? 0),
      note: row.note != null ? String(row.note) : null,
      created_by_staff_id: numOrNull(row.created_by_staff_id),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  private mapQuality(row: Record<string, unknown>): DeliveryQualitySnapshotRow {
    return {
      id: String(row.id),
      project_id: String(row.project_id),
      project_code: row.project_code != null ? String(row.project_code) : null,
      project_name: String(row.project_name ?? ''),
      period: String(row.period),
      ontime_milestone_pct: strOrNull(row.ontime_milestone_pct),
      client_approval_sla: strOrNull(row.client_approval_sla),
      rework_pct: strOrNull(row.rework_pct),
      score: strOrNull(row.score),
      computed_at: new Date(String(row.computed_at)).toISOString(),
    };
  }

  async listRisks(projectId?: string): Promise<DeliveryRiskRow[]> {
    const params: unknown[] = [];
    let where = 'r.deleted_at IS NULL';
    if (projectId) {
      params.push(projectId);
      where += ` AND r.project_id = $${params.length}::uuid`;
    }
    const result = await this.db.query(
      `SELECT r.*, p.code AS project_code, p.name AS project_name
       FROM crm_delivery_risks r
       JOIN crm_delivery_projects p ON p.id = r.project_id
       WHERE ${where}
       ORDER BY r.created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.mapRisk(row as Record<string, unknown>));
  }

  async getRisk(projectId: string, riskId: string): Promise<DeliveryRiskRow | null> {
    const result = await this.db.query(
      `SELECT r.*, p.code AS project_code, p.name AS project_name
       FROM crm_delivery_risks r
       JOIN crm_delivery_projects p ON p.id = r.project_id
       WHERE r.id = $1::uuid AND r.project_id = $2::uuid AND r.deleted_at IS NULL
       LIMIT 1`,
      [riskId, projectId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRisk(row) : null;
  }

  async insertRisk(projectId: string, body: CreateDeliveryRiskBody): Promise<DeliveryRiskRow> {
    const result = await this.db.query(
      `INSERT INTO crm_delivery_risks (
         project_id, severity, title, owner_staff_id, sla_due, note
       ) VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6)
       RETURNING id::text`,
      [projectId, body.severity, body.title.trim(), body.owner_staff_id ?? null, body.sla_due ?? null, body.note ?? null],
    );
    const id = String((result.rows[0] as { id: string }).id);
    const row = await this.getRisk(projectId, id);
    if (!row) throw new Error('risk_insert_failed');
    return row;
  }

  async patchRisk(projectId: string, riskId: string, body: PatchDeliveryRiskBody): Promise<DeliveryRiskRow | null> {
    const sets: string[] = ['updated_at = NOW()', 'row_version = row_version + 1'];
    const params: unknown[] = [];
    const push = (clause: string, value: unknown) => {
      params.push(value);
      sets.push(clause.replace('?', `$${params.length}`));
    };
    if (body.severity != null) push('severity = ?', body.severity);
    if (body.title != null) push('title = ?', body.title.trim());
    if (body.owner_staff_id !== undefined) push('owner_staff_id = ?', body.owner_staff_id);
    if (body.sla_due !== undefined) push('sla_due = ?::timestamptz', body.sla_due);
    if (body.status != null) push('status = ?', body.status);
    if (body.note !== undefined) push('note = ?', body.note);
    if (sets.length <= 2) return this.getRisk(projectId, riskId);
    params.push(riskId, projectId);
    await this.db.query(
      `UPDATE crm_delivery_risks SET ${sets.join(', ')}
       WHERE id = $${params.length - 1}::uuid AND project_id = $${params.length}::uuid AND deleted_at IS NULL`,
      params,
    );
    return this.getRisk(projectId, riskId);
  }

  async listChangeRequests(projectId?: string, status?: string): Promise<DeliveryChangeRequestRow[]> {
    const params: unknown[] = [];
    const clauses = ['1=1'];
    if (projectId) {
      params.push(projectId);
      clauses.push(`cr.project_id = $${params.length}::uuid`);
    }
    if (status) {
      params.push(status);
      clauses.push(`cr.status = $${params.length}`);
    }
    const result = await this.db.query(
      `SELECT cr.*, p.code AS project_code, p.name AS project_name
       FROM crm_delivery_change_requests cr
       JOIN crm_delivery_projects p ON p.id = cr.project_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY cr.created_at DESC`,
      params,
    );
    return result.rows.map((row) => this.mapChangeRequest(row as Record<string, unknown>));
  }

  async insertChangeRequest(
    projectId: string,
    body: CreateDeliveryChangeRequestBody,
    actorStaffId: number,
    baselineVersion: number,
    status: DeliveryChangeRequestRow['status'],
  ): Promise<DeliveryChangeRequestRow> {
    const result = await this.db.query(
      `INSERT INTO crm_delivery_change_requests (
         project_id, kind, payload_json, status, baseline_version, note, created_by_staff_id
       ) VALUES ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7)
       RETURNING id::text`,
      [
        projectId,
        body.kind,
        JSON.stringify(body.payload_json ?? {}),
        status,
        baselineVersion,
        body.note ?? null,
        actorStaffId,
      ],
    );
    const id = String((result.rows[0] as { id: string }).id);
    const rows = await this.listChangeRequests(projectId);
    return rows.find((r) => r.id === id)!;
  }

  async patchChangeRequestStatus(
    id: string,
    status: DeliveryChangeRequestRow['status'],
    note?: string | null,
  ): Promise<DeliveryChangeRequestRow | null> {
    await this.db.query(
      `UPDATE crm_delivery_change_requests
       SET status = $2, note = COALESCE($3, note), updated_at = NOW()
       WHERE id = $1::uuid`,
      [id, status, note ?? null],
    );
    const result = await this.db.query(
      `SELECT cr.*, p.code AS project_code, p.name AS project_name
       FROM crm_delivery_change_requests cr
       JOIN crm_delivery_projects p ON p.id = cr.project_id
       WHERE cr.id = $1::uuid LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapChangeRequest(row) : null;
  }

  async getProjectVersion(projectId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT current_version, needs_finance FROM crm_delivery_projects WHERE id = $1::uuid LIMIT 1`,
      [projectId],
    );
    return Number((result.rows[0] as { current_version?: number } | undefined)?.current_version ?? 0);
  }

  async getProjectMeta(projectId: string): Promise<{ current_version: number; needs_finance: boolean; cadence_json: Record<string, unknown> }> {
    const result = await this.db.query(
      `SELECT current_version, needs_finance, cadence_json FROM crm_delivery_projects WHERE id = $1::uuid LIMIT 1`,
      [projectId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return {
      current_version: Number(row?.current_version ?? 0),
      needs_finance: Boolean(row?.needs_finance),
      cadence_json:
        row?.cadence_json && typeof row.cadence_json === 'object'
          ? (row.cadence_json as Record<string, unknown>)
          : {},
    };
  }

  async bumpProjectVersion(projectId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE crm_delivery_projects
       SET current_version = current_version + 1, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING current_version`,
      [projectId],
    );
    return Number((result.rows[0] as { current_version: number }).current_version);
  }

  async listPendingProjects(): Promise<
    Array<{ id: string; code: string | null; name: string; needs_finance: boolean; status: string }>
  > {
    const result = await this.db.query(
      `SELECT id::text, code, name, needs_finance, status
       FROM crm_delivery_projects
       WHERE status = 'pending_approval' AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
    );
    return result.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        code: row.code != null ? String(row.code) : null,
        name: String(row.name),
        needs_finance: Boolean(row.needs_finance),
        status: String(row.status),
      };
    });
  }

  async listCapacityAssignments(rangeStart: string, rangeEnd: string): Promise<CapacityAssignmentRow[]> {
    const result = await this.db.query(
      `SELECT r.staff_id, r.team_name, r.role_name, r.allocation_pct, r.start_date::text, r.end_date::text,
              p.id::text AS project_id, p.code AS project_code, p.name AS project_name, p.status AS project_status
       FROM crm_delivery_resources r
       JOIN crm_delivery_projects p ON p.id = r.project_id
       WHERE r.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND p.status IN ('draft', 'pending_approval', 'approved', 'active')
         AND r.end_date >= $1::date
         AND r.start_date <= $2::date`,
      [rangeStart, rangeEnd],
    );
    return result.rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        staff_id: Number(row.staff_id),
        team_name: row.team_name != null ? String(row.team_name) : null,
        role_name: row.role_name != null ? String(row.role_name) : null,
        allocation_pct: Number(row.allocation_pct),
        start_date: String(row.start_date),
        end_date: String(row.end_date),
        project_id: String(row.project_id),
        project_code: row.project_code != null ? String(row.project_code) : null,
        project_name: String(row.project_name),
        project_status: String(row.project_status),
      };
    });
  }

  async listMilestonesForQuality(projectId: string): Promise<
    Array<{ status: string; due_date: string | null; completed_at: string | null }>
  > {
    const result = await this.db.query(
      `SELECT status, due_date::text, completed_at::text
       FROM crm_delivery_milestones
       WHERE project_id = $1::uuid`,
      [projectId],
    );
    return result.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        status: String(row.status),
        due_date: row.due_date != null ? String(row.due_date) : null,
        completed_at: row.completed_at != null ? String(row.completed_at) : null,
      };
    });
  }

  async countChangeRequests(projectId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_delivery_change_requests WHERE project_id = $1::uuid`,
      [projectId],
    );
    return Number((result.rows[0] as { c: number }).c ?? 0);
  }

  async upsertQualitySnapshot(
    projectId: string,
    period: string,
    metrics: {
      ontime_milestone_pct: number | null;
      client_approval_sla: number | null;
      rework_pct: number | null;
      score: number | null;
    },
  ): Promise<DeliveryQualitySnapshotRow> {
    await this.db.query(
      `INSERT INTO crm_delivery_quality_snapshots (
         project_id, period, ontime_milestone_pct, client_approval_sla, rework_pct, score, computed_at
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (project_id, period) DO UPDATE SET
         ontime_milestone_pct = EXCLUDED.ontime_milestone_pct,
         client_approval_sla = EXCLUDED.client_approval_sla,
         rework_pct = EXCLUDED.rework_pct,
         score = EXCLUDED.score,
         computed_at = NOW()`,
      [
        projectId,
        period,
        metrics.ontime_milestone_pct,
        metrics.client_approval_sla,
        metrics.rework_pct,
        metrics.score,
      ],
    );
    const result = await this.db.query(
      `SELECT q.*, p.code AS project_code, p.name AS project_name
       FROM crm_delivery_quality_snapshots q
       JOIN crm_delivery_projects p ON p.id = q.project_id
       WHERE q.project_id = $1::uuid AND q.period = $2 LIMIT 1`,
      [projectId, period],
    );
    return this.mapQuality(result.rows[0] as Record<string, unknown>);
  }

  async listQualitySnapshots(period?: string): Promise<DeliveryQualitySnapshotRow[]> {
    const params: unknown[] = [];
    let where = '1=1';
    if (period) {
      params.push(period);
      where += ` AND q.period = $${params.length}`;
    }
    const result = await this.db.query(
      `SELECT q.*, p.code AS project_code, p.name AS project_name
       FROM crm_delivery_quality_snapshots q
       JOIN crm_delivery_projects p ON p.id = q.project_id
       WHERE ${where}
       ORDER BY q.score DESC NULLS LAST, p.name ASC`,
      params,
    );
    return result.rows.map((row) => this.mapQuality(row as Record<string, unknown>));
  }

  async listActiveProjectIds(): Promise<string[]> {
    const result = await this.db.query(
      `SELECT id::text FROM crm_delivery_projects
       WHERE deleted_at IS NULL AND status IN ('active', 'approved', 'draft', 'pending_approval')`,
    );
    return result.rows.map((r) => String((r as { id: string }).id));
  }

  async updateCadence(projectId: string, cadence: Record<string, unknown>): Promise<void> {
    await this.db.query(
      `UPDATE crm_delivery_projects SET cadence_json = $2::jsonb, updated_at = NOW() WHERE id = $1::uuid`,
      [projectId, JSON.stringify(cadence)],
    );
  }
}
