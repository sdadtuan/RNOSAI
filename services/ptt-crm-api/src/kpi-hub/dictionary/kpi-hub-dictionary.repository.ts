import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { buildDictionaryFixtures } from '../kpi-hub.fixtures';
import { isMissingRelationError, kpiHubMemory, withDbFallback } from '../kpi-hub.memory-store';
import {
  KPI_HUB_DEFAULT_WORKSPACE_ID,
  KPI_HUB_TENANT_ID,
  type CreateHubDictionaryBody,
  type HubDictionaryListItem,
  type HubDictionaryListQuery,
  type HubDictionaryRow,
  type HubDictionarySummary,
  type PatchHubDictionaryBody,
} from '../kpi-hub.types';

@Injectable()
export class KpiHubDictionaryRepository implements OnModuleDestroy {
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

  private mapRow(row: Record<string, unknown>): HubDictionaryRow {
    const kpiOwner = (row.kpi_owner_json ?? {}) as Record<string, unknown>;
    const dataOwner = (row.data_owner_json ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      workspace_id: String(row.workspace_id),
      code: String(row.code),
      name: String(row.name),
      description: row.description != null ? String(row.description) : null,
      kpi_group: String(row.kpi_group ?? 'General'),
      kpi_group_color: String(row.kpi_group_color ?? '#64748B'),
      kpi_type_id: row.kpi_type_id != null ? String(row.kpi_type_id) : null,
      direction: String(row.direction) as HubDictionaryRow['direction'],
      unit: String(row.unit ?? ''),
      decimal_places: Number(row.decimal_places ?? 0),
      calc_kind: String(row.calc_kind ?? 'COUNT') as HubDictionaryRow['calc_kind'],
      formula_display: row.formula_display != null ? String(row.formula_display) : null,
      tech_preview: row.tech_preview != null ? String(row.tech_preview) : null,
      business_formula: row.business_formula != null ? String(row.business_formula) : null,
      blank_if_zero: Boolean(row.blank_if_zero),
      non_additive_ratio: Boolean(row.non_additive_ratio),
      allow_manual: Boolean(row.allow_manual),
      numerator_code: row.numerator_code != null ? String(row.numerator_code) : null,
      denominator_code: row.denominator_code != null ? String(row.denominator_code) : null,
      primary_source: String(row.primary_source ?? ''),
      sync_frequency: String(row.sync_frequency ?? 'Hàng ngày 08:00'),
      kpi_owner: {
        id: Number(kpiOwner.id ?? 101),
        name: String(kpiOwner.name ?? 'Performance MKT'),
        email: kpiOwner.email != null ? String(kpiOwner.email) : undefined,
      },
      data_owner: {
        id: Number(dataOwner.id ?? 102),
        name: String(dataOwner.name ?? 'Nguyễn Thị Lan'),
        email: dataOwner.email != null ? String(dataOwner.email) : undefined,
      },
      status: String(row.status) as HubDictionaryRow['status'],
      current_version: Number(row.current_version ?? 0),
      published_at: row.published_at != null ? new Date(String(row.published_at)).toISOString() : null,
      row_version: Number(row.row_version ?? 1),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
      deleted_at: row.deleted_at != null ? new Date(String(row.deleted_at)).toISOString() : null,
    };
  }

  private toListItem(row: HubDictionaryRow): HubDictionaryListItem {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      kpi_group: row.kpi_group,
      kpi_group_color: row.kpi_group_color,
      primary_source: row.primary_source,
      sync_frequency: row.sync_frequency,
      data_owner: row.data_owner,
      status: row.status,
      direction: row.direction,
      unit: row.unit,
      updated_at: row.updated_at,
    };
  }

  private filterMemory(query: HubDictionaryListQuery): HubDictionaryRow[] {
    let rows = kpiHubMemory.snapshotDictionary();
    const q = String(query.q ?? '').trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.primary_source.toLowerCase().includes(q),
      );
    }
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    if (query.kpi_group) rows = rows.filter((r) => r.kpi_group === query.kpi_group);
    if (query.data_owner_id) rows = rows.filter((r) => r.data_owner.id === query.data_owner_id);
    return rows;
  }

  async list(query: HubDictionaryListQuery): Promise<{ items: HubDictionaryListItem[]; total: number }> {
    return withDbFallback(async () => {
      const page = Math.max(1, Number(query.page ?? 1) || 1);
      const pageSize = [20, 50, 100].includes(Number(query.page_size)) ? Number(query.page_size) : 20;
      const params: unknown[] = [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID];
      let where = 'tenant_id = $1 AND workspace_id = $2::uuid AND deleted_at IS NULL';
      if (query.q) {
        params.push(`%${String(query.q).trim()}%`);
        where += ` AND (lower(code) LIKE lower($${params.length}) OR lower(name) LIKE lower($${params.length}) OR lower(primary_source) LIKE lower($${params.length}))`;
      }
      if (query.status) {
        params.push(query.status);
        where += ` AND status = $${params.length}`;
      }
      const countRes = await this.db.query(`SELECT COUNT(*)::int AS c FROM crm_kpi_dictionary WHERE ${where}`, params);
      const total = Number(countRes.rows[0]?.c ?? 0);
      if (total === 0) return null;
      kpiHubMemory.useDb = true;
      params.push(pageSize, (page - 1) * pageSize);
      const res = await this.db.query(
        `SELECT * FROM crm_kpi_dictionary WHERE ${where}
         ORDER BY code ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      return {
        items: res.rows.map((r) => this.toListItem(this.mapRow(r as Record<string, unknown>))),
        total,
      };
    }, () => {
      const rows = this.filterMemory(query);
      const page = Math.max(1, Number(query.page ?? 1) || 1);
      const pageSize = [20, 50, 100].includes(Number(query.page_size)) ? Number(query.page_size) : 20;
      const start = (page - 1) * pageSize;
      return { items: rows.slice(start, start + pageSize).map((r) => this.toListItem(r)), total: rows.length };
    });
  }

  async summary(): Promise<HubDictionarySummary> {
    return withDbFallback(async () => {
      const res = await this.db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
           COUNT(*) FILTER (WHERE status = 'NEED_REVIEW')::int AS need_review
         FROM crm_kpi_dictionary
         WHERE tenant_id = $1 AND workspace_id = $2::uuid AND deleted_at IS NULL`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID],
      );
      const row = res.rows[0] as Record<string, unknown>;
      const total = Number(row?.total ?? 0);
      if (total === 0) return null;
      kpiHubMemory.useDb = true;
      const srcRes = await this.db.query(
        `SELECT COUNT(DISTINCT primary_source)::int AS c FROM crm_kpi_dictionary
         WHERE tenant_id = $1 AND workspace_id = $2::uuid AND deleted_at IS NULL`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID],
      );
      return {
        total,
        active: Number(row.active ?? 0),
        need_review: Number(row.need_review ?? 0),
        source_count: Number(srcRes.rows[0]?.c ?? 7),
      };
    }, () => {
      const rows = kpiHubMemory.snapshotDictionary();
      const sources = new Set(rows.map((r) => r.primary_source.split('/')[0]?.trim()).filter(Boolean));
      return {
        total: rows.length,
        active: rows.filter((r) => r.status === 'ACTIVE').length,
        need_review: rows.filter((r) => r.status === 'NEED_REVIEW').length,
        source_count: Math.max(sources.size, 7),
      };
    });
  }

  async getById(id: string): Promise<HubDictionaryRow | null> {
    return withDbFallback(async () => {
      const res = await this.db.query(
        `SELECT * FROM crm_kpi_dictionary
         WHERE tenant_id = $1 AND workspace_id = $2::uuid AND id = $3::uuid AND deleted_at IS NULL`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, id],
      );
      if (res.rows.length === 0) return null;
      kpiHubMemory.useDb = true;
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => kpiHubMemory.snapshotDictionary().find((r) => r.id === id) ?? null);
  }

  async getByCode(code: string): Promise<HubDictionaryRow | null> {
    return withDbFallback(async () => {
      const res = await this.db.query(
        `SELECT * FROM crm_kpi_dictionary
         WHERE tenant_id = $1 AND workspace_id = $2::uuid AND code = $3 AND deleted_at IS NULL`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, code],
      );
      if (res.rows.length === 0) return null;
      kpiHubMemory.useDb = true;
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => kpiHubMemory.snapshotDictionary().find((r) => r.code === code) ?? null);
  }

  async create(body: CreateHubDictionaryBody, staffId: number): Promise<HubDictionaryRow> {
    return withDbFallback(async () => {
      const id = randomUUID();
      const res = await this.db.query(
        `INSERT INTO crm_kpi_dictionary (
          id, tenant_id, workspace_id, code, name, description, kpi_group, direction, unit,
          calc_kind, status, kpi_owner_json, data_owner_json, created_by_staff_id, updated_by_staff_id
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', $11::jsonb, $12::jsonb, $13, $13
        ) RETURNING *`,
        [
          id,
          KPI_HUB_TENANT_ID,
          KPI_HUB_DEFAULT_WORKSPACE_ID,
          body.code,
          body.name,
          body.description ?? null,
          body.kpi_group ?? 'General',
          body.direction ?? 'HIGHER_IS_BETTER',
          body.unit ?? '',
          body.calc_kind ?? 'COUNT',
          JSON.stringify({ id: body.kpi_owner_id ?? 101, name: 'Performance MKT' }),
          JSON.stringify({ id: body.data_owner_id ?? 102, name: 'Nguyễn Thị Lan' }),
          staffId,
        ],
      );
      kpiHubMemory.useDb = true;
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => {
      const row: HubDictionaryRow = {
        id: randomUUID(),
        tenant_id: KPI_HUB_TENANT_ID,
        workspace_id: KPI_HUB_DEFAULT_WORKSPACE_ID,
        code: body.code,
        name: body.name,
        description: body.description ?? null,
        kpi_group: body.kpi_group ?? 'General',
        kpi_group_color: '#64748B',
        kpi_type_id: null,
        direction: body.direction ?? 'HIGHER_IS_BETTER',
        unit: body.unit ?? '',
        decimal_places: 0,
        calc_kind: body.calc_kind ?? 'COUNT',
        formula_display: null,
        tech_preview: null,
        business_formula: null,
        blank_if_zero: false,
        non_additive_ratio: false,
        allow_manual: false,
        numerator_code: null,
        denominator_code: null,
        primary_source: '',
        sync_frequency: 'Hàng ngày 08:00',
        kpi_owner: { id: body.kpi_owner_id ?? 101, name: 'Performance MKT' },
        data_owner: { id: body.data_owner_id ?? 102, name: 'Nguyễn Thị Lan' },
        status: 'DRAFT',
        current_version: 0,
        published_at: null,
        row_version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      kpiHubMemory.dictionary.push(row);
      return row;
    });
  }

  async patch(id: string, body: PatchHubDictionaryBody, rowVersion: number): Promise<HubDictionaryRow | null> {
    return withDbFallback(async () => {
      const fields: string[] = [];
      const values: unknown[] = [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, id, rowVersion];
      let idx = 5;
      for (const [key, val] of Object.entries(body)) {
        if (val !== undefined && key !== 'kpi_owner_id' && key !== 'data_owner_id') {
          fields.push(`${key} = $${idx}`);
          values.push(val);
          idx += 1;
        }
      }
      if (fields.length === 0) return this.getById(id);
      fields.push('updated_at = NOW()', 'row_version = row_version + 1');
      const res = await this.db.query(
        `UPDATE crm_kpi_dictionary SET ${fields.join(', ')}
         WHERE tenant_id = $1 AND workspace_id = $2::uuid AND id = $3::uuid
           AND row_version = $4 AND deleted_at IS NULL RETURNING *`,
        values,
      );
      if (res.rows.length === 0) return null;
      kpiHubMemory.useDb = true;
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => {
      const idx = kpiHubMemory.dictionary.findIndex((r) => r.id === id && !r.deleted_at);
      if (idx < 0) return null;
      if (kpiHubMemory.dictionary[idx].row_version !== rowVersion) return null;
      kpiHubMemory.dictionary[idx] = {
        ...kpiHubMemory.dictionary[idx],
        ...body,
        updated_at: new Date().toISOString(),
        row_version: rowVersion + 1,
      };
      return { ...kpiHubMemory.dictionary[idx] };
    });
  }

  async publish(id: string, rowVersion: number): Promise<HubDictionaryRow | null> {
    return withDbFallback(async () => {
      const res = await this.db.query(
        `UPDATE crm_kpi_dictionary
         SET status = 'ACTIVE', current_version = current_version + 1,
             published_at = NOW(), updated_at = NOW(), row_version = row_version + 1
         WHERE tenant_id = $1 AND workspace_id = $2::uuid AND id = $3::uuid
           AND row_version = $4 AND deleted_at IS NULL RETURNING *`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID, id, rowVersion],
      );
      if (res.rows.length === 0) return null;
      kpiHubMemory.useDb = true;
      return this.mapRow(res.rows[0] as Record<string, unknown>);
    }, () => {
      const idx = kpiHubMemory.dictionary.findIndex((r) => r.id === id && !r.deleted_at);
      if (idx < 0) return null;
      if (kpiHubMemory.dictionary[idx].row_version !== rowVersion) return null;
      kpiHubMemory.dictionary[idx] = {
        ...kpiHubMemory.dictionary[idx],
        status: 'ACTIVE',
        current_version: kpiHubMemory.dictionary[idx].current_version + 1,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        row_version: rowVersion + 1,
      };
      return { ...kpiHubMemory.dictionary[idx] };
    });
  }

  async duplicate(sourceId: string, code: string, name: string, staffId: number): Promise<HubDictionaryRow> {
    const source = await this.getById(sourceId);
    if (!source) throw new Error('NOT_FOUND');
    return this.create(
      {
        code,
        name,
        description: source.description ?? undefined,
        kpi_group: source.kpi_group,
        direction: source.direction,
        unit: source.unit,
        calc_kind: source.calc_kind,
        kpi_owner_id: source.kpi_owner.id,
        data_owner_id: source.data_owner.id,
      },
      staffId,
    );
  }

  async seedIfEmpty(): Promise<void> {
    try {
      const res = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM crm_kpi_dictionary WHERE tenant_id = $1 AND workspace_id = $2::uuid`,
        [KPI_HUB_TENANT_ID, KPI_HUB_DEFAULT_WORKSPACE_ID],
      );
      if (Number(res.rows[0]?.c) > 0) {
        kpiHubMemory.useDb = true;
        return;
      }
      for (const row of buildDictionaryFixtures()) {
        await this.db.query(
          `INSERT INTO crm_kpi_dictionary (
            id, tenant_id, workspace_id, code, name, description, kpi_group, kpi_group_color,
            direction, unit, decimal_places, calc_kind, formula_display, tech_preview, business_formula,
            blank_if_zero, non_additive_ratio, allow_manual, numerator_code, denominator_code,
            primary_source, sync_frequency, kpi_owner_json, data_owner_json, status, current_version,
            published_at, row_version
          ) VALUES (
            $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23::jsonb, $24::jsonb, $25, $26, $27, $28
          ) ON CONFLICT DO NOTHING`,
          [
            row.id,
            row.tenant_id,
            row.workspace_id,
            row.code,
            row.name,
            row.description,
            row.kpi_group,
            row.kpi_group_color,
            row.direction,
            row.unit,
            row.decimal_places,
            row.calc_kind,
            row.formula_display,
            row.tech_preview,
            row.business_formula,
            row.blank_if_zero,
            row.non_additive_ratio,
            row.allow_manual,
            row.numerator_code,
            row.denominator_code,
            row.primary_source,
            row.sync_frequency,
            JSON.stringify(row.kpi_owner),
            JSON.stringify(row.data_owner),
            row.status,
            row.current_version,
            row.published_at,
            row.row_version,
          ],
        );
      }
      kpiHubMemory.useDb = true;
    } catch (err) {
      if (!isMissingRelationError(err)) throw err;
    }
  }

  allCodes(): string[] {
    return kpiHubMemory.snapshotDictionary().map((r) => r.code);
  }
}
