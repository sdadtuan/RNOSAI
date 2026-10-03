import { Pool, type PoolClient } from 'pg';
import type { CatalogRow, CatalogStore, CatalogTable, CatalogTx } from './memory-catalog';
import { p13SchemaSql, withP13SchemaLock } from '../p13-sql';

type Queryable = Pick<PoolClient, 'query'>;

export class PgCatalog implements CatalogStore {
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly pool: Pool) {}

  private ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = withP13SchemaLock(this.pool, p13SchemaSql()).catch((error: unknown) => {
        this.schemaReady = null;
        throw error;
      });
    }
    return this.schemaReady;
  }

  async transaction<T>(fn: (tx: CatalogTx) => Promise<T>, opts: { dryRun: boolean }): Promise<T> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(new PgTx(client));
      await client.query(opts.dryRun ? 'ROLLBACK' : 'COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async query<T extends CatalogRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.ensureSchema();
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }
}

class PgTx implements CatalogTx {
  constructor(private readonly db: Queryable) {}

  async get(table: CatalogTable, code: string): Promise<CatalogRow | null> {
    const sql = GET_SQL[table];
    const result = await this.db.query(sql, [code]);
    return (result.rows[0] as CatalogRow | undefined) ?? null;
  }

  async put(table: CatalogTable, code: string, row: CatalogRow): Promise<void> {
    await PUT[table](this.db, code, row);
  }

  async listCodes(table: CatalogTable, serviceCode?: string): Promise<string[]> {
    if (table === 'items' && serviceCode) {
      const result = await this.db.query(
        `SELECT i.code
           FROM crm_service_items i
           JOIN crm_services s ON s.id = i.service_id
          WHERE s.code = $1`,
        [serviceCode],
      );
      return result.rows.map((row) => String((row as { code: string }).code));
    }
    const result = await this.db.query(`SELECT code FROM ${TABLE[table]}`);
    return result.rows.map((row) => String((row as { code: string }).code));
  }

  async deactivateItems(codes: string[]): Promise<number> {
    if (!codes.length) return 0;
    const result = await this.db.query(
      `UPDATE crm_service_items
          SET is_active = FALSE, updated_at = NOW()
        WHERE code = ANY($1::text[]) AND is_active IS TRUE`,
      [codes],
    );
    return result.rowCount ?? 0;
  }

  async getScope(serviceCode: string, sortOrder: number): Promise<CatalogRow | null> {
    const result = await this.db.query(
      `SELECT r.feature, r.basic_text, r.standard_text, r.advanced_text, r.sort_order, s.code AS service_code
         FROM crm_service_scope_rows r
         JOIN crm_services s ON s.id = r.service_id
        WHERE s.code = $1 AND r.sort_order = $2`,
      [serviceCode, sortOrder],
    );
    return (result.rows[0] as CatalogRow | undefined) ?? null;
  }

  async putScope(serviceCode: string, sortOrder: number, row: CatalogRow): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_service_scope_rows
         (service_id, sort_order, feature, basic_text, standard_text, advanced_text)
       SELECT s.id, $2, $3, $4, $5, $6
         FROM crm_services s WHERE s.code = $1
       ON CONFLICT (service_id, sort_order) DO UPDATE
         SET feature = EXCLUDED.feature,
             basic_text = EXCLUDED.basic_text,
             standard_text = EXCLUDED.standard_text,
             advanced_text = EXCLUDED.advanced_text,
             updated_at = NOW()`,
      [serviceCode, sortOrder, row.feature, row.basic_text, row.standard_text, row.advanced_text],
    );
  }

  async deleteScope(serviceCode: string, sortOrder: number): Promise<void> {
    await this.db.query(
      `DELETE FROM crm_service_scope_rows r
        USING crm_services s
        WHERE r.service_id = s.id AND s.code = $1 AND r.sort_order = $2`,
      [serviceCode, sortOrder],
    );
  }

  async listScopeSorts(serviceCode: string): Promise<number[]> {
    const result = await this.db.query(
      `SELECT r.sort_order
         FROM crm_service_scope_rows r
         JOIN crm_services s ON s.id = r.service_id
        WHERE s.code = $1`,
      [serviceCode],
    );
    return result.rows.map((row) => Number((row as { sort_order: number }).sort_order));
  }

  async setRetainer(templates: unknown[], catalogVersion: string): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_p13_catalog_meta (id, retainer_templates, catalog_version)
       VALUES (1, $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE
         SET retainer_templates = EXCLUDED.retainer_templates,
             catalog_version = EXCLUDED.catalog_version,
             updated_at = NOW()`,
      [JSON.stringify(templates), catalogVersion],
    );
  }

  async recordImport(row: CatalogRow): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_catalog_imports
         (file_name, file_sha256, schema_version, catalog_version, mode, summary_json, run_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        row.file_name,
        row.file_sha256,
        row.schema_version,
        row.catalog_version,
        row.mode,
        JSON.stringify(row.summary_json ?? {}),
        row.run_by,
      ],
    );
  }

  async recordAudit(row: CatalogRow): Promise<void> {
    await this.db.query(
      `INSERT INTO admin_audit_log
         (event_type, actor_email, category, severity, subject_label, subject_id, action, summary, diff_json)
       SELECT 'p13_catalog', $1, 'p13', 'info', 'catalog', 'p13', $2, $3, $4::jsonb
        WHERE to_regclass('public.admin_audit_log') IS NOT NULL`,
      [String(row.actor ?? ''), String(row.action ?? ''), String(row.action ?? ''), JSON.stringify(row.summary ?? {})],
    );
  }
}

const TABLE: Record<CatalogTable, string> = {
  groups: 'crm_service_groups',
  levels: 'crm_service_levels',
  phases: 'crm_service_phases',
  services: 'crm_services',
  items: 'crm_service_items',
  inputs: 'crm_service_inputs',
  deliverables: 'crm_service_deliverables',
  kpis: 'crm_service_kpis',
  risks: 'crm_service_risks',
};

const GET_SQL: Record<CatalogTable, string> = {
  groups: `SELECT code, name, sort_order, is_active FROM crm_service_groups WHERE code = $1`,
  levels: `SELECT code, name, rank FROM crm_service_levels WHERE code = $1`,
  phases: `SELECT code, name, seq FROM crm_service_phases WHERE code = $1`,
  services: `SELECT s.code, g.code AS group_code, s.name, s.sort_order, s.objective, s.problem,
                    s.target_customers, s.prerequisites, s.exclusions, s.billing_model, s.meta_json,
                    s.legacy_sku_code, s.catalog_version, s.is_active
               FROM crm_services s JOIN crm_service_groups g ON g.id = s.group_id
              WHERE s.code = $1`,
  items: `SELECT i.code, s.code AS service_code, i.phase_code, i.seq_in_phase, i.sort_order, i.task,
                 i.subtask, i.standard, i.raci, i.main_role_code, i.tool, i.deliverable, i.approval_gate,
                 i.gate_approver, i.min_level, i.est_hours::text AS est_hours, i.est_hours_is_assumption,
                 i.est_hours_source, i.unit, i.default_qty::text AS default_qty, i.billable, i.client_only,
                 i.is_common, i.is_active, i.created_by
            FROM crm_service_items i JOIN crm_services s ON s.id = i.service_id
           WHERE i.code = $1`,
  inputs: `SELECT i.code, s.code AS service_code, i.type, i.name, i.format_or_permission, i.sort_order, TRUE AS is_active
             FROM crm_service_inputs i JOIN crm_services s ON s.id = i.service_id WHERE i.code = $1`,
  deliverables: `SELECT d.code, s.code AS service_code, d.name, d.format, d.owner_role_code,
                        d.acceptance_criteria, d.revision_limit_text, d.approval_gate, d.sort_order, TRUE AS is_active
                   FROM crm_service_deliverables d JOIN crm_services s ON s.id = d.service_id WHERE d.code = $1`,
  kpis: `SELECT k.code, s.code AS service_code, k.type, k.name, k.formula, k.data_source, k.frequency,
                k.owner_role_code, k.sort_order, TRUE AS is_active
           FROM crm_service_kpis k JOIN crm_services s ON s.id = k.service_id WHERE k.code = $1`,
  risks: `SELECT r.code, s.code AS service_code, r.risk, r.likelihood, r.impact, r.mitigation,
                 r.owner_role_code, r.sort_order, TRUE AS is_active
            FROM crm_service_risks r JOIN crm_services s ON s.id = r.service_id WHERE r.code = $1`,
};

const PUT: Record<CatalogTable, (db: Queryable, code: string, row: CatalogRow) => Promise<void>> = {
  groups: async (db, code, row) => {
    await db.query(
      `INSERT INTO crm_service_groups (code, name, sort_order, is_active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active, updated_at = NOW()`,
      [code, row.name, row.sort_order, row.is_active !== false],
    );
  },
  levels: async (db, code, row) => {
    await db.query(
      `INSERT INTO crm_service_levels (code, name, rank) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, rank = EXCLUDED.rank, updated_at = NOW()`,
      [code, row.name, row.rank],
    );
  },
  phases: async (db, code, row) => {
    await db.query(
      `INSERT INTO crm_service_phases (code, name, seq) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, seq = EXCLUDED.seq, updated_at = NOW()`,
      [code, row.name, row.seq],
    );
  },
  services: async (db, code, row) => {
    await db.query(
      `INSERT INTO crm_services
         (code, group_id, name, sort_order, objective, problem, target_customers, prerequisites,
          exclusions, billing_model, meta_json, legacy_sku_code, catalog_version, is_active)
       SELECT $1, g.id, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12, $13, $14
         FROM crm_service_groups g WHERE g.code = $2
       ON CONFLICT (code) DO UPDATE SET
         group_id = EXCLUDED.group_id, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order,
         objective = EXCLUDED.objective, problem = EXCLUDED.problem,
         target_customers = EXCLUDED.target_customers, prerequisites = EXCLUDED.prerequisites,
         exclusions = EXCLUDED.exclusions, billing_model = EXCLUDED.billing_model,
         meta_json = EXCLUDED.meta_json, legacy_sku_code = EXCLUDED.legacy_sku_code,
         catalog_version = EXCLUDED.catalog_version, is_active = EXCLUDED.is_active, updated_at = NOW()`,
      [
        code,
        row.group_code,
        row.name,
        row.sort_order,
        row.objective,
        row.problem,
        row.target_customers,
        row.prerequisites,
        JSON.stringify(row.exclusions ?? []),
        row.billing_model,
        JSON.stringify(row.meta_json ?? {}),
        row.legacy_sku_code,
        row.catalog_version,
        row.is_active !== false,
      ],
    );
  },
  items: async (db, code, row) => {
    await db.query(
      `INSERT INTO crm_service_items
         (code, service_id, phase_code, seq_in_phase, sort_order, task, subtask, standard, raci,
          main_role_code, tool, deliverable, approval_gate, gate_approver, min_level, est_hours,
          est_hours_is_assumption, est_hours_source, unit, default_qty, billable, client_only, is_common, is_active)
       SELECT $1, s.id, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16,
              $17, $18, $19, $20, $21, $22, $23, $24
         FROM crm_services s WHERE s.code = $2
       ON CONFLICT (code) DO UPDATE SET
         service_id = EXCLUDED.service_id, phase_code = EXCLUDED.phase_code, seq_in_phase = EXCLUDED.seq_in_phase,
         sort_order = EXCLUDED.sort_order, task = EXCLUDED.task, subtask = EXCLUDED.subtask, standard = EXCLUDED.standard,
         raci = EXCLUDED.raci, main_role_code = EXCLUDED.main_role_code, tool = EXCLUDED.tool,
         deliverable = EXCLUDED.deliverable, approval_gate = EXCLUDED.approval_gate, gate_approver = EXCLUDED.gate_approver,
         min_level = EXCLUDED.min_level, est_hours = EXCLUDED.est_hours,
         est_hours_is_assumption = EXCLUDED.est_hours_is_assumption, est_hours_source = EXCLUDED.est_hours_source,
         unit = EXCLUDED.unit, default_qty = EXCLUDED.default_qty, billable = EXCLUDED.billable,
         client_only = EXCLUDED.client_only, is_common = EXCLUDED.is_common, is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [
        code,
        row.service_code,
        row.phase_code,
        row.seq_in_phase,
        row.sort_order,
        row.task,
        row.subtask,
        row.standard,
        JSON.stringify(row.raci ?? {}),
        row.main_role_code,
        row.tool,
        row.deliverable,
        row.approval_gate === true,
        row.gate_approver,
        row.min_level,
        row.est_hours,
        row.est_hours_is_assumption !== false,
        row.est_hours_source ?? 'seed',
        row.unit,
        row.default_qty,
        row.billable === true,
        row.client_only === true,
        row.is_common === true,
        row.is_active !== false,
      ],
    );
  },
  inputs: (db, code, row) => putChild(db, 'crm_service_inputs', code, row, ['type', 'name', 'format_or_permission']),
  deliverables: (db, code, row) =>
    putChild(db, 'crm_service_deliverables', code, row, [
      'name',
      'format',
      'owner_role_code',
      'acceptance_criteria',
      'revision_limit_text',
      'approval_gate',
    ]),
  kpis: (db, code, row) =>
    putChild(db, 'crm_service_kpis', code, row, ['type', 'name', 'formula', 'data_source', 'frequency', 'owner_role_code']),
  risks: (db, code, row) =>
    putChild(db, 'crm_service_risks', code, row, ['risk', 'likelihood', 'impact', 'mitigation', 'owner_role_code']),
};

async function putChild(db: Queryable, table: string, code: string, row: CatalogRow, fields: string[]): Promise<void> {
  const columns = ['code', 'service_id', 'sort_order', ...fields];
  const updates = ['sort_order', ...fields].map((field) => `${field} = EXCLUDED.${field}`).join(', ');
  const values = fields.map((field) => row[field] ?? null);
  await db.query(
    `INSERT INTO ${table} (${columns.join(', ')})
     SELECT $1, s.id, $3, ${fields.map((_, index) => `$${index + 4}`).join(', ')}
       FROM crm_services s WHERE s.code = $2
     ON CONFLICT (code) DO UPDATE SET ${updates}, updated_at = NOW()`,
    [code, row.service_code, row.sort_order, ...values],
  );
}
