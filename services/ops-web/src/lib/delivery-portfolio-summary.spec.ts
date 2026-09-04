import { describe, expect, it } from 'vitest';
import { buildPortfolioSummary } from './delivery-portfolio-summary';

describe('buildPortfolioSummary', () => {
  it('counts health and ingest', () => {
    const s = buildPortfolioSummary([
      { health_status: 'stable', capabilities: ['lead_ingest'], ingest_status: 'active' },
      { health_status: 'overdue', capabilities: ['delivery'], ingest_status: null },
      { health_status: 'needs_attention', capabilities: ['delivery'], ingest_status: null },
    ]);
    expect(s.total).toBe(3);
    expect(s.on_track).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.at_risk).toBe(1);
    expect(s.ingest_active).toBe(1);
    expect(s.budget_used).toBeNull();
    expect(s.margin).toBeNull();
  });

  it('aggregates budget when contract_budget present', () => {
    const s = buildPortfolioSummary([
      { health_status: 'stable', contract_budget: '1000', forecast_cost: '400', gross_margin_pct: '35' },
      { health_status: 'stable', contract_budget: '2000', forecast_cost: '600', gross_margin_pct: '25' },
    ]);
    expect(s.budget_used).toBe(1000);
    expect(s.margin).toBe(30);
  });
});
