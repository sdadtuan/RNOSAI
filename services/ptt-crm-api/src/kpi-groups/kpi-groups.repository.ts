import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  KPI_GROUPS_TENANT_ID,
  type CreateKpiGroupBody,
  type KpiGroupDepartmentRef,
  type KpiGroupDetail,
  type KpiGroupListItem,
  type KpiGroupListQuery,
  type KpiGroupPositionRef,
  type KpiGroupRow,
  type KpiGroupStatus,
  type KpiGroupSummary,
  type PatchKpiGroupBody,
} from './kpi-groups.types';

type DbGroupRow = Record<string, unknown> & {
  departments_json?: unknown;
  positions_json?: unknown;
  unit_types_json?: unknown;
  data_domains_json?: unknown;
};

@Injectable()
export class KpiGroupsRepository implements OnModuleDestroy {
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
      display_order: 'g.display_order',
      name: 'lower(g.name)',
      status: 'g.status',
      updated_at: 'g.updated_at',
    };
    return { column: allowed[col] ?? 'g.display_order', dir };
  }

  private mapRow(row: DbGroupRow): KpiGroupRow {
    const departments: KpiGroupDepartmentRef[] = Array.isArray(row.departments_json)
      ? (row.departments_json as Array<{ id: number; name: string }>).map((d) => ({
          id: Number(d.id),
          name: String(d.name ?? ''),
        }))
      : [];
    const positions: KpiGroupPositionRef[] = Array.isArray(row.positions_json)
      ? (row.positions_json as Array<{ id: number; name: string }>).map((p) => ({
          id: Number(p.id),
          name: String(p.name ?? ''),
        }))
      : [];
    const unitTypes = Array.isArray(row.unit_types_json)
      ? (row.unit_types_json as string[])
      : [];
    const dataDomains = Array.isArray(row.data_domains_json)
      ? (row.data_domains_json as string[])
      : [];

    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      parent_id: row.parent_id != null ? String(row.parent_id) : null,
      code: String(row.code),
      name: String(row.name),
      description: row.description != null ? String(row.description) : null,
      scope_type: String(row.scope_type) as KpiGroupRow['scope_type'],
      default_direction: String(row.default_direction) as KpiGroupRow['default_direction'],
      color: String(row.color),
      icon: row.icon != null ? String(row.icon) : null,
      display_order: Number(row.display_order),
      status: String(row.status) as KpiGroupRow['status'],
      is_system_default: Boolean(row.is_system_default),
      created_by_staff_id: Number(row.created_by_staff_id),
      updated_by_staff_id: Number(row.updated_by_staff_id),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
      deleted_at: row.deleted_at != null ? new Date(String(row.deleted_at)).toISOString() : null,
      deleted_by_staff_id:
        row.deleted_by_staff_id != null ? Number(row.deleted_by_staff_id) : null,
      row_version: Number(row.row_version),
      department_ids: departments.map((d) => d.id),
      position_ids: positions.map((p) => p.id),
      departments,
      positions,
      suggested_unit_types: unitTypes.map(String),
      data_domains: dataDomains.map(String),
      usage_count: Number(row.usage_count ?? 0),
      updated_by_name: row.updated_by_name != null ? String(row.updated_by_name) : null,
    };
  }

  private toListItem(row: KpiGroupRow): KpiGroupListItem {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      scope_type: row.scope_type,
      departments: row.departments,
      positions: row.positions,
      default_direction: row.default_direction,
      color: row.color,
      icon: row.icon,
      display_order: row.display_order,
      status: row.status,
      usage_count: row.usage_count,
      updated_at: row.updated_at,
      updated_by: row.updated_by_staff_id
        ? { id: row.updated_by_staff_id, name: row.updated_by_name ?? '' }
        : null,
      is_system_default: row.is_system_default,
      row_version: row.row_version,
    };
  }

  private selectBaseSql(): string {
    return `
      SELECT g.*,
        COALESCE(uc.cnt, 0)::int AS usage_count,
        s.name AS updated_by_name,
        dept.departments_json,
        pos.positions_json,
        ut.unit_types_json,
        dd.data_domains_json
      FROM crm_kpi_groups g
      LEFT JOIN crm_staff s ON s.id = g.updated_by_staff_id
      LEFT JOIN (
        SELECT group_id, COUNT(*)::int AS cnt
        FROM crm_kpi_metrics
        WHERE group_id IS NOT NULL
        GROUP BY group_id
      ) uc ON uc.group_id = g.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name) ORDER BY d.name), '[]'::json) AS departments_json
        FROM crm_kpi_group_departments gd
        JOIN crm_departments d ON d.id = gd.department_id
        WHERE gd.group_id = g.id
      ) dept ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.name), '[]'::json) AS positions_json
        FROM crm_kpi_group_positions gp
        JOIN crm_positions p ON p.id = gp.position_id
        WHERE gp.group_id = g.id
      ) pos ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(gu.unit_type ORDER BY gu.unit_type), '[]'::json) AS unit_types_json
        FROM crm_kpi_group_unit_types gu
        WHERE gu.group_id = g.id
      ) ut ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(gd2.data_domain ORDER BY gd2.data_domain), '[]'::json) AS data_domains_json
        FROM crm_kpi_group_data_domains gd2
        WHERE gd2.group_id = g.id
      ) dd ON TRUE
    `;
  }

  async listGroups(
    query: KpiGroupListQuery,
  ): Promise<{ rows: KpiGroupListItem[]; total: number }> {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = [20, 50, 100].includes(Number(query.page_size))
      ? Number(query.page_size)
      : 20;
    const offset = (page - 1) * pageSize;
    const { column, dir } = this.parseSort(query.sort);

    const conditions = ['g.tenant_id = $1', 'g.deleted_at IS NULL'];
    const params: unknown[] = [KPI_GROUPS_TENANT_ID];
    let idx = 2;

    const q = String(query.q ?? '').trim();
    if (q) {
      conditions.push(
        `(g.code ILIKE $${idx} OR g.name ILIKE $${idx} OR COALESCE(g.description, '') ILIKE $${idx})`,
      );
      params.push(`%${q}%`);
      idx += 1;
    }

    const status = String(query.status ?? '').trim().toUpperCase();
    if (status && ['DRAFT', 'ACTIVE', 'INACTIVE'].includes(status)) {
      conditions.push(`g.status = $${idx}`);
      params.push(status);
      idx += 1;
    } else if (!query.include_inactive) {
      // no extra filter — list shows all statuses by default per SRS
    }

    const departmentId = String(query.department_id ?? '').trim();
    if (departmentId) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM crm_kpi_group_departments gd
           WHERE gd.group_id = g.id AND gd.department_id = $${idx}::bigint
         )`,
      );
      params.push(departmentId);
      idx += 1;
    }

    const scopeType = String(query.scope_type ?? '').trim().toUpperCase();
    if (scopeType && ['ORGANIZATION', 'DEPARTMENT', 'POSITION', 'CUSTOM'].includes(scopeType)) {
      conditions.push(`g.scope_type = $${idx}`);
      params.push(scopeType);
      idx += 1;
    }

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM crm_kpi_groups g WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, pageSize, offset];
    const result = await this.db.query(
      `${this.selectBaseSql()}
       WHERE ${where}
       ORDER BY ${column} ${dir}, g.id ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      listParams,
    );

    const rows = (result.rows as DbGroupRow[]).map((r) => this.toListItem(this.mapRow(r)));

    return { rows, total };
  }

  async getSummary(): Promise<KpiGroupSummary> {
    const result = await this.db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
       FROM crm_kpi_groups
       WHERE tenant_id = $1 AND deleted_at IS NULL
       GROUP BY status`,
      [KPI_GROUPS_TENANT_ID],
    );
    let total = 0;
    let active = 0;
    let draft = 0;
    let inactive = 0;
    for (const row of result.rows) {
      const cnt = Number(row.count);
      total += cnt;
      if (row.status === 'ACTIVE') active = cnt;
      if (row.status === 'DRAFT') draft = cnt;
      if (row.status === 'INACTIVE') inactive = cnt;
    }
    return { total, active, draft, inactive };
  }

  async getGroupById(id: string): Promise<KpiGroupRow | null> {
    const result = await this.db.query(
      `${this.selectBaseSql()}
       WHERE g.tenant_id = $1 AND g.id = $2::uuid AND g.deleted_at IS NULL
       LIMIT 1`,
      [KPI_GROUPS_TENANT_ID, id],
    );
    const row = result.rows[0] as DbGroupRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  toDetail(row: KpiGroupRow): KpiGroupDetail {
    const item = this.toListItem(row);
    return {
      ...item,
      tenant_id: row.tenant_id,
      parent_id: row.parent_id,
      suggested_unit_types: row.suggested_unit_types,
      data_domains: row.data_domains,
      created_by_staff_id: row.created_by_staff_id,
      created_at: row.created_at,
    };
  }

  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    const params: unknown[] = [KPI_GROUPS_TENANT_ID, code.trim().toUpperCase()];
    let sql = `SELECT 1 FROM crm_kpi_groups
               WHERE tenant_id = $1 AND upper(code) = $2 AND deleted_at IS NULL`;
    if (excludeId) {
      sql += ` AND id != $3::uuid`;
      params.push(excludeId);
    }
    const result = await this.db.query(sql, params);
    return result.rows.length > 0;
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const params: unknown[] = [KPI_GROUPS_TENANT_ID, name.trim()];
    let sql = `SELECT 1 FROM crm_kpi_groups
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
       FROM crm_kpi_groups
       WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [KPI_GROUPS_TENANT_ID],
    );
    const max = Number(result.rows[0]?.max ?? 0);
    return (Number.isFinite(max) ? max : 0) + 1;
  }

  async getUsageCount(groupId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM crm_kpi_metrics WHERE group_id = $1::uuid`,
      [groupId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async replaceJunctions(
    client: Pool | import('pg').PoolClient,
    groupId: string,
    departmentIds: number[],
    positionIds: number[],
    unitTypes: string[],
    dataDomains: string[],
  ): Promise<void> {
    await client.query(`DELETE FROM crm_kpi_group_departments WHERE group_id = $1::uuid`, [groupId]);
    await client.query(`DELETE FROM crm_kpi_group_positions WHERE group_id = $1::uuid`, [groupId]);
    await client.query(`DELETE FROM crm_kpi_group_unit_types WHERE group_id = $1::uuid`, [groupId]);
    await client.query(`DELETE FROM crm_kpi_group_data_domains WHERE group_id = $1::uuid`, [groupId]);

    for (const deptId of departmentIds) {
      await client.query(
        `INSERT INTO crm_kpi_group_departments (group_id, department_id) VALUES ($1::uuid, $2)`,
        [groupId, deptId],
      );
    }
    for (const posId of positionIds) {
      await client.query(
        `INSERT INTO crm_kpi_group_positions (group_id, position_id) VALUES ($1::uuid, $2)`,
        [groupId, posId],
      );
    }
    for (const ut of unitTypes) {
      await client.query(
        `INSERT INTO crm_kpi_group_unit_types (group_id, unit_type) VALUES ($1::uuid, $2)`,
        [groupId, ut],
      );
    }
    for (const dd of dataDomains) {
      await client.query(
        `INSERT INTO crm_kpi_group_data_domains (group_id, data_domain) VALUES ($1::uuid, $2)`,
        [groupId, dd],
      );
    }
  }

  async insertGroup(
    staffId: number,
    body: CreateKpiGroupBody & {
      display_order: number;
      status: KpiGroupStatus;
      department_ids: number[];
      position_ids: number[];
      suggested_unit_types: string[];
      data_domains: string[];
    },
  ): Promise<KpiGroupRow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO crm_kpi_groups (
           tenant_id, code, name, description, scope_type, default_direction,
           color, icon, display_order, status, is_system_default,
           created_by_staff_id, updated_by_staff_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, $11)
         RETURNING id`,
        [
          KPI_GROUPS_TENANT_ID,
          body.code.trim().toUpperCase(),
          body.name.trim(),
          body.description?.trim().slice(0, 500) ?? null,
          body.scope_type,
          body.default_direction,
          body.color ?? '#17B6A4',
          body.icon?.trim().slice(0, 100) ?? null,
          body.display_order,
          body.status,
          staffId,
        ],
      );
      const groupId = String(result.rows[0].id);
      await this.replaceJunctions(
        client,
        groupId,
        body.department_ids,
        body.position_ids,
        body.suggested_unit_types,
        body.data_domains,
      );
      await client.query('COMMIT');
      const row = await this.getGroupById(groupId);
      if (!row) throw new Error('Failed to load inserted group');
      return row;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async patchGroup(
    staffId: number,
    id: string,
    expectedVersion: number,
    patch: PatchKpiGroupBody & {
      department_ids?: number[];
      position_ids?: number[];
      suggested_unit_types?: string[];
      data_domains?: string[];
    },
  ): Promise<KpiGroupRow | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        `SELECT * FROM crm_kpi_groups
         WHERE tenant_id = $1 AND id = $2::uuid AND deleted_at IS NULL
         FOR UPDATE`,
        [KPI_GROUPS_TENANT_ID, id],
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

      if (patch.code != null) setField('code', String(patch.code).trim().toUpperCase());
      if (patch.name != null) setField('name', String(patch.name).trim());
      if ('description' in patch) {
        setField('description', patch.description?.trim().slice(0, 500) ?? null);
      }
      if (patch.scope_type != null) setField('scope_type', patch.scope_type);
      if (patch.default_direction != null) setField('default_direction', patch.default_direction);
      if (patch.color != null) setField('color', patch.color);
      if ('icon' in patch) setField('icon', patch.icon?.trim().slice(0, 100) ?? null);
      if (patch.display_order != null) setField('display_order', patch.display_order);
      if (patch.status != null) setField('status', patch.status);

      sets.push(`updated_by_staff_id = $${idx}`);
      params.push(staffId);
      idx += 1;
      sets.push(`updated_at = NOW()`);
      sets.push(`row_version = row_version + 1`);

      params.push(KPI_GROUPS_TENANT_ID, id);
      await client.query(
        `UPDATE crm_kpi_groups SET ${sets.join(', ')}
         WHERE tenant_id = $${idx} AND id = $${idx + 1}::uuid`,
        params,
      );

      if (
        patch.department_ids != null ||
        patch.position_ids != null ||
        patch.suggested_unit_types != null ||
        patch.data_domains != null
      ) {
        const current = await this.getGroupById(id);
        await this.replaceJunctions(
          client,
          id,
          patch.department_ids ?? current?.department_ids ?? [],
          patch.position_ids ?? current?.position_ids ?? [],
          patch.suggested_unit_types ?? current?.suggested_unit_types ?? [],
          patch.data_domains ?? current?.data_domains ?? [],
        );
      }

      await client.query('COMMIT');
      return this.getGroupById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateStatus(
    staffId: number,
    id: string,
    status: KpiGroupStatus,
  ): Promise<KpiGroupRow | null> {
    const result = await this.db.query(
      `UPDATE crm_kpi_groups
       SET status = $1, updated_by_staff_id = $2, updated_at = NOW(), row_version = row_version + 1
       WHERE tenant_id = $3 AND id = $4::uuid AND deleted_at IS NULL
       RETURNING id`,
      [status, staffId, KPI_GROUPS_TENANT_ID, id],
    );
    if (result.rows.length === 0) return null;
    return this.getGroupById(id);
  }

  async softDeleteGroup(staffId: number, id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE crm_kpi_groups
       SET deleted_at = NOW(), deleted_by_staff_id = $1, updated_at = NOW(), row_version = row_version + 1
       WHERE tenant_id = $2 AND id = $3::uuid AND deleted_at IS NULL`,
      [staffId, KPI_GROUPS_TENANT_ID, id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateDisplayOrders(
    staffId: number,
    items: Array<{ id: string; display_order: number }>,
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query(
          `UPDATE crm_kpi_groups
           SET display_order = $1, updated_by_staff_id = $2, updated_at = NOW(), row_version = row_version + 1
           WHERE tenant_id = $3 AND id = $4::uuid AND deleted_at IS NULL`,
          [item.display_order, staffId, KPI_GROUPS_TENANT_ID, item.id],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
