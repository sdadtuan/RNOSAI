import { describe, expect, it } from 'vitest';
import {
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
    expect(banner?.action).toBe('reopen_fix');
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
    expect(banner?.action).toBe('reopen_fix');
    expect(banner?.blockers[0]).toMatch(/Pain/);
  });
});
