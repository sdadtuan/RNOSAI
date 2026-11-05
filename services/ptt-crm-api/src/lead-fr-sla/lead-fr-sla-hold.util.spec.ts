import { computeFr1DueAt } from '../lead-sla-settings/lead-sla-working-hours.util';
import { defaultLeadSlaSettingsPayload } from '../lead-sla-settings/lead-sla-settings.defaults';
import {
  applyCallLogToSnapshot,
  initialSnapshotOnAssign,
} from './lead-fr-sla-hold.util';
import type { LeadFrSlaCaseConfig, LeadFrSlaSnapshot } from './lead-fr-sla.types';

function cfg(): LeadFrSlaCaseConfig {
  const d = defaultLeadSlaSettingsPayload();
  return {
    case_1a: d.case_1a,
    case_1b: d.case_1b,
    case_1c: d.case_1c,
    fr1_channels: ['phone'],
    eligible_pipeline_stages: d.eligible_pipeline_stages,
    working_hours: d.working_hours,
    holidays: [],
  };
}

function baseAssign(assignedAt: Date): LeadFrSlaSnapshot {
  const fr1 = computeFr1DueAt(assignedAt, 2, cfg().working_hours, []);
  return initialSnapshotOnAssign({
    assignedAt,
    fr1DueAt: fr1,
    isHot: false,
    pipelineStage: 'new',
  });
}

describe('P10.a lead-fr-sla hold recompute', () => {
  it('FR1 outside hours rolls to next working window', () => {
    // Friday 2026-09-25 12:00 UTC = 19:00 Saigon (after 18:00) → next Mon 09:00 + 2h
    const fridayEve = new Date('2026-09-25T12:00:00.000Z');
    const due = computeFr1DueAt(fridayEve, 2, cfg().working_hours, []);
    const parts = new Date(due.getTime() + 7 * 3600_000); // Saigon wall
    // Due should be Monday 11:00 Saigon = Mon 04:00 UTC
    expect(due.toISOString()).toBe('2026-09-28T04:00:00.000Z');
    expect(parts.getUTCDay()).toBe(1); // Monday in Saigon offset view
  });

  it('hold_until is null until first phone log', () => {
    const assigned = new Date('2026-09-23T03:00:00.000Z'); // Wed 10:00 Saigon
    const snap = baseAssign(assigned);
    expect(snap.hold_until).toBeNull();
    expect(snap.fr1_due_at).not.toBeNull();
    expect(snap.contact_status).toBe('new');
  });

  it('Zalo does not count as FR1 and does not set hold_until', () => {
    const assigned = new Date('2026-09-23T03:00:00.000Z');
    const before = baseAssign(assigned);
    const out = applyCallLogToSnapshot(
      before,
      {
        call_result: 'ring_no_answer',
        channel: 'zalo',
        started_at: new Date('2026-09-23T03:30:00.000Z'),
      },
      cfg(),
    );
    expect(out.counts_toward_fr1).toBe(false);
    expect(out.snapshot.hold_until).toBeNull();
    expect(out.snapshot.first_call_at).toBeNull();
    expect(out.snapshot.fr1_breached).toBe(false);
  });

  it('RNA sets 3WD hold from assigned_at (case 1b)', () => {
    const assigned = new Date('2026-09-23T03:00:00.000Z');
    const before = baseAssign(assigned);
    const out = applyCallLogToSnapshot(
      before,
      {
        call_result: 'ring_no_answer',
        channel: 'phone',
        started_at: new Date('2026-09-23T03:30:00.000Z'),
      },
      cfg(),
    );
    expect(out.snapshot.hold_until).not.toBeNull();
    expect(out.snapshot.hold_reason).toBe('fr_chain_1b');
    expect(out.snapshot.contact_status).toBe('attempting');
    expect(out.snapshot.attempts_since_assign).toBe(1);
    // 3 working days × 9h = 27 working hours from assigned
    const expected = computeFr1DueAt(assigned, 3 * 9, cfg().working_hours, []);
    expect(out.snapshot.hold_until!.toISOString()).toBe(expected.toISOString());
  });

  it('wrong_number path sets hold + invalid when confirmed', () => {
    const assigned = new Date('2026-09-23T03:00:00.000Z');
    const before = baseAssign(assigned);
    const started = new Date('2026-09-23T04:00:00.000Z');
    const out = applyCallLogToSnapshot(
      before,
      {
        call_result: 'wrong_number',
        channel: 'phone',
        started_at: started,
        wrong_number_confirmed: true,
      },
      cfg(),
    );
    expect(out.snapshot.contact_status).toBe('invalid_contact');
    expect(out.snapshot.hold_reason).toBe('wrong_number');
    expect(out.snapshot.hold_until).not.toBeNull();
    const expected = computeFr1DueAt(started, 4, cfg().working_hours, []);
    expect(out.snapshot.hold_until!.toISOString()).toBe(expected.toISOString());
  });

  it('1a meet_pending sets hold from connected_at + meeting_book days', () => {
    const assigned = new Date('2026-09-23T03:00:00.000Z');
    const before = baseAssign(assigned);
    const started = new Date('2026-09-23T03:20:00.000Z');
    const out = applyCallLogToSnapshot(
      before,
      {
        call_result: 'connected_meet_pending',
        channel: 'phone',
        started_at: started,
      },
      cfg(),
    );
    expect(out.snapshot.contact_status).toBe('meet_pending');
    expect(out.snapshot.hold_reason).toBe('meet_pending');
    expect(out.snapshot.hold_until).not.toBeNull();
    const expected = computeFr1DueAt(started, 3 * 9, cfg().working_hours, []);
    expect(out.snapshot.hold_until!.toISOString()).toBe(expected.toISOString());
  });

  it('freezes hold recompute when pipeline past eligible stages', () => {
    const assigned = new Date('2026-09-23T03:00:00.000Z');
    const before = {
      ...baseAssign(assigned),
      pipeline_stage: 'solution',
      hold_until: null,
    };
    const out = applyCallLogToSnapshot(
      before,
      {
        call_result: 'ring_no_answer',
        channel: 'phone',
        started_at: new Date('2026-09-23T03:30:00.000Z'),
      },
      cfg(),
    );
    expect(out.sla_frozen).toBe(true);
    expect(out.snapshot.hold_until).toBeNull();
    expect(out.counts_toward_sla).toBe(false);
  });
});
