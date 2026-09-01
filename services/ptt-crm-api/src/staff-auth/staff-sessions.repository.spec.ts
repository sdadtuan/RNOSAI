import {
  isUuidStaffUserId,
  sessionToListItem,
  type StaffSessionDbRow,
} from './staff-sessions.repository';

describe('isUuidStaffUserId', () => {
  it('rejects stub ids', () => {
    expect(isUuidStaffUserId('staff-001')).toBe(false);
  });

  it('accepts uuid', () => {
    expect(isUuidStaffUserId('19d722af-0000-4000-8000-000000000001')).toBe(true);
  });
});

describe('sessionToListItem', () => {
  it('maps row without raw ua', () => {
    const row: StaffSessionDbRow = {
      id: 's1',
      user_id: 'u1',
      login_method: 'sso',
      user_agent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ip: '1.2.3.4',
      created_at: new Date('2026-09-01T00:00:00Z'),
      last_seen_at: new Date('2026-09-01T01:00:00Z'),
      expires_at: new Date('2026-09-02T00:00:00Z'),
      revoked_at: null,
      revoke_reason: null,
    };
    const item = sessionToListItem(row, 's1');
    expect(item.current).toBe(true);
    expect(item.device_label).toBe('Chrome · macOS');
    expect(item.login_method).toBe('sso');
    expect((item as { user_agent?: string }).user_agent).toBeUndefined();
  });
});
