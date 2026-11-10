import { describe, expect, it } from 'vitest';
import {
  kanbanCardActions,
  kanbanCardCta,
  kanbanStageAccent,
  KANBAN_STAGE_SETS,
} from './kanban-card-cta';
import { WORK_SIGNALS } from './work-signals';

describe('kanbanCardActions', () => {
  it('gives new leads Gọi ngay + Chăm sóc', () => {
    const actions = kanbanCardActions({
      id: 9,
      phone: '0901 234 567',
      status: 'moi',
      ai_band: 'hot',
      sla_state: 'ok',
    });
    expect(actions.map((a) => a.kind)).toEqual(['call', 'care']);
    expect(actions[0]).toMatchObject({ href: 'tel:0901234567', label: 'Gọi ngay' });
    expect(actions[1]).toMatchObject({ href: '/crm/leads/9', label: 'Chăm sóc' });
  });

  it('gives care-only when new lead has no phone', () => {
    const actions = kanbanCardActions({ id: 2, phone: '', status: 'moi' });
    expect(actions).toEqual([
      expect.objectContaining({ kind: 'care', label: 'Chăm sóc', href: '/crm/leads/2' }),
    ]);
  });

  it('quote stage: view + return AM + advance proposal', () => {
    const actions = kanbanCardActions({ id: 5, phone: '0900', status: 'bao_gia' });
    expect(actions.map((a) => a.kind)).toEqual(['view_quote', 'return_am', 'advance_proposal']);
    expect(actions[0].href).toBe('/crm/leads/5');
    expect(actions[1].nextStatus).toBe('dang_tu_van');
    expect(actions[2].nextStatus).toBe('proposal');
  });

  it('proposal stage: view + return + advance contract', () => {
    const actions = kanbanCardActions({ id: 7, phone: '', status: 'proposal' });
    expect(actions.map((a) => a.kind)).toEqual([
      'view_proposal',
      'return_am',
      'advance_contract',
    ]);
    expect(actions[2].nextStatus).toBeUndefined();
    expect(actions[2].blockedReason).toContain('GĐKD');
  });

  it('contract stage: view + return + mark signed', () => {
    const actions = kanbanCardActions({ id: 8, phone: '', status: 'won' });
    expect(actions.map((a) => a.kind)).toEqual(['view_contract', 'return_am', 'mark_signed']);
    expect(actions[2].nextStatus).toBe('chot');
  });

  it('signed contract stage: view only', () => {
    const actions = kanbanCardActions({ id: 8, phone: '', status: 'chot' });
    expect(actions.map((a) => a.kind)).toEqual(['view_contract']);
    expect(actions[0].href).toBe('/crm/leads/8?tab=contract#lead-contract');
  });

  it('does not offer Xem báo giá when the quote row is absent', () => {
    const actions = kanbanCardActions({ id: 5, phone: '0900', status: 'bao_gia', has_quote: false });
    expect(actions[0]).toMatchObject({ kind: 'lead', label: 'Chưa có báo giá' });
  });

  it('labels a saved sheet, a sheet sent to Sale, and an approved quote', () => {
    const saved = kanbanCardActions({
      id: 5,
      phone: '0900',
      status: 'bao_gia',
      has_quote: false,
      quote_case_open: true,
      quote_sheet_saved: true,
    });
    expect(saved[0]).toMatchObject({ kind: 'view_quote', label: 'Đã có báo giá' });
    expect(saved[2]).toMatchObject({
      label: 'Sale chưa nhận báo giá',
      blockedReason: 'Sale chưa nhận báo giá.',
    });
    expect(saved[2].nextStatus).toBeUndefined();

    const sent = kanbanCardActions({
      id: 5,
      phone: '0900',
      status: 'bao_gia',
      has_quote: false,
      quote_case_open: true,
      quote_sheet_saved: true,
      quote_sent_to_sale: true,
    });
    expect(sent[0]).toMatchObject({ label: 'Đã gửi Sale', href: '/crm/leads/5' });
    expect(sent[2]).toMatchObject({ label: '→ Proposal', nextStatus: 'proposal' });

    const approved = kanbanCardActions({
      id: 5,
      phone: '0900',
      status: 'bao_gia',
      has_quote: false,
      quote_approved: true,
      quote_sent_to_sale: true,
      quote_case_open: true,
    });
    expect(approved[0].label).toBe('Chờ GĐKD duyệt HĐ');
    expect(approved[2].nextStatus).toBe('proposal');
  });

  it('blocks Tạo HĐ and Proposal when Solution or the quote is missing', () => {
    const handedOff = kanbanCardActions({
      id: 920685,
      phone: '0900000685',
      status: 'dam_phan',
      solution_handoff: 'with_solution',
      has_quote: false,
      quote_sheet_saved: false,
      quote_sent_to_sale: false,
      quote_approved: false,
    });
    expect(handedOff.map((action) => action.label)).toContain('Chưa có báo giá');
    expect(handedOff.find((action) => action.kind === 'advance_contract')).toMatchObject({
      blockedReason: 'Chưa có Solution đã nộp.',
    });
    expect(handedOff.find((action) => action.kind === 'advance_contract')?.nextStatus).toBeUndefined();

    const quoted = kanbanCardActions({
      id: 5,
      phone: '0900',
      status: 'proposal',
      solution_handoff: 'released',
      quote_sheet_saved: true,
      quote_sent_to_sale: true,
      quote_approved: false,
    });
    expect(quoted.find((action) => action.kind === 'advance_contract')).toMatchObject({
      label: 'Sale chưa duyệt báo giá',
      blockedReason: 'Sale chưa duyệt báo giá.',
    });

    const approved = kanbanCardActions({
      id: 5,
      phone: '0900',
      status: 'proposal',
      solution_handoff: 'released',
      quote_sent_to_sale: true,
      quote_approved: true,
    });
    expect(approved.find((action) => action.kind === 'advance_contract')?.nextStatus).toBeUndefined();
    expect(approved.find((action) => action.kind === 'advance_contract')?.blockedReason).toContain('GĐKD');
  });

  it('does not offer Xem HĐ when the contract row is absent', () => {
    const actions = kanbanCardActions({ id: 8, phone: '', status: 'won', has_contract: false });
    expect(actions[0]).toMatchObject({ kind: 'lead', label: 'Chưa có HĐ', href: '/crm/leads/8' });
    expect(actions.map((a) => a.label)).not.toContain('Xem HĐ');
    expect(actions.find((action) => action.kind === 'mark_signed')).toMatchObject({
      blockedReason: 'Chưa có hợp đồng để xác nhận đã ký.',
    });
    expect(actions.find((action) => action.kind === 'mark_signed')?.nextStatus).toBeUndefined();
  });
});

describe('kanbanCardCta (legacy)', () => {
  it('asks to call hot new leads', () => {
    const cta = kanbanCardCta({
      id: 9,
      phone: '0901 234 567',
      status: 'moi',
      ai_band: 'hot',
      sla_state: 'ok',
    });
    expect(cta.kind).toBe('call');
    expect(cta.href).toBe('tel:0901234567');
    expect(cta.label).toBe('Gọi ngay');
  });

  it('treats funnel first_contact like moi for early CTA', () => {
    const cta = kanbanCardCta({
      id: 11,
      phone: '0901111222',
      status: 'first_contact',
      ai_band: 'hot',
      sla_state: 'ok',
    });
    expect(cta.kind).toBe('call');
    expect(cta.href).toBe('tel:0901111222');
  });

  it('sends consult leads to care as primary', () => {
    expect(kanbanCardCta({ id: 3, phone: '', status: 'dang_tu_van' }).href).toBe('/crm/leads/3');
  });

  it('falls back to lead detail', () => {
    expect(kanbanCardCta({ id: 2, phone: '', status: 'lost' }).label).toBe('Mở lead');
  });

  it('maps stage accents to work signals', () => {
    expect(kanbanStageAccent('moi')).toBe(WORK_SIGNALS.ptt);
    expect(kanbanStageAccent('dang_tu_van')).toBe(WORK_SIGNALS.sky);
    expect(kanbanStageAccent('bao_gia')).toBe(WORK_SIGNALS.gold);
    expect(kanbanStageAccent('won')).toBe(WORK_SIGNALS.won);
    expect(kanbanStageAccent('lost')).toBe(WORK_SIGNALS.cold);
  });

  it('exposes shared stage sets', () => {
    expect(KANBAN_STAGE_SETS.consult.has('hen_gap')).toBe(true);
    expect(KANBAN_STAGE_SETS.quote.has('proposal')).toBe(true);
  });
});
