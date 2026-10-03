import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Pool } from 'pg';
import { AdminAuditRepository } from '../../admin-audit/admin-audit.repository';
import { AppConfigService } from '../../config/app-config.service';
import { readP13Sql } from '../p13-sql';
import {
  P13_PRICING_ROLE_CODES,
  PricingError,
  assertMarginPct,
  assertPricingInputs,
  collectActivationMissing,
  previewPricing,
  roleRate,
  type PricingItemInput,
  type PricingLevel,
  type PricingLineInput,
  type PricingPreview,
  type PricingRoleInput,
  type PricingSettingsInput,
} from './pricing-engine';
import { stripPricingView } from './pricing-serialize';

const ROLE_NAMES: Record<string, string> = {
  am: 'AM',
  strategist: 'Strategist',
  content: 'Content',
  design: 'Design',
  ads: 'Ads',
  dev: 'Dev',
  data_crm: 'Data/CRM',
  media_booking: 'Media booking',
  video_production: 'Video production',
};

type VersionRow = {
  id: string;
  code: string;
  status: 'draft' | 'active' | 'retired';
  effective_from: string | null;
  effective_to: string | null;
  approved_by: string | null;
  approved_at: string | null;
  inversion_ack: boolean;
  inversion_ack_note: string | null;
  notes: string | null;
  cloned_from_id: string | null;
  updated_at: string;
};

type RoleRow = PricingRoleInput & { name: string; hourly_rate: string | null; note: string | null };

type SettingsRow = PricingSettingsInput & {
  discount_approval_threshold_pct: string | null;
  min_margin_after_discount_pct: string | null;
};

export type PricingPatch = {
  notes?: string | null;
  roles?: Array<Partial<PricingRoleInput> & { role_code: string }>;
  settings?: Partial<PricingSettingsInput>;
};

export type PricingRoleOverride =
  | Array<Partial<PricingRoleInput> & { role_code: string }>
  | (Partial<PricingRoleInput> & { role_code?: string });

export type PricingPreviewBody = {
  version_id?: string;
  params_override?: { roles?: PricingRoleOverride; settings?: Partial<PricingSettingsInput> };
  lines?: PricingLineInput[];
  include_matrix?: boolean;
  extra_discount_pct?: string | null;
  qty_overrides?: Record<string, string>;
};

function raise(error: unknown): never {
  if (error instanceof PricingError) {
    const body = { error: error.code, code: error.code, missing: error.missing };
    if (error.status === 409) throw new ConflictException(body);
    throw new UnprocessableEntityException(body);
  }
  throw error;
}

function todayVn(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

@Injectable()
export class P13PricingService {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly audit: AdminAuditRepository,
  ) {}

  private db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  private async ready(): Promise<Pool> {
    const pool = this.db();
    if (!this.schemaReady) this.schemaReady = pool.query(readP13Sql('2026-10-02-p13-04-pricing.sql')).then(() => undefined);
    await this.schemaReady;
    return pool;
  }

  async ensureEmptyDraft(actor: string): Promise<{ created: boolean; id: string }> {
    const existing = await this.ready().then((pool) =>
      pool.query<{ id: string }>(`SELECT id::text FROM crm_pricing_versions WHERE status = 'draft' ORDER BY id LIMIT 1`),
    );
    if (existing.rows[0]) return { created: false, id: existing.rows[0].id };
    const created = await this.createDraft(actor);
    return { created: true, id: created.id };
  }

  async list(): Promise<VersionRow[]> {
    const pool = await this.ready();
    const result = await pool.query<VersionRow>(
      `SELECT id::text, code, status, effective_from::text, effective_to::text, approved_by, approved_at::text,
              inversion_ack, inversion_ack_note, notes, cloned_from_id::text, updated_at::text
         FROM crm_pricing_versions ORDER BY id DESC`,
    );
    return result.rows;
  }

  async get(id: string, canViewCost: boolean): Promise<Record<string, unknown>> {
    const view = await this.loadView(id);
    return stripPricingView(view, canViewCost);
  }

  async createDraft(actor: string): Promise<VersionRow> {
    const pool = await this.ready();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const year = todayVn().slice(0, 4);
      const code = await this.nextCode(client, year);
      const inserted = await client.query<VersionRow>(
        `INSERT INTO crm_pricing_versions (code, status, created_by, updated_by)
         VALUES ($1, 'draft', $2, $2)
         RETURNING id::text, code, status, effective_from::text, effective_to::text, approved_by, approved_at::text,
                   inversion_ack, inversion_ack_note, notes, cloned_from_id::text, updated_at::text`,
        [code, actor],
      );
      const id = inserted.rows[0].id;
      for (const roleCode of P13_PRICING_ROLE_CODES) {
        await client.query(
          `INSERT INTO crm_pricing_roles (version_id, role_code, name, productive_hours)
           VALUES ($1, $2, $3, 132)`,
          [id, roleCode, ROLE_NAMES[roleCode]],
        );
      }
      await client.query(`INSERT INTO crm_pricing_settings (version_id) VALUES ($1)`, [id]);
      await client.query('COMMIT');
      await this.audit.logSyntheticEvent({
        event_type: 'p13_pricing',
        actor_email: actor,
        category: 'p13',
        severity: 'info',
        subject_label: code,
        subject_id: id,
        action: 'pricing_draft_create',
        summary: `Tạo version giá nháp ${code}`,
        diff_json: { id, code },
      });
      return inserted.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async patch(id: string, body: PricingPatch, actor: string, canViewCost = true): Promise<Record<string, unknown>> {
    const current = await this.loadBundle(id);
    if (current.version.status !== 'draft') {
      throw new ConflictException({ error: 'pricing_version_immutable', code: 'pricing_version_immutable' });
    }
    const roles = current.roles.map((role) => {
      const patch = body.roles?.find((row) => row.role_code === role.role_code);
      return patch ? { ...role, ...patch, role_code: role.role_code } : role;
    });
    const settings = { ...current.settings, ...(body.settings ?? {}) };
    try {
      assertMarginPct(settings.margin_pct);
      assertPricingInputs(roles, settings);
    } catch (error) {
      raise(error);
    }
    const pool = await this.ready();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (body.notes !== undefined) {
        await client.query(`UPDATE crm_pricing_versions SET notes = $2, updated_at = NOW(), updated_by = $3 WHERE id = $1`, [
          id,
          body.notes,
          actor,
        ]);
      }
      for (const role of roles) {
        const computed = roleRate(role);
        await client.query(
          `UPDATE crm_pricing_roles
              SET monthly_salary = $3, insurance_pct = $4, monthly_benefits = $5, productive_hours = COALESCE($6, 132),
                  hourly_rate = $7, name = $8
            WHERE version_id = $1 AND role_code = $2`,
          [
            id,
            role.role_code,
            role.monthly_salary,
            role.insurance_pct,
            role.monthly_benefits,
            role.productive_hours ?? '132',
            computed ? computed.rate.toFixed(8) : null,
            ROLE_NAMES[role.role_code] ?? role.role_code,
          ],
        );
      }
      await client.query(
        `UPDATE crm_pricing_settings
            SET overhead_pct = $2, margin_pct = $3, vat_pct = $4, rounding_unit = COALESCE($5::int, 1000),
                discount_basic_pct = COALESCE($6, 0), discount_standard_pct = $7, discount_advanced_pct = $8,
                ads_fee_pct = $9, ads_fee_min_monthly = $10, booking_fee_pct = $11,
                discount_approval_threshold_pct = $12, min_margin_after_discount_pct = $13
          WHERE version_id = $1`,
        [
          id,
          settings.overhead_pct,
          settings.margin_pct,
          settings.vat_pct,
          settings.rounding_unit ?? '1000',
          settings.discount_basic_pct,
          settings.discount_standard_pct,
          settings.discount_advanced_pct,
          settings.ads_fee_pct,
          settings.ads_fee_min_monthly,
          settings.booking_fee_pct,
          settings.discount_approval_threshold_pct ?? null,
          settings.min_margin_after_discount_pct ?? null,
        ],
      );
      await client.query(`UPDATE crm_pricing_versions SET updated_at = NOW(), updated_by = $2 WHERE id = $1`, [id, actor]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await this.audit.logSyntheticEvent({
      event_type: 'p13_pricing',
      actor_email: actor,
      category: 'p13',
      severity: 'info',
      subject_label: current.version.code,
      subject_id: id,
      action: 'pricing_draft_patch',
      summary: `Sửa version giá nháp ${current.version.code}`,
      diff_json: { fields: changedFields(body) },
    });
    return this.get(id, canViewCost);
  }

  async clone(id: string, actor: string): Promise<VersionRow> {
    const current = await this.loadBundle(id);
    const created = await this.createDraft(actor);
    await this.patch(
      created.id,
      {
        notes: current.version.notes,
        roles: current.roles,
        settings: current.settings,
      },
      actor,
    );
    const pool = await this.ready();
    await pool.query(`UPDATE crm_pricing_versions SET cloned_from_id = $2, updated_by = $3 WHERE id = $1`, [created.id, id, actor]);
    const rows = await this.list();
    return rows.find((row) => row.id === created.id) ?? created;
  }

  async activate(
    id: string,
    body: { effective_from?: string; inversion_ack?: boolean; inversion_ack_note?: string },
    actor: string,
    canViewCost = true,
  ): Promise<Record<string, unknown>> {
    const current = await this.loadBundle(id);
    if (current.version.status !== 'draft') {
      throw new ConflictException({ error: 'pricing_version_immutable', code: 'pricing_version_immutable' });
    }
    try {
      assertMarginPct(current.settings.margin_pct);
    } catch (error) {
      raise(error);
    }
    const items = await this.loadItems();
    const missing = collectActivationMissing(current.roles, current.settings, items);
    if (missing.length) {
      throw new ConflictException({ error: 'pricing_params_incomplete', code: 'pricing_params_incomplete', missing });
    }
    let preview: PricingPreview;
    try {
      preview = previewPricing({ roles: current.roles, settings: current.settings, items, include_matrix: true });
    } catch (error) {
      raise(error);
    }
    if (preview.inversions.length && (!body.inversion_ack || !body.inversion_ack_note?.trim())) {
      throw new ConflictException({ error: 'inversion_ack_required', code: 'inversion_ack_required', inversions: preview.inversions });
    }
    const effective = body.effective_from || todayVn();
    const pool = await this.ready();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE crm_pricing_versions
            SET status = 'retired', effective_to = ($1::date - INTERVAL '1 day')::date, updated_at = NOW(), updated_by = $2
          WHERE status = 'active'`,
        [effective, actor],
      );
      const updated = await client.query(
        `UPDATE crm_pricing_versions
            SET status = 'active', effective_from = $2::date, approved_by = $3, approved_at = NOW(),
                inversion_ack = $4, inversion_ack_note = $5, updated_at = NOW(), updated_by = $3
          WHERE id = $1 AND status = 'draft'`,
        [id, effective, actor, body.inversion_ack === true, body.inversion_ack_note ?? null],
      );
      if (!updated.rowCount) throw new ConflictException({ error: 'pricing_version_immutable', code: 'pricing_version_immutable' });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await this.audit.logSyntheticEvent({
      event_type: 'p13_pricing',
      actor_email: actor,
      category: 'p13',
      severity: 'info',
      subject_label: current.version.code,
      subject_id: id,
      action: 'pricing_activate',
      summary: `Kích hoạt version giá ${current.version.code}`,
      diff_json: { effective_from: effective, inversion_ack: body.inversion_ack === true },
    });
    return this.get(id, canViewCost);
  }

  async matrix(versionId?: string): Promise<Record<string, unknown>> {
    const bundle = versionId ? await this.loadBundle(versionId) : await this.loadEffective();
    if (!bundle) return { matrix: [], missing: ['pricing_version'], warnings: [], inversions: [], scope_identical: [] };
    try {
      const preview = previewPricing({ roles: bundle.roles, settings: bundle.settings, items: await this.loadItems(), include_matrix: true });
      return {
        version_id: bundle.version.id,
        code: bundle.version.code,
        matrix: preview.matrix,
        inversions: preview.inversions,
        scope_identical: preview.scope_identical,
        warnings: preview.warnings,
        missing: preview.missing,
      };
    } catch (error) {
      raise(error);
    }
  }

  async preview(body: PricingPreviewBody, canViewCost: boolean): Promise<Record<string, unknown>> {
    const base = body.version_id ? await this.loadBundle(body.version_id) : null;
    const roles = mergeRoles(base?.roles ?? emptyRoles(), body.params_override?.roles);
    const settings = { ...(base?.settings ?? emptySettings()), ...(body.params_override?.settings ?? {}) };
    try {
      assertMarginPct(settings.margin_pct);
      const preview = previewPricing({
        roles,
        settings,
        items: await this.loadItems(),
        lines: body.lines,
        include_matrix: body.include_matrix !== false,
        extra_discount_pct: body.extra_discount_pct,
        qty_overrides: body.qty_overrides,
      });
      const view = stripPricingView(preview as unknown as Record<string, unknown>, canViewCost);
      if (canViewCost) {
        const rates = preview.rates;
        view.rate = Object.fromEntries(Object.entries(rates).map(([code, row]) => [code, row.rate]));
      }
      return view;
    } catch (error) {
      raise(error);
    }
  }

  private async loadView(id: string): Promise<Record<string, unknown>> {
    const bundle = await this.loadBundle(id);
    const roles = bundle.roles.map((role) => {
      const computed = roleRate(role);
      return {
        ...role,
        hourly_rate: computed?.rate_display ?? null,
        rate: computed?.rate.toFixed() ?? null,
        rate_display: computed?.rate_display ?? null,
      };
    });
    return { ...bundle.version, roles, settings: bundle.settings };
  }

  private async loadBundle(id: string): Promise<{ version: VersionRow; roles: RoleRow[]; settings: SettingsRow }> {
    const pool = await this.ready();
    const versions = await pool.query<VersionRow>(
      `SELECT id::text, code, status, effective_from::text, effective_to::text, approved_by, approved_at::text,
              inversion_ack, inversion_ack_note, notes, cloned_from_id::text, updated_at::text
         FROM crm_pricing_versions WHERE id = $1`,
      [id],
    );
    const version = versions.rows[0];
    if (!version) throw new NotFoundException({ error: 'not_found', code: 'pricing_version_not_found' });
    const roles = await pool.query<RoleRow>(
      `SELECT role_code, name, monthly_salary::text, insurance_pct::text, monthly_benefits::text,
              productive_hours::text, hourly_rate::text, note
         FROM crm_pricing_roles WHERE version_id = $1 ORDER BY id`,
      [id],
    );
    const settings = await pool.query<SettingsRow>(
      `SELECT overhead_pct::text, margin_pct::text, vat_pct::text, rounding_unit::text,
              discount_basic_pct::text, discount_standard_pct::text, discount_advanced_pct::text,
              ads_fee_pct::text, ads_fee_min_monthly::text, booking_fee_pct::text,
              discount_approval_threshold_pct::text, min_margin_after_discount_pct::text
         FROM crm_pricing_settings WHERE version_id = $1`,
      [id],
    );
    return { version, roles: roles.rows, settings: settings.rows[0] ?? emptySettings() };
  }

  private async loadEffective(): Promise<{ version: VersionRow; roles: RoleRow[]; settings: SettingsRow } | null> {
    const pool = await this.ready();
    const row = await pool.query<{ id: string }>(
      `SELECT id::text FROM crm_pricing_versions
        WHERE status = 'active' AND (effective_from IS NULL OR effective_from <= (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
        ORDER BY effective_from DESC NULLS LAST, id DESC LIMIT 1`,
    );
    if (!row.rows[0]) return null;
    return this.loadBundle(row.rows[0].id);
  }

  private async loadItems(): Promise<PricingItemInput[]> {
    const pool = await this.ready();
    const result = await pool.query(
      `SELECT i.code, s.code AS service_code, i.min_level, i.est_hours::text, i.default_qty::text,
              i.billable, i.client_only, i.main_role_code
         FROM crm_service_items i
         JOIN crm_services s ON s.id = i.service_id
        WHERE i.is_active AND s.is_active`,
    );
    return result.rows.map((row) => ({
      code: String(row.code),
      service_code: String(row.service_code),
      min_level: String(row.min_level) as PricingLevel,
      est_hours: String(row.est_hours),
      default_qty: String(row.default_qty ?? '1'),
      billable: row.billable === true,
      client_only: row.client_only === true,
      main_role_code: String(row.main_role_code),
    }));
  }

  private async nextCode(client: { query: Pool['query'] }, year: string): Promise<string> {
    const prefix = `PV-${year}-`;
    const result = await client.query<{ code: string }>(
      `SELECT code FROM crm_pricing_versions WHERE code LIKE $1 ORDER BY code DESC LIMIT 1`,
      [`${prefix}%`],
    );
    const last = result.rows[0]?.code ?? `${prefix}00`;
    const seq = Number(last.slice(prefix.length)) || 0;
    return `${prefix}${String(seq + 1).padStart(2, '0')}`;
  }
}

function emptyRoles(): RoleRow[] {
  return P13_PRICING_ROLE_CODES.map((role_code) => ({
    role_code,
    name: ROLE_NAMES[role_code],
    monthly_salary: null,
    insurance_pct: null,
    monthly_benefits: null,
    productive_hours: '132',
    hourly_rate: null,
    note: null,
  }));
}

function emptySettings(): SettingsRow {
  return {
    overhead_pct: null,
    margin_pct: null,
    vat_pct: null,
    rounding_unit: '1000',
    discount_basic_pct: '0',
    discount_standard_pct: null,
    discount_advanced_pct: null,
    ads_fee_pct: null,
    ads_fee_min_monthly: null,
    booking_fee_pct: null,
    discount_approval_threshold_pct: null,
    min_margin_after_discount_pct: null,
  };
}

export function mergeRoles(base: RoleRow[], patch?: PricingRoleOverride): RoleRow[] {
  if (!patch) return base;
  if (Array.isArray(patch)) {
    if (!patch.length) return base;
    return base.map((role) => {
      const next = patch.find((row) => row.role_code === role.role_code);
      return next ? { ...role, ...next, role_code: role.role_code } : role;
    });
  }
  return base.map((role) => ({ ...role, ...patch, role_code: role.role_code, name: role.name }));
}

function changedFields(body: PricingPatch): string[] {
  const fields: string[] = [];
  if (body.notes !== undefined) fields.push('notes');
  for (const role of body.roles ?? []) fields.push(`roles.${role.role_code}`);
  for (const key of Object.keys(body.settings ?? {})) fields.push(`settings.${key}`);
  return fields;
}
