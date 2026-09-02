import { periodForRecurrence, tickCsdReportSchedules } from './csd-report-schedule.worker';

describe('tickCsdReportSchedules', () => {
  it('creates draft and notifies, does not send', async () => {
    const createDraft = jest.fn().mockResolvedValue({ id: 'r9' });
    const notify = jest.fn();
    const bumpNextRun = jest.fn();
    const claimDue = jest.fn().mockResolvedValue([
      { id: 's1', template_code: 'monthly_marketing', recurrence: 'monthly', owner_staff_id: 5 },
    ]);
    const out = await tickCsdReportSchedules({ claimDue, createDraft, notify, bumpNextRun });
    expect(out.created).toBe(1);
    expect(createDraft).toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });

  it('notifies owner with report id and bumps next run', async () => {
    const createDraft = jest.fn().mockResolvedValue({ id: 'r9' });
    const notify = jest.fn();
    const bumpNextRun = jest.fn();
    const schedule = {
      id: 's1',
      template_code: 'monthly_marketing',
      recurrence: 'monthly',
      owner_staff_id: 5,
    };
    const claimDue = jest.fn().mockResolvedValue([schedule]);

    await tickCsdReportSchedules({ claimDue, createDraft, notify, bumpNextRun });

    expect(createDraft).toHaveBeenCalledWith(schedule);
    expect(notify).toHaveBeenCalledWith(5, 'r9');
    expect(bumpNextRun).toHaveBeenCalledWith('s1', 'monthly');
  });

  it('returns created 0 when nothing is due', async () => {
    const createDraft = jest.fn();
    const notify = jest.fn();
    const bumpNextRun = jest.fn();
    const claimDue = jest.fn().mockResolvedValue([]);

    const out = await tickCsdReportSchedules({ claimDue, createDraft, notify, bumpNextRun });

    expect(out.created).toBe(0);
    expect(createDraft).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(bumpNextRun).not.toHaveBeenCalled();
  });
});

describe('periodForRecurrence', () => {
  it('uses previous Mon–Sun for weekly', () => {
    expect(periodForRecurrence('weekly', new Date('2026-09-02T12:00:00.000Z'))).toEqual({
      period_start: '2026-08-24',
      period_end: '2026-08-30',
    });
  });

  it('uses previous calendar month for monthly', () => {
    expect(periodForRecurrence('monthly', new Date('2026-09-02T12:00:00.000Z'))).toEqual({
      period_start: '2026-08-01',
      period_end: '2026-08-31',
    });
  });

  it('uses previous quarter for quarterly', () => {
    expect(periodForRecurrence('quarterly', new Date('2026-09-02T12:00:00.000Z'))).toEqual({
      period_start: '2026-04-01',
      period_end: '2026-06-30',
    });
  });
});
