import { formatB2bCallActivity, formatLeadCallActivity } from './lead-call-activity.util';

describe('formatLeadCallActivity', () => {
  it('records a missed call against the lead status at that moment', () => {
    const out = formatLeadCallActivity({
      callResult: 'ring_no_answer',
      channel: 'phone',
      notes: 'Gọi lần 2',
      leadStatus: 'won',
    });
    expect(out.result).toBe('ring_no_answer');
    expect(out.content).toContain('không bắt máy');
    expect(out.content).toContain('Điện thoại');
    expect(out.content).toContain('Gọi lần 2');
    expect(out.content).toContain('Won (HĐ ký)');
  });

  it('records a callback on a lost lead', () => {
    const out = formatLeadCallActivity({
      callResult: 'callback_requested',
      channel: 'phone',
      leadStatus: 'lost',
      callbackAt: new Date('2026-10-15T02:00:00.000Z'),
    });
    expect(out.content).toContain('Hẹn gọi lại');
    expect(out.content).toContain('Thất bại');
    expect(out.content).toContain('2026-10-15T02:00:00.000Z');
  });
});

describe('formatB2bCallActivity', () => {
  it('skips ringing and keeps answered', () => {
    expect(formatB2bCallActivity({ state: 'ringing', leadStatus: 'moi' })).toBeNull();
    const out = formatB2bCallActivity({ state: 'no_answer', leadStatus: 'bao_gia' });
    expect(out?.content).toContain('Không nghe máy');
    expect(out?.content).toContain('Báo giá');
    expect(out?.result).toBe('b2b_no_answer');
  });
});
