import {
  assertCanEnableReassign,
  assertPublishNote,
  previewImpactCopy,
  validateLeadSlaSettingsPayload,
} from './lead-sla-settings.validate';
import { defaultLeadSlaSettingsPayload } from './lead-sla-settings.defaults';
import { computeFr1DueAt } from './lead-sla-working-hours.util';

describe('lead-sla-settings.validate', () => {
  it('rejects fr1_hours out of range', () => {
    const p = defaultLeadSlaSettingsPayload();
    p.fr1_hours = 9;
    expect(validateLeadSlaSettingsPayload(p).some((e) => e.code === 'fr1_out_of_range')).toBe(true);
  });

  it('rejects empty fr1_channels and eligible stages', () => {
    const p = defaultLeadSlaSettingsPayload();
    p.fr1_channels = [];
    p.eligible_pipeline_stages = [];
    const codes = validateLeadSlaSettingsPayload(p).map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(['fr1_channels_required', 'eligible_stages_required']));
  });

  it('rejects hot days > normal 1b days', () => {
    const p = defaultLeadSlaSettingsPayload();
    p.case_1b.hot_max_working_days = 5;
    p.case_1b.max_working_days = 3;
    expect(validateLeadSlaSettingsPayload(p).some((e) => e.code === 'hot_stricter_required')).toBe(
      true,
    );
  });

  it('requires publish note ≥10 chars', () => {
    expect(() => assertPublishNote('short')).toThrow();
    expect(() => assertPublishNote('long enough publish note')).not.toThrow();
  });

  it('blocks enable reassign when dry_run incomplete', () => {
    const prev = defaultLeadSlaSettingsPayload();
    prev.feature_flags.lead_sla_reassign_enabled = false;
    prev.feature_flags.dry_run_started_at = new Date().toISOString();
    const next = defaultLeadSlaSettingsPayload();
    next.feature_flags.lead_sla_reassign_enabled = true;
    next.feature_flags.min_dry_run_days = 3;
    expect(() =>
      assertCanEnableReassign(prev, next, { overrideDryRun: false, isSuperAdmin: false }),
    ).toThrow();
    expect(() =>
      assertCanEnableReassign(prev, next, { overrideDryRun: true, isSuperAdmin: true }),
    ).not.toThrow();
  });

  it('preview impact mentions new-assign FR1 rule', () => {
    const prev = defaultLeadSlaSettingsPayload();
    const next = defaultLeadSlaSettingsPayload();
    next.fr1_hours = 1;
    const lines = previewImpactCopy(prev, next);
    expect(lines[0]).toMatch(/gán MỚI/);
  });
});

describe('lead-sla-working-hours', () => {
  it('computes fr1_due_at within same working day', () => {
    // Wed 2026-09-23 03:00 UTC = 10:00 Saigon
    const assigned = new Date('2026-09-23T03:00:00.000Z');
    const due = computeFr1DueAt(assigned, 1, {
      days: [1, 2, 3, 4, 5],
      start: '09:00',
      end: '18:00',
    });
    expect(due.getTime()).toBeGreaterThan(assigned.getTime());
    expect(due.getTime() - assigned.getTime()).toBe(3600_000);
  });
});
