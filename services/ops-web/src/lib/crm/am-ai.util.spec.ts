import { describe, expect, it } from 'vitest';
import {
  AM_AI_OFF_TOOLTIP,
  amAiAskButtonProps,
  amAiCreateDraftAction,
  amAiCreateTaskAction,
} from './am-ai.util';

describe('amAiAskButtonProps', () => {
  it('uses tooltip copy AI tắt and disables the button when the flag is off', () => {
    expect(AM_AI_OFF_TOOLTIP).toBe('AI tắt');
    expect(amAiAskButtonProps(false)).toEqual({ disabled: true, title: 'AI tắt' });
    expect(amAiAskButtonProps(true).disabled).toBe(false);
    expect(amAiAskButtonProps(true).title).not.toBe('AI tắt');
  });
});

describe('amAiCreateTaskAction', () => {
  it('opens the existing task form prefilled and does not POST a task', () => {
    const action = amAiCreateTaskAction({
      draft: 'Gọi khách tuần này về health watch',
      evidence: { health_score: 3.2, band: 'watch' },
    });
    expect(action.type).toBe('open_form');
    expect(action.form).toBe('task');
    expect(action.prefill.title).toMatch(/health watch/i);
    expect(action.prefill.ai_evidence_json).toEqual({ health_score: 3.2, band: 'watch' });
    expect(action).not.toMatchObject({ method: 'POST' });
    expect(JSON.stringify(action)).not.toMatch(/\/api\/crm\/am\/tasks/);
  });
});

describe('amAiCreateDraftAction', () => {
  it('opens opportunity or plan form prefilled — never POSTs from the drawer', () => {
    const opp = amAiCreateDraftAction('followup', {
      draft: 'Follow-up Q3',
      evidence: { open_tasks_count: 2 },
    });
    expect(opp).toMatchObject({ type: 'open_form', form: 'opportunity' });
    expect(JSON.stringify(opp)).not.toMatch(/\/api\/crm\/am\/(tasks|opportunities|plans)/);

    const plan = amAiCreateDraftAction('qbr', {
      draft: 'QBR tháng 9',
      evidence: { band: 'watch' },
    });
    expect(plan).toMatchObject({ type: 'open_form', form: 'plan' });
    expect(JSON.stringify(plan)).not.toMatch(/\/api\/crm\/am\/(tasks|opportunities|plans)/);
  });
});
