import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '../auth';
import {
  canFinanceRequestMediaOs,
  canPublishMediaOs,
  canViewMediaOs,
  canWriteMediaOs,
} from '../auth';

function user(caps: string[]): StoredStaffUser {
  return {
    id: '1',
    email: 'a@b.c',
    display_name: 'Test',
    position_id: 1,
    caps: caps.map((cap) => {
      const [section, action] = cap.split(':');
      return { section, action };
    }),
  };
}

describe('Media OS auth caps', () => {
  it('canViewMediaOs requires crm_media view/write/publish/admin', () => {
    expect(canViewMediaOs(null)).toBe(false);
    expect(canViewMediaOs(user(['crm_board:view']))).toBe(false);
    expect(canViewMediaOs(user(['crm_media:view']))).toBe(true);
    expect(canViewMediaOs(user(['crm_media:write']))).toBe(true);
    expect(canViewMediaOs(user(['crm_media:publish']))).toBe(true);
    expect(canViewMediaOs(user(['crm_media:admin']))).toBe(true);
    expect(canViewMediaOs(user(['crm_media:finance_request']))).toBe(false);
  });

  it('canWriteMediaOs requires write or admin', () => {
    expect(canWriteMediaOs(user(['crm_media:view']))).toBe(false);
    expect(canWriteMediaOs(user(['crm_media:write']))).toBe(true);
    expect(canWriteMediaOs(user(['crm_media:admin']))).toBe(true);
  });

  it('canPublishMediaOs requires publish or admin', () => {
    expect(canPublishMediaOs(user(['crm_media:view']))).toBe(false);
    expect(canPublishMediaOs(user(['crm_media:publish']))).toBe(true);
    expect(canPublishMediaOs(user(['crm_media:admin']))).toBe(true);
  });

  it('canFinanceRequestMediaOs requires finance_request or admin', () => {
    expect(canFinanceRequestMediaOs(user(['crm_media:view']))).toBe(false);
    expect(canFinanceRequestMediaOs(user(['crm_media:finance_request']))).toBe(true);
    expect(canFinanceRequestMediaOs(user(['crm_media:admin']))).toBe(true);
  });
});
