import {
  buildActionSql,
  buildHealthSql,
  buildKpiSql,
  makeOverview,
  mapActionRows,
  renderSuccessRate,
  slotUsage,
} from './cp-overview.service';

describe('CpOverviewService', () => {
  it('returns null KPIs when no rows in scope', async () => {
    const svc = makeOverview({ projects: [], jobs: [], ledger: [], assets: [], tasks: [] });
    const out = await svc.getKpis({ scope: 'me', staffId: 1 });
    expect(out.kpis.videos_created).toBeNull();
    expect(out.last_updated).toMatch(/T/);
  });

  it('render success is completed/(completed+failed) ignoring cancelled', () => {
    expect(renderSuccessRate({ completed: 9, failed: 1, cancelled: 3 })).toBe(0.9);
    expect(renderSuccessRate({ completed: 0, failed: 0, cancelled: 2 })).toBeNull();
  });

  it('keeps a missing action resource id null', () => {
    expect(
      mapActionRows([
        {
          kind: 'mention',
          severity: 'info',
          title: 'You were mentioned',
          resource_type: 'comment',
          resource_id: null,
          owner_staff_id: null,
          sla_at: null,
          href: '/cp/activity',
        },
      ])[0].resource_id,
    ).toBeNull();
  });

  it('returns null credits remaining without an allocation', async () => {
    const svc = makeOverview({
      projects: [{ id: 'p1', owner_staff_id: 1 }],
      drafts: [],
      jobs: [],
      ledger: [{ project_id: 'p1', kind: 'charge', amount: 5 }],
      assets: [],
      tasks: [],
    });
    const out = await svc.getKpis({ scope: 'me', staffId: 1 });
    expect(out.kpis.credits_remaining).toBeNull();
  });

  it('uses ICT boundaries and draft created range predicates in KPI SQL', () => {
    const built = buildKpiSql({
      scope: 'me',
      staffId: 1,
      from: '2026-09-01',
      to: '2026-09-07',
    });
    expect(built.sql).toContain("AT TIME ZONE 'Asia/Ho_Chi_Minh'");
    expect(built.sql).toContain('d.created_at');
    expect(built.sql).toContain('d.created_at AT TIME ZONE');
    expect(built.sql).not.toContain('d.autosaved_at AT TIME ZONE');
  });

  it('uses ICT boundaries in action SQL', () => {
    expect(buildActionSql({ scope: 'me', staffId: 1 }).sql).toContain(
      "AT TIME ZONE 'Asia/Ho_Chi_Minh'",
    );
  });

  it('counts only preparing and rendering jobs as occupied slots', () => {
    expect(slotUsage(['queued', 'preparing', 'rendering', 'completed'])).toBe(2);
    const sql = buildHealthSql();
    expect(sql).toContain("state IN ('preparing','rendering')");
  });
});
