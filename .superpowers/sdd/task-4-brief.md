### Task 4: Dashboard API

**Files:**
- Create: `services/ptt-crm-api/src/am/am-dashboard.service.ts`
- Create: `services/ptt-crm-api/src/am/am-dashboard.service.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-audit.repository.ts`
- Create: `services/ptt-crm-api/src/am/am.controller.ts`

**Interfaces:**
- Consumes: `amScopeSql`, `isActiveBook`, `monthlyRecurringVnd`, `bandFromScore`
- Produces: `GET /api/crm/am/command-center?from&to&scope=`

```ts
export type AmCommandCenter = {
  period: { from: string; to: string };
  scope: AmScope;
  freshness: { as_of: string; stale: boolean; work_left_label: string | null };
  role: 'am' | 'director' | 'admin';
  load: { accounts: number; quota: number };
  kpis: {
    active_accounts: number | null;
    mrr_vnd: number | null;
    renewal_90d_vnd: number | null;
    renewal_90d_count: number | null;
    revenue_at_risk_vnd: number | null;
    revenue_at_risk_count: number | null;
    sla_overdue: number | null;
    csat: number | null;
    deltas?: Partial<Record<string, number>>;
  };
  coverage: null | {
    avg_load: number | null;
    unassigned: number;
    delegated: number;
    qbr_this_week: number;
  };
  today_work: Array<{
    id: string;
    due_at: string | null;
    title: string;
    account_name: string;
    sla_label: string | null;
    chip: 'overdue' | 'today' | 'soon' | 'unassigned';
    can_accept: boolean;
  }>;
  attention: Array<{
    agency_client_id: string;
    name: string;
    parent_name: string | null;
    band: AmHealthBand;
    score: number | null;
    mrr_vnd: number | null;
    days_to_end: number | null;
  }>;
  forecast: {
    committed_vnd: number | null;
    likely_vnd: number | null;
    risk_vnd: number | null;
    unlikely_vnd: number | null;
  };
  health_dist: {
    healthy: number;
    watch: number;
    at_risk: number;
    critical: number;
    avg: number | null;
  };
  my_book: Array<{
    agency_client_id: string;
    name: string;
    is_parent: boolean;
    child_count: number;
    owner_label: string;
    package_label: string;
    score: number | null;
    band: AmHealthBand | null;
    mrr_vnd: number | null;
    ends_on: string | null;
    next_action: string | null;
  }>;
};
```

Rules:
- `active_accounts` = clients with ext `am_status IN ACTIVE_BOOK`.
- `mrr_vnd` = Σ `monthlyRecurringVnd` of Active+Renewing contracts in scope. Media/project excluded.
- `renewal_90d_*` = Active contracts with `ends_on ∈ [as_of, as_of+90d]`. Count contracts, not clients.
- `revenue_at_risk_*` = Σ recurring of accounts whose **latest** snapshot band ∈ {at_risk, critical}. Do not add Watch.
- `sla_overdue` = count of CSD tickets `scope_status='in_scope' AND sla_status='breached'` joined to in-scope clients. Missing CSD table → `null`.
- `csat` = `null` in Wave 1.
- Missing previous period → omit `deltas` (do not send `0`).
- `from/to` changes KPI + forecast + health + book. **Does not** change `today_work`.
- `coverage` only when resolved scope is `team` or `all` **and** role is director/admin; else `null`.
- Empty book → every KPI `null`, arrays `[]`. Never `0` for money KPIs.

Controller:

```ts
@Controller('api/crm/am')
@UseGuards(StaffOrInternalKeyGuard, StaffAmGuard)
export class AmController {
  @Get('command-center')
  @RequireAmAction('view')
  commandCenter(@Req() req: AuthedReq, @Query() q: { from?: string; to?: string; scope?: AmScope }) {
    return this.dashboard.get(req, q);
  }
}
```

- [ ] **Step 1: Failing service spec** with an in-memory fixture (no DB):

```ts
it('counts revenue at risk only for at_risk ∪ critical', () => {
  const rows = [
    { band: 'watch', mrr: 100 },
    { band: 'at_risk', mrr: 50 },
    { band: 'critical', mrr: 20 },
    { band: 'healthy', mrr: 80 },
  ];
  const { vnd, count } = sumRevenueAtRisk(rows);
  expect(vnd).toBe(70);
  expect(count).toBe(2);
});

it('returns null KPIs for empty book', () => {
  const kpis = emptyKpis();
  expect(kpis.active_accounts).toBeNull();
  expect(kpis.mrr_vnd).toBeNull();
  expect(kpis.csat).toBeNull();
});
```

Extract `sumRevenueAtRisk` / `emptyKpis` into `am-dashboard.service.ts` (or `am-money.util.ts`) so the spec does not need Postgres.

- [ ] **Step 2: Implement service** — one aggregated SQL + latest-snapshot join. Cache in-process 60s keyed by `staffId|scope|from|to` (NFR-001). On write paths later, drop that key.

- [ ] **Step 3: Wire controller + module providers.**

- [ ] **Step 4: Run jest** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add command-center API with 6 KPIs and 4-band health

EOF
)"
```

---

