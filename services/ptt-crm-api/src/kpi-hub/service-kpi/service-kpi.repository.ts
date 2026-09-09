import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { isMissingRelationError, withDbFallback } from '../kpi-hub.memory-store';
import type {
  CreateTemplateBody,
  IngestActualBody,
  PatchInstanceBody,
  ServiceKpiActualRow,
  ServiceKpiInstanceRow,
  ServiceKpiMeasurementPlanRow,
  ServiceKpiPolicyPackRow,
  ServiceKpiBenchmarkRow,
  ServiceKpiSnapshotRow,
  ServiceKpiTemplateRow,
  ServiceKpiTemplateVersionRow,
} from './service-kpi.types';
import { SERVICE_KPI_TENANT_ID } from './service-kpi.types';

async function skpiDbFallback<T>(dbFn: () => Promise<T>, memoryFn: () => T): Promise<T> {
  return withDbFallback(async () => {
    try {
      return await dbFn();
    } catch (err) {
      if (isMissingRelationError(err)) return null;
      throw err;
    }
  }, memoryFn);
}

type MemoryStore = {
  templates: ServiceKpiTemplateRow[];
  versions: ServiceKpiTemplateVersionRow[];
  dictionaryStatus: Map<string, string>;
  policyPacks: ServiceKpiPolicyPackRow[];
  instances: ServiceKpiInstanceRow[];
  measurementPlans: ServiceKpiMeasurementPlanRow[];
  actuals: ServiceKpiActualRow[];
  snapshots: ServiceKpiSnapshotRow[];
  benchmarks: ServiceKpiBenchmarkRow[];
};

@Injectable()
export class ServiceKpiRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: MemoryStore = {
    templates: [],
    versions: [],
    dictionaryStatus: new Map(),
    policyPacks: [
      {
        id: 'pack-re',
        industry: 'real_estate',
        regulated: true,
        rules_json: [
          { forbid_classification: 'COMMITTED_DELIVERABLE', kpi_kind: 'booking_or_gmv' },
          { require: ['attribution', 'client_sales_sla', 'disclaimer'], classification: 'BUSINESS_OUTCOME' },
        ],
        banned_phrases: ['cam kết doanh số', 'đảm bảo lead', 'chắc chắn X lead'],
      },
    ],
    instances: [],
    measurementPlans: [],
    actuals: [],
    snapshots: [],
    benchmarks: [],
  };

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

  async getDictionaryStatus(dictionaryId: string): Promise<string | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT status FROM crm_kpi_dictionary
           WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [dictionaryId, SERVICE_KPI_TENANT_ID],
        );
        return res.rows[0] ? String(res.rows[0].status) : null;
      },
      () => this.memory.dictionaryStatus.get(dictionaryId) ?? 'ACTIVE',
    );
  }

  async listTemplates(query: {
    dv_code?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ items: ServiceKpiTemplateRow[]; total: number }> {
    return skpiDbFallback(
      async () => {
        const page = Math.max(1, Number(query.page ?? 1));
        const pageSize = Math.min(100, Math.max(1, Number(query.page_size ?? 20)));
        const params: unknown[] = [SERVICE_KPI_TENANT_ID];
        let where = 't.tenant_id = $1 AND t.deleted_at IS NULL';
        if (query.dv_code) {
          params.push(query.dv_code);
          where += ` AND t.dv_code = $${params.length}`;
        }
        if (query.status) {
          params.push(query.status);
          where += ` AND t.status = $${params.length}`;
        }
        const countRes = await this.db.query(
          `SELECT COUNT(*)::int AS total FROM crm_service_kpi_templates t WHERE ${where}`,
          params,
        );
        const total = Number(countRes.rows[0]?.total ?? 0);
        params.push(pageSize, (page - 1) * pageSize);
        const res = await this.db.query(
          `SELECT t.*,
            (SELECT COUNT(*)::int FROM crm_service_kpi_template_rules r
             JOIN crm_service_kpi_template_versions v ON v.id = r.template_version_id
             WHERE v.template_id = t.id AND v.id = COALESCE(t.active_version_id,
               (SELECT id FROM crm_service_kpi_template_versions WHERE template_id = t.id ORDER BY version_no DESC LIMIT 1)
             )) AS rule_count,
            (SELECT COUNT(*)::int FROM crm_service_kpi_template_rules r
             JOIN crm_service_kpi_template_versions v ON v.id = r.template_version_id
             WHERE v.template_id = t.id AND r.is_required = TRUE AND v.id = COALESCE(t.active_version_id,
               (SELECT id FROM crm_service_kpi_template_versions WHERE template_id = t.id ORDER BY version_no DESC LIMIT 1)
             )) AS required_count,
            (SELECT COUNT(*)::int FROM crm_service_kpi_template_rules r
             JOIN crm_service_kpi_template_versions v ON v.id = r.template_version_id
             WHERE v.template_id = t.id AND r.client_visible = TRUE AND v.id = COALESCE(t.active_version_id,
               (SELECT id FROM crm_service_kpi_template_versions WHERE template_id = t.id ORDER BY version_no DESC LIMIT 1)
             )) AS client_visible_count
           FROM crm_service_kpi_templates t
           WHERE ${where}
           ORDER BY t.updated_at DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        );
        return { items: res.rows.map((r) => this.mapTemplate(r)), total };
      },
      () => {
        let rows = [...this.memory.templates];
        if (query.dv_code) rows = rows.filter((r) => r.dv_code === query.dv_code);
        if (query.status) rows = rows.filter((r) => r.status === query.status);
        return { items: rows, total: rows.length };
      },
    );
  }

  async getTemplate(id: string): Promise<ServiceKpiTemplateRow | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT * FROM crm_service_kpi_templates
           WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [id, SERVICE_KPI_TENANT_ID],
        );
        if (!res.rows[0]) return null;
        const tpl = this.mapTemplate(res.rows[0]);
        const versionId = tpl.active_version_id;
        if (versionId) {
          tpl.current_version = await this.getVersion(versionId);
        } else {
          const latest = await this.db.query(
            `SELECT id FROM crm_service_kpi_template_versions
             WHERE template_id = $1 ORDER BY version_no DESC LIMIT 1`,
            [id],
          );
          if (latest.rows[0]) {
            tpl.current_version = await this.getVersion(String(latest.rows[0].id));
          }
        }
        return tpl;
      },
      () => this.memory.templates.find((t) => t.id === id) ?? null,
    );
  }

  async getVersion(versionId: string): Promise<ServiceKpiTemplateVersionRow | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT * FROM crm_service_kpi_template_versions WHERE id = $1 AND tenant_id = $2`,
          [versionId, SERVICE_KPI_TENANT_ID],
        );
        if (!res.rows[0]) return null;
        const rulesRes = await this.db.query(
          `SELECT * FROM crm_service_kpi_template_rules
           WHERE template_version_id = $1 ORDER BY display_order, id`,
          [versionId],
        );
        return {
          id: String(res.rows[0].id),
          template_id: String(res.rows[0].template_id),
          version_no: Number(res.rows[0].version_no),
          status: String(res.rows[0].status),
          rules: rulesRes.rows.map((r) => ({
            id: String(r.id),
            dictionary_id: String(r.dictionary_id),
            classification: String(r.classification) as ServiceKpiTemplateVersionRow['rules'][0]['classification'],
            is_required: Boolean(r.is_required),
            client_visible: Boolean(r.client_visible),
            display_order: Number(r.display_order ?? 0),
            target_min: r.target_min != null ? Number(r.target_min) : null,
            target_max: r.target_max != null ? Number(r.target_max) : null,
            target_unit: r.target_unit != null ? String(r.target_unit) : null,
            scenario: String(r.scenario ?? 'base'),
            assumption_template: String(r.assumption_template ?? ''),
            disclaimer_template: String(r.disclaimer_template ?? ''),
            owner_role: String(r.owner_role ?? ''),
            cadence: String(r.cadence ?? 'weekly'),
          })),
        };
      },
      () => this.memory.versions.find((v) => v.id === versionId) ?? null,
    );
  }

  async createTemplate(body: CreateTemplateBody): Promise<{ id: string; version_id: string; version_no: number }> {
    return skpiDbFallback(
      async () => {
        const client = await this.db.connect();
        try {
          await client.query('BEGIN');
          const tplRes = await client.query(
            `INSERT INTO crm_service_kpi_templates (tenant_id, dv_code, name, owner_team, status)
             VALUES ($1, $2, $3, $4, 'DRAFT')
             RETURNING id`,
            [SERVICE_KPI_TENANT_ID, body.dv_code, body.name, body.owner_team ?? ''],
          );
          const templateId = String(tplRes.rows[0].id);
          const verRes = await client.query(
            `INSERT INTO crm_service_kpi_template_versions (tenant_id, template_id, version_no, status)
             VALUES ($1, $2, 1, 'DRAFT') RETURNING id`,
            [SERVICE_KPI_TENANT_ID, templateId],
          );
          const versionId = String(verRes.rows[0].id);
          await this.insertRules(client, versionId, body.rules);
          await client.query('COMMIT');
          return { id: templateId, version_id: versionId, version_no: 1 };
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      () => {
        const id = randomUUID();
        const versionId = randomUUID();
        const tpl: ServiceKpiTemplateRow = {
          id,
          dv_code: body.dv_code,
          name: body.name,
          owner_team: body.owner_team ?? '',
          status: 'DRAFT',
          active_version_id: null,
          row_version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          rule_count: body.rules.length,
          required_count: body.rules.filter((r) => r.is_required !== false).length,
          client_visible_count: body.rules.filter((r) => r.client_visible !== false).length,
          current_version: {
            id: versionId,
            template_id: id,
            version_no: 1,
            status: 'DRAFT',
            rules: body.rules.map((r, i) => ({
              id: randomUUID(),
              dictionary_id: r.dictionary_id,
              classification: r.classification,
              is_required: r.is_required !== false,
              client_visible: r.client_visible !== false,
              display_order: i,
              target_min: r.target_min ?? null,
              target_max: r.target_max ?? null,
              target_unit: null,
              scenario: 'base',
              assumption_template: r.assumption_template ?? '',
              disclaimer_template: r.disclaimer_template ?? '',
              owner_role: r.owner_role ?? '',
              cadence: r.cadence ?? 'weekly',
            })),
          },
        };
        this.memory.templates.unshift(tpl);
        this.memory.versions.push(tpl.current_version!);
        return { id, version_id: versionId, version_no: 1 };
      },
    );
  }

  async createRevision(templateId: string): Promise<{ version_id: string; version_no: number }> {
    return skpiDbFallback(
      async () => {
        const client = await this.db.connect();
        try {
          await client.query('BEGIN');
          const tpl = await this.getTemplate(templateId);
          if (!tpl?.current_version) throw new Error('TEMPLATE_NOT_FOUND');
          const nextNo = (tpl.current_version.version_no ?? 0) + 1;
          const verRes = await client.query(
            `INSERT INTO crm_service_kpi_template_versions (tenant_id, template_id, version_no, status)
             VALUES ($1, $2, $3, 'DRAFT') RETURNING id`,
            [SERVICE_KPI_TENANT_ID, templateId, nextNo],
          );
          const versionId = String(verRes.rows[0].id);
          for (const rule of tpl.current_version.rules) {
            await client.query(
              `INSERT INTO crm_service_kpi_template_rules
               (tenant_id, template_version_id, dictionary_id, classification, is_required, client_visible,
                display_order, target_min, target_max, assumption_template, disclaimer_template, owner_role, cadence)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [
                SERVICE_KPI_TENANT_ID,
                versionId,
                rule.dictionary_id,
                rule.classification,
                rule.is_required,
                rule.client_visible,
                rule.display_order,
                rule.target_min,
                rule.target_max,
                rule.assumption_template,
                rule.disclaimer_template,
                rule.owner_role,
                rule.cadence,
              ],
            );
          }
          await client.query(
            `UPDATE crm_service_kpi_templates SET status = 'DRAFT', updated_at = NOW(), row_version = row_version + 1
             WHERE id = $1`,
            [templateId],
          );
          await client.query('COMMIT');
          return { version_id: versionId, version_no: nextNo };
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      () => {
        const tpl = this.memory.templates.find((t) => t.id === templateId);
        if (!tpl?.current_version) throw new Error('TEMPLATE_NOT_FOUND');
        const versionId = randomUUID();
        const versionNo = tpl.current_version.version_no + 1;
        const version: ServiceKpiTemplateVersionRow = {
          id: versionId,
          template_id: templateId,
          version_no: versionNo,
          status: 'DRAFT',
          rules: tpl.current_version.rules.map((r) => ({ ...r, id: randomUUID() })),
        };
        this.memory.versions.push(version);
        tpl.status = 'DRAFT';
        tpl.current_version = version;
        tpl.row_version += 1;
        return { version_id: versionId, version_no: versionNo };
      },
    );
  }

  async setVersionStatus(versionId: string, status: string, templateStatus?: string): Promise<void> {
    return skpiDbFallback(
      async () => {
        const client = await this.db.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `UPDATE crm_service_kpi_template_versions SET status = $1, updated_at = NOW() WHERE id = $2`,
            [status, versionId],
          );
          if (templateStatus) {
            const ver = await this.getVersion(versionId);
            if (ver) {
              await client.query(
                `UPDATE crm_service_kpi_templates SET status = $1, updated_at = NOW(),
                  active_version_id = CASE WHEN $1 = 'ACTIVE' THEN $2::uuid ELSE active_version_id END,
                  row_version = row_version + 1
                 WHERE id = $3`,
                [templateStatus, versionId, ver.template_id],
              );
            }
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      () => {
        const ver = this.memory.versions.find((v) => v.id === versionId);
        if (!ver) return;
        ver.status = status;
        const tpl = this.memory.templates.find((t) => t.id === ver.template_id);
        if (tpl && templateStatus) {
          tpl.status = templateStatus as ServiceKpiTemplateRow['status'];
          if (templateStatus === 'ACTIVE') tpl.active_version_id = versionId;
        }
      },
    );
  }

  async listPolicyPacks(): Promise<ServiceKpiPolicyPackRow[]> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT id, industry, regulated, rules_json, banned_phrases
           FROM crm_service_kpi_policy_packs WHERE tenant_id = $1 ORDER BY industry`,
          [SERVICE_KPI_TENANT_ID],
        );
        return res.rows.map((r) => ({
          id: String(r.id),
          industry: String(r.industry),
          regulated: Boolean(r.regulated),
          rules_json: Array.isArray(r.rules_json) ? r.rules_json : [],
          banned_phrases: Array.isArray(r.banned_phrases) ? r.banned_phrases.map(String) : [],
        }));
      },
      () => [...this.memory.policyPacks],
    );
  }

  async getPolicyPack(industry: string): Promise<ServiceKpiPolicyPackRow | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT id, industry, regulated, rules_json, banned_phrases
           FROM crm_service_kpi_policy_packs WHERE tenant_id = $1 AND industry = $2`,
          [SERVICE_KPI_TENANT_ID, industry],
        );
        if (!res.rows[0]) return null;
        const r = res.rows[0];
        return {
          id: String(r.id),
          industry: String(r.industry),
          regulated: Boolean(r.regulated),
          rules_json: Array.isArray(r.rules_json) ? r.rules_json : [],
          banned_phrases: Array.isArray(r.banned_phrases) ? r.banned_phrases.map(String) : [],
        };
      },
      () => this.memory.policyPacks.find((p) => p.industry === industry) ?? null,
    );
  }

  async replaceVersionRules(
    versionId: string,
    rules: CreateTemplateBody['rules'],
  ): Promise<ServiceKpiTemplateVersionRow | null> {
    return skpiDbFallback(
      async () => {
        const version = await this.getVersion(versionId);
        if (!version || version.status !== 'DRAFT') return null;
        const client = await this.db.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `DELETE FROM crm_service_kpi_template_rules WHERE template_version_id = $1 AND tenant_id = $2`,
            [versionId, SERVICE_KPI_TENANT_ID],
          );
          await this.insertRules(client, versionId, rules);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        return this.getVersion(versionId);
      },
      () => {
        const ver = this.memory.versions.find((v) => v.id === versionId);
        if (!ver || ver.status !== 'DRAFT') return null;
        ver.rules = rules.map((r, i) => ({
          id: randomUUID(),
          dictionary_id: r.dictionary_id,
          classification: r.classification,
          is_required: r.is_required !== false,
          client_visible: r.client_visible !== false,
          display_order: i,
          target_min: r.target_min ?? null,
          target_max: r.target_max ?? null,
          target_unit: null,
          scenario: 'base',
          assumption_template: r.assumption_template ?? '',
          disclaimer_template: r.disclaimer_template ?? '',
          owner_role: r.owner_role ?? '',
          cadence: r.cadence ?? 'weekly',
        }));
        const tpl = this.memory.templates.find((t) => t.id === ver.template_id);
        if (tpl?.current_version?.id === versionId) {
          tpl.current_version = ver;
          tpl.rule_count = ver.rules.length;
          tpl.required_count = ver.rules.filter((x) => x.is_required).length;
          tpl.client_visible_count = ver.rules.filter((x) => x.client_visible).length;
        }
        return ver;
      },
    );
  }

  private async insertRules(
    client: { query: Pool['query'] },
    versionId: string,
    rules: CreateTemplateBody['rules'],
  ): Promise<void> {
    for (const [i, rule] of rules.entries()) {
      await client.query(
        `INSERT INTO crm_service_kpi_template_rules
         (tenant_id, template_version_id, dictionary_id, classification, is_required, client_visible,
          display_order, target_min, target_max, assumption_template, disclaimer_template, owner_role, cadence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          SERVICE_KPI_TENANT_ID,
          versionId,
          rule.dictionary_id,
          rule.classification,
          rule.is_required !== false,
          rule.client_visible !== false,
          i,
          rule.target_min ?? null,
          rule.target_max ?? null,
          rule.assumption_template ?? '',
          rule.disclaimer_template ?? '',
          rule.owner_role ?? '',
          rule.cadence ?? 'weekly',
        ],
      );
    }
  }

  async findActiveTemplateVersion(dvCode: string): Promise<ServiceKpiTemplateVersionRow | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT t.active_version_id FROM crm_service_kpi_templates t
           WHERE t.tenant_id = $1 AND t.dv_code = $2 AND t.status = 'ACTIVE' AND t.deleted_at IS NULL
           LIMIT 1`,
          [SERVICE_KPI_TENANT_ID, dvCode],
        );
        const versionId = res.rows[0]?.active_version_id;
        if (!versionId) return null;
        return this.getVersion(String(versionId));
      },
      () => {
        const tpl = this.memory.templates.find((t) => t.dv_code === dvCode && t.status === 'ACTIVE');
        if (!tpl?.current_version) return null;
        return tpl.current_version;
      },
    );
  }

  async listInstances(query: {
    source_type?: string;
    source_id?: string;
    status?: string;
    dv_code?: string;
  }): Promise<ServiceKpiInstanceRow[]> {
    return skpiDbFallback(
      async () => {
        const params: unknown[] = [SERVICE_KPI_TENANT_ID];
        let where = 'i.tenant_id = $1 AND i.deleted_at IS NULL';
        if (query.source_type) {
          params.push(query.source_type);
          where += ` AND i.source_type = $${params.length}`;
        }
        if (query.source_id) {
          params.push(query.source_id);
          where += ` AND i.source_id = $${params.length}`;
        }
        if (query.status) {
          params.push(query.status);
          where += ` AND i.status = $${params.length}`;
        }
        if (query.dv_code) {
          params.push(query.dv_code);
          where += ` AND i.dv_code = $${params.length}`;
        }
        const res = await this.db.query(`SELECT i.* FROM crm_service_kpi_instances i WHERE ${where} ORDER BY i.updated_at DESC`, params);
        return res.rows.map((r) => this.mapInstance(r));
      },
      () => {
        let rows = this.memory.instances.filter((i) => true);
        if (query.source_type) rows = rows.filter((i) => i.source_type === query.source_type);
        if (query.source_id) rows = rows.filter((i) => i.source_id === query.source_id);
        if (query.status) rows = rows.filter((i) => i.status === query.status);
        if (query.dv_code) rows = rows.filter((i) => i.dv_code === query.dv_code);
        return rows;
      },
    );
  }

  async getInstance(id: string): Promise<ServiceKpiInstanceRow | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT * FROM crm_service_kpi_instances WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [id, SERVICE_KPI_TENANT_ID],
        );
        return res.rows[0] ? this.mapInstance(res.rows[0]) : null;
      },
      () => this.memory.instances.find((i) => i.id === id) ?? null,
    );
  }

  async insertInstance(row: Omit<ServiceKpiInstanceRow, 'id' | 'created_at' | 'updated_at' | 'row_version'>): Promise<ServiceKpiInstanceRow> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `INSERT INTO crm_service_kpi_instances
           (tenant_id, source_type, source_id, dv_code, dictionary_id, template_version_id, classification,
            status, client_visible, owner_name, target_min, target_max, scenario, assumption_text,
            assumption_state, disclaimer_text)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           RETURNING *`,
          [
            SERVICE_KPI_TENANT_ID,
            row.source_type,
            row.source_id,
            row.dv_code,
            row.dictionary_id,
            row.template_version_id,
            row.classification,
            row.status,
            row.client_visible,
            row.owner_name,
            row.target_min,
            row.target_max,
            row.scenario,
            row.assumption_text,
            row.assumption_state,
            row.disclaimer_text,
          ],
        );
        return this.mapInstance(res.rows[0]);
      },
      () => {
        const inst: ServiceKpiInstanceRow = {
          ...row,
          id: randomUUID(),
          row_version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.memory.instances.push(inst);
        return inst;
      },
    );
  }

  async patchInstance(id: string, patch: PatchInstanceBody, rowVersion: number): Promise<ServiceKpiInstanceRow | 'conflict' | null> {
    return skpiDbFallback(
      async () => {
        const current = await this.getInstance(id);
        if (!current) return null;
        if (current.row_version !== rowVersion) return 'conflict';
        const res = await this.db.query(
          `UPDATE crm_service_kpi_instances SET
            owner_name = COALESCE($2, owner_name),
            target_min = COALESCE($3, target_min),
            target_max = COALESCE($4, target_max),
            scenario = COALESCE($5, scenario),
            assumption_text = COALESCE($6, assumption_text),
            assumption_state = COALESCE($7, assumption_state),
            disclaimer_text = COALESCE($8, disclaimer_text),
            status = COALESCE($9, status),
            updated_at = NOW(),
            row_version = row_version + 1
           WHERE id = $1 AND tenant_id = $10 AND row_version = $11
           RETURNING *`,
          [
            id,
            patch.owner_name ?? null,
            patch.target_min ?? null,
            patch.target_max ?? null,
            patch.scenario ?? null,
            patch.assumption_text ?? null,
            patch.assumption_state ?? null,
            patch.disclaimer_text ?? null,
            patch.status ?? null,
            SERVICE_KPI_TENANT_ID,
            rowVersion,
          ],
        );
        if (!res.rows[0]) return 'conflict';
        return this.mapInstance(res.rows[0]);
      },
      () => {
        const idx = this.memory.instances.findIndex((i) => i.id === id);
        if (idx < 0) return null;
        if (this.memory.instances[idx].row_version !== rowVersion) return 'conflict';
        this.memory.instances[idx] = {
          ...this.memory.instances[idx],
          ...patch,
          owner_name: patch.owner_name ?? this.memory.instances[idx].owner_name,
          row_version: rowVersion + 1,
          updated_at: new Date().toISOString(),
        };
        return this.memory.instances[idx];
      },
    );
  }

  async upsertMeasurementPlan(instanceId: string, body: Partial<ServiceKpiMeasurementPlanRow>): Promise<ServiceKpiMeasurementPlanRow> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `INSERT INTO crm_service_kpi_measurement_plans
           (tenant_id, instance_id, owner_name, cadence, timezone, data_source, field_mapping, freshness_sla_hours, qa_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (instance_id) DO UPDATE SET
             owner_name = EXCLUDED.owner_name,
             cadence = EXCLUDED.cadence,
             data_source = EXCLUDED.data_source,
             field_mapping = EXCLUDED.field_mapping,
             freshness_sla_hours = EXCLUDED.freshness_sla_hours,
             qa_status = EXCLUDED.qa_status
           RETURNING *`,
          [
            SERVICE_KPI_TENANT_ID,
            instanceId,
            body.owner_name ?? '',
            body.cadence ?? 'daily',
            body.timezone ?? 'Asia/Ho_Chi_Minh',
            body.data_source ?? '',
            body.field_mapping ?? '',
            body.freshness_sla_hours ?? 24,
            body.qa_status ?? 'pending',
          ],
        );
        return this.mapMeasurementPlan(res.rows[0]);
      },
      () => {
        const existing = this.memory.measurementPlans.find((p) => p.instance_id === instanceId);
        if (existing) {
          Object.assign(existing, body);
          return existing;
        }
        const plan: ServiceKpiMeasurementPlanRow = {
          id: randomUUID(),
          instance_id: instanceId,
          owner_name: body.owner_name ?? '',
          cadence: body.cadence ?? 'daily',
          timezone: body.timezone ?? 'Asia/Ho_Chi_Minh',
          data_source: body.data_source ?? '',
          field_mapping: body.field_mapping ?? '',
          freshness_sla_hours: body.freshness_sla_hours ?? 24,
          qa_status: body.qa_status ?? 'pending',
        };
        this.memory.measurementPlans.push(plan);
        return plan;
      },
    );
  }

  async getMeasurementPlan(instanceId: string): Promise<ServiceKpiMeasurementPlanRow | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT * FROM crm_service_kpi_measurement_plans WHERE instance_id = $1 AND tenant_id = $2`,
          [instanceId, SERVICE_KPI_TENANT_ID],
        );
        return res.rows[0] ? this.mapMeasurementPlan(res.rows[0]) : null;
      },
      () => this.memory.measurementPlans.find((p) => p.instance_id === instanceId) ?? null,
    );
  }

  async findOpenActual(instanceId: string, periodStart: string, periodEnd: string, sourceRef: string): Promise<ServiceKpiActualRow | null> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT * FROM crm_service_kpi_actuals
           WHERE instance_id = $1 AND period_start = $2::date AND period_end = $3::date
             AND source_ref = $4 AND superseded_by IS NULL`,
          [instanceId, periodStart, periodEnd, sourceRef],
        );
        return res.rows[0] ? this.mapActual(res.rows[0]) : null;
      },
      () =>
        this.memory.actuals.find(
          (a) =>
            a.instance_id === instanceId &&
            a.period_start === periodStart &&
            a.period_end === periodEnd &&
            a.source_ref === sourceRef &&
            !a.superseded_by,
        ) ?? null,
    );
  }

  async insertActual(instanceId: string, body: IngestActualBody): Promise<ServiceKpiActualRow> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `INSERT INTO crm_service_kpi_actuals
           (tenant_id, instance_id, period_start, period_end, value, unit, quality_status, collection_method, source_ref, note)
           VALUES ($1,$2,$3::date,$4::date,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [
            SERVICE_KPI_TENANT_ID,
            instanceId,
            body.period_start,
            body.period_end,
            body.value ?? null,
            body.unit ?? null,
            body.quality_status ?? 'pending_validation',
            body.collection_method ?? 'manual',
            body.source_ref ?? '',
            body.note ?? '',
          ],
        );
        return this.mapActual(res.rows[0]);
      },
      () => {
        const row: ServiceKpiActualRow = {
          id: randomUUID(),
          instance_id: instanceId,
          period_start: body.period_start,
          period_end: body.period_end,
          value: body.value ?? null,
          unit: body.unit ?? null,
          quality_status: body.quality_status ?? 'pending_validation',
          collection_method: body.collection_method ?? 'manual',
          source_ref: body.source_ref ?? '',
          note: body.note ?? '',
          superseded_by: null,
        };
        this.memory.actuals.push(row);
        return row;
      },
    );
  }

  async supersedeActual(oldId: string, newId: string): Promise<void> {
    return skpiDbFallback(
      async () => {
        await this.db.query(`UPDATE crm_service_kpi_actuals SET superseded_by = $2 WHERE id = $1`, [oldId, newId]);
      },
      () => {
        const row = this.memory.actuals.find((a) => a.id === oldId);
        if (row) row.superseded_by = newId;
      },
    );
  }

  async listActuals(instanceId: string): Promise<ServiceKpiActualRow[]> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT * FROM crm_service_kpi_actuals WHERE instance_id = $1 AND superseded_by IS NULL ORDER BY period_start DESC`,
          [instanceId],
        );
        return res.rows.map((r) => this.mapActual(r));
      },
      () => this.memory.actuals.filter((a) => a.instance_id === instanceId && !a.superseded_by),
    );
  }

  async insertSnapshot(input: {
    instance_id: string;
    quote_version_id: string;
    ledger: 'quoted' | 'delivered' | 'reported';
    payload_json: Record<string, unknown>;
  }): Promise<ServiceKpiSnapshotRow> {
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `INSERT INTO crm_service_kpi_snapshots (tenant_id, instance_id, quote_version_id, ledger, payload_json)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [SERVICE_KPI_TENANT_ID, input.instance_id, input.quote_version_id, input.ledger, input.payload_json],
        );
        return this.mapSnapshot(res.rows[0]);
      },
      () => {
        const snap: ServiceKpiSnapshotRow = {
          id: randomUUID(),
          instance_id: input.instance_id,
          quote_version_id: input.quote_version_id,
          ledger: input.ledger,
          payload_json: input.payload_json,
          created_at: new Date().toISOString(),
        };
        this.memory.snapshots.push(snap);
        return snap;
      },
    );
  }

  async listSnapshots(query: { source_id?: string; quote_version_id?: string }): Promise<ServiceKpiSnapshotRow[]> {
    return skpiDbFallback(
      async () => {
        const params: unknown[] = [SERVICE_KPI_TENANT_ID];
        let sql = `SELECT s.* FROM crm_service_kpi_snapshots s
                   JOIN crm_service_kpi_instances i ON i.id = s.instance_id
                   WHERE s.tenant_id = $1`;
        if (query.quote_version_id) {
          params.push(query.quote_version_id);
          sql += ` AND s.quote_version_id = $${params.length}`;
        }
        if (query.source_id) {
          params.push(query.source_id);
          sql += ` AND i.source_id = $${params.length}`;
        }
        sql += ' ORDER BY s.created_at DESC';
        const res = await this.db.query(sql, params);
        return res.rows.map((r) => this.mapSnapshot(r));
      },
      () => {
        let snaps = [...this.memory.snapshots];
        if (query.quote_version_id) snaps = snaps.filter((s) => s.quote_version_id === query.quote_version_id);
        if (query.source_id) {
          const ids = new Set(this.memory.instances.filter((i) => i.source_id === query.source_id).map((i) => i.id));
          snaps = snaps.filter((s) => ids.has(s.instance_id));
        }
        return snaps;
      },
    );
  }

  async listAllInstances(): Promise<ServiceKpiInstanceRow[]> {
    return this.listInstances({});
  }

  async findBenchmark(query: {
    dv_code: string;
    dictionary_id: string;
    industry?: string;
    channel?: string;
    budget_band?: string;
  }): Promise<ServiceKpiBenchmarkRow | null> {
    const industry = query.industry ?? '';
    const channel = query.channel ?? '';
    const budgetBand = query.budget_band ?? '';
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `SELECT * FROM crm_service_kpi_benchmarks
           WHERE tenant_id = $1 AND dv_code = $2 AND dictionary_id = $3
             AND industry = $4 AND channel = $5 AND budget_band = $6
           LIMIT 1`,
          [SERVICE_KPI_TENANT_ID, query.dv_code, query.dictionary_id, industry, channel, budgetBand],
        );
        return res.rows[0] ? this.mapBenchmark(res.rows[0]) : null;
      },
      () =>
        this.memory.benchmarks.find(
          (b) =>
            b.dv_code === query.dv_code &&
            b.dictionary_id === query.dictionary_id &&
            b.industry === industry &&
            b.channel === channel &&
            b.budget_band === budgetBand,
        ) ?? null,
    );
  }

  async upsertBenchmark(input: {
    dv_code: string;
    dictionary_id: string;
    industry?: string;
    channel?: string;
    budget_band?: string;
    p50: number;
    p80: number | null;
    sample_n: number;
  }): Promise<ServiceKpiBenchmarkRow> {
    const industry = input.industry ?? '';
    const channel = input.channel ?? '';
    const budgetBand = input.budget_band ?? '';
    return skpiDbFallback(
      async () => {
        const res = await this.db.query(
          `INSERT INTO crm_service_kpi_benchmarks
             (tenant_id, dv_code, dictionary_id, industry, channel, budget_band, p50, p80, sample_n, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
           ON CONFLICT (tenant_id, dv_code, dictionary_id, industry, channel, budget_band)
           DO UPDATE SET p50 = EXCLUDED.p50, p80 = EXCLUDED.p80, sample_n = EXCLUDED.sample_n, updated_at = NOW()
           RETURNING *`,
          [
            SERVICE_KPI_TENANT_ID,
            input.dv_code,
            input.dictionary_id,
            industry,
            channel,
            budgetBand,
            input.p50,
            input.p80,
            input.sample_n,
          ],
        );
        return this.mapBenchmark(res.rows[0]);
      },
      () => {
        const existing = this.memory.benchmarks.find(
          (b) =>
            b.dv_code === input.dv_code &&
            b.dictionary_id === input.dictionary_id &&
            b.industry === industry &&
            b.channel === channel &&
            b.budget_band === budgetBand,
        );
        if (existing) {
          existing.p50 = input.p50;
          existing.p80 = input.p80;
          existing.sample_n = input.sample_n;
          existing.updated_at = new Date().toISOString();
          return existing;
        }
        const row: ServiceKpiBenchmarkRow = {
          id: randomUUID(),
          dv_code: input.dv_code,
          dictionary_id: input.dictionary_id,
          industry,
          channel,
          budget_band: budgetBand,
          p50: input.p50,
          p80: input.p80,
          sample_n: input.sample_n,
          updated_at: new Date().toISOString(),
        };
        this.memory.benchmarks.push(row);
        return row;
      },
    );
  }

  private mapBenchmark(row: Record<string, unknown>): ServiceKpiBenchmarkRow {
    return {
      id: String(row.id),
      dv_code: String(row.dv_code),
      dictionary_id: String(row.dictionary_id),
      industry: String(row.industry ?? ''),
      channel: String(row.channel ?? ''),
      budget_band: String(row.budget_band ?? ''),
      p50: row.p50 != null ? Number(row.p50) : null,
      p80: row.p80 != null ? Number(row.p80) : null,
      sample_n: Number(row.sample_n ?? 0),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  private mapInstance(row: Record<string, unknown>): ServiceKpiInstanceRow {
    return {
      id: String(row.id),
      source_type: String(row.source_type),
      source_id: String(row.source_id),
      dv_code: row.dv_code != null ? String(row.dv_code) : null,
      dictionary_id: String(row.dictionary_id),
      template_version_id: row.template_version_id != null ? String(row.template_version_id) : null,
      classification: String(row.classification) as ServiceKpiInstanceRow['classification'],
      status: String(row.status) as ServiceKpiInstanceRow['status'],
      client_visible: Boolean(row.client_visible),
      owner_name: row.owner_name != null ? String(row.owner_name) : null,
      target_min: row.target_min != null ? Number(row.target_min) : null,
      target_max: row.target_max != null ? Number(row.target_max) : null,
      scenario: String(row.scenario ?? 'base'),
      assumption_text: String(row.assumption_text ?? ''),
      assumption_state: String(row.assumption_state ?? 'pending'),
      disclaimer_text: String(row.disclaimer_text ?? ''),
      row_version: Number(row.row_version ?? 1),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
    };
  }

  private mapMeasurementPlan(row: Record<string, unknown>): ServiceKpiMeasurementPlanRow {
    return {
      id: String(row.id),
      instance_id: String(row.instance_id),
      owner_name: String(row.owner_name ?? ''),
      cadence: String(row.cadence ?? 'daily'),
      timezone: String(row.timezone ?? 'Asia/Ho_Chi_Minh'),
      data_source: String(row.data_source ?? ''),
      field_mapping: String(row.field_mapping ?? ''),
      freshness_sla_hours: Number(row.freshness_sla_hours ?? 24),
      qa_status: String(row.qa_status ?? 'pending'),
    };
  }

  private mapActual(row: Record<string, unknown>): ServiceKpiActualRow {
    return {
      id: String(row.id),
      instance_id: String(row.instance_id),
      period_start: String(row.period_start).slice(0, 10),
      period_end: String(row.period_end).slice(0, 10),
      value: row.value != null ? Number(row.value) : null,
      unit: row.unit != null ? String(row.unit) : null,
      quality_status: String(row.quality_status ?? 'pending_validation'),
      collection_method: String(row.collection_method ?? 'manual'),
      source_ref: String(row.source_ref ?? ''),
      note: String(row.note ?? ''),
      superseded_by: row.superseded_by != null ? String(row.superseded_by) : null,
    };
  }

  private mapSnapshot(row: Record<string, unknown>): ServiceKpiSnapshotRow {
    return {
      id: String(row.id),
      instance_id: String(row.instance_id),
      quote_version_id: String(row.quote_version_id),
      ledger: String(row.ledger) as ServiceKpiSnapshotRow['ledger'],
      payload_json: (row.payload_json ?? {}) as Record<string, unknown>,
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  }

  private mapTemplate(row: Record<string, unknown>): ServiceKpiTemplateRow {
    return {
      id: String(row.id),
      dv_code: String(row.dv_code),
      name: String(row.name),
      owner_team: String(row.owner_team ?? ''),
      status: String(row.status) as ServiceKpiTemplateRow['status'],
      active_version_id: row.active_version_id != null ? String(row.active_version_id) : null,
      row_version: Number(row.row_version ?? 1),
      created_at: new Date(String(row.created_at)).toISOString(),
      updated_at: new Date(String(row.updated_at)).toISOString(),
      rule_count: row.rule_count != null ? Number(row.rule_count) : undefined,
      required_count: row.required_count != null ? Number(row.required_count) : undefined,
      client_visible_count: row.client_visible_count != null ? Number(row.client_visible_count) : undefined,
    };
  }
}
