import { describe, expect, it } from 'vitest';
import { followupChip, leadFollowup } from './lead-followup';

describe('leadFollowup', () => {
  it('labels a missed call', () => {
    expect(leadFollowup({ last_call_result: 'ring_no_answer' })).toEqual({
      kind: 'no_answer',
      label: 'Không nghe máy',
      when: '',
    });
    expect(leadFollowup({ last_call_result: 'no_answer' })?.label).toBe('Không nghe máy');
  });

  it('labels a busy line', () => {
    expect(leadFollowup({ last_call_result: 'unreachable' })?.label).toBe('Máy bận');
  });

  it('labels a callback with the appointment time', () => {
    const followup = leadFollowup({
      last_call_result: 'callback_requested',
      callback_at: '2026-10-16T02:00:00.000Z',
    });
    expect(followup?.kind).toBe('callback');
    expect(followupChip(followup!)).toContain('Hẹn gọi lại');
    expect(followupChip(followup!)).toContain('16/10');
    expect(followupChip(followup!)).toContain('09:00');
  });

  it('hides the label after the customer answers', () => {
    expect(leadFollowup({ last_call_result: 'connected_qualified' })).toBeNull();
    expect(leadFollowup({ last_call_result: 'answered' })).toBeNull();
  });
});
