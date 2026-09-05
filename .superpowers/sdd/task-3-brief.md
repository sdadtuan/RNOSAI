### Task 3: Nest module + health / scope / money utils

**Files:**
- Create: `services/ptt-crm-api/src/am/am.types.ts`
- Create: `services/ptt-crm-api/src/am/am-health.util.ts`
- Create: `services/ptt-crm-api/src/am/am-health.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-scope.util.ts`
- Create: `services/ptt-crm-api/src/am/am-scope.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-money.util.ts`
- Create: `services/ptt-crm-api/src/am/am-money.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-freshness.util.ts`
- Create: `services/ptt-crm-api/src/am/am-freshness.util.spec.ts`
- Create: `services/ptt-crm-api/src/am/guards/staff-am.guard.ts`
- Create: `services/ptt-crm-api/src/am/guards/staff-am.guard.spec.ts`
- Create: `services/ptt-crm-api/src/am/am.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — `import { AmModule } from './am/am.module';` then `AmModule` next to `CsdModule`

**Interfaces:**
- Consumes: `StaffAuthService.hasCap`, `StaffOrInternalKeyGuard`
- Produces: types and pure functions below

```ts
export type AmHealthBand = 'healthy' | 'watch' | 'at_risk' | 'critical';
export type AmScope = 'me' | 'team' | 'all';
export type AmAmStatus =
  | 'pending_handover' | 'onboarding' | 'active' | 'at_risk'
  | 'renewing' | 'paused' | 'churned';
export type AmTaskKind =
  | 'task' | 'client_request' | 'issue' | 'escalation' | 'approval' | 'milestone';
export type AmTaskStatus =
  | 'new' | 'in_progress' | 'waiting_client' | 'waiting_internal'
  | 'resolved' | 'closed' | 'cancelled';
export type AmPlanKind = 'care' | 'qbr' | 'renewal' | 'expand';

export const ACTIVE_BOOK: AmAmStatus[] = [
  'onboarding', 'active', 'at_risk', 'renewing', 'paused',
];

export type AmHealthComponents = {
  kpi_delivery: number;
  engagement: number;
  financial: number;
  satisfaction: number;
  contract_support: number;
};

export const DEFAULT_WEIGHTS: AmHealthComponents = {
  kpi_delivery: 30,
  engagement: 20,
  financial: 20,
  satisfaction: 15,
  contract_support: 15,
};

export function bandFromScore(score: number): AmHealthBand {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'at_risk';
  return 'critical';
}

export function weightedScore(
  components: AmHealthComponents,
  weights: AmHealthComponents = DEFAULT_WEIGHTS,
): number {
  const w = weights;
  return (
    (components.kpi_delivery * w.kpi_delivery +
      components.engagement * w.engagement +
      components.financial * w.financial +
      components.satisfaction * w.satisfaction +
      components.contract_support * w.contract_support) / 100
  );
}

export function isActiveBook(status: AmAmStatus): boolean {
  return ACTIVE_BOOK.includes(status);
}

export function resolveAmScope(opts: {
  requested: AmScope | undefined;
  hasViewAll: boolean;
  canTeam: boolean;
}): AmScope {
  const req = opts.requested ?? 'me';
  if (req === 'all' && opts.hasViewAll) return 'all';
  if (req === 'team' && (opts.canTeam || opts.hasViewAll)) return 'team';
  return 'me';
}

export function monthlyRecurringVnd(opts: {
  billingType: string;
  amountVnd: number;
  startsOn: string | null;
  endsOn: string | null;
}): number | null {
  if (opts.billingType === 'media' || opts.billingType === 'media_spend') return null;
  if (opts.billingType === 'project' || opts.billingType === 'one_off') return null;
  if (opts.billingType === 'annual' || opts.billingType === 'yearly') {
    return Math.round(opts.amountVnd / 12);
  }
  return opts.amountVnd;
}

export function formatVnd(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}tr`;
  return `${n.toLocaleString('vi-VN')} VND`;
}
```

`am-scope.util.ts` produces SQL fragment (alias `e` = `crm_am_account_ext`):

```ts
export function amScopeSql(opts: {
  scope: AmScope;
  staffId: number;
  teamIds: number[];
}): { sql: string; params: unknown[] } {
  if (opts.scope === 'all') return { sql: 'TRUE', params: [] };
  if (opts.scope === 'team') {
    if (!opts.teamIds.length) {
      return { sql: 'e.account_owner_staff_id = $staff', params: [opts.staffId] };
    }
    return {
      sql: '(e.team_id = ANY($teams) OR e.account_owner_staff_id = $staff)',
      params: [opts.teamIds, opts.staffId],
    };
  }
  return {
    sql: '(e.account_owner_staff_id = $staff OR EXISTS (SELECT 1 FROM crm_am_tasks t WHERE t.agency_client_id = e.agency_client_id AND t.assignee_staff_id = $staff AND t.status NOT IN (\'closed\',\'cancelled\')))',
    params: [opts.staffId],
  };
}
```

Guard copies `StaffCsdGuard` with section `crm_am` and metadata key `amRequiredAction`. Actions: `view | view_all | edit | assign | manage`. `view` also passes if user has `view_all`. Finance endpoints use section `crm_am.finance`.

- [ ] **Step 1: Write failing specs**

```ts
// am-health.util.spec.ts
expect(bandFromScore(80)).toBe('healthy');
expect(bandFromScore(79)).toBe('watch');
expect(bandFromScore(59)).toBe('at_risk');
expect(bandFromScore(39)).toBe('critical');
expect(weightedScore({
  kpi_delivery: 100, engagement: 100, financial: 100,
  satisfaction: 100, contract_support: 100,
})).toBe(100);
expect(isActiveBook('churned')).toBe(false);
expect(isActiveBook('paused')).toBe(true);

// am-money.util.spec.ts
expect(monthlyRecurringVnd({ billingType: 'media_spend', amountVnd: 50_000_000, startsOn: null, endsOn: null })).toBeNull();
expect(monthlyRecurringVnd({ billingType: 'project', amountVnd: 120_000_000, startsOn: null, endsOn: null })).toBeNull();
expect(monthlyRecurringVnd({ billingType: 'monthly', amountVnd: 20_000_000, startsOn: null, endsOn: null })).toBe(20_000_000);
expect(formatVnd(null)).toBe('—');

// am-scope.util.spec.ts
expect(resolveAmScope({ requested: 'all', hasViewAll: false, canTeam: false })).toBe('me');
expect(resolveAmScope({ requested: 'all', hasViewAll: true, canTeam: true })).toBe('all');
```

Run: `cd services/ptt-crm-api && npx jest src/am/am-health.util.spec.ts src/am/am-scope.util.spec.ts src/am/am-money.util.spec.ts --no-coverage`
Expected: FAIL — files missing.

- [ ] **Step 2: Implement utils + guard + empty `AmModule` + register in `app.module.ts`.**

- [ ] **Step 3: Re-run jest** — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add AmModule with 4-band health, scope, and money rules

EOF
)"
```

---

