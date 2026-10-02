import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Pool } from 'pg';
import { AdminAuditRepository } from '../../admin-audit/admin-audit.repository';
import { AppConfigService } from '../../config/app-config.service';
import { CatalogPatchError, applyItemPatch, type ItemPatchBody } from './catalog-item-patch';
import { CatalogSchemaError } from './catalog-seed';
import { importCatalog, sha256Text, type ImportOptions, type ImportSummary } from './catalog-import';
import { PgCatalog } from './pg-catalog';

const LEVEL_RANK: Record<string, number> = { basic: 1, standard: 2, advanced: 3 };

function addDecimal(left: string, hours: string, qty: string): string {
  const base = Math.round(Number(left) * 100);
  const product = Math.round(Number(hours) * Number(qty) * 100);
  return ((base + product) / 100).toFixed(2);
}

@Injectable()
export class P13CatalogService {
  private pool: Pool | null = null;
  private catalog: PgCatalog | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly audit: AdminAuditRepository,
  ) {}

  private db(): PgCatalog {
    if (!this.catalog) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
      this.catalog = new PgCatalog(this.pool);
    }
    return this.catalog;
  }

  async listGroups(): Promise<unknown[]> {
    return this.db().query(
      `SELECT g.code, g.name, g.sort_order,
              COUNT(DISTINCT s.id)::int AS service_count,
              COUNT(i.id) FILTER (WHERE i.is_active)::int AS item_count
         FROM crm_service_groups g
         LEFT JOIN crm_services s ON s.group_id = g.id AND s.is_active
         LEFT JOIN crm_service_items i ON i.service_id = s.id
        WHERE g.is_active
        GROUP BY g.id
        ORDER BY g.sort_order, g.code`,
    );
  }

  async listServices(): Promise<unknown[]> {
    return this.db().query(
      `SELECT s.code, s.name, g.code AS group_code, g.name AS group_name, s.sort_order,
              s.catalog_version, s.billing_model,
              COUNT(i.id) FILTER (WHERE i.is_active)::int AS item_count
         FROM crm_services s
         JOIN crm_service_groups g ON g.id = s.group_id
         LEFT JOIN crm_service_items i ON i.service_id = s.id
        WHERE s.is_active
        GROUP BY s.id, g.code, g.name
        ORDER BY s.sort_order, s.code`,
    );
  }

  async getService(code: string): Promise<Record<string, unknown>> {
    const services = await this.db().query<Record<string, unknown>>(
      `SELECT s.code, s.name, g.code AS group_code, g.name AS group_name, s.objective, s.problem,
              s.target_customers, s.prerequisites, s.exclusions, s.billing_model, s.meta_json,
              s.legacy_sku_code, s.catalog_version
         FROM crm_services s
         JOIN crm_service_groups g ON g.id = s.group_id
        WHERE s.code = $1 AND s.is_active`,
      [code],
    );
    const service = services[0];
    if (!service) throw new NotFoundException({ error: 'not_found', code: 'service_not_found' });
    const [items, inputs, deliverables, kpis, risks, scope, phases] = await Promise.all([
      this.db().query(`SELECT code, phase_code, seq_in_phase, sort_order, task, subtask, standard, raci,
                              main_role_code, tool, deliverable, approval_gate, gate_approver, min_level,
                              est_hours::text AS est_hours, est_hours_is_assumption, est_hours_source, unit,
                              default_qty::text AS default_qty, billable, client_only, is_common
                         FROM crm_service_items WHERE service_id = (SELECT id FROM crm_services WHERE code = $1) AND is_active
                         ORDER BY sort_order, code`, [code]),
      this.db().query(`SELECT code, type, name, format_or_permission, is_required, sort_order
                         FROM crm_service_inputs WHERE service_id = (SELECT id FROM crm_services WHERE code = $1)
                         ORDER BY sort_order, code`, [code]),
      this.db().query(`SELECT code, name, format, owner_role_code, acceptance_criteria, revision_limit_text, approval_gate, sort_order
                         FROM crm_service_deliverables WHERE service_id = (SELECT id FROM crm_services WHERE code = $1)
                         ORDER BY sort_order, code`, [code]),
      this.db().query(`SELECT code, type, name, formula, data_source, frequency, owner_role_code, sort_order
                         FROM crm_service_kpis WHERE service_id = (SELECT id FROM crm_services WHERE code = $1)
                         ORDER BY sort_order, code`, [code]),
      this.db().query(`SELECT code, risk, likelihood, impact, mitigation, owner_role_code, sort_order
                         FROM crm_service_risks WHERE service_id = (SELECT id FROM crm_services WHERE code = $1)
                         ORDER BY sort_order, code`, [code]),
      this.db().query(`SELECT sort_order, feature, basic_text, standard_text, advanced_text
                         FROM crm_service_scope_rows WHERE service_id = (SELECT id FROM crm_services WHERE code = $1)
                         ORDER BY sort_order`, [code]),
      this.db().query(`SELECT code, name, seq FROM crm_service_phases ORDER BY seq`),
    ]);
    return {
      ...service,
      pricing_active: false,
      price_note: 'pricing_pending',
      package_hours: packageHours(items as Array<Record<string, unknown>>),
      phases,
      items,
      inputs,
      deliverables,
      kpis,
      risks,
      scope,
    };
  }

  async patchItem(code: string, body: ItemPatchBody, actor: string): Promise<Record<string, unknown>> {
    const rows = await this.db().query<Record<string, unknown>>(
      `SELECT code, est_hours::text AS est_hours, est_hours_is_assumption, est_hours_source, min_level,
              billable, default_qty::text AS default_qty
         FROM crm_service_items WHERE code = $1`,
      [code],
    );
    const existing = rows[0];
    if (!existing) throw new NotFoundException({ error: 'not_found', code: 'item_not_found' });
    let next: Record<string, unknown>;
    try {
      next = applyItemPatch(existing, body);
    } catch (error) {
      if (error instanceof CatalogPatchError) {
        throw new UnprocessableEntityException({ error: error.code, message: error.message });
      }
      throw error;
    }
    await this.db().query(
      `UPDATE crm_service_items
          SET est_hours = $2, min_level = $3, billable = $4, default_qty = $5,
              est_hours_source = $6, est_hours_is_assumption = $7, updated_at = NOW(), updated_by = $8
        WHERE code = $1`,
      [code, next.est_hours, next.min_level, next.billable, next.default_qty, next.est_hours_source, next.est_hours_is_assumption, actor],
    );
    await this.audit.logSyntheticEvent({
      event_type: 'p13_catalog',
      actor_email: actor,
      category: 'p13',
      severity: 'info',
      subject_label: code,
      subject_id: code,
      action: 'service_item_patch',
      summary: `Sửa hạng mục ${code}`,
      diff_json: { before: existing, after: next },
    });
    return next;
  }

  async confirmServiceHours(code: string, actor: string): Promise<{ updated: number }> {
    const result = await this.db().query(
      `UPDATE crm_service_items
          SET est_hours_is_assumption = FALSE, updated_at = NOW(), updated_by = $2
        WHERE service_id = (SELECT id FROM crm_services WHERE code = $1) AND est_hours_is_assumption IS TRUE
        RETURNING code`,
      [code, actor],
    );
    await this.audit.logSyntheticEvent({
      event_type: 'p13_catalog',
      actor_email: actor,
      category: 'p13',
      severity: 'info',
      subject_label: code,
      subject_id: code,
      action: 'confirm_hours',
      summary: `Xác nhận giờ ${code}`,
      diff_json: { updated: result.length },
    });
    return { updated: result.length };
  }

  async importPayload(raw: unknown, opts: Omit<ImportOptions, 'fileSha256'> & { fileText?: string }): Promise<ImportSummary> {
    const fileText = opts.fileText ?? JSON.stringify(raw);
    try {
      return await importCatalog(this.db(), raw, { ...opts, fileSha256: sha256Text(fileText) });
    } catch (error) {
      if (error instanceof CatalogSchemaError) {
        throw new UnprocessableEntityException({ error: error.code, message: error.message });
      }
      throw error;
    }
  }

  async listImports(): Promise<unknown[]> {
    return this.db().query(
      `SELECT id, file_name, file_sha256, schema_version, catalog_version, mode, summary_json, run_by, run_at
         FROM crm_catalog_imports ORDER BY id DESC LIMIT 20`,
    );
  }
}

function packageHours(items: Array<Record<string, unknown>>): Record<string, { hours: string; price_vnd: null }> {
  const out: Record<string, { hours: string; price_vnd: null }> = {};
  for (const [level, rank] of Object.entries(LEVEL_RANK)) {
    let hours = '0.00';
    for (const item of items) {
      if (item.billable !== true) continue;
      const itemRank = LEVEL_RANK[String(item.min_level)] ?? 99;
      if (itemRank > rank) continue;
      hours = addDecimal(hours, String(item.est_hours), String(item.default_qty ?? '1'));
    }
    out[level] = { hours, price_vnd: null };
  }
  return out;
}
