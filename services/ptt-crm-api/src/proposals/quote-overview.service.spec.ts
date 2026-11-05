import { readFileSync } from 'fs';
import { join } from 'path';
import { QuoteAuditRepository } from './quote-audit.repository';
import { QuoteOverviewService } from './quote-overview.service';
import { QT_KPI_KEYS } from './quote.types';

class OverviewMemory {
  rows: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];
  teamRows: Record<string, unknown>[] = [];
  lastSql = '';
  lastProposalSql = '';
  settings = { gm_floor_bps: 2500, discount_auto_bps: 500 };

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    if (/FROM crm_proposals/i.test(sql)) this.lastProposalSql = sql;
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const row = {
        id: `act-${this.activity.length + 1}`,
        snapshot_json: params[7] ?? {},
        action: params[5],
        proposal_id: params[1],
        created_at: new Date().toISOString(),
      };
      this.activity.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_activity/i.test(sql)) return { rows: this.activity };
    if (/FROM crm_quote_settings/i.test(sql)) return { rows: [this.settings] };
    if (/FROM crm_proposals/i.test(sql)) return { rows: this.rows };
    if (/staff_user_teams/i.test(sql)) return { rows: this.teamRows };
    return { rows: [] };
  }
}

function load(db = new OverviewMemory()) {
  const audit = new QuoteAuditRepository(db);
  return { db, svc: new QuoteOverviewService(db, audit) };
}

const SCOPE = {
  scope: 'all' as const,
  staffId: 1,
  teamIds: [] as number[],
  hasFinance: true,
};

describe('QuoteOverviewService', () => {
  it('empty tenant KPIs prefer null open value and ISO last_updated', async () => {
    const { svc } = load();

    const out = await svc.getOverview(SCOPE);

    expect(out.kpis.open_quote_value).toBeNull();
    expect(out.kpis.quote_win_rate).toBeNull();
    expect(out.kpis.forecast_gross_margin).toBeNull();
    expect(out.kpis.pending_approval_count).toBe(0);
    expect(Object.keys(out.kpis)).toEqual([...QT_KPI_KEYS]);
    expect(out.win_rate_formula).toBe('accepted/(accepted+rejected)');
    expect(out.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}T.+/);
    expect(JSON.stringify(out)).not.toMatch(/nsr/i);
  });

  it('finance-less callers keep forecast_gross_margin null and omit NSR', async () => {
    const { db, svc } = load();
    db.rows = [
      {
        id: 11,
        status: 'negotiation',
        payable_vnd: 150000000,
        nsr_vnd: 120000000,
        direct_cost_vnd: 80000000,
        gm_bps: 3333,
        discount_vnd: 0,
        fee_vnd: 120000000,
        media_vnd: 0,
        owner_staff_id: 1,
      },
    ];

    const out = await svc.getOverview({ ...SCOPE, hasFinance: false });

    expect(out.kpis.open_quote_value).toBe(150000000);
    expect(out.kpis.forecast_gross_margin).toBeNull();
    expect(JSON.stringify(out)).not.toMatch(/nsr/i);
  });

  it('hasFinance computes forecast_gross_margin from NSR and direct cost', async () => {
    const { db, svc } = load();
    db.rows = [
      {
        id: 11,
        status: 'negotiation',
        payable_vnd: 150000000,
        nsr_vnd: 120000000,
        direct_cost_vnd: 80000000,
        gm_bps: 3333,
        discount_vnd: 0,
        fee_vnd: 120000000,
        media_vnd: 0,
        owner_staff_id: 1,
      },
    ];

    const out = await svc.getOverview({ ...SCOPE, hasFinance: true });

    expect(out.kpis.forecast_gross_margin).toBe((120000000 - 80000000) / 120000000);
    expect(out.kpis.forecast_gross_margin).toBeCloseTo(1 / 3);
  });

  it('scope=team with teamIds applies staff_user_teams predicate, not me-only', async () => {
    const { db, svc } = load();

    await svc.getOverview({ ...SCOPE, scope: 'team', teamIds: [9, 8] });

    expect(db.lastProposalSql).toMatch(/staff_user_teams/i);
    expect(db.lastProposalSql).toMatch(/team_id = ANY/i);
    expect(db.lastProposalSql).toMatch(/OR EXISTS/i);
  });

  it('loadActorTeamIds reads staff_user_teams for the crm_staff actor', async () => {
    const { db, svc } = load();
    db.teamRows = [{ id: 9 }, { id: 8 }];

    await expect(svc.loadActorTeamIds(3)).resolves.toEqual([9, 8]);
    expect(db.lastSql).toMatch(/staff_user_teams/i);
    expect(db.lastSql).toMatch(/crm_staff/i);
  });

  it('open value sums payable for draft…negotiation and excludes accepted', async () => {
    const { db, svc } = load();
    db.rows = [
      { id: 1, status: 'draft', payable_vnd: 10 },
      { id: 2, status: 'negotiation', payable_vnd: 20 },
      { id: 3, status: 'accepted', payable_vnd: 999 },
      { id: 4, status: 'rejected', payable_vnd: 5 },
    ];

    const out = await svc.getOverview(SCOPE);

    expect(out.kpis.open_quote_value).toBe(30);
    expect(out.kpis.quote_win_rate).toBe(0.5);
  });

  it('Action Center rows expose severity, owner, sla, href, and resource', async () => {
    const { db, svc } = load();
    db.rows = [
      {
        id: 89,
        quote_code: 'QT-PTT-2026-000089',
        status: 'viewed',
        payable_vnd: 100,
        owner_staff_id: 7,
        valid_until: new Date(Date.now() + 2 * 86400000).toISOString(),
        direct_cost_vnd: null,
        discount_vnd: 20,
        fee_vnd: 80,
        media_vnd: 0,
        gm_bps: 2000,
      },
    ];

    const actions = await svc.getActions(SCOPE);
    expect(actions.length).toBeGreaterThan(0);
    for (const row of actions) {
      expect(row).toEqual(
        expect.objectContaining({
          severity: expect.any(String),
          title: expect.any(String),
          impact: expect.any(String),
          href: expect.any(String),
          resource_type: expect.any(String),
          resource_id: expect.any(String),
        }),
      );
      expect(row).toHaveProperty('owner_staff_id');
      expect(row).toHaveProperty('sla');
    }
  });

  it('activity list never returns raw otp or token', async () => {
    const { db, svc } = load();
    db.activity = [
      {
        id: 'a1',
        proposal_id: 1,
        action: 'publication.viewed',
        snapshot_json: { otp: '654321', token: 'secret-token', section: 'investment' },
        created_at: '2026-09-08T01:41:00.000Z',
      },
    ];

    const listed = await svc.listActivity({});
    expect(listed.items[0].snapshot).toEqual({ section: 'investment' });
    expect(JSON.stringify(listed)).not.toMatch(/654321|secret-token/);
  });

  it('source has no mock open-value literals', () => {
    const src = [
      readFileSync(join(__dirname, 'quote-overview.service.ts'), 'utf8'),
      readFileSync(join(__dirname, 'quote-audit.repository.ts'), 'utf8'),
    ].join('\n');
    const banned = ['846' + '0000000', '8,' + '46'];
    for (const needle of banned) {
      expect(src.includes(needle)).toBe(false);
    }
  });
});
