import { IwrListsService } from './iwr-lists.service';
import type { IwrListRow } from './iwr.types';

describe('IwrListsService', () => {
  const actor = {
    staffId: 3,
    staffLabel: 'NV',
    departmentId: 10,
    caps: [{ section: 'iwr', action: 'lists' }],
  };

  it('resolveMembers returns department staff ids', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue({
        id: 'l1',
        code: 'mkt',
        name_vi: 'Marketing',
        owner_staff_id: 3,
        kind: 'department',
        rule_json: { department_id: 20 },
        active: true,
      } satisfies IwrListRow),
      resolveDepartmentMembers: jest.fn().mockResolvedValue([4, 5]),
      listMemberIds: jest.fn(),
    };
    const svc = new IwrListsService(repo as never);
    const ids = await svc.resolveMembers('l1');
    expect(ids).toEqual([4, 5]);
  });

  it('resolveMembers returns empty for inactive list', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue({
        id: 'l1',
        code: 'old',
        name_vi: 'Old',
        owner_staff_id: 3,
        kind: 'static',
        rule_json: {},
        active: false,
      } satisfies IwrListRow),
      listMemberIds: jest.fn().mockResolvedValue([9]),
    };
    const svc = new IwrListsService(repo as never);
    const ids = await svc.resolveMembers('l1');
    expect(ids).toEqual([]);
    expect(repo.listMemberIds).not.toHaveBeenCalled();
  });
});
