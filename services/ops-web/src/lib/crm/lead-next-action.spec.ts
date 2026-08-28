import { describe, expect, it } from 'vitest';
import { resolveLeadNextAction } from './lead-next-action';

const base = {
  lmpEnabled: true,
  dealRoomEnabled: true,
  phone: '09014238',
  email: 'in@khangthinhland.com',
  leadStatus: 'pending',
  b2Complete: false,
  presalesStage: null as string | null,
  prepStatus: null as string | null,
  prepStage: null as string | null,
  debriefPending: false,
  handoffStatus: null as string | null,
};

describe('resolveLeadNextAction', () => {
  it('lead #5 fixture → rule 5 Gọi đầu, no fake script', () => {
    const out = resolveLeadNextAction(base);
    expect(out.rule).toBe(5);
    expect(out.title_vi).toBe('Gọi đầu trong 15 phút');
    expect(out.primary.action).toBe('add_activity');
    expect(out.secondary.map((s) => s.action)).toEqual(['complete_b2']);
  });

  it('rule 5 + prep ready → copy_script', () => {
    const out = resolveLeadNextAction({ ...base, prepStatus: 'ready' });
    expect(out.rule).toBe(5);
    expect(out.primary.action).toBe('copy_script');
  });

  it('missing contact → rule 1', () => {
    const out = resolveLeadNextAction({ ...base, phone: '', email: '' });
    expect(out.rule).toBe(1);
    expect(out.primary.action).toBe('edit_contact');
  });

  it('awaiting_am_input beats first-call', () => {
    const out = resolveLeadNextAction({ ...base, prepStatus: 'awaiting_am_input' });
    expect(out.rule).toBe(2);
    expect(out.primary.action).toBe('save_company_run_prep');
  });

  it('awaiting_entity_choice → rule 3', () => {
    const out = resolveLeadNextAction({ ...base, prepStatus: 'awaiting_entity_choice' });
    expect(out.rule).toBe(3);
  });

  it('prep running beats rule 5', () => {
    const out = resolveLeadNextAction({ ...base, prepStatus: 'running' });
    expect(out.rule).toBe(4);
    expect(out.primary.action).toBe('wait_prep');
  });

  it('B2 done, stage lead → rule 6 Intake', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'lead',
      prepStatus: 'ready',
    });
    expect(out.rule).toBe(6);
    expect(out.primary.action).toBe('open_intake');
  });

  it('Intake Go (consult) → giao Solution', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      prepStatus: 'ready',
    });
    expect(out.rule).toBe(7);
    expect(out.primary.action).toBe('handoff_solution');
    expect(out.secondary.map((s) => s.action)).toEqual(['open_consult', 'copy_m2_brief']);
  });

  it('consult + pending handoff → wait', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      handoffStatus: 'pending',
    });
    expect(out.rule).toBe(7);
    expect(out.primary.action).toBe('wait_handoff');
    expect(out.secondary.map((s) => s.action)).toEqual(['open_consult']);
  });

  it('consult + with_solution → mở Tư vấn', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      handoffStatus: 'with_solution',
    });
    expect(out.rule).toBe(7);
    expect(out.primary.action).toBe('open_consult');
  });

  it('consult + released → chuyển Báo giá', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      handoffStatus: 'released',
    });
    expect(out.rule).toBe(7);
    expect(out.primary.action).toBe('advance_presales');
  });

  it('proposal + deal room → rule 8', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      prepStatus: 'ready',
      prepStage: 'm2_qualify_win',
    });
    expect(out.rule).toBe(8);
    expect(out.primary.action).toBe('open_deal_room');
  });

  it('prep_stage m3 also triggers rule 8', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      prepStage: 'm3_pre_close',
      prepStatus: 'ready',
    });
    expect(out.rule).toBe(8);
  });

  it('chot + debrief_pending → rule 9', () => {
    const out = resolveLeadNextAction({
      ...base,
      leadStatus: 'chot',
      b2Complete: true,
      debriefPending: true,
    });
    expect(out.rule).toBe(9);
    expect(out.primary.action).toBe('submit_debrief');
  });

  it('LMP off skips rules 2–4 and copy_script', () => {
    const out = resolveLeadNextAction({ ...base, lmpEnabled: false, prepStatus: 'running' });
    expect(out.rule).toBe(5);
    expect(out.primary.action).toBe('add_activity');
  });

  it('fallback rule 10 when B2 done and no later stage', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'done_unknown',
      lmpEnabled: false,
    });
    expect(out.rule).toBe(10);
  });
});
