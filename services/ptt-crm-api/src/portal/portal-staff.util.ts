import { BadRequestException } from '@nestjs/common';

export type PortalStaffRole = 'staff' | 'viewer';

export interface ParsedPortalStaffInput {
  name: string;
  email: string;
  phone: string;
  role: PortalStaffRole;
  password?: string;
}

export interface ParsedPortalStaffPatch {
  name?: string;
  email?: string;
  phone?: string;
  role?: PortalStaffRole;
  password?: string;
  reset_password: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

/** Keep digits and a leading +, collapse everything else. */
export function normalizePortalStaffPhone(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

function parseRole(roleRaw: string): PortalStaffRole {
  const value = String(roleRaw ?? '').trim().toLowerCase();
  if (value === 'approver') {
    throw new BadRequestException({
      error: 'invalid_role',
      message: 'Không thể đặt vai trò quản trị viên từ đây.',
      allowed: ['staff', 'viewer'],
    });
  }
  if (value !== 'staff' && value !== 'viewer') {
    throw new BadRequestException({
      error: 'invalid_role',
      allowed: ['staff', 'viewer'],
      message: 'Vai trò phải là nhân viên hoặc chỉ xem.',
    });
  }
  return value;
}

function parsePassword(passwordRaw: string): string | undefined {
  const password = passwordRaw.trim();
  if (!password) return undefined;
  if (password.length < MIN_PASSWORD_LEN) {
    throw new BadRequestException({
      error: 'password_too_short',
      min_length: MIN_PASSWORD_LEN,
      message: `Mật khẩu tối thiểu ${MIN_PASSWORD_LEN} ký tự.`,
    });
  }
  return password;
}

export function parsePortalStaffInput(body: {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  password?: string;
}): ParsedPortalStaffInput {
  const name = String(body.name ?? '').trim().slice(0, 120);
  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = normalizePortalStaffPhone(body.phone);
  const password = body.password != null ? parsePassword(String(body.password)) : undefined;

  if (!email && !phone) {
    throw new BadRequestException({
      error: 'email_or_phone_required',
      message: 'Cần email hoặc số điện thoại.',
    });
  }
  // Portal login is email + password (no OTP). Email is required so the new
  // staff member can sign in with the existing login form.
  if (!email) {
    throw new BadRequestException({
      error: 'email_required_for_login',
      message: 'Cần email để nhân viên đăng nhập Portal (email + mật khẩu).',
    });
  }
  if (!EMAIL_RE.test(email)) {
    throw new BadRequestException({ error: 'invalid_email', message: 'Email không hợp lệ.' });
  }
  if (phone && phone.replace(/\D/g, '').length < 8) {
    throw new BadRequestException({ error: 'invalid_phone', message: 'Số điện thoại không hợp lệ.' });
  }

  const role = parseRole(String(body.role ?? 'staff'));

  return {
    name,
    email,
    phone,
    role,
    ...(password ? { password } : {}),
  };
}

/** Partial update: only provided fields are validated and returned. */
export function parsePortalStaffPatch(body: {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  password?: string;
  reset_password?: boolean;
}): ParsedPortalStaffPatch {
  const out: ParsedPortalStaffPatch = { reset_password: body.reset_password === true };

  if (body.name !== undefined) {
    out.name = String(body.name ?? '').trim().slice(0, 120);
  }
  if (body.email !== undefined) {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException({
        error: 'email_required_for_login',
        message: 'Cần email để nhân viên đăng nhập Portal (email + mật khẩu).',
      });
    }
    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException({ error: 'invalid_email', message: 'Email không hợp lệ.' });
    }
    out.email = email;
  }
  if (body.phone !== undefined) {
    const phone = normalizePortalStaffPhone(body.phone);
    if (phone && phone.replace(/\D/g, '').length < 8) {
      throw new BadRequestException({ error: 'invalid_phone', message: 'Số điện thoại không hợp lệ.' });
    }
    out.phone = phone;
  }
  if (body.role !== undefined) {
    out.role = parseRole(String(body.role));
  }
  if (body.password != null && String(body.password).trim()) {
    const password = parsePassword(String(body.password));
    if (password) {
      out.password = password;
      out.reset_password = true;
    }
  }

  return out;
}

export function staffCanSeeNotification(params: {
  role: string;
  viewerId: string;
  portalUserId: string | null;
  category: string;
}): boolean {
  if (params.portalUserId && params.portalUserId === params.viewerId) return true;
  if (params.portalUserId && params.portalUserId !== params.viewerId) return false;
  // Broadcast (portal_user_id IS NULL): approvers see all; staff/viewers only
  // allowed public categories, never approver-only pending items.
  if (params.role === 'approver') return true;
  return params.category === 'campaign_milestone' || params.category === 'system';
}
