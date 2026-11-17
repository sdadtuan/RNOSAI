import {
  adsChannelOf,
  appendAssigneeWhere,
  appendPageScopeWhere,
  careDueAt,
  careListFilterForUser,
  filterCasesForPortalList,
  filterVisiblePages,
  isPortalOwnerRole,
  nextAssignee,
  pageInScope,
  receiveDueAt,
  shouldHopCare,
  shouldHopReceive,
  scopePageIds,
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

  it('scopes staff and viewer lists to their assigned Pages; the approver sees every Page', () => {
    const staff = { role: 'staff', sub: 'staff-a' };
    const approver = { role: 'approver', sub: 'mgr-1' };
    expect(careListFilterForUser(staff, { all: false, pageIds: ['p1'] })).toEqual({ pageIds: ['p1'] });
    expect(careListFilterForUser({ role: 'viewer', sub: 'v1' }, { all: false, pageIds: [] })).toEqual({ pageIds: [] });
    expect(careListFilterForUser(approver, { all: true })).toEqual({});
    expect(isPortalOwnerRole('approver')).toBe(true);
    expect(isPortalOwnerRole('viewer')).toBe(false);
    expect(isPortalOwnerRole('staff')).toBe(false);
    expect(pageInScope({ all: true }, 'x')).toBe(true);
    expect(pageInScope({ all: false, pageIds: ['p1'] }, 'p1')).toBe(true);
    expect(pageInScope({ all: false, pageIds: ['p1'] }, 'p2')).toBe(false);
    expect(pageInScope({ all: false, pageIds: [] }, 'p1')).toBe(false);
    expect(scopePageIds({ all: true })).toBeUndefined();
    // Mutation rule is unchanged: staff act only on their own cases.
    expect(staffCanViewCareCase(staff, 'staff-a')).toBe(true);
    expect(staffCanViewCareCase(staff, 'other')).toBe(false);
    expect(staffCanViewCareCase(staff, null)).toBe(false);
    expect(staffCanViewCareCase(approver, null)).toBe(true);
  });

  it('keeps every case on the visible Pages (not only the assignee own cases)', () => {
    const attached = ['page-live'];
    const rows = [
      { id: 'mine', page_id: 'page-live', assignee_user_id: 'staff-a' },
      { id: 'other', page_id: 'page-live', assignee_user_id: 'staff-b' },
      { id: 'open', page_id: 'page-live', assignee_user_id: null },
      { id: 'old', page_id: 'page-old', assignee_user_id: 'staff-a' },
    ];
    const staff = { role: 'staff', sub: 'staff-a' };
    expect(filterCasesForPortalList(rows, staff, attached).map((row) => row.id)).toEqual(['mine', 'other', 'open']);
    expect(filterCasesForPortalList(rows, staff, []).map((row) => row.id)).toEqual([]);
  });

  it('builds a Page scope WHERE: undefined = all, [] = nothing', () => {
    const where: string[] = [];
    const values: unknown[] = ['client-1'];
    appendPageScopeWhere(where, values, undefined, 'c');
    expect(where).toEqual([]);
    appendPageScopeWhere(where, values, [], 'c');
    expect(where).toEqual(['FALSE']);
    const w2: string[] = [];
    const v2: unknown[] = ['client-1'];
    appendPageScopeWhere(w2, v2, ['p1', 'p2'], 'm');
    expect(w2).toEqual(['m.page_id = ANY($2::text[])']);
    expect(v2).toEqual(['client-1', ['p1', 'p2']]);
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
