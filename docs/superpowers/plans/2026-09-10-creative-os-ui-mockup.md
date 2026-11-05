# Creative OS UI Mockup + Nghiệp vụ Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Phạm vi:** UI ops-web + copy/CSS/primitives + **read-only** enrich API display (client name, progress %, credit footer). **Không** thay thế backend W1–W4 đã ship (`services/ptt-crm-api/src/cp/*`). **Không** bật render AI thật trên VPS nếu `CP_AI_ENABLED=0` — chỉ làm demo depth qua seed + stub có ý nghĩa.

**Goal:** Khớp 45 màn Creative Production OS trong mockup HTML với production `https://rs.pttads.vn/crm/creative-os/` — shell standalone navy, copy subtitle `OVR-XX · …`, layout/tile/table theo module mockup, và **cảm nhận nghiệp vụ sâu** nhờ demo seed “The Peak” + display labels (không hard-code KPI trong UI).

**Architecture:** Tách `CpShell` khỏi double-chrome `StaffPageShell`; thêm primitive `Cp*` (tiles, filter chips, modal, scope bar, credit footer). Mỗi page compose shell + subtitle mockup. Data từ `cp-api.ts` hiện có; bổ sung field hiển thị trên list/overview nếu formatter frontend không đủ.

**Tech Stack:** Next.js App Router (`services/ops-web`), CSS `cp-*` trong `creative-os/cp.css`, Vitest copy/nav, Playwright `e2e/cp-ui-mockup.spec.ts`.

**Master execution (UI + Agency Win Phase A):** [`2026-09-10-creative-os-integrated-phase-a.md`](./2026-09-10-creative-os-integrated-phase-a.md) — map task UI-1…33 ↔ BIZ-1…20 theo tuần.

**Spec backend (đã ship):** `docs/superpowers/plans/2026-09-07-creative-production-os.md` (36 tasks W1–W4)  
**SRS:** `docs/superpowers/specs/2026-09-07-creative-production-os-srs.md` v2.0  
**Mockup master:** `docs/design/rnosai-cp-os-srs-mockup.html` (45 màn)  
**Module mockups:** `docs/design/rnosai-cp-os-{overview,projects,video,media,brand,calendar,reports,settings}-mockup.html`  
**Shared CSS tokens:** `docs/design/rnosai-cp-os-mockup.css`

## Global Constraints

- UI **không iframe** — compose React trong App Router.
- Copy subtitle mỗi màn: `OVR-01 · …`, `PRJ-03 · …`, … **đúng chuỗi mockup** (khóa bằng Vitest).
- KPI **null → `—`** (SRS Q13) — **không** fake 86/3840 trong component; demo số đến từ seed/API.
- Sidebar navy `#0f2747`, active accent `#2563eb` — khớp `rnosai-cp-os-mockup.css`, **không** light slate hiện tại.
- Topbar mockup: search ⌘K placeholder, sync time, notify dot, avatar — **không** duplicate header CRM staff.
- Catalog bar: role label + scope chip + “30 ngày” preset — thay form date UUID trên OVR-01.
- Footer sidebar: **Credit PTT 1.160 / 5.000** (từ API credit balance, fallback `—`).
- Không vẽ control “Nhảy màn / Toàn catalog” của demo HTML trên prod (SRS Account Management pattern).
- TDD: Vitest cho copy + nav; Playwright smoke per module; không test trivial CSS.
- Commit sau mỗi task. Không `--no-verify`.

---

## Chẩn đoán gap (hiện trạng vs mockup)

### Nguyên nhân gốc — vì sao production “trống / không giống”

| # | Nguyên nhân | Triệu chứng trên VPS |
|---|---|---|
| 1 | **Double chrome** — `CpShell` bọc trong `StaffPageShell` | 2 header, sidebar lệch mockup, thiếu topbar CP |
| 2 | **CSS regression** — `--cp-sidebar: #e8eef4` thay navy mockup | Sidebar sáng, không giống HTML demo |
| 3 | **Thiếu demo seed** — chỉ `seed_cp_projects_from_b2b.sh` + RBAC catalog | KPI `—`, bảng trống, user không thấy flow |
| 4 | **Filter UX kỹ thuật** — form `from/to/client UUID` | Mockup dùng chip “30 ngày”, “Khách: Tất cả” |
| 5 | **Action Center = drawer** thay full page OVR-02 | Thiếu bảng Sev/Impact/Owner/SLA/CTA |
| 6 | **List display thô** — `agency_client_id` UUID, thiếu % tiến độ | PRJ-01/OVR-01 không giống mockup “The Peak” |
| 7 | **Render stub** (`CP_AI_ENABLED=0`) | VID-04 queue có code nhưng job rỗng — OK spec, cần seed job demo |
| 8 | **Caps chưa grant user** — `seed_cp_rbac.sh` catalog-only | Staff login không thấy đủ module dù code có |

### Shell & shared chrome

| Thành phần | Mockup | Production | Gap |
|---|---|---|---|
| Layout | `.app` standalone (topbar + catalog + shell) | `StaffPageShell` + `cp-root` | Double header, thiếu search/sync/notify |
| Sidebar | Navy 248px, group label, credit footer | Light slate `#e8eef4`, user + collapse | Màu + footer credit |
| Scope | Catalog bar chip + select | `cp-top` select nhỏ | Vị trí + preset filter |
| Typography | `Be Vietnam Pro`, tile 20px strong | Gần đúng nhưng tile trend thiếu `.up/.dn` | Trend hint KPI |

### OVR — Overview (4 màn)

| Màn | Route | Backend | UI / nghiệp vụ gap |
|---|---|---|---|
| **OVR-01** Dashboard | `/crm/creative-os` | ✅ KPI/trend/health/projects | Filter form UUID; Action Center mở drawer; project table UUID; thiếu alert budget 80% mockup |
| **OVR-02** Action Center | `?panel=actions` (drawer) | ✅ `getOverviewActions` | **Cần route/page riêng** — table đủ cột mockup, không drawer |
| **OVR-03** Production Monitor | `/crm/creative-os/ops` | ✅ queue API | Layout gần đúng; thiếu link VID-04 CTA mockup; empty khi không seed |
| **OVR-04** Activity | `/crm/creative-os/activity` | ✅ `listActivity` | Thiếu export CSV CTA; filter chip actor/module |

### PRJ — Projects (4 màn + workspace)

| Màn | Route | Backend | UI / nghiệp vụ gap |
|---|---|---|---|
| **PRJ-01** Portfolio | `/projects` | ✅ list | Grid/list toggle mockup; client name + progress bar; status pill |
| **PRJ-02** Create | `/projects/new` | ✅ | Verify 8 field + budget gate copy mockup |
| **PRJ-03** Workspace | `/projects/[id]?tab=` | ✅ 8 tabs | Tab chips mockup; budget 50/80/100 banner |
| **PRJ-04** Timeline | `?tab=timeline` | ✅ | Vertical timeline `.tl` mockup |

### VID — Video (8 màn)

| Màn | Route | Backend | UI / nghiệp vụ gap |
|---|---|---|---|
| **VID-01** Studio | `/video/[id]?tab=studio` | ✅ draft/autosave | 3-col `.studio` có; preview/playhead/storyboard mini cần polish |
| **VID-02–03** Storyboard/Timeline | `tab=` | ✅ W2 | Scene cards + track mockup |
| **VID-04** Render Ops | `/video/ops` | ✅ stub render | Queue table + provider capacity mockup |
| **VID-05–08** Review/Batch/Templates/Version | routes có | ✅ | Empty state nhiều; batch stepper `.stepper` mockup |

### MED — Media (6 màn)

| Màn | Route | Backend | Gap |
|---|---|---|---|
| **MED-01** Library | `/media` | ✅ | `media-grid` 5 cột mockup vs list hiện tại |
| **MED-02–06** Detail/Ingest/Collections/Rights/Quality | tabs | ✅ W3 | Tab chips OK; rights pill tone; quality pipeline cards |

### BRK — Brand (5 màn)

| Màn | Route | Backend | Gap |
|---|---|---|---|
| **BRK-01–05** | `/brand-kits` | ✅ | Portfolio grid, editor swatches `.swatch`, rules condition/action table |

### CAL — Calendar (5 màn)

| Màn | Route | Backend | Gap |
|---|---|---|---|
| **CAL-01** Month | `/calendar` | ✅ | `.cal` 7-col grid + event chips |
| **CAL-02–05** Composer/Gate/Monitor/Bulk | tabs | ✅ W4 | Publish gate copy; bulk schedule stepper |

### RPT — Reports (5 màn)

| Màn | Route | Backend | Gap |
|---|---|---|---|
| **RPT-01–05** | `/reports` | ✅ | Tab executive/production/credit/performance/governance; `.bars` chart placeholder + ROI `—` |

### SET — Settings (8 màn)

| Màn | Route | Backend | Gap |
|---|---|---|---|
| **SET-01–08** | `/settings` | ✅ | Platform vs CP map table; credit/models/integration cards |

---

## Chiến lược 2 sóng

### Sóng A — UI Mockup Alignment (ưu tiên cảm quan)

Khôi phục shell mockup, copy constants, layout primitives, polish từng module theo HTML demo. **Không đổi domain logic.**

### Sóng B — Nghiệp vụ Demo Depth (ưu tiên “sâu”)

Seed scenario “The Peak” (project + videos + renders + assets + calendar + actions), enrich API display fields, grant caps dev/demo, verify VPS deploy script.

---

## File map

| File | Trách nhiệm |
|---|---|
| `lib/cp-copy.ts` | Hằng OVR/PRJ/VID/… subtitles, side-note, preset labels (Vitest) |
| `lib/cp-copy.spec.ts` | Lock copy mockup |
| `components/crm/cp/CpShell.tsx` | Standalone shell: topbar, catalog, navy sidebar, credit footer |
| `components/crm/cp/CpSummaryTiles.tsx` | Grid 8 KPI + trend `.up/.dn` |
| `components/crm/cp/CpFilterChips.tsx` | Chip filter (30 ngày, khách, lifecycle) |
| `components/crm/cp/CpScopeBar.tsx` | Catalog bar role + scope |
| `components/crm/cp/CpModal.tsx` | Modal overlay mockup |
| `components/crm/cp/CpDataTable.tsx` | Table wrapper `.tbl-wrap` + pill status |
| `hooks/useCpCreditFooter.ts` | Credit used/limit cho sidebar footer |
| `app/crm/creative-os/cp.css` | Restore navy tokens; topbar/catalog/studio/cal/bars |
| `app/crm/creative-os/layout.tsx` | Bỏ/wrap `StaffPageShell` — CP full-bleed |
| Module components `Cp*.tsx` | Per-screen polish |
| `ptt-crm-api/src/cp/*.types.ts` | Optional: `client_name`, `progress_pct`, `display` |
| `scripts/seed_cp_demo_the_peak.sh` | Demo seed W1–W4 scenario |
| `scripts/grant_cp_demo_caps.sh` | Grant caps cho staff demo (non-prod / flag) |
| `e2e/cp-ui-mockup.spec.ts` | Smoke subtitle + shell + OVR-02 page |

---

## Shared contracts

```ts
// lib/cp-copy.ts
export const CP_SUBTITLES = {
  ovrDashboard:
    'OVR-01 · 8 KPI Nova · budget alert · project health · không hard-code số khi null',
  ovrActions:
    'FR-OVR-003 · severity · resource · owner · CTA · audit',
  ovrOps: 'OVR-03 + VID-04 · queue · provider · capacity',
  ovrActivity: 'OVR-04 · filter actor / module / action · export = view_audit',
  prjPortfolio: 'PRJ-01 · grid/list · client · progress · lifecycle chip',
  // … lock per module mockup HTML
} as const;

export const CP_FILTER_PRESETS = {
  last30Days: '30 ngày',
  clientAll: 'Khách: Tất cả',
} as const;

export const CP_CREDIT_FOOTER_LABEL = 'Credit PTT';
```

```ts
// CpSummaryTiles — 8 KPI keys from KPI_TILES
export type CpTile = {
  key: CpKpiKey;
  label: string;
  value: string; // dash(null) when API null
  trend?: { dir: 'up' | 'dn'; hint: string };
};
```

---

## Implementation tasks

### Wave 0 — Baseline & verify

- [ ] **Task 0.1:** Chụp baseline production + mockup OVR-01 side-by-side; ghi nhận branch `main` và commit hiện tại.
- [ ] **Task 0.2:** Chạy `cp-w1-uat` … `cp-w4-uat` locally — liệt kê test pass/fail làm acceptance floor.

### Wave A1 — Shell & tokens (Tasks 1–5)

- [ ] **Task 1:** `cp.css` — restore `--cp-sidebar: #0f2747`, nav text `#e2e8f0`, foot border `#16355c` khớp mockup.css.
- [ ] **Task 2:** `CpShell` — tách khỏi double chrome: option A) `layout.tsx` full-bleed không `StaffPageShell`; option B) `StaffPageShell` `hideChrome` prop — chọn minimal diff.
- [ ] **Task 3:** Topbar mockup — logo CP, search placeholder ⌘K (wire later), sync `fresh`, notify dot, avatar.
- [ ] **Task 4:** `CpScopeBar` — catalog bar: role label từ user, scope select, preset “30 ngày”.
- [ ] **Task 5:** `useCpCreditFooter` + sidebar footer **Credit PTT x/y** từ API settings/credit.

### Wave A2 — Copy & primitives (Tasks 6–9)

- [ ] **Task 6:** `lib/cp-copy.ts` + Vitest — lock subtitles OVR/PRJ/VID/MED/BRK/CAL/RPT/SET.
- [ ] **Task 7:** `CpSummaryTiles` — 8 tile auto-fit, trend `.up/.dn`, không fake value.
- [ ] **Task 8:** `CpFilterChips` — thay form UUID OVR-01; map chip → query params API hiện có.
- [ ] **Task 9:** `CpDataTable` + `CpModal` — shared table/pill/modal khớp `.tbl-wrap`, `.pill`, `.modal`.

### Wave A3 — OVR module (Tasks 10–13)

- [ ] **Task 10:** OVR-01 `CpOverview` — compose tiles + filter chips + alert budget; project table dùng `client_name`/`progress_pct` khi API có.
- [ ] **Task 11:** OVR-02 — **page/route mới** `/crm/creative-os/actions` (hoặc `?view=actions` full page); table Sev/Impact/Owner/SLA/CTA; link “Về dashboard”.
- [ ] **Task 12:** OVR-03 `CpRenderOps` — queue layout mockup + CTA “Chi tiết job” → VID-04.
- [ ] **Task 13:** OVR-04 Activity — filter chips + Export CSV button (disabled + tooltip nếu API chưa có export).

### Wave A4 — PRJ module (Tasks 14–17)

- [ ] **Task 14:** PRJ-01 — grid/list toggle, progress bar, status pills, client name column.
- [ ] **Task 15:** PRJ-02 Create — verify 8 fields + subtitle mockup + budget notice.
- [ ] **Task 16:** PRJ-03 Workspace — tab chips mockup; budget banner 50/80/100.
- [ ] **Task 17:** PRJ-04 Timeline — `.tl` vertical timeline styling.

### Wave A5 — VID module (Tasks 18–21)

- [ ] **Task 18:** VID-01 Studio — polish 3-col preview/playhead/storyboard mini + CTA reserve.
- [ ] **Task 19:** VID-02/03 — storyboard scene cards + timeline tracks mockup.
- [ ] **Task 20:** VID-04 Ops — provider capacity row + job table pills.
- [ ] **Task 21:** VID-06 Batch — `.stepper` 4 bước mockup.

### Wave A6 — MED + BRK (Tasks 22–24)

- [ ] **Task 22:** MED-01 — `media-grid` 5-col + thumb placeholder.
- [ ] **Task 23:** MED-03–06 tabs — ingest/collections/rights/quality card layout mockup.
- [ ] **Task 24:** BRK-01–05 — portfolio grid, swatches, rules table.

### Wave A7 — CAL + RPT + SET (Tasks 25–27)

- [ ] **Task 25:** CAL-01 — month grid `.cal` + event chips; bulk stepper tab.
- [ ] **Task 26:** RPT-01–05 — report tabs + `.bars` chart blocks; ROI hiển thị `—` + source note.
- [ ] **Task 27:** SET-01–08 — settings tab map platform vs CP.

### Wave B — Demo depth & API display (Tasks 28–32)

- [ ] **Task 28:** API enrich — `CpProjectSummary`: `client_name`, `progress_pct`, `lifecycle_label`; overview projects + PRJ list (read-only join B2B client).
- [ ] **Task 29:** `scripts/seed_cp_demo_the_peak.sh` — 1 workspace PTT, project “The Peak”, 2 videos, 3 assets, 1 render job (stub), milestones, calendar item, action rows → KPI không null trên demo.
- [ ] **Task 30:** `scripts/grant_cp_demo_caps.sh` — grant `crm_cp_*` cho `staff@demo.local` (document prod manual step).
- [ ] **Task 31:** Update `deploy_cp_os_vps.sh` — optional `SEED_CP_DEMO=1` chạy seed + verify curl KPI.
- [ ] **Task 32:** E2E `cp-ui-mockup.spec.ts` — login → shell navy → OVR-01 subtitle → OVR-02 table → PRJ-01 client column (skip nếu no seed).

### Wave C — VPS verify (Task 33)

- [ ] **Task 33:** Deploy VPS (`APPLY=1 ./scripts/deploy_cp_os_vps.sh`), `SEED_CP_DEMO=1`, manual `sudo systemctl restart`, verify https://rs.pttads.vn/crm/creative-os/

---

## Thứ tự ưu tiên nếu cần ship nhanh (MVP visual)

1. Tasks **1–5** (shell navy + credit footer) — impact lớn nhất.
2. Tasks **6–11** (copy + OVR-01/02) — dashboard không còn “form kỹ thuật”.
3. Tasks **28–29** (API display + demo seed) — KPI có số, bảng có “The Peak”.
4. Tasks **14, 18, 22, 25** — PRJ/VID/MED/CAL visual cho tour demo.
5. Phần còn lại — parity 45 màn.

---

## Acceptance criteria

| # | Tiêu chí | Verify |
|---|---|---|
| AC-1 | Sidebar navy `#0f2747`, không double header CRM | Visual + Playwright |
| AC-2 | OVR-01 subtitle + 8 KPI tiles khớp mockup | Vitest copy + E2E |
| AC-3 | OVR-02 full page table (không drawer-only) | E2E navigate `/actions` |
| AC-4 | Filter chip “30 ngày” / “Khách: Tất cả” | E2E chip click → URL params |
| AC-5 | PRJ-01 hiện tên khách + progress % (không UUID) | Seed + API test |
| AC-6 | KPI null → `—` khi không seed; có số khi seed demo | Manual + API |
| AC-7 | Credit footer sidebar từ API | Hook + manual |
| AC-8 | `cp-w1..w4-uat` vẫn pass sau UI refactor | CI local |

---

## Rủi ro & mitigations

| Rủi ro | Mitigation |
|---|---|
| Tách `StaffPageShell` break auth/logout | Giữ auth logic trong `CpShell`; chỉ hide chrome |
| Seed demo lẫn prod data | Flag `SEED_CP_DEMO=1`; idempotent script; workspace PTT only |
| Grant caps nhầm prod user | Script chỉ demo email; doc manual RBAC cho VPS |
| Render stub vẫn “nông” | Seed job ở trạng thái queued/done stub; copy “CP_AI_ENABLED=0” trong VID-04 |
| 45 màn quá lớn một PR | Ship theo wave MVP ở trên; PR nhỏ per wave |

---

## Quan hệ với plan cũ

Plan này **bổ sung** `2026-09-07-creative-production-os.md` (backend W1–W4), **không thay thế**. Backend routes/services đã có; gap chính là **UI chrome + demo data + display enrichment**.

---

## Test plan (manual tour 10 phút)

1. Login staff demo → `/crm/creative-os/` — sidebar navy, credit footer, 8 KPI (có số nếu seed).
2. Click **Action Center** → full page table, sort/filter severity.
3. **Dự án** → “The Peak”, progress bar, mở workspace 8 tabs.
4. **Video Studio** → 3-col studio, storyboard 4 scene, render reserve (stub notice).
5. **Media** → grid 5 cột, rights pill warn/block.
6. **Lịch** → tháng hiện tại có event chip.
7. **Báo cáo** → 5 tab, ROI `—`.
8. **Cài đặt** → credit/models tab, map platform.
