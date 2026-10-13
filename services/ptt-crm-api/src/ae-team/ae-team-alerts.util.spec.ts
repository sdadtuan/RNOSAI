import { defaultKanbanCardSettings } from '../leads/kanban-card.util';
import { aeTeamSettingsFromPayload } from './ae-team.util';
import {
  buildAeAlertCandidates,
  isAeIdle,
  isAlertDrop,
  planAeTeamAlertTick,
  slaAlertLevel,
  type AeAlertCandidate,
  type AeStoredAlert,
} from './ae-team-alerts.util';

const kanban = defaultKanbanCardSettings();
const thresholds = aeTeamSettingsFromPayload({});
const now = new Date('2026-10-13T03:00:00.000Z');

function stored(partial: Partial<AeStoredAlert> & Pick<AeStoredAlert, 'id' | 'dedupeKey'>): AeStoredAlert {
  return {
    ruleCode: 'AE-SLA',
    level: 'yellow',
    status: 'open',
    createdAt: '2026-10-13T01:00:00.000Z',
    ownerStaffId: 15,
    targetType: 'staff',
    targetId: '15',
    ...partial,
  };
}

describe('ae team alert tick', () => {
  const candidate: AeAlertCandidate = {
    ruleCode: 'AE-SLA',
    targetType: 'staff',
    targetId: '15',
    level: 'red',
    ownerStaffId: 15,
    dedupeKey: 'AE-SLA:staff:15:2026-10-13',
    title: 'AE trễ SLA',
    body: '3 lead',
  };

  it('does not insert outside working hours', () => {
    const night = new Date('2026-10-13T15:30:00.000Z');
    const plan = planAeTeamAlertTick({
      inShift: false,
      now: night,
      cooldownMinutes: 120,
      escalateMinutes: 60,
      periodKey: '2026-10-13',
      candidates: [candidate],
      existing: [stored({ id: 1, dedupeKey: 'other', level: 'yellow', createdAt: '2026-10-13T12:00:00.000Z' })],
    });
    expect(plan).toEqual({ insert: [], escalate: [], resolveIds: [] });
  });

  it('does not insert the same key again during cooldown', () => {
    const blocked = planAeTeamAlertTick({
      inShift: true,
      now,
      cooldownMinutes: 120,
      escalateMinutes: 60,
      periodKey: '2026-10-13',
      candidates: [candidate],
      existing: [stored({ id: 4, dedupeKey: candidate.dedupeKey, status: 'resolved', createdAt: '2026-10-13T02:30:00.000Z' })],
    });
    expect(blocked.insert).toEqual([]);

    const open = planAeTeamAlertTick({
      inShift: true,
      now,
      cooldownMinutes: 1,
      escalateMinutes: 60,
      periodKey: '2026-10-13',
      candidates: [candidate],
      existing: [stored({ id: 5, dedupeKey: candidate.dedupeKey, status: 'open', createdAt: '2026-10-12T01:00:00.000Z' })],
    });
    expect(open.insert.find((row) => row.dedupeKey === candidate.dedupeKey)).toBeUndefined();
  });

  it('raises yellow and red alerts that stayed open and leaves info alone', () => {
    const plan = planAeTeamAlertTick({
      inShift: true,
      now,
      cooldownMinutes: 120,
      escalateMinutes: 60,
      periodKey: '2026-10-13',
      candidates: [],
      existing: [
        stored({ id: 1, dedupeKey: 'y', level: 'yellow', createdAt: '2026-10-13T01:30:00.000Z' }),
        stored({ id: 2, dedupeKey: 'r', level: 'red', createdAt: '2026-10-13T01:30:00.000Z' }),
        stored({ id: 3, dedupeKey: 'i', level: 'info', ruleCode: 'HOT-AE', createdAt: '2026-10-13T00:00:00.000Z' }),
      ],
    });
    expect(plan.escalate).toEqual([
      { id: 1, level: 'red' },
      { id: 2, level: 'esc' },
    ]);
    expect(plan.insert.map((row) => row.ruleCode)).toEqual(['ESC', 'ESC']);
    expect(plan.insert.find((row) => row.targetId === '3')).toBeUndefined();
  });
});

describe('ae team alert candidates', () => {
  it('alerts SLA only at the threshold and a drop only past the percent', () => {
    expect(slaAlertLevel(2, thresholds)).toBeNull();
    expect(slaAlertLevel(3, thresholds)).toBe('red');
    expect(isAlertDrop(80, 60, 20)).toBe(false);
    expect(isAlertDrop(80, 59, 20)).toBe(true);
    expect(isAlertDrop(null, 10, 20)).toBe(false);
    expect(isAeIdle(new Date('2026-10-13T01:30:00.000Z'), now, 2, kanban)).toBe(false);
    expect(isAeIdle(new Date('2026-10-13T01:00:00.000Z'), now, 2, kanban)).toBe(true);
  });

  it('builds an SLA alert for the AE and an info hot alert for a lead that just crossed', () => {
    const rows = buildAeAlertCandidates({
      now,
      periodKey: '2026-10-13',
      weekKey: '2026-W42',
      thresholds,
      kanban,
      members: [{
        staffId: 15,
        slaBreach: 3,
        answerPct: 40,
        winPct: null,
        prevAnswerPct: 70,
        prevWinPct: null,
        lastCallAt: '2026-10-13T02:50:00.000Z',
      }],
      leads: [{
        ownerId: 15,
        lead: {
          id: 9,
          status: 'da_lien_he',
          receivedAt: '2026-10-13T02:20:00.000Z',
          updatedAt: '2026-10-13T02:20:00.000Z',
          firstCallAt: null,
          lastCallAt: null,
          nextCallAt: null,
          hasCall: false,
          source: 'facebook',
          channel: 'meta',
          need: 'Chạy ads',
          valueVnd: null,
          callAttemptCount: 0,
          lastCallResult: '',
        },
      }],
    });
    expect(rows.map((row) => row.ruleCode).sort()).toEqual(['AE-DROP', 'AE-SLA', 'HOT-AE']);
    expect(rows.find((row) => row.ruleCode === 'HOT-AE')?.level).toBe('info');
  });
});
