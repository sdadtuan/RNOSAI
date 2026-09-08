import { Inject, Injectable } from '@nestjs/common';
import {
  QT_SETTINGS_QUERY,
  QT_TENANT_ID,
  QuoteSettingsQueryPort,
} from './quote-settings.repository';

const PATCH_FIELDS = [
  'validity_days',
  'vat_bps',
  'payment_template',
  'gm_floor_bps',
  'discount_auto_bps',
  'director_value_vnd',
  'payment_term_max_days',
  'share_expiry_days',
  'pdf_download',
  'otp_required',
  'view_tracking',
  'ai_enabled',
] as const;

const RESPONSE_FIELDS = [
  'tenant_id',
  'quote_code_pattern',
  'validity_days',
  'vat_bps',
  'currency_code',
  'timezone',
  'issuing_entity',
  'payment_template',
  'gm_floor_bps',
  'discount_auto_bps',
  'director_value_vnd',
  'payment_term_max_days',
  'share_expiry_days',
  'pdf_download',
  'otp_required',
  'view_tracking',
  'ai_enabled',
  'updated_at',
  'updated_by_staff_id',
] as const;

const INT_FIELDS = new Set([
  'validity_days',
  'vat_bps',
  'gm_floor_bps',
  'discount_auto_bps',
  'director_value_vnd',
  'payment_term_max_days',
  'share_expiry_days',
  'updated_by_staff_id',
]);

const BOOL_FIELDS = new Set([
  'pdf_download',
  'otp_required',
  'view_tracking',
  'ai_enabled',
]);

export const DEFAULT_PTT_SETTINGS: Record<string, unknown> = {
  tenant_id: QT_TENANT_ID,
  quote_code_pattern: 'QT-PTT-{YYYY}-{SEQ:6}',
  validity_days: 30,
  vat_bps: 800,
  currency_code: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  issuing_entity: 'PTT-HCM',
  payment_template: '50/30/20',
  gm_floor_bps: 2500,
  discount_auto_bps: 500,
  director_value_vnd: 200000000,
  payment_term_max_days: 60,
  share_expiry_days: 14,
  pdf_download: true,
  otp_required: true,
  view_tracking: true,
  ai_enabled: false,
};

export type QuoteSettingsPatch = Partial<
  Record<(typeof PATCH_FIELDS)[number] | 'quote_code_pattern', unknown>
>;

export function isQtAiEnabled(): boolean {
  return process.env.QT_AI_ENABLED === '1';
}

@Injectable()
export class QuoteSettingsService {
  constructor(
    @Inject(QT_SETTINGS_QUERY) private readonly db: QuoteSettingsQueryPort,
  ) {}

  async get(): Promise<Record<string, unknown>> {
    await this.ensureRow();
    const result = await this.db.query(
      `SELECT tenant_id, quote_code_pattern, validity_days, vat_bps,
              currency_code, timezone, issuing_entity, payment_template,
              gm_floor_bps, discount_auto_bps, director_value_vnd,
              payment_term_max_days, share_expiry_days, pdf_download,
              otp_required, view_tracking, ai_enabled, updated_at,
              updated_by_staff_id
         FROM crm_quote_settings
        WHERE tenant_id = $1
        LIMIT 1`,
      [QT_TENANT_ID],
    );
    return mapSettings(result.rows[0] ?? DEFAULT_PTT_SETTINGS);
  }

  async patch(
    input: QuoteSettingsPatch,
    updatedByStaffId: number | null = null,
  ): Promise<Record<string, unknown>> {
    await this.ensureRow();
    const params: unknown[] = [];
    const sets: string[] = [];

    for (const field of PATCH_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
      if (field === 'ai_enabled' && !isQtAiEnabled()) continue;
      params.push(input[field]);
      sets.push(`${field} = $${params.length}`);
    }

    if (sets.length === 0) return this.get();

    params.push(updatedByStaffId, QT_TENANT_ID);
    const result = await this.db.query(
      `UPDATE crm_quote_settings
          SET ${sets.join(', ')},
              updated_at = now(),
              updated_by_staff_id = $${params.length - 1}
        WHERE tenant_id = $${params.length}
        RETURNING tenant_id, quote_code_pattern, validity_days, vat_bps,
                  currency_code, timezone, issuing_entity, payment_template,
                  gm_floor_bps, discount_auto_bps, director_value_vnd,
                  payment_term_max_days, share_expiry_days, pdf_download,
                  otp_required, view_tracking, ai_enabled, updated_at,
                  updated_by_staff_id`,
      params,
    );
    return mapSettings(result.rows[0] ?? (await this.get()));
  }

  private async ensureRow(): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_quote_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [QT_TENANT_ID],
    );
  }
}

function mapSettings(row: Record<string, unknown>): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const field of RESPONSE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(row, field) && !(field in DEFAULT_PTT_SETTINGS)) {
      continue;
    }
    const value = Object.prototype.hasOwnProperty.call(row, field)
      ? row[field]
      : DEFAULT_PTT_SETTINGS[field];
    if (INT_FIELDS.has(field)) {
      settings[field] = value == null ? null : Number(value);
      continue;
    }
    if (BOOL_FIELDS.has(field)) {
      settings[field] = value === true || value === 't' || value === 'true';
      continue;
    }
    settings[field] = value ?? DEFAULT_PTT_SETTINGS[field] ?? null;
  }
  return settings;
}
