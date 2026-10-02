export const TRIAL_ROLES = [
  ['am', 'AM'],
  ['strategist', 'Strategist'],
  ['content', 'Content'],
  ['design', 'Design'],
  ['ads', 'Ads'],
  ['dev', 'Dev'],
  ['data_crm', 'Data CRM'],
  ['media_booking', 'Media booking'],
  ['video_production', 'Sản xuất video'],
] as const;

export const TRIAL_SERVICES = ['BI', 'CS', 'WEB', 'ADS', 'SEO', 'BOT', 'CRM', 'NUR', 'RET', 'MAU', 'MKT', 'DSH', 'MED', 'PR', 'KOL', 'VID'] as const;

export const ROUNDING_UNITS = ['0', '1000', '10000', '100000'] as const;

export type TrialLevel = 'basic' | 'standard' | 'advanced';

export type TrialRole = {
  role_code: string;
  monthly_salary: string;
  insurance_pct: string;
  monthly_benefits: string;
  productive_hours: string;
};

export type TrialSettings = {
  overhead_pct: string;
  margin_pct: string;
  vat_pct: string;
  discount_basic_pct: string;
  discount_standard_pct: string;
  discount_advanced_pct: string;
  rounding_unit: string;
};

export type TrialForm = {
  roles: TrialRole[];
  settings: TrialSettings;
};

export type TrialLine = {
  key: string;
  type: 'package' | 'item';
  service_code: string;
  level: TrialLevel;
  item_code: string;
  qty: string;
};

export type VersionRoleSeed = {
  role_code: string;
  monthly_salary?: string | null;
  insurance_pct?: string | null;
  monthly_benefits?: string | null;
  productive_hours?: string | null;
};

export type VersionSettingsSeed = Partial<TrialSettings> | null;

const FIXTURE_ROLE = {
  monthly_salary: '20000000',
  insurance_pct: '0.20',
  monthly_benefits: '1000000',
  productive_hours: '132',
};

const FIXTURE_SETTINGS: TrialSettings = {
  overhead_pct: '0.30',
  margin_pct: '0.25',
  vat_pct: '0.08',
  discount_basic_pct: '0',
  discount_standard_pct: '0.05',
  discount_advanced_pct: '0.10',
  rounding_unit: '1000',
};

function blankRole(role_code: string): TrialRole {
  return { role_code, monthly_salary: '', insurance_pct: '', monthly_benefits: '', productive_hours: '' };
}

function text(value: string | null | undefined): string {
  return value ?? '';
}

export function emptyTrial(): TrialForm {
  return {
    roles: TRIAL_ROLES.map(([code]) => blankRole(code)),
    settings: {
      overhead_pct: '',
      margin_pct: '',
      vat_pct: '',
      discount_basic_pct: '',
      discount_standard_pct: '',
      discount_advanced_pct: '',
      rounding_unit: '1000',
    },
  };
}

export function trialFromVersion(roles: VersionRoleSeed[], settings: VersionSettingsSeed): TrialForm {
  const byCode = new Map(roles.map((role) => [role.role_code, role]));
  return {
    roles: TRIAL_ROLES.map(([code]) => {
      const row = byCode.get(code);
      return {
        role_code: code,
        monthly_salary: text(row?.monthly_salary),
        insurance_pct: text(row?.insurance_pct),
        monthly_benefits: text(row?.monthly_benefits),
        productive_hours: text(row?.productive_hours),
      };
    }),
    settings: {
      overhead_pct: text(settings?.overhead_pct),
      margin_pct: text(settings?.margin_pct),
      vat_pct: text(settings?.vat_pct),
      discount_basic_pct: text(settings?.discount_basic_pct),
      discount_standard_pct: text(settings?.discount_standard_pct),
      discount_advanced_pct: text(settings?.discount_advanced_pct),
      rounding_unit: text(settings?.rounding_unit) || '1000',
    },
  };
}

export function trialFromFixture(): TrialForm {
  return {
    roles: TRIAL_ROLES.map(([code]) => ({ role_code: code, ...FIXTURE_ROLE })),
    settings: { ...FIXTURE_SETTINGS },
  };
}

export function formatGroupedInt(digits: string): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!clean) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function digitsFromGrouped(textValue: string): string {
  return textValue.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

export function ratioToVi(ratio: string): string {
  return ratio.replace('.', ',');
}

export function viToRatio(textValue: string): string {
  const trimmed = textValue.trim().replace(/\s/g, '').replace(',', '.');
  if (!trimmed) return '';
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return trimmed.replace(/[^\d.]/g, '');
  return trimmed;
}

export function formatVnd(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const neg = value.startsWith('-');
  const whole = (neg ? value.slice(1) : value).split('.')[0]?.replace(/\D/g, '') ?? '';
  if (!whole) return '—';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? `-${grouped}` : grouped;
}

export function formatRoundingLabel(unit: string): string {
  if (unit === '0') return '0';
  return formatGroupedInt(unit);
}

function nullable(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export function buildPreviewBody(form: TrialForm, lines: TrialLine[], versionId: string) {
  return {
    version_id: versionId || undefined,
    include_matrix: true,
    params_override: {
      roles: form.roles.map((role) => ({
        role_code: role.role_code,
        monthly_salary: nullable(role.monthly_salary),
        insurance_pct: nullable(role.insurance_pct),
        monthly_benefits: nullable(role.monthly_benefits),
        productive_hours: nullable(role.productive_hours),
      })),
      settings: {
        overhead_pct: nullable(form.settings.overhead_pct),
        margin_pct: nullable(form.settings.margin_pct),
        vat_pct: nullable(form.settings.vat_pct),
        discount_basic_pct: nullable(form.settings.discount_basic_pct),
        discount_standard_pct: nullable(form.settings.discount_standard_pct),
        discount_advanced_pct: nullable(form.settings.discount_advanced_pct),
        rounding_unit: nullable(form.settings.rounding_unit),
      },
    },
    lines: lines.flatMap((line) => {
      const qty = line.qty.trim() || '1';
      if (line.type === 'package' && line.service_code.trim()) {
        return [{ type: 'package' as const, service_code: line.service_code.trim(), level: line.level, qty }];
      }
      if (line.type === 'item' && line.item_code.trim()) {
        return [{ type: 'item' as const, code: line.item_code.trim(), qty }];
      }
      return [];
    }),
  };
}

const PREVIEW_ERROR_TEXT: Record<string, string> = {
  margin_out_of_range: 'Margin phải từ 0 đến dưới 1.',
  pct_out_of_range: 'Tỷ lệ hoặc số giờ nằm ngoài khoảng cho phép.',
};

export function previewFieldError(code: string | undefined): Partial<Record<keyof TrialSettings, string>> {
  if (code === 'margin_out_of_range') return { margin_pct: 'margin_out_of_range' };
  return {};
}

export function previewErrorText(code: string, fallback: string): string {
  return PREVIEW_ERROR_TEXT[code] || fallback;
}

export function previewExportPayload(request: unknown, response: unknown) {
  return { request, response };
}

export function preferredVersionId(versions: Array<{ id: string; code: string }>): string {
  return versions.find((row) => row.code === 'PV-2026-01')?.id ?? versions[0]?.id ?? '';
}
