import { IwrSuggestService } from './iwr-suggest.service';
import type { IwrActor } from './iwr.types';

function actor(id = 3): IwrActor {
  return {
    staffId: id,
    staffLabel: 'NV',
    departmentId: 10,
    caps: [{ section: 'iwr', action: 'write' }],
  };
}

describe('IwrSuggestService', () => {
  it('returns closed_today tickets and does not write tickets', async () => {
    const tickets = {
      listForStaff: jest.fn().mockResolvedValue([
        {
          id: 't1',
          code: 'SD-1',
          title: 'Xong banner',
          status: 'closed',
          closed_at: '2026-09-03T10:00:00+07:00',
        },
      ]),
      insert: jest.fn(),
    };
    const repo = {
      getReport: jest.fn().mockResolvedValue({
        id: 'r1',
        author_staff_id: 3,
        period_start: '2026-09-03',
        period_end: '2026-09-03',
      }),
      isRecipient: jest.fn().mockResolvedValue(true),
    };
    const org = {
      listActiveStaff: jest.fn().mockResolvedValue([]),
      listLeadUpdates: jest.fn().mockResolvedValue([]),
    };
    const suggest = new IwrSuggestService(tickets as never, repo as never, org as never);
    const out = await suggest.suggestForReport(actor(3), 'r1');
    expect(out.items[0]).toMatchObject({ kind: 'csd_ticket', reason: 'closed_today', id: 't1' });
    expect(tickets.insert).not.toHaveBeenCalled();
  });
});
