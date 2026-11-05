# Creative OS Playbook Phase A — Verification Checklist

> **Branch:** `feat/cp-integrated-phase-a`  
> **Plans:** [integrated Phase A](../superpowers/plans/2026-09-10-creative-os-integrated-phase-a.md) · [agency win](../superpowers/plans/2026-09-10-cp-video-agency-win-phase-a.md)

## Backend

- [ ] `npm run test -w ptt-crm-api -- cp-playbook.registry`
- [ ] `npm run test -w ptt-crm-api -- cp-qc-packs`
- [ ] `npm run test -w ptt-crm-api -- cp-re-handoff`
- [ ] `GET /api/crm/cp/playbooks` → 3 playbooks with `qc_pack`
- [ ] `POST /api/crm/cp/re-projects/:id/cp-handoff` → `batch_id` + `href`
- [ ] `POST .../videos/versions/:id/qc` with `{ pack: "lead_social" }` runs domain checks

## Seed / scripts

- [ ] `./scripts/seed_cp_playbooks_phase_a.sh` idempotent (second run SKIP)
- [ ] `SEED_CP_PLAYBOOKS=1` documented in deploy
- [ ] `./scripts/ingest_ptt_lead_video_pack.sh` stub exits 0; documents QC gate
- [ ] `./scripts/seed_cp_demo_the_peak.sh` skeleton runs playbook seed when `SEED_CP_DEMO=1`

## UI

- [ ] PRJ-01: client name + progress bar + grid/list toggle
- [ ] VID-06: batch `.stepper` 4 steps
- [ ] VID-01 / video list: `CpPlaybookPicker` on empty drafts
- [ ] Review: QC run sends playbook `qc_pack`; domain rows visible; export disabled when blocked
- [ ] RE project: **Tạo creative pack BĐS** when `crm_cp.edit`

## E2E

- [ ] `cd services/ops-web && npm run test:e2e -- cp-playbook-phase-a` (API up)

## Acceptance (Phase A)

| AC | Verify |
|---|---|
| 3 playbooks + picker | API + E2E smoke |
| RE → BĐS batch | Handoff button + API |
| Studio regenerate | auto-script with playbook |
| Lead ingest QC | ingest script + launch block |
| TVC dual module | [37-cp-tvc-sop-handoff.md](../huong-dan-su-dung/37-cp-tvc-sop-handoff.md) |
