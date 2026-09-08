import { readFileSync } from 'fs';
import { join } from 'path';
import { QuoteAuditRepository } from './quote-audit.repository';
import { QuoteReportsService } from './quote-reports.service';

class ReportsMemory {
  rows: Record<string, unknown>[] = [];
  lines: Record<string, unknown>[] = [];
  views: Record<string, unknown>[] = [];
  comments: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];
  teamRows: Record<string, unknown>[] = [];
  lastSql = '';

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const row = {
        id: `act-${this.activity.length + 1}`,
        snapshot_json: params[7] ?? {},
        action: params[5],
        proposal_id: params[1],
        resource: params[6],
        created_at: new Date().toISOString(),
      };
      this.activity.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_activity/i.test(sql)) return { rows: this.activity };
    if (/FROM crm_quote_view_events/i.test(sql)) return { rows: this.views };
    if (/FROM crm_quote_comments/i.test(sql)) return { rows: this.comments };
    if (/FROM crm_quote_line_item/i.test(sql)) return { rows: this.lines };
    if (/FROM crm_proposals/i.test(sql)) return { rows: this.rows };
    if (/staff_user_teams/i.test(sql)) return { rows: this.teamRows };
    return { rows: [] };
  }
}

function load(db = new ReportsMemory()) {
  const audit = new QuoteAuditRepository(db);
  return { db, audit, svc: new QuoteReportsService(db, audit) };
}

const SCOPE = {
  scope: 'all' as const,
  staffId: 7,
  teamIds: [] as number[],
  hasFinance: true,
};

describe('QuoteReportsService', () => {
  it('RPT-03 403 without finance', async () => {
    const { svc } = load();

    await expect(svc.get({ ...SCOPE, hasFinance: false, tab: 'margin' })).rejects.toMatchObject({
      response: { error: 'missing_cap', section: 'crm_quote.finance' },
    });
    await expect(svc.get({ ...SCOPE, hasFinance: false, tab: 'rpt-03' })).rejects.toMatchObject({
      response: { error: 'missing_cap', section: 'crm_quote.finance' },
    });
  });

  it('export writes activity', async () => {
    const { svc, db } = load();

    const out = await svc.export({ ...SCOPE, tab: 'executive' });

    expect(out.csv).toEqual(expect.any(String));
    expect(db.activity.some((row) => row.action === 'report_export')).toBe(true);
  });

  it('empty and missing money stay null, never fake 0', async () => {
    const { svc } = load();

    const out = (await svc.get({ ...SCOPE, tab: 'executive' })) as {
      sent_count: number;
      sent_value_vnd: number | null;
      sent_to_viewed: number | null;
      sent_to_accepted: number | null;
      avg_approval_hours: number | null;
    };

    expect(out.sent_count).toBe(0);
    expect(out.sent_value_vnd).toBeNull();
    expect(out.sent_to_viewed).toBeNull();
    expect(out.sent_to_accepted).toBeNull();
    expect(out.avg_approval_hours).toBeNull();
  });

  it('funnel includes a denominator on each step', async () => {
    const { db, svc } = load();
    db.rows = [
      { id: 1, status: 'draft', payable_vnd: 10 },
      { id: 2, status: 'sent', payable_vnd: 20 },
      { id: 3, status: 'viewed', payable_vnd: 30 },
      { id: 4, status: 'accepted', payable_vnd: 40 },
    ];

    const out = (await svc.get({ ...SCOPE, tab: 'funnel' })) as {
      steps: Array<{ step: string; count: number; denominator: number; rate: number | null }>;
    };

    expect(out.steps.map((step) => step.step)).toEqual(['draft', 'sent', 'viewed', 'accepted']);
    for (const step of out.steps) {
      expect(step.denominator).toEqual(expect.any(Number));
    }
    const sent = out.steps.find((step) => step.step === 'sent')!;
    const viewed = out.steps.find((step) => step.step === 'viewed')!;
    const accepted = out.steps.find((step) => step.step === 'accepted')!;
    expect(sent.denominator).toBe(4);
    expect(viewed.denominator).toBe(sent.count);
    expect(accepted.denominator).toBe(sent.count);
    expect(accepted.rate).toBe(1 / 3);
  });

  it('accepts both SRS slugs and rpt-0N tabs', async () => {
    const { svc } = load();

    const executive = await svc.get({ ...SCOPE, tab: 'rpt-01' });
    const funnel = await svc.get({ ...SCOPE, tab: 'rpt-02' });
    const loss = await svc.get({ ...SCOPE, tab: 'loss' });
    const engagement = await svc.get({ ...SCOPE, tab: 'engagement' });

    expect(executive).toEqual(expect.objectContaining({ tab: 'executive' }));
    expect(funnel).toEqual(expect.objectContaining({ tab: 'funnel' }));
    expect(loss).toEqual(expect.objectContaining({ tab: 'loss' }));
    expect(engagement).toEqual(expect.objectContaining({ tab: 'engagement' }));
  });

  it('RPT-03 NSR is fee-only and excludes media', async () => {
    const { db, svc } = load();
    db.rows = [{ id: 9, status: 'sent', nsr_vnd: 80, payable_vnd: 200, media_vnd: 120 }];
    db.lines = [
      {
        proposal_id: 9,
        item_type: 'fee',
        dv_code: 'DV01',
        service_slug: 'strategy',
        name: 'Strategy',
        net_vnd: 80,
        cost_vnd: 40,
      },
      {
        proposal_id: 9,
        item_type: 'media',
        dv_code: 'DV08',
        service_slug: 'performance',
        name: 'Meta Ads',
        net_vnd: 120,
        cost_vnd: 120,
      },
    ];

    const out = (await svc.get({ ...SCOPE, tab: 'margin' })) as {
      groups: Array<{ group: string; nsr_vnd: number | null; direct_cost_vnd: number | null; gm: number | null }>;
    };

    const nsr = out.groups.reduce((sum, row) => sum + (row.nsr_vnd ?? 0), 0);
    expect(nsr).toBe(80);
    expect(JSON.stringify(out)).not.toMatch(/265\.647\.600|22,4|8,46/);
  });

  it('source has no mock money literals', () => {
    const src = readFileSync(join(__dirname, 'quote-reports.service.ts'), 'utf8');
    for (const needle of ['265.647.600', '22,4', '8,46', '8460000000']) {
      expect(src.includes(needle)).toBe(false);
    }
  });

  it('wires GET reports and export before :id with StaffQuoteGuard', () => {
    const src = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    const reportsAt = src.indexOf("@Get('reports')");
    const exportAt = src.indexOf("@Get('reports/export')");
    const idAt = src.indexOf("@Get(':id')");
    expect(reportsAt).toBeGreaterThan(-1);
    expect(exportAt).toBeGreaterThan(reportsAt);
    expect(idAt).toBeGreaterThan(exportAt);
    expect(src.slice(reportsAt, exportAt)).toMatch(/StaffOrInternalKeyGuard,\s*StaffQuoteGuard/);
    expect(src.slice(exportAt, idAt)).toMatch(/assertQuoteAuditCap/);
    expect(src).not.toMatch(/StaffAuthGuard/);
    expect(src).not.toMatch(/DELETE FROM crm_proposals/);
  });
});
