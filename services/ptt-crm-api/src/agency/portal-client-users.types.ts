export type PortalClientRole = 'viewer' | 'approver' | 'staff';

export function portalClientRole(raw: unknown): PortalClientRole {
  if (raw === 'approver' || raw === 'staff') return raw;
  return 'viewer';
}

export interface PortalClientUserPublic {
  id: string;
  email: string;
  role: PortalClientRole;
  active: boolean;
  display_name: string;
  phone: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalClientUsersListResponse {
  ok: boolean;
  client_id: string;
  users: PortalClientUserPublic[];
  table_ready: boolean;
}

export interface CreatePortalClientUserBody {
  email: string;
  password?: string;
  role?: PortalClientRole;
  display_name?: string;
  phone?: string;
  /** Default true — gửi email template thông tin đăng nhập khi PTT_PORTAL_EMAIL_NOTIFY=1 */
  send_email?: boolean;
}

export interface PortalCredentialsEmailDelivery {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export interface CreatePortalClientUserResponse {
  ok: boolean;
  user: PortalClientUserPublic;
  /** Present when server generated password (create or reset). Show once to AM for handover. */
  temporary_password?: string;
  email_delivery?: PortalCredentialsEmailDelivery;
}

export interface UpdatePortalClientUserBody {
  role?: PortalClientRole;
  active?: boolean;
  display_name?: string;
  phone?: string;
  /** Optional login-email change; uniqueness is checked excluding this user. */
  email?: string;
}

export interface ResetPortalClientUserPasswordBody {
  password?: string;
  send_email?: boolean;
}

export interface ResetPortalClientUserPasswordResponse {
  ok: boolean;
  temporary_password?: string;
  email_delivery?: PortalCredentialsEmailDelivery;
}
