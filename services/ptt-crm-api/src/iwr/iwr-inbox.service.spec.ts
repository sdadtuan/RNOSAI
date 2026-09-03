import { IwrInboxService } from './iwr-inbox.service';
import type { IwrActor } from './iwr.types';

describe('IwrInboxService', () => {
  it('searches cc directory across all active staff', async () => {
    const org = {
      searchDirectory: jest.fn().mockResolvedValue([
        { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
        { id: 4, name: 'AM', email: 'a', department_id: 20, reports_to_id: 1, active: true },
      ]),
      getStaff: jest.fn().mockResolvedValue({
        id: 3,
        name: 'NV',
        email: 'n',
        department_id: 10,
        reports_to_id: 2,
        active: true,
      }),
      listActiveStaff: jest.fn().mockResolvedValue([
        { id: 1, name: 'CEO', email: 'c', department_id: 10, reports_to_id: null, active: true },
        { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
        { id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true },
        { id: 4, name: 'AM', email: 'a', department_id: 20, reports_to_id: 1, active: true },
      ]),
    };
    const repo = { listForPeriod: jest.fn() };
    const policy = { getActiveRules: jest.fn().mockResolvedValue(null) };
    const inbox = new IwrInboxService(repo as never, org as never, policy as never);
    const actor: IwrActor = {
      staffId: 3,
      staffLabel: 'NV',
      departmentId: 10,
      caps: [],
    };
    const out = await inbox.directory(actor, 'a', 'cc');
    expect(out.items.map((x) => x.id).sort((a, b) => a - b)).toEqual([2, 4]);
    await expect(inbox.directory(actor, '', 'to')).resolves.toEqual({ items: [] });
    await expect(inbox.directory(actor, '  ', 'cc')).resolves.toEqual({ items: [] });
  });

  it('team marks missing when no report in period', async () => {
    const org = {
      listActiveStaff: jest.fn().mockResolvedValue([
        { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
        { id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true },
      ]),
    };
    const repo = { listForPeriod: jest.fn().mockResolvedValue([]) };
    const policy = { getActiveRules: jest.fn().mockResolvedValue(null) };
    const inbox = new IwrInboxService(repo as never, org as never, policy as never);
    const out = await inbox.team(
      { staffId: 2, staffLabel: 'TL', departmentId: 10, caps: [{ section: 'iwr', action: 'review' }] },
      { period_start: '2026-09-03', period_end: '2026-09-03', template_code: 'daily_work' },
    );
    expect(out.nodes.find((n) => n.id === 3)?.derived).toBe('missing');
  });
});
