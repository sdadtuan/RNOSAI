import { describe, expect, it } from 'vitest';
import { followupChip, leadCareChip, leadFollowup } from './lead-followup';

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

  it('keeps the missed-call label after the hold ends', () => {
    const chip = leadCareChip(
      {
        b2_complete: false,
        last_call_result: 'no_answer',
        hold_until: '2026-10-14T11:00:00.000Z',
        b2_assigned_at: '2026-10-12T02:00:00.000Z',
      },
      new Date('2026-10-15T02:00:00.000Z'),
    );
    expect(chip?.label).toBe('Không nghe máy');
    expect(chip?.sentence).toBe('Đã quá giờ giữ. Cần gọi lại.');
  });

  it('shows the missed-call label when no hold was stored', () => {
    const chip = leadCareChip({
      b2_complete: false,
      last_call_result: 'ring_no_answer',
    });
    expect(chip?.label).toBe('Không nghe máy');
    expect(chip?.sentence).toBe('Cần gọi lại.');
  });

  it('shows the contact deadline when under four hours remain', () => {
    const chip = leadCareChip(
      {
        b2_complete: false,
        last_call_result: '',
        b2_assigned_at: '2026-10-15T01:00:00.000Z',
      },
      new Date('2026-10-15T22:00:00.000Z'),
    );
    expect(chip?.label).toBe('Sắp hết hạn liên hệ');
    expect(chip?.sentence).toBe('Còn 3 giờ để Liên hệ OK');
  });

  it('hides every care label after Liên hệ OK', () => {
    expect(
      leadCareChip({
        b2_complete: true,
        last_call_result: 'no_answer',
        hold_until: '2026-10-20T11:00:00.000Z',
      }),
    ).toBeNull();
  });
});
