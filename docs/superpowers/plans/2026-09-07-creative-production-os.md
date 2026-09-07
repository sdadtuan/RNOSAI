# Creative Production OS — Full Implementation Plan (SRS v2.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Creative Production OS on RNOSAI — `/crm/creative-os*` + `/api/crm/cp` — matching SRS v2.0 and the 45-screen HTML mockup, wave by wave, without a second app.

**Architecture:** Nest module `cp` in `ptt-crm-api` (Postgres `crm_cp_*`, staff JWT). ops-web uses a dedicated `CpShell` (never KPI Hub, never nested `<main>`). Customer SoR is `clients` (product name `agency_client`). Campaign SoR is `service_lifecycle`. Client review SoR is Creative Hub + portal `/creatives`. Human video SoR is Video SOP (`crm_vd.*`, link only). Credit is an internal ledger, not SaaS billing.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js `ops-web` · PostgreSQL · staff JWT + `staff_section_permissions` · Jest (API) · Vitest (ops-web) · Playwright e2e · no new npm packages · AI **off** until `CP_AI_ENABLED=1` after W1 UAT stub green.

**SoT:**
- SRS: [2026-09-07-creative-production-os-srs.md](../specs/2026-09-07-creative-production-os-srs.md) **v2.0**
- Mockup master: [rnosai-cp-os-srs-mockup.html](../../design/rnosai-cp-os-srs-mockup.html) — 45 screen IDs
- Module mockups: `docs/design/rnosai-cp-os-*-mockup.html`

## Global Constraints

- API prefix **`/api/crm/cp`**. Same staff JWT as CRM. Tenant **`PTT` only**.
- Caps: `crm_cp` `view` / `view_all` / `edit` / `manage` plus `crm_cp.render` · `crm_cp.render_high_cost` · `crm_cp.export_final` · `crm_cp.publish` · `crm_cp.brand` · `crm_cp.manage_brand_rule` · `crm_cp.approve_legal` · `crm_cp.finance` · `crm_cp.view_audit`.
- Customer SoR = table **`clients`** (`id UUID`). Every project/asset/video **requires** `agency_client_id`. Never INSERT a second customer master.
- Campaign SoR = **`service_lifecycle`** (`lifecycle_id` nullable). Never a second campaign table.
- Copy / text calendar SoR = Content OS. CP `PublishItem` is video-only; caption may cite `content_item_id`.
- Human video SoR = `/crm/video` (`crm_vd.*`). CP never INSERT take/bible.
- Client review SoR = Creative Hub + portal `/creatives`. PRJ-05 = `POST /projects/:id/submit-creative`. Never mint a CP portal.
- Ads launch SoR = Campaign Write. CP hands off file + UTM. Ads spend ≠ credit.
- Empty / missing → `null` in API and `—` in UI. Never fake `0`. Never hard-code mockup numbers `86` / `3.840` / `68.4`.
- CSS `cp-*`. Tokens: Navy `#0F2747` · Accent `#2563EB` · Success `#16A34A` · Warning `#D97706` · Danger `#DC2626` · Info `#0891B2` · bg `#F4F6F8` · radius 10–12 · Be Vietnam Pro. Do not copy Nova purple / logo / workspace switcher.
- Product sidebar: **exactly 8 items** — Tổng quan · Dự án · Video AI · Thư viện · Brand Kit · Lịch xuất bản · Báo cáo · Cấu hình. **No count badges.** No demo “Nhảy màn / Toàn catalog” bar in product UI.
- Overview has **exactly 8 KPI tiles** (SRS Q13).
- Staff id = INTEGER JWT `staffId`. Timezone `Asia/Ho_Chi_Minh`.
- `CP_AI_ENABLED` unset on prod until W1 stub UAT is green. Render W1 = stub provider.
- Scripts **never** grant `staff_section_permissions` to users. Catalog only.
- Do not start Wave *n* until Wave *n−1* UAT is green.
- Later-wave screens ship in W1 as **real chrome + empty/`—`**, never copy “mở ở Wave”.
- One `<main>` per page. Class prefix `cp-*` only.

---

## File map

### Backend (`services/ptt-crm-api/src/cp/`)

| File | Responsibility | Wave |
|------|----------------|------|
| `cp.types.ts` | Shared DTO / unions / KPI keys | 1 |
| `cp-scope.util.ts` | `me` / `team` / `all` SQL | 1 |
| `cp-credit.util.ts` | estimate → reserve → charge → release; kinds | 1 |
| `cp-render-block.util.ts` | rights / QC / credit / AI / MIME gates | 1 |
| `cp-format.util.ts` | `null` → never `0` for missing counts | 1 |
| `cp-audit.repository.ts` | Insert `crm_cp_activity` | 1 |
| `guards/staff-cp.guard.ts` | `RequireCpAction` | 1 |
| `cp-overview.service.ts` | KPI + Action Center + health stub + activity | 1 |
| `cp-projects.service.ts` | CRUD, close, members, brief, deliverable, task | 1 |
| `cp-assets.service.ts` | upload ingest, rights, usage | 1–2 |
| `cp-brand.service.ts` | kits, versions, rules, preview | 1–2 |
| `cp-videos.service.ts` | draft, snapshot, render stub, version | 1–2 |
| `cp-renders.service.ts` | job state, retry child, cancel, SSE | 1–3 |
| `cp-ledger.service.ts` | grant / reserve / charge / refund | 1 |
| `cp-settings.service.ts` | GET/PATCH module settings | 1 |
| `cp-approvals.service.ts` | matrix + Hub submit | 2 |
| `cp-qc.service.ts` | 9-check QC | 2 |
| `cp-comments.service.ts` | timecode comments | 2 |
| `cp-publish.service.ts` | composer, gate, schedule | 2–3 |
| `cp-templates.service.ts` | template version | 3 |
| `cp-batches.service.ts` | CSV + matrix + partial retry | 3 |
| `cp-collections.service.ts` | manual + smart | 3 |
| `cp-reports.service.ts` | 5 slugs + export audit | 3 |
| `cp-forecast.util.ts` | credit forecast + assumption | 3–4 |
| `cp-render.worker.ts` | stub then provider adapters | 1 stub / 3 scale |
| `cp-rights.worker.ts` | expiry ≤14d actions | 2 |
| `cp.controller.ts` | HTTP `/api/crm/cp` | 1+ |
| `cp.module.ts` | providers | 1 |

### Frontend (`services/ops-web/src/`)

| File | Responsibility | Wave |
|------|----------------|------|
| `lib/crm/cp-api.ts` | `cpFetch` copy of `amFetch` → `/api/crm/cp/*` | 1 |
| `app/crm/creative-os/layout.tsx` | `CpShell` + `./cp.css` (zone already `app/crm/layout.tsx`) | 1 |
| `lib/crm/cp-nav.util.ts` | 8-item nav + `canSeeCpNav` | 1 |
| `lib/crm/cp-format.ts` | `dash(null)` → `—` | 1 |
| `components/crm/cp/CpShell.tsx` | Chrome: topbar + 8-item sidebar + scope | 1 |
| `components/crm/cp/CpOverview.tsx` | OVR-01/02/04 | 1 |
| `components/crm/cp/CpOpsMonitor.tsx` | OVR-03 | 1 stub / 3 |
| `components/crm/cp/CpProjectsList.tsx` | PRJ-01 | 1 |
| `components/crm/cp/CpProjectForm.tsx` | PRJ-02 | 1 |
| `components/crm/cp/CpProjectWorkspace.tsx` | PRJ-03 8 tabs | 1 |
| `components/crm/cp/CpProjectTimeline.tsx` | PRJ-04 | 1 |
| `components/crm/cp/CpVideoStudio.tsx` | VID-01 | 1 |
| `components/crm/cp/CpStoryboard.tsx` | VID-02 | 2 |
| `components/crm/cp/CpTimeline.tsx` | VID-03 | 2 |
| `components/crm/cp/CpRenderOps.tsx` | VID-04 | 1 |
| `components/crm/cp/CpVideoReview.tsx` | VID-05 | 2 |
| `components/crm/cp/CpBatchFactory.tsx` | VID-06 | 3 |
| `components/crm/cp/CpTemplates.tsx` | VID-07 | 3 |
| `components/crm/cp/CpVersionDetail.tsx` | VID-08 | 1–2 |
| `components/crm/cp/CpMediaLibrary.tsx` | MED-01 | 1 |
| `components/crm/cp/CpAssetDetail.tsx` | MED-02 | 1–2 |
| `components/crm/cp/CpIngest.tsx` | MED-03 | 1 |
| `components/crm/cp/CpCollections.tsx` | MED-04 | 3 |
| `components/crm/cp/CpRightsCenter.tsx` | MED-05 | 1 |
| `components/crm/cp/CpQuality.tsx` | MED-06 | 3 |
| `components/crm/cp/CpBrandPortfolio.tsx` | BRK-01 | 1 |
| `components/crm/cp/CpBrandEditor.tsx` | BRK-02 | 1 |
| `components/crm/cp/CpBrandRules.tsx` | BRK-03 | 2 |
| `components/crm/cp/CpBrandPreview.tsx` | BRK-04 | 2 |
| `components/crm/cp/CpBrandHistory.tsx` | BRK-05 | 2 |
| `components/crm/cp/CpCalendar.tsx` | CAL-01 | 2 |
| `components/crm/cp/CpPublishComposer.tsx` | CAL-02 | 2 |
| `components/crm/cp/CpPublishGate.tsx` | CAL-03 | 2 |
| `components/crm/cp/CpDistribution.tsx` | CAL-04 | 3 |
| `components/crm/cp/CpBulkSchedule.tsx` | CAL-05 | 3 |
| `components/crm/cp/CpReports.tsx` | RPT-01…05 | 3 |
| `components/crm/cp/CpSettings.tsx` | SET-01…08 | 1 |
| `app/crm/creative-os/**` | Routes | 1+ |
| `app/crm/creative-os/cp.css` | Tokens | 1 |

### Shared / ops

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-09-07-postgresql-ddl-cp.sql` | Wave 1 tables |
| `docs/specs/2026-09-07-postgresql-ddl-cp-w2.sql` | Wave 2 tables |
| `docs/specs/2026-09-07-postgresql-ddl-cp-w3.sql` | Wave 3 tables |
| `docs/specs/2026-09-07-postgresql-ddl-cp-w4.sql` | Wave 4 tables |
| `scripts/apply_pg_ddl_cp.sh` | Apply W1 |
| `scripts/apply_pg_ddl_cp_w2.sh` / `_w3.sh` / `_w4.sh` | Later DDL |
| `scripts/seed_cp_rbac.sh` | Grant **catalog only** (no prod users) |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Caps |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/creative-os` **before** `/crm` |
| `services/ops-web/src/lib/auth.spec.ts` | Route 403 tests |
| `services/ops-web/src/components/OpsNav.tsx` | Link **Sản xuất sáng tạo** in Vận hành / Triển khai |
| `services/ptt-crm-api/src/app.module.ts` | Register `CpModule` |
| `services/ops-web/e2e/cp-w1-uat.spec.ts` | W1 UAT |
| `services/ops-web/e2e/helpers/cp-w1-helpers.ts` | API helpers |

---

## Locked IDs (do not invent)

```text
clients.id                         UUID          ← agency_client_id
service_lifecycle.id               existing PK   ← lifecycle_id (nullable)
crm_staff / JWT staffId            INTEGER
crm_vd.projects                    Video SOP     ← vd_project_id link only
content OS items                   existing      ← content_item_id cite only
creatives / portal /creatives      Hub           ← submit-creative
```

Project status: `draft | active | at_risk | in_review | completed | archived`.

Render job state: `draft | queued | preparing | rendering | processing | qc | review | completed | failed | cancelled | expired`.

Asset state: `uploading | processing | ready | quarantined | failed | archived | deleted`.

Credit kinds: `grant | reserve | charge | release | refund | adjustment | expiry`.

KPI keys (exactly 8): `videos_created` · `videos_approved` · `render_success_rate` · `render_avg_duration_sec` · `credits_used` · `credits_remaining` · `assets_expiring` · `tasks_overdue`.

MIME W1 allowlist: `image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/mp4,application/pdf`.

---

## Screen → Task (mọi màn mockup phải có task)

| Screen | Mockup ID | First ship | Task |
|---|---|---|---|
| OVR-01 Dashboard | `ovr-01` | W1 | 5, 12 |
| OVR-02 Action Center | `ovr-02` | W1 | 5, 12 |
| OVR-03 Production Monitor | `ovr-03` | W1 chrome + W3 data | 5, 16, 33 |
| OVR-04 Activity | `ovr-04` | W1 | 5, 12 |
| PRJ-01 Portfolio | `prj-01` | W1 | 6, 13 |
| PRJ-02 Create | `prj-02` | W1 | 6, 13 |
| PRJ-03 Workspace 8 tab | `prj-03` | W1 | 6, 13 |
| PRJ-04 Timeline | `prj-04` | W1 | 6, 13 |
| PRJ-05 Client review | nút Hub | W2 | 21 |
| VID-01 Studio | `vid-01` | W1 | 9, 16 |
| VID-02 Storyboard | `vid-02` | W2 | 22 |
| VID-03 Timeline | `vid-03` | W2 | 22 |
| VID-04 Render Ops | `vid-04` | W1 stub | 9, 16 |
| VID-05 Review | `vid-05` | W2 | 20 |
| VID-06 Batch | `vid-06` | W3 | 29 |
| VID-07 Template | `vid-07` | W3 | 29 |
| VID-08 Version | `vid-08` | W1 snapshot / W2 QC | 9, 20 |
| MED-01 Library | `med-01` | W1 | 7, 14 |
| MED-02 Asset | `med-02` | W1 + W2 version | 7, 25 |
| MED-03 Ingest | `med-03` | W1 | 7, 14 |
| MED-04 Collections | `med-04` | W3 | 30 |
| MED-05 Rights | `med-05` | W1 | 7, 14 |
| MED-06 Quality | `med-06` | W3 | 30 |
| BRK-01 Portfolio | `brk-01` | W1 | 8, 15 |
| BRK-02 Editor | `brk-02` | W1 | 8, 15 |
| BRK-03 Rules | `brk-03` | W2 | 24 |
| BRK-04 Preview Lab | `brk-04` | W2 | 24 |
| BRK-05 History | `brk-05` | W2 | 24 |
| CAL-01 Calendar | `cal-01` | W2 | 23 |
| CAL-02 Composer | `cal-02` | W2 | 23 |
| CAL-03 Gate | `cal-03` | W2 | 23 |
| CAL-04 Monitor | `cal-04` | W3 | 31 |
| CAL-05 Bulk | `cal-05` | W3 | 31 |
| RPT-01…05 | `rpt-01`…`05` | W3 | 32 |
| SET-01 Profile | `set-01` | W1 | 10, 17 |
| SET-02 Members | `set-02` | W1 (project members) | 6, 17 |
| SET-03 SSO | `set-03` | W1 link Admin | 17 |
| SET-04 Credit | `set-04` | W1 | 10, 17 |
| SET-05 Models | `set-05` | W1 | 10, 17 |
| SET-06 Integrations | `set-06` | W1 flags | 17 |
| SET-07 Security | `set-07` | W1 TTL/retention | 10, 17 |
| SET-08 Policy | `set-08` | W1 store / W2 enforce | 10, 20 |

---

## Slice order

```text
W1  DDL/caps → utils/guard → Nest APIs → CpShell + 8 KPI → Project/DAM/Brand/Video stub/ledger/settings → UAT
W2  QC + review + Hub + storyboard/timeline + calendar gate + brand rules + Content OS hook → UAT
W3  Template/batch + collections/quality + CAL monitor/bulk + 5 reports + ops scale → UAT
W4  Forecast polish + A/B + model routing + localization → UAT / signoff
```

Không bật `CP_AI_ENABLED` trên prod trước UAT W1 stub xanh.

---

# Wave 1 — Shell, 8 KPI, Project, DAM, Brand v1, Video stub, Ledger

**UAT gate:** 403 không cap; 8 KPI (`—` hoặc số thật); tạo project bắt buộc `agency_client_id`; upload MIME block; Brand Kit version; render stub reserve/charge không double; placeholders W2+ không 404; 1 `<main>`; không số 86/3840 hard-code.

### Task 1: Wave 1 DDL

**Files:**
- Create: `docs/specs/2026-09-07-postgresql-ddl-cp.sql`
- Create: `scripts/apply_pg_ddl_cp.sh`
- Test: `psql` `\dt crm_cp_*`

**Interfaces:**
- Consumes: SRS §14
- Produces: tables listed in Step 1

- [ ] **Step 1: Write DDL**

```sql
CREATE TABLE IF NOT EXISTS crm_cp_settings (
  tenant_id TEXT PRIMARY KEY DEFAULT 'PTT',
  locale TEXT NOT NULL DEFAULT 'vi-VN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  default_brand_kit_id UUID,
  retention_days INTEGER NOT NULL DEFAULT 365,
  signed_url_ttl_min INTEGER NOT NULL DEFAULT 15,
  restore_days INTEGER NOT NULL DEFAULT 30,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  soft_alert_pct INTEGER NOT NULL DEFAULT 80,
  hard_cap_pct INTEGER NOT NULL DEFAULT 100,
  high_cost_threshold INTEGER NOT NULL DEFAULT 200,
  concurrent_slots INTEGER NOT NULL DEFAULT 5,
  watermark_draft BOOLEAN NOT NULL DEFAULT TRUE,
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  publish_native BOOLEAN NOT NULL DEFAULT FALSE,
  models_json JSONB NOT NULL DEFAULT '[]',
  policy_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_staff_id INTEGER
);
INSERT INTO crm_cp_settings (tenant_id) VALUES ('PTT') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_cp_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL REFERENCES clients(id),
  lifecycle_id TEXT,
  owner_staff_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  objective TEXT,
  start_at DATE,
  due_at DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  credit_budget INTEGER,
  cost_center TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_projects_status_chk CHECK (
    status IN ('draft','active','at_risk','in_review','completed','archived')
  )
);
CREATE INDEX IF NOT EXISTS crm_cp_projects_client_idx
  ON crm_cp_projects (tenant_id, agency_client_id);
CREATE INDEX IF NOT EXISTS crm_cp_projects_owner_idx
  ON crm_cp_projects (tenant_id, owner_staff_id);

CREATE TABLE IF NOT EXISTS crm_cp_project_members (
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_until TIMESTAMPTZ,
  PRIMARY KEY (project_id, staff_id)
);

CREATE TABLE IF NOT EXISTS crm_cp_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_json JSONB NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE TABLE IF NOT EXISTS crm_cp_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  owner_staff_id INTEGER,
  due_at DATE,
  priority TEXT NOT NULL DEFAULT 'normal',
  video_draft_id UUID,
  video_version_id UUID,
  vd_project_id TEXT,
  content_item_id TEXT,
  CONSTRAINT crm_cp_deliv_type_chk CHECK (
    type IN ('ai_video','motion','social','landing_asset','human_video')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_id INTEGER,
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  depends_on_id UUID,
  am_task_id UUID,
  csd_ticket_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at DATE,
  owner_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  depends_on_id UUID
);

CREATE TABLE IF NOT EXISTS crm_cp_brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  scope_type TEXT NOT NULL,
  agency_client_id UUID,
  project_id UUID,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  CONSTRAINT crm_cp_kit_scope_chk CHECK (scope_type IN ('tenant','client','project'))
);

CREATE TABLE IF NOT EXISTS crm_cp_brand_kit_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES crm_cp_brand_kits(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  approved_by INTEGER,
  approved_at TIMESTAMPTZ,
  UNIQUE (kit_id, n)
);

CREATE TABLE IF NOT EXISTS crm_cp_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  agency_client_id UUID NOT NULL REFERENCES clients(id),
  project_id UUID,
  owner_staff_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'uploading',
  bytes BIGINT,
  hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_assets_state_chk CHECK (
    state IN ('uploading','processing','ready','quarantined','failed','archived','deleted')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES crm_cp_assets(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BIGINT,
  meta_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, n)
);

CREATE TABLE IF NOT EXISTS crm_cp_asset_rights (
  asset_id UUID PRIMARY KEY REFERENCES crm_cp_assets(id) ON DELETE CASCADE,
  license_type TEXT,
  owner_name TEXT,
  effective_on DATE,
  expiry_on DATE,
  territory TEXT[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{}',
  restriction TEXT,
  model_release BOOLEAN,
  talent_release BOOLEAN,
  proof_asset_id UUID
);

CREATE TABLE IF NOT EXISTS crm_cp_asset_usages (
  asset_version_id UUID NOT NULL REFERENCES crm_cp_asset_versions(id),
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  PRIMARY KEY (asset_version_id, object_type, object_id)
);

CREATE TABLE IF NOT EXISTS crm_cp_video_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  deliverable_id UUID,
  name TEXT NOT NULL,
  input_mode TEXT NOT NULL DEFAULT 'prompt',
  prompt TEXT,
  script_json JSONB,
  config_json JSONB NOT NULL DEFAULT '{}',
  brand_kit_version_id UUID,
  revision INTEGER NOT NULL DEFAULT 1,
  autosaved_at TIMESTAMPTZ,
  CONSTRAINT crm_cp_draft_mode_chk CHECK (input_mode IN ('prompt','script','url','template'))
);

CREATE TABLE IF NOT EXISTS crm_cp_scenes (
  draft_id UUID NOT NULL REFERENCES crm_cp_video_drafts(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  title TEXT,
  t_start NUMERIC,
  t_end NUMERIC,
  visual TEXT,
  vo TEXT,
  overlay TEXT,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  qc TEXT,
  PRIMARY KEY (draft_id, idx)
);

CREATE TABLE IF NOT EXISTS crm_cp_video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES crm_cp_video_drafts(id),
  version_n INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  qc_status TEXT,
  qc_json JSONB,
  approval_status TEXT NOT NULL DEFAULT 'internal_review',
  immutable BOOLEAN NOT NULL DEFAULT FALSE,
  output_uri TEXT,
  pricing_version TEXT,
  UNIQUE (draft_id, version_n)
);

CREATE TABLE IF NOT EXISTS crm_cp_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES crm_cp_video_drafts(id),
  parent_job_id UUID,
  batch_item_id UUID,
  state TEXT NOT NULL DEFAULT 'draft',
  stage TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'stub',
  model TEXT,
  priority TEXT NOT NULL DEFAULT 'standard',
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  stage_log_json JSONB NOT NULL DEFAULT '[]',
  error_class TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  CONSTRAINT crm_cp_job_state_chk CHECK (
    state IN ('draft','queued','preparing','rendering','processing','qc','review','completed','failed','cancelled','expired')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  agency_client_id UUID,
  project_id UUID,
  job_id UUID,
  cost_center TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT crm_cp_ledger_kind_chk CHECK (
    kind IN ('grant','reserve','charge','release','refund','adjustment','expiry')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_activity (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  actor_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  payload_json JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  staff_id INTEGER NOT NULL,
  page TEXT NOT NULL,
  name TEXT NOT NULL,
  query_json JSONB NOT NULL,
  shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_credit_allocations (
  agency_client_id UUID PRIMARY KEY REFERENCES clients(id),
  allocated INTEGER NOT NULL DEFAULT 0,
  alert_soft_pct INTEGER NOT NULL DEFAULT 80,
  hard_block BOOLEAN NOT NULL DEFAULT TRUE
);
```

- [ ] **Step 2: Write apply script** — copy `scripts/apply_pg_ddl_am.sh`; point at the CP DDL; do **not** seed user caps.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi
URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then echo "Set DATABASE_URL in .env" >&2; exit 1; fi
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/2026-09-07-postgresql-ddl-cp.sql"
echo "OK  CP DDL applied (crm_cp_* tables)"
```

- [ ] **Step 3: Apply local**

```bash
chmod +x scripts/apply_pg_ddl_cp.sh
./scripts/apply_pg_ddl_cp.sh
```

Expected: `\dt crm_cp_*` lists settings, projects, members, briefs, deliverables, tasks, milestones, brand kits/versions, assets/versions/rights/usages, drafts, scenes, versions, render_jobs, ledger, activity, saved_views, allocations.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/2026-09-07-postgresql-ddl-cp.sql scripts/apply_pg_ddl_cp.sh
git commit -m "$(cat <<'EOF'
feat(cp): add Wave 1 PostgreSQL tables for Creative Production OS

EOF
)"
```

---

### Task 2: Caps, OpsNav, route 403

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Create: `scripts/seed_cp_rbac.sh` (catalog comment only — no user INSERT)
- Modify: `services/ops-web/src/lib/rbac-routes.ts` — insert `/crm/creative-os` **before** the `/crm` catch-all
- Modify: `services/ops-web/src/lib/auth.spec.ts`
- Modify: `services/ops-web/src/components/OpsNav.tsx` — group **CRM · Triển khai dịch vụ**, label `Sản xuất sáng tạo`, href `/crm/creative-os`
- Modify: `services/ops-web/src/components/OpsNav.tsx` `PAGE_TITLES`

**Interfaces:**
- Consumes: SRS §3.2 caps
- Produces: `canAccessPath('/crm/creative-os', user)` true only with `crm_cp.view` or `view_all`

- [ ] **Step 1: Write failing route tests**

In `auth.spec.ts` next to AM cases:

```ts
const cpView = userWith([{ section: 'crm_cp', action: 'view' }]);
const agency = userWith([{ section: 'crm_board', action: 'view' }]);
expect(canAccessPath('/crm/creative-os', agency, 'crm')).toBe(false);
expect(canAccessPath('/crm/creative-os/projects', cpView, 'crm')).toBe(true);
```

Use the same `userWith` helper already in the file.

- [ ] **Step 2: Run test — expect FAIL** (section unknown / prefix missing)

```bash
cd services/ops-web && npx vitest run src/lib/auth.spec.ts
```

- [ ] **Step 3: Add catalog + prefix + nav**

`actions` map:

```json
"crm_cp": ["view", "view_all", "edit", "manage"],
"crm_cp.render": ["execute"],
"crm_cp.render_high_cost": ["execute"],
"crm_cp.export_final": ["execute"],
"crm_cp.publish": ["execute"],
"crm_cp.brand": ["edit"],
"crm_cp.manage_brand_rule": ["manage"],
"crm_cp.approve_legal": ["execute"],
"crm_cp.finance": ["view"],
"crm_cp.view_audit": ["view"]
```

Sections array entries: `id` / `label` / `group: "CRM"` / `page: "/crm/creative-os"`.

`rbac-routes.ts` insert **above** `{ prefix: '/crm' }`:

```ts
{
  prefix: '/crm/creative-os',
  anyOf: [
    { section: 'crm_cp', action: 'view' },
    { section: 'crm_cp', action: 'view_all' },
  ],
},
```

OpsNav: `if (hasCap(user, 'crm_cp', 'view') || hasCap(user, 'crm_cp', 'view_all')) delivery.push({ href: '/crm/creative-os', label: 'Sản xuất sáng tạo' });` after Creative Hub, before or after Video SOP.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ops-web && npx vitest run src/lib/auth.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json \
  services/ops-web/src/lib/rbac-routes.ts services/ops-web/src/lib/auth.spec.ts \
  services/ops-web/src/components/OpsNav.tsx scripts/seed_cp_rbac.sh
git commit -m "$(cat <<'EOF'
feat(cp): register crm_cp caps, route prefix, and OpsNav link

EOF
)"
```

---

### Task 3: Types, scope, credit, render-block

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp.types.ts`
- Create: `services/ptt-crm-api/src/cp/cp-scope.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-scope.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-credit.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-credit.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-render-block.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-render-block.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-format.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-format.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/guards/staff-cp.guard.ts`

**Interfaces:**
- Consumes: AM `am-scope.util.ts` pattern
- Produces:
  - `export type CpScope = 'me' | 'team' | 'all'`
  - `resolveCpScope({ requested, hasViewAll, canTeam }): CpScope`
  - `cpScopeSql({ scope, staffId, teamIds }): { sql: string; params: unknown[] }`
  - `emptyKpis(): CpKpis` — all 8 keys `null`
  - `ledgerBalance(rows): { used: number | null; remaining: number | null }`
  - `canChargeIdempotent(existingKey: string | null, key: string): boolean`
  - `renderBlockReasons(input: RenderGateInput): string[]`
  - `dash<T>(v: T | null | undefined): T | null` (UI uses `—` only in ops-web)

- [ ] **Step 1: Write failing tests**

```ts
// cp-format.util.spec.ts
import { emptyKpis } from './cp.types';
import { kpiOrNull } from './cp-format.util';
it('empty book KPIs are null not zero', () => {
  const k = emptyKpis();
  expect(k.videos_created).toBeNull();
  expect(k.credits_used).toBeNull();
  expect(Object.keys(k)).toHaveLength(8);
});
it('kpiOrNull treats missing as null', () => {
  expect(kpiOrNull(undefined)).toBeNull();
  expect(kpiOrNull(0)).toBe(0);
});

// cp-scope.util.spec.ts
it('downgrades all to me without view_all', () => {
  expect(resolveCpScope({ requested: 'all', hasViewAll: false, canTeam: false })).toBe('me');
});

// cp-credit.util.spec.ts
it('second reserve with same idempotency key does not add', () => {
  expect(canChargeIdempotent('k1', 'k1')).toBe(false);
  expect(canChargeIdempotent(null, 'k1')).toBe(true);
});
it('hard cap blocks when used+reserve >= allocated', () => {
  expect(hardCapBlocks({ allocated: 100, used: 80, reserve: 20, hard: true })).toBe(true);
  expect(hardCapBlocks({ allocated: 100, used: 80, reserve: 19, hard: true })).toBe(false);
});

// cp-render-block.util.spec.ts
it('blocks when AI off, asset not ready, rights expired, or QC blocked', () => {
  expect(renderBlockReasons({
    aiEnabled: false, hasRenderCap: true, assetState: 'ready',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: 'passed',
  })).toContain('ai_disabled');
  expect(renderBlockReasons({
    aiEnabled: true, hasRenderCap: true, assetState: 'processing',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: null,
  })).toContain('asset_not_ready');
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ptt-crm-api && npx jest src/cp/cp-format.util.spec.ts src/cp/cp-scope.util.spec.ts src/cp/cp-credit.util.spec.ts src/cp/cp-render-block.util.spec.ts
```

- [ ] **Step 3: Implement utils + guard**

Copy `StaffAmGuard` to `StaffCpGuard`. Metadata keys `cpRequiredAction` / `cpRequiredSection`. Default section `crm_cp`. `RequireCpAction('view' | 'edit' | 'manage')`. Extra: `RequireCpSection('crm_cp.render', 'execute')`.

`cpScopeSql` for `me`:

```ts
sql: `(p.owner_staff_id = $staff OR EXISTS (
  SELECT 1 FROM crm_cp_project_members m
   WHERE m.project_id = p.id AND m.staff_id = $staff
))`
```

`team`: `p.owner_staff_id = ANY($teamStaff)` or member in team — reuse `staff_user_teams` the same way AM resolves `teamIds`. If `teamIds` empty, fall back to `me`.

`emptyKpis`:

```ts
export function emptyKpis(): CpKpis {
  return {
    videos_created: null,
    videos_approved: null,
    render_success_rate: null,
    render_avg_duration_sec: null,
    credits_used: null,
    credits_remaining: null,
    assets_expiring: null,
    tasks_overdue: null,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/cp
git commit -m "$(cat <<'EOF'
feat(cp): add scope, credit, and render-gate utilities

EOF
)"
```

---

### Task 4: Nest module + controller skeleton + audit

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-audit.repository.ts`
- Create: `services/ptt-crm-api/src/cp/cp.controller.ts`
- Create: `services/ptt-crm-api/src/cp/cp.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — `import { CpModule } from './cp/cp.module';` + `CpModule` in `imports`

**Interfaces:**
- Consumes: `StaffOrInternalKeyGuard` from `staff-auth/staff-or-internal-key.guard.ts`, `StaffCpGuard`, `StaffAuthModule` (same imports as `AmModule`)
- Produces: `GET /api/crm/cp/overview/kpis` registered (may 501 until Task 5)

- [ ] **Step 1: Controller + module**

Copy `AmController` / `AmModule` wiring. Do **not** invent `StaffAuthGuard`.

```ts
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';

@Controller('api/crm/cp')
@UseGuards(StaffOrInternalKeyGuard, StaffCpGuard)
export class CpController {
  @Get('overview/kpis')
  @RequireCpAction('view')
  kpis() {
    return { last_updated: null, kpis: emptyKpis(), filters: {} };
  }
}
```

`CpModule` `imports: [ConfigModule, StaffAuthModule]`. Register `StaffCpGuard` in `providers`. No TypeORM — raw `pg` like AM services.

- [ ] **Step 2: Boot API**

```bash
cd services/ptt-crm-api && npx jest src/am/am-scope.util.spec.ts --passWithNoTests
```

If the project has an e2e Nest test harness, hit `GET /api/crm/cp/overview/kpis` without JWT → 401.

- [ ] **Step 3: Commit**

```bash
git add services/ptt-crm-api/src/cp services/ptt-crm-api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(cp): register CreativeProduction Nest module

EOF
)"
```

---

### Task 5: Overview API (OVR-01…04)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-overview.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-overview.service.spec.ts`
- Modify: `cp.controller.ts` — `GET overview/kpis|actions|health` + `GET activity`

**Interfaces:**
- Consumes: `cpScopeSql`, `emptyKpis`
- Produces:
  - `getKpis({ scope, from, to, clientId, lifecycleId, ownerId }): { last_updated: string; kpis: CpKpis }`
  - `getActions({ scope }): CpAction[]` — kinds `review_pending | render_failed | rights_expiring | budget_threshold | publish_failed | mention`
  - `getHealth(): { queue_depth: number | null; slots: { used: number | null; max: number | null }; providers: Array<{ id: string; success_pct: number | null; p95_sec: number | null }> }`
  - `listActivity({ scope, cursor }): { items: CpActivity[]; next_cursor: string | null }`

- [ ] **Step 1: Failing tests**

```ts
it('returns null KPIs when no rows in scope', async () => {
  const svc = makeOverview({ projects: [], jobs: [], ledger: [], assets: [], tasks: [] });
  const out = await svc.getKpis({ scope: 'me', staffId: 1 });
  expect(out.kpis.videos_created).toBeNull();
  expect(out.last_updated).toMatch(/T/);
});
it('render success is completed/(completed+failed) ignoring cancelled', () => {
  expect(renderSuccessRate({ completed: 9, failed: 1, cancelled: 3 })).toBe(0.9);
  expect(renderSuccessRate({ completed: 0, failed: 0, cancelled: 2 })).toBeNull();
});
```

- [ ] **Step 2: Run — FAIL**

```bash
cd services/ptt-crm-api && npx jest src/cp/cp-overview.service.spec.ts
```

- [ ] **Step 3: Implement SQL**

- `videos_created`: count `crm_cp_video_drafts` joined to scoped projects, `created_at` in range.
- `videos_approved`: count versions `approval_status = 'final_approved'`.
- `render_success_rate`: jobs in range, states completed vs failed only.
- `render_avg_duration_sec`: avg completed duration from `stage_log_json` if present, else `null`.
- `credits_used`: sum `charge` + `reserve` for scope.
- `credits_remaining`: allocation − used; `null` if no allocation row.
- `assets_expiring`: rights `expiry_on <= now()+14d` and not archived.
- `tasks_overdue`: `due_at < now()` and status not done/cancelled.

Action Center: union the 6 kinds. Each item `{ severity, title, resource_type, resource_id, owner_staff_id, sla_at, href }`.

Health W1: `queue_depth` from jobs in `queued|preparing|rendering`; providers = `[{ id: 'stub', success_pct, p95_sec }]` or empty → `null`s. Never invent SLA minutes.

- [ ] **Step 4: Tests PASS + wire controller**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add overview KPI, action center, and activity APIs

EOF
)"
```

---

### Task 6: Projects API (PRJ-01…04)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-projects.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-projects.service.spec.ts`
- Modify: `cp.controller.ts`

**Interfaces:**
- `createProject(input)` requires `name`, `agency_client_id`, `owner_staff_id`; 400 `client_not_found` if `clients.id` missing (same pattern AM `client_not_found`)
- `listProjects({ scope, status, q, cursor })`
- `getProject(id)` 404 outside scope (IDOR)
- `patchProject` / `closeProject` — pending deliverables must be completed or archived
- `addBrief` increments version
- `addDeliverable` — `human_video` stores `vd_project_id` only
- `addTask` — optional `am_task_id` / `csd_ticket_id`, never clone CSD
- `listMilestones`

- [ ] **Step 1: Failing tests**

```ts
it('rejects create without agency_client_id', async () => {
  await expect(svc.create({ name: 'X', owner_staff_id: 1 } as any)).rejects.toMatchObject({
    status: 400,
  });
});
it('unknown client returns client_not_found', async () => {
  await expect(
    svc.create({ name: 'X', agency_client_id: UNKNOWN, owner_staff_id: 1 }),
  ).rejects.toMatchObject({ response: { error: 'client_not_found' } });
});
it('getProject other book is 404 not 403', async () => {
  await expect(svc.get(id, { scope: 'me', staffId: 99 })).rejects.toMatchObject({ status: 404 });
});
```

- [ ] **Step 2: FAIL then implement then PASS**

Close rule: if any deliverable `status` in `draft|queued|rendering|in_review` → 409 `pending_deliverables` unless `archive_pending: true`.

At-risk updater (same request as get): set `at_risk` when overdue deliverable OR credit ≥ 80% OR (W2) approval SLA breach. W1: first two only.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add project CRUD, brief, deliverable, and task APIs

EOF
)"
```

---

### Task 7: DAM API (MED-01/03/05)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-assets.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-assets.service.spec.ts`
- Modify: `cp.controller.ts`

**Interfaces:**
- `CP_MIME_ALLOWLIST` constant
- `createAsset({ agency_client_id, mime, filename, project_id })` → state `uploading`; unknown MIME → 400 `mime_not_allowed`
- `finalizeIngest(id)` W1: mark `ready` after size/hash (scan hook no-op if scanner absent; never `ready` if scan fail)
- `setRights(assetId, rights)`
- `listAssets` / `getAsset` / `usageGraph`
- Expired rights: `rightsStatus(expiry) => 'ok' | 'warn' | 'block'` — warn if ≤14d, block if `< today`

- [ ] **Step 1: Tests**

```ts
it('rejects executable MIME', () => {
  expect(() => assertMime('application/x-msdownload')).toThrow(/mime_not_allowed/);
});
it('rights block after expiry', () => {
  expect(rightsStatus('2020-01-01', '2026-09-07')).toBe('block');
  expect(rightsStatus('2026-09-12', '2026-09-07')).toBe('warn');
});
```

- [ ] **Step 2: Implement + PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add DAM ingest allowlist and asset rights

EOF
)"
```

---

### Task 8: Brand Kit API (BRK-01/02)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-brand.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-brand.service.spec.ts`
- Modify: `cp.controller.ts`

**Interfaces:**
- `createKit({ scope_type, agency_client_id?, project_id?, name })`
- `saveVersion(kitId, payload)` always `n+1` — never UPDATE old `payload_json`
- `listKits` / `getKit`

- [ ] **Step 1: Test — save twice yields v1 then v2; v1 payload unchanged**

```ts
it('edits create a new version', async () => {
  const a = await svc.saveVersion(kitId, { palette: ['#0F2747'] });
  const b = await svc.saveVersion(kitId, { palette: ['#C9A227'] });
  expect(a.n).toBe(1);
  expect(b.n).toBe(2);
  expect((await svc.getVersion(kitId, 1)).payload_json.palette).toEqual(['#0F2747']);
});
```

- [ ] **Step 2: Implement + PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add versioned Brand Kit API

EOF
)"
```

---

### Task 9: Video draft + render stub + ledger (VID-01/04/08)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-videos.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-renders.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-ledger.service.ts`
- Create matching `*.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-render.worker.ts` (in-process stub: queued → completed, writes version `immutable=true`)
- Modify: `cp.controller.ts` — `Idempotency-Key` required on `POST /videos/:id/render` and ledger

**Interfaces:**
- `upsertDraft` autosave
- `submitRender({ draftId, idempotencyKey })` snapshots draft + kit version + asset versions + pricing `'stub-2026-09'`
- Duplicate key returns **same job id**, no second reserve
- `retryJob` creates **child** job, new key `parentKey + ':r' + attempt`
- Completed version `UPDATE` → 409 `immutable`
- If `CP_AI_ENABLED` unset: still create stub job (provider `stub`); do not call external HTTP

- [ ] **Step 1: Tests**

```ts
it('duplicate Idempotency-Key does not double reserve', async () => {
  const a = await renders.submit(draftId, 'k9');
  const b = await renders.submit(draftId, 'k9');
  expect(a.job_id).toBe(b.job_id);
  expect(await ledger.sum('reserve', projectId)).toBe(a.estimate);
});
it('completed version rejects patch', async () => {
  await expect(videos.patchVersion(id, { qc_status: 'passed' })).rejects.toMatchObject({
    status: 409,
  });
});
it('block reasons from render-block util abort submit', async () => {
  await expect(renders.submit(blockedDraft, 'k')).rejects.toMatchObject({
    response: { error: 'render_blocked' },
  });
});
```

- [ ] **Step 2: Implement + PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add video draft, stub render, and idempotent credit ledger

EOF
)"
```

---

### Task 10: Settings + credit grant (SET-01/04/05/07/08 store)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-settings.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-settings.service.spec.ts`
- Modify: `cp.controller.ts` — `GET/PATCH /settings`, `POST /credits/grant` (`crm_cp.finance`)

**Interfaces:**
- GET settings never returns provider secrets
- PATCH models allowlist only `{ id, max_res, max_duration_sec, cap_per_job, region, fallback_id }`
- Grant inserts ledger `kind=grant` + upsert allocation

- [ ] **Step 1: Test grant idempotent + settings omit secrets**

- [ ] **Step 2: Implement + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add module settings and credit grant

EOF
)"
```

---

### Task 11: CpShell, CSS, routes, placeholders

**Files:**
- Create: `services/ops-web/src/app/crm/creative-os/layout.tsx` — wrap children in `CpShell` + `import './cp.css'` (copy `account-management/layout.tsx` **without** `RevOpsEmbedFrame`)
- Create: `services/ops-web/src/app/crm/creative-os/cp.css`
- Create: `services/ops-web/src/lib/crm/cp-format.ts` + `cp-format.spec.ts`
- Create: `services/ops-web/src/lib/crm/cp-nav.util.ts` + `cp-nav.util.spec.ts` — `canSeeCpNav` like `canSeeAmNav` (`crm_cp.view` \| `view_all`)
- Create: `services/ops-web/src/lib/crm/cp-api.ts` — `cpFetch` copy `amFetch` in `lib/crm/am-api.ts` (`API_BASE`, `parseJson`, `ApiError`, `Authorization: Bearer`)
- Create: `services/ops-web/src/components/crm/cp/CpShell.tsx`
- Create pages (thin `page.tsx` → component; **do not** wrap `CpShell` again — layout already does):
  - `app/crm/creative-os/page.tsx`
  - `app/crm/creative-os/ops/page.tsx`
  - `app/crm/creative-os/activity/page.tsx`
  - `app/crm/creative-os/projects/page.tsx`
  - `app/crm/creative-os/projects/new/page.tsx`
  - `app/crm/creative-os/projects/[id]/page.tsx`
  - `app/crm/creative-os/video/page.tsx`
  - `app/crm/creative-os/video/ops/page.tsx`
  - `app/crm/creative-os/video/batch/page.tsx`
  - `app/crm/creative-os/video/templates/page.tsx`
  - `app/crm/creative-os/video/[id]/page.tsx`
  - `app/crm/creative-os/video/versions/[id]/page.tsx`
  - `app/crm/creative-os/media/page.tsx`
  - `app/crm/creative-os/media/[id]/page.tsx`
  - `app/crm/creative-os/brand-kits/page.tsx`
  - `app/crm/creative-os/brand-kits/[id]/page.tsx`
  - `app/crm/creative-os/calendar/page.tsx`
  - `app/crm/creative-os/reports/page.tsx`
  - `app/crm/creative-os/settings/page.tsx`

**Interfaces:**
- `CP_NAV` length **8**, labels match mockup
- `dash(v)` → `'—'` when `v == null`
- `CpShell` renders **one** `<main className="cp-main">`
- Product UI: **no** “Nhảy màn” catalog

- [ ] **Step 1: Vitest**

```ts
import { CP_NAV } from './cp-nav.util';
expect(CP_NAV).toHaveLength(8);
expect(CP_NAV.map((x) => x.id)).toEqual([
  'overview','projects','video','media','brand','calendar','reports','settings',
]);
expect(dash(null)).toBe('—');
expect(dash(0)).toBe('0');
```

- [ ] **Step 2: Shell markup** — copy token/spacing from `AmShell.tsx` + `am.css`; rename `am-` → `cp-`. Sidebar 8 links. Scope select `me|team|all`. Do not nest `<main>`.

Nav is **cap-only** like AM (`canSeeCpNav`). Do **not** add `NEXT_PUBLIC_CP_OS_SHELL` (that is the RevOps flag pattern). `/crm/layout.tsx` already applies `StaffRouteGuard zone="crm"`.

W2+ pages until their task: same shell + heading + `<p className="cp-muted">Chưa có dữ liệu</p>` + `—`. **Forbidden:** “sẽ mở Wave 2”.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add CpShell, 8-item nav, and creative-os routes

EOF
)"
```

---

### Task 12: Overview UI (OVR-01/02/04)

**Files:**
- Create: `services/ops-web/src/components/crm/cp/CpOverview.tsx`
- Modify: `app/crm/creative-os/page.tsx`
- Create: `components/crm/cp/CpOverview.spec.tsx` if the repo uses component tests; otherwise test `mapKpis` in `cp-format.spec.ts`

**Mockup:** `ovr-01`, `ovr-02`, `ovr-04` — 8 tiles, alert bar, trend (hide series if all null), project table, milestones, activity, Action Center drawer.

- [ ] **Step 1: Tile count test**

```ts
expect(KPI_TILES).toHaveLength(8);
expect(KPI_TILES[0].key).toBe('videos_created');
```

- [ ] **Step 2: Bind `cp-api.getOverviewKpis`**. Tile click → href from SRS §5.1. Filter writes URL `from,to,client,lifecycle,owner,scope`.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): render overview command center with 8 KPI tiles

EOF
)"
```

---

### Task 13: Project UI (PRJ-01…04)

**Files:**
- `CpProjectsList.tsx` `CpProjectForm.tsx` `CpProjectWorkspace.tsx` `CpProjectTimeline.tsx`
- Workspace tabs **exactly 8**: Tổng quan · Brief · Deliverables · Công việc · Media · Phê duyệt · Ngân sách · Hoạt động
- “Chia sẻ review” W1: disabled + copy `Cần version đã QC` **or** if no version, do not mint portal. W2 enables Hub POST.

Deep-links (plain `<a>`): `/crm/account-management/clients/${agency_client_id}`, `/crm/service-delivery/${lifecycle_id}?tab=content-os`, human_video → `/crm/video/${vd_project_id}`.

- [ ] **Step 1: Test tab list length 8**

- [ ] **Step 2: Implement forms matching mockup PRJ-02 fields** (`name*`, `agency_client_id*`, lifecycle, industry, objective, dates, owner, members, credit_budget, cost_center, tags)

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add project portfolio, create form, and 8-tab workspace

EOF
)"
```

---

### Task 14: Media UI (MED-01/03/05)

**Files:** `CpMediaLibrary.tsx` `CpIngest.tsx` `CpRightsCenter.tsx` `CpAssetDetail.tsx` (W1 fields)

Bind Task 7 APIs. Inspector on grid select. Rights table: warn/block pills from `rightsStatus`.

- [ ] **Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add DAM library, ingest, and rights center UI

EOF
)"
```

---

### Task 15: Brand Kit UI (BRK-01/02)

**Files:** `CpBrandPortfolio.tsx` `CpBrandEditor.tsx`

Editor sections: logo variants, palette, type, CTA, disclaimer (motion/audio fields stored in `payload_json` even if W1 preview is simple). Save = new version.

- [ ] **Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add Brand Kit portfolio and versioned editor

EOF
)"
```

---

### Task 16: Video Studio + Ops UI (VID-01/04/08)

**Files:** `CpVideoStudio.tsx` `CpRenderOps.tsx` `CpVersionDetail.tsx` `CpOpsMonitor.tsx` (queue table = same API as VID-04)

Studio 3-col like mockup: prompt/script/URL, preview, config (ratio, 15/30/60, style, locale, voice, model, kit, estimate). Submit calls render with `Idempotency-Key = crypto.randomUUID()`.

Ops: job table + trace stages list (static labels from SRS §7.4). Retry/cancel buttons.

- [ ] **Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add video studio and stub render operations UI

EOF
)"
```

---

### Task 17: Settings UI (SET-01…08 chrome)

**Files:** `CpSettings.tsx` — 8 tabs matching mockup.

- SET-03: **only** a button/link to existing Admin SSO route (find current Admin identity path in OpsNav; do not add SAML forms).
- SET-06: table of flags (Hub ON, Content OS ON, Campaign Write ON, webhook OFF, `CP_PUBLISH_NATIVE` from settings).
- Bind Task 10 PATCH.

- [ ] **Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(cp): add module settings tabs mapped to platform SSO

EOF
)"
```

---

### Task 18: Wave 1 UAT

**Files:**
- Create: `services/ops-web/e2e/helpers/cp-w1-helpers.ts`
- Create: `services/ops-web/e2e/cp-w1-uat.spec.ts`
- Create: `docs/evidence/cp-w1-signoff.json` after green (same shape as `docs/evidence/am-w4-signoff.json` if present)

**Cases:**
1. No `crm_cp.view` → `/crm/creative-os` 403 / redirect (same as AM).
2. `GET /api/crm/cp/overview/kpis` → 8 keys, values `number | null`, `last_updated` ISO.
3. `POST /projects` without client → 400; unknown UUID → `client_not_found`.
4. `POST /assets` MIME `application/x-msdownload` → 400 `mime_not_allowed`.
5. Two `POST /videos/:id/render` same `Idempotency-Key` → one ledger reserve.
6. UI: count `h1` + `main` = 1 main; 8 nav buttons; KPI tiles = 8; no text `3.840` in empty tenant.

```bash
cd services/ops-web && npx playwright test e2e/cp-w1-uat.spec.ts
```

- [ ] **Do not start Wave 2 until this file is green.**
- [ ] **Commit** tests + signoff

```bash
git commit -m "$(cat <<'EOF'
test(cp): add Wave 1 UAT for Creative Production OS

EOF
)"
```

---

# Wave 2 — Governed production

**UAT gate:** QC Blocked cannot export; Hub submit creates creative; calendar rejects non-final; Brand rule block render; draft edit invalidates approval.

### Task 19: Wave 2 DDL

**Files:** `docs/specs/2026-09-07-postgresql-ddl-cp-w2.sql` · `scripts/apply_pg_ddl_cp_w2.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_cp_brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_version_id UUID NOT NULL REFERENCES crm_cp_brand_kit_versions(id),
  condition_json JSONB NOT NULL,
  action_json JSONB NOT NULL,
  enforcement TEXT NOT NULL,
  CONSTRAINT crm_cp_rule_enf_chk CHECK (enforcement IN ('block_render','block_publish','warning'))
);

CREATE TABLE IF NOT EXISTS crm_cp_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  step TEXT NOT NULL,
  actor_id INTEGER,
  decision TEXT,
  reason TEXT,
  at TIMESTAMPTZ,
  CONSTRAINT crm_cp_appr_step_chk CHECK (
    step IN ('internal_review','client_review','brand','legal','final')
  )
);

CREATE TABLE IF NOT EXISTS crm_cp_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  timecode_ms INTEGER,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  mention_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_channel_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL UNIQUE,
  rules_json JSONB NOT NULL
);
INSERT INTO crm_cp_channel_profiles (channel, rules_json) VALUES
  ('tiktok', '{"ratio":["9:16"],"duration_sec":[15,60],"caption_max":2200}'),
  ('reels', '{"ratio":["9:16","1:1"],"duration_sec":[15,90],"caption_max":2200}')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_cp_publish_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_version_id UUID NOT NULL REFERENCES crm_cp_video_versions(id),
  channel TEXT NOT NULL,
  profile_id UUID REFERENCES crm_cp_channel_profiles(id),
  scheduled_at TIMESTAMPTZ,
  tz TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  copy TEXT,
  hashtags TEXT,
  thumbnail_asset_id UUID,
  cta TEXT,
  utm_json JSONB,
  audience TEXT,
  compliance_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  post_ref TEXT,
  last_error TEXT,
  CONSTRAINT crm_cp_pub_status_chk CHECK (
    status IN ('draft','scheduled','publishing','published','failed','cancelled')
  )
);
```

- [ ] Apply + commit

---

### Task 20: QC, comments, approval, compare (VID-05 / VID-08)

**Files:** `cp-qc.service.ts` · `cp-comments.service.ts` · `cp-approvals.service.ts` · specs · `CpVideoReview.tsx`

QC checks **exactly** (SRS §7.5): technical · safe_area · caption_overflow · logo · cta · disclaimer · missing_audio · loudness · black_frozen · moderation.  
Result: `passed | warning | blocked`. `blocked` ⇒ `export_final` and publish return 409 `qc_blocked`.

Approval states: `internal_review | client_review | changes_requested | brand_approved | legal_approved | final_approved | rejected`.

`compareVersions(a,b)` returns diffs: metadata, script, kit id, asset ids, cost.

Patch draft after approve → insert activity `approval_invalidated` and reset `approval_status` to `internal_review`.

- [ ] Tests for QC blocked + invalidate + commit

---

### Task 21: Hub submit (PRJ-05)

**Files:** modify `cp-projects.service.ts` `submitCreative(projectId, versionId)`  
Call the **existing** Creative Hub create/submit function (search `CreativesService` / `creativesRepo` in `ptt-crm-api`). Do not add `/creatives` portal routes.

- [ ] Test: missing version → 400; success returns `{ creative_id }`  
- [ ] Workspace button enables when `qc_status !== 'blocked'`  
- [ ] Commit

```bash
git commit -m "$(cat <<'EOF'
feat(cp): submit Final/QC-passed versions to Creative Hub

EOF
)"
```

---

### Task 22: Storyboard + Timeline (VID-02/03)

**Files:** scene CRUD on `crm_cp_scenes` · `PATCH /videos/:id/timeline` increments `revision` · regenerate skips `locked=true` · `CpStoryboard.tsx` `CpTimeline.tsx`

Tracks W1/W2 MVP: Scene · VO · Music · Caption. Undo stack **client-side 20** (no server undo log).

- [ ] Test: regenerate does not change locked overlay  
- [ ] Commit

---

### Task 23: Calendar CAL-01…03

**Files:** `cp-publish.service.ts` + spec · `CpCalendar.tsx` `CpPublishComposer.tsx` `CpPublishGate.tsx`

`assertSchedulable(version)` fails if not `final_approved` OR `qc_status='blocked'` OR any used asset rights `block` OR missing mandatory disclaimer (from kit rule).

Channel profile validate ratio/duration/caption length.

- [ ] Tests: reject client_review version; accept final + qc passed  
- [ ] Commit

---

### Task 24: Brand rules + Preview + History (BRK-03…05)

**Files:** extend `cp-brand.service.ts` · `CpBrandRules.tsx` `CpBrandPreview.tsx` `CpBrandHistory.tsx`

`evaluateRules(kitVersionId, ctx)` returns `{ enforcement, actions }`. Feed into `renderBlockReasons`.

Preview endpoint returns 4 ratios + warning labels (contrast heuristic W2: relative luminance; clipping = overflow flag on overlay length > 42).

Restore vN → insert vN+1 copy of payload (never mutate vN).

- [ ] Test restore increments n  
- [ ] Commit

---

### Task 25: Asset versioning (MED-02)

Replace file = insert `crm_cp_asset_versions` n+1. Completed `VideoVersion` usage stays on old `asset_version_id`.

- [ ] Test usage graph lists draft + version + project  
- [ ] Commit

---

### Task 26: Content OS hook (SRS Q27)

**Files:** find Content OS generate-image/video entry (Content Marketing OS). Add server call to `CpVideosService.upsertDraft` + redirect/deep-link `/crm/creative-os/video/:id`. **One** orchestrator: Content Board CTA only.

- [ ] Do not duplicate render queue in Content OS  
- [ ] Commit

---

### Task 27: Wave 2 UAT

**Files:** `e2e/cp-w2-uat.spec.ts`

Cases: QC blocked 409 export; Hub submit 201; schedule non-final 409; locked scene unchanged; rights expiry blocks publish; 1 `<main>`.

- [ ] Green before Wave 3

---

# Wave 3 — Scale

**UAT gate:** batch partial retry + error CSV; no double charge per row; reports show `—` + source when no ingest; collections permission-aware.

### Task 28: Wave 3 DDL

**Files:** `docs/specs/2026-09-07-postgresql-ddl-cp-w3.sql` · `scripts/apply_pg_ddl_cp_w3.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_cp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  variables_json JSONB NOT NULL DEFAULT '[]',
  rules_json JSONB NOT NULL DEFAULT '{}',
  brand_kit_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  CONSTRAINT crm_cp_tpl_status_chk CHECK (status IN ('draft','published','archived'))
);

CREATE TABLE IF NOT EXISTS crm_cp_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES crm_cp_templates(id),
  project_id UUID REFERENCES crm_cp_projects(id),
  estimate_credits INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES crm_cp_batch_jobs(id) ON DELETE CASCADE,
  row_no INTEGER NOT NULL,
  row_json JSONB NOT NULL,
  mapping_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  job_id UUID,
  UNIQUE (batch_id, row_no)
);

CREATE TABLE IF NOT EXISTS crm_cp_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  name TEXT NOT NULL,
  smart_filter_json JSONB,
  created_by INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_cp_collection_items (
  collection_id UUID NOT NULL REFERENCES crm_cp_collections(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES crm_cp_assets(id),
  PRIMARY KEY (collection_id, asset_id)
);
```

- [ ] Apply + commit

---

### Task 29: Templates + Batch (VID-06/07)

**Files:** `cp-templates.service.ts` `cp-batches.service.ts` · `CpTemplates.tsx` `CpBatchFactory.tsx`

Stepper 4 steps like mockup. Variables include `{{project_name}} {{price_from}} {{location}} {{cta}} {{hotline}}`.

Validate row: missing mapped required → `invalid`. Estimate = valid_count × unit. Run: one render job per valid row; `idempotency_key = batchId + ':' + row_no`. Retry one row does not re-charge success rows. `GET /batches/:id/errors.csv`.

CRM source W3: allowlist columns from `clients` + `service_lifecycle` only (P8). No arbitrary SQL.

- [ ] Tests: 2 invalid / 46 valid sample logic; duplicate row key no double charge  
- [ ] Commit

---

### Task 30: Collections + Quality (MED-04/06)

**Files:** `cp-collections.service.ts` · `CpCollections.tsx` `CpQuality.tsx`

Smart collection: evaluate `smart_filter_json` with **same scope SQL** as assets (never leak other book).

Quality: missing metadata count; duplicate by `hash`; optional phash W3 skip if no lib — hash-only. No auto-delete.

- [ ] Test smart filter respects scope  
- [ ] Commit

---

### Task 31: CAL-04/05 + native flag

**Files:** extend `cp-publish.service.ts` · `CpDistribution.tsx` `CpBulkSchedule.tsx`

W3 delivery: status `published` + `post_ref` when Campaign Write handoff succeeds; `failed` + `last_error` otherwise. Retry creates audit.

Bulk: `n_per_day` + windows + weekdays; skip invalid versions; N items + N audit rows.

If `settings.publish_native` / `CP_PUBLISH_NATIVE` false, UI shows file-export path only (no fake TikTok success).

- [ ] Commit

---

### Task 32: Reports RPT-01…05

**Files:** `cp-reports.service.ts` `cp-forecast.util.ts` · `CpReports.tsx`

`GET /reports/:slug` slugs: `executive | production | credit | performance | governance`.

Performance metrics **must** include `{ value, source, freshness }`. Missing ingest → `value: null` (UI `—` + “Thiếu nguồn”). **Never** invent CTR.

`POST /reports/export` requires cap + writes `crm_cp_activity` action `report_export`.

Forecast: `scheduled_batch_credits + historical_avg + reserved`; response includes `assumption` string.

- [ ] Tests: empty performance is null+source; export audited  
- [ ] Commit

---

### Task 33: Production monitor scale (OVR-03)

**Files:** extend `cp-overview.service.ts` `getHealth` · `CpOpsMonitor.tsx` · optional `cp-render.worker.ts` queue depth / provider p95 from last 60 minutes of `crm_cp_render_jobs`.

SSE `GET /renders/:id/events` — poll fallback 5–10s already in UI.

- [ ] Commit

---

### Task 34: Wave 3 UAT

**Files:** `e2e/cp-w3-uat.spec.ts`

Cases: batch error CSV; retry row; report `—`; smart collection no IDOR; bulk skip invalid; 5 report tabs render.

- [ ] Green before Wave 4

---

# Wave 4 — Factory polish

**UAT gate:** forecast assumption visible; A/B variant does not mutate completed versions; model fallback creates child job; locale pack does not change snapshot language of completed output.

### Task 35: Wave 4 DDL + features

**Files:** `docs/specs/2026-09-07-postgresql-ddl-cp-w4.sql` · `scripts/apply_pg_ddl_cp_w4.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_cp_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  name TEXT NOT NULL,
  variants_json JSONB NOT NULL
);

ALTER TABLE crm_cp_settings
  ADD COLUMN IF NOT EXISTS routing_json JSONB NOT NULL DEFAULT '{}';
```

Implement:
- A/B: extra versions linked to experiment; completed versions stay immutable
- Model routing: `fallback_id` on failed job → child job (already Task 9 pattern)
- Localization: `config_json.language` on **new** draft only
- Forecast UI on RPT-03 already from Task 32 — add assumption banner if missing

- [ ] Tests + commit

---

### Task 36: Wave 4 UAT + signoff

**Files:** `e2e/cp-w4-uat.spec.ts` · `docs/evidence/cp-w4-signoff.json`

Platform acceptance from SRS §17 — all 12 bullets as automated or documented manual checks.

Do **not** enable `CP_AI_ENABLED` in this task. Separate ops change after PO signoff.

- [ ] Commit signoff

---

## Workers / ops (fold into waves)

| Unit | Wave | Pattern |
|---|---|---|
| `cp-render.worker` | 1 stub / 3 scale | one systemd unit; copy AM worker timer style (`am-health.worker.ts`) |
| `cp-rights.worker` | 2 | daily ICT: insert Action Center rows for expiry ≤14d |
| DLQ | 3 | jobs `expired` after N attempts |

Scripts applying timers **must not** GRANT RBAC.

---

## Self-review (plan vs SRS)

| SRS area | Tasks |
|---|---|
| Q1–Q19 locked decisions | Constraints + Tasks 2, 11, 17, 21 |
| OVR 8 KPI + 4 screens | 5, 12, 33 |
| PRJ 8 tabs + create fields + close | 6, 13, 21 |
| VID-001…010 Studio / snapshot / block | 3, 9, 16 |
| VID-011…016 Storyboard / timeline | 22 |
| VID-017…022 Render ops / child / SSE | 9, 16, 33 |
| VID-023…028 Review / QC 9 / matrix / compare | 20 |
| VID-029…033 Batch / template | 29 |
| MED-001…006 + collections/quality | 7, 14, 25, 30 |
| BRK-001…007 | 8, 15, 24 |
| CAL-001…007 + bulk | 23, 31 |
| RPT-001…006 | 32 |
| SET-001…010 map | 10, 17 |
| Approval / notify / credit engines | 9, 10, 20, 5 (actions) |
| API table §15 | Tasks 5–10, 20–23, 29–33 |
| Events §15.1 | `cp-audit.repository` + workers 2/3 |
| Security / NFR / render arch §16 | 3, 7, 9, 33 |
| Acceptance §17 (12 bullets) | 18, 27, 34, 36 |
| Wave table SRS §18 | W1=1–18 · W2=19–27 · W3=28–34 · W4=35–36 |
| Mockup 45 screens | Screen → Task matrix above — no orphan |

**Placeholder scan:** no TBD / “implement later” / “similar to Task N”. Wave 2+ still names files, SQL, and tests.

**Type consistency:** `CpScope`, `emptyKpis` 8 keys, `Idempotency-Key`, `client_not_found`, `render_blocked`, `qc_blocked`, `pending_deliverables`, `mime_not_allowed`, `immutable` 409.

---

## Execution

Plan saved. Two options:

1. **Subagent-Driven (recommended)** — one fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, `executing-plans`, batch with checkpoints  

Which approach?
