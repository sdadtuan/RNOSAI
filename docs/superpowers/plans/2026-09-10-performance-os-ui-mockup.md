# Performance OS UI Mockup Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Phạm vi:** Chỉ UI ops-web + copy/nav/CSS + **read-only** mở rộng API dashboard (display label ledger, rhythm CTA, nav badge counts). **Không** sửa domain engine Performance OS đã ship (`performance-score`, `performance-ritual`, …).

**Goal:** Khớp 11 màn Performance OS trong `docs/design/rnosai-performance-management-mockup.html` (PM-01…PM-11) với production `/crm/kpi-hub/performance/*` — layout, copy tiếng Việt mockup, tile grid 6/5/4 cột, moat notice, sidebar side-note + badge, không iframe.

**Architecture:** Tạo primitive `Pm*` UI trong `components/kpi-hub/performance/` (tách khỏi `ServiceKpiSummaryTiles`). Mỗi `page.tsx` compose shell + subtitle PM-XX + tiles/layout mockup. Data từ `performance-api.ts` hiện có; bổ sung field hiển thị (`display`, `cta_label`) trên dashboard response nếu formatter frontend không đủ.

**Tech Stack:** Next.js App Router (`services/ops-web`), CSS `kpi-hub-pm-*` trong `globals.css`, Vitest copy/nav, Playwright `e2e/performance-os-hub.spec.ts`.

**Spec:** `docs/superpowers/plans/2026-09-10-performance-os-kpi-hub.md` (backend + routes đã ship)  
**Mockup:** `docs/design/rnosai-performance-management-mockup.html`

## Global Constraints

- UI **không iframe** — chỉ compose React trong App Router.
- Copy subtitle mỗi màn: `PM-XX · …` **đúng chuỗi mockup** (không paraphrase).
- Tile label mockup dùng ALL CAPS: `ĐÚNG TIẾN ĐỘ`, `DATA BLOCKED`, `MEDIA SPEND`, …
- Tile **DATA BLOCKED** (PM-01) phải có nền đỏ nhạt + viền (`kpi-hub-pm-tile-blocked`).
- Moat copy (`Lattice`, `15Five`, `AgencyAnalytics`) chỉ trên dashboard + check-in + CRM — không bịa competitor mới.
- Sidebar HIỆU SUẤT: side-note **Performance OS · moat** + badge **58** (Registry) + **06** (Check-in) như mockup.
- Không đụng Service KPI pages (đã align SKPI). Tái dùng pattern `SkpiFilterChips` / `SkpiTwoColumnLayout` nếu phù hợp — đặt tên `PmFilterChips`, `PmTwoColumnLayout`.
- TDD: Vitest cho copy constants + nav badges; Playwright smoke per screen; không test trivial CSS.
- Commit sau mỗi task. Không `--no-verify`.

---

## Chẩn đoán gap (hiện trạng vs mockup)

| Màn | Route | Backend | UI gap chính |
|---|---|---|---|
| **Shell** | `KpiHubShell` | — | Chỉ có side-note Service KPI; **thiếu** Performance OS side-note + nav badge 58/06; search placeholder generic |
| **PM-01** Dashboard | `/performance` | ✅ dashboard API | **6 tile** dùng `ServiceKpiSummaryTiles` (grid 4 cột) → wrap sai; tile DATA BLOCKED thiếu nền đỏ; **Ledgers** format số (`100.000`) thay vì `≤100K CPL` / `128K · Pending`; rhythm button luôn **Mở** thay vì Registry/CRM Map/Duyệt; check-in hint hardcode `watch ? '6' : '0'` |
| **PM-02** Registry | `/assignments` | ✅ | Filter dùng ghost button, mockup dùng **chip** `.filter`; tabs OK; table structure gần đúng |
| **PM-03** Tạo Assignment | `/assignments/new` | ✅ readiness | Layout two-col + readiness rail có; verify formula block + gate copy mockup |
| **PM-04** Scorecard | `/scorecards` | ✅ | Weight allocation sidebar; verify sticky aside + item table mockup |
| **PM-05** Thêm chỉ tiêu | `/scorecards/items` | ✅ | Weight realtime + block notice AC-PM-01 |
| **PM-06** Check-in | `/check-ins` | ✅ ritual | Modal ad-hoc `modal-backdrop` — cần `PmModal` khớp mockup; metric grid OK |
| **PM-07** Marketing | `/marketing` | ✅ | **5 tile** dùng grid 4 cột; ROAS N/A tone |
| **PM-08** Campaign | `/campaigns` | ✅ | Funnel KPI nested trong card — cần inline 4-col trong card, không full-width 4-col page |
| **PM-09** CRM Map | `/crm-source` | ✅ | Moat AC-PM-04; **5 tile** grid 5 cột |
| **PM-10** Reports | `/reports` | ✅ | **5 tile** + `ScopeBar` inline style → cần `.kpi-hub-pm-stackrow`; toast mockup |
| **PM-11** Policy | `/settings` | ✅ | Policy cards + aside firewall |

### Nguyên nhân “UI không giống mockup” trên VPS

1. **Layout primitives sai:** tái dùng `ServiceKpiSummaryTiles` (`kpi-hub-skpi-kpis`, 4 cột) cho mọi màn PM → dashboard 6 tile và marketing/reports 5 tile bị xuống hàng / co giãn sai.
2. **Hiển thị ledger semantic:** API trả `value: 100000` (number); UI `toLocaleString` → `100.000` thay vì mockup `≤100K CPL`.
3. **Shell thiếu context:** mockup có side-note Performance OS + badge count — production chỉ có Service KPI side-note.
4. **Rhythm CTA generic:** mockup nút từng bước khác nhau; component luôn render "Mở".
5. **Empty/error state:** nếu API lỗi hoặc chưa restart service → `PmPageState` trống, không có demo tiles như mockup (backend in-memory catalog đã seed — cần verify deploy).

---

## File map

| File | Trách nhiệm |
|---|---|
| `lib/performance-copy.ts` | Hằng PM subtitles, rhythm CTA labels, side-note (Vitest) |
| `lib/performance-copy.spec.ts` | Lock copy mockup |
| `components/kpi-hub/performance/PmSummaryTiles.tsx` | Grid 6 / 5 / 4 cột + variant `blocked` |
| `PmFilterChips.tsx` | Filter chip mockup (hoặc re-export pattern Skpi) |
| `PmTwoColumnLayout.tsx` | `main + sticky aside 320px` |
| `PmModal.tsx` | Modal overlay mockup (check-in, action) |
| `PmScopeBar.tsx` | Stack row báo cáo (thay inline style Reports) |
| `PmLedgers.tsx` | Hiển thị `display` string + tone amber pending |
| `PmWeeklyRhythm.tsx` | Flow row + CTA label per step |
| `hooks/usePerformanceNavBadges.ts` | Registry count + overdue check-in count |
| `lib/kpi-hub-nav.ts` | `badgeKey: 'registry' \| 'checkIn'` cho HIỆU SUẤT |
| `components/kpi-hub/KpiHubShell.tsx` | Side-note Performance khi group visible |
| `globals.css` | `.kpi-hub-pm-kpis--6`, `--5`, `--4`, `.kpi-hub-pm-tile-blocked`, `.kpi-hub-pm-filter`, `.kpi-hub-pm-stackrow`, `.kpi-hub-pm-modal` |
| 11 `page.tsx` under `performance/` | Swap tiles + layout |
| `ptt-crm-api/.../performance.types.ts` | Optional: `display` on ledger cells, `cta_label` on rhythm |
| `e2e/performance-os-ui-mockup.spec.ts` | Subtitle + tile grid + side-note smoke |

---

## Shared contracts

```ts
// lib/performance-copy.ts
export const PM_SUBTITLES = {
  dashboard:
    'PM-01 · Nhịp tuần agency — không phải dashboard OKR generic. Scope: PTT Growth · Tháng 09/2026',
  registry: 'PM-02 · Direction-aware · quality chip · Quoted Δ. Không average raw đơn vị.',
  create: 'PM-03 · Prefill Dictionary Active. Custom KPI cần approval. Activate bị chặn nếu readiness đỏ.',
  scorecard:
    'PM-04 · Inherit Service Template DV04 + Quote snapshot. Weight = 100% mới Active.',
  scorecardItem:
    'PM-05 · Weight realtime. Target ngoài template range → approval cùng Contract Score.',
  checkin:
    'PM-06 · TEC_008 · Lower-is-better · Auto actual locked · Red bắt buộc blocker.',
  marketing:
    'PM-07 · Source health bắt buộc. ROAS = N/A nếu attribution thiếu — không bịa số đẹp.',
  campaign:
    'PM-08 · Inherit Instance từ Quote. Media budget ≠ agency fee. Funnel không bịa stage thiếu mapping.',
  crm: 'PM-09 · Rule versioned. Stale cascade sang CPL. Không PII lead-level.',
  reports:
    'PM-10 · Kỳ đóng đọc snapshot bất biến. Export = field-level + audit. Không mix 2 formula version.',
  policy: 'PM-11 · Policy pack Performance — cadence, export ACL, close gate, assumption TTL.',
} as const;

export const SIDE_NOTE_PERFORMANCE_OS =
  'Không đánh Lattice/AgencyAnalytics. Thắng bằng 3 sổ Quoted/Assigned/Verified + quality cascade + snapshot vào báo giá lần sau.';

export const RHYTHM_CTA: Record<string, string> = {
  assumption: 'Mở',
  at_risk: 'Registry',
  stale: 'CRM Map',
  gm: 'Contract',
  scorecard: 'Duyệt',
};
```

```ts
// PmSummaryTiles — cols 6 | 5 | 4
export type PmTile = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn' | 'critical';
  variant?: 'default' | 'blocked'; // blocked = redSoft background
};
```

---

## Sóng triển khai

| Sóng | Ship | Tasks |
|---|---|---|
| A | Primitives + CSS + copy constants | 1–4 |
| B | Shell side-note + nav badges | 5–6 |
| C | PM-01 Dashboard polish | 7–9 |
| D | PM-02 Registry + PM-03 Create | 10–11 |
| E | PM-04 Scorecard + PM-05 Item | 12–13 |
| F | PM-06 Check-in modal | 14 |
| G | PM-07 Marketing + PM-08 Campaign | 15–16 |
| H | PM-09 CRM + PM-10 Reports + PM-11 Policy | 17–19 |
| I | E2E + VPS verify | 20 |

---

### Task 1: Copy constants + Vitest

**Files:**
- Create: `services/ops-web/src/lib/performance-copy.ts`
- Create: `services/ops-web/src/lib/performance-copy.spec.ts`

**Steps:**
- [ ] Copy toàn bộ `PM_SUBTITLES`, `SIDE_NOTE_PERFORMANCE_OS`, `RHYTHM_CTA` từ mockup HTML (11 subtitles).
- [ ] Vitest assert length 11, exact strings cho dashboard + registry.
- [ ] Run: `npm run test -w ops-web -- performance-copy`
- [ ] Commit: `feat(pm-ui): lock Performance OS mockup copy constants`

---

### Task 2: PmSummaryTiles + CSS grid variants

**Files:**
- Create: `services/ops-web/src/components/kpi-hub/performance/PmSummaryTiles.tsx`
- Modify: `services/ops-web/src/app/globals.css`

**Steps:**
- [ ] Component nhận `cols: 6 | 5 | 4` → class `kpi-hub-pm-kpis--{n}`.
- [ ] Variant `blocked` → `kpi-hub-pm-tile-blocked` (redSoft bg, red border).
- [ ] Typography: label 8px uppercase, value 22px — match mockup `.kpi`.
- [ ] Vitest smoke render 6 tiles (optional snapshot-free: assert class names).
- [ ] Commit: `feat(pm-ui): PmSummaryTiles 6/5/4 column grid`

---

### Task 3: PmFilterChips + PmTwoColumnLayout

**Files:**
- Create: `PmFilterChips.tsx`, `PmTwoColumnLayout.tsx`
- Modify: `globals.css` (`.kpi-hub-pm-filter`, reuse `.kpi-hub-pm-layout` sticky aside)

**Steps:**
- [ ] Filter chip: active state border blue (mirror `SkpiFilterChips`).
- [ ] Two-column: main + aside 320px sticky top 16px.
- [ ] Commit: `feat(pm-ui): filter chips and two-column layout primitives`

---

### Task 4: PmModal + PmScopeBar

**Files:**
- Create: `PmModal.tsx`, `PmScopeBar.tsx`
- Modify: `globals.css` (`.kpi-hub-pm-modal`, `.kpi-hub-pm-stackrow`)

**Steps:**
- [ ] Modal: fixed overlay, centered card max 720px, head/body/foot — thay inline modal check-in.
- [ ] ScopeBar: extract từ Reports page inline styles.
- [ ] Commit: `feat(pm-ui): modal and scope bar components`

---

### Task 5: Performance nav badges hook + nav config

**Files:**
- Create: `services/ops-web/src/hooks/usePerformanceNavBadges.ts`
- Modify: `services/ops-web/src/lib/kpi-hub-nav.ts`
- Modify: `services/ops-web/src/lib/kpi-hub-nav.spec.ts` (if exists)

**Steps:**
- [ ] Hook gọi `fetchPmAssignments` count + `fetchPmCheckIns` overdue (hoặc dedicated `GET /performance/nav-badges` nếu cần — prefer derive từ existing list APIs).
- [ ] `badgeKey: 'registry'` → `/performance/assignments`; `'checkIn'` → `/performance/check-ins?overdue=1`.
- [ ] Fallback mockup numbers 58 / 06 khi API empty (dev only) — **production dùng số thật**.
- [ ] Commit: `feat(pm-ui): performance nav badge counts`

---

### Task 6: KpiHubShell Performance side-note

**Files:**
- Modify: `services/ops-web/src/components/kpi-hub/KpiHubShell.tsx`

**Steps:**
- [ ] `showPmSideNote` khi group `performance` visible.
- [ ] Render side-note `<strong>Performance OS · moat</strong>` + `SIDE_NOTE_PERFORMANCE_OS`.
- [ ] Wire `usePerformanceNavBadges` vào `navBadgeCount`.
- [ ] Search placeholder on performance routes: `Tìm KPI, owner, client, quote, campaign…`
- [ ] Commit: `feat(pm-ui): Performance OS sidebar side-note and badges`

---

### Task 7: API ledger display labels (minimal)

**Files:**
- Modify: `services/ptt-crm-api/src/kpi-hub/performance/performance.types.ts`
- Modify: `services/ptt-crm-api/src/kpi-hub/performance/performance.service.ts` (dashboard)
- Modify: `services/ops-web/src/lib/performance-types.ts`

**Steps:**
- [ ] Ledger cell thêm optional `display: string` (e.g. `≤100K CPL`, `128K · Pending`).
- [ ] Service format từ seed CPL assignment; verified pending → amber display.
- [ ] Rhythm item thêm optional `cta_label` (hoặc map frontend từ `id` via `RHYTHM_CTA`).
- [ ] API test: dashboard ledgers include display strings.
- [ ] Commit: `feat(pm-api): dashboard ledger display labels for UI mockup`

---

### Task 8: PmLedgers + PmWeeklyRhythm polish

**Files:**
- Modify: `PmLedgers.tsx`, `PmWeeklyRhythm.tsx`

**Steps:**
- [ ] Ledgers: prefer `display` over numeric fmt; amber class on verified pending.
- [ ] Rhythm: flow row with numbered dot; CTA from `cta_label ?? RHYTHM_CTA[id]`.
- [ ] Commit: `feat(pm-ui): ledger display and rhythm CTA labels`

---

### Task 9: PM-01 Dashboard page

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/page.tsx`

**Steps:**
- [ ] Replace `ServiceKpiSummaryTiles` → `PmSummaryTiles cols={6}`.
- [ ] DATA BLOCKED tile `variant="blocked"`.
- [ ] Fix check-in hint: use `data.queue` overdue count or new API field — không hardcode from `watch`.
- [ ] Import subtitle from `performance-copy.ts`.
- [ ] Manual: open `/crm/kpi-hub/performance` — 6 tiles one row desktop.
- [ ] Commit: `feat(pm-ui): align PM-01 dashboard with mockup`

---

### Task 10: PM-02 Assignment Registry

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi-hub/performance/assignments/page.tsx`

**Steps:**
- [ ] Replace filter ghost buttons → `PmFilterChips` (Tháng 09/2026, Toàn công ty, Quality, Direction).
- [ ] Subtitle from copy constants.
- [ ] Commit: `feat(pm-ui): align PM-02 registry filters with mockup`

---

### Task 11: PM-03 Tạo Assignment

**Files:**
- Modify: `assignments/new/page.tsx`

**Steps:**
- [ ] Verify two-column layout + readiness rail matches mockup `#create`.
- [ ] Formula + classification block styling (`kpi-hub-pm-formula` if missing).
- [ ] Commit: `feat(pm-ui): align PM-03 create assignment layout`

---

### Task 12: PM-04 Scorecard Builder

**Files:**
- Modify: `scorecards/page.tsx`

**Steps:**
- [ ] `PmTwoColumnLayout`: form + allocation aside sticky.
- [ ] Item table columns match mockup.
- [ ] Commit: `feat(pm-ui): align PM-04 scorecard builder`

---

### Task 13: PM-05 Thêm chỉ tiêu

**Files:**
- Modify: `scorecards/items/page.tsx`

**Steps:**
- [ ] Weight total 100% indicator; AC-PM-01 block notice.
- [ ] Commit: `feat(pm-ui): align PM-05 scorecard item add`

---

### Task 14: PM-06 Check-in Ritual modal

**Files:**
- Modify: `check-ins/page.tsx`
- Use: `PmModal.tsx`

**Steps:**
- [ ] Replace inline modal-backdrop with `PmModal`.
- [ ] Toast message fixed bottom-right (mockup `.toast`).
- [ ] Commit: `feat(pm-ui): align PM-06 check-in modal with mockup`

---

### Task 15: PM-07 Marketing OS

**Files:**
- Modify: `marketing/page.tsx`

**Steps:**
- [ ] `PmSummaryTiles cols={5}` — MEDIA SPEND, VALID LEADS, CPL, MQL, ROAS.
- [ ] ROAS N/A muted tone when `display === 'N/A'`.
- [ ] Commit: `feat(pm-ui): align PM-07 marketing tiles`

---

### Task 16: PM-08 Campaign Control

**Files:**
- Modify: `campaigns/page.tsx`

**Steps:**
- [ ] Funnel section: nested `PmSummaryTiles cols={4}` inside card (not page-level).
- [ ] Budget vs fee notice.
- [ ] Commit: `feat(pm-ui): align PM-08 campaign funnel layout`

---

### Task 17: PM-09 CRM Source Map

**Files:**
- Modify: `crm-source/page.tsx`

**Steps:**
- [ ] Moat AC-PM-04 at top.
- [ ] `PmSummaryTiles cols={5}` for source health tiles.
- [ ] Commit: `feat(pm-ui): align PM-09 CRM source map`

---

### Task 18: PM-10 Snapshot Report

**Files:**
- Modify: `reports/page.tsx`

**Steps:**
- [ ] `PmSummaryTiles cols={5}`.
- [ ] `PmScopeBar` for by_scope rows.
- [ ] Toast component for export success.
- [ ] Commit: `feat(pm-ui): align PM-10 snapshot report`

---

### Task 19: PM-11 Policy

**Files:**
- Modify: `settings/page.tsx`

**Steps:**
- [ ] Two-column policy cards + firewall aside.
- [ ] Subtitle from copy constants.
- [ ] Commit: `feat(pm-ui): align PM-11 policy page`

---

### Task 20: E2E smoke + verification

**Files:**
- Create: `services/ops-web/e2e/performance-os-ui-mockup.spec.ts`
- Extend: `e2e/performance-os-hub.spec.ts`

**Steps:**
- [ ] Assert Performance side-note visible on `/performance`.
- [ ] Assert `.kpi-hub-pm-kpis--6` has 6 children on dashboard.
- [ ] Assert PM-02 filter chips, PM-07 five tiles.
- [ ] Run: `npm run test:e2e -w ops-web -- performance-os-ui-mockup`
- [ ] Run: `npm run build -w ops-web`
- [ ] Commit: `test(pm-ui): e2e mockup alignment smoke`

---

## Verification trên VPS

```bash
# Sau merge + pull
sudo systemctl restart ptt-crm-api ptt-ops-web
curl -s -H "Authorization: Bearer $TOKEN" https://rs.pttads.vn/api/kpi-hub/performance/dashboard | jq '.ledgers,.on_track'
```

Checklist:
- [ ] https://rs.pttads.vn/crm/kpi-hub/performance/ — 6 tiles một hàng, ledger `≤100K CPL`
- [ ] Sidebar badge Registry + Check-in
- [ ] Side-note Performance OS · moat
- [ ] Marketing 5 tiles; Reports scope bars

---

## Effort estimate

| Sóng | ~Tasks | ~Files | Risk |
|---|---|---|---|
| A–B Foundation | 6 | 12 | Low — mirror Service KPI pattern |
| C Dashboard | 3 | 5 | Medium — ledger display API |
| D–F Core flows | 5 | 5 | Low |
| G–H Vertical screens | 5 | 5 | Low |
| I QA | 1 | 2 | Low |

**Total:** 20 tasks, ~1 session subagent-driven (same velocity as Service KPI UI mockup).

---

## Out of scope (Wave 2)

- Full search across KPI Hub (placeholder only).
- Pixel-perfect font Inter 13px (accept design tokens `kpi-hub-*`).
- Postgres persistence for Performance catalog (in-memory seed sufficient for demo).
- Client-facing export PDF skin.
