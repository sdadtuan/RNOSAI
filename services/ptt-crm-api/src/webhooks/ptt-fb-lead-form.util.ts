export const PTT_LEAD_FORM_KEYS = {
  full_name: 'full_name',
  phone_number: 'phone_number',
  company_name: 'company_name',
  ad_budget_band: 'ad_budget_band',
  ad_channels: 'ad_channels',
} as const;

export const PTT_LEAD_BUDGET_VALUES = ['<20tr', '20-50', '50-100', '>100'] as const;
export const PTT_LEAD_CHANNEL_VALUES = ['meta', 'tiktok', 'google', 'none'] as const;

export type LeadFormFields = Record<string, string | undefined>;

export type LeadFormQualific = {
  has_company: boolean;
  has_budget: boolean;
  has_channel: boolean;
  qualified: boolean;
};

function read(fields: LeadFormFields, ...keys: string[]): string {
  for (const key of keys) {
    const value = String(fields[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function leadFormQualific(fields: LeadFormFields): LeadFormQualific {
  const company = read(fields, PTT_LEAD_FORM_KEYS.company_name, 'company');
  const budget = read(fields, PTT_LEAD_FORM_KEYS.ad_budget_band);
  const channel = read(fields, PTT_LEAD_FORM_KEYS.ad_channels);
  const has_company = company.length >= 2;
  const has_budget = (PTT_LEAD_BUDGET_VALUES as readonly string[]).includes(budget);
  const has_channel = (PTT_LEAD_CHANNEL_VALUES as readonly string[]).includes(channel);
  return {
    has_company,
    has_budget,
    has_channel,
    qualified: has_company && has_budget && has_channel,
  };
}

export function leadFormQualificRate(rows: LeadFormFields[]): {
  total: number;
  qualified: number;
  rate: number | null;
} {
  const total = rows.length;
  if (total === 0) return { total: 0, qualified: 0, rate: null };
  const qualified = rows.filter((row) => leadFormQualific(row).qualified).length;
  return { total, qualified, rate: qualified / total };
}
