import { tickIwrSchedules, reminderEventKey } from './iwr-schedule.worker';

describe('tickIwrSchedules', () => {
  it('second tick with same key does not notify twice', async () => {
    const jobs = new Set<string>();
    const notify = jest.fn();
    const deps = {
      claimDue: jest.fn().mockResolvedValue([
        { id: 's1', kind: 'reminder', cron_expr: '', timezone: 'Asia/Ho_Chi_Minh', channel: 'in_app', active: true, next_run_at: null },
      ]),
      tryJob: jest.fn(async (key: string) => {
        if (jobs.has(key)) return false;
        jobs.add(key);
        return true;
      }),
      isOnLeave: jest.fn().mockResolvedValue(false),
      listStaff: jest.fn().mockResolvedValue([{ id: 3, reports_to_id: 2 }]),
      getDailyTemplateId: jest.fn().mockResolvedValue('tpl-daily'),
      findDailyDraft: jest.fn().mockResolvedValue('r1'),
      createDailyDraft: jest.fn(),
      notify,
      waiveDraft: jest.fn(),
      listManagers: jest.fn().mockResolvedValue([]),
      leaderDigest: jest.fn(),
    };
    const now = new Date('2026-09-03T09:00:00+07:00');
    await tickIwrSchedules(deps as never, now);
    await tickIwrSchedules(deps as never, now);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('precreate skips weekend', async () => {
    const deps = {
      claimDue: jest.fn().mockResolvedValue([
        { id: 's1', kind: 'precreate', cron_expr: '', timezone: 'Asia/Ho_Chi_Minh', channel: 'in_app', active: true, next_run_at: null },
      ]),
      tryJob: jest.fn().mockResolvedValue(true),
      isOnLeave: jest.fn(),
      listStaff: jest.fn().mockResolvedValue([{ id: 3, reports_to_id: 2 }]),
      getDailyTemplateId: jest.fn(),
      findDailyDraft: jest.fn(),
      createDailyDraft: jest.fn(),
      notify: jest.fn(),
      waiveDraft: jest.fn(),
      listManagers: jest.fn(),
      leaderDigest: jest.fn(),
    };
    const sat = new Date('2026-09-05T06:00:00+07:00');
    const out = await tickIwrSchedules(deps as never, sat);
    expect(out.ran).toBe(0);
    expect(deps.createDailyDraft).not.toHaveBeenCalled();
  });

  it('reminderEventKey format', () => {
    expect(reminderEventKey(3, 'tpl', '2026-09-03', 'due')).toBe('iwr_remind:3:tpl:2026-09-03:due');
  });
});
