export type StaffLoginMethod = 'nest_password' | 'sso';

export interface StaffAccountTeam {
  id: number;
  name: string;
}

export interface StaffSessionListItem {
  id: string;
  current: boolean;
  login_method: StaffLoginMethod;
  device_label: string;
  ip: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface StaffAccountAuditItem {
  id: string;
  event_type: string;
  created_at: string;
  summary_vi: string;
}

export interface StaffAccountSessionsResponse {
  current_sid: string | null;
  items: StaffSessionListItem[];
}

export interface StaffAccountAuditResponse {
  items: StaffAccountAuditItem[];
}

export interface StaffAccountBundleResponse {
  profile: StaffAccountProfile;
  sessions: StaffAccountSessionsResponse;
  audit: StaffAccountAuditResponse;
}

export interface StaffAccountProfile {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  job_functions?: string[];
  permission_sets?: string[];
  client_ids?: string[];
  caps: Array<{ section: string; action: string }>;
  account_kind?: string;
  last_login_at?: string | null;
  oidc_linked?: boolean;
  password_login_enabled?: boolean;
  sso_enabled?: boolean;
  mfa_required_for_position?: boolean;
  password_step_up_required?: boolean;
  password_step_up_active?: boolean;
  password_step_up_active_until?: string | null;
  keycloak_account_url?: string | null;
  teams?: StaffAccountTeam[];
  has_avatar?: boolean;
  avatar_updated_at?: string | null;
}
