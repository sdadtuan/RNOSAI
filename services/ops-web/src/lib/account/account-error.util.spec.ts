import { staffAccountErrorVi } from './account-error.util';

describe('staffAccountErrorVi', () => {
  it('maps invalid_current_password', () => {
    expect(staffAccountErrorVi('invalid_current_password')).toBe('Mật khẩu hiện tại không đúng.');
  });
});
