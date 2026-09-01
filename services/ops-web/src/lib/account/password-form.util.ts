export function validatePasswordForm(input: {
  current: string;
  next: string;
  confirm: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.next !== input.confirm) {
    return { ok: false, error: 'Mật khẩu xác nhận không khớp.' };
  }
  if (input.next.trim().length < 8) {
    return { ok: false, error: 'Mật khẩu mới tối thiểu 8 ký tự.' };
  }
  return { ok: true };
}
