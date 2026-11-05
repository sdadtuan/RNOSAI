# Creative OS — Integrated Phase A (UI Mockup + Agency Win)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Gộp từ:**
> - [`2026-09-10-creative-os-ui-mockup.md`](./2026-09-10-creative-os-ui-mockup.md) — 33 tasks UI khớp mockup 45 màn
> - [`2026-09-10-cp-video-agency-win-phase-a.md`](./2026-09-10-cp-video-agency-win-phase-a.md) — 20 tasks playbook / RE / QC / regenerate
>
> **Spec:** [`2026-09-10-cp-video-agency-win-design.md`](../specs/2026-09-10-cp-video-agency-win-design.md) · Mockup HTML `docs/design/rnosai-cp-os-*.html`

**Goal:** Trong 4 tuần ship production Creative OS **vừa giống mockup** (shell navy, OVR/PRJ/VID polish) **vừa thắng Nova** (playbook BĐS/Lead/TVC, RE handoff, regenerate Studio, QC gate launch).

**Architecture:** Hai track song song — **Track UI** (primitives + per-module mockup) và **Track Biz** (playbook API + script engine). Track UI chạy **trước tuần 1–2** để demo visual; Track Biz gắn vào VID/OVR khi shell sẵn sàng. Demo seed “The Peak” + playbook seed cùng deploy flag.

---

## Thứ tự thực thi (4 tuần)

| Tuần | Track UI (mockup) | Track Biz (agency win) |
|---|---|---|
| **1** | UI-1…5 Shell navy + topbar + credit footer | BIZ-1…3 Registry + QC packs + script engine |
| **2** | UI-6…13 Copy primitives + OVR full (incl. OVR-02 page) | BIZ-4…6 Playbooks API + RE handoff + seed templates |
| **3** | UI-14…21 PRJ + VID mockup (studio 3-col, batch stepper) | BIZ-7…13 Playbook picker + studio regenerate + storyboard |
| **4** | UI-28…32 API display + demo seed + E2E mockup | BIZ-14…20 Lead ingest + launch gate + RE button + verify |

**Tuần 5+ (Phase A extended / Phase B):** UI-22…27 MED/BRK/CAL/RPT/SET + BIZ Phase B (SOP render).

---

## Global Constraints (cả hai track)

- Sidebar navy `#0f2747`; không double chrome `StaffPageShell`.
- Subtitle `OVR-XX · …` khóa Vitest (`cp-copy.ts`).
- KPI null → `—`; demo từ seed/API.
- QC Blocked ⇒ không export / publish / Ads Ops launch.
- Regenerate Studio = playbook script engine (Phase A), không Runway/Kling.
- Commit sau mỗi task; không `--no-verify`.

---

## TRACK UI — Mockup alignment

> Chi tiết đầy đủ 45 màn: [`2026-09-10-creative-os-ui-mockup.md`](./2026-09-10-creative-os-ui-mockup.md)

### UI-W0 — Baseline

- [ ] **UI-0.1:** Baseline screenshot production vs mockup OVR-01.
- [ ] **UI-0.2:** Chạy `cp-w1-uat`…`cp-w4-uat` — ghi pass/fail floor.

### UI-W1 — Shell & tokens (Tasks UI-1…5) · **BLOCKER cho mọi màn**

- [ ] **UI-1:** `cp.css` — restore navy sidebar `#0f2747`, foot `#16355c`.
- [ ] **UI-2:** `CpShell` / `layout.tsx` — bỏ double chrome (full-bleed CP).
- [ ] **UI-3:** Topbar — search ⌘K placeholder, sync time, notify dot, avatar.
- [ ] **UI-4:** `CpScopeBar` — catalog bar role + scope + chip “30 ngày”.
- [ ] **UI-5:** `useCpCreditFooter` — sidebar **Credit PTT x/y**.

### UI-W2 — Copy & primitives (UI-6…9)

- [ ] **UI-6:** `lib/cp-copy.ts` + Vitest — subtitles OVR/PRJ/VID/MED/BRK/CAL/RPT/SET.
- [ ] **UI-7:** `CpSummaryTiles` — 8 KPI + trend `.up/.dn`.
- [ ] **UI-8:** `CpFilterChips` — thay form UUID OVR-01.
- [ ] **UI-9:** `CpDataTable` + `CpModal` — `.tbl-wrap`, `.pill`.

### UI-W3 — OVR module (UI-10…13)

- [ ] **UI-10:** OVR-01 `CpOverview` — tiles + chips + budget alert + project table display labels.
- [ ] **UI-11:** OVR-02 **full page** `/crm/creative-os/actions` — table Sev/Impact/Owner/SLA/CTA.
- [ ] **UI-12:** OVR-03 `CpRenderOps` — queue mockup + CTA VID-04.
- [ ] **UI-13:** OVR-04 Activity — filter chips + Export CSV (disabled nếu chưa API).

### UI-W4 — PRJ module (UI-14…17)

- [ ] **UI-14:** PRJ-01 — grid/list, progress bar, client name, status pills.
- [ ] **UI-15:** PRJ-02 Create — 8 fields + subtitle + budget notice.
- [ ] **UI-16:** PRJ-03 Workspace — tab chips + budget banner 50/80/100.
- [ ] **UI-17:** PRJ-04 Timeline — `.tl` vertical styling.

### UI-W5 — VID module (UI-18…21) · **gắn BIZ playbook picker**

- [ ] **UI-18:** VID-01 Studio — 3-col `.studio`, preview/playhead, storyboard mini; **slot cho `CpPlaybookPicker`** (BIZ-11).
- [ ] **UI-19:** VID-02/03 — scene cards + timeline tracks mockup.
- [ ] **UI-20:** VID-04 Ops — provider row + job pills.
- [ ] **UI-21:** VID-06 Batch — `.stepper` 4 bước.

### UI-W6 — MED/BRK/CAL/RPT/SET (UI-22…27) · Phase A extended

- [ ] **UI-22:** MED-01 — `media-grid` 5-col.
- [ ] **UI-23:** MED-03–06 tabs layout.
- [ ] **UI-24:** BRK-01–05 portfolio/swatches/rules.
- [ ] **UI-25:** CAL-01 month `.cal` + bulk stepper.
- [ ] **UI-26:** RPT-01–05 tabs + `.bars`.
- [ ] **UI-27:** SET-01–08 platform map.

### UI-W7 — Demo depth (UI-28…33)

- [ ] **UI-28:** API `client_name`, `progress_pct`, `lifecycle_label` on projects.
- [ ] **UI-29:** `seed_cp_demo_the_peak.sh`.
- [ ] **UI-30:** `grant_cp_demo_caps.sh`.
- [ ] **UI-31:** `deploy_cp_os_vps.sh` — `SEED_CP_DEMO=1`.
- [ ] **UI-32:** E2E `cp-ui-mockup.spec.ts`.
- [ ] **UI-33:** VPS verify checklist.

---

## TRACK BIZ — Agency win (playbook / RE / QC)

> Chi tiết: [`2026-09-10-cp-video-agency-win-phase-a.md`](./2026-09-10-cp-video-agency-win-phase-a.md)

- [ ] **BIZ-1:** Playbook types + registry + Vitest.
- [ ] **BIZ-2:** Domain QC packs (`bds_social`, `lead_social`, `tvc_short`).
- [ ] **BIZ-3:** Playbook script engine (regenerate Studio).
- [ ] **BIZ-4:** Wire regenerate + auto-script in `cp-videos.service`.
- [ ] **BIZ-5:** Playbooks service + controller routes.
- [ ] **BIZ-6:** RE handoff service `POST /re-projects/:id/cp-handoff`.
- [ ] **BIZ-7:** Seed published templates (3 playbooks).
- [ ] **BIZ-8:** RE product → batch row mapper.
- [ ] **BIZ-9:** DDL `playbook_id`, `re_project_id` linkage.
- [ ] **BIZ-10:** Frontend `cp-playbook-api.ts` + copy.
- [ ] **BIZ-11:** `CpPlaybookPicker` — **compose trong UI-18 shell**.
- [ ] **BIZ-12:** `CpVideoStudio` playbook + “Tạo lại kịch bản”.
- [ ] **BIZ-13:** `CpStoryboard` playbook regenerate.
- [ ] **BIZ-14:** `ingest_ptt_lead_video_pack.sh`.
- [ ] **BIZ-15:** Ads Ops launch block on QC fail.
- [ ] **BIZ-16:** QC UI domain pack on review.
- [ ] **BIZ-17:** RE Project button “Tạo creative pack BĐS”.
- [ ] **BIZ-18:** TVC SOP handoff doc + studio banner.
- [ ] **BIZ-19:** E2E `cp-playbook-phase-a.spec.ts`.
- [ ] **BIZ-20:** Phase A verify checklist.

---

## Điểm giao Track UI ↔ Track BIZ

| Integration | UI task | Biz task |
|---|---|---|
| Playbook picker trong studio header | UI-18 | BIZ-11 |
| OVR-01 project table client name | UI-10 | UI-28 API |
| Batch stepper + playbook run | UI-21 | BIZ-5, BIZ-6 |
| Review QC domain rows | UI-9 table | BIZ-16 |
| Demo tour “The Peak” + playbooks | UI-29 seed | BIZ-7 seed |
| E2E smoke | UI-32 mockup shell | BIZ-19 playbook |

---

## MVP Phase A (nếu cần cắt scope)

**Bắt buộc (demo Nova + mockup cảm quan):**

UI-1…5, UI-6…11, UI-14, UI-18…21, UI-28, UI-32  
BIZ-1…6, BIZ-10…17, BIZ-19

**Defer tuần 5+:** UI-22…27 (MED/BRK/CAL/RPT/SET full parity)

---

## Acceptance — Integrated Phase A done

| # | Tiêu chí |
|---|---|
| 1 | Sidebar navy, topbar, credit footer — visual + E2E UI-32 |
| 2 | OVR-01/02 khớp mockup subtitle + Action Center full page |
| 3 | PRJ-01 client name + progress (không UUID) |
| 4 | VID-01 3-col + playbook picker |
| 5 | RE → batch BĐS + studio regenerate lead/bds |
| 6 | Lead ingest QC + launch block |
| 7 | Demo seed KPI có số trên VPS |

---

## Phase B — ✅ shipped (see `2026-09-10-creative-os-phase-b.md`)

- UI-22…27 module parity + `cp-ui-mockup.spec.ts`
- ffprobe auto QC facts + SOP ingest API
- Demo seed The Peak expanded

## Phase C — ✅ shipped (see `2026-09-10-creative-os-phase-c.md`)

- Dual render worker (`stub` + `video_sop`)
- RPT closed-loop CPL by `re_project_id`
- Ads Ops launch gate (`re_lead_default` → QC passed)
