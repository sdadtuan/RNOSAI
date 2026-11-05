import { buildWeeklyRhythm, computeDashboardTiles } from './performance-dashboard';

describe('performance-dashboard', () => {
  it('computes six tiles including data_blocked and assumption watch', () => {
    const tiles = computeDashboardTiles({
      rows: [
        { lifecycle: 'tracking', status: 'green', quality: 'verified', assumption_open: false },
        { lifecycle: 'tracking', status: 'green', quality: 'stale', assumption_open: false },
        { lifecycle: 'tracking', status: 'yellow', quality: 'verified', assumption_open: false },
        { lifecycle: 'tracking', status: 'green', quality: 'verified', assumption_open: true },
        { lifecycle: 'tracking', status: 'red', quality: 'pending', assumption_open: false },
        { lifecycle: 'draft', status: 'green', quality: 'verified', assumption_open: false },
      ],
      item_scores: [80, 84.8],
      checkins_expected: 10,
      checkins_on_time: 9,
    });
    expect(tiles.on_track).toBe(1);
    expect(tiles.watch).toBe(2);
    expect(tiles.off_track).toBe(1);
    expect(tiles.total).toBe(5);
    expect(tiles.data_blocked).toBe(2);
    expect(tiles.completion_pct).toBe(82.4);
    expect(tiles.checkin_on_time_pct).toBe(90);
  });

  it('builds five weekly rhythm rows with hrefs', () => {
    const rhythm = buildWeeklyRhythm({
      open_assumptions: ['Budget An Phát 120tr'],
      at_risk: ['CPL An Phát Critical'],
      stale_label: 'CRM Valid Lead 29h',
      gm_miss: 'DV04 Meta · GM 22,4%',
      pending_scorecard: 'Q4 Marketing Lead',
    });
    expect(rhythm).toHaveLength(5);
    expect(rhythm.map((r) => r.id)).toEqual([
      'assumption',
      'at_risk',
      'stale',
      'gm',
      'scorecard',
    ]);
    expect(rhythm[2].href).toBe('/crm/kpi-hub/performance/crm-source');
    expect(rhythm[3].href).toBe('/crm/kpi-hub/kpi-contracts');
  });
});
