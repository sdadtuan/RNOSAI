import { describe, expect, it } from 'vitest';
import { resolveLifecycleNextAction, type LifecycleAdvanceInfo } from './lifecycle-delivery-next-action';

function base(overrides: Partial<LifecycleAdvanceInfo> = {}): LifecycleAdvanceInfo {
  return {
    current_stage: 'onboard',
    next_stage: 'deliver',
    can_advance_forward: false,
    block_reason: '',
    current_complete: true,
    current_done: 3,
    current_total: 3,
    ...overrides,
  };
}

describe('resolveLifecycleNextAction', () => {
  it('WS3-07 tasks incomplete → continue_tasks', () => {
    const action = resolveLifecycleNextAction(
      base({ current_complete: false, current_done: 1, current_total: 4 }),
    );
    expect(action.kind).toBe('continue_tasks');
    expect(action.primaryLabel).toBe('Làm tiếp (1/4)');
  });

  it('WS3-08 onboard gate fail → open_tmmt after onboard gate path', () => {
    const onboardFail = resolveLifecycleNextAction(
      base({
        onboard_gate: { ok: false, messages: ['Checklist chưa đủ'] },
      }),
    );
    expect(onboardFail.kind).toBe('onboard_checklist');
    expect(onboardFail.primaryLabel).toBe('Mở checklist Onboard');

    const tmmtFail = resolveLifecycleNextAction(
      base({
        can_advance_forward: false,
        block_reason: 'TMMT chưa đủ',
        onboard_gate: { ok: true, messages: [] },
      }),
    );
    expect(tmmtFail.kind).toBe('open_tmmt');
    expect(tmmtFail.primaryLabel).toBe('Mở TMMT chính thức');
  });

  it('WS3-09 launch QA requires confirm', () => {
    const action = resolveLifecycleNextAction(
      base({
        current_stage: 'deliver',
        next_stage: 'handover',
        launch_qa_gate: { ok: false, requires_confirm: true, messages: ['Launch QA chưa ready'] },
      }),
    );
    expect(action.kind).toBe('open_launch_qa');
    expect(action.primaryLabel).toBe('Mở Launch QA');
  });

  it('WS3-10 payment gate requires confirm', () => {
    const action = resolveLifecycleNextAction(
      base({
        current_stage: 'handover',
        next_stage: 'retain',
        payment_gate: { ok: false, requires_confirm: true, messages: ['Còn công nợ HĐ'] },
      }),
    );
    expect(action.kind).toBe('open_finance');
    expect(action.primaryLabel).toBe('Mở Tài chính');
  });

  it('WS3-11 can advance → advance_stage', () => {
    const action = resolveLifecycleNextAction(
      base({
        can_advance_forward: true,
        next_stage: 'deliver',
        block_reason: '',
      }),
    );
    expect(action.kind).toBe('advance_stage');
    expect(action.primaryLabel).toBe('Chuyển → Triển khai');
  });

  it('retain terminal → no primary', () => {
    const action = resolveLifecycleNextAction(
      base({
        current_stage: 'retain',
        next_stage: null,
        can_advance_forward: false,
        block_reason: 'Đã ở giai đoạn cuối.',
      }),
    );
    expect(action.kind).toBe('terminal');
    expect(action.primaryLabel).toBeNull();
  });
});
