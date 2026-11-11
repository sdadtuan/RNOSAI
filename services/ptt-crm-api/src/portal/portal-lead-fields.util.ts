export type LeadFormAnswer = { name: string; value: string };

export type ParsedLeadFields = {
  full_name: string;
  phone: string;
  email: string;
  answers: LeadFormAnswer[];
};

export type GraphLeadField = { name?: string; values?: unknown };

const NAME_KEYS = new Set([
  'full_name', 'name', 'your_name', 'ho_ten', 'ho_va_ten', 'hovaten', 'ten',
]);
const FIRST_KEYS = new Set(['first_name', 'ten']);
const LAST_KEYS = new Set(['last_name', 'ho']);
const EMAIL_KEYS = new Set(['email', 'e_mail', 'your_email', 'mail', 'email_address']);
const PHONE_KEYS = new Set([
  'phone_number', 'phone', 'mobile', 'mobile_phone', 'cell_phone', 'telephone', 'tel',
  'your_phone_number', 'work_phone_number', 'contact_number', 'contact_phone',
  'so_dien_thoai', 'sodienthoai', 'sdt', 'so_dt', 'dien_thoai', 'so_dien_thoai_lien_he',
]);

export function normalizeLeadFieldName(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function firstValue(raw: unknown): string {
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim();
  if (raw == null) return '';
  return String(raw).trim();
}

export function looksLikePhoneValue(value: string): boolean {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

export function parseLeadFieldData(fields?: GraphLeadField[] | null): ParsedLeadFields {
  const answers: LeadFormAnswer[] = [];
  const list = Array.isArray(fields) ? fields : [];
  let full_name = '';
  let first = '';
  let last = '';
  let phone = '';
  let email = '';
  let phoneByValue = '';

  for (const field of list) {
    const name = String(field?.name ?? '').trim();
    const value = firstValue(field?.values);
    if (!name && !value) continue;
    answers.push({ name: name || 'Trường', value });
    const key = normalizeLeadFieldName(name);
    if (!full_name && NAME_KEYS.has(key)) full_name = value;
    if (!first && FIRST_KEYS.has(key) && key !== 'ten') first = value;
    if (!first && key === 'first_name') first = value;
    if (!last && LAST_KEYS.has(key)) last = value;
    if (!email && EMAIL_KEYS.has(key)) email = value;
    if (!phone && (PHONE_KEYS.has(key) || /phone|mobile|tel|sdt|dien_thoai|so_dt|so_dien/.test(key))) {
      phone = value;
    }
    if (!phoneByValue && looksLikePhoneValue(value) && !EMAIL_KEYS.has(key) && !NAME_KEYS.has(key)) {
      phoneByValue = value;
    }
  }

  const given = [first, last].filter(Boolean).join(' ').trim();
  return {
    full_name: (full_name || given).slice(0, 200),
    phone: (phone || phoneByValue).slice(0, 40),
    email: email.slice(0, 200),
    answers,
  };
}
