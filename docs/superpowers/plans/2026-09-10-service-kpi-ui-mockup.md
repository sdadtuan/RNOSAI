# Service KPI UI Mockup Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Phạm vi:** Chỉ UI ops-web + copy/nav/CSS. **Không** sửa domain engine backend (đã ship Wave 1–2). Bổ sung API read-only nếu thiếu tile/summary.

**Goal:** Khớp 9 màn Service KPI trong `docs/design/rnosai-service-kpi-mockup.html` (SKPI-00…11) với production `/crm/kpi-hub/*` — layout hai cột, copy tiếng Việt mockup, moat notice, badge màu, không iframe.

**Architecture:** Tạo primitive `Skpi*` (hoặc tái dùng pattern `Pm*` đã có) trong `components/kpi-hub/service-kpi/`. Mỗi `page.tsx` chỉ compose shell + subtitle SKPI-XX + tiles + layout mockup. Data từ `service-kpi-api.ts` hiện có; thêm endpoint summary nếu tile Overview/War Room badge cần số aggregate.

**Tech Stack:** Next.js App Router (`services/ops-web`), CSS `kpi-hub-*` / `kpi-hub-skpi-*` trong `globals.css`, Vitest nav/copy, Playwright `e2e/service-kpi-hub.spec.ts`.

**Spec:** `docs/specs/2026-09-09-service-kpi-module-srs.md` (v1.1)  
**Design:** `docs/superpowers/specs/2026-09-09-service-kpi-competitive-ops-design.md`  
**Mockup:** `docs/design/rnosai-service-kpi-mockup.html`

## Global Constraints

- UI **không iframe** — xóa `ServiceKpiMockupFrame.tsx` khi màn cuối khớp mockup.
- Copy subtitle mỗi màn: `SKPI-XX · …` **đúng chuỗi mockup** (không paraphrase).
- Tile label mockup dùng ALL CAPS: `CRITICAL QUÁ HẠN`, `ASSUMPTION MỞ`, `TEMPLATE ACTIVE`, …
- Classification badge tiếng Việt: Cam kết bàn giao (blue), Mục tiêu tối ưu (purple), Kết quả dự kiến (amber), Business Outcome (amber), Quality (green).
- Moat copy (`AgencyAnalytics`, `Productive`, `HubSpot`) chỉ trên War Room + Contract + Reconcile success — không bịa competitor mới.
- Nav reconcile label đổi thành **Quoted vs Delivered vs Reported** (mockup SKPI-10 title); href giữ `/reconcile`.
- Không đụng `services/ptt-crm-api/src/performance/` (Ads). Không đụng Performance OS pages.
- TDD: Vitest cho copy constants + nav; Playwright smoke per screen; không thêm test trivial CSS.
- Commit sau mỗi task. Không `--no-verify`.

---

## Chẩn đoán gap (hiện trạng vs mockup)

| Màn | Route | Backend | UI gap chính |
|---|---|---|---|
| SKPI-00 War Room | `/service-kpi` | ✅ war room API | Layout 3 vùng sai; tile label English; queue thiếu badge Block start; DV = table không phải list + **thiếu moat notice**; rhythm sidebar không sticky 2-col |
| SKPI-00 Overview | **Không có route** | ⚠️ cần aggregate | 4 tile Template/Instance/Readiness/At Risk — mockup riêng, có thể tab War Room hoặc route `/service-kpi/overview` |
| SKPI-01 Template | `/service-templates` | ✅ | Tile copy; filter **chip** mockup; footer notice Portfolio + spec-link; builder **kpi-group/kpi-row** modal thay drawer phẳng |
| SKPI-03 Instances | `/instances` | ✅ | Filter chips; classification **VN**; variance màu; success banner Snapshot |
| SKPI-05 Measurement | `/measurement` | ✅ | Formula snapshot card (`.formula` + `.var`); readiness 5 gate copy mockup; CTA sidebar |
| SKPI-06 Tracking | `/tracking` | ✅ | 4 tile page-level; layout two + sticky aside links; actual list badge Pending/Verified |
| SKPI-09 Contract | `/kpi-contracts` | ✅ | 4 tile mockup labels; gate card + **moat paragraph**; formula aside; action buttons mockup |
| SKPI-10 Reconcile | `/reconcile` | ✅ | Title 3 sổ; success banner; quality badge màu; nav label |
| SKPI-11 Policy Pack | `/policy-packs` | ✅ | Structured rules (không JSON raw); pack khác Spa/Edu; wording firewall aside |
| Shell | `KpiHubShell` | — | **side-note** KPI Contract OS; nav badge count War Room / Contract |
| Legacy | `ServiceKpiMockupFrame` | — | Dead code — xóa |

---

## File map

| File | Trách nhiệm |
|---|---|
| `components/kpi-hub/service-kpi/SkpiPageSubtitle.tsx` | SKPI-XX + mô tả mockup |
| `SkpiMoatNotice.tsx`, `SkpiNotice.tsx`, `SkpiSuccessBanner.tsx`, `SkpiSpecLink.tsx` | Banner mockup |
| `SkpiFilterChips.tsx` | Filter chip `.filter.active` |
| `SkpiTwoColumnLayout.tsx` | `main + sticky aside 320px` |
| `SkpiFormulaBlock.tsx` | Formula + var rows |
| `SkpiQueueRow.tsx` | War Room queue row + actions |
| `SkpiDvHealthList.tsx` | DV list rows + moat |
| `SkpiWeeklyRhythm.tsx` | 5 bước nhịp tuần |
| `SkpiTemplateDetailModal.tsx` | SKPI-02 kpi-group/kpi-row (thay drawer-only UX) |
| `SkpiClassificationBadge.tsx` | Map enum → VN + màu |
| `lib/service-kpi-copy.ts` | Hằng copy mockup + SKPI ids (Vitest) |
| `lib/kpi-hub-nav.ts` | Badge count hook + reconcile label |
| `components/kpi-hub/KpiHubShell.tsx` | Optional `sideNote` prop |
| 9 `page.tsx` + optional `overview/page.tsx` | Compose mockup layout |
| `globals.css` | `.kpi-hub-skpi-notice`, `.kpi-hub-skpi-filter`, align mockup tokens |
| `e2e/service-kpi-ui-mockup.spec.ts` | Subtitle + tile smoke |
| Delete: `ServiceKpiMockupFrame.tsx` | Task cuối |

---

## Shared contracts

```ts
// lib/service-kpi-copy.ts
export const SKPI_SUBTITLES = {
  warroom: 'SKPI-00 · Nhịp vận hành tuần — không phải dashboard thứ hai. Việc hôm nay: assumption, alert, data stale, lệch KPI+GM, quote score cao.',
  overview: 'SKPI-00 · Dashboard vận hành template, instance, readiness và rủi ro theo Portfolio 21 DV.',
  templates: 'SKPI-01 · Cấu hình bộ KPI chuẩn cho Service Catalog (Portfolio 21 DV), package và vertical.',
  instances: 'SKPI-03 · KPI kế thừa/cấu hình theo Quote, Proposal, Project, Work Order hoặc Campaign.',
  measurement: 'SKPI-05 · Kế hoạch đo: source mapping, formula snapshot, owner, cadence, QA và freshness SLA.',
  tracking: 'SKPI-06 · Ghi nhận actual từ API, CSV/XLSX, manual entry; kiểm soát quality và reconciliation.',
  contracts: 'SKPI-09 · Điểm rủi ro hợp đồng KPI — duyệt cùng GM floor. Internal only. Không xuống proposal.',
  reconcile: 'SKPI-10 · Ba sổ. Cấm xuất Reported từ actual Unverified. Chênh material → Change Order.',
  packs: 'SKPI-11 · Rule + từ cấm + reviewer theo ngành. Functional Lead không override pack regulated.',
} as const;

export const CLASSIFICATION_LABELS: Record<string, { label: string; tone: 'blue' | 'purple' | 'amber' | 'green' | 'gray' }> = {
  COMMITTED_DELIVERABLE: { label: 'Cam kết bàn giao', tone: 'blue' },
  OPTIMIZATION_TARGET: { label: 'Mục tiêu tối ưu', tone: 'purple' },
  PROJECTED_RESULT: { label: 'Kết quả dự kiến', tone: 'amber' },
  BUSINESS_OUTCOME: { label: 'Business Outcome', tone: 'amber' },
  QUALITY_STANDARD: { label: 'Quality', tone: 'green' },
  INTERNAL_OPERATIONAL: { label: 'Internal', tone: 'gray' },
};
```

---

## Sóng triển khai

| Sóng | Ship | Tasks |
|---|---|---|
| A | Primitives + CSS + copy constants | 1–4 |
| B | Shell side-note + nav badges + War Room | 5–7 |
| C | Overview + Templates (SKPI-01/02) | 8–10 |
| D | Instances + Measurement | 11–13 |
| E | Tracking + Contract | 14–16 |
| F | Reconcile + Policy Pack + cleanup | 17–20 |

---

### Task 1: Copy constants + Vitest

**Files:**
- Create: `services/ops-web/src/lib/service-kpi-copy.ts`
- Create: `services/ops-web/src/lib/service-kpi-copy.spec.ts`

**Steps:**
- [ ] Thêm `SKPI_SUBTITLES`, `CLASSIFICATION_LABELS`, `WAR_ROOM_TILE_LABELS`, `MOAT_WAR_ROOM`, `MOAT_RECONCILE_SUCCESS`
- [ ] Test: mọi key mockup có; reconcile subtitle chứa "Ba sổ"
- [ ] `pnpm --filter ops-web exec vitest run src/lib/service-kpi-copy.spec.ts`

**Commit:** `test(ops-web): lock Service KPI mockup copy constants`

---

### Task 2: Skpi layout primitives

**Files:**
- Create: `SkpiPageSubtitle.tsx`, `SkpiTwoColumnLayout.tsx`, `SkpiFilterChips.tsx`
- Modify: `globals.css` — `.kpi-hub-skpi-filter`, `.kpi-hub-skpi-filter.is-active`

**Steps:**
- [ ] `SkpiTwoColumnLayout`: grid `1fr 320px`, aside `position: sticky; top: 16px`
- [ ] `SkpiFilterChips`: props `options`, `value`, `onChange`
- [ ] Storybook không bắt buộc — smoke render trong Vitest hoặc page Task 5

**Commit:** `feat(skpi-ui): shared layout and filter chip primitives`

---

### Task 3: Notice / moat / banner primitives

**Files:**
- Create: `SkpiMoatNotice.tsx`, `SkpiNotice.tsx`, `SkpiSuccessBanner.tsx`, `SkpiSpecLink.tsx`
- Modify: `globals.css` — `.kpi-hub-skpi-moat`, `.kpi-hub-skpi-success` (mirror mockup `.notice`/`.success`)

**Steps:**
- [ ] Props: `title?`, `children` — dùng copy từ `service-kpi-copy.ts`
- [ ] Khớp màu amberSoft / greenSoft mockup

**Commit:** `feat(skpi-ui): moat notice and banner components`

---

### Task 4: Formula + classification badges

**Files:**
- Create: `SkpiFormulaBlock.tsx`, `SkpiClassificationBadge.tsx`
- Modify: `ServiceKpiInstanceTable.tsx` — dùng `SkpiClassificationBadge`
- Modify: `ServiceKpiMeasurementPlanForm.tsx` — wrap formula section với `SkpiFormulaBlock`

**Steps:**
- [ ] `SkpiFormulaBlock`: `{ formula, vars: { name, detail }[] }`
- [ ] Instance table: classification hiển thị VN, không `replace(/_/g)`

**Commit:** `feat(skpi-ui): formula block and VN classification badges`

---

### Task 5: KpiHubShell side-note + nav badges

**Files:**
- Modify: `KpiHubShell.tsx` — prop `sideNote?: { title: string; body: string }`
- Modify: `kpi-hub-nav.ts` — `badge?: number` on items; label reconcile
- Modify: `KpiHubShell` nav render — show `.kpi-hub-nav-count`
- Create: `hooks/useServiceKpiNavBadges.ts` — fetch war room counts (reuse war room API)
- Modify: `kpi-hub-nav.spec.ts`

**Steps:**
- [ ] Side note chỉ khi group `service-kpi` active (hoặc always in shell if mockup)
- [ ] War Room badge = `critical_overdue + quotes_score_gte_70` (hoặc queue length)
- [ ] Contract badge = `quotes_score_gte_70`
- [ ] Test nav label reconcile

**Commit:** `feat(kpi-hub): Service KPI sidebar note and nav badges`

---

### Task 6: War Room layout (SKPI-00)

**Files:**
- Modify: `ServiceKpiWarRoom.tsx`
- Create: `SkpiQueueRow.tsx`, `SkpiDvHealthList.tsx`, `SkpiWeeklyRhythm.tsx`
- Modify: `service-kpi/page.tsx` — subtitle từ `SKPI_SUBTITLES.warroom`

**Steps:**
- [ ] Tiles: labels ALL CAPS từ constants; tinted background critical/warn
- [ ] Layout: `SkpiTwoColumnLayout` — left stack [queue card, DV card]; right sticky rhythm
- [ ] Queue: rich title + sub + badge/button Track|3 sổ|Duyệt theo `item.kind`
- [ ] DV: list rows `DVxx · KPI% · GM%` + `SkpiMoatNotice` (MOAT_WAR_ROOM)
- [ ] Xóa table DV cũ

**Commit:** `feat(skpi-ui): War Room matches mockup layout and moat`

---

### Task 7: War Room API queue enrichment (nếu thiếu)

**Files:**
- Modify: `service-kpi-operations.service.ts` (chỉ nếu queue item thiếu `subtitle`, `badge`, `action`)
- Modify: `service-kpi-types.ts`, `ServiceKpiWarRoom.tsx`

**Steps:**
- [ ] Kiểm tra response hiện tại — nếu queue chỉ có title/href, map client-side từ fields có
- [ ] Chỉ thêm API field khi client không derive được
- [ ] Jest war room spec update nếu đổi shape

**Commit:** `feat(service-kpi): enrich war room queue for mockup rows`

---

### Task 8: Service KPI Overview page

**Files:**
- Create: `app/crm/kpi-hub/service-kpi/overview/page.tsx` (hoặc section toggle trên war room — **khuyến nghị route riêng**)
- Modify: `service-kpi-api.ts` — `fetchServiceKpiOverview` nếu chưa có
- Modify: `service-kpi.controller.ts` — `GET .../overview` aggregate tiles

**Steps:**
- [ ] 4 tiles: TEMPLATE ACTIVE, INSTANCE TRACKING, READINESS WARNING, KPI AT RISK
- [ ] Backend: COUNT templates active, instances tracking, readiness warn, at_risk
- [ ] Link từ Executive hoặc breadcrumb — không thêm nav item (mockup overview = demo tab)

**Commit:** `feat(skpi-ui): Service KPI overview dashboard tiles`

---

### Task 9: Templates list page (SKPI-01)

**Files:**
- Modify: `service-templates/page.tsx`
- Modify: `ServiceKpiTemplateTable.tsx` — cột bundle hiển thị KPI codes joined
- Modify: `ServiceKpiSummaryTiles` — ALL CAPS labels

**Steps:**
- [ ] Subtitle SKPI-01; actions: Dictionary, Export stub, + Tạo Template
- [ ] `SkpiFilterChips`: Tất cả / Active / In Review / Performance / Client-facing
- [ ] Footer: `SkpiNotice` Portfolio link + `SkpiSpecLink`
- [ ] Table: `Owner team`, version `v{n}` từ API

**Commit:** `feat(skpi-ui): Service KPI Template list matches mockup`

---

### Task 10: Template detail modal (SKPI-02)

**Files:**
- Create: `SkpiTemplateDetailModal.tsx`
- Modify: `ServiceKpiTemplateBuilder.tsx` — group rules by classification → kpi-group headers
- Modify: `service-templates/page.tsx` — modal thay/alongside drawer

**Steps:**
- [ ] kpi-row grid: no, name, badge, target, readiness, Sửa
- [ ] Lifecycle notice trong modal header
- [ ] Submit review CTA mockup
- [ ] Giữ drawer mobile fallback nếu cần responsive

**Commit:** `feat(skpi-ui): template detail modal with kpi-group rows`

---

### Task 11: Instances page (SKPI-03)

**Files:**
- Modify: `instances/page.tsx`, `ServiceKpiInstanceTable.tsx`

**Steps:**
- [ ] Subtitle SKPI-03; filter chips Quote/Project/At Risk/Client
- [ ] Variance cột: class red khi material negative cho lower-is-better
- [ ] Readiness badge Ready/Warning màu
- [ ] Footer `SkpiSuccessBanner` Snapshot copy mockup
- [ ] Actions: Plan / Track links (đã có — verify label)

**Commit:** `feat(skpi-ui): KPI Instances mockup filters and copy`

---

### Task 12: Measurement page (SKPI-05)

**Files:**
- Modify: `measurement/page.tsx`, `ServiceKpiMeasurementPlanForm.tsx`, `ServiceKpiMeasurementPanel.tsx`

**Steps:**
- [ ] `SkpiTwoColumnLayout`: form + formula card trái; readiness + CTA phải
- [ ] Readiness 5 rows copy mockup (Definition, Source, Owner, Freshness, QA)
- [ ] Section title badge "Data Quality Warning" khi stale
- [ ] Button full-width "Mở Actual Tracking"

**Commit:** `feat(skpi-ui): Measurement Plan two-column mockup layout`

---

### Task 13: Measurement formula from dictionary

**Files:**
- Modify: `ServiceKpiMeasurementPlanForm.tsx` — load formula từ dictionary KPI selected
- Use: `useKpiHubDictionary` hoặc instance detail API

**Steps:**
- [ ] Populate `SkpiFormulaBlock` từ definition `formula` + variables
- [ ] zero denominator row cố định mockup

**Commit:** `feat(skpi-ui): measurement formula snapshot from dictionary`

---

### Task 14: Tracking page (SKPI-06)

**Files:**
- Modify: `tracking/page.tsx`, `ServiceKpiTrackingPanel.tsx`

**Steps:**
- [ ] Page-level 4 tiles: ACTUAL HÔM NAY, API/CONNECTOR, MANUAL/IMPORT, DATA ISSUES (API mới hoặc derive từ tracking summary)
- [ ] `SkpiTwoColumnLayout`: chart + actual list | aside Target & Measurement links
- [ ] Actual rows: quality badge Pending/Verified

**Commit:** `feat(skpi-ui): Actual Tracking mockup tiles and layout`

---

### Task 15: Tracking summary API (nếu thiếu)

**Files:**
- Modify: `service-kpi.controller.ts` — `GET .../tracking/summary`
- Modify: `service-kpi-api.ts`, types

**Steps:**
- [ ] Aggregate counts today / by source / issues — Jest spec
- [ ] Wire tracking page tiles

**Commit:** `feat(service-kpi): tracking summary for dashboard tiles`

---

### Task 16: Contract page (SKPI-09)

**Files:**
- Modify: `kpi-contracts/page.tsx`, `ServiceKpiContractCard.tsx`

**Steps:**
- [ ] 4 tiles mockup labels (QT score, Classification risk, Target aggressiveness, Margin pressure)
- [ ] Gate card: notice trigger + list GM/CPL/assumption/disclaimer
- [ ] Actions: Bắt buộc phương án B, Xin waiver (wire hoặc toast demo nếu backend chưa)
- [ ] Card "Vì sao đối thủ không làm được" — paragraph mockup
- [ ] Aside formula `Risk = 0.25 Class + …` + Public API không trả score

**Commit:** `feat(skpi-ui): KPI Contract & Risk mockup layout and moat`

---

### Task 17: Reconcile page (SKPI-10)

**Files:**
- Modify: `reconcile/page.tsx`, `ServiceKpiReconcileTable.tsx`

**Steps:**
- [ ] Title **Quoted vs Delivered vs Reported**; subtitle SKPI-10
- [ ] Table headers: Quoted (accept), Delivered (nội bộ), Reported (khách)
- [ ] Quality column: colored badges
- [ ] Footer `SkpiSuccessBanner` 3 sổ explanation
- [ ] Action + Change Order (existing drawer)

**Commit:** `feat(skpi-ui): reconcile three-ledger mockup copy`

---

### Task 18: Policy Pack page (SKPI-11)

**Files:**
- Modify: `ServiceKpiPolicyPackView.tsx`, `policy-packs/page.tsx`

**Steps:**
- [ ] Parse `rules_json` → structured rows (Booking, Lead forecast, Reviewer) — fallback demo rows BĐS mockup
- [ ] Card "Pack khác": Spa, Education, Healthcare static list (Phase 3 packs)
- [ ] Aside "Wording firewall" paragraph
- [ ] Banned phrases as red inline, không chỉ tags
- [ ] Regulated badge red

**Commit:** `feat(skpi-ui): Industry Policy Pack structured mockup layout`

---

### Task 19: E2E smoke + nav test update

**Files:**
- Create: `e2e/service-kpi-ui-mockup.spec.ts`
- Modify: `kpi-hub-nav.spec.ts`, `rbac-routes.ts` nếu thêm overview route

**Steps:**
- [ ] Visit 9 routes — assert SKPI subtitle visible
- [ ] War Room moat text; Reconcile success banner
- [ ] Nav reconcile label

**Commit:** `test(e2e): Service KPI mockup UI smoke`

---

### Task 20: Remove legacy mockup frame

**Files:**
- Delete: `ServiceKpiMockupFrame.tsx`
- Grep: ensure zero imports

**Steps:**
- [ ] Delete file
- [ ] `pnpm --filter ops-web build`

**Commit:** `chore(skpi-ui): remove ServiceKpiMockupFrame`

---

## Verification checklist (trước merge)

- [ ] `pnpm --filter ops-web exec vitest run src/lib/kpi-hub-nav.spec.ts src/lib/service-kpi-copy.spec.ts`
- [ ] `pnpm --filter ptt-crm-api test -- service-kpi` (no regression)
- [ ] `pnpm --filter ops-web build`
- [ ] Manual: mở mockup HTML cạnh ops-web — so từng màn SKPI-00…11
- [ ] VPS: `sudo systemctl restart ptt-ops-web` sau deploy

---

## Out of scope (Wave UI này)

- LLM wording firewall (Wave 1 = rule only — UI mô tả, không AI)
- Spa/Edu/Healthcare pack backend (chỉ static list mockup)
- Export template CSV thật (button có thể toast "demo")
- Quote Builder deep-link "Mở Quote QT-0089" (link CRM nếu route đã có)

---

## Ước lượng

| Sóng | Tasks | ~Commits |
|---|---|---|
| A Primitives | 1–4 | 4 |
| B War Room + shell | 5–7 | 3 |
| C Templates | 8–10 | 3 |
| D Instances + Measurement | 11–13 | 3 |
| E Tracking + Contract | 14–16 | 3 |
| F Reconcile + Pack + QA | 17–20 | 4 |
| **Total** | **20 tasks** | **~20 commits** |
