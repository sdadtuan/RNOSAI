import { aeTeamRankWeights, aeTeamSettingsFromPayload, canSeeOwnRank } from './ae-team.util';
import { rankAeMembers, rankingToCsv } from './ae-team-rank.util';

describe('ae team rank', () => {
  const weights = aeTeamRankWeights({});

  it('scores by the published weights and drops a missing part', () => {
    expect(weights).toEqual({ sla: 0.3, calls: 0.2, conversion: 0.2, revenue: 0.3 });
    const rows = rankAeMembers([
      { staffId: 2, name: 'Bình', slaPct: 100, callPct: null, conversionPct: 0, revenuePct: 0 },
      { staffId: 1, name: 'An', slaPct: 100, callPct: 100, conversionPct: 100, revenuePct: 100 },
    ], weights);
    expect(rows.map((row) => row.staff_id)).toEqual([1, 2]);
    expect(rows[0].score).toBe(100);
    expect(rows[1].score).toBe(37.5);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  it('writes a csv without a phone number', () => {
    const csv = rankingToCsv(rankAeMembers([
      { staffId: 1, name: 'An', slaPct: 80, callPct: 50, conversionPct: null, revenuePct: null },
    ], weights));
    const withPhone = { ...({ staffId: 1, name: 'An', phone: '0901234567' }) };
    expect(csv).toContain('An');
    expect(csv).toContain('% đúng SLA');
    expect(csv).not.toContain('0901234567');
    expect(csv).not.toContain('phone');
    expect(csv).not.toContain(String(withPhone.phone));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('lets an AE see only their rank when the setting is on', () => {
    expect(canSeeOwnRank(false, false)).toBe(false);
    expect(canSeeOwnRank(false, aeTeamSettingsFromPayload({ kanban: { ae_team: { show_rank_to_ae: true } } }).show_rank_to_ae)).toBe(true);
    expect(canSeeOwnRank(true, false)).toBe(true);
  });
});
