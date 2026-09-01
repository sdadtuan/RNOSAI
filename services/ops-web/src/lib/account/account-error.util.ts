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
  file_required: 'Chọn một ảnh để tải lên.',
  invalid_image: 'Chỉ nhận JPEG, PNG hoặc WebP.',
  file_too_large: 'Ảnh tối đa 1 MB.',
  avatar_not_available: 'Tài khoản này không đổi được ảnh đại diện.',
  avatar_not_found: 'Chưa có ảnh đại diện.',
};

export function staffAccountErrorVi(error: string): string {
  return ERROR_VI[error] ?? 'Không thực hiện được. Thử lại.';
}
