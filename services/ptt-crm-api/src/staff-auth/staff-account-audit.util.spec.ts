import { staffAuditSummaryVi } from './staff-account-audit.util';

describe('staffAuditSummaryVi', () => {
  it('maps known events', () => {
    expect(staffAuditSummaryVi('sso_login')).toBe('Đăng nhập SSO');
    expect(staffAuditSummaryVi('password_changed')).toBe('Đổi mật khẩu Nest');
    expect(staffAuditSummaryVi('avatar_updated')).toBe('Cập nhật ảnh đại diện');
  });

  it('unknown is generic', () => {
    expect(staffAuditSummaryVi('nope')).toBe('Sự kiện tài khoản');
  });
});
