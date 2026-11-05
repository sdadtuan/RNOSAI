# Creative OS Phase C — Render depth + Closed loop

> **Prerequisite:** Phase A + B on `feat/cp-integrated-phase-a`

**Goal:** Render worker thật (stub/SOP), gate Ads Ops theo QC CP, báo cáo CPL theo `re_project_id`.

---

## Wave C1 — Render worker dual mode ✅

- [x] **C-RENDER-1:** `cp-render-mode.util.ts` — provider resolution
- [x] **C-RENDER-2:** `cp-sop-output.util.ts` — VD master lookup
- [x] **C-RENDER-3:** `cp-render.worker.ts` — stub + video_sop + poller
- [x] **C-RENDER-4:** `cp-renders.service.ts` — ghi `provider` đúng

## Wave C2 — Ads Ops launch gate ✅

- [x] **C-ADS-1:** `cp-launch-gate.service.ts` + util
- [x] **C-ADS-2:** Hub submit gắn `cp_version:{uuid}`
- [x] **C-ADS-3:** Meta Ads Ops hook trước `submitLaunch`

## Wave C3 — RPT closed-loop ✅

- [x] **C-RPT-1:** `cp-reports-closed-loop.util.ts`
- [x] **C-RPT-2:** Performance API `closed_loop[]`
- [x] **C-RPT-3:** `CpReports.tsx` table CPL

## Evidence

- [x] `docs/evidence/cp-phase-c-checklist.md`

---

## Phase D (follow-up plan)

See `2026-09-10-creative-os-phase-d.md` — VID-06 matrix, playbook clone, CAL-04 native monitor.
