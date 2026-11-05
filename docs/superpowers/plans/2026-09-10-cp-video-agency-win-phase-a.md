# Creative OS Video Agency Win — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase A (tuần 1–4) — Industry Playbooks + RE→CP handoff + Domain QC + Regenerate Studio + Lead ingest gate — để demo thắng Nova trên BĐS social, lead video, và chuẩn bị PL-3 TVC governance (Phase B).

**Architecture:** Playbook = published template + QC pack id + channel profiles + optional RE/CRM source mapping. API mỏng (`cp-playbooks.service`) compose sẵn có `cp-templates`, `cp-batches`, `cp-videos`, `cp-qc`. Regenerate Studio = playbook script engine (deterministic Phase A) thay `stubRegeneratedCopy`. RE handoff mirror pattern `cp-content-os-handoff.service`. PL-3 TVC chỉ thêm playbook metadata + ingest hook stub — render SOP ở Phase B.

**Tech Stack:** NestJS `ptt-crm-api/src/cp/*`, Next.js `ops-web`, Vitest/Jest, Playwright, SQL migrations nếu cần bảng `crm_cp_playbooks`.

**Spec:** `docs/superpowers/specs/2026-09-10-cp-video-agency-win-design.md`  
**Lead pack SoT:** `docs/superpowers/specs/2026-09-10-ptt-fb-lead-video-design.md`

> **UI Mockup:** Track UI (shell navy, OVR/PRJ/VID mockup, demo seed) **chưa nằm trong 20 task dưới** — đã gộp vào master plan  
> [`2026-09-10-creative-os-integrated-phase-a.md`](./2026-09-10-creative-os-integrated-phase-a.md) (UI-1…33 + BIZ-1…20).  
> Thực thi **UI-1…5 trước** (blocker visual), song song BIZ-1…3 tuần 1.

## Global Constraints

- Phase A **không** bật provider AI thật — render = stub hoặc **ingest file** có sẵn.
- KPI null → `—` trên UI; demo số từ seed/API, không hard-code component.
- QC **Blocked** ⇒ không export, không publish, không launch Ads Ops brief.
- Copy playbook/subtitle khóa Vitest; commit sau mỗi task; không `--no-verify`.
- Regenerate Studio Phase A = **playbook script engine** (script beats → scenes), không gọi Runway/Kling.
- PL-3 TVC Phase A = playbook + QC pack `tvc_short` + doc handoff SOP; **không** wire SOP worker trong plan này.
- RBAC: reuse `crm_cp.*` caps; RE handoff cần `crm_cp.edit` + quyền RE project.

---

## File map

| File | Trách nhiệm |
|---|---|
| `cp-playbook.types.ts` | Playbook id, PL line, QC pack, channel profiles |
| `cp-playbook.registry.ts` | Static registry 3 playbooks (Phase A) |
| `cp-playbooks.service.ts` | List, get, run (validate + batch enqueue) |
| `cp-re-handoff.service.ts` | RE Project → CP project + batch/template |
| `cp-playbook-script.engine.ts` | Script→scenes regenerate (lead/bds beats) |
| `cp-qc-packs.util.ts` | `bds_social`, `lead_social`, `tvc_short` atop generic QC |
| `cp-qc.service.ts` | Accept `pack` param on run |
| `cp-videos.service.ts` | Wire regenerate → script engine when playbook set |
| `cp.controller.ts` | Routes playbooks + re-handoff |
| `scripts/seed_cp_playbooks_phase_a.sh` | Publish 3 templates + demo |
| `scripts/ingest_ptt_lead_video_pack.sh` | 4 MP4 → DAM + CP versions |
| `lib/crm/cp-playbook-api.ts` | Frontend API client |
| `lib/crm/cp-playbook-copy.ts` | UI labels + Vitest |
| `CpPlaybookPicker.tsx` | Studio + batch entry |
| `CpVideoStudio.tsx` | Playbook context + “Tạo lại kịch bản” |
| `CpStoryboard.tsx` | Regenerate scene via playbook |
| `re-projects/[id]/page.tsx` | Nút “Tạo creative pack BĐS” |
| `e2e/cp-playbook-phase-a.spec.ts` | Smoke RE handoff + playbook picker |

---

## Playbook registry (Phase A)

```ts
export const CP_PLAYBOOKS = {
  bds_social_916: {
    id: 'bds_social_916',
    line: 'PL-1',
    label: 'BĐS Social Ads · 9:16',
    template_slug: 'bds-social-916',
    qc_pack: 'bds_social',
    channels: ['meta_reels_916', 'meta_feed_45', 'meta_square_11'],
    vars: ['project_name', 'price_from', 'location', 'cta', 'hotline'],
    source: 're_project_products',
  },
  lead_social_916: {
    id: 'lead_social_916',
    line: 'PL-2',
    label: 'Lead Video Social · 9:16',
    template_slug: 'lead-social-916',
    qc_pack: 'lead_social',
    channels: ['meta_reels_916'],
    vars: ['hook_id', 'offer', 'primary_text'],
    source: 'manual',
    script_beats: ['hook', 'pain', 'ui_proof', 'form_crm', 'cta'],
  },
  tvc_short_169: {
    id: 'tvc_short_169',
    line: 'PL-3',
    label: 'Brand TVC ngắn · 16:9',
    template_slug: 'tvc-short-169',
    qc_pack: 'tvc_short',
    channels: ['youtube_169', 'meta_916_cutdown'],
    vars: ['brand_name', 'tagline', 'legal_disclaimer'],
    source: 'manual',
    sop_handoff: true,
  },
} as const;
```

---

## Sóng triển khai

| Sóng | Ship | Tasks |
|---|---|---|
| A | Playbook types + QC packs + script engine | 1–5 |
| B | RE handoff API + BĐS batch | 6–9 |
| C | Regenerate Studio + playbook picker UI | 10–13 |
| D | Lead ingest + launch gate | 14–16 |
| E | RE UI + TVC playbook stub + E2E | 17–20 |

---

### Task 1: Playbook types + registry + Vitest

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-playbook.types.ts`
- Create: `services/ptt-crm-api/src/cp/cp-playbook.registry.ts`
- Create: `services/ptt-crm-api/src/cp/cp-playbook.registry.spec.ts`

**Steps:**
- [ ] Define `CpPlaybookId`, `CpQcPackId`, channel profile types.
- [ ] Export `CP_PLAYBOOKS` constant (3 entries above).
- [ ] Vitest: 3 playbooks, unique ids, each has `qc_pack` + `template_slug`.
- [ ] Run: `npm run test -w ptt-crm-api -- cp-playbook.registry`
- [ ] Commit: `feat(cp): add industry playbook registry for Phase A`

---

### Task 2: Domain QC packs util

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-qc-packs.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-qc-packs.util.spec.ts`
- Modify: `services/ptt-crm-api/src/cp/cp-qc.service.ts`

**Steps:**
- [ ] `evaluateDomainQc(pack, facts)` — merge atop generic `evaluateQcChecks`.
- [ ] `lead_social`: delegate to `evaluateLeadVideoFile` when facts match `LeadVideoFileFacts`.
- [ ] `bds_social`: block if `banned_phrase` in caption/script (list from Service KPI real_estate sample).
- [ ] `tvc_short`: block if `legal_approved !== true` when `has_claim`.
- [ ] `cp-qc.service.run(id, facts, scope, { pack })` optional 4th arg.
- [ ] Vitest per pack: 1 pass + 1 block case.
- [ ] Commit: `feat(cp): domain QC packs bds_social lead_social tvc_short`

---

### Task 3: Playbook script engine (regenerate Studio core)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-playbook-script.engine.ts`
- Create: `services/ptt-crm-api/src/cp/cp-playbook-script.engine.spec.ts`

**Steps:**
- [ ] `buildScenesFromPlaybook(playbookId, vars)` → `CpScene[]` (4–6 scenes).
- [ ] `lead_social_916`: map beats H1 script table from PTT-FB-LEAD spec (caption + VO + visual direction).
- [ ] `bds_social_916`: hook căn + giá từ + vị trí + CTA hotline (≤42 char overlay).
- [ ] `regenerateScene(playbookId, sceneIdx, vars, lockedFields)` — respect lock list.
- [ ] Vitest: lead H1 produces 5 scenes; locked overlay unchanged on regenerate.
- [ ] Commit: `feat(cp): playbook script engine for studio regenerate`

---

### Task 4: Wire regenerate + auto-script in cp-videos.service

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp-videos.service.ts`
- Modify: `services/ptt-crm-api/src/cp/cp-videos.service.spec.ts`

**Steps:**
- [ ] Draft field `playbook_id` + `playbook_vars_json` (migration or JSON column on `crm_cp_video_drafts`).
- [ ] Replace `stubRegeneratedCopy` → script engine when `playbook_id` set; fallback stub otherwise.
- [ ] `POST /videos/:id/auto-script` — fill script + scenes from playbook vars.
- [ ] `auto_script` checkbox in studio triggers auto-script on save (debounced).
- [ ] Tests: regenerate with playbook vs without.
- [ ] Commit: `feat(cp): wire playbook regenerate and auto-script on drafts`

---

### Task 5: Playbooks service + controller routes

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-playbooks.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-playbooks.service.spec.ts`
- Modify: `services/ptt-crm-api/src/cp/cp.controller.ts`
- Modify: `services/ptt-crm-api/src/cp/cp.module.ts`

**Steps:**
- [ ] `GET /playbooks` — list registry (cap `crm_cp.view`).
- [ ] `GET /playbooks/:id` — detail + linked template id if published.
- [ ] `POST /playbooks/:id/run` — body `{ source, rows?, re_project_id? }` → batch job id.
- [ ] Register in module.
- [ ] Controller spec smoke.
- [ ] Commit: `feat(cp): playbooks list and run API`

---

### Task 6: RE handoff service

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-re-handoff.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-re-handoff.service.spec.ts`
- Modify: `services/ptt-crm-api/src/cp/cp.controller.ts`

**Steps:**
- [ ] `POST /re-projects/:id/cp-handoff` body `{ playbook_id: 'bds_social_916', product_ids?: string[] }`.
- [ ] Load RE project + products (available/hold); map rows: project_name, price_from, location, hotline.
- [ ] Create/find CP project linked `re_project_id` metadata on `crm_cp_projects` (JSON meta or new column).
- [ ] Call `playbooks.run` with mapped rows.
- [ ] Return `{ cp_project_id, batch_id, href }`.
- [ ] Vitest with mocked RE query + batch.
- [ ] Commit: `feat(cp): RE project to CP playbook handoff`

---

### Task 7: Seed published templates for 3 playbooks

**Files:**
- Create: `scripts/seed_cp_playbooks_phase_a.sh`
- Create: `services/ptt-crm-api/src/cp/cp-playbook-templates.seed.ts` (optional inline in script via curl)

**Steps:**
- [ ] Template `bds-social-916`: vars + default config 9:16 15s.
- [ ] Template `lead-social-916`: vars hook_id + script scaffold.
- [ ] Template `tvc-short-169`: vars brand + disclaimer placeholder.
- [ ] Publish all three; idempotent slug.
- [ ] Document env: `SEED_CP_PLAYBOOKS=1` in deploy script comment.
- [ ] Commit: `chore(cp): seed Phase A playbook templates`

---

### Task 8: BĐS batch row mapper from RE products

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-re-product.mapper.ts`
- Create: `services/ptt-crm-api/src/cp/cp-re-product.mapper.spec.ts`
- Modify: `services/ptt-crm-api/src/cp/cp-playbooks.service.ts`

**Steps:**
- [ ] Map `ReProjectProductRow` → batch row JSON with required template vars.
- [ ] Validate: skip sold/locked unless flag; collect errors for error CSV.
- [ ] Price format “từ X tỷ” Vietnamese locale.
- [ ] Unit tests with fixture products.
- [ ] Commit: `feat(cp): map RE inventory to BĐS batch rows`

---

### Task 9: DDL playbook metadata on drafts/projects (if needed)

**Files:**
- Create: `services/ptt-crm-api/migrations/XXXX_cp_playbook_meta.sql` (or existing migration pattern)
- Modify: repositories as needed

**Steps:**
- [ ] `crm_cp_video_drafts.playbook_id VARCHAR(64)` nullable.
- [ ] `crm_cp_video_drafts.playbook_vars_json JSONB` default `{}`.
- [ ] `crm_cp_projects.meta_json` or `re_project_id BIGINT` nullable index.
- [ ] Apply in local + document in deploy_cp_os_vps.sh.
- [ ] Commit: `feat(cp): DDL playbook and re_project linkage`

---

### Task 10: Frontend cp-playbook-api + copy constants

**Files:**
- Create: `services/ops-web/src/lib/crm/cp-playbook-api.ts`
- Create: `services/ops-web/src/lib/crm/cp-playbook-copy.ts`
- Create: `services/ops-web/src/lib/crm/cp-playbook-copy.spec.ts`

**Steps:**
- [ ] API: `listPlaybooks`, `getPlaybook`, `runPlaybook`, `reProjectHandoff`.
- [ ] Copy: playbook labels, picker subtitle, RE button label.
- [ ] Vitest lock 3 playbook labels.
- [ ] Commit: `feat(cp-ui): playbook API client and copy constants`

---

### Task 11: CpPlaybookPicker component

**Files:**
- Create: `services/ops-web/src/components/crm/cp/CpPlaybookPicker.tsx`

**Steps:**
- [ ] Card grid 3 playbooks (PL-1/2/3 badges).
- [ ] On select → set draft `playbook_id` + navigate studio with query `?playbook=`.
- [ ] Show channel chips + QC pack hint.
- [ ] Used on `/crm/creative-os/video` list empty state + studio header.
- [ ] Commit: `feat(cp-ui): CpPlaybookPicker for industry playbooks`

---

### Task 12: CpVideoStudio — playbook context + regenerate UX

**Files:**
- Modify: `services/ops-web/src/components/crm/cp/CpVideoStudio.tsx`
- Modify: `services/ops-web/src/lib/crm/cp-api.ts`

**Steps:**
- [ ] Load playbook from draft or query param; show banner “Playbook: BĐS Social · QC bds_social”.
- [ ] Button **Tạo lại kịch bản** → `POST auto-script`.
- [ ] `auto_script` checkbox calls auto-script after debounce.
- [ ] Pass playbook vars form (project_name, price_from, …) when playbook selected.
- [ ] Commit: `feat(cp-ui): studio playbook context and auto-script regenerate`

---

### Task 13: CpStoryboard — regenerate scene via playbook

**Files:**
- Modify: `services/ops-web/src/components/crm/cp/CpStoryboard.tsx`

**Steps:**
- [ ] Regenerate button calls existing API; show toast “Đã tạo lại scene từ playbook”.
- [ ] Disable regenerate when scene locked.
- [ ] Show beat label (hook/ui/cta) when playbook active.
- [ ] Commit: `feat(cp-ui): storyboard playbook-aware regenerate`

---

### Task 14: Lead video ingest script

**Files:**
- Create: `scripts/ingest_ptt_lead_video_pack.sh`
- Modify: `docs/huong-dan-su-dung/36-ptt-fb-lead-video.md` (link script)

**Steps:**
- [ ] Upload 4 files to DAM (or local path arg).
- [ ] Create CP project “PTT Lead Performance”.
- [ ] Create versions + run QC pack `lead_social` with facts JSON per hook.
- [ ] Fail script exit 1 if any blocked.
- [ ] Commit: `chore(cp): ingest PTT lead video pack with QC gate`

---

### Task 15: Ads Ops launch block on QC fail

**Files:**
- Modify: Meta Ads Ops launch path (grep `re_lead_default` / creative attach)
- Modify: `services/ptt-crm-api/src/cp/cp-publish.service.ts` or ads module hook

**Steps:**
- [ ] Before launch brief attach creative: require CP version `qc_status === 'passed'` for pack `lead_social`.
- [ ] Return 400 `{ error: 'qc_blocked', checks: [...] }` with audit log.
- [ ] Vitest/integration test mock version blocked.
- [ ] Commit: `feat(cp): block Ads Ops launch when lead QC fails`

---

### Task 16: QC UI — show domain pack results

**Files:**
- Modify: `services/ops-web/src/components/crm/cp/CpVideoReview.tsx`
- Modify: `services/ops-web/src/lib/crm/cp-review.util.ts`

**Steps:**
- [ ] QC run sends `pack` from version/draft playbook.
- [ ] Display domain check rows (face time, safe zone, banned phrase).
- [ ] Block export button when overall blocked.
- [ ] Commit: `feat(cp-ui): domain QC pack display on review`

---

### Task 17: RE Project detail — “Tạo creative pack BĐS”

**Files:**
- Modify: `services/ops-web/src/app/crm/re-projects/[id]/page.tsx`
- Modify: `services/ops-web/src/lib/api.ts` (handoff client)

**Steps:**
- [ ] Button visible if `hasCap('crm_cp.edit')` + project status selling/presale.
- [ ] Modal: chọn sản phẩm (checkbox) hoặc “tất cả available”.
- [ ] Call `POST re-projects/:id/cp-handoff` → redirect batch page with job id.
- [ ] Commit: `feat(re-projects): CP BĐS creative pack handoff button`

---

### Task 18: TVC playbook stub + SOP handoff doc hook

**Files:**
- Modify: `services/ops-web/src/components/crm/cp/CpVideoStudio.tsx` (TVC banner)
- Create: `docs/huong-dan-su-dung/37-cp-tvc-sop-handoff.md`

**Steps:**
- [ ] When playbook `tvc_short_169`: show CTA “Mở Video SOP” + copy “Render cinematic trong SOP → ingest version vào CP”.
- [ ] Doc: steps SOP job → ingest → QC tvc_short → legal (Phase B wire).
- [ ] Commit: `docs(cp): TVC dual-module SOP handoff guide Phase A`

---

### Task 19: E2E smoke cp-playbook-phase-a

**Files:**
- Create: `services/ops-web/e2e/cp-playbook-phase-a.spec.ts`

**Steps:**
- [ ] Login staff demo → creative-os → playbook picker visible.
- [ ] Select lead playbook → studio subtitle contains `lead_social`.
- [ ] RE project page → handoff button (skip if no RE fixture).
- [ ] Commit: `test(cp): e2e smoke industry playbooks Phase A`

---

### Task 20: Phase A verify + deploy notes

**Files:**
- Modify: `scripts/deploy_cp_os_vps.sh` (comment `SEED_CP_PLAYBOOKS=1`)
- Create: `docs/evidence/cp-playbook-phase-a-checklist.md`

**Steps:**
- [ ] Run jest/vitest cp-playbook* + cp-qc-packs* + cp-re-handoff*.
- [ ] Run e2e smoke locally.
- [ ] Checklist: RE→batch, studio regenerate, lead ingest QC, launch block.
- [ ] Commit: `docs(cp): Phase A verification checklist`

---

## Phase A done khi

| AC | Verify |
|---|---|
| 3 playbooks list API + picker UI | GET /playbooks + E2E |
| RE Project → batch BĐS ≥1 row | Handoff API + UI button |
| Studio regenerate script→scenes (lead + bds) | auto-script + storyboard test |
| Lead 4 file ingest + QC pass | ingest script exit 0 |
| Launch blocked on QC fail | API test 400 |
| TVC playbook visible + SOP doc | Manual + doc link |

---

## Phase B preview (không làm trong plan này)

- Bridge Video SOP → CP render worker (MP4 thật).
- PL-3 TVC end-to-end ingest after SOP complete.
- ffprobe auto facts for all QC packs.
- Real AI provider when `CP_AI_ENABLED=1`.

---

## Rủi ro

| Rủi ro | Mitigation |
|---|---|
| RE products thiếu field | Mapper defaults + validation errors CSV |
| Playbook regenerate feels “fake” without AI | Beats từ spec thật; Phase B swap engine adapter |
| Ads Ops hook scattered | Single guard function `assertCpCreativeQcPassed` |
| DDL migration on VPS | Idempotent migration + deploy script note |
