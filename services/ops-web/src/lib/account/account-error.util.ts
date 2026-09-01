const ERROR_VI: Record<string, string> = {
  invalid_current_password: 'Mật khẩu hiện tại không đúng.',
  password_too_short: 'Mật khẩu mới tối thiểu 8 ký tự.',
  password_unchanged: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  password_change_sso_only: 'Tài khoản này đổi mật khẩu trên Keycloak.',
  password_change_not_available: 'Tài khoản này không dùng mật khẩu Nest.',
  session_revoked: 'Phiên đã hết hạn hoặc bị thu hồi. Đăng nhập lại.',
  session_not_found: 'Không tìm thấy phiên.',
  session_binding_required: 'Làm mới trang hoặc đăng nhập lại để quản lý phiên.',
  rate_limited: 'Thử lại sau vài phút.',
  captcha_required: 'Xác minh chống bot chưa hoàn tất. Thử lại.',
  captcha_failed: 'Xác minh chống bot không hợp lệ. Thử lại.',
  step_up_required: 'Chức vụ này cần xác minh OTP trước khi đổi mật khẩu.',
  step_up_mfa_required: 'Keycloak chưa xác minh OTP. Thử lại.',
  step_up_email_mismatch: 'Tài khoản Keycloak không khớp email đăng nhập.',
  step_up_exchange_failed: 'Không xác minh OTP được. Thử lại.',
  step_up_not_available: 'Chưa cấu hình SSO để xác minh OTP.',
  step_up_not_required: 'Chức vụ này không cần xác minh OTP.',
  file_required: 'Chọn một ảnh để tải lên.',
  invalid_image: 'Chỉ nhận JPEG, PNG hoặc WebP.',
  file_too_large: 'Ảnh tối đa 1 MB.',
  avatar_not_available: 'Tài khoản này không đổi được ảnh đại diện.',
  avatar_not_found: 'Chưa có ảnh đại diện.',
};

export function staffAccountErrorVi(error: string): string {
  return ERROR_VI[error] ?? 'Không thực hiện được. Thử lại.';
}
