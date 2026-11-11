export type PortalPageChannel = 'facebook' | 'zalo' | 'google' | 'tiktok' | 'ad_account';

const CHANNELS = new Set<PortalPageChannel>(['facebook', 'zalo', 'google', 'tiktok', 'ad_account']);

export function normalizePortalChannel(raw: unknown): PortalPageChannel | null {
  const value = String(raw ?? 'facebook').trim().toLowerCase();
  if (value === 'meta' || value === 'fb' || value === '') return 'facebook';
  if (CHANNELS.has(value as PortalPageChannel)) return value as PortalPageChannel;
  return null;
}

/** Page id owned by one client per channel. Facebook, Zalo and TikTok stay numeric. Google may include dashes. */
export function normalizePortalPageId(raw: unknown, channel: PortalPageChannel = 'facebook'): string | null {
  const id = String(raw ?? '').trim();
  const compact = channel === 'google'
    ? id.replace(/[\s-]/g, '')
    : id.replace(/^act_/i, '').replace(/\s/g, '');
  if (!/^\d{6,32}$/.test(compact)) return null;
  return compact;
}

export function portalCrmCareEnabled(): boolean {
  const raw = (process.env.PTT_PORTAL_CRM_CARE ?? '0').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/** Meta ad account ids in portal_client_pages are stored without the act_ prefix. */
export function formatMetaAdAccountId(digits: string): string {
  const id = normalizePortalPageId(digits, 'ad_account');
  return id ? `act_${id}` : digits;
}
