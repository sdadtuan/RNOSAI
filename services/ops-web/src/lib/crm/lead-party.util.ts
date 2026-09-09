export type LeadPartyPrefillInput = {
  column?: string | null;
  meta?: Record<string, unknown> | null;
  lmpCompanyName?: string | null;
  intakeCompanyName?: string | null;
  fullName?: string | null;
};

export type LeadPartyFields = {
  company_name?: string | null;
  company_address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_asset_id?: string | null;
  full_name?: string | null;
  client_id?: string | null;
};

export type LeadPartySnapshot = {
  company_name: string;
  contact_name: string;
  address: string;
  phone: string;
  email: string;
  logo_asset_id: string;
};

export type LeadPartySendResult =
  | { ok: true }
  | { ok: false; error: 'company_name_required' | 'contact_required'; message: string };

function trimText(value: unknown): string {
  return String(value ?? '').trim();
}

function metaCompany(meta: Record<string, unknown> | null | undefined, key: string): string {
  if (!meta || typeof meta !== 'object') return '';
  return trimText(meta[key]);
}

/** Company name for quotes. Never falls back to a person `full_name`. */
export function prefillCompanyName(input: LeadPartyPrefillInput): string {
  const column = trimText(input.column);
  if (column) return column;
  const fromMetaName = metaCompany(input.meta, 'company_name');
  if (fromMetaName) return fromMetaName;
  const fromMetaCompany = metaCompany(input.meta, 'company');
  if (fromMetaCompany) return fromMetaCompany;
  const fromLmp = trimText(input.lmpCompanyName);
  if (fromLmp) return fromLmp;
  return trimText(input.intakeCompanyName);
}

export function assertLeadPartySendable(party: LeadPartyFields): LeadPartySendResult {
  const company = trimText(party.company_name);
  if (company.length < 2) {
    return {
      ok: false,
      error: 'company_name_required',
      message: 'Nhập tên công ty trước khi gửi báo giá.',
    };
  }
  const phone = trimText(party.phone);
  const email = trimText(party.email);
  const emailOk = email.includes('@');
  if (!phone && !emailOk) {
    return {
      ok: false,
      error: 'contact_required',
      message: 'Cần SĐT hoặc email trên Lead để gửi báo giá.',
    };
  }
  return { ok: true };
}

export function snapshotLeadParty(lead: LeadPartyFields): LeadPartySnapshot {
  return {
    company_name: trimText(lead.company_name),
    contact_name: trimText(lead.full_name),
    address: trimText(lead.company_address),
    phone: trimText(lead.phone),
    email: trimText(lead.email),
    logo_asset_id: trimText(lead.logo_asset_id),
  };
}

export function leadPartyClientLabel(lead: Pick<LeadPartyFields, 'company_name' | 'client_id'>): string {
  const company = trimText(lead.company_name);
  return company || '—';
}
