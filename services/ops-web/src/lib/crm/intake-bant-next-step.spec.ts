import { describe, expect, it } from 'vitest';
import { BANT_CHECKLIST } from './intake-bant-checklist';
import { BANT_FIELD_LABELS } from './intake-labels';
import { nextBantStep } from './intake-bant-next-step';

const emptyItems: [] = [];

describe('nextBantStep', () => {
  it('incomplete when fewer than 6 scored', () => {
    const out = nextBantStep({
      checklist: { budget: 4 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('incomplete');
    expect(out.title_vi).toBe('Còn mục chưa chấm');
    expect(out.body_vi).toContain(BANT_FIELD_LABELS.authority.label);
    expect(out.cta).toBeNull();
  });

  it('incomplete cta is discovery when an unscored key has mapped questions and no evidence', () => {
    const out = nextBantStep({
      checklist: { budget: 4 },
      questionItems: [{ key: 'phone_auth', text: 'Ai', bant_key: 'authority' as const }],
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('incomplete');
    expect(out.cta).toBe('discovery');
  });

  it('no_go under 18 when all scored', () => {
    const out = nextBantStep({
      checklist: { budget: 2, authority: 2, need: 2, timeline: 2, fit: 2, history: 2 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('no_go');
    expect(out.title_vi).toBe('Gợi ý: Từ chối / dừng Tư vấn');
    expect(out.cta).toBe('qualify');
    expect(out.body_vi).toMatch(/12\/30/);
    expect(out.body_vi).toMatch(/Nurture/);
  });

  it('nurture at 20 with gap 4', () => {
    const out = nextBantStep({
      checklist: { budget: 2, authority: 4, need: 4, timeline: 4, fit: 3, history: 3 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('nurture');
    expect(out.title_vi).toBe('Gợi ý: Nuôi dưỡng');
    expect(out.body_vi).toMatch(/Còn 4 điểm để Tư vấn/);
    expect(out.body_vi).toContain(BANT_CHECKLIST.budget.hint);
    expect(out.cta).toBe('discovery');
  });

  it('nurture lowest key ties break by BANT_KEYS order', () => {
    const out = nextBantStep({
      checklist: { budget: 4, authority: 3, need: 3, timeline: 4, fit: 4, history: 4 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('nurture');
    expect(out.body_vi).toContain(BANT_CHECKLIST.authority.hint);
    expect(out.body_vi).not.toContain(BANT_CHECKLIST.need.hint);
  });

  it('consult at 24 mentions not a signed contract', () => {
    const out = nextBantStep({
      checklist: { budget: 4, authority: 4, need: 4, timeline: 4, fit: 4, history: 4 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('consult');
    expect(out.title_vi).toMatch(/Đủ Tư vấn/);
    expect(out.body_vi).toMatch(/chưa phải đủ báo giá/);
    expect(out.body_vi).toMatch(/Chuyển → Tư vấn/);
    expect(out.cta).toBe('qualify');
  });
});
