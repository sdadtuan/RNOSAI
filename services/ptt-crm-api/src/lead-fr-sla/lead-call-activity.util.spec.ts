import { formatB2bCallActivity, formatLeadCallActivity } from './lead-call-activity.util';

describe('formatLeadCallActivity', () => {
  it('records a missed call in plain Vietnamese', () => {
    const out = formatLeadCallActivity({
      callResult: 'ring_no_answer',
      channel: 'phone',
      notes: 'Gọi lần 2',
      leadStatus: 'won',
    });
    expect(out.result).toBe('ring_no_answer');
    expect(out.content).toContain('Không nghe máy');
    expect(out.content).toContain('Gọi lần 2');
    expect(out.content).not.toMatch(/Kênh|Trạng thái|Won/i);
  });

  it('records a callback with a local time', () => {
    const out = formatLeadCallActivity({
      callResult: 'callback_requested',
      channel: 'phone',
      leadStatus: 'lost',
      callbackAt: new Date('2026-10-15T02:00:00.000Z'),
    });
    expect(out.content).toContain('Hẹn gọi lại');
    expect(out.content).toContain('15/10/2026');
    expect(out.content).not.toContain('Thất bại');
  });
});

describe('formatB2bCallActivity', () => {
  it('skips ringing and keeps a missed call', () => {
    expect(formatB2bCallActivity({ state: 'ringing', leadStatus: 'moi' })).toBeNull();
    const out = formatB2bCallActivity({ state: 'no_answer', leadStatus: 'bao_gia' });
    expect(out?.content).toBe('Khách không nghe máy');
    expect(out?.result).toBe('b2b_no_answer');
  });
});
