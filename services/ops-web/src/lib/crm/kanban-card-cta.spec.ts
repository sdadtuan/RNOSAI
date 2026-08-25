import { describe, expect, it } from 'vitest';
import { kanbanCardCta, kanbanStageAccent, KANBAN_STAGE_SETS } from './kanban-card-cta';
import { WORK_SIGNALS } from './work-signals';

describe('kanbanCardCta', () => {
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
    expect(cta.label).toBe('Gọi');
  });

  it('sends consult leads to intake', () => {
    expect(kanbanCardCta({ id: 3, phone: '', status: 'dang_tu_van' }).href).toBe(
      '/crm/intake?lead_id=3',
    );
  });

  it('falls back to lead detail', () => {
    expect(kanbanCardCta({ id: 2, phone: '', status: 'lost' }).label).toBe('Mở lead');
  });

  it('asks to call early leads even when not urgent', () => {
    const cta = kanbanCardCta({
      id: 4,
      phone: '0912-000-111',
      status: 'da_lien_he',
      ai_band: 'warm',
      sla_state: 'ok',
    });
    expect(cta.kind).toBe('call');
    expect(cta.href).toBe('tel:0912000111');
  });

  it('sends quote-stage leads to the proposal record', () => {
    const cta = kanbanCardCta({ id: 5, phone: '0900', status: 'bao_gia' });
    expect(cta).toEqual({
      href: '/crm/leads/5',
      label: 'Đề xuất',
      kind: 'quote',
    });
  });

  it('marks quote-stage CTA as quote kind', () => {
    expect(kanbanCardCta({ id: 5, phone: '0900', status: 'bao_gia' })).toEqual({
      href: '/crm/leads/5',
      label: 'Đề xuất',
      kind: 'quote',
    });
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

  it('sends won leads to the contract hub', () => {
    expect(kanbanCardCta({ id: 8, phone: '', status: 'chot' })).toEqual({
      href: '/crm/hub',
      label: 'Hợp đồng',
      kind: 'hub',
    });
  });

  it('asks to call when SLA is warning on a new lead', () => {
    expect(
      kanbanCardCta({
        id: 6,
        phone: '+84901234567',
        status: 'moi',
        sla_state: 'warning',
      }).href,
    ).toBe('tel:+84901234567');
  });
});
