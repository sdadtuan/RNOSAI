import { describe, expect, it } from 'vitest';
import {
  chipsFromValidationIssues,
  requireServiceSlugBeforeCreate,
  resolveIntakeNextStepBanner,
} from './intake-next-step-banner';

describe('requireServiceSlugBeforeCreate', () => {
  it('blocks _common', () => {
    expect(requireServiceSlugBeforeCreate('_common')).toMatch(/Chọn dịch vụ/);
    expect(requireServiceSlugBeforeCreate('')).toMatch(/Chọn dịch vụ/);
  });

  it('allows catalog slug', () => {
    expect(requireServiceSlugBeforeCreate('dich-vu-seo-tong-the')).toBeNull();
  });
});

describe('chipsFromValidationIssues', () => {
  it('dedupes service and uses short labels', () => {
    const chips = chipsFromValidationIssues(
      [
        {
          level: 'error',
          code: 'service_unselected',
          message: 'Chọn dịch vụ trước khi hoàn thành phiên (không để «Chưa chọn dịch vụ»).',
        },
        {
          level: 'error',
          code: 'decision',
          message: 'Cần chọn Quyết định "Decision" trước khi hoàn thành.',
        },
        {
          level: 'error',
          code: 'need_empty',
          message: 'Nhu cầu / điểm đau "Need / Pain" đang trống.',
        },
      ],
      '_common',
    );
    expect(chips.map((c) => c.label_vi)).toEqual(['Dịch vụ', 'Quyết định', 'Need / Pain']);
    expect(chips.filter((c) => c.code === 'service_unselected')).toHaveLength(1);
  });
});

describe('resolveIntakeNextStepBanner', () => {
  it('asks to pick service when no session and _common', () => {
    const banner = resolveIntakeNextStepBanner({
      hasActiveSession: false,
      sessionStatus: null,
      serviceSlug: '_common',
      decision: null,
      consultGate: null,
      handoffStatus: null,
    });
    expect(banner?.action).toBe('pick_service');
    expect(banner?.chips[0]?.label_vi).toBe('Dịch vụ');
    expect(banner?.body_vi).not.toMatch(/·/);
  });

  it('draft blockers use chips not long body list', () => {
    const banner = resolveIntakeNextStepBanner({
      hasActiveSession: true,
      sessionStatus: 'draft',
      serviceSlug: '_common',
      decision: '',
      consultGate: null,
      handoffStatus: null,
      validationIssues: [
        {
          level: 'error',
          code: 'decision',
          message: 'Cần chọn Quyết định "Decision" trước khi hoàn thành.',
        },
        {
          level: 'error',
          code: 'service_unselected',
          message: 'Chọn dịch vụ trước khi hoàn thành phiên (không để «Chưa chọn dịch vụ»).',
        },
      ],
    });
    expect(banner?.title_vi).toMatch(/Còn thiếu/);
    expect(banner?.body_vi).toMatch(/đi tới/);
    expect(banner?.chips.map((c) => c.label_vi)).toEqual(['Dịch vụ', 'Quyết định']);
    expect(banner?.blockers).toEqual([]);
  });

  it('reopen when completed but service still common', () => {
    const banner = resolveIntakeNextStepBanner({
      hasActiveSession: true,
      sessionStatus: 'completed',
      serviceSlug: '_common',
      decision: 'go',
      consultGate: { ok: true, level: 'ok', messages: [], requires_confirm: false, requires_override: false },
      handoffStatus: '',
    });
    expect(banner?.action).toBe('reopen_form');
    expect(banner?.cta_label_vi).toMatch(/Reopen/);
  });

  it('handoff when completed, service set, gate ok', () => {
    const banner = resolveIntakeNextStepBanner({
      hasActiveSession: true,
      sessionStatus: 'completed',
      serviceSlug: 'dich-vu-seo-tong-the',
      decision: 'go',
      consultGate: { ok: true, level: 'ok', messages: [], requires_confirm: false, requires_override: false },
      handoffStatus: '',
    });
    expect(banner?.action).toBe('handoff_solution');
    expect(banner?.cta_label_vi).toMatch(/Giao Solution/);
  });

  it('queue link when handoff pending', () => {
    const banner = resolveIntakeNextStepBanner({
      hasActiveSession: true,
      sessionStatus: 'completed',
      serviceSlug: 'dich-vu-seo-tong-the',
      decision: 'go',
      consultGate: { ok: true, level: 'ok', messages: [], requires_confirm: false, requires_override: false },
      handoffStatus: 'pending',
    });
    expect(banner?.action).toBe('open_solution_queue');
  });

  it('reopen when gate blocked after complete', () => {
    const banner = resolveIntakeNextStepBanner({
      hasActiveSession: true,
      sessionStatus: 'completed',
      serviceSlug: 'dich-vu-seo-tong-the',
      decision: 'go',
      consultGate: {
        ok: false,
        level: 'block',
        messages: ['Thiếu Pain confirmed'],
        requires_confirm: false,
        requires_override: false,
      },
      handoffStatus: '',
    });
    expect(banner?.action).toBe('reopen_form');
    expect(banner?.body_vi).toMatch(/Pain/);
  });
});
