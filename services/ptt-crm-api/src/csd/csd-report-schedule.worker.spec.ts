import { periodForRecurrence, tickCsdReportSchedules } from './csd-report-schedule.worker';

describe('tickCsdReportSchedules', () => {
  it('creates draft and notifies, does not send', async () => {
    const createDraft = jest.fn().mockResolvedValue({ id: 'r9' });
    const notify = jest.fn();
    const claimDue = jest.fn().mockResolvedValue([
      { id: 's1', template_code: 'monthly_marketing', recurrence: 'monthly', owner_staff_id: 5 },
    ]);
    const out = await tickCsdReportSchedules({ claimDue, createDraft, notify });
    expect(out.created).toBe(1);
    expect(createDraft).toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });

  it('notifies owner with report id and does not bump again', async () => {
    const createDraft = jest.fn().mockResolvedValue({ id: 'r9' });
    const notify = jest.fn();
    const schedule = {
      id: 's1',
      template_code: 'monthly_marketing',
      recurrence: 'monthly',
      owner_staff_id: 5,
    };
    const claimDue = jest.fn().mockResolvedValue([schedule]);

    await tickCsdReportSchedules({ claimDue, createDraft, notify });

    expect(createDraft).toHaveBeenCalledWith(schedule);
    expect(notify).toHaveBeenCalledWith(5, 'r9');
  });

  it('continues after one createDraft failure and counts only successes', async () => {
    const first = {
      id: 's1',
      template_code: 'monthly_marketing',
      recurrence: 'monthly',
      owner_staff_id: 5,
    };
    const second = {
      id: 's2',
      template_code: 'monthly_marketing',
      recurrence: 'monthly',
      owner_staff_id: 6,
    };
    const createDraft = jest
      .fn()
      .mockRejectedValueOnce(new Error('draft_failed'))
      .mockResolvedValueOnce({ id: 'r2' });
    const notify = jest.fn();
    const claimDue = jest.fn().mockResolvedValue([first, second]);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const out = await tickCsdReportSchedules({ claimDue, createDraft, notify });
    errorSpy.mockRestore();

    expect(out.created).toBe(1);
    expect(createDraft).toHaveBeenCalledTimes(2);
    expect(createDraft).toHaveBeenNthCalledWith(2, second);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(6, 'r2');
  });

  it('returns created 0 when nothing is due', async () => {
    const createDraft = jest.fn();
    const notify = jest.fn();
    const claimDue = jest.fn().mockResolvedValue([]);

    const out = await tickCsdReportSchedules({ claimDue, createDraft, notify });

    expect(out.created).toBe(0);
    expect(createDraft).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
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
