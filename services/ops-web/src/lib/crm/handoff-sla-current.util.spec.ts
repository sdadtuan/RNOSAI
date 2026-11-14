import { describe, expect, it } from 'vitest';
import { pickHandoffSlaClockForStep } from './handoff-sla-current.util';
import type { HandoffSlaClockView } from '@/components/crm/HandoffSlaCountdown';

function clock(key: string, state: HandoffSlaClockView['state'] = 'ok'): HandoffSlaClockView {
  return {
    key,
    label: key,
    role: key.startsWith('sales') ? 'Sales' : key.startsWith('solution_accept') || key.startsWith('quote') ? 'AM' : 'Marketing',
    due_at: '2026-11-14T08:00:00.000Z',
    state,
    countdown: state === 'breach' ? 'Trễ 5p' : 'Còn 5p',
    due_label: '15:00 14/11/2026',
  };
}

describe('pickHandoffSlaClockForStep', () => {
  it('picks the AM accept clock at Chờ Solutions and hides the stale Sales receive clock', () => {
    const picked = pickHandoffSlaClockForStep(
      { current: clock('sales_accept'), clocks: [clock('sales_accept'), clock('solution_accept', 'breach')] },
      'await_solutions',
    );
    expect(picked?.key).toBe('solution_accept');
    expect(picked?.state).toBe('breach');
  });

  it('does not fall back to an earlier-step clock when the current step has none', () => {
    expect(
      pickHandoffSlaClockForStep({ current: clock('sales_accept'), clocks: [clock('sales_accept')] }, 'await_solutions'),
    ).toBeNull();
  });

  it('picks receive / brief / doing / quote / negotiate / contract clocks by step', () => {
    expect(pickHandoffSlaClockForStep({ clocks: [clock('sales_accept')] }, 'receive_lead')?.key).toBe('sales_accept');
    expect(pickHandoffSlaClockForStep({ clocks: [clock('sales_brief')] }, 'sales_brief')?.key).toBe('sales_brief');
    expect(pickHandoffSlaClockForStep({ clocks: [clock('solution_work')] }, 'doing_solutions')?.key).toBe('solution_work');
    expect(
      pickHandoffSlaClockForStep(
        { clocks: [clock('customer_response'), clock('quote_accept', 'warning')] },
        'await_quote',
      )?.key,
    ).toBe('quote_accept');
    expect(pickHandoffSlaClockForStep({ clocks: [clock('negotiate')] }, 'negotiate')?.key).toBe('negotiate');
    expect(pickHandoffSlaClockForStep({ clocks: [clock('contract')] }, 'sign_contract')?.key).toBe('contract');
  });

  it('prefers breach over warning on the same step', () => {
    expect(
      pickHandoffSlaClockForStep(
        { clocks: [clock('quote_finish', 'warning'), clock('ceo_approve', 'breach')] },
        'await_quote',
      )?.key,
    ).toBe('ceo_approve');
  });
});
