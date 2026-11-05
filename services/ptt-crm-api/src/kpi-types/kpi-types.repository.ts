import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  KPI_TYPES_TENANT_ID,
  type CreateKpiTypeBody,
  type KpiTypeDeptRef,
  type KpiTypeDetail,
  type KpiTypeGroupSnapshot,
  type KpiTypeListItem,
  type KpiTypeListQuery,
  type KpiTypePosRef,
  type KpiTypeRow,
  type KpiTypeSourceHealth,
  type KpiTypeSourceRef,
  type KpiTypeStatus,
  type KpiTypeSummary,
  type KpiTypeUnitRef,
  type KpiTypeValidationStatus,
  type KpiTypeVersionRow,
  type PatchKpiTypeBody,
} from './kpi-types.types';

type DbTypeRow = Record<string, unknown> & {
  departments_json?: unknown;
  positions_json?: unknown;
};

@Injectable()
export class KpiTypesRepository implements OnModuleDestroy {
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

  private parseSort(sort?: string): { column: string; dir: 'ASC' | 'DESC' } {
    const raw = String(sort ?? 'display_order:asc').trim();
    const [col, dirRaw] = raw.split(':');
    const dir = String(dirRaw ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const allowed: Record<string, string> = {
      display_order: 't.display_order',
      name: 'lower(t.name)',
      status: 't.status',
      updated_at: 't.updated_at',
      usage_count: 'usage_count',
      kpi_group: 'lower(g.name)',
    };
    return { column: allowed[col] ?? 't.display_order', dir };
  }

  private numOrNull(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private mapRow(row: DbTypeRow): KpiTypeRow {
    const departments: KpiTypeDeptRef[] = Array.isArray(row.departments_json)
      ? (row.departments_json as Array<{ id: number; name: string }>).map((d) => ({
          id: Number(d.id),
          name: String(d.name ?? ''),
        }))
      : [];
    const positions: KpiTypePosRef[] = Array.isArray(row.positions_json)
      ? (row.positions_json as Array<{ id: number; name: string }>).map((p) => ({
          id: Number(p.id),
          name: String(p.name ?? ''),
        }))
      : [];

    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      kpi_group_id: String(row.kpi_group_id),
      code: String(row.code),
      name: String(row.name),
      short_name: row.short_name != null ? String(row.short_name) : null,
      description: row.description != null ? String(row.description) : null,
      direction: String(row.direction) as KpiTypeRow['direction'],
      value_type: String(row.value_type) as KpiTypeRow['value_type'],
      unit_id: String(row.unit_id),
      decimal_places: Number(row.decimal_places ?? 0),
      target_mode: String(row.target_mode) as KpiTypeRow['target_mode'],
      minimum_target: this.numOrNull(row.minimum_target),
      default_target: Number(row.default_target),
      stretch_target: this.numOrNull(row.stretch_target),
      lower_limit: this.numOrNull(row.lower_limit),
      upper_limit: this.numOrNull(row.upper_limit),
      calculation_mode: String(row.calculation_mode) as KpiTypeRow['calculation_mode'],
      primary_data_source_id:
        row.primary_data_source_id != null ? String(row.primary_data_source_id) : null,
      data_entity: row.data_entity != null ? String(row.data_entity) : null,
      aggregation_type:
        row.aggregation_type != null
          ? (String(row.aggregation_type) as KpiTypeRow['aggregation_type'])
          : null,
      formula_expression: row.formula_expression != null ? String(row.formula_expression) : null,
      formula_display: row.formula_display != null ? String(row.formula_display) : null,
      sync_frequency:
        row.sync_frequency != null
          ? (String(row.sync_frequency) as KpiTypeRow['sync_frequency'])
          : null,
      timezone: String(row.timezone ?? 'Asia/Ho_Chi_Minh'),
      divide_by_zero_fallback: String(row.divide_by_zero_fallback ?? 'ERROR') as KpiTypeRow['divide_by_zero_fallback'],
      manual_evidence_required: Boolean(row.manual_evidence_required),
      scope_type: String(row.scope_type) as KpiTypeRow['scope_type'],
      weight_min: this.numOrNull(row.weight_min),
      weight_max: this.numOrNull(row.weight_max),
      display_order: Number(row.display_order),
      status: String(row.status) as KpiTypeRow['status'],
      is_system_default: Boolean(row.is_system_default),
      current_version: Number(row.current_version ?? 1),
      created_by_staff_id: Number(row.created_by_staff_id),
      updated_by_staff_id: Number(row.updated_by_staff_id),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
      deleted_at: row.deleted_at != null ? new Date(String(row.deleted_at)).toISOString() : null,
      deleted_by_staff_id: row.deleted_by_staff_id != null ? Number(row.deleted_by_staff_id) : null,
      row_version: Number(row.row_version),
      department_ids: departments.map((d) => d.id),
      position_ids: positions.map((p) => p.id),
      departments,
      positions,
      usage_count: Number(row.usage_count ?? 0),
      updated_by_name: row.updated_by_name != null ? String(row.updated_by_name) : null,
      kpi_group: row.group_id
        ? {
            id: String(row.group_id),
            code: String(row.group_code ?? ''),
            name: String(row.group_name ?? ''),
            color: String(row.group_color ?? '#17B6A4'),
          }
        : null,
      unit: row.unit_code
        ? {
            id: String(row.unit_id),
            code: String(row.unit_code),
            name: String(row.unit_name ?? ''),
          }
        : null,
      data_source: row.source_id
        ? {
            id: String(row.source_id),
            code: String(row.source_code ?? ''),
            name: String(row.source_name ?? ''),
            adapter_key: String(row.source_adapter ?? ''),
            health: String(row.source_health ?? 'UNKNOWN') as KpiTypeSourceHealth,
          }
        : null,
      validation_status: String(row.validation_status ?? 'NOT_TESTED') as KpiTypeValidationStatus,
    };
  }

  toListItem(row: KpiTypeRow): KpiTypeListItem {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      short_name: row.short_name,
      description: row.description,
      kpi_group: row.kpi_group,
      direction: row.direction,
      value_type: row.value_type,
      unit: row.unit,
      calculation_mode: row.calculation_mode,
      data_source: row.data_source,
      usage_count: row.usage_count,
      status: row.status,
      current_version: row.current_version,
      display_order: row.display_order,
      updated_at: row.updated_at,
      updated_by: row.updated_by_staff_id
        ? { id: row.updated_by_staff_id, name: row.updated_by_name ?? '' }
        : null,
      row_version: row.row_version,
    };
  }

  toDetail(row: KpiTypeRow): KpiTypeDetail {
    return {
      ...this.toListItem(row),
      tenant_id: row.tenant_id,
      kpi_group_id: row.kpi_group_id,
      unit_id: row.unit_id,
      decimal_places: row.decimal_places,
      target_mode: row.target_mode,
      minimum_target: row.minimum_target,
      default_target: row.default_target,
      stretch_target: row.stretch_target,
      lower_limit: row.lower_limit,
      upper_limit: row.upper_limit,
      primary_data_source_id: row.primary_data_source_id,
      data_entity: row.data_entity,
      aggregation_type: row.aggregation_type,
      formula_expression: row.formula_expression,
      formula_display: row.formula_display,
      sync_frequency: row.sync_frequency,
      timezone: row.timezone,
      divide_by_zero_fallback: row.divide_by_zero_fallback,
      manual_evidence_required: row.manual_evidence_required,
      scope_type: row.scope_type,
      department_ids: row.department_ids,
      position_ids: row.position_ids,
      departments: row.departments,
      positions: row.positions,
      weight_min: row.weight_min,
      weight_max: row.weight_max,
      is_system_default: row.is_system_default,
      validation_status: row.validation_status,
      created_by_staff_id: row.created_by_staff_id,
      created_at: row.created_at,
    };
  }

  private selectBaseSql(): string {
    return `
      SELECT t.*,
        COALESCE(uc.cnt, 0)::int AS usage_count,
        s.name AS updated_by_name,
        g.id AS group_id, g.code AS group_code, g.name AS group_name, g.color AS group_color,
        u.code AS unit_code, u.name AS unit_name,
        ds.id AS source_id, ds.code AS source_code, ds.name AS source_name,
        ds.adapter_key AS source_adapter, ds.health AS source_health,
        COALESCE(v.validation_status, 'NOT_TESTED') AS validation_status,
        dept.departments_json,
        pos.positions_json
      FROM crm_kpi_types t
      LEFT JOIN crm_staff s ON s.id = t.updated_by_staff_id
      LEFT JOIN crm_kpi_groups g ON g.id = t.kpi_group_id
      LEFT JOIN crm_kpi_units u ON u.id = t.unit_id
      LEFT JOIN crm_kpi_data_sources ds ON ds.id = t.primary_data_source_id
      LEFT JOIN crm_kpi_type_versions v
        ON v.kpi_type_id = t.id AND v.version_number = t.current_version
      LEFT JOIN (
        SELECT kpi_type_id, COUNT(*)::int AS cnt
        FROM crm_kpi_metrics
        WHERE kpi_type_id IS NOT NULL
        GROUP BY kpi_type_id
      ) uc ON uc.kpi_type_id = t.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name) ORDER BY d.name), '[]'::json) AS departments_json
        FROM crm_kpi_type_departments td
        JOIN crm_departments d ON d.id = td.department_id
        WHERE td.type_id = t.id
      ) dept ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name), '[]'::json) AS positions_json
        FROM crm_kpi_type_positions tp
        JOIN crm_positions p ON p.id = tp.position_id
        WHERE tp.type_id = t.id
      ) pos ON TRUE
    `;
  }

  async listTypes(query: KpiTypeListQuery): Promise<{ rows: KpiTypeListItem[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = [20, 50, 100].includes(Number(query.page_size))
      ? Number(query.page_size)
      : 20;
    const offset = (page - 1) * pageSize;
    const { column, dir } = this.parseSort(query.sort);

    const conditions = ['t.tenant_id = $1', 't.deleted_at IS NULL'];
    const params: unknown[] = [KPI_TYPES_TENANT_ID];
    let idx = 2;

    const q = String(query.q ?? '').trim();
    if (q) {
      conditions.push(
        `(t.code ILIKE $${idx} OR t.name ILIKE $${idx} OR COALESCE(t.description, '') ILIKE $${idx} OR COALESCE(t.formula_expression, '') ILIKE $${idx})`,
      );
      params.push(`%${q}%`);
      idx += 1;
    }

    const status = String(query.status ?? '').trim().toUpperCase();
    if (status && ['DRAFT', 'ACTIVE', 'INACTIVE'].includes(status)) {
      conditions.push(`t.status = $${idx}`);
      params.push(status);
      idx += 1;
    }

    const groupId = String(query.kpi_group_id ?? '').trim();
    if (groupId) {
      conditions.push(`t.kpi_group_id = $${idx}::uuid`);
      params.push(groupId);
      idx += 1;
    }

    const mode = String(query.calculation_mode ?? '').trim().toUpperCase();
    if (mode && ['AUTO', 'MANUAL', 'HYBRID'].includes(mode)) {
      conditions.push(`t.calculation_mode = $${idx}`);
      params.push(mode);
      idx += 1;
    }

    const direction = String(query.direction ?? '').trim().toUpperCase();
    if (direction && ['INCREASE', 'DECREASE', 'RANGE'].includes(direction)) {
      conditions.push(`t.direction = $${idx}`);
      params.push(direction);
      idx += 1;
    }

    const departmentId = String(query.department_id ?? '').trim();
    if (departmentId) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM crm_kpi_type_departments td
           WHERE td.type_id = t.id AND td.department_id = $${idx}::bigint
         )`,
      );
      params.push(departmentId);
      idx += 1;
    }

    const sourceId = String(query.data_source_id ?? '').trim();
    if (sourceId) {
      conditions.push(`t.primary_data_source_id = $${idx}::uuid`);
      params.push(sourceId);
      idx += 1;
    }

    const where = conditions.join(' AND ');
    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM crm_kpi_types t WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const result = await this.db.query(
      `${this.selectBaseSql()}
       WHERE ${where}
       ORDER BY ${column} ${dir}, t.id ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    const rows = (result.rows as DbTypeRow[]).map((r) => this.toListItem(this.mapRow(r)));
    return { rows, total };
  }

  async getSummary(): Promise<KpiTypeSummary> {
    const result = await this.db.query<{ status: string; calc: string; count: string }>(
      `SELECT status, calculation_mode AS calc, COUNT(*)::text AS count
       FROM crm_kpi_types
       WHERE tenant_id = $1 AND deleted_at IS NULL
       GROUP BY status, calculation_mode`,
      [KPI_TYPES_TENANT_ID],
    );
    let total = 0;
    let active = 0;
    let draft = 0;
    let auto = 0;
    for (const row of result.rows) {
      const cnt = Number(row.count);
      total += cnt;
      if (row.status === 'ACTIVE') active += cnt;
      if (row.status === 'DRAFT') draft += cnt;
      if (row.calc === 'AUTO' || row.calc === 'HYBRID') auto += cnt;
    }
    return { total, active, draft, auto };
  }

  async getTypeById(id: string): Promise<KpiTypeRow | null> {
    const result = await this.db.query(
      `${this.selectBaseSql()}
       WHERE t.tenant_id = $1 AND t.id = $2::uuid AND t.deleted_at IS NULL
       LIMIT 1`,
      [KPI_TYPES_TENANT_ID, id],
    );
    const row = result.rows[0] as DbTypeRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async getActiveGroup(id: string): Promise<KpiTypeGroupSnapshot | null> {
    const result = await this.db.query(
      `SELECT g.id, g.code, g.name, g.status, g.default_direction, g.color,
              COALESCE((
                SELECT json_agg(ut.unit_type)
                FROM crm_kpi_group_unit_types ut WHERE ut.group_id = g.id
              ), '[]'::json) AS unit_types
       FROM crm_kpi_groups g
       WHERE g.tenant_id = $1 AND g.id = $2::uuid AND g.deleted_at IS NULL
       LIMIT 1`,
      [KPI_TYPES_TENANT_ID, id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      status: String(row.status),
      default_direction: String(row.default_direction) as KpiTypeGroupSnapshot['default_direction'],
      suggested_unit_types: Array.isArray(row.unit_types) ? row.unit_types.map(String) : [],
      color: String(row.color ?? '#17B6A4'),
    };
  }

  async listUnits(): Promise<KpiTypeUnitRef[]> {
    const result = await this.db.query(
      `SELECT id, code, name, value_types FROM crm_kpi_units
       WHERE tenant_id = $1 ORDER BY name`,
      [KPI_TYPES_TENANT_ID],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      value_types: Array.isArray(row.value_types) ? row.value_types.map(String) : [],
    }));
  }

  async listDataSources(): Promise<KpiTypeSourceRef[]> {
    const result = await this.db.query(
      `SELECT id, code, name, adapter_key, entities, health
       FROM crm_kpi_data_sources
       WHERE tenant_id = $1 ORDER BY name`,
      [KPI_TYPES_TENANT_ID],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      adapter_key: String(row.adapter_key),
      health: String(row.health) as KpiTypeSourceHealth,
      entities: Array.isArray(row.entities) ? row.entities.map(String) : [],
    }));
  }

  async getDataSource(id: string): Promise<KpiTypeSourceRef | null> {
    const result = await this.db.query(
      `SELECT id, code, name, adapter_key, entities, health
       FROM crm_kpi_data_sources
       WHERE tenant_id = $1 AND id = $2::uuid LIMIT 1`,
      [KPI_TYPES_TENANT_ID, id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      adapter_key: String(row.adapter_key),
      health: String(row.health) as KpiTypeSourceHealth,
      entities: Array.isArray(row.entities) ? row.entities.map(String) : [],
    };
  }

  async updateDataSourceHealth(id: string, health: KpiTypeSourceHealth): Promise<void> {
    await this.db.query(
      `UPDATE crm_kpi_data_sources
       SET health = $2, last_checked_at = NOW()
       WHERE tenant_id = $1 AND id = $3::uuid`,
      [KPI_TYPES_TENANT_ID, health, id],
    );
  }

  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    const params: unknown[] = [KPI_TYPES_TENANT_ID, code.trim().toUpperCase()];
    let sql = `SELECT 1 FROM crm_kpi_types
               WHERE tenant_id = $1 AND upper(code) = $2 AND deleted_at IS NULL`;
    if (excludeId) {
      sql += ` AND id != $3::uuid`;
      params.push(excludeId);
    }
    const result = await this.db.query(sql, params);
    return result.rows.length > 0;
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const params: unknown[] = [KPI_TYPES_TENANT_ID, name.trim()];
    let sql = `SELECT 1 FROM crm_kpi_types
               WHERE tenant_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL`;
    if (excludeId) {
      sql += ` AND id != $3::uuid`;
      params.push(excludeId);
    }
    const result = await this.db.query(sql, params);
    return result.rows.length > 0;
  }

  async nextDisplayOrder(): Promise<number> {
    const result = await this.db.query<{ max: string | null }>(
      `SELECT MAX(display_order)::text AS max
       FROM crm_kpi_types
       WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [KPI_TYPES_TENANT_ID],
    );
    const max = Number(result.rows[0]?.max ?? 0);
    return (Number.isFinite(max) ? max : 0) + 1;
  }

  async getUsageCount(typeId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM crm_kpi_metrics WHERE kpi_type_id = $1::uuid`,
      [typeId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async replaceJunctions(
    client: Pool | import('pg').PoolClient,
    typeId: string,
    departmentIds: number[],
    positionIds: number[],
  ): Promise<void> {
    await client.query(`DELETE FROM crm_kpi_type_departments WHERE type_id = $1::uuid`, [typeId]);
    await client.query(`DELETE FROM crm_kpi_type_positions WHERE type_id = $1::uuid`, [typeId]);
    for (const deptId of departmentIds) {
      await client.query(
        `INSERT INTO crm_kpi_type_departments (type_id, department_id) VALUES ($1::uuid, $2)`,
        [typeId, deptId],
      );
    }
    for (const posId of positionIds) {
      await client.query(
        `INSERT INTO crm_kpi_type_positions (type_id, position_id) VALUES ($1::uuid, $2)`,
        [typeId, posId],
      );
    }
  }

  async insertType(
    staffId: number,
    body: CreateKpiTypeBody & {
      display_order: number;
      status: KpiTypeStatus;
      department_ids: number[];
      position_ids: number[];
    },
  ): Promise<KpiTypeRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO crm_kpi_types (
           tenant_id, kpi_group_id, code, name, short_name, description,
           direction, value_type, unit_id, decimal_places, target_mode,
           minimum_target, default_target, stretch_target, lower_limit, upper_limit,
           calculation_mode, primary_data_source_id, data_entity, aggregation_type,
           formula_expression, formula_display, sync_frequency, timezone,
           divide_by_zero_fallback, manual_evidence_required, scope_type,
           weight_min, weight_max, display_order, status, is_system_default,
           created_by_staff_id, updated_by_staff_id
         ) VALUES (
           $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::uuid, $10, $11,
           $12, $13, $14, $15, $16, $17, $18, $19, $20,
           $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, FALSE, $32, $32
         ) RETURNING id`,
        [
          KPI_TYPES_TENANT_ID,
          body.kpi_group_id,
          body.code.trim().toUpperCase(),
          body.name.trim(),
          body.short_name?.trim().slice(0, 50) || null,
          body.description?.trim().slice(0, 1000) || null,
          body.direction,
          body.value_type,
          body.unit_id,
          body.decimal_places ?? 0,
          body.target_mode,
          body.minimum_target ?? null,
          body.default_target,
          body.stretch_target ?? null,
          body.lower_limit ?? null,
          body.upper_limit ?? null,
          body.calculation_mode,
          body.primary_data_source_id || null,
          body.data_entity ?? null,
          body.aggregation_type ?? null,
          body.formula_expression?.trim() || null,
          body.formula_display?.trim() || null,
          body.sync_frequency ?? null,
          body.timezone?.trim() || 'Asia/Ho_Chi_Minh',
          body.divide_by_zero_fallback ?? 'ERROR',
          body.manual_evidence_required ?? body.calculation_mode === 'MANUAL',
          body.scope_type,
          body.weight_min ?? null,
          body.weight_max ?? null,
          body.display_order,
          body.status,
          staffId,
        ],
      );
      const typeId = String(result.rows[0].id);
      await this.replaceJunctions(client, typeId, body.department_ids, body.position_ids);
      await client.query(
        `INSERT INTO crm_kpi_type_versions (
           tenant_id, kpi_type_id, version_number, formula_expression, formula_display,
           data_source_snapshot, target_config_snapshot, created_by_staff_id
         ) VALUES ($1, $2::uuid, 1, $3, $4, $5, $6, $7)`,
        [
          KPI_TYPES_TENANT_ID,
          typeId,
          body.formula_expression?.trim() || null,
          body.formula_display?.trim() || null,
          body.primary_data_source_id
            ? { primary_data_source_id: body.primary_data_source_id }
            : null,
          {
            target_mode: body.target_mode,
            default_target: body.default_target,
            minimum_target: body.minimum_target ?? null,
            stretch_target: body.stretch_target ?? null,
          },
          staffId,
        ],
      );
      await client.query('COMMIT');
      const row = await this.getTypeById(typeId);
      if (!row) throw new Error('Failed to load inserted KPI type');
      return row;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async patchType(
    staffId: number,
    id: string,
    expectedVersion: number,
    patch: PatchKpiTypeBody & {
      department_ids?: number[];
      position_ids?: number[];
      bump_version?: boolean;
    },
  ): Promise<KpiTypeRow | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const existingResult = await client.query(
        `SELECT * FROM crm_kpi_types
         WHERE tenant_id = $1 AND id = $2::uuid AND deleted_at IS NULL
         FOR UPDATE`,
        [KPI_TYPES_TENANT_ID, id],
      );
      const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
      if (!existing) {
        await client.query('ROLLBACK');
        return null;
      }
      if (Number(existing.row_version) !== expectedVersion) {
        await client.query('ROLLBACK');
        throw new Error('VERSION_CONFLICT');
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      const setField = (col: string, val: unknown) => {
        sets.push(`${col} = $${idx}`);
        params.push(val);
        idx += 1;
      };

      if (patch.kpi_group_id != null) setField('kpi_group_id', patch.kpi_group_id);
      if (patch.code != null) setField('code', String(patch.code).trim().toUpperCase());
      if (patch.name != null) setField('name', String(patch.name).trim());
      if ('short_name' in patch) setField('short_name', patch.short_name?.trim().slice(0, 50) || null);
      if ('description' in patch) {
        setField('description', patch.description?.trim().slice(0, 1000) || null);
      }
      if (patch.direction != null) setField('direction', patch.direction);
      if (patch.value_type != null) setField('value_type', patch.value_type);
      if (patch.unit_id != null) setField('unit_id', patch.unit_id);
      if (patch.decimal_places != null) setField('decimal_places', patch.decimal_places);
      if (patch.target_mode != null) setField('target_mode', patch.target_mode);
      if ('minimum_target' in patch) setField('minimum_target', patch.minimum_target ?? null);
      if (patch.default_target != null) setField('default_target', patch.default_target);
      if ('stretch_target' in patch) setField('stretch_target', patch.stretch_target ?? null);
      if ('lower_limit' in patch) setField('lower_limit', patch.lower_limit ?? null);
      if ('upper_limit' in patch) setField('upper_limit', patch.upper_limit ?? null);
      if (patch.calculation_mode != null) setField('calculation_mode', patch.calculation_mode);
      if ('primary_data_source_id' in patch) {
        setField('primary_data_source_id', patch.primary_data_source_id || null);
      }
      if ('data_entity' in patch) setField('data_entity', patch.data_entity ?? null);
      if ('aggregation_type' in patch) setField('aggregation_type', patch.aggregation_type ?? null);
      if ('formula_expression' in patch) {
        setField('formula_expression', patch.formula_expression?.trim() || null);
      }
      if ('formula_display' in patch) setField('formula_display', patch.formula_display?.trim() || null);
      if ('sync_frequency' in patch) setField('sync_frequency', patch.sync_frequency ?? null);
      if (patch.timezone != null) setField('timezone', patch.timezone);
      if (patch.divide_by_zero_fallback != null) {
        setField('divide_by_zero_fallback', patch.divide_by_zero_fallback);
      }
      if (patch.manual_evidence_required != null) {
        setField('manual_evidence_required', patch.manual_evidence_required);
      }
      if (patch.scope_type != null) setField('scope_type', patch.scope_type);
      if ('weight_min' in patch) setField('weight_min', patch.weight_min ?? null);
      if ('weight_max' in patch) setField('weight_max', patch.weight_max ?? null);
      if (patch.display_order != null) setField('display_order', patch.display_order);
      if (patch.status != null) setField('status', patch.status);

      if (patch.bump_version) {
        sets.push(`current_version = current_version + 1`);
      }

      sets.push(`updated_by_staff_id = $${idx}`);
      params.push(staffId);
      idx += 1;
      sets.push(`updated_at = NOW()`);
      sets.push(`row_version = row_version + 1`);
      params.push(KPI_TYPES_TENANT_ID, id);
      await client.query(
        `UPDATE crm_kpi_types SET ${sets.join(', ')}
         WHERE tenant_id = $${idx} AND id = $${idx + 1}::uuid`,
        params,
      );

      if (patch.department_ids != null || patch.position_ids != null) {
        const current = await this.getTypeById(id);
        await this.replaceJunctions(
          client,
          id,
          patch.department_ids ?? current?.department_ids ?? [],
          patch.position_ids ?? current?.position_ids ?? [],
        );
      }

      if (patch.bump_version) {
        const next = Number(existing.current_version ?? 1) + 1;
        await client.query(
          `UPDATE crm_kpi_type_versions
           SET effective_to = NOW()
           WHERE kpi_type_id = $1::uuid AND version_number = $2 AND effective_to IS NULL`,
          [id, existing.current_version],
        );
        await client.query(
          `INSERT INTO crm_kpi_type_versions (
             tenant_id, kpi_type_id, version_number, formula_expression, formula_display,
             change_reason, created_by_staff_id
           ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)`,
          [
            KPI_TYPES_TENANT_ID,
            id,
            next,
            patch.formula_expression ?? existing.formula_expression ?? null,
            patch.formula_display ?? existing.formula_display ?? null,
            patch.change_reason ?? null,
            staffId,
          ],
        );
      }

      await client.query('COMMIT');
      return this.getTypeById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateStatus(staffId: number, id: string, status: KpiTypeStatus): Promise<KpiTypeRow | null> {
    const result = await this.db.query(
      `UPDATE crm_kpi_types
       SET status = $1, updated_by_staff_id = $2, updated_at = NOW(), row_version = row_version + 1
       WHERE tenant_id = $3 AND id = $4::uuid AND deleted_at IS NULL
       RETURNING id`,
      [status, staffId, KPI_TYPES_TENANT_ID, id],
    );
    if (result.rows.length === 0) return null;
    return this.getTypeById(id);
  }

  async softDeleteType(staffId: number, id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE crm_kpi_types
       SET deleted_at = NOW(), deleted_by_staff_id = $1, updated_at = NOW(), row_version = row_version + 1
       WHERE tenant_id = $2 AND id = $3::uuid AND deleted_at IS NULL`,
      [staffId, KPI_TYPES_TENANT_ID, id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listVersions(typeId: string): Promise<KpiTypeVersionRow[]> {
    const result = await this.db.query(
      `SELECT id, version_number, effective_from, effective_to, formula_expression,
              formula_display, validation_status, change_reason, created_by_staff_id, created_at
       FROM crm_kpi_type_versions
       WHERE tenant_id = $1 AND kpi_type_id = $2::uuid
       ORDER BY version_number DESC`,
      [KPI_TYPES_TENANT_ID, typeId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      version_number: Number(row.version_number),
      effective_from: new Date(String(row.effective_from)).toISOString(),
      effective_to: row.effective_to != null ? new Date(String(row.effective_to)).toISOString() : null,
      formula_expression: row.formula_expression != null ? String(row.formula_expression) : null,
      formula_display: row.formula_display != null ? String(row.formula_display) : null,
      validation_status: String(row.validation_status) as KpiTypeValidationStatus,
      change_reason: row.change_reason != null ? String(row.change_reason) : null,
      created_by_staff_id: Number(row.created_by_staff_id),
      created_at: new Date(String(row.created_at)).toISOString(),
    }));
  }

  async updateCurrentVersionValidation(
    typeId: string,
    versionNumber: number,
    status: KpiTypeValidationStatus,
    result: Record<string, unknown> | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_kpi_type_versions
       SET validation_status = $3, validation_result = $4
       WHERE tenant_id = $1 AND kpi_type_id = $2::uuid AND version_number = $5`,
      [KPI_TYPES_TENANT_ID, typeId, status, result, versionNumber],
    );
  }
}
