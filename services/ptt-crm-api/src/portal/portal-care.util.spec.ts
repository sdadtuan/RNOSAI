import {
  adsChannelOf,
  appendAssigneeWhere,
  careDueAt,
  careListFilterForUser,
  filterCasesForPortalList,
  filterVisiblePages,
  nextAssignee,
  receiveDueAt,
  shouldHopCare,
  shouldHopReceive,
  staffCanViewCareCase,
  visibleAdsChannels,
} from './portal-care.util';

describe('portal care assignment', () => {
  it('keeps manually assigned active pages without ad accounts in the inbox list', () => {
    const pages = [
      { channel: 'facebook', page_id: '111', active: true },
      { channel: 'ad_account', page_id: 'act_1', active: true },
      { channel: 'facebook', page_id: '222', active: false },
    ];
    expect(filterVisiblePages(pages)).toEqual([{ channel: 'facebook', page_id: '111', active: true }]);
  });

  it('shows only channels that exist on the client', () => {
    expect(visibleAdsChannels(['meta', 'google', 'meta'])).toEqual([
      { id: 'meta', label: 'Meta', pageChannels: ['facebook'] },
      { id: 'google', label: 'Google', pageChannels: ['google'] },
    ]);
    expect(visibleAdsChannels([])).toEqual([]);
    expect(adsChannelOf('tiktok')?.label).toBe('TikTok');
  });

  it('gives the next lead to the staff member with fewer open cases', () => {
    expect(nextAssignee(['b', 'a'], { a: 2, b: 1 }, null)).toBe('b');
    expect(nextAssignee(['a'], { a: 3 }, 'a')).toBeNull();
    expect(nextAssignee(['a', 'b'], { a: 1, b: 1 }, 'a')).toBe('b');
  });

  it('scopes staff lists to their assignee_user_id; managers see all cases', () => {
    const staff = { role: 'staff', sub: 'staff-a' };
    const approver = { role: 'approver', sub: 'mgr-1' };
    expect(careListFilterForUser(staff)).toEqual({ assigneeUserId: 'staff-a' });
    expect(careListFilterForUser(approver)).toEqual({});
    expect(staffCanViewCareCase(staff, 'staff-a')).toBe(true);
    expect(staffCanViewCareCase(staff, 'other')).toBe(false);
    expect(staffCanViewCareCase(staff, null)).toBe(false);
    expect(staffCanViewCareCase(approver, null)).toBe(true);
    expect(staffCanViewCareCase({ role: 'viewer', sub: 'v1' }, null)).toBe(true);
    expect(careListFilterForUser({ role: 'admin', sub: 'admin-1' })).toEqual({});
    expect(staffCanViewCareCase({ role: 'admin', sub: 'admin-1' }, null)).toBe(true);
    expect(staffCanViewCareCase({ role: 'owner', sub: 'owner-1' }, null)).toBe(true);
  });

  it('filters list/badge cases by attached pages and assignee visibility', () => {
    const attached = ['page-live'];
    const rows = [
      { id: 'mine', page_id: 'page-live', assignee_user_id: 'staff-a' },
      { id: 'other', page_id: 'page-live', assignee_user_id: 'staff-b' },
      { id: 'open', page_id: 'page-live', assignee_user_id: null },
      { id: 'old', page_id: 'page-old', assignee_user_id: 'staff-a' },
    ];
    const staff = { role: 'staff', sub: 'staff-a' };
    const admin = { role: 'admin', sub: 'admin-1' };
    const manager = { role: 'approver', sub: 'mgr-1' };
    expect(filterCasesForPortalList(rows, staff, attached).map((row) => row.id)).toEqual(['mine']);
    expect(filterCasesForPortalList(rows, manager, attached).map((row) => row.id)).toEqual(['mine', 'other', 'open']);
    expect(filterCasesForPortalList(rows, admin, attached).map((row) => row.id)).toEqual(['mine', 'other', 'open']);
  });

  it('builds assignee WHERE for staff queries', () => {
    const where: string[] = ['c.client_id = $1::uuid'];
    const values: unknown[] = ['client-1'];
    appendAssigneeWhere(where, values, 'user-9', 'c');
    expect(where).toEqual(['c.client_id = $1::uuid', 'c.assignee_user_id = $2::uuid']);
    expect(values).toEqual(['client-1', 'user-9']);

    const bare: string[] = ['client_id = $1::uuid'];
    const bareValues: unknown[] = ['client-1'];
    appendAssigneeWhere(bare, bareValues, 'user-9', '');
    expect(bare).toEqual(['client_id = $1::uuid', 'assignee_user_id = $2::uuid']);
  });

  it('hops a missed receive after 15 minutes and a care case after one day', () => {
    const start = new Date('2026-11-11T02:00:00.000Z');
    expect(receiveDueAt(start).toISOString()).toBe('2026-11-11T02:15:00.000Z');
    expect(careDueAt(start).toISOString()).toBe('2026-11-12T02:00:00.000Z');
    expect(shouldHopReceive('waiting_receive', receiveDueAt(start), new Date('2026-11-11T02:15:00.000Z'))).toBe(true);
    expect(shouldHopReceive('received', receiveDueAt(start), new Date('2026-11-11T03:00:00.000Z'))).toBe(false);
    expect(shouldHopCare('caring', careDueAt(start), new Date('2026-11-12T02:00:00.000Z'))).toBe(true);
    expect(shouldHopCare('purchased', careDueAt(start), new Date('2026-11-13T02:00:00.000Z'))).toBe(false);
  });
});
