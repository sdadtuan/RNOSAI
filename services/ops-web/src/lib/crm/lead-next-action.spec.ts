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
  hasContract: false,
  contractStatus: null as string | null,
  pendingApproval: false,
  submitReady: false,
  createReady: false,
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

  it('S1-N1 proposal + deal room + no HĐ → Deal Room primary, Tạo HĐ secondary', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      prepStatus: 'ready',
      prepStage: 'm2_qualify_win',
    });
    expect(out.rule).toBe(8);
    expect(out.title_vi).toBe('Chuẩn bị buổi chốt');
    expect(out.primary.action).toBe('open_deal_room');
    expect(out.secondary.map((s) => s.action)).toEqual(['create_contract']);
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

  it('m3 at consult does not add Tạo HĐ', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'consult',
      prepStage: 'm3_pre_close',
      prepStatus: 'ready',
    });
    expect(out.primary.action).toBe('open_deal_room');
    expect(out.secondary.map((s) => s.action)).toEqual(['apply_offer_ladder']);
  });

  it('S1-N2 proposal + Deal Room off + createReady → Tạo HĐ primary', () => {
    const out = resolveLeadNextAction({
      ...base,
      dealRoomEnabled: false,
      b2Complete: true,
      presalesStage: 'proposal',
      createReady: true,
    });
    expect(out.rule).toBe(8);
    expect(out.title_vi).toBe('Tạo HĐ draft');
    expect(out.primary.action).toBe('create_contract');
    expect(out.secondary).toEqual([]);
  });

  it('S1-N2 without createReady does not invent HĐ primary', () => {
    const out = resolveLeadNextAction({
      ...base,
      dealRoomEnabled: false,
      b2Complete: true,
      presalesStage: 'proposal',
      createReady: false,
    });
    expect(out.primary.action).not.toBe('create_contract');
  });

  it('S1-N3 draft + submitReady → Gửi GDKD', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractStatus: 'draft',
      submitReady: true,
    });
    expect(out.rule).toBe(8);
    expect(out.title_vi).toBe('Gửi GDKD duyệt');
    expect(out.primary).toEqual({ label_vi: 'Gửi GDKD duyệt', action: 'submit_contract' });
    expect(out.secondary.map((s) => s.action)).toEqual(['open_contract_hub']);
  });

  it('S1-N4 pending approval beats Deal Room and submit', () => {
    const out = resolveLeadNextAction({
      ...base,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractStatus: 'draft',
      pendingApproval: true,
      submitReady: true,
    });
    expect(out.title_vi).toBe('Chờ GDKD duyệt');
    expect(out.primary.action).toBe('wait_contract_approval');
    expect(out.secondary.map((s) => s.action)).toEqual(['open_contract_hub']);
  });

  it('S1-N5 rule 5 title/action unchanged', () => {
    const out = resolveLeadNextAction(base);
    expect(out.rule).toBe(5);
    expect(out.title_vi).toBe('Gọi đầu trong 15 phút');
    expect(out.primary.action).toBe('add_activity');
  });

  it('won + debrief_pending → rule 9', () => {
    const out = resolveLeadNextAction({
      ...base,
      leadStatus: 'won',
      b2Complete: true,
      presalesStage: 'proposal',
      debriefPending: true,
    });
    expect(out.rule).toBe(9);
    expect(out.primary.action).toBe('submit_debrief');
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
