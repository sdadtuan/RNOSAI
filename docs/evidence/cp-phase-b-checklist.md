# Creative OS Phase B — Verification Checklist

> **Branch:** `feat/cp-integrated-phase-a`  
> **Plan:** [Phase B](../superpowers/plans/2026-09-10-creative-os-phase-b.md)

## Backend — QC ffprobe

- [ ] `npm run test -w ptt-crm-api -- cp-media-probe`
- [ ] `npm run test -w ptt-crm-api -- cp-qc.service`
- [ ] `probeMediaFile('/missing.mp4')` returns `null` (no throw)
- [ ] `POST .../videos/versions/:id/qc` auto-probes when `output_uri` is `file://` or local path

## Backend — SOP ingest (PL-3 TVC)

- [ ] `npm run test -w ptt-crm-api -- cp-sop-ingest`
- [ ] `POST /api/crm/cp/videos/sop-ingest` with `{ project_id, name, output_uri }` → `draft_id`, `version_id`, `href`
- [ ] Body with `facts` runs QC pack `tvc_short`
- [ ] `playbook_id` defaults to `tvc_short_169`

## Backend — project list display

- [ ] `GET /api/crm/cp/projects` items include `progress_pct` (`round(done/total*100)`)
- [ ] `progress_pct` is `0` when `deliverable_total` is 0

## Seed / scripts

- [ ] `./scripts/seed_cp_demo_the_peak.sh` prints SQL fallback when `SEED_CP_DEMO` unset
- [ ] `SEED_CP_DEMO=1` + staff token creates **The Peak — Launch Q3** project
- [ ] Deliverables seeded for ~62% progress bar (8/13)
- [ ] Optional `CP_DEMO_OUTPUT_URI` triggers sop-ingest curl

## UI (Phase B waves — separate PRs)

- [ ] PRJ-01 uses API `progress_pct` when present
- [ ] TVC Studio banner wires **SOP ingest** CTA

## Acceptance (Phase B backend scope)

| AC | Verify |
|---|---|
| ffprobe → QcFacts | unit spec + QC run auto-merge |
| SOP → CP version | sop-ingest service + POST route |
| Demo The Peak | seed script API path + SQL docs |
| progress_pct | projects list mapper + spec |
