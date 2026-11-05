export type PortfolioSummary = {
  total: number;
  on_track: number;
  at_risk: number;
  overdue: number;
  ingest_active: number;
  budget_used: number | null;
  margin: number | null;
};

export function buildPortfolioSummary(
  rows: Array<{
    health_status: string;
    capabilities?: string[];
    ingest_status?: string | null;
    contract_budget?: string | null;
    forecast_cost?: string | null;
    gross_margin_pct?: string | null;
  }>,
): PortfolioSummary {
  const withBudget = rows.filter((r) => r.contract_budget != null);
  let budgetUsed: number | null = null;
  let margin: number | null = null;

  if (withBudget.length > 0) {
    const used = withBudget.reduce((s, r) => s + Number(r.forecast_cost ?? 0), 0);
    budgetUsed = used;
    const margins = withBudget
      .map((r) => (r.gross_margin_pct != null ? Number(r.gross_margin_pct) : null))
      .filter((v): v is number => v != null && Number.isFinite(v));
    margin = margins.length > 0 ? Math.round((margins.reduce((a, b) => a + b, 0) / margins.length) * 10) / 10 : null;
  }

  return {
    total: rows.length,
    on_track: rows.filter((r) => r.health_status === 'stable').length,
    at_risk: rows.filter((r) => r.health_status === 'at_risk' || r.health_status === 'needs_attention').length,
    overdue: rows.filter((r) => r.health_status === 'overdue').length,
    ingest_active: rows.filter((r) => r.ingest_status === 'active').length,
    budget_used: budgetUsed,
    margin,
  };
}
