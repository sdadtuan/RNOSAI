import { describe, expect, it } from 'vitest';
import {
  B2_NO_ANSWER_DEFAULT_NOTE,
  B2_TALKED_DEFAULT_NOTE,
  B2_WRONG_NUMBER_DEFAULT_NOTE,
  defaultNoteForB2Outcome,
  resolveB2CallOutcome,
} from './lead-b2-outcome';

describe('resolveB2CallOutcome', () => {
  it('talked with empty note uses default and completes B2', () => {
    const out = resolveB2CallOutcome({ outcome: 'talked', note: '  ' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.plan.kind).toBe('complete_b2');
    if (out.plan.kind !== 'complete_b2') return;
    expect(out.plan.report.care_status).toBe('da_lien_he_thanh_cong');
    expect(out.plan.report.content).toBe(B2_TALKED_DEFAULT_NOTE);
    expect(out.plan.completeNote).toBe(B2_TALKED_DEFAULT_NOTE);
    expect(out.plan.primary_label_vi).toBe('Xong B2');
  });

  it('talked keeps AM note for both report and complete', () => {
    const out = resolveB2CallOutcome({
      outcome: 'talked',
      note: 'Đã nói chuyện — cần SEO local',
    });
    expect(out.ok).toBe(true);
    if (!out.ok || out.plan.kind !== 'complete_b2') return;
    expect(out.plan.report.content).toBe('Đã nói chuyện — cần SEO local');
    expect(out.plan.completeNote).toBe('Đã nói chuyện — cần SEO local');
  });

  it('no_answer logs retry only — does not complete B2', () => {
    const out = resolveB2CallOutcome({ outcome: 'no_answer', note: '' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.plan.kind).toBe('retry');
    if (out.plan.kind !== 'retry') return;
    expect(out.plan.report.care_status).toBe('khong_nghe_may');
    expect(out.plan.report.content).toBe(B2_NO_ANSWER_DEFAULT_NOTE);
    expect(out.plan.suggestLost).toBe(false);
    expect(out.plan.primary_label_vi).toBe('Ghi nhận — gọi lại');
  });

  it('wrong_number logs so_sai and hints lost — does not complete B2', () => {
    const out = resolveB2CallOutcome({ outcome: 'wrong_number', note: '' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.plan.kind).toBe('wrong_number');
    if (out.plan.kind !== 'wrong_number') return;
    expect(out.plan.report.care_status).toBe('so_sai');
    expect(out.plan.report.content).toBe(B2_WRONG_NUMBER_DEFAULT_NOTE);
    expect(out.plan.suggestLost).toBe(true);
    expect(out.plan.primary_label_vi).toBe('Ghi nhận số sai');
  });

  it('rejects a custom note shorter than 3 characters', () => {
    const out = resolveB2CallOutcome({ outcome: 'talked', note: 'ok' });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error_vi).toMatch(/3/);
  });
});

describe('defaultNoteForB2Outcome', () => {
  it('returns the three canvas defaults', () => {
    expect(defaultNoteForB2Outcome('talked')).toBe(B2_TALKED_DEFAULT_NOTE);
    expect(defaultNoteForB2Outcome('no_answer')).toBe(B2_NO_ANSWER_DEFAULT_NOTE);
    expect(defaultNoteForB2Outcome('wrong_number')).toBe(B2_WRONG_NUMBER_DEFAULT_NOTE);
  });
});
