import {
  hasCapOnParentOrChild,
  MSOS_CHILD_SECTIONS,
} from '@/lib/rbac/rbac-cap-bridge.util';

const TOKEN_KEY = 'ptt_ops_access_token';
const REFRESH_KEY = 'ptt_ops_refresh_token';
const USER_KEY = 'ptt_ops_user';
/** Session marker for Next.js middleware (cannot read sessionStorage). */
export const AUTH_COOKIE = 'ptt_ops_auth';
export const POSITION_COOKIE = 'ptt_ops_position_code';

export interface StaffSectionCap {
  section: string;
  action: string;
}

export interface StoredStaffUser {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  caps?: StaffSectionCap[];
  /** R1.5 — optional until JWT carries job function metadata */
  position_code?: string;
  job_functions?: string[];
  /** R3 pilot — explicit client workspace bindings (empty = unrestricted) */
  client_ids?: string[];
  has_avatar?: boolean;
  avatar_updated_at?: string | null;
  tenant?: string;
  locale?: string;
}

export function saveSession(
  accessToken: string,
  refreshToken: string,
  user: StoredStaffUser,
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_KEY, refreshToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  syncAuthCookie(user);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
  clearAuthCookie();
}

/** Mirror login state to cookie for edge middleware. */
export function syncAuthCookie(user?: StoredStaffUser | null): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax`;
  const code = user?.position_code ?? getStoredUser()?.position_code ?? '';
  document.cookie = `${POSITION_COOKIE}=${encodeURIComponent(code)}; path=/; SameSite=Lax`;
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${POSITION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): StoredStaffUser | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredStaffUser;
  } catch {
    return null;
  }
}

/**
 * Fail-closed (R1-S2): missing user or caps → deny.
 * API guards remain authoritative; UI must not show actions without caps.
 */
export function hasCap(user: StoredStaffUser | null, section: string, action = 'view'): boolean {
  if (!user?.caps?.length) return false;
  return user.caps.some((c) => c.section === section && c.action === action);
}

export function canViewMktAiPlanner(user: StoredStaffUser | null): boolean {
  if (!hasCap(user, 'crm_board', 'view')) return false;
  return hasCap(user, 'crm_mkt_ai', 'view') || hasCap(user, 'crm_mkt_ai', 'generate');
}

export function canGenerateMktAiPlanner(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_board', 'edit') && hasCap(user, 'crm_mkt_ai', 'generate');
}

export function canExportMktAiPlanner(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_mkt_ai', 'export');
}

export function canApproveMktAiPlanner(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_mkt_ai', 'approve');
}

export function canViewContentOs(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_content', 'view') ||
    hasCap(user, 'crm_content', 'write') ||
    hasCap(user, 'crm_content', 'generate') ||
    hasCap(user, 'crm_content', 'approve_internal') ||
    hasCap(user, 'crm_content', 'qa') ||
    hasCap(user, 'crm_content', 'publish') ||
    hasCap(user, 'crm_content', 'production') ||
    hasCap(user, 'crm_content', 'assign') ||
    hasCap(user, 'crm_content', 'admin')
  );
}

/** Image SOP hub — mirrors StaffImgGuard view checks (view_all counts as view). */
export function canViewImageSop(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_img', 'view') ||
    hasCap(user, 'crm_img', 'view_all') ||
    hasCap(user, 'crm_img', 'edit') ||
    hasCap(user, 'crm_img', 'manage')
  );
}

export function canWriteContentOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_board', 'edit') && hasCap(user, 'crm_content', 'write');
}

export function canGenerateContentOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_board', 'edit') && hasCap(user, 'crm_content', 'generate');
}

export function canApproveContentOs(user: StoredStaffUser | null): boolean {
  if (!hasCap(user, 'crm_board', 'view')) return false;
  return hasCap(user, 'crm_content', 'approve_internal') || hasCap(user, 'crm_content', 'qa');
}

export function canPublishContentOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_board', 'edit') && (hasCap(user, 'crm_content', 'publish') || hasCap(user, 'crm_content', 'write'));
}

export function canProductionContentOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_board', 'edit') && (hasCap(user, 'crm_content', 'production') || hasCap(user, 'crm_content', 'write'));
}

export function canAssignContentOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_board', 'edit') && hasCap(user, 'crm_content', 'assign');
}

export function canViewLmp(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_lmp', 'view') || hasCap(user, 'crm_leads', 'view');
}

export function canViewMarketResearch(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_research', 'view');
}

export function canRunLmp(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_lmp', 'run') || hasCap(user, 'crm_leads', 'edit');
}

export function canViewMediaOs(user: StoredStaffUser | null): boolean {
  return (
    hasCapOnParentOrChild(user, 'crm_media', 'view', MSOS_CHILD_SECTIONS) ||
    hasCap(user, 'crm_media', 'write') ||
    hasCap(user, 'crm_media', 'publish') ||
    hasCap(user, 'crm_media', 'admin')
  );
}

export function canWriteMediaOs(user: StoredStaffUser | null): boolean {
  return (
    hasCapOnParentOrChild(user, 'crm_media', 'write', MSOS_CHILD_SECTIONS) ||
    hasCap(user, 'crm_media', 'admin')
  );
}

export function canPublishMediaOs(user: StoredStaffUser | null): boolean {
  return (
    hasCapOnParentOrChild(user, 'crm_media', 'publish', MSOS_CHILD_SECTIONS) ||
    hasCap(user, 'crm_media', 'admin')
  );
}

export function canFinanceRequestMediaOs(user: StoredStaffUser | null): boolean {
  return (
    hasCapOnParentOrChild(user, 'crm_media', 'finance_request', MSOS_CHILD_SECTIONS) ||
    hasCap(user, 'crm_media', 'admin')
  );
}

export function updateStoredUser(user: StoredStaffUser): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  syncAuthCookie(user);
}

export function updateAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, token);
  syncAuthCookie(getStoredUser());
}

/** Persist full refresh/login payload — access alone is not enough when refresh tokens rotate. */
export function applyStaffLoginResponse(out: {
  access_token: string;
  refresh_token: string;
  user: StoredStaffUser;
}): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, out.access_token);
  sessionStorage.setItem(REFRESH_KEY, out.refresh_token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(out.user));
  syncAuthCookie(out.user);
}
