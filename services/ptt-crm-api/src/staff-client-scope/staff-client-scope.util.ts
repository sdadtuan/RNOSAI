const SUPER_ADMIN_CODES = new Set(['super-admin', 'super_admin', 'SUPER-ADMIN']);

export function isSuperAdminPositionCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return SUPER_ADMIN_CODES.has(String(code).trim().toLowerCase());
}

/** Compact SUPER-ADMIN grant: one wildcard pair instead of section × action explosion. */
export const SUPER_ADMIN_WILDCARD = '*';

export function capAllows(
  caps: Array<{ section?: string; action?: string }> | null | undefined,
  section: string,
  action: string,
): boolean {
  if (!caps?.length) return false;
  return caps.some((cap) => {
    const sec = String(cap.section ?? '');
    const act = String(cap.action ?? '');
    return (sec === SUPER_ADMIN_WILDCARD || sec === section) && (act === SUPER_ADMIN_WILDCARD || act === action);
  });
}

export function normalizeClientIds(ids: string[] | null | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

/** Scoped when pilot is on and user has explicit client bindings (non-empty). */
export function isClientScopeRestricted(
  pilotEnabled: boolean,
  positionCode: string | null | undefined,
  clientIds: string[] | null | undefined,
): boolean {
  if (!pilotEnabled) return false;
  if (isSuperAdminPositionCode(positionCode)) return false;
  return normalizeClientIds(clientIds).length > 0;
}

export function assertClientInScope(
  clientId: string | null | undefined,
  allowedClientIds: string[],
): boolean {
  const cid = String(clientId ?? '').trim();
  if (!cid) return false;
  return allowedClientIds.includes(cid);
}
