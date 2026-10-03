import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { AdminAuditRepository } from '../../admin-audit/admin-audit.repository';
import { AppConfigService } from '../../config/app-config.service';
import { formatQuoteCode, quoteCodeYear } from '../../proposals/quote-code.util';
import { readP13Sql, withP13SchemaLock } from '../p13-sql';
import type { PricingLevel, PricingRoleInput, PricingSettingsInput } from '../pricing/pricing-engine';
import {
  acceptQuote,
  approveQuote,
  createP13Quote,
  expireQuote,
  exportQuotePdf,
  markSent,
  newQuoteVersion,
  putQuoteLines,
  quoteChecks,
  rejectQuote,
  returnQuote,
  submitQuote,
  visibleQuote,
  type P13Quote,
  type QuoteActor,
  type QuoteContext,
  type QuoteFileRow,
} from './quote-book';
import {
  DEFAULT_QUOTE_SETTINGS,
  parseThreshold,
  parseValidityDays,
  type QuoteItemRef,
  type QuoteLineInput,
  type QuoteServiceRef,
  type QuoteSettings,
  type QuoteTotals,
} from './quote-calc';
import { QuoteError } from './quote-error';

@Injectable()
export class P13QuoteService {
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
    if (!this.schemaReady) {
      this.schemaReady = withP13SchemaLock(pool, readP13Sql('2026-10-03-p13-05-quotes.sql')).catch((error: unknown) => {
        this.schemaReady = null;
        throw error;
      });
    }
    await this.schemaReady;
    return pool;
  }

  async settings(): Promise<QuoteSettings> {
    const pool = await this.ready();
    const rows = await pool.query<{ key: string; value_json: unknown }>(`SELECT key, value_json FROM crm_p13_settings WHERE key LIKE 'quote.%'`);
    const map = new Map(rows.rows.map((row) => [row.key, row.value_json]));
    return {
      discount_approval_threshold_pct: map.get('quote.discount_approval_threshold_pct') == null ? null : String(map.get('quote.discount_approval_threshold_pct')),
      default_validity_days: readValidityDays(map.get('quote.default_validity_days')),
      default_display_mode: (map.get('quote.default_display_mode') as QuoteSettings['default_display_mode']) ?? DEFAULT_QUOTE_SETTINGS.default_display_mode,
      custom_line_requires_approval: map.get('quote.custom_line_requires_approval') !== false,
      min_margin_after_discount_pct: null,
    };
  }

  async saveSettings(body: Record<string, unknown>, actor: QuoteActor) {
    if (!actor.canEditSettings) throw new QuoteError(403, 'missing_cap');
    const before = await this.settings();
    const next: QuoteSettings = {
      ...before,
      discount_approval_threshold_pct: body.discount_approval_threshold_pct === undefined ? before.discount_approval_threshold_pct : parseThreshold(body.discount_approval_threshold_pct),
      default_validity_days: body.default_validity_days === undefined ? before.default_validity_days : parseValidityDays(body.default_validity_days) ?? before.default_validity_days,
      default_display_mode: (body.default_display_mode as QuoteSettings['default_display_mode']) ?? before.default_display_mode,
      custom_line_requires_approval: body.custom_line_requires_approval === undefined ? before.custom_line_requires_approval : body.custom_line_requires_approval === true,
    };
    if (body.default_validity_days != null && (next.default_validity_days < 1 || next.default_validity_days > 30)) {
      throw new QuoteError(422, 'quote_validity_out_of_range');
    }
    const pool = await this.ready();
    const pairs: Array<[string, unknown]> = [
      ['quote.discount_approval_threshold_pct', next.discount_approval_threshold_pct],
      ['quote.default_validity_days', next.default_validity_days],
      ['quote.default_display_mode', next.default_display_mode],
      ['quote.custom_line_requires_approval', next.custom_line_requires_approval],
    ];
    for (const [key, value] of pairs) {
      await pool.query(
        `INSERT INTO crm_p13_settings (key, value_json, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [key, JSON.stringify(value), actor.email],
      );
    }
    await this.audit.logSyntheticEvent({
      event_type: 'p13_quote_settings',
      actor_email: actor.email,
      category: 'p13',
      severity: 'info',
      subject_label: 'quote-settings',
      subject_id: 'quote-settings',
      action: 'quote_settings_update',
      summary: 'Cập nhật cài đặt duyệt báo giá',
      diff_json: { before, after: next },
    });
    return next;
  }

  async list(actor: QuoteActor) {
    try {
      return await this.listRows(actor);
    } catch (error) {
      if (!isSchemaRace(error)) throw error;
      this.schemaReady = null;
      return this.listRows(actor);
    }
  }

  private async listRows(actor: QuoteActor) {
    const pool = await this.ready();
    const result = await pool.query(
      `SELECT id FROM crm_proposals WHERE pricing_source = 'p13' ORDER BY id DESC LIMIT 200`,
    );
    let ctx: QuoteContext | null = null;
    try {
      ctx = await this.context();
    } catch (error) {
      if (isSchemaRace(error)) throw error;
      ctx = null;
    }
    const rows = [];
    for (const row of result.rows) {
      try {
        const quote = await this.load(Number(row.id));
        if (ctx && quote.status === 'draft' && quote.total_vnd == null) {
          try {
            putQuoteLines(quote, quote.lines, quote.extra_discount_pct, quote.validity_days, ctx);
          } catch {
            // Keep the stored snapshot when a draft line cannot be priced.
          }
        }
        rows.push(visibleQuote(quote, actor));
      } catch (error) {
        if (error instanceof QuoteError && (error.status === 404 || error.status === 403)) continue;
        if (error instanceof TypeError) continue;
        throw error;
      }
    }
    return rows;
  }

  async create(body: { title?: string; client_name?: string; am_name?: string; is_test?: boolean }, actor: QuoteActor) {
    const ctx = await this.context();
    const quote = createP13Quote(body, { ...ctx, allocateCode: () => '' }, actor);
    const pool = await this.ready();
    const seqRow = await pool.query<{ seq: string }>(`SELECT nextval('crm_quote_code_seq') AS seq`);
    const seq = Number(seqRow.rows[0]?.seq ?? 0);
    quote.quote_code = formatQuoteCode(quoteCodeYear(), seq);
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO crm_proposals (
         title, status, owner_staff_id, quote_code, pricing_source, display_mode, validity_days,
         p13_approval_status, needs_approval, extra_discount_pct, is_test, service_slugs, total_vnd,
         notes, ai_output, created_at, updated_at, p13_version_n
       ) VALUES (
         $1, 'draft', $2, $3, 'p13', $4, $5, 'none', FALSE, 0, $6, '[]', 0, '', '{}', $7, $7, 1
       ) RETURNING id`,
      [quote.title, actor.staffId, quote.quote_code, quote.display_mode, quote.validity_days, quote.is_test, new Date().toISOString()],
    );
    quote.id = Number(inserted.rows[0]?.id);
    await this.persist(quote, actor);
    await this.auditWrite(actor, 'quote_create', quote);
    return visibleQuote(quote, actor);
  }

  async get(id: number, actor: QuoteActor) {
    const quote = await this.guardOwner(id, actor);
    if (quote.status === 'draft' && quote.p13_approval_status !== 'pending' && quote.total_vnd == null) {
      try {
        putQuoteLines(quote, quote.lines, quote.extra_discount_pct, quote.validity_days, await this.context());
      } catch {
        // A draft with an incomplete line still opens from the stored snapshot.
      }
    }
    return this.payload(quote, actor);
  }

  async putLines(id: number, body: { lines?: QuoteLineInput[]; extra_discount_pct?: string | null; validity_days?: number | null }, actor: QuoteActor) {
    const quote = await this.guardOwner(id, actor);
    const days = body.validity_days === undefined ? undefined : parseValidityDays(body.validity_days);
    putQuoteLines(quote, body.lines ?? quote.lines, body.extra_discount_pct, days, await this.context());
    await this.persist(quote, actor);
    await this.auditWrite(actor, 'quote_lines', quote);
    return this.payload(quote, actor);
  }

  async recalculate(id: number, actor: QuoteActor) {
    const quote = await this.guardOwner(id, actor);
    putQuoteLines(quote, quote.lines, quote.extra_discount_pct, quote.validity_days, await this.context());
    await this.persist(quote, actor);
    return this.payload(quote, actor);
  }

  async checks(id: number, actor: QuoteActor) {
    const quote = await this.guardOwner(id, actor);
    return quoteChecks(quote, await this.context());
  }

  async act(id: number, action: string, body: Record<string, unknown>, actor: QuoteActor) {
    const quote = await this.guardOwner(id, actor);
    const ctx = await this.context();
    if (action === 'submit') submitQuote(quote, ctx, actor);
    else if (action === 'approve') approveQuote(quote, actor);
    else if (action === 'return') returnQuote(quote, String(body.note ?? ''), actor);
    else if (action === 'mark-sent') markSent(quote, body as { sent_channel?: string; sent_evidence_url?: string; dry_run?: boolean }, ctx);
    else if (action === 'accept') acceptQuote(quote, body as { accepted_evidence_url?: string; accepted_by_contact?: string; dry_run?: boolean }, ctx);
    else if (action === 'reject') rejectQuote(quote, String(body.rejected_reason ?? ''));
    else if (action === 'expire') expireQuote(quote, ctx);
    else if (action === 'new-version') newQuoteVersion(quote);
    else throw new QuoteError(409, 'quote_invalid_transition');
    if (body.dry_run === true && (action === 'mark-sent' || action === 'accept')) return this.payload(quote, actor);
    await this.persist(quote, actor);
    await this.auditWrite(actor, action, quote);
    return this.payload(quote, actor);
  }

  async export(id: number, body: { mode?: 'draft' | 'final'; display_mode?: P13Quote['display_mode']; dry_run?: boolean }, actor: QuoteActor) {
    const quote = await this.guardOwner(id, actor);
    const ctx = await this.context();
    const result = await exportQuotePdf(quote, body, ctx, actor);
    if (!body.dry_run && result.buffer) {
      const dir = join(process.cwd(), 'data/p13-quote-files');
      mkdirSync(dir, { recursive: true });
      const storage = join(dir, result.file_name);
      writeFileSync(storage, result.buffer);
      const file = quote.files[quote.files.length - 1];
      if (file) {
        const pool = await this.ready();
        await pool.query(
          `INSERT INTO crm_p13_quote_files (proposal_id, version_n, seq, kind, file_name, storage_path, renderer_version, data_hash, display_mode, exported_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [quote.id, quote.version_n, file.seq, file.kind, file.file_name, storage, file.renderer_version, file.data_hash, file.display_mode, actor.email],
        );
      }
      await this.persist(quote, actor);
      await this.auditWrite(actor, 'quote_export', quote);
    }
    return result;
  }

  async files(id: number, actor: QuoteActor) {
    const quote = await this.guardOwner(id, actor);
    return quote.files.map(({ bytes: _bytes, ...row }) => row);
  }

  private async payload(quote: P13Quote, actor: QuoteActor) {
    const checks = quoteChecks(quote, await this.context());
    return Object.assign(visibleQuote(quote, actor), checks);
  }

  private async guardOwner(id: number, actor: QuoteActor): Promise<P13Quote> {
    return this.load(id).then((quote) => {
      visibleQuote(quote, actor);
      return quote;
    });
  }

  private async load(id: number): Promise<P13Quote> {
    const pool = await this.ready();
    const result = await pool.query(`SELECT * FROM crm_proposals WHERE id = $1`, [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row || row.pricing_source !== 'p13') throw new QuoteError(404, 'not_found');
    const lines = await pool.query(`SELECT * FROM crm_quote_line_item WHERE proposal_id = $1 ORDER BY sort_order, id`, [id]);
    const files = await pool.query(`SELECT * FROM crm_p13_quote_files WHERE proposal_id = $1 ORDER BY seq DESC`, [id]);
    const quote = rowToQuote(row, lines.rows as Array<Record<string, unknown>>, files.rows as Array<Record<string, unknown>>);
    return quote;
  }

  private async persist(quote: P13Quote, _actor: QuoteActor) {
    const pool = await this.ready();
    await pool.query(
      `UPDATE crm_proposals SET
         status = $2, display_mode = $3, validity_days = $4, issued_at = $5, valid_until = $6,
         extra_discount_pct = $7, p13_approval_status = $8, needs_approval = $9, approval_reasons = $10::jsonb,
         approval_note = $11, sent_channel = $12, sent_evidence_url = $13, accepted_evidence_url = $14,
         accepted_by_contact = $15, rejected_reason = $16, total_vnd = $17, fee_vnd = $18, fee_total = $18,
         grand_total = $17, margin_pct_effective = $19, pricing_version_id = $20, pricing_snapshot_json = $21::jsonb,
         warnings_json = $22::jsonb, p13_version_n = $23, updated_at = $24
       WHERE id = $1`,
      [
        quote.id,
        quote.status,
        quote.display_mode,
        quote.validity_days,
        quote.issued_at,
        quote.valid_until,
        quote.extra_discount_pct,
        quote.p13_approval_status,
        quote.needs_approval,
        JSON.stringify(quote.approval_reasons),
        quote.approval_note,
        quote.sent_channel,
        quote.sent_evidence_url,
        quote.accepted_evidence_url,
        quote.accepted_by_contact,
        quote.rejected_reason,
        quote.total_vnd,
        quote.fee_vnd,
        quote.margin_pct_effective,
        quote.pricing_version_id,
        JSON.stringify({ ...(quote.snapshot ?? {}), stored_calc: quote.calc }),
        JSON.stringify(quote.calc?.warnings ?? []),
        quote.version_n,
        new Date().toISOString(),
      ],
    );
    await pool.query(`DELETE FROM crm_quote_line_item WHERE proposal_id = $1 AND pricing_source = 'p13'`, [quote.id]);
    let sort = 0;
    for (const line of quote.lines) {
      sort += 1;
      await pool.query(
        `INSERT INTO crm_quote_line_item (
           proposal_id, dv_code, sku_code, package_tier, pricing_source, p13_line_type, level_code,
           qty, discount_pct, description, item_qty_overrides_json, price_snapshot_json, sort_order
         ) VALUES ($1,$2,$3,$4,'p13',$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)`,
        [
          quote.id,
          line.service_code ?? line.item_code ?? line.line_type,
          line.item_code ?? null,
          line.level_code ?? '',
          line.line_type,
          line.level_code ?? null,
          line.qty ?? '1',
          line.discount_pct ?? null,
          line.description ?? null,
          JSON.stringify(line.item_qty_overrides ?? {}),
          JSON.stringify({ input: line }),
          sort,
        ],
      );
    }
  }

  private async context(): Promise<QuoteContext> {
    const pool = await this.ready();
    const settings = await this.settings();
    const version = await pool.query<{ id: string; code: string }>(
      `SELECT id::text, code FROM crm_pricing_versions
        WHERE status = 'active'
        ORDER BY effective_from DESC NULLS LAST, id DESC LIMIT 1`,
    );
    const current = version.rows[0] ?? null;
    let roles: PricingRoleInput[] | null = null;
    let pricing: PricingSettingsInput | null = null;
    if (current) {
      const roleRows = await pool.query(
        `SELECT role_code, monthly_salary::text, insurance_pct::text, monthly_benefits::text, productive_hours::text
           FROM crm_pricing_roles WHERE version_id = $1`,
        [current.id],
      );
      roles = roleRows.rows.map((row) => ({
        role_code: String(row.role_code),
        monthly_salary: row.monthly_salary,
        insurance_pct: row.insurance_pct,
        monthly_benefits: row.monthly_benefits,
        productive_hours: row.productive_hours,
      }));
      const settingRow = await pool.query(
        `SELECT overhead_pct::text, margin_pct::text, vat_pct::text, rounding_unit::text,
                discount_basic_pct::text, discount_standard_pct::text, discount_advanced_pct::text,
                ads_fee_pct::text, ads_fee_min_monthly::text, booking_fee_pct::text,
                min_margin_after_discount_pct::text
           FROM crm_pricing_settings WHERE version_id = $1`,
        [current.id],
      );
      pricing = settingRow.rows[0] ?? null;
      if (pricing) settings.min_margin_after_discount_pct = settingRow.rows[0]?.min_margin_after_discount_pct ?? null;
    }
    const services = await pool.query(
      `SELECT id::text, code, name, exclusions FROM crm_services WHERE is_active`,
    );
    const scope = await pool.query(
      `SELECT s.code AS service_code, r.feature, r.basic_text, r.standard_text, r.advanced_text
         FROM crm_service_scope_rows r JOIN crm_services s ON s.id = r.service_id`,
    );
    const items = await pool.query(
      `SELECT i.id::text, i.code, s.code AS service_code, i.min_level, i.est_hours::text, i.default_qty::text,
              i.billable, i.client_only, i.main_role_code, i.task, i.unit, i.est_hours_is_assumption, s.name AS service_name
         FROM crm_service_items i JOIN crm_services s ON s.id = i.service_id
        WHERE i.is_active`,
    );
    const companyRows = await pool.query<{ key: string; value_json: unknown }>(
      `SELECT key, value_json FROM crm_p13_settings WHERE key IN ('quote.company_legal_name','quote.company_tax_code','quote.company_contact')`,
    );
    const companyMap = new Map(companyRows.rows.map((row) => [row.key, textValue(row.value_json)]));
    const byService = new Map<string, QuoteServiceRef>();
    for (const row of services.rows) {
      byService.set(String(row.code), {
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        exclusions: Array.isArray(row.exclusions) ? row.exclusions.map(String) : [],
        scope_matrix: [],
      });
    }
    for (const row of scope.rows) {
      byService.get(String(row.service_code))?.scope_matrix?.push({
        feature: String(row.feature),
        basic: row.basic_text == null ? null : String(row.basic_text),
        standard: row.standard_text == null ? null : String(row.standard_text),
        advanced: row.advanced_text == null ? null : String(row.advanced_text),
      });
    }
    return {
      now: new Date(),
      settings,
      roles,
      pricing,
      version: current,
      services: [...byService.values()],
      items: items.rows.map((row) => ({
        id: String(row.id),
        code: String(row.code),
        service_code: String(row.service_code),
        min_level: String(row.min_level) as PricingLevel,
        est_hours: String(row.est_hours),
        default_qty: String(row.default_qty ?? '1'),
        billable: row.billable === true,
        client_only: row.client_only === true,
        main_role_code: String(row.main_role_code),
        name: String(row.task ?? row.code),
        unit_label: unitLabel(String(row.unit ?? '')),
        est_hours_is_assumption: row.est_hours_is_assumption === true,
        service_name: String(row.service_name ?? ''),
      })) satisfies QuoteItemRef[],
      company: {
        legal_name: companyMap.get('quote.company_legal_name') ?? '',
        tax_code: companyMap.get('quote.company_tax_code') ?? '',
        contact: companyMap.get('quote.company_contact') ?? '',
      },
      allocateCode: () => '',
    };
  }

  private async auditWrite(actor: QuoteActor, action: string, quote: P13Quote) {
    await this.audit.logSyntheticEvent({
      event_type: 'p13_quote',
      actor_email: actor.email,
      category: 'p13',
      severity: 'info',
      subject_label: quote.quote_code,
      subject_id: String(quote.id),
      action,
      summary: `${action} ${quote.quote_code}`,
      diff_json: { status: quote.status, p13_approval_status: quote.p13_approval_status, total: quote.total_vnd },
    });
  }
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function unitLabel(unit: string): string {
  if (unit === 'times') return 'lần';
  if (unit === 'month' || unit === 'months') return 'tháng';
  if (unit === 'shoot_day' || unit === 'day') return 'ngày quay';
  return unit || 'lần';
}

function rowToQuote(row: Record<string, unknown>, lines: Array<Record<string, unknown>>, files: Array<Record<string, unknown>>): P13Quote {
  const parsedLines = lines.map((line) => {
    const snap = line.price_snapshot_json as { input?: QuoteLineInput } | null;
    if (snap?.input) return snap.input;
    return {
      line_type: String(line.p13_line_type ?? 'item') as QuoteLineInput['line_type'],
      service_code: line.dv_code == null ? null : String(line.dv_code),
      level_code: (line.level_code as QuoteLineInput['level_code']) ?? null,
      item_code: line.sku_code == null ? null : String(line.sku_code),
      qty: line.qty == null ? null : String(line.qty),
      discount_pct: line.discount_pct == null ? null : String(line.discount_pct),
      description: line.description == null ? null : String(line.description),
    };
  });
  const snap = asRecord(row.pricing_snapshot_json);
  const storedCalc = (snap?.stored_calc as P13Quote['calc']) ?? null;
  const snapshot = { ...(snap ?? {}) };
  delete snapshot.stored_calc;
  const columnWarnings = asStringList(row.warnings_json);
  return {
    id: Number(row.id),
    quote_code: String(row.quote_code ?? ''),
    version_n: Number(row.p13_version_n ?? 1),
    pricing_source: 'p13',
    status: String(row.status ?? 'draft'),
    owner_staff_id: Number(row.owner_staff_id ?? 0),
    shared_staff_ids: Array.isArray(row.shared_staff_ids) ? row.shared_staff_ids.map(Number) : [],
    title: String(row.title ?? ''),
    client_name: '',
    am_name: '',
    display_mode: (row.display_mode as P13Quote['display_mode']) ?? 'package_with_scope',
    validity_days: row.validity_days == null ? null : Number(row.validity_days),
    issued_at: row.issued_at == null ? null : String(row.issued_at).slice(0, 10),
    valid_until: row.valid_until == null ? null : String(row.valid_until).slice(0, 10),
    extra_discount_pct: row.extra_discount_pct == null ? '0' : String(row.extra_discount_pct),
    p13_approval_status: (row.p13_approval_status as P13Quote['p13_approval_status']) ?? 'none',
    needs_approval: row.needs_approval === true,
    approval_reasons: asStringList(row.approval_reasons),
    approval_note: row.approval_note == null ? null : String(row.approval_note),
    sent_channel: row.sent_channel == null ? null : String(row.sent_channel),
    sent_evidence_url: row.sent_evidence_url == null ? null : String(row.sent_evidence_url),
    accepted_evidence_url: row.accepted_evidence_url == null ? null : String(row.accepted_evidence_url),
    accepted_by_contact: row.accepted_by_contact == null ? null : String(row.accepted_by_contact),
    rejected_reason: row.rejected_reason == null ? null : String(row.rejected_reason),
    payment_terms: '',
    lines: parsedLines,
    calc: storedCalc ?? incompleteCalc(columnWarnings),
    snapshot: Object.keys(snapshot).length ? snapshot : null,
    pricing_version_id: row.pricing_version_id == null ? null : String(row.pricing_version_id),
    files: files.map((file) => ({
      seq: Number(file.seq),
      kind: file.kind as QuoteFileRow['kind'],
      file_name: String(file.file_name),
      renderer_version: String(file.renderer_version),
      data_hash: String(file.data_hash),
      display_mode: String(file.display_mode),
      exported_by: String(file.exported_by ?? ''),
      exported_at: String(file.exported_at ?? ''),
    })),
    total_vnd: row.grand_total == null ? null : String(row.grand_total),
    fee_vnd: row.fee_total == null ? null : String(row.fee_total),
    margin_pct_effective: row.margin_pct_effective == null ? null : String(row.margin_pct_effective),
    is_test: row.is_test === true,
    ever_left_draft: String(row.status) !== 'draft',
  };
}

function readValidityDays(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : DEFAULT_QUOTE_SETTINGS.default_validity_days;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function incompleteCalc(warnings: string[]): QuoteTotals | null {
  if (!warnings.includes('pricing_params_incomplete')) return null;
  return {
    lines: [],
    totals: null,
    effective_discount_pct: null,
    needs_approval: false,
    approval_reasons: [],
    warnings,
    blockers: ['pricing_params_incomplete'],
    missing: ['pricing_version'],
    preview: null,
  };
}

function isSchemaRace(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? '');
  return code === '40P01' || code === '42703' || code === '42P01' || code === '55P03';
}

export function raiseQuote(error: unknown): never {
  if (error instanceof QuoteError) {
    const body = { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    if (error.status === 403) throw new ForbiddenException(body);
    if (error.status === 404) throw new NotFoundException(body);
    if (error.status === 409) throw new ConflictException(body);
    throw new UnprocessableEntityException(body);
  }
  throw error;
}
