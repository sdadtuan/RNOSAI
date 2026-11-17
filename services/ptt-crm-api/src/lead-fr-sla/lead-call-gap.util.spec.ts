import { ACTIVITY_DEDUPE_MINUTES, evaluateCallGap, evaluateDuplicateActivity, evaluateDuplicateLog, formatCallGapRetryAt } from './lead-call-gap.util';

describe('evaluateCallGap', () => {
  const gapH = 5 / 60; // 5 minutes

  it('allows the first call when there is no previous attempt', () => {
    const now = new Date('2026-11-16T07:00:00.000Z'); // 14:00 ICT Monday
    const out = evaluateCallGap({ lastCallAt: null, now, minGapWorkingHours: gapH });
    expect(out.blocked).toBe(false);
    expect(out.message).toBeNull();
  });

  it('blocks a phone log inside the 5-minute gap and names the wait time', () => {
    const last = new Date('2026-11-16T07:00:00.000Z'); // 14:00 ICT
    const now = new Date('2026-11-16T07:02:00.000Z'); // 14:02 ICT
    const out = evaluateCallGap({ lastCallAt: last, now, minGapWorkingHours: gapH });
    expect(out.blocked).toBe(true);
    expect(out.elapsedMinutes).toBe(2);
    expect(out.nextAllowedAt?.toISOString()).toBe('2026-11-16T07:05:00.000Z'); // 14:05 ICT
    expect(out.message).toBe(
      'Cuộc gọi quá sát lần trước (cách 2 phút) — chưa ghi. Gọi lại sau 14:05.',
    );
  });

  it('allows a log once 5 minutes have elapsed', () => {
    const last = new Date('2026-11-16T07:00:00.000Z');
    const now = new Date('2026-11-16T07:05:00.000Z');
    const out = evaluateCallGap({ lastCallAt: last, now, minGapWorkingHours: gapH });
    expect(out.blocked).toBe(false);
    expect(out.message).toBeNull();
  });

  it('uses plain wall-clock minutes even after working hours', () => {
    const last = new Date('2026-11-16T11:28:00.000Z'); // 18:28 ICT Monday
    const now = new Date('2026-11-16T11:29:00.000Z');
    const out = evaluateCallGap({ lastCallAt: last, now, minGapWorkingHours: gapH });
    expect(out.blocked).toBe(true);
    expect(out.nextAllowedAt?.toISOString()).toBe('2026-11-16T11:33:00.000Z'); // 18:33 ICT
    expect(out.message).toBe(
      'Cuộc gọi quá sát lần trước (cách 1 phút) — chưa ghi. Gọi lại sau 18:33.',
    );
  });

  it('formats a next-day retry with the date and no seconds', () => {
    const next = new Date('2026-11-17T02:30:00.000Z');
    const now = new Date('2026-11-16T10:31:00.000Z');
    expect(formatCallGapRetryAt(next, now)).toBe('09:30 17/11');
  });
});

describe('evaluateDuplicateLog', () => {
  it('blocks the same channel+result inside a 3-minute cooldown', () => {
    const previousAt = new Date('2026-11-16T07:00:00.000Z');
    const now = new Date('2026-11-16T07:01:00.000Z');
    const out = evaluateDuplicateLog({ previousAt, now, cooldownMinutes: 3 });
    expect(out.blocked).toBe(true);
    expect(out.message).toContain('Bản ghi trùng');
    expect(out.message).toContain(`cách dưới ${ACTIVITY_DEDUPE_MINUTES} phút`);
    expect(out.message).not.toContain('cách dưới 1 phút');
    expect(out.message).toContain('14:03');
  });

  it('names the 3-minute window and ceils leftover seconds on the retry clock', () => {
    const previousAt = new Date('2026-11-16T09:32:20.000Z'); // 16:32:20 ICT
    const now = new Date('2026-11-16T09:32:40.000Z');
    const out = evaluateDuplicateLog({ previousAt, now, cooldownMinutes: ACTIVITY_DEDUPE_MINUTES });
    // 16:32:20 + 3 min = 16:35:20 → display 16:36
    expect(out.blocked).toBe(true);
    expect(out.message).toBe(
      'Bản ghi trùng (cùng kênh và kết quả, cách dưới 3 phút) — chưa ghi. Thử lại sau 16:36.',
    );
    expect(formatCallGapRetryAt(out.nextAllowedAt as Date, now)).toBe('16:36');
  });

  it('allows a repeat after the cooldown', () => {
    const previousAt = new Date('2026-11-16T07:00:00.000Z');
    const now = new Date('2026-11-16T07:03:00.000Z');
    expect(evaluateDuplicateLog({ previousAt, now, cooldownMinutes: 3 }).blocked).toBe(false);
  });
});

describe('evaluateDuplicateActivity', () => {
  it('uses a trao đổi message', () => {
    const previousAt = new Date('2026-11-16T07:00:00.000Z');
    const now = new Date('2026-11-16T07:00:10.000Z');
    const out = evaluateDuplicateActivity({ previousAt, now, cooldownMinutes: 3 });
    expect(out.blocked).toBe(true);
    expect(out.message).toContain('Nội dung trao đổi trùng');
    expect(out.message).toContain('chưa lưu');
    expect(out.message).toContain(`cách dưới ${ACTIVITY_DEDUPE_MINUTES} phút`);
    expect(out.message).toContain('14:03');
  });
});
