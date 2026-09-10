# Creative OS Phase B — UI Parity + Render Depth

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development  
> **Prerequisite:** Phase A on `feat/cp-integrated-phase-a`

**Goal:** Hoàn UI-22…27 (MED/BRK/CAL/RPT/SET mockup parity), ffprobe QC facts, SOP→CP ingest (PL-3 TVC), demo seed The Peak đầy đủ, E2E mockup smoke.

---

## Wave B1 — UI module parity (UI-22…27)

- [x] **B-UI-22:** MED-01 `media-grid` 5-col + thumb in `CpMediaLibrary.tsx`
- [x] **B-UI-23:** MED tabs subtitle + card layout
- [x] **B-UI-24:** BRK portfolio grid + swatches (`CpBrandPortfolio`, `CpBrandEditor`)
- [x] **B-UI-25:** CAL-01 `.cp-cal` month grid + event chips in `CpCalendar.tsx`
- [x] **B-UI-26:** RPT `.cp-bars` chart blocks + ROI `—` note in `CpReports.tsx`
- [x] **B-UI-27:** SET integrations tab — platform vs CP map table in `CpSettings.tsx`
- [x] **B-UI-32:** E2E `cp-ui-mockup.spec.ts` — shell navy + subtitles OVR/PRJ/VID/MED

## Wave B2 — API display (UI-28)

- [x] **B-API-1:** `progress_pct`, `lifecycle_label` on project list/overview mapper

## Wave B3 — QC ffprobe (Phase B core)

- [x] **B-QC-1:** `cp-media-probe.util.ts` — probe local/signed path → QcFacts
- [x] **B-QC-2:** `cp-qc.service.run` auto-probe when `output_uri` file exists

## Wave B4 — SOP → CP ingest (PL-3 TVC)

- [x] **B-SOP-1:** `cp-sop-ingest.service.ts` — ingest MP4 URI → version + optional QC `tvc_short`
- [x] **B-SOP-2:** `POST /videos/sop-ingest` + studio TVC banner CTA wired

## Wave B5 — Demo + deploy

- [x] **B-SEED-1:** Expand `seed_cp_demo_the_peak.sh` — project, deliverables, KPI rows
- [x] **B-SEED-2:** `docs/evidence/cp-phase-b-checklist.md`

---

## Phase C preview (not this plan)

- Real Video SOP worker → CP render (Runway/Kling) replacing stub worker
- RPT CPL by `re_project_id` via Ads Ops join
- Native publish CAL-04
