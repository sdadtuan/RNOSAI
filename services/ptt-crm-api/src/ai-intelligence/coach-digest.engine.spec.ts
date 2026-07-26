import { buildCoachDigest } from './coach-digest.engine';

describe('coach-digest.engine', () => {
  it('builds digest cards with drill-down hrefs', () => {
    const digest = buildCoachDigest({
      team_id: 'org',
      week_key: '2026-W30',
      week_label: '2026-07-21 → 2026-07-27',
      week_start: '2026-07-21',
      week_end: '2026-07-27',
      sla_breach: 4,
      sla_warning: 2,
      sla_ok: 20,
      acceptance_rate_pct: 18,
      accepted: 9,
      dismissed: 41,
      pending: 3,
      top_dismiss_reasons: [{ reason: 'wrong_tone', count: 12 }],
      pipeline_at_risk: 5,
    });

    expect(digest.cards).toHaveLength(3);
    expect(digest.cards[0].drill_href).toBe('/crm/cskh-board?sla_filter=breach');
    expect(digest.cards[1].drill_href).toBe('/crm/ai/insights?status=dismissed');
    expect(digest.severity).toBe('critical');
    expect(digest.email_preview).toContain('Coach digest');
  });

  it('uses info severity when metrics healthy', () => {
    const digest = buildCoachDigest({
      team_id: 'org',
      week_key: '2026-W30',
      week_label: '2026-07-21 → 2026-07-27',
      week_start: '2026-07-21',
      week_end: '2026-07-27',
      sla_breach: 0,
      sla_warning: 0,
      sla_ok: 30,
      acceptance_rate_pct: 45,
      accepted: 20,
      dismissed: 10,
      pending: 1,
      top_dismiss_reasons: [],
      pipeline_at_risk: 0,
    });
    expect(digest.severity).toBe('info');
  });
});
