export function normalizePhoneDigits(phone: string): string {
  let d = String(phone ?? '').replace(/\D+/g, '');
  if (d.startsWith('84') && d.length >= 11) d = `0${d.slice(2)}`;
  return d;
}

export function phoneAppearsInText(phone: string, text: string): boolean {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 9) return false;
  const hay = String(text ?? '').replace(/\D+/g, '');
  if (hay.includes(digits)) return true;
  // also try without leading 0
  if (digits.startsWith('0') && hay.includes(digits.slice(1))) return true;
  return false;
}

export function emailAppearsInText(email: string, text: string): boolean {
  const needle = String(email ?? '').trim().toLowerCase();
  if (!needle || !needle.includes('@')) return false;
  return String(text ?? '').toLowerCase().includes(needle);
}

export function companyNameAppearsInText(company: string, text: string): boolean {
  const name = String(company ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 3) return false;
  const hay = String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
  // require a significant token sequence (≥2 words) or full name
  if (hay.includes(name)) return true;
  const tokens = name.split(' ').filter((t) => t.length >= 3);
  if (tokens.length >= 2) {
    const core = tokens.slice(0, 3).join(' ');
    return hay.includes(core);
  }
  return tokens.some((t) => t.length >= 5 && hay.includes(t));
}
