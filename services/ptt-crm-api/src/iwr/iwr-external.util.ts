export function parseExternalEmailAllowlist(env?: string): string[] {
  const raw = String(env ?? process.env.PTT_IWR_EXTERNAL_EMAIL_ALLOWLIST ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function isExternalEmailAllowed(email: string, allowlist: string[]): boolean {
  const normalized = String(email ?? '').trim().toLowerCase();
  const domain = normalized.split('@')[1];
  if (!normalized || !domain) return false;
  if (allowlist.includes(normalized)) return true;
  return allowlist.includes(domain) || allowlist.includes(`@${domain}`);
}
