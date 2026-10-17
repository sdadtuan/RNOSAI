import { buildAePerformanceBoard, resolveAePerformanceMode } from './ae-performance.util';

describe('resolveAePerformanceMode', () => {
  it('lets admin and CEO see every AE lead', () => {
    expect(resolveAePerformanceMode({ positionCode: 'CEO', accountManager: false, viewAllCap: false, teamIds: [] }).mode).toBe('all');
    expect(resolveAePerformanceMode({ positionCode: 'super-admin', accountManager: false, viewAllCap: false, teamIds: [] }).mode).toBe('all');
  });

  it('limits GDKD to AEs on a project', () => {
    expect(resolveAePerformanceMode({ positionCode: 'GDKD-01', accountManager: false, viewAllCap: true, teamIds: [1] }).mode).toBe('project');
  });

  it('limits an account manager to the team', () => {
    const out = resolveAePerformanceMode({ positionCode: 'ACM', accountManager: true, viewAllCap: false, teamIds: [4] });
    expect(out.mode).toBe('team');
    expect(out.note).toContain('team');
  });

  it('lets an AE see only their own leads, even when they lead a team', () => {
    expect(resolveAePerformanceMode({ positionCode: 'AE-01', accountManager: false, viewAllCap: false, teamIds: [4] }).mode).toBe('self');
  });
});

describe('buildAePerformanceBoard', () => {
  it('counts stages, projects, SLA, and conversion per owner', () => {
    const board = buildAePerformanceBoard(
      [
        { staffId: 1, name: 'An', code: 'AE-01' },
        { staffId: 2, name: 'Bình', code: 'AE-02' },
      ],
      [
        { ownerId: 1, status: 'moi', projectId: null, projectCode: null, hot: true, slaBreach: true, score: 20 },
        { ownerId: 1, status: 'bao_gia', projectId: 'p1', projectCode: 'TCLT', hot: false, slaBreach: false, score: 30 },
        { ownerId: 1, status: 'chot', projectId: 'p1', projectCode: 'TCLT', hot: false, slaBreach: false, score: null },
        { ownerId: 2, status: 'lost', projectId: 'p1', projectCode: 'TCLT', hot: false, slaBreach: false, score: 10 },
      ],
    );
    expect(board.totals).toMatchObject({ total: 4, unassigned: 1, hot: 1, sla_breach: 1, won: 1, conversion_pct: 25 });
    expect(board.rows[0]).toMatchObject({
      staff_id: 1,
      total: 3,
      won: 1,
      open: 2,
      lost: 0,
      conversion_pct: 33,
      sla_breach: 1,
      avg_score: 25,
      stages: { moi: 1, bao_gia: 1, da_lien_he: 0, dang_tu_van: 0, nurture: 0 },
    });
    expect(board.rows[0].projects).toEqual([{ code: 'TCLT', count: 2 }]);
    expect(board.rows[1].lost).toBe(1);
  });
});
