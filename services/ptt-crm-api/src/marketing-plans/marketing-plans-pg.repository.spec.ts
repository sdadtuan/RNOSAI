import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { MarketingPlansPgRepository } from './marketing-plans-pg.repository';

jest.mock('pg', () => ({ Pool: jest.fn() }));

describe('Marketing plans Wave 1 wiring', () => {
  it('uses PostgreSQL in marketing plans and market research', () => {
    const service = fs.readFileSync(path.join(__dirname, 'marketing-plans.service.ts'), 'utf8');
    const module = fs.readFileSync(path.join(__dirname, 'marketing-plans.module.ts'), 'utf8');
    const marketResearch = fs.readFileSync(
      path.join(__dirname, '../market-research/market-research.service.ts'),
      'utf8',
    );

    for (const source of [service, module, marketResearch]) {
      expect(source).not.toMatch(/MarketingPlansSqliteRepository|marketing-plans-sqlite/);
      expect(source).toMatch(/MarketingPlansPgRepository/);
    }
  });
});

describe('MarketingPlansPgRepository', () => {
  const query = jest.fn();
  let repo: MarketingPlansPgRepository;

  beforeEach(() => {
    query.mockReset();
    (Pool as unknown as jest.Mock).mockImplementation(() => ({
      query,
      end: jest.fn(),
    }));
    repo = new MarketingPlansPgRepository({ databaseUrl: 'postgres://test' } as never);
  });

  it('bootstraps the complete plan schema and lists plans with aggregate counts', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: '7',
          code: 'FY26',
          name: 'Growth 2026',
          status: 'active',
          priority: 'high',
          fiscal_year: 2026,
          period_label: 'FY26',
          owner_staff_id: '3',
          owner_name: 'Lan',
          pillars_json: [{ name: 'Brand' }],
          channels_focus_json: ['search'],
          success_metrics_json: [{ metric: 'MQL' }],
          strategy_framework_json: {},
          target_market_prof_json: {},
          target_market_steps4_json: {},
          khtn_market_research_json: {},
          budget_planned_vnd: '12000000',
          linked_campaign_count: '2',
          milestone_total: '3',
          milestone_done: '1',
          created_at: '2026-08-27T00:00:00.000Z',
          updated_at: '2026-08-27T01:00:00.000Z',
        }],
      });

    const rows = await repo.listPlans({ fiscalYear: 2026, status: 'active', q: 'growth' });

    const schema = query.mock.calls[0][0] as string;
    expect(schema).toContain('ALTER TABLE crm_marketing_plans');
    expect(schema).toContain('ADD COLUMN IF NOT EXISTS priority');
    expect(schema).toContain('ADD COLUMN IF NOT EXISTS khtn_market_research_json');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_marketing_plan_campaigns');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS crm_marketing_plan_milestones');
    expect(query.mock.calls[1][0]).toContain('COUNT(*)::int');
    expect(query.mock.calls[1][0]).toContain('p.name ILIKE');
    expect(query.mock.calls[1][1]).toEqual([2026, 'active', '%growth%']);
    expect(rows[0]).toMatchObject({
      id: 7,
      owner_staff_id: 3,
      owner_name: 'Lan',
      budget_planned_vnd: 12000000,
      linked_campaign_count: 2,
      milestone_total: 3,
      milestone_done: 1,
      pillars_json: '[{"name":"Brand"}]',
    });
  });

  it('creates a plan with normalized values and returns its detail', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '9' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: '9',
          name: 'Launch',
          status: 'draft',
          priority: 'normal',
          fiscal_year: 2026,
        }],
      });

    const row = await repo.createPlan({
      name: ' Launch ',
      status: 'unknown',
      priority: 'unknown',
      fiscal_year: 2026,
      budget_planned_vnd: 5000,
    });

    expect(query.mock.calls[1][0]).toContain('INSERT INTO crm_marketing_plans');
    expect(query.mock.calls[1][0]).toContain('RETURNING id');
    expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining(['Launch', 'draft', 'normal', 5000]));
    expect(query.mock.calls[2]).toEqual([
      expect.stringContaining('WHERE p.id = $1'),
      [9],
    ]);
    expect(row).toMatchObject({ id: 9, name: 'Launch', status: 'draft', priority: 'normal' });
  });

  it('patches Market Research JSON using PostgreSQL jsonb', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '7' }] })
      .mockResolvedValueOnce({ rows: [{
        id: '7',
        name: 'Growth',
        status: 'active',
        priority: 'high',
        fiscal_year: 2026,
        khtn_market_research_json: { insight_ids: [4] },
      }] });

    const row = await repo.patchPlan(7, {
      khtn_market_research_json: '{"insight_ids":[4]}',
    });

    expect(query.mock.calls[1][0]).toContain('khtn_market_research_json = $2::jsonb');
    expect(query.mock.calls[1][1]).toEqual([7, '{"insight_ids":[4]}']);
    expect(row?.khtn_market_research_json).toBe('{"insight_ids":[4]}');
  });
});
