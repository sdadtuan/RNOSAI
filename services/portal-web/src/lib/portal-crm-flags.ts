export function isPortalCrmCareEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_PTT_PORTAL_CRM_CARE ?? '0').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}
