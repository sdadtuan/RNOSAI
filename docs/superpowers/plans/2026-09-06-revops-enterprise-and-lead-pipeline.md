# RevOps Enterprise + Lead Pipeline Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Revenue Operations shell (`/crm/revenue-ops/*`) khớp mockup 12 view + 17 modal, và tab **Pipeline bán hàng** trên `/crm/leads/[id]` (sub-mockup L3) — orchestration trên module hiện có, không fork CRM SaaS, không đổi API/DB lead ở Wave 1 Track A.

**Architecture:** Hai track song song. **Track A** chỉ UI merge trên lead detail (reuse `resolveFunnelStepper`, `LeadFunnelPanel` extract). **Track B** thêm Nest module `revops` (aggregate read + SLA/commission mới từ W3) và `RevOpsShell` clone pattern `AmShell`. Business logic Leads / Deal Room / KPI Hub / AM OS giữ nguyên; RevOps = navigation + dashboard + quick actions + native views (SLA, Reports, Settings, Territory, Approvals).

**Tech Stack:** NestJS `ptt-crm-api` · Next.js 14 `ops-web` App Router · PostgreSQL · staff JWT + `staff_section_permissions` · Jest (API) · Vitest + Playwright (ops-web) · CSS `revops-*` / `lead-pipeline-*` · không npm package mới.

**SoT (thứ tự thắng):**

1. [rnosai-revops-enterprise-mockup.html](../../design/rnosai-revops-enterprise-mockup.html) — 12 view, 17 modal
2. [REVOPS-ENT-001 v2.0](../specs/2026-09-05-revops-enterprise-mockup-srs.md)
3. [LEAD-PIPELINE-UI-001 v1.1](../specs/2026-09-05-lead-pipeline-tab-srs.md) + [rnosai-lead-pipeline-tab-mockup.html](../../design/rnosai-lead-pipeline-tab-mockup.html)
4. Code hiện có — reuse trước, fork sau

**Supersedes:** [2026-09-05-revops-enterprise-os.md](./2026-09-05-revops-enterprise-os.md) — plan này khóa Track A đầy đủ + quyết định PO + file/API thật từ codebase 2026-09-06.

## Global Constraints

- UI tiếng Việt. Primary **`#17692f`**. Navy shell **`#0f172a`**. Navy lead **`#0F2747`**. Font Inter / Be Vietnam Pro.
- Feature flag shell: **`NEXT_PUBLIC_REVOPS_SHELL=1`** (`revops-flags.ts`; unset/`'0'` = tắt).
- Feature flag pipeline tab: **`NEXT_PUBLIC_LEAD_PIPELINE_TAB=1`** (`lead-pipeline-flags.ts`; unset/`'0'` = layout cũ 2 card dọc).
- Route map bar: chỉ hiện khi `NODE_ENV=development` hoặc `NEXT_PUBLIC_REVOPS_ROUTE_CATALOG=1`.
- Shell **không** fork logic Leads / Deal / KPI / AM. Aggregate API **read-only** compose từ service hiện có đến hết W2.
- Empty / thiếu dữ liệu → `null` API, **`—`** UI. Không hard-code số mockup (`1,245 tỷ`, `84.65tr`).
- Không portal khách · không multi-tenant · không multi-currency · không AI auto-write routing/commission.
- Không bắt đầu Wave *n* (Track B) cho đến khi Wave *n−1* UAT xanh. Track A **không** bị block bởi Track B.
- Mọi modal: required `*` · validate trước submit · toast sau success.
- Track A Wave 1: **không** thêm endpoint, **không** merge entity `care_pipeline` ↔ `crm_lead_presales`.

---

## 0. Phân tích SoT (khóa trước khi code)

### 0.1. Ba file đính kèm làm gì

| File | Vai trò | Kết luận triển khai |
|---|---|---|
| `rnosai-revops-enterprise-mockup.html` | SoT UI suite: sidebar 4 nhóm, 12 view, 17 modal, mobile 5 tab, `viewRoutes` | Clone chrome + copy; **không** SPA 12-view trong 1 page — mỗi view = route prod |
| `2026-09-05-revops-enterprise-mockup-srs.md` | FR/BR, wave, reuse %, AC W1 | Shell + aggregate; module con giữ logic |
| `2026-09-05-lead-pipeline-tab-srs.md` | Sub-mockup L3: gộp B2 + Pre-sales trên lead detail | Tab mới, flag riêng, **không** nằm trong RevOpsShell |

### 0.2. Hai sản phẩm, một hệ

```text
Director buổi sáng
    → /crm/revenue-ops          Track B Command Center
    → click Leads & Routing     /crm/leads?revops=1
    → click Chăm lead           /crm/leads/[id]?tab=pipeline   Track A
    → Won + handover            /crm/account-management/onboarding
    → Renewal                   /crm/account-management/renewals
```

RevOps **không** embed funnel 5 bước. Lead detail **không** host commission/territory.

### 0.3. Code hiện có (reuse bắt buộc)

| Hiện có | Dùng cho |
|---|---|
| `AmShell.tsx` + `am-nav.util.ts` | Pattern chrome RevOps |
| `KpiHubPageGate` / `kpi-hub-embed` | Pattern embed `?revops=1` (ẩn inner sidebar) |
| `CrmLeadsPageContent.tsx` | Inbox NBV-02 |
| `LeadFunnelPanel.tsx` (~585 dòng) + `#funnel-b2` / `#funnel-presales` | Extract panel Track A |
| `resolveFunnelStepper()` + `PRESALES_FUNNEL_STEPS` | Stepper — **không fork** |
| `createLead` / `assignLead` trong `lib/api.ts` | Modal W1 |
| `GET /api/crm/am/command-center` | Pattern aggregate |
| `KpiHubDashboardService` persona `sales` | Revenue / attainment |
| `kpi-hub/approvals` | Facade Approvals W2 |
| `/crm/account-management/{clients,onboarding,renewals}` | Deep-link NBV-04/05/06 |
| `/crm/kpi-hub/sales` | Deep-link NBV-07 |
| `rbac-admin-catalog.json` `crm_am` | Mirror `crm_revops` |
| `scripts/seed_am_rbac.sh` | Mirror seed (catalog only) |

### 0.4. Gap lớn (không giả vờ đã có)

| Gap | Wave | Ghi chú |
|---|---|---|
| Không có `/crm/revenue-ops` | W1 | Native |
| Commission plan / payout / clawback | W3 | Module mới — critical path |
| SLA incident queue + policy engine | W3 | Leads SLA chỉ ~40% |
| Territory hierarchy + simulate routing | W3 | B2B projects ≠ territory |
| Unified approval queue | W2 | Facade, không thay KPI approvals |
| Lead inbox thiếu ICP/SLA countdown/bulk như mockup | W2 | Delta trên page leads |
| Tab Pipeline chưa tồn tại | Track A | `B2bOverviewTab` chỉ `overview \| consult` |

### 0.5. Quyết định PO (LEAD-PIPELINE-UI-001 §13) — khóa plan

| # | Câu hỏi SRS | Khóa |
|---|---|---|
| 1 | Won: ẩn hay read-only? | **Read-only archive** khi `status === 'won'` hoặc contract active. Default tab = **Hợp đồng & Chốt**. Pipeline vẫn mở để xem lại. |
| 2 | Lost default tab? | **Pipeline bán hàng** (xem lại bước fail). Nhật ký không thay default. |
| 3 | Ẩn `LeadJourneyStepper`? | **Có** — ẩn `LeadNextActionCard` + `LeadJourneyStepper` khi flag on + tab Pipeline visible (tránh 2 stepper). |
| 4 | BANT embed hay link? | Wave 1 = **link** `/crm/intake?lead_id=&service_slug=`. Không embed form. |

### 0.6. Route reconciliation (mockup → prod)

| View mockup | `viewRoutes` mockup | Route prod khóa | Kiểu |
|---|---|---|---|
| Command Center | `/crm/revenue-ops` | `/crm/revenue-ops` | Native |
| Leads & Routing | `/crm/leads` | `/crm/leads?revops=1` | Embed |
| Pipeline & Deal | `/crm/deal-room` | `/crm/revenue-ops/pipeline` | Native W2; card → `/crm/leads/[id]/deal-room` |
| Account 360 | `/crm/account-management` | `/crm/account-management/clients?revops=1` | Deep-link AM |
| Handover | `/crm/leads/handover` | `/crm/account-management/onboarding?revops=1` | Alias W2 |
| Renewal | `/crm/account-management/renewal` | `/crm/account-management/renewals?revops=1` | Plural hiện có |
| KPI & Hoa hồng | `/crm/kpi-hub` | `/crm/kpi-hub/sales?revops=1` | Embed; commission W3 |
| SLA | `/crm/revenue-ops/sla` | `/crm/revenue-ops/sla` | Native W3 |
| Reports | `/crm/revenue-ops/reports` | `/crm/revenue-ops/reports` | Native W4 |
| Territory | `/crm/b2b-projects` | `/crm/revenue-ops/territory` | Native W3 |
| Phê duyệt | `/crm/approvals` | `/crm/revenue-ops/approvals` | Native W2 |
| Settings | `/crm/revenue-ops/settings` | `/crm/revenue-ops/settings` | Native W4 |

**Alias W1:** `/crm/revenue-ops/leads` → `/crm/leads?revops=1` · `/crm/revenue-ops/kpi` → `/crm/kpi-hub/sales?revops=1`.

Query `?revops=1` = embed mode (ẩn inner sidebar module con).

### 0.7. Dependency graph

```text
W0 mockup + SRS (done)
    ├──► Track A (Lead Pipeline Tab) ── song song, không block shell
    ▼
W1 RevOpsShell + Command Center + aggregate + 6 modal
    ▼
W2 Pipeline kanban + Approvals + handover alias + 6 modal W2 + inbox delta
    ▼
W3 SLA + Commission + Territory/Routing + 5 modal W3
    ▼
W4 Reports + Settings + mobile polish + UAT 12 view
```

---

## File map

### Track A — `services/ops-web/src/`

| File | Wave | Việc |
|---|---|---|
| `lib/crm/lead-pipeline-flags.ts` | A1 | `isLeadPipelineTabEnabled()` |
| `lib/crm/lead-pipeline-tab.util.ts` | A2 | Hash → tab/step; default tab |
| `lib/crm/lead-pipeline-tab.util.spec.ts` | A2 | AC hash + spa + won |
| `components/crm/LeadPipelineSlaStrip.tsx` | A5 | SLA 1 dòng |
| `components/crm/LeadPipelineStepPanel.tsx` | A3 | Router 5 panel |
| `components/crm/LeadPipelineB2Panel.tsx` | A3 | Extract `#funnel-b2` |
| `components/crm/LeadPipelinePresalesPanel.tsx` | A3 | Extract `#funnel-presales` theo stage |
| `components/crm/LeadPipelineIntakePanel.tsx` | A3 | Summary + CTA intake |
| `components/crm/LeadPipelineDoneAccordion.tsx` | A3 | Bước đã xong |
| `components/crm/LeadSalesPipelineTab.tsx` | A3 | Tab workspace |
| `components/crm/LeadContractTab.tsx` | A4 | Deal Room banner + `LeadContractPanel` |
| `components/LeadFunnelPanel.tsx` | A3 | Thin wrapper khi flag off |
| `app/crm/leads/[id]/page.tsx` | A4 | Tab state, default, hash |
| `lib/crm/lead-contract-ready.ts` | A4 | `readinessCheckHref` → `?tab=pipeline&step=` |
| `app/globals.css` | A5 | `.lead-pipeline-*` |
| `e2e/lead-pipeline-tab.spec.ts` | A6 | AC-TAB-001…006 |

### Track B backend — `services/ptt-crm-api/src/revops/`

| File | Wave |
|---|---|
| `revops.types.ts` | 1 |
| `revops-scope.util.ts` | 1 |
| `revops-dashboard.service.ts` | 1 |
| `revops-actions.service.ts` | 1 |
| `revops-team-performance.service.ts` | 1 |
| `guards/staff-revops.guard.ts` | 1 |
| `revops.controller.ts` | 1+ |
| `revops.module.ts` | 1 |
| `revops-approvals.service.ts` | 2 |
| `revops-pipeline.service.ts` | 2 |
| `revops-sla.service.ts` + `revops-sla.worker.ts` | 3 |
| `commission/*` | 3 |
| `routing/*` | 3 |
| `revops-reports.service.ts` | 4 |
| `revops-settings.service.ts` | 4 |

**API prefix:** `/api/crm/revops/*`

**DDL W3:** `docs/specs/2026-09-05-postgresql-ddl-revops-w3.sql`

### Track B frontend — `services/ops-web/src/`

| File | Wave |
|---|---|
| `lib/crm/revops-flags.ts` | 1 |
| `lib/crm/revops-nav.util.ts` | 1 |
| `lib/crm/revops-api.ts` | 1 |
| `lib/crm/revops-format.ts` | 1 |
| `components/crm/revops/RevOpsShell.tsx` | 1 |
| `components/crm/revops/RevOpsRouteCatalog.tsx` | 1 |
| `components/crm/revops/RevOpsEmbedFrame.tsx` | 1 |
| `components/crm/revops/RevOpsCommandCenter.tsx` | 1 |
| `components/crm/revops/RevOpsQuickCreateModal.tsx` | 1 |
| `components/crm/revops/modals/RevOpsLeadModal.tsx` | 1 |
| `components/crm/revops/modals/RevOpsAssignModal.tsx` | 1 |
| `components/crm/revops/modals/RevOpsDuplicateModal.tsx` | 1 |
| `components/crm/revops/modals/RevOpsDealModal.tsx` | 1 |
| `components/crm/revops/modals/RevOpsQuoteModal.tsx` | 1 |
| `app/crm/revenue-ops/layout.tsx` | 1 |
| `app/crm/revenue-ops/page.tsx` | 1 |
| `app/crm/revenue-ops/revops.css` | 1 |
| `app/crm/revenue-ops/leads/page.tsx` | 1 alias |
| `app/crm/revenue-ops/kpi/page.tsx` | 1 alias |
| `RevOpsPipelinePage.tsx` + `pipeline/page.tsx` | 2 |
| `RevOpsApprovalsPage.tsx` + `approvals/page.tsx` | 2 |
| `modals/RevOpsApprovalModal.tsx` … `RevOpsKpiModal.tsx` | 2 |
| `app/crm/leads/handover/page.tsx` | 2 redirect |
| `RevOpsSlaPage.tsx` + `RevOpsTerritoryPage.tsx` + 5 modal W3 | 3 |
| `RevOpsReportsPage.tsx` + `RevOpsSettingsPage.tsx` | 4 |

### Shared

| File | Việc |
|---|---|
| `services/ptt-crm-api/src/app.module.ts` | `RevopsModule` |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | `crm_revops` + `crm_revops.commission` |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/revenue-ops` |
| `services/ops-web/src/components/OpsNav.tsx` | Link Revenue Operations |
| `deploy/runtime.env.example` | Hai flag default `0` |
| `scripts/seed_revops_rbac.sh` | Catalog only — mirror `seed_am_rbac.sh` |

---

## RBAC (khóa W1)

| Cap | Actions | Persona |
|---|---|---|
| `crm_revops` | `view` | Sales, AE |
| `crm_revops` | `view_team` | Team Lead |
| `crm_revops` | `view_all` | Sales Director, RevOps |
| `crm_revops` | `manage` | Admin — settings, routing publish |
| `crm_revops.commission` | `view` / `manage` | Finance — payout W3 |

Embed actions reuse cap module con (`crm_leads.edit` tạo lead, `crm_am.edit` tạo account).

---

# TRACK A — Lead Pipeline Tab (L3)

**SRS:** LEAD-PIPELINE-UI-001 · **Không block Track B.** · Effort 3–5 ngày.

**UAT:** AC-TAB-001…006 + e2e `lead-pipeline-tab.spec.ts`.

---

### Task A1: Feature flag pipeline tab

**Files:**
- Create: `services/ops-web/src/lib/crm/lead-pipeline-flags.ts`
- Create: `services/ops-web/src/lib/crm/lead-pipeline-flags.spec.ts`
- Modify: `deploy/runtime.env.example`

**Interfaces:**
- Produces: `isLeadPipelineTabEnabled(): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// services/ops-web/src/lib/crm/lead-pipeline-flags.spec.ts
import { afterEach, describe, expect, it } from 'vitest';
import { isLeadPipelineTabEnabled } from './lead-pipeline-flags';

describe('lead-pipeline-flags', () => {
  const prev = process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB;
  afterEach(() => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = prev;
  });

  it('returns false when unset', () => {
    delete process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB;
    expect(isLeadPipelineTabEnabled()).toBe(false);
  });

  it('returns false when 0', () => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = '0';
    expect(isLeadPipelineTabEnabled()).toBe(false);
  });

  it('returns true when 1', () => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = '1';
    expect(isLeadPipelineTabEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-pipeline-flags.spec.ts`
Expected: FAIL module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// services/ops-web/src/lib/crm/lead-pipeline-flags.ts
export function isLeadPipelineTabEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB === '1';
}
```

Thêm vào `deploy/runtime.env.example`:

```bash
NEXT_PUBLIC_LEAD_PIPELINE_TAB=0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-pipeline-flags.spec.ts`
Expected: PASS 3 tests

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-pipeline-flags.ts \
  services/ops-web/src/lib/crm/lead-pipeline-flags.spec.ts \
  deploy/runtime.env.example
git commit -m "feat(leads): add Pipeline tab feature flag"
```

---

### Task A2: Hash / default-tab helpers

**Files:**
- Create: `services/ops-web/src/lib/crm/lead-pipeline-tab.util.ts`
- Create: `services/ops-web/src/lib/crm/lead-pipeline-tab.util.spec.ts`

**Interfaces:**
- Consumes: `PresalesFunnelStepKey` từ `funnel-stepper.types.ts`; `LeadFlowKind` từ `lead-flow-kind.ts`; `showPresalesForFlow`
- Produces:
  - `LeadWorkspaceDesktopTab = 'pipeline' | 'contract' | 'consult' | 'lmp'`
  - `mapLegacyHashToPipeline(hash: string, presalesStage?: string | null): { tab: 'pipeline'; step: PresalesFunnelStepKey } | null`
  - `defaultLeadWorkspaceTab(input): LeadWorkspaceDesktopTab`
  - `shouldShowPipelineTab(flowKind: LeadFlowKind): boolean`
  - `pipelineStepQuery(step: PresalesFunnelStepKey): string` → `?tab=pipeline&step=b2`

```typescript
export type LeadWorkspaceDesktopTab = 'pipeline' | 'contract' | 'consult' | 'lmp';

export type PipelineTabDefaultInput = {
  flowKind: 'spa_operational' | 'b2b_prospect';
  status: string;
  contractActive: boolean;
  hash: string;
  searchTab: string | null;
  showConsult: boolean;
  showLmp: boolean;
};
```

- [ ] **Step 1: Write the failing test**

```typescript
// services/ops-web/src/lib/crm/lead-pipeline-tab.util.spec.ts
import { describe, expect, it } from 'vitest';
import {
  defaultLeadWorkspaceTab,
  mapLegacyHashToPipeline,
  pipelineStepQuery,
  shouldShowPipelineTab,
} from './lead-pipeline-tab.util';

describe('shouldShowPipelineTab', () => {
  it('hides for spa_operational', () => {
    expect(shouldShowPipelineTab('spa_operational')).toBe(false);
  });
  it('shows for b2b_prospect', () => {
    expect(shouldShowPipelineTab('b2b_prospect')).toBe(true);
  });
});

describe('mapLegacyHashToPipeline', () => {
  it('maps #funnel-b2 to b2', () => {
    expect(mapLegacyHashToPipeline('#funnel-b2')).toEqual({ tab: 'pipeline', step: 'b2' });
  });
  it('maps #funnel-presales without stage to presales_lead', () => {
    expect(mapLegacyHashToPipeline('#funnel-presales')).toEqual({
      tab: 'pipeline',
      step: 'presales_lead',
    });
  });
  it('maps #funnel-presales after intake complete (consult stage) to consult', () => {
    expect(mapLegacyHashToPipeline('#funnel-presales', 'consult')).toEqual({
      tab: 'pipeline',
      step: 'consult',
    });
  });
  it('maps #funnel-presales-r5 proposal stage to proposal', () => {
    expect(mapLegacyHashToPipeline('#funnel-presales-r5', 'proposal')).toEqual({
      tab: 'pipeline',
      step: 'proposal',
    });
  });
  it('returns null for empty hash', () => {
    expect(mapLegacyHashToPipeline('')).toBeNull();
  });
});

describe('defaultLeadWorkspaceTab', () => {
  const base = {
    flowKind: 'b2b_prospect' as const,
    status: 'moi',
    contractActive: false,
    hash: '',
    searchTab: null,
    showConsult: false,
    showLmp: false,
  };

  it('defaults B2B to pipeline', () => {
    expect(defaultLeadWorkspaceTab(base)).toBe('pipeline');
  });
  it('defaults won+contract to contract', () => {
    expect(
      defaultLeadWorkspaceTab({ ...base, status: 'won', contractActive: true }),
    ).toBe('contract');
  });
  it('defaults lost to pipeline', () => {
    expect(defaultLeadWorkspaceTab({ ...base, status: 'lost' })).toBe('pipeline');
  });
  it('honors ?tab=consult when consult visible', () => {
    expect(
      defaultLeadWorkspaceTab({ ...base, searchTab: 'consult', showConsult: true }),
    ).toBe('consult');
  });
  it('maps legacy hash over default', () => {
    expect(defaultLeadWorkspaceTab({ ...base, hash: '#funnel-b2' })).toBe('pipeline');
  });
});

describe('pipelineStepQuery', () => {
  it('builds query for readiness links', () => {
    expect(pipelineStepQuery('b2')).toBe('?tab=pipeline&step=b2');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-pipeline-tab.util.spec.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement**

```typescript
// services/ops-web/src/lib/crm/lead-pipeline-tab.util.ts
import { showPresalesForFlow, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';
import type { PresalesFunnelStepKey } from '@/lib/crm/funnel-stepper.types';

export type LeadWorkspaceDesktopTab = 'pipeline' | 'contract' | 'consult' | 'lmp';

export type PipelineTabDefaultInput = {
  flowKind: LeadFlowKind;
  status: string;
  contractActive: boolean;
  hash: string;
  searchTab: string | null;
  showConsult: boolean;
  showLmp: boolean;
};

export function shouldShowPipelineTab(flowKind: LeadFlowKind): boolean {
  return showPresalesForFlow(flowKind);
}

export function pipelineStepQuery(step: PresalesFunnelStepKey): string {
  return `?tab=pipeline&step=${step}`;
}

export function mapLegacyHashToPipeline(
  hash: string,
  presalesStage?: string | null,
): { tab: 'pipeline'; step: PresalesFunnelStepKey } | null {
  const h = hash.startsWith('#') ? hash : hash ? `#${hash}` : '';
  if (h === '#funnel-b2') return { tab: 'pipeline', step: 'b2' };
  if (h === '#funnel-presales') {
    if (presalesStage === 'consult' || presalesStage === 'proposal') {
      return { tab: 'pipeline', step: presalesStage };
    }
    return { tab: 'pipeline', step: 'presales_lead' };
  }
  if (h === '#funnel-presales-r5') {
    return {
      tab: 'pipeline',
      step: presalesStage === 'proposal' ? 'proposal' : 'consult',
    };
  }
  return null;
}

const TABS: LeadWorkspaceDesktopTab[] = ['pipeline', 'contract', 'consult', 'lmp'];

export function defaultLeadWorkspaceTab(input: PipelineTabDefaultInput): LeadWorkspaceDesktopTab {
  const fromHash = mapLegacyHashToPipeline(input.hash);
  if (fromHash) return fromHash.tab;

  const requested = TABS.find((t) => t === input.searchTab);
  if (requested === 'consult' && input.showConsult) return 'consult';
  if (requested === 'lmp' && input.showLmp) return 'lmp';
  if (requested === 'contract') return 'contract';
  if (requested === 'pipeline' && shouldShowPipelineTab(input.flowKind)) return 'pipeline';

  if (!shouldShowPipelineTab(input.flowKind)) return 'contract';
  if (input.status === 'won' && input.contractActive) return 'contract';
  return 'pipeline';
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-pipeline-tab.util.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/lead-pipeline-tab.util.ts \
  services/ops-web/src/lib/crm/lead-pipeline-tab.util.spec.ts
git commit -m "feat(leads): map legacy funnel hashes to Pipeline tab"
```

---

### Task A3: Step panel router + extract from LeadFunnelPanel

**Files:**
- Create: `services/ops-web/src/components/crm/LeadPipelineStepPanel.tsx`
- Create: `services/ops-web/src/components/crm/LeadPipelineB2Panel.tsx`
- Create: `services/ops-web/src/components/crm/LeadPipelinePresalesPanel.tsx`
- Create: `services/ops-web/src/components/crm/LeadPipelineIntakePanel.tsx`
- Create: `services/ops-web/src/components/crm/LeadPipelineDoneAccordion.tsx`
- Create: `services/ops-web/src/components/crm/LeadSalesPipelineTab.tsx`
- Modify: `services/ops-web/src/components/LeadFunnelPanel.tsx` — khi nhận `layout="legacy"` giữ UI cũ; extract JSX `#funnel-b2` / `#funnel-presales` sang panel files (re-export handlers, **không** đổi API calls)

**Interfaces:**
- Consumes: cùng props `LeadFunnelPanel` hiện có (`token`, `leadId`, `user`, `syncFunnel`, `onFunnelChange`, `hideM1Card`, …) + `FunnelStepperViewModel`
- Produces: `LeadSalesPipelineTab` nhận `activeStepKey`, `onStepChange`, `stepperVm`, `onFunnelPrimaryAction`

```typescript
export type LeadPipelineStepPanelProps = {
  activeStepKey: PresalesFunnelStepKey;
  stepState: FunnelStepState;
  token: string;
  leadId: number;
  user: StoredStaffUser | null;
  funnel: LeadFunnelSnapshot;
  hideM1Card: boolean;
  onOpenConsultTab?: () => void;
  onMessage: (msg: string) => void;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onFunnelUpdated: () => void;
};
```

- [ ] **Step 1: Write unit test cho panel router (không mount full funnel)**

```typescript
// services/ops-web/src/lib/crm/lead-pipeline-step-panel.util.spec.ts
import { describe, expect, it } from 'vitest';
import { resolvePipelinePanelMode } from './lead-pipeline-step-panel.util';

describe('resolvePipelinePanelMode', () => {
  it('shows placeholder for pending far-ahead steps', () => {
    expect(resolvePipelinePanelMode('proposal', 'pending')).toBe('blocked_ahead');
  });
  it('shows live panel for current', () => {
    expect(resolvePipelinePanelMode('b2', 'current')).toBe('live');
  });
  it('shows live panel for done (review)', () => {
    expect(resolvePipelinePanelMode('b2', 'done')).toBe('live');
  });
  it('shows review banner mode when blocked+review', () => {
    expect(resolvePipelinePanelMode('presales_lead', 'blocked', true)).toBe('review');
  });
});
```

```typescript
// services/ops-web/src/lib/crm/lead-pipeline-step-panel.util.ts
import type { FunnelStepState, PresalesFunnelStepKey } from '@/lib/crm/funnel-stepper.types';

export type PipelinePanelMode = 'live' | 'blocked_ahead' | 'review';

export function resolvePipelinePanelMode(
  _key: PresalesFunnelStepKey,
  state: FunnelStepState,
  inReview = false,
): PipelinePanelMode {
  if (inReview) return 'review';
  if (state === 'pending') return 'blocked_ahead';
  return 'live';
}
```

- [ ] **Step 2: Run vitest — FAIL then implement util — PASS**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-pipeline-step-panel.util.spec.ts`

- [ ] **Step 3: Extract B2 block** — cắt JSX `id="funnel-b2"` từ `LeadFunnelPanel.tsx` (outcome card, care report, complete, M1 nếu `!hideM1Card`) sang `LeadPipelineB2Panel.tsx`. `LeadFunnelPanel` import lại panel này trong nhánh legacy.

- [ ] **Step 4: Extract Presales block** — JSX `id="funnel-presales"` (ensure service, `PresalesTaskFormCard` theo stage, handoff banners, R5, proposal gate, Deal Room link) sang `LeadPipelinePresalesPanel.tsx` với prop `stage: 'lead' | 'consult' | 'proposal'`.

- [ ] **Step 5: Intake panel** — không gọi API mới. Render `intakeSummary` (từ stepper input đã có trên page) + CTA:

```tsx
<Link href={`/crm/intake?lead_id=${leadId}&service_slug=${slug}`} className="btn btn-primary">
  Mở khảo sát BANT
</Link>
```

Draft badge khi `intakeSummary.has_draft`.

- [ ] **Step 6: `LeadSalesPipelineTab`**

```tsx
// Cấu trúc bắt buộc — class lead-pipeline-*
<div className="lead-pipeline-tab" role="tabpanel" id="lead-pipeline-panel">
  <LeadPipelineSlaStrip ... />           {/* Task A5 — stub empty div ở A3 */}
  <div className="lead-pipeline-tab__head">
    <CrmFunnelStepper ... showTitle={false} onStepClick={onStepChange} />
    <CrmFunnelStepGateStrip ... />
    <CrmFunnelStepPrimaryAction action={stepperVm.primaryAction} onAction={onFunnelPrimaryAction} />
  </div>
  <LeadPipelineStepPanel activeStepKey={activeStepKey} ... />
  <LeadPipelineDoneAccordion steps={doneSteps} onReview={(key) => onStepChange(key)} />
</div>
```

`LeadPipelineStepPanel`: `b2` → B2 panel; `presales_lead` → Presales `stage=lead`; `intake_bant` → Intake; `consult` → Presales `stage=consult` + CTA “Mở tab Tư vấn đầy đủ”; `proposal` → Presales `stage=proposal`.

Placeholder `blocked_ahead`: copy “Hoàn thành các bước trước.”

Review: tái sử dụng banner + `releaseLeadReviewQueue` từ `LeadFunnelPanel`.

- [ ] **Step 7: `LeadFunnelPanel` legacy** — nếu page không dùng tab mới, render cả B2 + Presales dọc như cũ (gọi cùng panel components). **Không** thêm request: `fetchOnMount={funnelSnap == null}`.

- [ ] **Step 8: Commit**

```bash
git add services/ops-web/src/components/crm/LeadPipeline*.tsx \
  services/ops-web/src/components/crm/LeadSalesPipelineTab.tsx \
  services/ops-web/src/components/LeadFunnelPanel.tsx \
  services/ops-web/src/lib/crm/lead-pipeline-step-panel.util.ts \
  services/ops-web/src/lib/crm/lead-pipeline-step-panel.util.spec.ts
git commit -m "feat(leads): extract Pipeline step panels from LeadFunnelPanel"
```

---

### Task A4: Wire tab bar trên lead detail page

**Files:**
- Modify: `services/ops-web/src/app/crm/leads/[id]/page.tsx` (types ~L110–111, state ~L200, hash effects ~L324/358/431, render ~L1087–1219)
- Create: `services/ops-web/src/components/crm/LeadContractTab.tsx`
- Modify: `services/ops-web/src/lib/crm/lead-contract-ready.ts` + `.spec.ts`

**Interfaces:**
- Consumes: `isLeadPipelineTabEnabled`, `defaultLeadWorkspaceTab`, `mapLegacyHashToPipeline`, `shouldShowPipelineTab`, `pipelineStepQuery`
- Đổi `B2bOverviewTab = 'overview' | 'consult'` → khi flag on dùng `LeadWorkspaceDesktopTab`

- [ ] **Step 1: Update `readinessCheckHref` tests**

```typescript
// thêm vào lead-contract-ready.spec.ts
it('points B2/presales at pipeline query when helper used', () => {
  expect(readinessCheckHref('b2_complete', 5)).toBe('/crm/leads/5?tab=pipeline&step=b2');
  expect(readinessCheckHref('presales_active', 5)).toBe('/crm/leads/5?tab=pipeline&step=consult');
  expect(readinessCheckHref('presales_consult', 5)).toBe('/crm/leads/5?tab=pipeline&step=consult');
});
```

Giữ hash-only **chỉ khi** `isLeadPipelineTabEnabled()` false:

```typescript
export function readinessCheckHref(key: string, leadId: number): string | null {
  const pipelineOn = process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB === '1';
  switch (key) {
    case 'b2_complete':
      return pipelineOn ? `/crm/leads/${leadId}?tab=pipeline&step=b2` : '#funnel-b2';
    case 'presales_active':
    case 'presales_consult':
      return pipelineOn ? `/crm/leads/${leadId}?tab=pipeline&step=consult` : '#funnel-presales';
    // các case còn lại giữ nguyên
  }
}
```

- [ ] **Step 2: Run** `npx vitest run src/lib/crm/lead-contract-ready.spec.ts` — FAIL rồi PASS sau sửa.

- [ ] **Step 3: Tab state trên page**

```typescript
const pipelineTabOn = isLeadPipelineTabEnabled();
const showPipelineTab =
  pipelineTabOn && shouldShowPipelineTab(leadFlowKind) && hasCap(user, 'crm_leads', 'view');

const [desktopTab, setDesktopTab] = useState<LeadWorkspaceDesktopTab>('pipeline');
const [pipelineStep, setPipelineStep] = useState<PresalesFunnelStepKey>('b2');

useEffect(() => {
  if (!showPipelineTab) return;
  const mapped = mapLegacyHashToPipeline(window.location.hash, funnelPresalesStage(funnelSnap));
  const tab = defaultLeadWorkspaceTab({
    flowKind: leadFlowKind,
    status,
    contractActive: Boolean(contractSummary?.hasContract && contractSummary.contractStatus === 'active'),
    hash: window.location.hash,
    searchTab: searchParams.get('tab'),
    showConsult: showConsultTab,
    showLmp: showLmpTab,
  });
  setDesktopTab(tab);
  const stepFromQuery = searchParams.get('step') as PresalesFunnelStepKey | null;
  if (mapped) setPipelineStep(mapped.step);
  else if (stepFromQuery) setPipelineStep(stepFromQuery);
}, [showPipelineTab, leadId, funnelSnap, status, contractSummary, searchParams, showConsultTab, showLmpTab]);
```

Xóa / no-op `scrollIntoView` `#funnel-b2` / `#funnel-presales` khi `showPipelineTab`.

- [ ] **Step 4: Desktop tab bar (≥1280)** — khi `showPipelineTab`:

```tsx
<div className="lead-pipeline-tabs" role="tablist">
  <button role="tab" aria-selected={desktopTab === 'pipeline'} onClick={() => setDesktopTab('pipeline')}>
    Pipeline bán hàng
  </button>
  <button role="tab" aria-selected={desktopTab === 'contract'} onClick={() => setDesktopTab('contract')}>
    Hợp đồng & Chốt
  </button>
  {showConsultTab ? (
    <button role="tab" aria-selected={desktopTab === 'consult'} onClick={openConsultTab}>Tư vấn</button>
  ) : null}
  {showLmpTab ? (
    <button role="tab" aria-selected={desktopTab === 'lmp'} onClick={openMeetingPrepTab}>Sales Cockpit</button>
  ) : null}
</div>
```

Khi `desktopTab === 'pipeline'`: render `LeadSalesPipelineTab` thay `LeadFunnelPanel` + **không** render `LeadContractPanel` trong cùng pane.

Khi `desktopTab === 'contract'`: `LeadContractTab` = Deal Room banner + `LeadContractPanel`.

Khi flag off: giữ `LeadFunnelPanel` + `LeadContractPanel` dọc.

- [ ] **Step 5: Ẩn journey + full SLA** — `showPipelineTab` → không render `LeadNextActionCard` / `LeadJourneyStepper`; `LeadSlaCarePanel` full-width chỉ khi `!showPipelineTab` (strip ở A5).

- [ ] **Step 6: Won read-only** — truyền `readOnly={status === 'won' || Boolean(contractSummary?.hasContract)}` vào `LeadSalesPipelineTab` (disable primary action + forms; accordion xem lại vẫn mở).

- [ ] **Step 7: Mobile** — trong tab “Việc” (`LeadDetailTab === 'detail'`), thay funnel dài bằng `LeadSalesPipelineTab` khi `showPipelineTab`. Stepper `overflow-x: auto`; primary action `width: 100%`.

- [ ] **Step 8: Commit**

```bash
git add services/ops-web/src/app/crm/leads/[id]/page.tsx \
  services/ops-web/src/components/crm/LeadContractTab.tsx \
  services/ops-web/src/lib/crm/lead-contract-ready.ts \
  services/ops-web/src/lib/crm/lead-contract-ready.spec.ts
git commit -m "feat(leads): add Pipeline and Contract desktop tabs"
```

---

### Task A5: SLA strip + CSS

**Files:**
- Create: `services/ops-web/src/components/crm/LeadPipelineSlaStrip.tsx`
- Modify: `services/ops-web/src/app/globals.css` (cuối file, block `.lead-pipeline-*`)
- Modify: `LeadSalesPipelineTab.tsx` — thay stub bằng strip

**Interfaces:**
- Consumes: `LeadCopilotContext` / SLA fields đã load trên page (`copilotContext`) — **0 API call mới**
- Produces: pill `ok | warning | breach`, countdown, nút “Chi tiết SLA” toggle `<details>`

```tsx
export function LeadPipelineSlaStrip(props: {
  worstLabel: string;
  countdown: string | null;
  state: 'ok' | 'warning' | 'breach';
  detail?: ReactNode;
}) {
  return (
    <div className="lead-pipeline-sla">
      <span className={`lead-pipeline-sla__pill is-${props.state}`}>{props.worstLabel}</span>
      {props.countdown ? <span className="lead-pipeline-sla__clock">{props.countdown}</span> : null}
      <details className="lead-pipeline-sla__detail">
        <summary>Chi tiết SLA</summary>
        {props.detail}
      </details>
    </div>
  );
}
```

CSS tối thiểu (token SRS Q10):

```css
.lead-pipeline-tab { background: #fff; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; }
.lead-pipeline-tab__head { position: sticky; top: var(--ops-chrome-h, 56px); z-index: 20; background: #fff; padding: 12px 14px; border-bottom: 1px solid #e5e7eb; }
.lead-pipeline-tabs { display: flex; gap: 4px; background: #fff; border: 1px solid #e5e7eb; border-bottom: none; border-radius: 12px 12px 0 0; padding: 8px 10px 0; }
.lead-pipeline-tabs [role="tab"][aria-selected="true"] { color: #17692f; border-bottom: 2px solid #17692f; }
.lead-pipeline-sla { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
.lead-pipeline-sla__pill.is-ok { background: #ecfdf5; color: #15803d; }
.lead-pipeline-sla__pill.is-warning { background: #fef3c7; color: #b45309; }
.lead-pipeline-sla__pill.is-breach { background: #fee2e2; color: #b91c1c; }
@media (max-width: 760px) {
  .lead-pipeline-tab__primary { width: 100%; }
}
```

- [ ] **Step 1: Wire strip từ `copilotContext` SLA đã có trên page** (cùng nguồn `LeadSlaCarePanel`).
- [ ] **Step 2: Visual check vs** `docs/design/rnosai-lead-pipeline-tab-mockup.html` (SLA strip + stepper).
- [ ] **Step 3: Commit** `feat(leads): add compact SLA strip on Pipeline tab`

---

### Task A6: Playwright AC + inbox CTA hook

**Files:**
- Create: `services/ops-web/e2e/lead-pipeline-tab.spec.ts`
- Modify: `services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx` — nút/link “Chăm lead” → `/crm/leads/${id}?tab=pipeline` khi flag on

- [ ] **Step 1: E2E** (skip nếu `NEXT_PUBLIC_LEAD_PIPELINE_TAB !== '1'` hoặc login fail — cùng pattern `kpi-hub.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('Lead Pipeline tab', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'API down');
    test.skip(process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB !== '1', 'flag off');
    await loginAsStaff(page);
  });

  test('AC-TAB-001 default tab B2B', async ({ page }) => {
    await page.goto('/crm/leads');
    await page.getByRole('link', { name: /Chăm lead|Mở/ }).first().click();
    await expect(page.getByRole('tab', { name: 'Pipeline bán hàng' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#funnel-presales')).toHaveCount(0);
  });

  test('AC-TAB-004 hash b2', async ({ page }) => {
    await page.goto('/crm/leads');
    const href = await page.locator('a[href*="/crm/leads/"]').first().getAttribute('href');
    test.skip(!href, 'no lead');
    await page.goto(`${href}#funnel-b2`);
    await expect(page.getByRole('tab', { name: 'Pipeline bán hàng' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Liên hệ').first()).toBeVisible();
  });

  test('AC-TAB-006 contract tab', async ({ page }) => {
    await page.goto('/crm/leads');
    const href = await page.locator('a[href*="/crm/leads/"]').first().getAttribute('href');
    test.skip(!href, 'no lead');
    await page.goto(href!);
    await page.getByRole('tab', { name: 'Hợp đồng & Chốt' }).click();
    await expect(page.locator('#lead-contract-amount, .lead-contract, .deal-room-entry-banner').first()).toBeVisible();
  });
});
```

Manual (cùng PR): AC-TAB-002 gate B2, AC-TAB-003 intake redirect, AC-TAB-005 spa — ghi trong PR body nếu không có fixture lead.

- [ ] **Step 2: Run** `cd services/ops-web && npx playwright test e2e/lead-pipeline-tab.spec.ts`
Expected: skip sạch khi flag off; pass khi flag on + có lead B2B.

- [ ] **Step 3: Commit** `test(leads): add Pipeline tab e2e and inbox CTA`

---

# TRACK B — WAVE 1 — RevOpsShell + Command Center

**Deliverable:** Director mở `/crm/revenue-ops` thấy Command Center thật; sidebar 12 mục; 6 modal W1; deep-link Leads/KPI; flag rollout.

**UAT:** SRS §10.2 + `e2e/revops-shell-w1.spec.ts`.

---

### Task B1: Feature flag + RBAC catalog

**Files:**
- Create: `services/ops-web/src/lib/crm/revops-flags.ts`
- Create: `services/ops-web/src/lib/crm/revops-flags.spec.ts`
- Modify: `deploy/runtime.env.example`
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Create: `scripts/seed_revops_rbac.sh`

**Interfaces:**
- Produces: `isRevopsShellEnabled()`, `isRevopsRouteCatalogEnabled()`

- [ ] **Step 1: Failing test**

```typescript
import { afterEach, describe, expect, it } from 'vitest';
import { isRevopsRouteCatalogEnabled, isRevopsShellEnabled } from './revops-flags';

describe('revops-flags', () => {
  const prevShell = process.env.NEXT_PUBLIC_REVOPS_SHELL;
  const prevCat = process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG;
  afterEach(() => {
    process.env.NEXT_PUBLIC_REVOPS_SHELL = prevShell;
    process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG = prevCat;
  });
  it('shell false when unset', () => {
    delete process.env.NEXT_PUBLIC_REVOPS_SHELL;
    expect(isRevopsShellEnabled()).toBe(false);
  });
  it('shell true when 1', () => {
    process.env.NEXT_PUBLIC_REVOPS_SHELL = '1';
    expect(isRevopsShellEnabled()).toBe(true);
  });
  it('catalog true in development', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG;
    expect(isRevopsRouteCatalogEnabled()).toBe(true);
    process.env.NODE_ENV = prevEnv;
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/crm/revops-flags.spec.ts` — FAIL

- [ ] **Step 3: Implement**

```typescript
export function isRevopsShellEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REVOPS_SHELL === '1';
}
export function isRevopsRouteCatalogEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_REVOPS_ROUTE_CATALOG === '1'
  );
}
```

`runtime.env.example`:

```bash
NEXT_PUBLIC_REVOPS_SHELL=0
NEXT_PUBLIC_REVOPS_ROUTE_CATALOG=0
```

`rbac-admin-catalog.json` — thêm vào object actions (cạnh `crm_am`):

```json
"crm_revops": ["view", "view_team", "view_all", "manage"],
"crm_revops.commission": ["view", "manage"]
```

Và catalog item:

```json
{
  "id": "crm_revops",
  "label": "Revenue Operations",
  "group": "CRM",
  "page": "/crm/revenue-ops",
  "description": "RevOps shell: command center, SLA, reports, territory, approvals."
}
```

`scripts/seed_revops_rbac.sh` — copy `seed_am_rbac.sh` (echo catalog only, `exit 0`).

- [ ] **Step 4: Vitest PASS**
- [ ] **Step 5: Commit** `feat(revops): add feature flag and RBAC catalog`

---

### Task B2: Nav config + active href

**Files:**
- Create: `services/ops-web/src/lib/crm/revops-nav.util.ts`
- Create: `services/ops-web/src/lib/crm/revops-nav.util.spec.ts`

**Interfaces:**
- Produces: `REVOPS_NAV_GROUPS`, `activeRevopsHref(pathname: string): string`, `canSeeRevopsNav(user)`, `REVOPS_MOBILE_NAV` (5 item FR-SHELL-05)

- [ ] **Step 1: Failing test** — 12 items, 4 groups, paths = bảng §0.6, `canSeeRevopsNav` fail-closed như `am-nav.util.spec.ts`

```typescript
import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import {
  REVOPS_MOBILE_NAV,
  REVOPS_NAV_GROUPS,
  activeRevopsHref,
  canSeeRevopsNav,
} from './revops-nav.util';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return { id: '1', email: 'u@pttads.vn', display_name: 'Test', position_id: 2, caps };
}

describe('REVOPS_NAV_GROUPS', () => {
  const items = REVOPS_NAV_GROUPS.flatMap((g) => g.items);
  it('has 4 groups and 12 items', () => {
    expect(REVOPS_NAV_GROUPS.map((g) => g.title)).toEqual([
      'TỔNG QUAN',
      'DOANH THU',
      'HIỆU SUẤT',
      'QUẢN TRỊ',
    ]);
    expect(items).toHaveLength(12);
  });
  it('locks prod hrefs', () => {
    expect(items.map((i) => [i.id, i.href])).toEqual([
      ['dashboard', '/crm/revenue-ops'],
      ['leads', '/crm/leads?revops=1'],
      ['pipeline', '/crm/revenue-ops/pipeline'],
      ['accounts', '/crm/account-management/clients?revops=1'],
      ['handover', '/crm/account-management/onboarding?revops=1'],
      ['renewal', '/crm/account-management/renewals?revops=1'],
      ['kpi', '/crm/kpi-hub/sales?revops=1'],
      ['sla', '/crm/revenue-ops/sla'],
      ['reports', '/crm/revenue-ops/reports'],
      ['territory', '/crm/revenue-ops/territory'],
      ['approvals', '/crm/revenue-ops/approvals'],
      ['settings', '/crm/revenue-ops/settings'],
    ]);
  });
  it('mobile has 5 shortcuts', () => {
    expect(REVOPS_MOBILE_NAV.map((i) => i.id)).toEqual([
      'dashboard',
      'leads',
      'pipeline',
      'accounts',
      'kpi',
    ]);
  });
});

describe('activeRevopsHref', () => {
  it('matches command center exactly', () => {
    expect(activeRevopsHref('/crm/revenue-ops')).toBe('/crm/revenue-ops');
  });
  it('matches nested sla', () => {
    expect(activeRevopsHref('/crm/revenue-ops/sla')).toBe('/crm/revenue-ops/sla');
  });
  it('matches embed leads', () => {
    expect(activeRevopsHref('/crm/leads')).toBe('/crm/leads?revops=1');
  });
});

describe('canSeeRevopsNav', () => {
  it('fail-closed', () => {
    expect(canSeeRevopsNav(null)).toBe(false);
    expect(canSeeRevopsNav(user([{ section: 'crm_leads', action: 'view' }]))).toBe(false);
  });
  it('true for crm_revops.view', () => {
    expect(canSeeRevopsNav(user([{ section: 'crm_revops', action: 'view' }]))).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeRevopsNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_revops', 'view') ||
    hasCap(user, 'crm_revops', 'view_team') ||
    hasCap(user, 'crm_revops', 'view_all') ||
    hasCap(user, 'crm_revops', 'manage')
  );
}

export type RevopsNavItem = { id: string; label: string; href: string; icon: string };
export type RevopsNavGroup = { title: string; items: RevopsNavItem[] };

export const REVOPS_NAV_GROUPS: RevopsNavGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [{ id: 'dashboard', label: 'Command Center', href: '/crm/revenue-ops', icon: 'command' }],
  },
  {
    title: 'DOANH THU',
    items: [
      { id: 'leads', label: 'Leads & Routing', href: '/crm/leads?revops=1', icon: 'leads' },
      { id: 'pipeline', label: 'Pipeline & Deal', href: '/crm/revenue-ops/pipeline', icon: 'pipeline' },
      { id: 'accounts', label: 'Account 360', href: '/crm/account-management/clients?revops=1', icon: 'accounts' },
      { id: 'handover', label: 'Handover & Onboarding', href: '/crm/account-management/onboarding?revops=1', icon: 'handover' },
      { id: 'renewal', label: 'Renewal & Growth', href: '/crm/account-management/renewals?revops=1', icon: 'renewal' },
    ],
  },
  {
    title: 'HIỆU SUẤT',
    items: [
      { id: 'kpi', label: 'KPI & Hoa hồng', href: '/crm/kpi-hub/sales?revops=1', icon: 'kpi' },
      { id: 'sla', label: 'SLA & Escalation', href: '/crm/revenue-ops/sla', icon: 'sla' },
      { id: 'reports', label: 'Báo cáo & Forecast', href: '/crm/revenue-ops/reports', icon: 'reports' },
    ],
  },
  {
    title: 'QUẢN TRỊ',
    items: [
      { id: 'territory', label: 'Territory & Capacity', href: '/crm/revenue-ops/territory', icon: 'territory' },
      { id: 'approvals', label: 'Phê duyệt', href: '/crm/revenue-ops/approvals', icon: 'approvals' },
      { id: 'settings', label: 'Cấu hình & Audit', href: '/crm/revenue-ops/settings', icon: 'settings' },
    ],
  },
];

export const REVOPS_MOBILE_NAV: RevopsNavItem[] = [
  REVOPS_NAV_GROUPS[0].items[0],
  REVOPS_NAV_GROUPS[1].items[0],
  REVOPS_NAV_GROUPS[1].items[1],
  REVOPS_NAV_GROUPS[1].items[2],
  REVOPS_NAV_GROUPS[2].items[0],
];

export function activeRevopsHref(pathname: string): string {
  const items = REVOPS_NAV_GROUPS.flatMap((g) => g.items);
  const exact = items.find((i) => i.href.split('?')[0] === pathname);
  if (exact) return exact.href;
  if (pathname.startsWith('/crm/leads')) return '/crm/leads?revops=1';
  if (pathname.startsWith('/crm/account-management/onboarding')) {
    return '/crm/account-management/onboarding?revops=1';
  }
  if (pathname.startsWith('/crm/account-management/renewals')) {
    return '/crm/account-management/renewals?revops=1';
  }
  if (pathname.startsWith('/crm/account-management')) {
    return '/crm/account-management/clients?revops=1';
  }
  if (pathname.startsWith('/crm/kpi-hub')) return '/crm/kpi-hub/sales?revops=1';
  const nested = items
    .filter((i) => pathname.startsWith(i.href.split('?')[0]) && i.href !== '/crm/revenue-ops')
    .sort((a, b) => b.href.length - a.href.length)[0];
  return nested?.href ?? '/crm/revenue-ops';
}
```

- [ ] **Step 3: Vitest PASS · Commit** `feat(revops): add navigation config`

---

### Task B3: CSS tokens + layout + shell

**Files:**
- Create: `services/ops-web/src/app/crm/revenue-ops/revops.css`
- Create: `services/ops-web/src/components/crm/revops/RevOpsShell.tsx`
- Create: `services/ops-web/src/components/crm/revops/RevOpsRouteCatalog.tsx`
- Create: `services/ops-web/src/app/crm/revenue-ops/layout.tsx`
- Create: `services/ops-web/e2e/revops-shell-w1.spec.ts`

**Interfaces:**
- Consumes: `REVOPS_NAV_GROUPS`, `isRevopsShellEnabled`, `isRevopsRouteCatalogEnabled`, `StaffPageShell`
- Produces: `RevOpsShell({ children, title, subtitle, actions })` · `useRevopsPage()` context `{ user, token }`

Clone `AmShell`: sidebar 256px nền `#0b1220`, brand “RNOSAI CRM” + “Revenue Operations”, userbox bottom, topbar breadcrumb `RNOSAI CRM / Revenue Operations / {title}`, không nest `<main>` thứ hai.

`layout.tsx`:

```tsx
import './revops.css';
import { redirect } from 'next/navigation';
import { isRevopsShellEnabled } from '@/lib/crm/revops-flags';
import { RevOpsShell } from '@/components/crm/revops/RevOpsShell';

export default function RevenueOpsLayout({ children }: { children: React.ReactNode }) {
  if (!isRevopsShellEnabled()) redirect('/crm');
  return <RevOpsShell>{children}</RevOpsShell>;
}
```

W1 stub pages (tránh 404 nav): `pipeline`, `sla`, `reports`, `territory`, `approvals`, `settings` — mỗi page heading đúng mockup + paragraph “Đang triển khai Wave …” + không crash.

Alias:

```tsx
// app/crm/revenue-ops/leads/page.tsx
import { redirect } from 'next/navigation';
export default function Page() { redirect('/crm/leads?revops=1'); }
```

Tương tự `kpi/page.tsx` → `/crm/kpi-hub/sales?revops=1`.

CSS token:

```css
:root {
  --revops-primary: #17692f;
  --revops-navy: #0f172a;
  --revops-sidebar: #0b1220;
}
.revops-shell { display: grid; grid-template-columns: 256px minmax(0, 1fr); min-height: 100vh; }
.revops-nav-item.is-active { background: var(--revops-primary); color: #fff; }
.revops-page { max-width: 1800px; margin: 0 auto; padding: 1rem 1.25rem 2rem; }
@media (max-width: 760px) {
  .revops-shell { grid-template-columns: minmax(0, 1fr); }
  .revops-mobile-nav { position: fixed; bottom: 0; left: 0; right: 0; display: grid; grid-template-columns: repeat(5, 1fr); }
}
```

Playwright:

```typescript
test('sidebar Command Center active', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_REVOPS_SHELL !== '1', 'flag off');
  await loginAsStaff(page);
  await page.goto('/crm/revenue-ops');
  await expect(page.getByRole('navigation').getByText('Command Center')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales & Account Command Center' })).toBeVisible();
});
```

- [ ] Commit `feat(revops): add RevOpsShell layout and tokens`

---

### Task B4: Command center aggregate API

**Files:**
- Create: `services/ptt-crm-api/src/revops/revops.types.ts`
- Create: `services/ptt-crm-api/src/revops/revops-scope.util.ts`
- Create: `services/ptt-crm-api/src/revops/revops-dashboard.service.ts`
- Create: `services/ptt-crm-api/src/revops/revops-dashboard.service.spec.ts`
- Create: `services/ptt-crm-api/src/revops/revops-actions.service.ts`
- Create: `services/ptt-crm-api/src/revops/revops-team-performance.service.ts`
- Create: `services/ptt-crm-api/src/revops/guards/staff-revops.guard.ts`
- Create: `services/ptt-crm-api/src/revops/revops.controller.ts`
- Create: `services/ptt-crm-api/src/revops/revops.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts`

**Interfaces:**

```typescript
export type RevopsTeamPerformanceRow = {
  staffId: number;
  name: string;
  role: string;
  teamLabel: string;
  targetVnd: number | null;
  actualVnd: number | null;
  attainmentPct: number | null;
  pipelineVnd: number | null;
  leadActive: number;
  slaPct: number | null;
  status: 'On track' | 'Accelerator' | 'Need attention' | 'At risk';
};

export type RevopsActionItem = {
  id: string;
  kind: 'lead_no_response' | 'deal_stale' | 'contract_expiry';
  title: string;
  href: string;
  dueAt: string | null;
};

export type RevopsRiskItem = {
  id: string;
  kind: 'account_health' | 'renewal' | 'proposal_expiry';
  title: string;
  href: string;
  severity: 'warning' | 'danger';
};

export type RevopsCommandCenterDto = {
  period: string;
  bu: string;
  revenue: {
    actualVnd: number | null;
    targetVnd: number | null;
    attainmentPct: number | null;
    deltaPct: number | null;
  };
  pipeline: {
    weightedVnd: number | null;
    coverageX: number | null;
    activeDeals: number;
    commitDeals: number;
  };
  leadSla: { compliancePct: number | null; atRisk: number; breaches: number };
  commission: {
    estimatedVnd: number | null;
    approvedVnd: number | null;
    pendingVnd: number | null;
  };
  funnel: Array<{ stage: string; count: number }>;
  teamRevenue: Array<{ teamId: string; label: string; actualVnd: number | null; targetVnd: number | null }>;
  teamPerformance: RevopsTeamPerformanceRow[];
  todayQueue: RevopsActionItem[];
  atRisk: RevopsRiskItem[];
  fetchedAt: string;
};
```

Compose (read-only):

| Field | Nguồn | W1 nếu thiếu |
|---|---|---|
| `revenue` | `KpiHubDashboardService` persona `sales` | `null` |
| `pipeline` / `funnel` | leads funnel counts (stage buckets) | `0` / `null` |
| `leadSla` | lead SLA care metrics nếu service export; else đếm breach từ query hiện có | `null` + 0 |
| `commission` | — | **luôn `null` đến W3** |
| `teamPerformance` | KPI Hub team rows + lead counts | `[]` |
| `todayQueue` / `atRisk` | `revops-actions.service` — query leads stale / AM renewal window nếu có | `[]` |

Guard: `@RequireRevopsAction('view')` — `view_all` thấy mọi BU; `view_team` filter team; `view` chỉ self (scope util).

Controller:

```typescript
@Controller('api/crm/revops')
export class RevopsController {
  @Get('command-center')
  commandCenter(
    @Query('period') period?: string,
    @Query('bu') bu?: string,
  ): Promise<RevopsCommandCenterDto> { /* ... */ }
}
```

- [ ] **Step 1:** Jest mock `KpiHubDashboardService` — assert `commission.estimatedVnd === null`, `revenue` mapped, `fetchedAt` ISO.
- [ ] **Step 2:** Implement compose + register module.
- [ ] **Step 3:** `cd services/ptt-crm-api && npm test -- revops-dashboard`
- [ ] **Step 4:** Commit `feat(revops): add command center aggregate API`

---

### Task B5: Command Center page + formatters

**Files:**
- Create: `services/ops-web/src/lib/crm/revops-api.ts`
- Create: `services/ops-web/src/lib/crm/revops-format.ts`
- Create: `services/ops-web/src/lib/crm/revops-format.spec.ts`
- Create: `services/ops-web/src/components/crm/revops/RevOpsCommandCenter.tsx`
- Create: `services/ops-web/src/app/crm/revenue-ops/page.tsx`

```typescript
export function formatRevopsVnd(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}
export function formatRevopsPct(n: number | null): string {
  if (n == null) return '—';
  return `${Math.round(n)}%`;
}
export function attainmentTag(
  pct: number | null,
): 'On track' | 'Accelerator' | 'Need attention' | 'At risk' | '—' {
  if (pct == null) return '—';
  if (pct >= 110) return 'Accelerator';
  if (pct >= 90) return 'On track';
  if (pct >= 70) return 'Need attention';
  return 'At risk';
}
```

Page: 4 KPI cards (FR-CC) + funnel 5 cột + bar team + bảng nhân sự + 2 list. Header: period + BU query + nút **＋ Tạo nhanh**. Row “Xem” → href nav (FR-CC-07).

`fetchRevopsCommandCenter(token, { period, bu })` → `GET /api/crm/revops/command-center`.

- [ ] Vitest format · Commit `feat(revops): add Command Center page`

---

### Task B6: Sáu modal W1

**Files:**
- Create: `RevOpsQuickCreateModal.tsx`
- Create: `modals/RevOpsLeadModal.tsx` — `createLead` (`lib/api.ts`)
- Create: `modals/RevOpsAssignModal.tsx` — `assignLead` + reason bắt buộc; 3 suggestion: W1 lấy từ owner list / round-robin đơn giản (không simulate W3)
- Create: `modals/RevOpsDuplicateModal.tsx` — nếu chưa có dedup API: hai cột đọc-only từ query `duplicate_of` trên inbox row; action = merge CTA hiện có hoặc đóng
- Create: `modals/RevOpsDealModal.tsx` — tạo opportunity qua API deal-room/lead patch stage hiện có; required: tên, account/lead, stage, close, amount, next step
- Create: `modals/RevOpsQuoteModal.tsx` — presales quote / deal-room quote helper; notice discount → link `/crm/revenue-ops/approvals`
- Create: `modals/index.ts`

Quick create 6 tile (copy mockup): Lead, Opportunity, Account, Handover, KPI, Assign. W1 Account/Handover/KPI → toast “Sẽ mở ở Wave 2” **hoặc** navigate AM/KPI create page nếu URL đã có (`/crm/account-management/clients/new`, KPI targets). Ưu tiên navigate URL thật thay toast nếu page tồn tại.

Mọi modal: overlay click / × / Hủy đóng; `*` required; toast success.

- [ ] Commit `feat(revops): add W1 quick-create and lead/deal modals`

---

### Task B7: OpsNav + rbac-routes + embed mode

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx` — nhóm “Revenue Operations” khi `canSeeRevopsNav && isRevopsShellEnabled`, href `/crm/revenue-ops`
- Modify: `services/ops-web/src/lib/rbac-routes.ts` — rule **trước** `/crm/leads`:

```typescript
{
  prefix: '/crm/revenue-ops',
  anyOf: [
    { section: 'crm_revops', action: 'view' },
    { section: 'crm_revops', action: 'view_team' },
    { section: 'crm_revops', action: 'view_all' },
    { section: 'crm_revops', action: 'manage' },
  ],
},
```

- Create: `RevOpsEmbedFrame.tsx` — `document.documentElement.classList.add('revops-embed')` khi `searchParams.revops === '1'`
- Modify: leads list + KPI Hub sales + AM clients — CSS `.revops-embed .kpi-hub-sidebar, .revops-embed .am-sidebar { display: none }` **chỉ** khi class embed (không đụng KPI Hub standalone)

Playwright: từ RevOps nav → Leads, không 2 sidebar.

- [ ] Commit `feat(revops): wire OpsNav, route caps, and embed mode`

---

### Task B8: W1 UAT gate

```bash
cd services/ptt-crm-api && npm test -- revops
cd services/ops-web && npx vitest run src/lib/crm/revops src/lib/crm/lead-pipeline
cd services/ops-web && npx playwright test e2e/revops-shell-w1.spec.ts e2e/lead-pipeline-tab.spec.ts
```

Manual SRS §10.2. Staging `NEXT_PUBLIC_REVOPS_SHELL=1`. **PO sign-off trước W2.**

---

# TRACK B — WAVE 2

Không bắt đầu nếu W1 UAT chưa xanh.

### Task B9: Pipeline aggregate (NBV-03)

**Files:** `revops-pipeline.service.ts`, `RevOpsPipelinePage.tsx`, `app/crm/revenue-ops/pipeline/page.tsx`

**API:** `GET /api/crm/revops/pipeline?view=kanban|list` →

```typescript
export type RevopsPipelineDto = {
  kpis: {
    totalVnd: number | null;
    weightedVnd: number | null;
    commitVnd: number | null;
    staleCount: number;
  };
  columns: Array<{
    stage: 'discovery' | 'qualified' | 'proposal' | 'negotiation' | 'contract_review';
    count: number;
    valueVnd: number | null;
    cards: Array<{
      id: string;
      leadId: number;
      name: string;
      product: string;
      amountVnd: number | null;
      closeDate: string | null;
      owner: string;
      risk: string | null;
    }>;
  }>;
};
```

Kanban 5 cột mockup. Card click → `/crm/leads/[id]/deal-room`. Drawer: stepper 6 bước (Discovery→Won), hygiene checklist, notice discount → Approvals. Tabs Forecast/Win-Loss = heading + “Wave 3/4”. Header: `dealModal` / `quoteModal`.

Jest: stale = close_date < today và stage ≠ won. Playwright: 5 cột render.

- [ ] Commit `feat(revops): add pipeline kanban aggregate`

---

### Task B10: Unified Approvals (NBV-11)

**Files:** `revops-approvals.service.ts`, `RevOpsApprovalsPage.tsx`, `RevOpsApprovalModal.tsx`

Facade `GET /api/crm/revops/approvals`:

- Map `KpiHubApprovalsService.list()` → type `Commission` / KPI
- Discount / clawback / account reassignment: `[]` cho đến khi source sẵn; type union giữ đủ 4 để UI không đổi W3

KPI row: waiting for me / pending all / approved today / overdue — đếm từ facade.

`approvalModal`: comment `*` · Approve / Reject / Changes → `POST /api/crm/kpi-hub/approvals/:kind/:id/approve|reject` khi kind KPI; kind khác W2 disable + copy “Chưa có nguồn”.

Discount matrix: bảng tĩnh ≤5 / 5–15 / 15–25 / >25 (read-only W2).

- [ ] Commit `feat(revops): add unified approval queue facade`

---

### Task B11: Handover alias + modal W2

**Files:**
- Create: `services/ops-web/src/app/crm/leads/handover/page.tsx`

```tsx
import { redirect } from 'next/navigation';
export default function Page() {
  redirect('/crm/account-management/onboarding?revops=1');
}
```

Modals (submit API AM/KPI **đã có**):

| Modal | Submit |
|---|---|
| `RevOpsHandoverModal` | `POST /api/crm/am/handovers` (hoặc create onboarding hiện có) |
| `RevOpsAccountModal` | AM create client (`/crm/account-management/clients/new` fields) |
| `RevOpsAccountPlanModal` | AM plans API |
| `RevOpsGrowthModal` | AM opportunities API |
| `RevOpsKpiModal` | KPI Hub targets assign |

Required `*` theo SRS §5. Quick create W1 tiles Account/Handover/KPI trỏ modal thật.

- [ ] Commit `feat(revops): add W2 modals and handover alias`

---

### Task B12: Leads inbox delta (NBV-02)

**Files:** `CrmLeadsPageContent.tsx` + cột/component hiện có

- Cột ICP/Score tag Hot/Warm/Fit nếu score đã có trên row; không thì `—`
- First response SLA countdown nếu field SLA có; không thì ẩn cột (không fake)
- Checkbox bulk + assign = `assignLead` loop + `assignmentModal`
- Saved view “Lead P1”: query `priority=p1` (nếu lead đã có priority; else filter `status=moi` + unassigned)
- CTA **Chăm lead** → `/crm/leads/[id]?tab=pipeline` (Track A)
- Footer 2 card: Routing waterfall copy 4 bước (static W2) + SLA timeline T+0…T+10 (static); simulate = W3

- [ ] Commit `feat(leads): align inbox columns with RevOps mockup`

---

### Task B13: W2 UAT

Kanban → deal-room; approval KPI approve e2e; handover modal tạo record thấy ở AM onboarding; modal `*` validate. PO sign-off.

---

# TRACK B — WAVE 3

### Task B14: DDL + commission module

**Files:** `docs/specs/2026-09-05-postgresql-ddl-revops-w3.sql` + `services/ptt-crm-api/src/revops/commission/`

```sql
CREATE TABLE crm_revops_commission_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'PTT',
  name text NOT NULL,
  version int NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  revenue_basis text NOT NULL,
  role_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_revops_commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES crm_revops_commission_plans(id),
  min_attainment_pct numeric NOT NULL,
  max_attainment_pct numeric,
  rate_pct numeric NOT NULL
);

CREATE TABLE crm_revops_commission_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_ref text NOT NULL,
  staff_id int NOT NULL,
  eligible_vnd bigint NOT NULL,
  rate_pct numeric NOT NULL,
  split_pct numeric NOT NULL DEFAULT 100,
  commission_vnd bigint NOT NULL,
  status text NOT NULL,
  payout_batch_id uuid
);

CREATE TABLE crm_revops_payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  status text NOT NULL,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm_revops_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL,
  duration_minutes int NOT NULL,
  warning_minutes int NOT NULL,
  escalate_json jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE crm_revops_sla_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  policy_id uuid REFERENCES crm_revops_sla_policies(id),
  owner_id int,
  due_at timestamptz NOT NULL,
  breached_at timestamptz,
  status text NOT NULL
);

CREATE TABLE crm_revops_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  parent_id uuid REFERENCES crm_revops_territories(id),
  team_label text,
  capacity int
);

CREATE TABLE crm_revops_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  priority int NOT NULL,
  condition_json jsonb NOT NULL,
  method text NOT NULL,
  fallback text,
  status text NOT NULL DEFAULT 'draft'
);
```

Down script cùng file (comment `-- DOWN` drop tables theo thứ tự FK).

Commission calc (Jest):

```typescript
export function calcCommissionVnd(eligibleVnd: number, ratePct: number, splitPct: number): number {
  return Math.round((eligibleVnd * ratePct * splitPct) / 10000);
}
```

Hook: khi deal won / collected revenue event hiện có → insert `crm_revops_commission_transactions` status `pending_collection` | `pending_finance`. Clawback = transaction `commission_vnd < 0` khi deal lost sau payout.

`commissionPlanModal` / `payoutModal`: CRUD plan versioned + lock batch + Finance reconcile status.

Command Center `commission.*` hết `null` — compose từ transactions.

- [ ] Apply DDL trên staging trước prod. Commit `feat(revops): add commission schema and calculator`

---

### Task B15: SLA center (NBV-08)

**Files:** `revops-sla.service.ts`, `revops-sla.worker.ts`, `RevOpsSlaPage.tsx`, `RevOpsSlaPolicyModal.tsx`

Compose incidents từ leads first-response + AM handover accept + renewal prep (query existing due dates). Worker tick 5 phút: T+3 reminder (activity/note), T+5 `breached_at`, T+10 reassign fallback owner từ routing rule `status=published` (nếu chưa có rule thì chỉ flag, không auto-assign).

KPI row: compliance (target 95%), open warnings, breaches, auto reassignments.

Policy catalog CRUD. Breach trend 7 ngày = count group by day. Assign CTA → `assignmentModal`.

- [ ] Jest worker transitions. Commit `feat(revops): add SLA incident center`

---

### Task B16: Territory & Routing (NBV-10)

**Files:** `revops/routing/*`, `RevOpsTerritoryPage.tsx`, `RevOpsTerritoryModal.tsx`, `RevOpsRoutingModal.tsx`

Hierarchy CRUD. Capacity bar = (open leads + named accounts) / capacity. 4 rule seed: existing account match, named account, territory+industry, capacity balancing.

`routingModal`: Simulate `(leadId) → ranked owners[]` + Publish version. Upgrade Task B6 suggestions = output simulate.

KPI: active territories, coverage gaps (territory không owner), utilization %.

- [ ] Commit `feat(revops): add territory hierarchy and routing simulator`

---

### Task B17: KPI Hub commission UI (NBV-07)

**Files:** modify `/crm/kpi-hub/sales` hoặc tab `/crm/kpi-hub/commission`

Weighted row 45 / 25 / 15 / 15 (New / Renewal / Upsell / SLA) — số từ KPI Hub types nếu map được, không thì weights config trên plan. Projection widgets. Bảng nhân sự + transaction detail + payout stepper. Cross-nav → Approvals.

- [ ] Commit `feat(kpi-hub): wire commission widgets to RevOps plans`

---

### Task B18: W3 UAT

Tạo plan v1 → estimate khớp `calcCommissionVnd`. SLA breach hiện queue. Simulate trả ranked owner. Command Center hoa hồng ≠ `—`. PO sign-off.

---

# TRACK B — WAVE 4

### Task B19: Reports & Forecast (NBV-09)

**Files:** `revops-reports.service.ts`, `RevOpsReportsPage.tsx`

`GET /api/crm/revops/reports` seed 4 report (không 18 giả):

1. Executive Revenue Forecast
2. Lead SLA & Leakage
3. Key Account Health & Renewal Risk
4. Commission Payout Reconciliation

Filters: period, BU, territory. Currency = VND only (constraint). 3 cards: actual vs forecast, mix New/Renewal/Upsell, commission liability. Export CSV. Scheduler = `cron` stub `status=manual`.

- [ ] Commit `feat(revops): add reports library`

---

### Task B20: Settings & Audit (NBV-12)

**Files:** `revops-settings.service.ts`, `RevOpsSettingsPage.tsx`

3 card: org/users → link `/admin` RBAC; data quality counts (`deals` không next action, account không owner, strategic không plan — query AM/leads); integration health ping ERP / FB Lead Ads / HR nếu health endpoint đã có, else `unknown`.

Role matrix read-only: module × Sales / AE / Team Lead / Finance / Admin (mirror catalog).

Audit timeline: reuse admin audit API filter `section like crm_revops%`.

- [ ] Commit `feat(revops): add settings, data quality, and audit`

---

### Task B21: Mobile + cross-nav + regression

- Bottom nav 5 tab hoạt động trên embed routes (`?revops=1` giữ class)
- Mọi `data-view` mockup → href §0.6
- `RevOpsRouteCatalog` ẩn prod trừ flag
- Command center LCP < 3s staging (không chặn merge nếu data chậm — ghi note)
- Playwright `e2e/revops-full.spec.ts`: 12 nav item visible + không 404 native routes
- Cập nhật [23-leads-handover-flow](../../huong-dan-su-dung/23-leads-handover-flow-and-guides.md) thêm entry RevOps
- PO SRS §10.3

- [ ] Commit `feat(revops): polish mobile nav and full smoke suite`

---

## FR coverage (SRS → task)

| FR | Task |
|---|---|
| FR-SHELL-01…07 | B2, B3, B7, B21 |
| FR-CC-01…07 | B4, B5 |
| FR-LEAD-01…12 | B12 + A4 + A6 |
| FR-PIPE-01…05 | B9 |
| FR-ACC-01…06 | AM OS + embed B2/B11 |
| FR-MODAL W1 (6) | B6 |
| FR-MODAL W2 (6) | B10, B11 |
| FR-MODAL W3 (5) | B14–B16 |
| NBV-05/06 | B11 + AM deep-link |
| NBV-07 commission | B14, B17 |
| NBV-08 | B15 |
| NBV-09 | B19 |
| NBV-10 | B16 |
| NBV-11 | B10 |
| NBV-12 | B20 |
| FR-TAB / FR-PIPE / FR-SLA / FR-LINK (L3) | A1–A6 |
| BR-01…06 (L3) | A3, A4 |

**Cố ý để sau:** AI growth playbook (NBV-06) → AM OS; Forecast/Win-Loss full logic → sau W4 nếu PO yêu cầu.

---

## Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| API unit | Jest | `revops-dashboard`, approvals facade, `calcCommissionVnd`, SLA worker |
| FE unit | Vitest | flags, nav, format, hash map, panel mode, `readinessCheckHref` |
| E2E | Playwright | shell, command center, embed no double sidebar, pipeline tab AC |
| Visual | Manual vs 2 HTML mockup | mỗi wave |
| RBAC | fail-closed nav + 403 |

CI: flag default off; `REVOPS_CI=1` / `NEXT_PUBLIC_LEAD_PIPELINE_TAB=1` trên job riêng.

---

## Rollout

| Env | `REVOPS_SHELL` | `LEAD_PIPELINE_TAB` |
|---|---|---|
| local | `1` | `1` |
| staging | `1` sau W1 | `1` sau A6 |
| prod | `0` → `1` theo wave | `0` → `1` sau AC xanh |

Rollback W1/Track A: set flag `0` — không cần down DB. W3: down script DDL.

---

## Effort (1 dev)

| Wave | Ngày |
|---|---|
| Track A | 3–5 (song song W1) |
| W1 | 8–12 |
| W2 | 10–14 |
| W3 | 15–20 |
| W4 | 8–10 |
| **Cộng** | **~44–61** |

Commission (W3) là critical path dài nhất.

---

## Risks

| Risk | Mitigation |
|---|---|
| Không có deal-room list API top-level | B9 aggregate từ leads funnel / deal summaries |
| Double sidebar | `?revops=1` + class `revops-embed` (B7) |
| `LeadFunnelPanel` extract regression | e2e funnel cũ khi flag `0` vẫn pass |
| Hash bookmark gãy | A2 matrix + A6 AC-TAB-004 |
| Commission phức tạp | Isolated folder + DDL riêng + calc unit |
| AM renewal chưa đủ | Deep-link + `—` đến khi AM sẵn |

---

## Self-review

- [x] 12 view → task/wave
- [x] 17 modal → W1/W2/W3
- [x] Sub-mockup L3 → Track A đủ TDD
- [x] 4 câu hỏi PO §13 khóa
- [x] Global constraints copy từ SRS
- [x] Route reconciliation khóa
- [x] File path đúng codebase 2026-09-06
- [x] Không TBD / “implement later”
- [x] Types B4 khớp B5

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-06-revops-enterprise-and-lead-pipeline.md`.**
