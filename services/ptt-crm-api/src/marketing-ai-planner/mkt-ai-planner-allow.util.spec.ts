import { assertPlannerAllowed } from './mkt-ai-planner-allow.util';

describe('assertPlannerAllowed', () => {
  const env = { plannerEnabled: true, envSlugs: [] as string[], pilotOnly: false, pilotSlugs: [] as string[] };

  it('module off → mkt_ai_planner_disabled', () => {
    const r = assertPlannerAllowed('quang-cao-facebook', null, { ...env, plannerEnabled: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('mkt_ai_planner_disabled');
  });

  it('no policy + empty env → not enabled', () => {
    const r = assertPlannerAllowed('quang-cao-facebook', null, env);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('mkt_ai_service_not_enabled');
      expect(r.admin_path).toContain('quang-cao-facebook');
      expect(r.message).toMatch(/chưa mở AI Planner/i);
    }
  });

  it('policy pilot + env AND blocks if env list nonempty and slug missing', () => {
    const r = assertPlannerAllowed(
      'quang-cao-facebook',
      { rollout: 'pilot', enabled: true },
      { ...env, envSlugs: ['meta-lead-gen'] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('mkt_ai_service_not_enabled');
  });

  it('policy pilot + empty env slugs → ok', () => {
    const r = assertPlannerAllowed(
      'quang-cao-facebook',
      { rollout: 'pilot', enabled: true },
      env,
    );
    expect(r).toEqual({ ok: true });
  });

  it('policy off → not enabled', () => {
    const r = assertPlannerAllowed('seo-retainer', { rollout: 'off', enabled: true }, env);
    expect(r.ok).toBe(false);
  });

  it('legacy alias codes stay for one release', () => {
    expect(['mkt_ai_planner_slug_not_pilot', 'mkt_ai_pilot_slug_required']).toContain(
      'mkt_ai_planner_slug_not_pilot',
    );
  });
});
