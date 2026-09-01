const SUMMARY_VI: Record<string, string> = {
  sso_login: 'Đăng nhập SSO',
  sso_link: 'Liên kết tài khoản SSO lần đầu',
  fallback_password: 'Đăng nhập mật khẩu Nest',
  mfa_blocked: 'Bị chặn vì chưa OTP',
  token_revoked: 'Token bị hủy',
  password_changed: 'Đổi mật khẩu Nest',
  session_revoked: 'Thu hồi một phiên',
  sessions_revoked_others: 'Đăng xuất các thiết bị khác',
  sessions_revoked_all: 'Đăng xuất mọi thiết bị',
  avatar_updated: 'Cập nhật ảnh đại diện',
  avatar_removed: 'Xóa ảnh đại diện',
};

export function staffAuditSummaryVi(eventType: string): string {
  return SUMMARY_VI[eventType] ?? 'Sự kiện tài khoản';
}
