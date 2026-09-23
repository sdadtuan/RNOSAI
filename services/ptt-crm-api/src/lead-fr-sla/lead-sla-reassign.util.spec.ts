import { defaultLeadSlaSettingsPayload } from '../lead-sla-settings/lead-sla-settings.defaults';
import type { LeadFrSlaCaseConfig } from './lead-fr-sla.types';
import {
  evaluateReassignDecision,
  pickRoundRobinLeastOpen,
  shouldAlertQueueWait,
  type ReassignLeadInput,
} from './lead-sla-reassign.util';

function cfg(): LeadFrSlaCaseConfig & { feature_flags: { reassign_on_1a_timeout: boolean } } {
  const d = defaultLeadSlaSettingsPayload();
  return {
    case_1a: d.case_1a,
    case_1b: d.case_1b,
    case_1c: d.case_1c,
    fr1_channels: d.fr1_channels,
    eligible_pipeline_stages: d.eligible_pipeline_stages,
    working_hours: d.working_hours,
    holidays: [],
    feature_flags: { reassign_on_1a_timeout: false },
  };
}

function base(over: Partial<ReassignLeadInput> = {}): ReassignLeadInput {
  return {
    lead_id: 1,
    owner_id: 10,
    pipeline_stage: 'moi',
    contact_status: 'attempting',
    hold_until: new Date('2026-09-20T10:00:00.000Z'),
    hold_reason: 'fr_chain_1b',
    hold_profile: '1b',
    last_call_result: 'ring_no_answer',
    attempts_since_assign: 5,
    reassign_count: 0,
    is_hot: false,
    meeting_at: null,
    previous_assignee_ids: [],
    ...over,
  };
}

const now = new Date('2026-09-22T10:00:00.000Z');

describe('P10.b reassign eligibility T2–T8', () => {
  it('T2: 5× RNA over 3 WD → reassign at hold_until', () => {
    const d = evaluateReassignDecision(base({ attempts_since_assign: 5 }), cfg(), now);
    expect(d).toEqual({ action: 'reassign', reason: 'sla_hold_expired_1b' });
  });

  it('T3: Hot + 4 RNA over 2 WD → reassign', () => {
    const d = evaluateReassignDecision(
      base({
        is_hot: true,
        attempts_since_assign: 4,
        hold_reason: 'hot_lead',
      }),
      cfg(),
      now,
    );
    expect(d).toEqual({ action: 'reassign', reason: 'sla_hold_expired_1b' });
  });

  it('T4: 4 RNA over 3 WD → no reassign (insufficient attempts) — nudge', () => {
    const d = evaluateReassignDecision(base({ attempts_since_assign: 4 }), cfg(), now);
    expect(d).toEqual({ action: 'nudge', reason: 'insufficient_attempts_1b' });
  });

  it('T5: wrong_number confirm → invalid path, never reassign', () => {
    const d = evaluateReassignDecision(
      base({
        last_call_result: 'wrong_number',
        contact_status: 'invalid_contact',
        hold_reason: 'wrong_number',
        hold_profile: 'invalid',
      }),
      cfg(),
      now,
    );
    expect(d.action).toBe('invalid_path');
  });

  it('T6: unreachable + 1 reassign already → close not 2nd reassign', () => {
    const d = evaluateReassignDecision(
      base({
        last_call_result: 'unreachable',
        hold_reason: 'fr_chain_1c',
        hold_profile: '1c',
        attempts_since_assign: 3,
        reassign_count: 1,
      }),
      cfg(),
      now,
    );
    expect(d).toEqual({ action: 'unreachable_closed', reason: 'max_reassign_rounds' });
  });

  it('T7: 1a no meeting_at past hold → escalate, same AM', () => {
    const d = evaluateReassignDecision(
      base({
        last_call_result: 'connected_meet_pending',
        contact_status: 'meet_pending',
        hold_reason: 'meet_pending',
        hold_profile: '1a',
        meeting_at: null,
      }),
      cfg(),
      now,
    );
    expect(d).toEqual({ action: 'escalate_1a', reason: '1a_timeout_escalate' });
  });

  it('T8: queue wait >1h → alert', () => {
    const queuedAt = new Date(now.getTime() - 2 * 3600_000);
    expect(shouldAlertQueueWait(queuedAt, 1, now)).toBe(true);
    expect(shouldAlertQueueWait(new Date(now.getTime() - 30 * 60_000), 1, now)).toBe(false);
  });

  it('freezes Solution-stage leads', () => {
    const d = evaluateReassignDecision(
      base({ pipeline_stage: 'solution' }),
      cfg(),
      now,
    );
    expect(d).toEqual({ action: 'skip', reason: 'pipeline_frozen' });
  });

  it('hold_until null → skip (R3)', () => {
    const d = evaluateReassignDecision(base({ hold_until: null }), cfg(), now);
    expect(d).toEqual({ action: 'skip', reason: 'hold_until_null' });
  });

  it('pool excludes previous assignees within cooldown', () => {
    const pick = pickRoundRobinLeastOpen(
      [
        { staff_id: 1, open_attempting: 2, accepts_leads: true, active: true },
        { staff_id: 2, open_attempting: 0, accepts_leads: true, active: true },
        { staff_id: 3, open_attempting: 1, accepts_leads: false, active: true },
      ],
      [2],
      {
        maxOpen: 30,
        cooldownDays: 7,
        now,
        previousAtByStaff: { 2: new Date(now.getTime() - 2 * 24 * 3600_000).toISOString() },
      },
    );
    expect(pick).toBe(1);
  });

  it('pool picks least open when no cooldown block', () => {
    const pick = pickRoundRobinLeastOpen(
      [
        { staff_id: 1, open_attempting: 5, accepts_leads: true, active: true },
        { staff_id: 2, open_attempting: 1, accepts_leads: true, active: true },
      ],
      [],
      { maxOpen: 30, cooldownDays: 7, now },
    );
    expect(pick).toBe(2);
  });
});
