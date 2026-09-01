import { validatePasswordForm } from './password-form.util';

describe('validatePasswordForm', () => {
  it('rejects confirm mismatch', () => {
    expect(validatePasswordForm({ current: 'a', next: 'newpass12', confirm: 'other' }).ok).toBe(false);
  });
  it('rejects short password', () => {
    expect(validatePasswordForm({ current: 'a', next: 'short', confirm: 'short' }).ok).toBe(false);
  });
  it('accepts valid form', () => {
    expect(validatePasswordForm({ current: 'a', next: 'newpass12', confirm: 'newpass12' }).ok).toBe(true);
  });
});
