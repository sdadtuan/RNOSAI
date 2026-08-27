import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Pool, PoolClient, QueryResult } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  DEFAULT_PROJECT_TYPE_LABELS,
  PRODUCT_LINE_LABELS,
  PROJECT_STAFF_ROLE_LABELS,
  PROJECT_STAFF_ROLES,
  ReProjectLeadConfigRow,
  ReProjectStaffRow,
  SaveProjectLeadConfigBody,
  UpdateProjectStaffBody,
} from './re-projects.types';

type Db = Pool | PoolClient;

@Injectable()
export class ReProjectsChannelsPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(protected readonly config: AppConfigService) {}

  protected get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  protected async ensureSchema(): Promise<void> {
    if (!this.schemaReady) this.schemaReady = this.bootstrapSchema();
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_re_project_types (
        id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE, created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_projects (
        id BIGSERIAL PRIMARY KEY, code TEXT NOT NULL DEFAULT '', name TEXT NOT NULL,
        project_type TEXT NOT NULL DEFAULT 'can_ho', status TEXT NOT NULL DEFAULT 'planning',
        location_address TEXT NOT NULL DEFAULT '', district TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '', developer_name TEXT NOT NULL DEFAULT '',
        investor_name TEXT NOT NULL DEFAULT '', total_land_area_m2 DOUBLE PRECISION,
        total_units INTEGER NOT NULL DEFAULT 0, sold_units INTEGER NOT NULL DEFAULT 0,
        revenue_target_vnd BIGINT NOT NULL DEFAULT 0, start_date TEXT NOT NULL DEFAULT '',
        presale_date TEXT NOT NULL DEFAULT '', handover_date TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        business_plan_json TEXT NOT NULL DEFAULT '{}',
        marketing_plan_json TEXT NOT NULL DEFAULT '{}',
        sales_plan_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_products (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        unit_code TEXT NOT NULL DEFAULT '', tower TEXT NOT NULL DEFAULT '', floor TEXT NOT NULL DEFAULT '',
        product_line TEXT NOT NULL DEFAULT '', zone TEXT NOT NULL DEFAULT '', typology TEXT NOT NULL DEFAULT '',
        is_corner INTEGER NOT NULL DEFAULT 0, sales_staff_id BIGINT, product_type TEXT NOT NULL DEFAULT '',
        area_m2 DOUBLE PRECISION, bedrooms INTEGER, direction TEXT NOT NULL DEFAULT '',
        view_type TEXT NOT NULL DEFAULT '', list_price_vnd BIGINT NOT NULL DEFAULT 0,
        net_price_vnd BIGINT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'available',
        notes TEXT NOT NULL DEFAULT '', price_batch TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_kpis (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'sales', metric_name TEXT NOT NULL, target_value DOUBLE PRECISION NOT NULL DEFAULT 0,
        actual_value DOUBLE PRECISION NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT '',
        period_month TEXT NOT NULL DEFAULT '', weight_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
        owner_staff_id BIGINT, owner_name TEXT NOT NULL DEFAULT '', track_status TEXT NOT NULL DEFAULT 'active',
        metric_code TEXT NOT NULL DEFAULT '', metric_id BIGINT, staff_kpi_id BIGINT,
        notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_risks (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'market', title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        probability_pct DOUBLE PRECISION NOT NULL DEFAULT 0, impact_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
        risk_level TEXT NOT NULL DEFAULT 'medium', mitigation TEXT NOT NULL DEFAULT '',
        owner_name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open',
        due_date TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_budget_lines (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'revenue', line_item TEXT NOT NULL, period_month TEXT NOT NULL DEFAULT '',
        planned_vnd BIGINT NOT NULL DEFAULT 0, actual_vnd BIGINT NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
        sub_category TEXT NOT NULL DEFAULT '', source_type TEXT NOT NULL DEFAULT 'manual',
        source_ref TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_price_lists (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        version_code TEXT NOT NULL, name TEXT NOT NULL, effective_date TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft', notes TEXT NOT NULL DEFAULT '', applied_at TEXT NOT NULL DEFAULT '',
        applied_by TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
        UNIQUE(project_id, version_code)
      );
      CREATE TABLE IF NOT EXISTS crm_re_price_list_items (
        id BIGSERIAL PRIMARY KEY, price_list_id BIGINT NOT NULL REFERENCES crm_re_price_lists(id) ON DELETE CASCADE,
        unit_code TEXT NOT NULL DEFAULT '', zone TEXT NOT NULL DEFAULT '',
        list_price_vnd BIGINT NOT NULL DEFAULT 0, net_price_vnd BIGINT NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_staff (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        staff_id BIGINT NOT NULL, role TEXT NOT NULL DEFAULT 'sales', assign_enabled INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0, scope_product_lines TEXT NOT NULL DEFAULT '[]',
        scope_zones TEXT NOT NULL DEFAULT '[]', joined_at TEXT NOT NULL DEFAULT '', left_at TEXT,
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '', UNIQUE(project_id, staff_id)
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_lead_config (
        project_id BIGINT PRIMARY KEY REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 1, webhook_slug TEXT NOT NULL UNIQUE,
        webhook_verify_token TEXT NOT NULL DEFAULT '', facebook_page_id TEXT NOT NULL DEFAULT '',
        zalo_oa_id TEXT NOT NULL DEFAULT '', auto_assign INTEGER NOT NULL DEFAULT 1,
        webhook_enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT '',
        updated_by TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_facebook_forms (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        page_id TEXT NOT NULL DEFAULT '', form_id TEXT NOT NULL UNIQUE, form_name TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_zalo_campaigns (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        oa_id TEXT NOT NULL DEFAULT '', campaign_id TEXT NOT NULL UNIQUE, campaign_name TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS crm_re_project_website_routes (
        id BIGSERIAL PRIMARY KEY, project_id BIGINT NOT NULL REFERENCES crm_re_projects(id) ON DELETE CASCADE,
        route_key TEXT NOT NULL UNIQUE, route_name TEXT NOT NULL DEFAULT '', route_type TEXT NOT NULL DEFAULT 'utm',
        active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_re_products_project ON crm_re_project_products(project_id);
      CREATE INDEX IF NOT EXISTS idx_re_kpis_project ON crm_re_project_kpis(project_id);
      CREATE INDEX IF NOT EXISTS idx_re_budget_project ON crm_re_project_budget_lines(project_id);
    `);
    const count = await this.db.query('SELECT COUNT(*)::int AS c FROM crm_re_project_types');
    if (Number(count.rows[0]?.c ?? 0) === 0) {
      const ts = catalogTs();
      let sort = 0;
      for (const [code, name] of Object.entries(DEFAULT_PROJECT_TYPE_LABELS)) {
        sort += 10;
        await this.db.query(
          `INSERT INTO crm_re_project_types(code,name,description,sort_order,active,created_at,updated_at)
           VALUES($1,$2,'',$3,TRUE,$4,$4) ON CONFLICT(code) DO NOTHING`,
          [code, name, sort, ts],
        );
      }
    }
  }

  protected async query(sql: string, params: unknown[] = [], db: Db = this.db): Promise<QueryResult> {
    await this.ensureSchema();
    return db.query(sql, params);
  }

  protected normalizeStaffRole(role: string): string {
    const value = String(role || 'sales').trim().toLowerCase();
    return (PROJECT_STAFF_ROLES as readonly string[]).includes(value) ? value : 'sales';
  }

  protected parseScopeList(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map(String).map((x) => x.trim()).filter(Boolean);
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String).map((x) => x.trim()).filter(Boolean);
      } catch {}
    }
    return [];
  }

  protected enrichStaffScopeFields(row: Record<string, unknown>): ReProjectStaffRow {
    const scopeLines = this.parseScopeList(row.scope_product_lines);
    const scopeZones = this.parseScopeList(row.scope_zones);
    const role = this.normalizeStaffRole(String(row.role ?? 'sales'));
    return {
      id: Number(row.id), project_id: Number(row.project_id), staff_id: Number(row.staff_id),
      staff_name: String(row.staff_name ?? ''), staff_code: String(row.staff_code ?? ''),
      role, role_label: PROJECT_STAFF_ROLE_LABELS[role] ?? role,
      assign_enabled: Boolean(Number(row.assign_enabled ?? 0)), sort_order: Number(row.sort_order ?? 0),
      joined_at: String(row.joined_at ?? ''), left_at: row.left_at ? String(row.left_at) : null,
      active: !row.left_at, scope_product_lines: scopeLines, scope_zones: scopeZones,
      scope_product_lines_label: scopeLines.length
        ? scopeLines.map((x) => PRODUCT_LINE_LABELS[x] ?? x).join(', ') : 'Tất cả dòng SP',
      scope_zones_label: scopeZones.length ? scopeZones.join(', ') : 'Tất cả phân khu',
    };
  }

  protected async validateProjectExists(projectId: number): Promise<void> {
    const result = await this.query('SELECT 1 FROM crm_re_projects WHERE id=$1', [projectId]);
    if (!result.rows[0]) throw new Error('Không tìm thấy dự án.');
  }

  async listProjectStaff(projectId: number, activeOnly = true): Promise<ReProjectStaffRow[]> {
    await this.validateProjectExists(projectId);
    const result = await this.query(
      `SELECT ps.*,s.name AS staff_name,COALESCE(s.internal_code,'') AS staff_code
       FROM crm_re_project_staff ps JOIN crm_staff s ON s.id=ps.staff_id
       WHERE ps.project_id=$1 ${activeOnly ? 'AND ps.left_at IS NULL' : ''}
       ORDER BY ps.sort_order,ps.id`, [projectId],
    );
    return result.rows.map((r) => this.enrichStaffScopeFields(r));
  }

  async addProjectStaff(projectId: number, payload: {
    staff_id: number; role?: string; assign_enabled?: boolean | number | string;
    sort_order?: number; scope_product_lines?: string[]; scope_zones?: string[];
  }): Promise<ReProjectStaffRow> {
    await this.validateProjectExists(projectId);
    const sid = Number(payload.staff_id);
    const staff = await this.query('SELECT id FROM crm_staff WHERE id=$1 AND active IS NOT FALSE', [sid]);
    if (!staff.rows[0]) throw new Error('Nhân viên không hợp lệ hoặc đã ngưng.');
    const ts = catalogTs();
    const saved = await this.query(
      `INSERT INTO crm_re_project_staff(project_id,staff_id,role,assign_enabled,sort_order,
       scope_product_lines,scope_zones,joined_at,left_at,created_at,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$8,$8)
       ON CONFLICT(project_id,staff_id) DO UPDATE SET role=EXCLUDED.role,
       assign_enabled=EXCLUDED.assign_enabled,sort_order=EXCLUDED.sort_order,
       scope_product_lines=EXCLUDED.scope_product_lines,scope_zones=EXCLUDED.scope_zones,
       joined_at=EXCLUDED.joined_at,left_at=NULL,updated_at=EXCLUDED.updated_at RETURNING id`,
      [projectId, sid, this.normalizeStaffRole(String(payload.role ?? 'sales')),
        payload.assign_enabled === false || payload.assign_enabled === 0 ? 0 : 1,
        Number(payload.sort_order ?? 0), JSON.stringify(payload.scope_product_lines ?? []),
        JSON.stringify(payload.scope_zones ?? []), ts],
    );
    const rows = await this.query(
      `SELECT ps.*,s.name AS staff_name,COALESCE(s.internal_code,'') AS staff_code
       FROM crm_re_project_staff ps JOIN crm_staff s ON s.id=ps.staff_id WHERE ps.id=$1`,
      [saved.rows[0].id],
    );
    return this.enrichStaffScopeFields(rows.rows[0]);
  }

  async updateProjectStaff(projectId: number, staffId: number, body: UpdateProjectStaffBody): Promise<ReProjectStaffRow> {
    const current = await this.query(
      'SELECT id FROM crm_re_project_staff WHERE project_id=$1 AND staff_id=$2 AND left_at IS NULL',
      [projectId, staffId],
    );
    if (!current.rows[0]) throw new Error('Nhân viên không còn trong dự án.');
    const sets = ['updated_at=$1'];
    const params: unknown[] = [catalogTs()];
    const add = (sql: string, value: unknown) => { params.push(value); sets.push(`${sql}=$${params.length}`); };
    if (body.role != null) add('role', this.normalizeStaffRole(String(body.role)));
    if (body.assign_enabled != null) add('assign_enabled', body.assign_enabled === false || body.assign_enabled === 0 ? 0 : 1);
    if (body.sort_order != null) add('sort_order', Number(body.sort_order));
    if (body.scope_product_lines != null) add('scope_product_lines', JSON.stringify(body.scope_product_lines));
    if (body.scope_zones != null) add('scope_zones', JSON.stringify(body.scope_zones));
    params.push(current.rows[0].id);
    await this.query(`UPDATE crm_re_project_staff SET ${sets.join(',')} WHERE id=$${params.length}`, params);
    const rows = await this.query(
      `SELECT ps.*,s.name AS staff_name,COALESCE(s.internal_code,'') AS staff_code
       FROM crm_re_project_staff ps JOIN crm_staff s ON s.id=ps.staff_id WHERE ps.id=$1`,
      [current.rows[0].id],
    );
    return this.enrichStaffScopeFields(rows.rows[0]);
  }

  async removeProjectStaff(projectId: number, staffId: number): Promise<void> {
    const ts = catalogTs();
    const result = await this.query(
      'UPDATE crm_re_project_staff SET left_at=$1,updated_at=$1 WHERE project_id=$2 AND staff_id=$3 AND left_at IS NULL',
      [ts, projectId, staffId],
    );
    if (!result.rowCount) throw new Error('Nhân viên không còn trong dự án.');
  }

  private webhookBase(kind: 'facebook' | 'zalo'): string {
    const value = kind === 'facebook'
      ? process.env.CRM_FACEBOOK_WEBHOOK_URL ?? process.env.FACEBOOK_WEBHOOK_URL ?? 'https://pttads.vn/api/crm/integration/webhooks/facebook'
      : process.env.CRM_ZALO_WEBHOOK_URL ?? process.env.ZALO_WEBHOOK_URL ?? 'https://pttads.vn/api/crm/integration/webhooks/zalo';
    return value.trim().replace(/\/+$/, '');
  }

  private webhookUrl(kind: 'facebook' | 'zalo', slug: string): string {
    const clean = slug.trim().replace(/^\/+|\/+$/g, '');
    return clean ? `${this.webhookBase(kind)}/${clean}` : this.webhookBase(kind);
  }

  private defaultWebhookSlug(projectId: number): string {
    return `p${projectId}-${randomBytes(4).toString('hex').slice(0, 8)}`;
  }

  private async leadConfigRow(row: Record<string, unknown> | undefined, projectId: number): Promise<ReProjectLeadConfigRow> {
    const slug = String(row?.webhook_slug ?? '').trim() || this.defaultWebhookSlug(projectId);
    const [forms, zalo, routes] = await Promise.all([
      this.query('SELECT * FROM crm_re_project_facebook_forms WHERE project_id=$1 ORDER BY form_name,form_id', [projectId]),
      this.query('SELECT * FROM crm_re_project_zalo_campaigns WHERE project_id=$1 ORDER BY campaign_name,campaign_id', [projectId]),
      this.query('SELECT * FROM crm_re_project_website_routes WHERE project_id=$1 ORDER BY route_name,route_key', [projectId]),
    ]);
    const map = (r: Record<string, unknown>) => ({ ...r, id: Number(r.id), project_id: Number(r.project_id), active: Boolean(Number(r.active)) });
    return {
      project_id: projectId, enabled: row ? Boolean(Number(row.enabled)) : true,
      webhook_slug: slug, webhook_verify_token: String(row?.webhook_verify_token ?? ''),
      webhook_url: this.webhookUrl('facebook', slug), zalo_webhook_url: this.webhookUrl('zalo', slug),
      facebook_page_id: String(row?.facebook_page_id ?? ''), zalo_oa_id: String(row?.zalo_oa_id ?? ''),
      auto_assign: row ? Boolean(Number(row.auto_assign ?? 1)) : true,
      webhook_enabled: row ? Boolean(Number(row.webhook_enabled ?? 1)) : true,
      forms: forms.rows.map(map), zalo_campaigns: zalo.rows.map(map), website_routes: routes.rows.map(map),
      updated_at: String(row?.updated_at ?? ''), updated_by: String(row?.updated_by ?? ''),
    };
  }

  async getProjectLeadConfig(projectId: number): Promise<ReProjectLeadConfigRow> {
    await this.validateProjectExists(projectId);
    const result = await this.query('SELECT * FROM crm_re_project_lead_config WHERE project_id=$1', [projectId]);
    return this.leadConfigRow(result.rows[0], projectId);
  }

  async saveProjectLeadConfig(projectId: number, payload: SaveProjectLeadConfigBody, updatedBy = ''): Promise<ReProjectLeadConfigRow> {
    await this.validateProjectExists(projectId);
    const prior = await this.query('SELECT * FROM crm_re_project_lead_config WHERE project_id=$1', [projectId]);
    const existing = prior.rows[0] as Record<string, unknown> | undefined;
    let slug = String(existing?.webhook_slug ?? '').trim() || this.defaultWebhookSlug(projectId);
    let verify = String(existing?.webhook_verify_token ?? '').trim() || randomBytes(12).toString('base64url');
    if (payload.webhook_slug != null && String(payload.webhook_slug).trim()) slug = String(payload.webhook_slug).trim().toLowerCase();
    if (payload.regenerate_verify_token) verify = randomBytes(12).toString('base64url');
    const ts = catalogTs();
    const pageId = String(payload.facebook_page_id ?? existing?.facebook_page_id ?? '').trim();
    const oaId = String(payload.zalo_oa_id ?? existing?.zalo_oa_id ?? '').trim();
    await this.query(
      `INSERT INTO crm_re_project_lead_config(project_id,enabled,webhook_slug,webhook_verify_token,
       facebook_page_id,zalo_oa_id,auto_assign,webhook_enabled,updated_at,updated_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(project_id) DO UPDATE SET enabled=EXCLUDED.enabled,webhook_slug=EXCLUDED.webhook_slug,
       webhook_verify_token=EXCLUDED.webhook_verify_token,facebook_page_id=EXCLUDED.facebook_page_id,
       zalo_oa_id=EXCLUDED.zalo_oa_id,auto_assign=EXCLUDED.auto_assign,
       webhook_enabled=EXCLUDED.webhook_enabled,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by`,
      [projectId, payload.enabled === false || payload.enabled === 0 ? 0 : 1, slug, verify, pageId, oaId,
        payload.auto_assign === false || payload.auto_assign === 0 ? 0 : 1,
        payload.webhook_enabled === false || payload.webhook_enabled === 0 ? 0 : 1, ts, updatedBy.slice(0, 120)],
    );
    const upsert = async (table: string, key: string, rows: unknown[], values: (item: Record<string, unknown>) => unknown[]) => {
      const columns = table.includes('facebook') ? 'project_id,page_id,form_id,form_name,active,created_at,updated_at'
        : table.includes('zalo') ? 'project_id,oa_id,campaign_id,campaign_name,active,created_at,updated_at'
        : 'project_id,route_key,route_name,route_type,active,created_at,updated_at';
      const updates = table.includes('facebook') ? 'project_id=EXCLUDED.project_id,page_id=EXCLUDED.page_id,form_name=EXCLUDED.form_name,active=EXCLUDED.active,updated_at=EXCLUDED.updated_at'
        : table.includes('zalo') ? 'project_id=EXCLUDED.project_id,oa_id=EXCLUDED.oa_id,campaign_name=EXCLUDED.campaign_name,active=EXCLUDED.active,updated_at=EXCLUDED.updated_at'
        : 'project_id=EXCLUDED.project_id,route_name=EXCLUDED.route_name,route_type=EXCLUDED.route_type,active=EXCLUDED.active,updated_at=EXCLUDED.updated_at';
      for (const raw of rows) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        if (!String(item[key] ?? '').trim()) continue;
        await this.query(`INSERT INTO ${table}(${columns}) VALUES($1,$2,$3,$4,$5,$6,$6)
          ON CONFLICT(${key}) DO UPDATE SET ${updates}`, [projectId, ...values(item), ts]);
      }
    };
    if (Array.isArray(payload.forms)) await upsert('crm_re_project_facebook_forms', 'form_id', payload.forms,
      (i) => [String(i.page_id ?? pageId), String(i.form_id), String(i.form_name ?? ''), i.active === false ? 0 : 1]);
    if (Array.isArray(payload.zalo_campaigns)) await upsert('crm_re_project_zalo_campaigns', 'campaign_id', payload.zalo_campaigns,
      (i) => [String(i.oa_id ?? oaId), String(i.campaign_id), String(i.campaign_name ?? ''), i.active === false ? 0 : 1]);
    if (Array.isArray(payload.website_routes)) await upsert('crm_re_project_website_routes', 'route_key', payload.website_routes,
      (i) => [String(i.route_key ?? i.utm_campaign ?? i.campaign_code ?? ''), String(i.route_name ?? i.route_label ?? ''),
        String(i.route_type ?? 'utm').toLowerCase() || 'utm', i.active === false ? 0 : 1]);
    return this.getProjectLeadConfig(projectId);
  }
}
