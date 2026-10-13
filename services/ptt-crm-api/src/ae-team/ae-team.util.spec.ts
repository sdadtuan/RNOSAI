import { defaultKanbanCardSettings } from '../leads/kanban-card.util';
import {
  aeRowTone,
  aeTeamColumnId,
  aeTeamSettingsFromPayload,
  buildAeMemberStats,
  classifyAeIntervention,
  reassignAuditRows,
  scopeFromAccess,
  sortAeInterventions,
  staffIdsAcceptingIntake,
  suggestAeReceivers,
  type AeTeamLeadFact,
} from './ae-team.util';

const settings = defaultKanbanCardSettings();
const thresholds = aeTeamSettingsFromPayload({});
const now = new Date('2026-10-13T02:00:00.000Z');
const period = {
  from: new Date('2026-10-13T00:00:00.000Z'),
  to: new Date('2026-10-13T16:59:59.000Z'),
};

function lead(partial: Partial<AeTeamLeadFact>): AeTeamLeadFact {
  return {
    id: 1,
    status: 'moi',
    receivedAt: '2026-10-13T01:00:00.000Z',
    updatedAt: '2026-10-13T01:00:00.000Z',
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
    ...partial,
  };
}

describe('ae team scope', () => {
  it('denies a viewer who is not a team lead and does not have view all', () => {
    expect(scopeFromAccess(false, [])).toEqual({ mode: 'deny' });
    expect(scopeFromAccess(false, [4])).toEqual({ mode: 'teams', teamIds: [4] });
    expect(scopeFromAccess(true, [])).toEqual({ mode: 'all' });
  });
});

describe('ae team columns', () => {
  it('puts first_contact in Đã liên hệ', () => {
    expect(aeTeamColumnId('first_contact')).toBe('da_lien_he');
    expect(aeTeamColumnId('moi')).toBe('moi');
    expect(aeTeamColumnId('dang_tu_van')).toBe('dang_tu_van');
    expect(aeTeamColumnId('bao_gia')).toBe('bao_gia');
  });
});

describe('ae team rollup', () => {
  it('counts a late new lead as breach and a call inside working hours as on time', () => {
    const stats = buildAeMemberStats({
      leads: [
        lead({ id: 1, receivedAt: '2026-10-13T01:00:00.000Z' }),
        lead({
          id: 2,
          receivedAt: '2026-10-13T01:00:00.000Z',
          firstCallAt: '2026-10-13T01:10:00.000Z',
          lastCallAt: '2026-10-13T01:10:00.000Z',
          hasCall: true,
          status: 'da_lien_he',
        }),
      ],
      calls: [],
      kanban: settings,
      thresholds,
      now,
      period,
      quotaVnd: null,
    });
    expect(stats.by_status.moi).toBe(1);
    expect(stats.by_status.da_lien_he).toBe(1);
    expect(stats.sla_breach).toBe(1);
    expect(stats.within_sla_pct).toBe(50);
  });

  it('does not count wall-clock time outside working hours as SLA breach', () => {
    const stats = buildAeMemberStats({
      leads: [
        lead({
          id: 3,
          receivedAt: '2026-10-12T14:30:00.000Z',
          updatedAt: '2026-10-12T14:30:00.000Z',
        }),
      ],
      calls: [],
      kanban: settings,
      thresholds,
      now: new Date('2026-10-12T15:00:00.000Z'),
      period: {
        from: new Date('2026-10-12T00:00:00.000Z'),
        to: new Date('2026-10-12T16:59:59.000Z'),
      },
      quotaVnd: null,
    });
    expect(stats.sla_breach).toBe(0);
  });

  it('marks the row red from settings, not a fixed count', () => {
    const custom = aeTeamSettingsFromPayload({
      kanban: { ae_team: { ae_sla_breach_yellow: 2, ae_sla_breach_red: 4 } },
    });
    expect(aeRowTone(4, custom)).toBe('red');
    expect(aeRowTone(2, custom)).toBe('yellow');
    expect(aeRowTone(1, custom)).toBe('green');
  });

  it('leaves revenue over quota empty when the quota is missing', () => {
    const stats = buildAeMemberStats({
      leads: [lead({ id: 4, status: 'won', valueVnd: 1000, hasCall: true, firstCallAt: '2026-10-13T01:05:00.000Z' })],
      calls: [],
      kanban: settings,
      thresholds,
      now,
      period,
      quotaVnd: null,
    });
    expect(stats.revenue_vnd).toBe(1000);
    expect(stats.quota_vnd).toBeNull();
    expect(stats.attainment_pct).toBeNull();
  });
});

describe('ae team interventions', () => {
  it('flags R1 only after the SLA minute and R2 only after the hot-uncalled minute', () => {
    const underSla = classifyAeIntervention(
      lead({ receivedAt: '2026-10-13T01:46:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    const overSla = classifyAeIntervention(
      lead({ receivedAt: '2026-10-13T01:44:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    expect(underSla?.codes ?? []).not.toContain('R1');
    expect(overSla?.codes).toContain('R1');

    const underHot = classifyAeIntervention(
      lead({ status: 'da_lien_he', hasCall: false, receivedAt: '2026-10-13T01:31:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    const overHot = classifyAeIntervention(
      lead({ status: 'da_lien_he', hasCall: false, receivedAt: '2026-10-13T01:30:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    expect(underHot?.codes ?? []).not.toContain('R2');
    expect(overHot?.codes).toContain('R2');
  });

  it('flags R3, R4, and a consecutive no-answer streak only on the threshold', () => {
    const quoteSoon = classifyAeIntervention(
      lead({ status: 'bao_gia', hasCall: true, updatedAt: '2026-10-07T02:00:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    const quoteLate = classifyAeIntervention(
      lead({ status: 'bao_gia', hasCall: true, updatedAt: '2026-10-06T02:00:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    expect(quoteSoon?.codes ?? []).not.toContain('R3');
    expect(quoteLate?.codes).toContain('R3');

    const upcoming = classifyAeIntervention(
      lead({ status: 'dang_tu_van', hasCall: true, lastCallAt: '2026-10-13T01:00:00.000Z', nextCallAt: '2026-10-13T03:00:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    const missed = classifyAeIntervention(
      lead({ status: 'dang_tu_van', hasCall: true, lastCallAt: '2026-10-13T01:00:00.000Z', nextCallAt: '2026-10-13T01:59:00.000Z' }),
      settings,
      thresholds,
      now,
    );
    expect(upcoming).toBeNull();
    expect(missed?.codes).toContain('R4');

    const shortStreak = classifyAeIntervention(
      lead({ status: 'da_lien_he', hasCall: true, callResults: ['no_answer', 'no_answer'] }),
      settings,
      thresholds,
      now,
    );
    const broken = classifyAeIntervention(
      lead({ status: 'da_lien_he', hasCall: true, callResults: ['no_answer', 'no_answer', 'answered', 'no_answer'] }),
      settings,
      thresholds,
      now,
    );
    const streak = classifyAeIntervention(
      lead({ status: 'da_lien_he', hasCall: true, callResults: ['answered', 'no_answer', 'no_answer', 'no_answer'] }),
      settings,
      thresholds,
      now,
    );
    expect(shortStreak?.codes ?? []).not.toContain('R5');
    expect(broken?.codes ?? []).not.toContain('R5');
    expect(streak?.codes).toContain('R5');
  });

  it('orders R1 before R5 and the longer delay first inside one rule', () => {
    const rows = sortAeInterventions([
      { primary: 'R5' as const, delay: 4 },
      { primary: 'R1' as const, delay: 10 },
      { primary: 'R1' as const, delay: 40 },
    ]);
    expect(rows.map((row) => row.delay)).toEqual([40, 10, 4]);
  });
});

describe('ae team suggest and reassign', () => {
  const weights = { open_leads: 0.5, win_rate: 0.3, accepting: 0.2 };

  it('skips an AE who stopped intake or is disabled on the project', () => {
    const rows = suggestAeReceivers({
      weights,
      excludeStaffId: 9,
      rows: [
        { staffId: 1, name: 'An', accepting: true, assignEnabled: true, openLeads: 0, winRate: 1 },
        { staffId: 2, name: 'Bình', accepting: true, assignEnabled: true, openLeads: 10, winRate: null },
        { staffId: 3, name: 'Chi', accepting: false, assignEnabled: true, openLeads: 0, winRate: 1 },
        { staffId: 4, name: 'Dũng', accepting: true, assignEnabled: false, openLeads: 0, winRate: 1 },
        { staffId: 9, name: 'Hiện tại', accepting: true, assignEnabled: true, openLeads: 0, winRate: 1 },
      ],
    });
    expect(rows.map((row) => row.staff_id)).toEqual([1, 2]);
    expect(rows[0].score).toBe(1);
    expect(rows[1].score).toBeCloseTo(0.2 / 0.7, 4);
  });

  it('writes from, to, and reason for each lead', () => {
    expect(reassignAuditRows({
      leads: [
        { id: 11, fromOwnerId: 10 },
        { id: 12, fromOwnerId: 10 },
        { id: 13, fromOwnerId: 11 },
      ],
      toStaffId: 20,
      reason: ' Nghỉ phép ',
      assignedBy: 'am@ptt.vn',
    })).toEqual([
      { lead_id: 11, from_owner_id: 10, to_owner_id: 20, reason: 'Nghỉ phép', assigned_by: 'am@ptt.vn' },
      { lead_id: 12, from_owner_id: 10, to_owner_id: 20, reason: 'Nghỉ phép', assigned_by: 'am@ptt.vn' },
      { lead_id: 13, from_owner_id: 11, to_owner_id: 20, reason: 'Nghỉ phép', assigned_by: 'am@ptt.vn' },
    ]);
  });

  it('drops a paused AE from the round robin pool', () => {
    expect(staffIdsAcceptingIntake([1, 2, 3], [2])).toEqual([1, 3]);
  });
});
