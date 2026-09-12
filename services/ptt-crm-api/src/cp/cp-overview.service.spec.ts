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
    expect(sql).not.toContain("provider = 'stub' AND state IN ('completed', 'failed')");
  });

  it('scopes health queue and p95 to the last 60 minutes of render jobs', () => {
    const sql = buildHealthSql();
    expect(sql).toContain('j.created_at');
    expect(sql).toMatch(/INTERVAL\s+'60 minutes'/);
    expect(sql).not.toMatch(/\b(5|15|30)\s+minutes\b/);
    expect(sql).toMatch(/COALESCE\(j\.project_id, d\.project_id\)/);
    expect(sql).toMatch(/GROUP BY 1/);
    expect(sql).toMatch(/jsonb_agg/);
  });

  it('returns null health metrics when the 60-minute window is empty', async () => {
    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const svc = makeOverview({
      projects: [{ id: 'p1', owner_staff_id: 1 }],
      jobs: [
        {
          id: 'old-queued',
          state: 'queued',
          provider: 'stub',
          created_at: stale,
          stage_log_json: [{ duration_sec: 12 }],
        },
        {
          id: 'old-done',
          state: 'completed',
          provider: 'stub',
          created_at: stale,
          stage_log_json: [{ duration_sec: 90 }],
        },
      ],
      ledger: [],
      assets: [],
      tasks: [],
      settings: { concurrent_slots: 4 },
    });

    const health = await svc.getHealth();

    expect(health.queue_depth).toBeNull();
    expect(health.slots.used).toBeNull();
    expect(health.slots.max).toBe(4);
    expect(health.providers[0]).toEqual({
      id: 'stub',
      success_pct: null,
      p95_sec: null,
    });
  });

  it('includes weavy and magnific providers from the 60-minute window without inventing success_pct', async () => {
    const recent = new Date().toISOString();
    const svc = makeOverview({
      projects: [{ id: 'p1', owner_staff_id: 1 }],
      jobs: [
        { id: 'w1', state: 'queued', provider: 'weavy', created_at: recent },
        {
          id: 'm1',
          state: 'completed',
          provider: 'magnific_mcp',
          created_at: recent,
          stage_log_json: [{ duration_sec: 12 }],
        },
        { id: 'm2', state: 'queued', provider: 'magnific_rest', created_at: recent },
        {
          id: 'c1',
          state: 'failed',
          provider: 'comfyui',
          created_at: recent,
          stage_log_json: [{ duration_sec: 4 }],
        },
      ],
      ledger: [],
      assets: [],
      tasks: [],
    });

    const health = await svc.getHealth();
    const byId = Object.fromEntries(health.providers.map((row) => [row.id, row]));

    expect(byId.weavy).toEqual({ id: 'weavy', success_pct: null, p95_sec: null });
    expect(byId.magnific_mcp.success_pct).toBe(100);
    expect(byId.magnific_mcp.p95_sec).toBe(12);
    expect(byId.magnific_rest).toEqual({ id: 'magnific_rest', success_pct: null, p95_sec: null });
    expect(byId.comfyui.success_pct).toBe(0);
    expect(health.providers.some((row) => row.id === 'stub')).toBe(false);
  });

  it('computes queue depth and stub p95 only from jobs created in the last 60 minutes', async () => {
    const recent = new Date().toISOString();
    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const svc = makeOverview({
      projects: [{ id: 'p1', owner_staff_id: 1 }],
      jobs: [
        { id: 'q1', state: 'queued', provider: 'stub', created_at: recent },
        { id: 'r1', state: 'rendering', provider: 'stub', created_at: recent },
        {
          id: 'done-old',
          state: 'completed',
          provider: 'stub',
          created_at: stale,
          stage_log_json: [{ duration_sec: 400 }],
        },
        {
          id: 'done-new',
          state: 'completed',
          provider: 'stub',
          created_at: recent,
          stage_log_json: [{ duration_sec: 20 }],
        },
        {
          id: 'fail-new',
          state: 'failed',
          provider: 'stub',
          created_at: recent,
          stage_log_json: [{ duration_sec: 8 }],
        },
      ],
      ledger: [],
      assets: [],
      tasks: [],
      settings: { concurrent_slots: 5 },
    });

    const health = await svc.getHealth();

    expect(health.queue_depth).toBe(2);
    expect(health.slots.used).toBe(1);
    expect(health.slots.max).toBe(5);
    expect(health.providers[0].success_pct).toBe(50);
    expect(health.providers[0].p95_sec).toBe(20);
  });

  it('applies the client filter to fixture projects', async () => {
    const svc = makeOverview({
      projects: [
        { id: 'p1', owner_staff_id: 1, agency_client_id: 'client-1' },
        { id: 'p2', owner_staff_id: 1, agency_client_id: 'client-2' },
      ],
      drafts: [
        { id: 'd1', project_id: 'p1', created_at: '2026-09-01T00:00:00Z' },
        { id: 'd2', project_id: 'p2', created_at: '2026-09-01T00:00:00Z' },
      ],
      jobs: [],
      ledger: [],
      assets: [],
      tasks: [],
    });

    const out = await svc.getKpis({ scope: 'me', staffId: 1, clientId: 'client-1' });

    expect(out.kpis.videos_created).toBe(1);
  });

  it('does not emit a budget action for a zero allocation with zero usage', async () => {
    const svc = makeOverview({
      projects: [{ id: 'p1', owner_staff_id: 1, agency_client_id: 'client-1' }],
      jobs: [],
      ledger: [],
      assets: [],
      tasks: [],
      allocations: [{ agency_client_id: 'client-1', allocated: 0 }],
      actions: [],
    });

    expect(await svc.getActions({ scope: 'me', staffId: 1 })).toEqual([]);
    expect(buildActionSql({ scope: 'me', staffId: 1 }).sql).toContain(
      'WHERE allocated > 0 AND used * 100 >= allocated * 50',
    );
  });

  it('scopes fixture allocations and client-only ledger rows to visible clients', async () => {
    const svc = makeOverview({
      projects: [
        { id: 'p1', owner_staff_id: 1, agency_client_id: 'client-1' },
        { id: 'p2', owner_staff_id: 2, agency_client_id: 'client-2' },
      ],
      jobs: [],
      ledger: [
        { project_id: null, agency_client_id: 'client-1', kind: 'charge', amount: 10 },
      ],
      assets: [],
      tasks: [],
      allocations: [
        { agency_client_id: 'client-1', allocated: 100 },
        { agency_client_id: 'client-2', allocated: 200 },
      ],
    });

    const out = await svc.getKpis({ scope: 'me', staffId: 1 });

    expect(out.kpis.credits_used).toBe(10);
    expect(out.kpis.credits_remaining).toBe(90);
  });

  it('scopes Action Center budget ledger rows by project or unbound visible client', () => {
    const sql = buildActionSql({ scope: 'me', staffId: 7 }).sql;

    expect(sql).toContain(
      'WHERE p.id = l.project_id AND p.agency_client_id = c.agency_client_id',
    );
    expect(sql).toContain(
      'l.project_id IS NULL AND l.agency_client_id = c.agency_client_id',
    );
  });

  it('filters Action Center mentions to the requesting staff', () => {
    const built = buildActionSql({ scope: 'all', staffId: 7 });

    expect(built.sql).toContain("a.payload_json->>'mentioned_staff_id'");
    expect(built.sql).toContain("a.payload_json->>'recipient_staff_id'");
    expect(built.params[0]).toBe(7);
  });

  it('maps cp.publish.failed into the publish_failed Action Center kind', () => {
    const sql = buildActionSql({ scope: 'all', staffId: 7 }).sql;

    expect(sql).toContain("'cp.publish.failed'");
    expect(sql).toContain(
      "WHEN e.action IN ('publish_failed', 'cp.publish.failed') THEN 'publish_failed'",
    );
  });
});
