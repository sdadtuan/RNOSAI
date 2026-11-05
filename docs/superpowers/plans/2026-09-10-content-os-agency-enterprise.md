# Content Marketing OS — Agency Enterprise (CMKT-E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-09-10-content-os-agency-enterprise-design.md`](../specs/2026-09-10-content-os-agency-enterprise-design.md) · **SPEC-CMKT-E v3.1**  
**UI contract:** [`docs/superpowers/mocks/2026-09-10-content-os-agency-enterprise.html`](../mocks/2026-09-10-content-os-agency-enterprise.html)

**Goal:** Nâng Content Marketing OS từ board theo lifecycle thành hệ điều hành nội dung agency: portfolio Command Center, Request, workspace 8 tab, Approval Center, Publish Gate, Rights, Intelligence — UI parity mockup, evolve `cmkt_*` in place.

**Architecture:** Giữ prefix `/api/crm/service-lifecycle/:lifecycleId/content-marketing/*`. Thêm portfolio `/api/crm/content-os/portfolio/*` (ABAC = cap `crm_content.*` + lifecycle trong board scope). Ops-web thay Content Board bằng COS shell (`CmktEShell`) đúng token mockup. Wave E0 ship UI + số thật + gate block; E1 schema Request/Rights/Package; E2 control room; E3 connector (mặc định tắt).

**Tech Stack:** NestJS + Jest (`services/ptt-crm-api`) · Next.js App Router + Vitest + Playwright (`services/ops-web`) · PostgreSQL DDL `docs/specs/` + `scripts/apply_pg_ddl_content_marketing.sh`

## Global Constraints

- Một sản phẩm: nâng CMKT, **không** clone kho content, **không** bọc vỏ.
- Prefix lifecycle **giữ**. Portfolio API **thêm**.
- UI = mockup: `--nav #101a30`, `--nav2 #172642`, `--ink #15213a`, `--bg #f4f6fa`, `--blue #3268f6`, `--purple #7656e9`, `--green #139567`, `--amber #d88400`, `--red #d84951`, sidebar 258px, top 67px, sticky 66px, workspace `1fr` + 345px, Inter 13px. Sidebar glyphs khớp HTML mockup (Command Center, Requests, Workspace, Approval, Publication, Library, Intelligence, Settings).
- Flag FE `NEXT_PUBLIC_CONTENT_MARKETING=1`. Pilot slug `tiep-thi-noi-dung` rồi GA.
- Cap E0: `crm_content.view/write/generate/approve_internal/qa/publish/assign/production` + `crm_board.view/edit`.
- BR-AI-01: AI không approve / reject / publish / override rights / xóa.
- BR-CMKT-01: publish E0–E1 = human mark; connector mặc định **tắt** đến E3.
- Reject / Request Changes / Conditions: comment ≥ 10 ký tự.
- CTA copy: **Đăng ký nhận tư vấn** — cấm “Gọi ngay”.
- Command Center / capacity: số **query thật**; không data = empty / `null` / `—`. **Cấm** seed Sunlight/Nova/Tâm An lên production.
- Không bật `CP_AI_ENABLED` như “fix Video AI”. TVC → `/crm/video`. Brand kit/batch → `/crm/creative-os`.
- Không invent client AM 360 / CPL. Không đổi `QC_CHECK_KEYS` Lead pack.
- Commit sau mỗi task; không `--no-verify`. Không commit `.DS_Store`, secrets, Movies scratch, dirty CP Phase A.
- TDD: test đỏ → code → test xanh → commit.

---

## File map (khóa trước khi code)

### Tạo — API portfolio

| File | Trách nhiệm |
|---|---|
| `docs/specs/2026-09-10-postgresql-ddl-cmkt-e.sql` | Bảng mới + ALTER `cmkt_content_items` |
| `scripts/apply_pg_ddl_cmkt_e.sh` | Apply DDL (clone pattern `apply_pg_ddl_content_marketing.sh`) |
| `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.types.ts` | DTO portfolio |
| `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.util.ts` | Code `CR-*`/`CNT-*`, completeness, risk sort |
| `services/ptt-crm-api/src/content-os-portfolio/publish-gate.util.ts` | Pass / Warning / Blocked |
| `services/ptt-crm-api/src/content-os-portfolio/brief-score.util.ts` | BriefCompleteness |
| `services/ptt-crm-api/src/content-os-portfolio/approval-matrix.util.ts` | Rule engine |
| `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts` | SQL đa lifecycle |
| `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts` | Command Center, requests, approvals, publications |
| `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts` | `GET/POST /api/crm/content-os/portfolio/*` |
| `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.module.ts` | Module + export |
| `*.spec.ts` cạnh mỗi util/service/controller | Jest |

### Tạo — ops-web shell

| File | Trách nhiệm |
|---|---|
| `services/ops-web/src/styles/cmkte.css` | Token + chrome mockup |
| `services/ops-web/src/lib/crm/cmkte-tokens.ts` | Token constants (Vitest lock) |
| `services/ops-web/src/lib/crm/cmkte-routes.ts` | Path helpers + redirect cũ |
| `services/ops-web/src/lib/crm/cmkte-api.ts` | Fetch portfolio |
| `services/ops-web/src/lib/crm/cmkte-publish-gate.ts` | Gate FE mirror (cùng rule) |
| `services/ops-web/src/components/content-os/cmkte/CmktEShell.tsx` | Sidebar 258 + top + crumb |
| `services/ops-web/src/components/content-os/cmkte/CmktECommandCenter.tsx` | FR-CMD |
| `services/ops-web/src/components/content-os/cmkte/CmktERequests.tsx` | FR-REQ |
| `services/ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx` | 8 tab + context + sticky |
| `services/ops-web/src/components/content-os/cmkte/CmktEApprovals.tsx` | Approval Center |
| `services/ops-web/src/components/content-os/cmkte/CmktECalendar.tsx` | Publication Control |
| `services/ops-web/src/components/content-os/cmkte/CmktELibrary.tsx` | Library |
| `services/ops-web/src/components/content-os/cmkte/CmktEIntelligence.tsx` | Intelligence |
| `services/ops-web/src/components/content-os/cmkte/CmktESettings.tsx` | Settings |
| `services/ops-web/src/components/content-os/cmkte/CmktERequestModal.tsx` | Modal intake |
| `services/ops-web/src/app/crm/content-os/layout.tsx` | Shell layout |
| `services/ops-web/src/app/crm/content-os/requests/page.tsx` | Route |
| `services/ops-web/src/app/crm/content-os/w/[itemId]/page.tsx` | Workspace |
| `services/ops-web/src/app/crm/content-os/approvals/page.tsx` | Approvals |
| `services/ops-web/src/app/crm/content-os/calendar/page.tsx` | Calendar |
| `services/ops-web/src/app/crm/content-os/library/page.tsx` | Library |
| `services/ops-web/src/app/crm/content-os/intelligence/page.tsx` | Intelligence |
| `services/ops-web/src/app/crm/content-os/settings/page.tsx` | Settings |
| `services/ops-web/e2e/cmkte-shell.spec.ts` | E2E gate + routes |

### Sửa — giữ hành vi cũ

| File | Thay đổi |
|---|---|
| `services/ops-web/src/app/crm/content-os/page.tsx` | Hub list → Command Center |
| `services/ops-web/src/lib/crm/content-os-hub.util.ts` | `contentOsBoardHref` → COS workspace/filter |
| `services/ops-web/src/app/crm/service-delivery/[id]/page.tsx` | `?tab=content-os` redirect COS |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/content-os` đã có — giữ |
| `services/ops-web/src/lib/auth.spec.ts` | Thêm path con cùng cap |
| `services/ptt-crm-api/src/app.module.ts` | Import `ContentOsPortfolioModule` |
| `services/ptt-crm-api/src/content-marketing/content-marketing.module.ts` | Wire gate vào `publishItem` (E1) |
| `services/ptt-crm-api/src/content-marketing/content-item.service.ts` | Cột `display_code`, `master_id`, `risk_level` |
| `services/ops-web/src/components/content-os/ContentOsPanel.tsx` | Deep-link only; không là IA chính |

**Không đụng:** Video SOP pipeline, Creative OS CP Phase A dirty tree, `QC_CHECK_KEYS`, Ads bidding.

---

## Thứ tự wave

| Wave | Ship | Exit |
|---|---|---|
| **E0** Task 1–14 | Shell + portfolio counts + 8 tab bind item + gate block UI + human publish | UAT `tiep-thi-noi-dung` A→D trên UI mới |
| **E1** Task 15–22 | Request entity, brief lock, master, rights, package, 1 rule Legal, collision | Gate Invalid rights chặn `POST .../publish` |
| **E2** Task 23–29 | Capacity thật, SLA escalate, insight approve, AI Trace UI, retry log | Insight Draft không vào Copilot |
| **E3** Task 30–34 | Connector framework (off), DAM pull, retention, glossary | Connector off mặc định; flag admin |

---

## Wave E0 — Operating shell

### Task 1: Token + route helpers

**Files:**
- Create: `services/ops-web/src/lib/crm/cmkte-tokens.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-tokens.spec.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-routes.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-routes.spec.ts`
- Modify: `services/ops-web/src/lib/crm/content-os-hub.util.ts`
- Modify: `services/ops-web/src/lib/crm/content-os-hub.util.spec.ts`

**Interfaces:**
- Consumes: `CONTENT_OS_HUB = '/crm/content-os'`
- Produces: `CMKTE_TOKENS`, `cmktePath()`, `legacyContentOsRedirect()`

- [ ] **Step 1: Write failing tests**

```ts
// cmkte-tokens.spec.ts
import { CMKTE_TOKENS } from './cmkte-tokens';

describe('CMKTE_TOKENS', () => {
  it('locks mockup v2 chrome', () => {
    expect(CMKTE_TOKENS.nav).toBe('#101a30');
    expect(CMKTE_TOKENS.nav2).toBe('#172642');
    expect(CMKTE_TOKENS.ink).toBe('#15213a');
    expect(CMKTE_TOKENS.bg).toBe('#f4f6fa');
    expect(CMKTE_TOKENS.blue).toBe('#3268f6');
    expect(CMKTE_TOKENS.purple).toBe('#7656e9');
    expect(CMKTE_TOKENS.green).toBe('#139567');
    expect(CMKTE_TOKENS.amber).toBe('#d88400');
    expect(CMKTE_TOKENS.red).toBe('#d84951');
    expect(CMKTE_TOKENS.sidebarPx).toBe(258);
    expect(CMKTE_TOKENS.topPx).toBe(67);
    expect(CMKTE_TOKENS.stickyPx).toBe(66);
    expect(CMKTE_TOKENS.rightPanelPx).toBe(345);
  });
});
```

```ts
// cmkte-routes.spec.ts
import { cmktePath, legacyContentOsRedirect } from './cmkte-routes';

describe('cmktePath', () => {
  it('builds COS routes', () => {
    expect(cmktePath('command')).toBe('/crm/content-os');
    expect(cmktePath('requests')).toBe('/crm/content-os/requests');
    expect(cmktePath('workspace', 21)).toBe('/crm/content-os/w/21');
    expect(cmktePath('approvals')).toBe('/crm/content-os/approvals');
    expect(cmktePath('calendar')).toBe('/crm/content-os/calendar');
    expect(cmktePath('library')).toBe('/crm/content-os/library');
    expect(cmktePath('intelligence')).toBe('/crm/content-os/intelligence');
    expect(cmktePath('settings')).toBe('/crm/content-os/settings');
  });
});

describe('legacyContentOsRedirect', () => {
  it('maps old board tab to COS filter', () => {
    expect(legacyContentOsRedirect(9)).toBe('/crm/content-os?lifecycle=9');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ops-web && npx vitest run src/lib/crm/cmkte-tokens.spec.ts src/lib/crm/cmkte-routes.spec.ts
```

Expected: FAIL module not found.

- [ ] **Step 3: Implement**

```ts
// cmkte-tokens.ts
export const CMKTE_TOKENS = {
  nav: '#101a30',
  nav2: '#172642',
  ink: '#15213a',
  bg: '#f4f6fa',
  blue: '#3268f6',
  purple: '#7656e9',
  green: '#139567',
  amber: '#d88400',
  red: '#d84951',
  sidebarPx: 258,
  topPx: 67,
  stickyPx: 66,
  rightPanelPx: 345,
} as const;
```

```ts
// cmkte-routes.ts
export type CmktEScreen =
  | 'command'
  | 'requests'
  | 'workspace'
  | 'approvals'
  | 'calendar'
  | 'library'
  | 'intelligence'
  | 'settings';

export function cmktePath(screen: CmktEScreen, itemId?: number): string {
  const root = '/crm/content-os';
  if (screen === 'command') return root;
  if (screen === 'workspace') return `${root}/w/${itemId}`;
  return `${root}/${screen}`;
}

export function legacyContentOsRedirect(lifecycleId: number): string {
  return `/crm/content-os?lifecycle=${lifecycleId}`;
}
```

Update `contentOsBoardHref` to `legacyContentOsRedirect` (cùng signature number|string → encode).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ops-web && npx vitest run src/lib/crm/cmkte-tokens.spec.ts src/lib/crm/cmkte-routes.spec.ts src/lib/crm/content-os-hub.util.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/cmkte-tokens.ts services/ops-web/src/lib/crm/cmkte-tokens.spec.ts services/ops-web/src/lib/crm/cmkte-routes.ts services/ops-web/src/lib/crm/cmkte-routes.spec.ts services/ops-web/src/lib/crm/content-os-hub.util.ts services/ops-web/src/lib/crm/content-os-hub.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): lock COS tokens and routes from mockup contract

EOF
)"
```

---

### Task 2: Publish Gate util (shared rule, FE + API)

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/publish-gate.util.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/publish-gate.util.spec.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-publish-gate.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-publish-gate.spec.ts`

**Interfaces:**
- Consumes: item flags (approval, legal, rights, a11y, url, lock)
- Produces: `evaluatePublishGate(input): PublishGateResult`

- [ ] **Step 1: Write failing test**

```ts
import { evaluatePublishGate } from './publish-gate.util';

describe('evaluatePublishGate', () => {
  const base = {
    briefReady: true,
    internalApproved: true,
    legalRequired: true,
    legalApproved: false,
    rightsValid: true,
    altComplete: false,
    clientApproved: false,
    urlOk: true,
    versionLocked: true,
    accountHealthy: true,
  };

  it('Blocked when alt, legal, or client missing', () => {
    const r = evaluatePublishGate(base);
    expect(r.status).toBe('Blocked');
    expect(r.blockers.map((b) => b.code).sort()).toEqual(
      ['a11y_alt', 'client_approval', 'legal_pending'].sort(),
    );
  });

  it('Pass when all required clear', () => {
    const r = evaluatePublishGate({
      ...base,
      legalApproved: true,
      altComplete: true,
      clientApproved: true,
    });
    expect(r.status).toBe('Pass');
    expect(r.blockers).toEqual([]);
  });

  it('Warning when rights paid expiry approaching but still valid', () => {
    const r = evaluatePublishGate({
      ...base,
      legalApproved: true,
      altComplete: true,
      clientApproved: true,
      paidExpiryWarning: true,
    });
    expect(r.status).toBe('Warning');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/publish-gate.util.spec.ts --no-coverage
```

- [ ] **Step 3: Implement**

```ts
export type PublishGateInput = {
  briefReady: boolean;
  internalApproved: boolean;
  legalRequired: boolean;
  legalApproved: boolean;
  rightsValid: boolean;
  altComplete: boolean;
  clientApproved: boolean;
  urlOk: boolean;
  versionLocked: boolean;
  accountHealthy: boolean;
  paidExpiryWarning?: boolean;
};

export type PublishGateIssue = { code: string; message: string };

export type PublishGateResult = {
  status: 'Pass' | 'Warning' | 'Blocked';
  blockers: PublishGateIssue[];
  warnings: PublishGateIssue[];
};

export function evaluatePublishGate(input: PublishGateInput): PublishGateResult {
  const blockers: PublishGateIssue[] = [];
  const warnings: PublishGateIssue[] = [];
  if (!input.briefReady) blockers.push({ code: 'brief', message: 'Brief chưa đủ threshold.' });
  if (!input.internalApproved) blockers.push({ code: 'internal_approval', message: 'Chưa duyệt nội bộ.' });
  if (input.legalRequired && !input.legalApproved) {
    blockers.push({ code: 'legal_pending', message: 'Conditional legal review chưa có kết quả.' });
  }
  if (!input.rightsValid) blockers.push({ code: 'rights_invalid', message: 'Asset rights Invalid/Unknown.' });
  if (!input.altComplete) blockers.push({ code: 'a11y_alt', message: 'Carousel alt text chưa đầy đủ.' });
  if (!input.clientApproved) blockers.push({ code: 'client_approval', message: 'Client approval evidence chưa được lưu.' });
  if (!input.urlOk) blockers.push({ code: 'url', message: 'Destination URL không hợp lệ.' });
  if (!input.versionLocked) blockers.push({ code: 'version_lock', message: 'Chưa lock snapshot.' });
  if (!input.accountHealthy) blockers.push({ code: 'channel_health', message: 'Channel account không healthy.' });
  if (input.paidExpiryWarning) {
    warnings.push({ code: 'paid_expiry', message: 'Quyền paid sắp hết hạn.' });
  }
  const status = blockers.length ? 'Blocked' : warnings.length ? 'Warning' : 'Pass';
  return { status, blockers, warnings };
}
```

Copy **cùng function** sang `services/ops-web/src/lib/crm/cmkte-publish-gate.ts` (không import chéo package). Vitest mirror 3 case trên.

- [ ] **Step 4: Run — expect PASS**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/publish-gate.util.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/cmkte-publish-gate.spec.ts
```

- [ ] **Step 5: Commit** `feat(cmkte): add publish gate Pass/Warning/Blocked`

---

### Task 3: Display codes + request completeness

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.util.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.util.spec.ts`

**Interfaces:**
- Produces: `formatContentRequestCode(d: Date, seq: number)`, `formatContentItemCode(d: Date, seq: number)`, `requestCompleteness(fields)`

- [ ] **Step 1: Failing tests**

```ts
import {
  formatContentRequestCode,
  formatContentItemCode,
  requestCompleteness,
} from './content-os-portfolio.util';

describe('display codes', () => {
  it('formats immutable CR/CNT', () => {
    const d = new Date('2026-09-10T07:00:00+07:00');
    expect(formatContentRequestCode(d, 24)).toBe('CR-20260910-024');
    expect(formatContentItemCode(d, 21)).toBe('CNT-20260910-021');
  });
});

describe('requestCompleteness', () => {
  it('returns 0 when all empty', () => {
    expect(requestCompleteness({
      client: '', brand: '', deliverable: '', objective: '', due: '', source: '',
    })).toBe(0);
  });
  it('returns 100 when required filled', () => {
    expect(requestCompleteness({
      client: 'A', brand: 'B', deliverable: '12 posts', objective: 'Lead', due: '2026-09-20', source: 'account',
    })).toBe(100);
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/content-os-portfolio.util.spec.ts --no-coverage
```

- [ ] **Step 3: Implement**

```ts
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function formatContentRequestCode(d: Date, seq: number): string {
  return `CR-${ymd(d)}-${String(seq).padStart(3, '0')}`;
}

export function formatContentItemCode(d: Date, seq: number): string {
  return `CNT-${ymd(d)}-${String(seq).padStart(3, '0')}`;
}

export type RequestCompletenessInput = {
  client: string;
  brand: string;
  deliverable: string;
  objective: string;
  due: string;
  source: string;
};

export function requestCompleteness(f: RequestCompletenessInput): number {
  const keys: (keyof RequestCompletenessInput)[] = [
    'client', 'brand', 'deliverable', 'objective', 'due', 'source',
  ];
  const done = keys.filter((k) => String(f[k] ?? '').trim().length > 0).length;
  return Math.round((done / keys.length) * 100);
}
```

- [ ] **Step 4: PASS + commit** `feat(cmkte): add CR/CNT codes and request completeness`

---

### Task 4: Portfolio types + Command Center query

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.types.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.spec.ts`

**Interfaces:**
- Consumes: `ContentMarketingRepository` pattern (pg query), staff board lifecycle IDs
- Produces: `getCommandCenter(scope): PortfolioCommandCenter`

```ts
export type PortfolioCommandCenter = {
  throughput_week: number;
  completed_week: number;
  wip: number;
  sla_at_risk: number;
  sla_breached: number;
  first_pass_pct: number | null;
  capacity_pct: number | null;
  blocked: number;
  risk_queue: Array<{
    item_id: number;
    lifecycle_id: number;
    content_code: string | null;
    title: string;
    client_label: string | null;
    risk_signal: string;
    owner_label: string | null;
    sla_remaining_h: number | null;
    recommended_action: string;
  }>;
};
```

- [ ] **Step 1: Service spec với mock repo**

```ts
describe('ContentOsPortfolioService.getCommandCenter', () => {
  it('returns zeros and empty queue when no lifecycles in scope', async () => {
    const repo = { listScopedLifecycleIds: jest.fn().mockResolvedValue([]), aggregateCommand: jest.fn() };
    const svc = new ContentOsPortfolioService(repo as never);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.throughput_week).toBe(0);
    expect(out.wip).toBe(0);
    expect(out.risk_queue).toEqual([]);
    expect(out.capacity_pct).toBeNull();
    expect(repo.aggregateCommand).not.toHaveBeenCalled();
  });

  it('does not invent capacity when repo returns null', async () => {
    const repo = {
      listScopedLifecycleIds: jest.fn().mockResolvedValue([3]),
      aggregateCommand: jest.fn().mockResolvedValue({
        throughput_week: 4,
        completed_week: 2,
        wip: 2,
        sla_at_risk: 1,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 1,
        risk_queue: [],
      }),
    };
    const svc = new ContentOsPortfolioService(repo as never);
    const out = await svc.getCommandCenter({ staffId: 1 });
    expect(out.capacity_pct).toBeNull();
    expect(out.throughput_week).toBe(4);
  });
});
```

- [ ] **Step 2: FAIL → implement service**  
`getCommandCenter`: nếu `listScopedLifecycleIds` rỗng → zeros + `capacity_pct: null`. Không hardcode 186/17/78.

Repo SQL (E0): đếm `cmkt_content_items` trong lifecycle scope, `updated_at` 7 ngày, status `in_review`/`changes_requested` = at risk nếu `in_review_at` > 18h; `blocked` = production escalate hoặc status `changes_requested`. `first_pass_pct` / `capacity_pct` = `null` đến E2.

- [ ] **Step 3: PASS + commit** `feat(cmkte): portfolio command center aggregates without invented capacity`

---

### Task 5: Portfolio HTTP API

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.spec.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — `imports: [..., ContentOsPortfolioModule]`

**Interfaces:**
- Consumes: `StaffOrInternalKeyGuard` + `StaffContentMarketingViewGuard`
- Produces:

| Method | Path |
|---|---|
| GET | `/api/crm/content-os/portfolio/command-center` |
| GET | `/api/crm/content-os/portfolio/requests` |
| POST | `/api/crm/content-os/portfolio/requests` |
| POST | `/api/crm/content-os/portfolio/requests/:id/convert` |
| GET | `/api/crm/content-os/portfolio/approvals` |
| GET | `/api/crm/content-os/portfolio/publications` |
| GET | `/api/crm/content-os/portfolio/insights` |

- [ ] **Step 1: Controller spec** — mock service, assert `commandCenter` gọi `getCommandCenter`.

```ts
it('GET command-center delegates to service', async () => {
  const service = { getCommandCenter: jest.fn().mockResolvedValue({ throughput_week: 0, risk_queue: [] }) };
  const c = new ContentOsPortfolioController(service as never);
  await c.commandCenter({ staffUser: { sub: '1' } } as never);
  expect(service.getCommandCenter).toHaveBeenCalled();
});
```

- [ ] **Step 2: FAIL → implement controller**  
Guards giống `ContentMarketingController`. POST requests cần `StaffContentMarketingWriteGuard`. Body: `{ lifecycle_id, source, client_label, brand_label, deliverable_ask, objective, due_at, priority }`. E0: persist `cmkt_content_requests` nếu bảng có; **nếu chưa migrate** Task 6 phải chạy trước — thứ tự: Task 6 DDL rồi quay lại POST, hoặc E0 POST ghi idea (`source=request`) tạm. **Chốt:** Task 6 DDL trước khi merge Task 5 POST. Task 5 chỉ GET command-center + GET approvals (map `review-queue` đa lifecycle) + GET publications (map calendar slots tuần). POST request = Task 7.

- [ ] **Step 3: GET-only E0 trong task này**

```ts
@Controller('api/crm/content-os/portfolio')
@UseGuards(StaffOrInternalKeyGuard, StaffContentMarketingViewGuard)
export class ContentOsPortfolioController {
  constructor(private readonly portfolio: ContentOsPortfolioService) {}

  @Get('command-center')
  commandCenter(@Req() req: Request) {
    return this.portfolio.getCommandCenter({ staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0) });
  }

  @Get('approvals')
  approvals(@Req() req: Request) {
    return this.portfolio.listApprovals({ staffId: Number((req as { staffUser?: { sub?: string } }).staffUser?.sub ?? 0) });
  }

  @Get('publications')
  publications(@Query('from') from?: string, @Query('to') to?: string) {
    return this.portfolio.listPublications({ from, to });
  }
}
```

`listApprovals` E0: UNION review-queue theo scoped lifecycles (reuse `ContentWorkflowService.listReviewQueue` per id, cap N=20 lifecycle).

- [ ] **Step 4: Jest PASS + existing `content-marketing.controller.spec.ts` vẫn PASS**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio src/content-marketing/content-marketing.controller.spec.ts --no-coverage
```

- [ ] **Step 5: Commit** `feat(cmkte): add portfolio command-center and queue APIs`

---

### Task 6: DDL E0/E1 nền (bảng request + cột item)

**Files:**
- Create: `docs/specs/2026-09-10-postgresql-ddl-cmkt-e.sql`
- Create: `scripts/apply_pg_ddl_cmkt_e.sh`

**Không** phá CHECK status/channel hiện có. Chỉ ADD COLUMN nullable + bảng mới.

```sql
-- docs/specs/2026-09-10-postgresql-ddl-cmkt-e.sql
CREATE TABLE IF NOT EXISTS cmkt_content_requests (
    id              BIGSERIAL PRIMARY KEY,
    lifecycle_id    BIGINT NOT NULL REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    display_code    TEXT NOT NULL UNIQUE,
    source          TEXT NOT NULL,
    requester_email TEXT NOT NULL DEFAULT '',
    client_label    TEXT NOT NULL DEFAULT '',
    brand_label     TEXT NOT NULL DEFAULT '',
    deliverable_ask TEXT NOT NULL DEFAULT '',
    objective       TEXT NOT NULL DEFAULT '',
    due_at          TIMESTAMPTZ,
    priority        TEXT NOT NULL DEFAULT 'Standard',
    risk_level      TEXT NOT NULL DEFAULT 'Normal',
    completeness    INT NOT NULL DEFAULT 0,
    effort_h        NUMERIC,
    tier            TEXT,
    triage_status   TEXT NOT NULL DEFAULT 'Submitted',
    idea_id         BIGINT REFERENCES cmkt_content_ideas (id) ON DELETE SET NULL,
    created_by      VARCHAR(120) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_content_requests_source_check CHECK (
        source IN ('account', 'client_portal', 'campaign', 'api', 'idea')
    ),
    CONSTRAINT cmkt_content_requests_status_check CHECK (
        triage_status IN (
            'Submitted', 'Needs Clarification', 'Triaged', 'Accepted',
            'Converted', 'Cancelled', 'Rejected'
        )
    )
);

ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS display_code TEXT,
    ADD COLUMN IF NOT EXISTS request_id BIGINT REFERENCES cmkt_content_requests (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS master_id BIGINT REFERENCES cmkt_content_items (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'Normal',
    ADD COLUMN IF NOT EXISTS brief_score INT,
    ADD COLUMN IF NOT EXISTS brief_locked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cmkt_items_display_code
    ON cmkt_content_items (display_code) WHERE display_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS cmkt_asset_rights (
    id              BIGSERIAL PRIMARY KEY,
    item_id         BIGINT NOT NULL REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    asset_ref       TEXT NOT NULL,
    license_type    TEXT,
    channels        TEXT[] NOT NULL DEFAULT '{}',
    territory       TEXT,
    expiry_at       TIMESTAMPTZ,
    paid_ok         BOOLEAN NOT NULL DEFAULT FALSE,
    releases_ok     BOOLEAN NOT NULL DEFAULT FALSE,
    ai_declaration  BOOLEAN NOT NULL DEFAULT FALSE,
    status          TEXT NOT NULL DEFAULT 'Unknown',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_asset_rights_status_check CHECK (status IN ('Valid', 'Invalid', 'Unknown', 'Expiring'))
);

CREATE TABLE IF NOT EXISTS cmkt_approval_packages (
    id              BIGSERIAL PRIMARY KEY,
    item_id         BIGINT NOT NULL REFERENCES cmkt_content_items (id) ON DELETE CASCADE,
    snapshot_json   JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'Draft',
    created_by      VARCHAR(120) NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmkt_insights (
    id              BIGSERIAL PRIMARY KEY,
    lifecycle_id    BIGINT REFERENCES crm_service_lifecycle (id) ON DELETE CASCADE,
    pattern         TEXT NOT NULL,
    evidence        TEXT NOT NULL DEFAULT '',
    confidence      NUMERIC,
    status          TEXT NOT NULL DEFAULT 'Draft',
    scope_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cmkt_insights_status_check CHECK (
        status IN ('Draft', 'Approved', 'Rejected', 'Outdated', 'Superseded')
    )
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-10-cmkt-e', 'CMKT-E: requests, item display_code/master/rights, packages, insights')
ON CONFLICT (version) DO NOTHING;
```

Script: copy `scripts/apply_pg_ddl_content_marketing.sh`, đổi `DDL=` sang file mới.

- [ ] **Step 1:** Apply trên DB local (không prod cho đến khi user yêu cầu deploy).

```bash
DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}" \
  bash scripts/apply_pg_ddl_cmkt_e.sh
```

Expected: `OK` và `\d cmkt_content_requests` tồn tại.

- [ ] **Step 2: Commit** `feat(cmkte): add request/rights/package/insight DDL`

---

### Task 7: POST request + convert

**Files:**
- Modify: `content-os-portfolio.controller.ts` — POST
- Modify: `content-os-portfolio.service.ts` — `createRequest`, `convertRequest`
- Create: `content-os-portfolio.service.request.spec.ts`

**Interfaces:**
- Consumes: `formatContentRequestCode`, `requestCompleteness`, `ContentItemService.createItem`
- Produces: row `cmkt_content_requests`; convert → `cmkt_content_items.request_id` + `display_code`

- [ ] **Step 1: Test**

```ts
it('rejects missing deliverable', async () => {
  await expect(
    svc.createRequest({ lifecycleId: 1, actor: 'a@b.c', body: { objective: 'x' } }),
  ).rejects.toMatchObject({ status: 400 });
});

it('creates Submitted with completeness and CR code', async () => {
  repo.nextRequestSeq = jest.fn().mockResolvedValue(24);
  repo.insertRequest = jest.fn().mockImplementation(async (row) => row);
  const out = await svc.createRequest({
    lifecycleId: 1,
    actor: 'am@ptt.vn',
    body: {
      source: 'account',
      client_label: 'Client A',
      brand_label: 'Brand A',
      deliverable_ask: '12 social posts',
      objective: 'Awareness + qualified lead',
      due_at: '2026-09-20',
      priority: 'High',
    },
  });
  expect(out.display_code).toMatch(/^CR-\d{8}-024$/);
  expect(out.completeness).toBe(100);
  expect(out.triage_status).toBe('Submitted');
});
```

`convertRequest`: status `Accepted` → `Converted`; `createItem` với `request_id`; item `display_code` CNT.

- [ ] **Step 2–4: TDD + commit** `feat(cmkte): create and convert content requests`

---

### Task 8: CSS chrome + CmktEShell

**Files:**
- Create: `services/ops-web/src/styles/cmkte.css`
- Create: `services/ops-web/src/components/content-os/cmkte/CmktEShell.tsx`
- Create: `services/ops-web/src/app/crm/content-os/layout.tsx`
- Modify: `services/ops-web/src/app/layout.tsx` hoặc `content-os/layout` import CSS
- Create: `services/ops-web/src/lib/crm/cmkte-nav.ts` + spec (8 items + href)

Nav labels **khóa**:

```ts
export const CMKTE_NAV = [
  { screen: 'command', href: '/crm/content-os', label: 'Command Center', glyph: '▦' },
  { screen: 'requests', href: '/crm/content-os/requests', label: 'Content Requests', glyph: '◉' },
  { screen: 'workspace', href: '/crm/content-os/w/0', label: 'Production Workspace', glyph: '✦' },
  { screen: 'approvals', href: '/crm/content-os/approvals', label: 'Approval Center', glyph: '✓' },
  { screen: 'calendar', href: '/crm/content-os/calendar', label: 'Publication Control', glyph: '□' },
  { screen: 'library', href: '/crm/content-os/library', label: 'Brand & Asset Library', glyph: '▣' },
  { screen: 'intelligence', href: '/crm/content-os/intelligence', label: 'Content Intelligence', glyph: '◌' },
  { screen: 'settings', href: '/crm/content-os/settings', label: 'Governance Settings', glyph: '⚙' },
] as const;
```

Workspace href `w/0` chỉ placeholder nav; `CmktEShell` thay bằng last item id từ query/`localStorage` key `cmkte-last-item` — **không** bịa CNT.

CSS: copy biến từ mockup (`:root` trong HTML) vào `.cmkte-app`. **Không** dùng `StaffPageShell` double chrome trên COS (cùng lý do Creative OS). Layout: grid 258px + 1fr, sidebar `position: fixed`, top sticky 67px.

- [ ] **Step 1:** Vitest `cmkte-nav.spec.ts` — 8 label + glyph.
- [ ] **Step 2:** Implement CSS + Shell (auth reuse pattern `page.tsx` hiện tại: `canViewContentOs`, flag FE).
- [ ] **Step 3:** `layout.tsx` bọc children trong `CmktEShell`.
- [ ] **Step 4:** Commit `feat(cmkte): add COS operating shell matching mockup chrome`

---

### Task 9: Command Center page

**Files:**
- Modify: `services/ops-web/src/app/crm/content-os/page.tsx`
- Create: `services/ops-web/src/components/content-os/cmkte/CmktECommandCenter.tsx`
- Create: `services/ops-web/src/lib/crm/cmkte-api.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-api.spec.ts`

**Interfaces:**
- Consumes: `GET /api/crm/content-os/portfolio/command-center`
- Produces: tiles + risk table; empty copy khi throughput=0 và queue=[]

```ts
export async function fetchCommandCenter(token: string): Promise<PortfolioCommandCenter> {
  const res = await fetch(`${API_BASE}/api/crm/content-os/portfolio/command-center`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Không tải được Command Center');
  return res.json();
}
```

UI:
- H1 `Content Operations Command Center`
- Nút **Mở Publication Control** → `/crm/content-os/calendar`
- Nút **＋ Tạo Content Item** → mở `CmktERequestModal` (không nhảy workspace)
- Tiles: throughput, SLA at risk, capacity (`capacity_pct == null` → `—` + “Chưa có time tracking”)
- Bảng risk: deep link `/crm/content-os/w/{item_id}`
- Insight tuần: chỉ hiện nếu API trả insight `Approved`; không hardcode CTR +14%

- [ ] **Step 1:** Vitest `fetchCommandCenter` mock fetch.
- [ ] **Step 2:** Implement page; xóa bảng lifecycle “Content Board”.
- [ ] **Step 3:** Commit `feat(cmkte): render Command Center from portfolio API`

---

### Task 10: Requests UI + modal

**Files:**
- Create: `services/ops-web/src/app/crm/content-os/requests/page.tsx`
- Create: `services/ops-web/src/components/content-os/cmkte/CmktERequests.tsx`
- Create: `services/ops-web/src/components/content-os/cmkte/CmktERequestModal.tsx`

Form bắt buộc: Client/Brand, Nguồn, Deliverable, Objective, Due, Priority. Submit `POST .../portfolio/requests`. Success: toast (không `alert`), badge +1, ở lại Intake. **Triage & create** → `POST .../convert` → `router.push(cmktePath('workspace', itemId))`.

Cột ideas chưa convert: `GET` lifecycle ideas `status!=converted` merge vào bảng (label source `idea`).

- [ ] Tests: modal validation (thiếu deliverable không POST) — Vitest pure `validateRequestForm`.

```ts
export function validateRequestForm(f: {
  client: string; source: string; deliverable: string; objective: string; due: string;
}): string | null {
  if (!f.client.trim() || !f.source.trim() || !f.deliverable.trim() || !f.objective.trim() || !f.due.trim()) {
    return 'Thiếu trường bắt buộc — không tạo request.';
  }
  return null;
}
```

- [ ] Commit `feat(cmkte): operate Content Request intake from COS modal`

---

### Task 11: Workspace 8 tab + context + sticky

**Files:**
- Create: `services/ops-web/src/app/crm/content-os/w/[itemId]/page.tsx`
- Create: `services/ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx`
- Create: `services/ops-web/src/lib/crm/cmkte-tabs.ts` + spec

```ts
export const CMKTE_TABS = [
  { id: 'brief', label: '1. Brief & Strategy' },
  { id: 'architecture', label: '2. Content Architecture' },
  { id: 'copy', label: '3. Copy Studio' },
  { id: 'assets', label: '4. Assets, DAM & Rights' },
  { id: 'seo', label: '5. SEO & Distribution' },
  { id: 'production', label: '6. Production Plan' },
  { id: 'approvaltab', label: '7. Approval & Governance' },
  { id: 'publish', label: '8. Publish Control' },
] as const;
```

Bind dữ liệu **thật** từ `GET .../content-marketing/items/:id` + comments/versions/production/calendar. Tab trống = empty state tiếng Việt, **không** điền Sunlight.

E0 map:
1. Brief ← `brief_json`
2. Architecture ← pillars + `parent_item_id` derivations
3. Copy ← `body_json` + existing editor pieces từ `ContentOsPanel` (tách hook, không copy 2000 dòng một lần — extract `useCmktItem(lifecycleId, itemId)` từ panel)
4. Assets ← `media_json` / production asset_urls
5. SEO ← bridge status
6. Production ← `production_json`
7. Approval ← status + review actions hiện có (approve/reject ≥10)
8. Publish ← calendar slot + `evaluatePublishGate` + Mark published (`POST .../publish`)

Sticky: Previous / Save & validate / Next; tab cuối = **Send to approval** → nếu Blocked: ở tab 8 + toast blockers; nếu Pass: `POST submit-review` rồi `/approvals`.

Context bar 6 ô: org (workspace name), client/brand từ lifecycle context API, market `vi-VN` nếu có, campaign từ snapshot, owner/AM từ assignees, risk + SLA từ item.

- [ ] Vitest `nextTabLabel(id)` khớp mockup.
- [ ] `itemId=0` hoặc 404 → empty “Chọn item từ Requests / Command Center”.
- [ ] Commit `feat(cmkte): Production Workspace 8 tabs bound to cmkt item`

---

### Task 12: Approval Center + Publication + Library/Intelligence/Settings

**Files:**
- Create pages: `approvals/page.tsx`, `calendar/page.tsx`, `library/page.tsx`, `intelligence/page.tsx`, `settings/page.tsx`
- Create matching `CmktE*.tsx`

**Approvals:** `GET portfolio/approvals`. Actions Review → workspace tab 7. Escalate / Open portal: toast đúng copy spec (portal không lộ internal). Reuse `approve`/`reject` lifecycle API.

**Calendar:** `GET portfolio/publications` + existing calendar. Gate Blocked row không hiện CTA “Vào queue”.

**Library:** list brand kits **deep link** `/crm/creative-os/brand-kits` nếu `crm_cp.view`; assets từ item media. Không clone DAM.

**Intelligence:** `GET intelligence/summary` per scoped lifecycle. Nút Approve insight **disabled** đến Task 26 (E2); E0 hiện Draft + warning “Copilot không dùng”.

**Settings:** read flags `approval_required`, `client_gate` từ `GET context` (đã có). Switch connector **off** disabled. Save = 403 trừ admin — E0 chỉ hiển thị.

- [ ] Vitest `canOpenCreativeOsBrandKit(caps)` true chỉ khi `crm_cp.view`.
- [ ] `auth.spec.ts`: `/crm/content-os/approvals` cùng cap `/crm/content-os`.
- [ ] Commit `feat(cmkte): add COS approvals calendar library intelligence settings`

---

### Task 13: Redirect tab cũ + rbac paths

**Files:**
- Modify: `services/ops-web/src/app/crm/service-delivery/[id]/page.tsx`
- Modify: `services/ops-web/src/lib/auth.spec.ts`
- Modify: `services/ops-web/src/components/crm/cp/CpProjectsList.tsx` — href `legacyContentOsRedirect`

Khi `tab=content-os`: `router.replace(legacyContentOsRedirect(id))`.

```ts
it('/crm/content-os/w/21 uses same crm_content caps', () => {
  const content = user([{ section: 'crm_content', action: 'view' }]);
  expect(canAccessPath('/crm/content-os/w/21', content, 'crm')).toBe(true);
});
```

`rbac-routes` prefix `/crm/content-os` đã cover path con.

- [ ] Commit `feat(cmkte): redirect legacy content-os tab into COS shell`

---

### Task 14: E0 E2E + UAT exit

**Files:**
- Create: `services/ops-web/e2e/cmkte-shell.spec.ts`
- Modify: `docs/huong-dan-su-dung/18-content-marketing-os.md` — IA mới (ngắn, không viết lại toàn bộ)

Playwright (login fixture sẵn có trong e2e):

1. Flag on + cap → thấy nav **Content Marketing OS**.
2. `/crm/content-os` H1 Command Center.
3. Click ＋ Tạo Content Item → dialog “Tạo Content Request”.
4. Submit thiếu field → vẫn trên modal (role=dialog).
5. Workspace 8 tab names.
6. Save & validate khi thiếu approval → text `/BLOCKED/`.

```ts
test('create item opens request dialog', async ({ page }) => {
  await page.goto('/crm/content-os');
  await page.getByRole('button', { name: /Tạo Content Item/ }).click();
  await expect(page.getByRole('heading', { name: 'Tạo Content Request' })).toBeVisible();
});
```

Chạy:

```bash
cd services/ops-web && npx playwright test e2e/cmkte-shell.spec.ts
cd services/ptt-crm-api && npx jest src/content-os-portfolio --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/cmkte- src/lib/crm/content-os-hub.util.spec.ts src/lib/auth.spec.ts
```

**Exit E0:** UAT lifecycle `tiep-thi-noi-dung`: Request → workspace 8 tab → Save & validate → Send to approval (hoặc block) → Mark published khi Pass. Screenshot so mockup chrome.

- [ ] Commit `test(cmkte): e2e COS shell and update operator guide IA`

---

## Wave E1 — Governance

### Task 15: Brief completeness + lock

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/brief-score.util.ts` + spec
- Modify: `content-item.service.ts` patch brief; reject `submit-review` nếu score < threshold

```ts
export function briefCompleteness(brief: Record<string, unknown>, weights: Record<string, number>): number {
  const keys = Object.keys(weights);
  const sumW = keys.reduce((s, k) => s + weights[k], 0) || 1;
  const done = keys.reduce((s, k) => {
    const v = brief[k];
    const filled = v != null && String(v).trim() !== '' && !(Array.isArray(v) && v.length === 0);
    return s + (filled ? weights[k] : 0);
  }, 0);
  return Math.round((done / sumW) * 100);
}

export const DEFAULT_BRIEF_WEIGHTS = {
  objective: 15,
  funnel: 10,
  persona: 8,
  smm: 15,
  proofs: 12,
  restricted: 10,
  disclaimer: 15,
  cta: 10,
  kpi: 5,
};
```

Threshold: 80 standard / 95 nếu `risk_level` ∈ `Brand-Sensitive|Regulated` (BR-010).

`submit-review` ném `{ error: 'brief_incomplete', score, threshold }`. FE map trong `parseCmktGateError`.

Lock: `POST items/:id/brief/lock` (write+approve_internal) set `brief_locked_at`. Patch brief khi locked → 409 `brief_locked` trừ version mới (E1: bắt buộc `force_version=true` + audit).

- [ ] Commit `feat(cmkte): brief completeness gate and section lock`

---

### Task 16: Master / deliverable

**Files:**
- Modify: `content-item.service.ts` `createItem` — nếu `body.as_master`, `master_id=null`, `display_code` CNT
- Modify: `content-repurpose.service.ts` — derivation set `master_id`
- FE Architecture tab: bảng deliverable từ items `master_id = current` + self

Promote: `POST items/:id/promote-master` (write). Item cũ `master_id` null = deliverable đơn (spec 5.2).

Test: convert request tạo 1 item master; repurpose tạo child `master_id`.

- [ ] Commit `feat(cmkte): master and deliverable graph on cmkt items`

---

### Task 17: Asset rights + bind gate

**Files:**
- Create: `content-os-portfolio/asset-rights.service.ts` + spec
- Controller lifecycle: `GET/PUT items/:id/rights`
- Modify: `content-item.service.ts` `publishItem` — gọi `evaluatePublishGate`; nếu Blocked → 409 `{ error: 'publish_gate_blocked', blockers }`

Rights row `Unknown` hoặc `Invalid` trên asset required → `rightsValid=false`.

Override: `POST rights/:id/override` cần `crm_content.qa` + `reason` ≥ 10 + `evidence` — audit. E1 không cho override từ UI thường (BR-056).

- [ ] Test: `rightsValid=false` → publish throws `publish_gate_blocked`.
- [ ] Commit `feat(cmkte): asset rights block publish gate`

---

### Task 18: Approval package lock

**Files:**
- Create: `approval-package.service.ts`
- `POST items/:id/submit-review` tạo `cmkt_approval_packages.snapshot_json` = `{ body_json, brief_json, media, rights, disclaimer }`
- Patch body khi package `Sent` → 409 `package_locked` (phải version mới)

Reject / changes: comment ≥ 10 (đã có).

- [ ] Commit `feat(cmkte): immutable approval package on submit`

---

### Task 19: Matrix — một rule Legal

**Files:**
- Create: `approval-matrix.util.ts` + spec

```ts
export function applyApprovalMatrix(attrs: {
  riskLevel: string;
  claimCategories: string[];
  paidIntent: boolean;
  paidOk: boolean;
  marketCount: number;
}): { steps: string[]; gateBlockers: string[] } {
  const steps = ['owner'];
  if (['Brand-Sensitive', 'Regulated'].includes(attrs.riskLevel)) steps.push('content_lead');
  if (attrs.claimCategories.some((c) => ['Financial', 'Health', 'Legal'].includes(c))) {
    steps.push('legal');
  }
  steps.push('account_director', 'client');
  const gateBlockers: string[] = [];
  if (attrs.paidIntent && !attrs.paidOk) gateBlockers.push('Paid media rights invalid');
  return { steps, gateBlockers };
}
```

Claim detector E1: lexeme từ `brief_json.restricted` + highlight copy (FR-COPY-011) — danh sách tenant settings, mặc định `['cam kết sinh lời','giá rẻ','số 1']`.

- [ ] Commit `feat(cmkte): dynamic matrix legal step and paid rights blocker`

---

### Task 20: Collision warning

**Files:**
- Modify: `content-calendar.service.ts` — khi upsert slot, query cùng `lifecycle` + channel + `scheduled_at` ± 2h + cùng pillar id
- Return `{ collision: { item_id, at } | null }`
- FE tab SEO/Publish: notice warning (không block E1)

- [ ] Commit `feat(cmkte): publication collision warning`

---

### Task 21: Client package hide internals

**Files:**
- Modify: `portal-content-marketing` summary DTO — strip `internal_note`, `cost`, `hidden_rule`, `ai_prompt`
- Spec: portal payload keys không chứa `prompt` / `cost`

- [ ] Commit `feat(cmkte): hide internal fields from client approval package`

---

### Task 22: E1 acceptance

Chạy:

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio src/content-marketing/content-item.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/cmkte-
```

UAT: sửa claim sau approve → version mới + Legal step nếu rule on. Rights Invalid không Mark published.

- [ ] Commit `test(cmkte): E1 governance acceptance`

---

## Wave E2 — Control room

### Task 23: Capacity + critical path (số thật)

**Files:**
- Create: `production-capacity.util.ts`
- Chỉ tính nếu `production_json.effort_h` + assignee có tổng effort / 40h tuần. **Không** có data → `capacity_pct: null`.
- Critical path: task `dependency` FS trong `production_json.tasks[]` (schema E2):

```ts
export type CmktETask = {
  id: string;
  title: string;
  assignee_id: number | null;
  raci: { r: string; a: string; c?: string; i?: string };
  depends_on: string[];
  sla_h: number;
  effort_h: number;
  status: 'todo' | 'doing' | 'done' | 'blocked';
};
```

Threshold 80/90/100 (BR-043). Auto-reassign **tắt**.

- [ ] Commit `feat(cmkte): real capacity and critical path from production tasks`

---

### Task 24: SLA reminder / at-risk / breach

**Files:**
- Worker hoặc cron nhẹ trong `ContentJobWorkerService`: 75% reminder in-app, 90% `SLA At Risk`, quá = `SLA Breached` + notify AM (`FR-AUD-006`)
- Không gửi email spam — 1 event / task / ngưỡng

- [ ] Commit `feat(cmkte): SLA risk and breach events`

---

### Task 25: Insight approve → Copilot whitelist

**Files:**
- `POST /api/crm/content-os/portfolio/insights/:id/approve` (`approve_internal`)
- Modify generate context: chỉ `cmkt_insights.status='Approved'` AND `expires_at > now()`
- FE Intelligence: Enable **Approve insight**
- Test: Draft insight không nằm trong `copilotSources`

- [ ] Commit `feat(cmkte): approve insights before copilot grounding`

---

### Task 26: AI Trace UI

**Files:**
- GET `items/:id/ai-traces` từ `cmkt_content_jobs` + `ai_agent_runs` nếu có
- Copy Studio panel: list time, intent, sources — không hiện raw prompt cho client
- Cap `crm_content.generate` để xem

- [ ] Commit `feat(cmkte): show AI trace in Copy Studio`

---

### Task 27: Publication retry log + channel health

**Files:**
- Table `cmkt_publication_logs` (attempted_at, error, retry_n, post_id)
- E2: log khi Mark published fail (4xx/5xx tay)
- Channel health: token expiry **chỉ** nếu connector row tồn tại; không thì `Manual`

- [ ] Commit `feat(cmkte): publication execution log and channel health`

---

### Task 28: Batch approval + delegate stub

**Files:**
- `POST portfolio/approvals/batch` — max 20 item, cùng step scope, SoD BR-050
- Delegate: cột `delegate_until` trên step — E2 minimal

- [ ] Commit `feat(cmkte): batch approval and time-boxed delegate`

---

### Task 29: E2 acceptance

Insight Draft không vào generate. Capacity null không hiện 78%. Escalation tạo audit.

- [ ] Commit `test(cmkte): E2 control room acceptance`

---

## Wave E3 — Enterprise fabric

### Task 30: Connector framework (off)

**Files:**
- `cmkt_channel_accounts` + `cmkt_connectors`  
- Settings switch `direct_social_publish` default **false**
- Interface:

```ts
export type PublishConnector = {
  id: string;
  publish(pkg: PublicationPackage): Promise<{ post_id: string }>;
};
```

Không implement Facebook/IG API trong task này ngoài stub `NotEnabledError`. Human confirm vẫn bắt buộc (BR-020, BR-CMKT-01).

- [ ] Commit `feat(cmkte): publish connector interface default off`

---

### Task 31: DAM pull adapter

**Files:**
- `DamAdapter.list({ collection })` — stub + URL metadata
- Rights pull optional
- Library “Chọn từ DAM” gọi adapter; fail → empty + error

- [ ] Commit `feat(cmkte): DAM orchestration adapter`

---

### Task 32: SSO / SCIM

Không tự dựng IdP. Document + hook: dùng Staff SSO hiện có. SCIM = ngoài scope code trừ flag `sso_enforced` trên Settings (read-only E3 nếu chưa có IdP).

- [ ] Commit `docs(cmkte): SSO SCIM follows existing staff identity`

---

### Task 33: Retention + legal hold + export audit

**Files:**
- Audit export CSV `GET portfolio/audit/export` — chính export bị audit (FR-AUD-004)
- `legal_hold` boolean trên item: chặn hard delete
- Retention copy trong Settings (7 năm audit)

- [ ] Commit `feat(cmkte): audit export and legal hold`

---

### Task 34: Localization memory

**Files:**
- `cmkt_glossary` (term, locale, brand_id)
- Copy highlight + FR-COPY-012
- Copilot được dùng glossary approved

- [ ] Commit `feat(cmkte): brand glossary localization memory`

---

## Coverage SRS → Task

| Spec | Task |
|---|---|
| FR-CMD-001…008 | 4, 5, 9 |
| FR-REQ-001…009 | 3, 6, 7, 10 |
| FR-CTX-001…005 | 11 |
| FR-BRF-001…007 | 11, 15 |
| FR-ARC-001…006 | 11, 16 |
| FR-COPY-001…012 | 11, 19, 34 |
| FR-AI-001…010 | 26, 25, Global BR-AI-01 |
| FR-AST-001…011 | 11, 17, 31 |
| FR-SEO-001…009 | 11, 20 |
| FR-PROD-001…011 | 11, 23, 24 |
| FR-APR-001…017 | 12, 18, 19, 21, 28 |
| FR-PUB-001…012 | 2, 12, 17, 20, 27, 30 |
| FR-INT-001…007 | 12, 25 |
| FR-AUD-001…008 | 24, 33 |
| FR-LIB / FR-SET | 12, 30 |
| BR-001…057 | Gate/util tasks 2, 15, 17–19, 23–24 |
| NFR-PERF/REL/SEC | Keep existing API; async jobs đã có; E3 secrets không ra browser |
| UI mockup inventory | 8–12, 14 |
| Handoff Video / Creative OS | 12 Library + workspace ••• links (không làm Video AI) |
| Ngoài phạm vi | Không task pixel editor, payroll, ad buy, listening, fake clients |

---

## Verify commands (mọi wave)

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio src/content-marketing/content-marketing.controller.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/cmkte- src/lib/crm/content-os-hub.util.spec.ts src/lib/auth.spec.ts src/lib/content-marketing-flags.spec.ts
cd services/ops-web && npx playwright test e2e/cmkte-shell.spec.ts
```

Deploy **chỉ khi user yêu cầu**. Prod: apply DDL `2026-09-10-postgresql-ddl-cmkt-e.sql` rồi rebuild ops-web với `NEXT_PUBLIC_CONTENT_MARKETING=1`. Không seed dataset mockup.
