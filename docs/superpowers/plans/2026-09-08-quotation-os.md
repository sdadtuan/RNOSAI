# Quotation OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Quotation OS on RNOSAI — expand `/crm/proposals*` + `/api/crm/proposals` + portal `/proposals/[token]` — matching SRS v2.0 and the 35-screen HTML mockup, wave by wave, without a second quote app.

**Architecture:** Keep Nest `ProposalsModule` and integer `crm_proposals.id`. Add versioned commercial tables (`crm_quote_*`), staff JWT via `resolveCrmStaffUserId`, and a dedicated `QtShell` in ops-web (never KPI Hub, never nested `<main>`). Customer SoR is AM 360 table `clients` (`agency_client_id` UUID) plus legacy `customer_id`. Deal SoR is `crm_leads` + Deal Room. After accept, convert writes `service_lifecycle` + invoice draft — never a second campaign table.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js `ops-web` + `portal-web` · PostgreSQL · staff JWT + `staff_section_permissions` · Jest (API) · Vitest (ops-web) · Playwright e2e · no new npm packages · AI **off** until `QT_AI_ENABLED=1` after W1 UAT green.

**SoT:**
- SRS: [2026-09-08-quotation-os-srs.md](../specs/2026-09-08-quotation-os-srs.md) **v2.0**
- Mockup master: [rnosai-quote-os-srs-mockup.html](../../design/rnosai-quote-os-srs-mockup.html) — 35 screen IDs
- Module mockups: `docs/design/rnosai-quote-os-*-mockup.html`

## Global Constraints

- API prefix **`/api/crm/proposals`**. Same staff JWT as CRM. Tenant **`PTT` only**. Public accept: **`/api/public/proposals/:token`** (no staff guard; rate limit).
- Caps: `crm_quote` `view` / `view_all` / `edit` / `manage` plus `crm_quote.approve` · `crm_quote.finance` · `crm_quote.legal` · `crm_quote.publish` · `crm_quote.convert` · `crm_quote.catalog` · `crm_quote.audit`.
- Quote SoR = table **`crm_proposals`** (keep `id SERIAL`). Never CREATE a parallel `quotes` root.
- Customer SoR = table **`clients`** (`id UUID`) as `agency_client_id`. SRS “crm_clients” = AM 360 product name. Keep `customer_id INTEGER` for Deal Room / lifecycle. Never INSERT a client from the quote form. Never a UUID paste field.
- Deal SoR = **`crm_leads`** + Deal Room / Consult. Deep-link `?lead_id=&customer_id=&wizard=1` must still open NEW-01 / Builder.
- Catalog SoR = `crm_catalog_services` + `ops_service_profile` (`dv_code`). Dual packaging: `package_tier` on line **and** option A/B/C on version.
- After accept: N `service_lifecycle` + 1 payment schedule + invoice draft. Convert idempotent `(version_id, target_type)`.
- Client view = **portal-web** + share token. CTA copy **“Xác nhận đề xuất”**. Never “ký hợp đồng”. Never mint a second client portal.
- Human / brand video SoR = `/crm/video` + CP OS. QT never hosts a video editor.
- Empty / missing → `null` in API and `—` in UI. Never fake `0` for unknown money. Never hard-code mockup numbers `265.647.600` / `22,4` / `8,46`.
- CSS `qt-*`. Tokens: Navy `#0F2747` · Accent `#2563EB` · Success `#16A34A` · Warning `#D97706` · Danger `#DC2626` · Info `#0891B2` · bg `#F4F6F8` · radius 10–12 · Be Vietnam Pro. Do not copy Nova purple / logo / workspace switcher.
- Product sidebar: **exactly 7 items** — Tổng quan · Báo giá · Tạo báo giá · Service Catalog · Phê duyệt · Báo cáo · Cấu hình. Studio is **not** item 8. No demo “Nhảy màn / Toàn catalog” bar in product UI.
- Overview has **exactly 4 KPI tiles** (SRS §5.1). Win-rate formula **on the tile**.
- Staff id = INTEGER from `resolveCrmStaffUserId(jwt.sub)`. JWT has **no** `staffId`. Timezone `Asia/Ho_Chi_Minh`.
- Money = **BIGINT VND** (đồng, already rounded) — same as `crm_proposals.total_vnd` today. Never float.
- Margin: NSR = fee-only; exclude media/pass-through no-markup. Floor default **25%**. VAT default **8%**, snapshot at publish.
- Quote code = `QT-PTT-{YYYY}-{SEQ:6}` unique per tenant. Never reuse.
- Legal entity W1 = **PTT HCM** only. Currency **VND** only.
- `QT_AI_ENABLED` unset on prod until W1 UAT is green. `POST /proposals/:id/generate` stays behind the flag.
- Scripts **never** GRANT `staff_section_permissions` to users. Catalog only.
- Do not start Wave *n* until Wave *n−1* UAT is green.
- Later-wave screens ship in W1 as **real chrome + empty/`—`**, never copy “mở ở Wave”.
- One `<main>` per page. Class prefix `qt-*` only.
- Soft-delete / archive only. Never `DELETE FROM crm_proposals` in product paths (legacy `remove()` becomes archive).
- Guards: `@UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)` — never bare `StaffAuthGuard`. W1 may keep `StaffProposalsViewGuard` only as alias that checks `crm_quote` **or** legacy `crm_board` until Admin grants `crm_quote`.

---

## File map

### Backend (`services/ptt-crm-api/src/proposals/`)

| File | Responsibility | Wave |
|------|----------------|------|
| `quote.types.ts` | Status unions, KPI keys, DTO, option/SKU enums | 1 |
| `quote-format.util.ts` | `null` → never fake `0`; dash helpers | 1 |
| `quote-scope.util.ts` | `me` / `team` / `all` SQL | 1 |
| `quote-money.util.ts` | BIGINT math: fee/media/VAT/NSR/GM; payment 100% | 1 |
| `quote-code.util.ts` | `QT-PTT-{YYYY}-{SEQ:6}` | 1 |
| `quote-status.util.ts` | 14-status transitions + legacy 4-status map | 1 |
| `quote-policy.util.ts` | Guardrail evaluation (floor, discount, value, term) | 2 |
| `quote-kpi-class.util.ts` | committed / optimization / forecast / assumption | 2 |
| `quote-public-strip.util.ts` | Strip cost/margin/approval/hidden option | 2 |
| `guards/staff-quote.guard.ts` | `RequireQuoteAction` / `RequireQuoteSection` | 1 |
| `quote-audit.repository.ts` | Insert `crm_quote_activity` | 1 |
| `quote-settings.repository.ts` | Tenant defaults | 1 |
| `quote-versions.repository.ts` | Working / published snapshots | 1 |
| `quote-overview.service.ts` | 4 KPI + Action Center + activity | 1 |
| `quote-list.service.ts` | Scoped list + filters | 1 |
| `quote-create.service.ts` | NEW-01 from lead / AM 360 / blank | 1 |
| `quote-builder.service.ts` | Header, lines, SKU, recalc | 1 |
| `quote-catalog.service.ts` | Active/Draft add rules | 1 |
| `quote-convert.service.ts` | Idempotent lifecycle + schedule | 1 |
| `quote-export.service.ts` | PDF (existing `quotePdfBuffer` + VAT/fee split) | 1 |
| `quote-options.service.ts` | A/B/C | 2 |
| `quote-approval.service.ts` | Policy steps + SLA | 2 |
| `quote-studio.service.ts` | 9 sections + publish gate | 2 |
| `quote-share.service.ts` | Token, OTP, revoke | 2 |
| `quote-reports.service.ts` | 5 slugs + export audit | 3 |
| `quote-expiry.worker.ts` | `valid_until` → `expired` | 1 |
| `proposals.controller.ts` | Legacy + static QT routes **before** `:id` | 1+ |
| `quote-public.controller.ts` | `/api/public/proposals/:token` | 1 min / 2 OTP |
| `proposals.module.ts` | Register providers | 1 |
| `proposals.service.ts` | Keep Deal Room create/lines; delegate QT to new services | 1 |
| `proposals-pg.repository.ts` | Stop hard-DELETE; archive; stop expanding bootstrap DDL | 1 |
| `quote-pricing.util.ts` | Keep 3-tier normalize; stop default fake 10/20/35tr in product path | 1 |

### Frontend ops-web (`services/ops-web/src/`)

| File | Responsibility | Wave |
|------|----------------|------|
| `lib/crm/qt-api.ts` | `qtFetch` → `/api/crm/proposals/*` | 1 |
| `lib/crm/qt-nav.util.ts` | 7-item nav + `canSeeQtNav` | 1 |
| `lib/crm/qt-format.ts` | `dash(null)` → `—` | 1 |
| `app/crm/proposals/layout.tsx` | `QtShell` + `./qt.css` | 1 |
| `app/crm/proposals/qt.css` | Tokens | 1 |
| `app/crm/proposals/page.tsx` | OVR-01 (redirect `?id=` → builder) | 1 |
| `app/crm/proposals/list/page.tsx` | LST-01 | 1 |
| `app/crm/proposals/new/page.tsx` | NEW-01 | 1 |
| `app/crm/proposals/[id]/page.tsx` | Builder | 1 |
| `app/crm/proposals/[id]/studio/page.tsx` | PRS-01 | 2 (W1 chrome) |
| `app/crm/proposals/[id]/convert/page.tsx` | CVT-01 | 1 |
| `app/crm/proposals/catalog/page.tsx` | CAT-01…05 | 1 chrome / 2 drawer |
| `app/crm/proposals/approvals/page.tsx` | APR-01…02 | 1 chrome / 2 data |
| `app/crm/proposals/reports/page.tsx` | RPT-01…05 | 1 chrome / 3 data |
| `app/crm/proposals/settings/page.tsx` | SET-01…06 | 1 |
| `app/crm/proposals/activity/page.tsx` | OVR-03 | 1 |
| `components/crm/qt/QtShell.tsx` | Topbar + 7-item sidebar + scope | 1 |
| `components/crm/qt/QtOverview.tsx` | OVR-01/02 | 1 |
| `components/crm/qt/QtActivity.tsx` | OVR-03 | 1 |
| `components/crm/qt/QtQuoteList.tsx` | LST-01 | 1 |
| `components/crm/qt/QtCreateForm.tsx` | NEW-01 — named selects only | 1 |
| `components/crm/qt/QtBuilder.tsx` | BLD-01…07 chrome; W1 tabs that work | 1 |
| `components/crm/qt/QtStickyCommercial.tsx` | Fee/media/VAT/GM/payment | 1 |
| `components/crm/qt/QtCatalog.tsx` | CAT-01…04 | 1–2 |
| `components/crm/qt/QtApprovals.tsx` | APR | 2 |
| `components/crm/qt/QtStudio.tsx` | PRS-01 | 2 |
| `components/crm/qt/QtConvert.tsx` | CVT-01 | 1 |
| `components/crm/qt/QtReports.tsx` | RPT | 3 |
| `components/crm/qt/QtSettings.tsx` | SET | 1 |
| `lib/quote-api.ts` | Keep Deal Room helpers; point status/lines at new DTOs | 1 |
| `app/crm/proposals/ProposalsContent.tsx` | Delete after QtShell ships (or re-export list) | 1 |

### Portal (`services/portal-web/src/`)

| File | Responsibility | Wave |
|------|----------------|------|
| `app/proposals/[token]/page.tsx` | PUB-01…03 | 1 min / 2 OTP |
| `components/proposal/PublicProposal.tsx` | Client renderer = same fields as Studio | 2 |
| `lib/public-proposal-api.ts` | Public GET/POST | 1 |

### Shared / ops

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-09-08-postgresql-ddl-qt.sql` | Wave 1 ALTER + tables |
| `docs/specs/2026-09-08-postgresql-ddl-qt-w2.sql` | Wave 2 tables |
| `docs/specs/2026-09-08-postgresql-ddl-qt-w3.sql` | Wave 3 tables |
| `scripts/apply_pg_ddl_qt.sh` | Apply W1 |
| `scripts/apply_pg_ddl_qt_w2.sh` / `_w3.sh` | Later DDL |
| `scripts/seed_qt_rbac.sh` | Grant **catalog only** (no prod users) |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Caps |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/proposals` **before** `/crm` |
| `services/ops-web/src/lib/auth.spec.ts` | Route 403 tests |
| `services/ops-web/src/components/OpsNav.tsx` | Label **Báo giá** (href stays `/crm/proposals`) |
| `services/ops-web/e2e/qt-w1-uat.spec.ts` | W1 UAT |
| `services/ops-web/e2e/helpers/qt-w1-helpers.ts` | API helpers |

---

## Locked IDs (do not invent)

```text
crm_proposals.id                   INTEGER       ← quote root
clients.id                         UUID          ← agency_client_id (AM 360)
crm_customers.id                   INTEGER       ← customer_id legacy
crm_leads.id                       INTEGER       ← lead_id
service_lifecycle.id               existing PK   ← convert target
crm_staff                          INTEGER       ← owner_staff_id via resolveCrmStaffUserId
crm_catalog_services / ops_service_profile
                                   dv_code + slug
crm_vd.projects                    Video SOP     ← vd_project_id after convert (W3)
crm_cp_projects                    CP OS         ← optional after convert (W3)
invoices / orders                  existing      ← payment schedule
```

Quote status (14): `draft | in_review | pending_approval | returned | approved | sent | viewed | negotiation | accepted | rejected | expired | cancelled | superseded | archived`.

Version state: `working | submitted | approved | published | accepted | superseded`.

KPI keys (exactly 4): `open_quote_value` · `pending_approval_count` · `quote_win_rate` · `forecast_gross_margin`.

Win rate formula (dashboard): `accepted / (accepted + rejected)` in range. Reports also expose `sent_to_accepted` separately — never mix labels.

SKU: persist `package_tier` as `basic | standard | premium` (existing). UI: Cơ bản / Tiêu chuẩn / Chuyên sâu. Accept legacy `CoBan|TieuChuan|ChuyenSau`.

Option keys: `A | B | C` (W2). Max one `recommended=true` per version.

Quote code regex: `^QT-PTT-[0-9]{4}-[0-9]{6}$`.

---

## Screen → Task (mọi màn mockup phải có task)

| Screen | Mockup ID | First ship | Task |
|---|---|---|---|
| OVR-01 Dashboard | `ovr-01` | W1 | 6, 12 |
| OVR-02 Action Center | `ovr-02` | W1 | 6, 12 |
| OVR-03 Activity | `ovr-03` | W1 | 6, 12 |
| LST-01 List | `lst-01` | W1 | 7, 13 |
| NEW-01 Create | `new-01` | W1 | 7, 13 |
| BLD-01 Context | `bld-01` | W1 | 8, 14 |
| BLD-02 Options A/B/C | `bld-02` | W1 chrome / W2 data | 8, 14, 21, 27 |
| BLD-03 Services + SKU + funnel | `bld-03` | W1 SKU / W2 funnel | 8, 14, 27 |
| BLD-04 KPI 3-class | `bld-04` | W1 chrome / W2 | 14, 27 |
| BLD-05 Cost & margin | `bld-05` | W1 finance | 8, 14 |
| BLD-06 Terms + payment | `bld-06` | W1 payment 100% | 8, 14 |
| BLD-07 History | `bld-07` | W1 versions / W2 diff | 8, 23, 27 |
| CAT-01 Grid | `cat-01` | W1 | 9, 15 |
| CAT-02 Drawer 6 tab | `cat-02` | W1 chrome / W2 | 15, 25 |
| CAT-03 Package ngành | `cat-03` | W2 | 25 |
| CAT-04 Rate card | `cat-04` | W2 | 25 |
| CAT-05 / VID-TPL-01 | `cat-05` | W1 link / W3 spawn | 15, 33 |
| APR-01 Inbox | `apr-01` | W1 chrome / W2 | 16, 22, 28 |
| APR-02 Detail | `apr-02` | W2 | 22, 28 |
| PRS-01 Studio | `prs-01` | W1 chrome / W2 | 16, 24, 29 |
| PUB-01 Client page | `pub-01` | W1 min / W2 | 18, 29 |
| PUB-02 Accept OTP | `pub-02` | W1 checkbox / W2 OTP | 18, 26, 29 |
| PUB-03 Expired | `pub-03` | W1 | 18, 26 |
| CVT-01 Convert | `cvt-01` | W1 | 10, 17 |
| RPT-01 Executive | `rpt-01` | W1 chrome / W3 | 16, 32 |
| RPT-02 Funnel | `rpt-02` | W3 | 32 |
| RPT-03 Margin | `rpt-03` | W3 | 32 |
| RPT-04 Loss | `rpt-04` | W3 | 32 |
| RPT-05 Engagement | `rpt-05` | W3 | 32 |
| SET-01 Defaults | `set-01` | W1 | 5, 16 |
| SET-02 Guardrail | `set-02` | W1 store / W2 enforce | 5, 16, 22 |
| SET-03 Rate admin | `set-03` | W1 link CAT-04 | 16, 25 |
| SET-04 Share / OTP | `set-04` | W1 flags / W2 | 5, 26 |
| SET-05 Approver | `set-05` | W2 | 22, 28 |
| SET-06 Clause template | `set-06` | W2 | 24 |

---

## Slice order

```text
W1  DDL/caps → utils/guard → overview/list/create/builder/catalog → convert + portal min + settings → UAT
W2  Options A/B/C + policy + Studio 9 + token/OTP + catalog drawer → UAT
W3  Reports 5 + engagement/lost + brand-video spawn + import + SLA/delegate → UAT / signoff
```

Không bật `QT_AI_ENABLED` trên prod trước UAT W1 xanh.

---

# Wave 1 — Shell, 4 KPI, list/create, builder SKU, catalog grid, convert, portal min

**UAT gate:** 403 không cap; 4 KPI (`—` hoặc số thật, công thức win rate trên thẻ); tạo từ lead bắt buộc khách AM 360 (select tên); Draft catalog không add; payment 50/30/20 = 100%; GM dưới floor không publish; convert 2 lần không nhân lifecycle; 1 `<main>`; không số 265647600 / 8.46e9 hard-code; Deal Room `?lead_id=&wizard=1` vẫn mở NEW-01.

### Task 1: Wave 1 DDL

**Files:**
- Create: `docs/specs/2026-09-08-postgresql-ddl-qt.sql`
- Create: `scripts/apply_pg_ddl_qt.sh`
- Test: `psql` `\d crm_proposals` + `\dt crm_quote_*`

**Interfaces:**
- Consumes: SRS §10 / §17
- Produces: columns and tables in Step 1

- [ ] **Step 1: Write DDL**

```sql
CREATE SEQUENCE IF NOT EXISTS crm_quote_code_seq;

CREATE TABLE IF NOT EXISTS crm_quote_settings (
  tenant_id TEXT PRIMARY KEY DEFAULT 'PTT',
  quote_code_pattern TEXT NOT NULL DEFAULT 'QT-PTT-{YYYY}-{SEQ:6}',
  validity_days INTEGER NOT NULL DEFAULT 30,
  vat_bps INTEGER NOT NULL DEFAULT 800,
  currency_code TEXT NOT NULL DEFAULT 'VND',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  issuing_entity TEXT NOT NULL DEFAULT 'PTT-HCM',
  payment_template TEXT NOT NULL DEFAULT '50/30/20',
  gm_floor_bps INTEGER NOT NULL DEFAULT 2500,
  discount_auto_bps INTEGER NOT NULL DEFAULT 500,
  director_value_vnd BIGINT NOT NULL DEFAULT 200000000,
  payment_term_max_days INTEGER NOT NULL DEFAULT 60,
  share_expiry_days INTEGER NOT NULL DEFAULT 14,
  pdf_download BOOLEAN NOT NULL DEFAULT TRUE,
  otp_required BOOLEAN NOT NULL DEFAULT TRUE,
  view_tracking BOOLEAN NOT NULL DEFAULT TRUE,
  ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  policy_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_staff_id INTEGER
);
INSERT INTO crm_quote_settings (tenant_id) VALUES ('PTT') ON CONFLICT DO NOTHING;

ALTER TABLE crm_proposals
  ADD COLUMN IF NOT EXISTS quote_code TEXT,
  ADD COLUMN IF NOT EXISTS agency_client_id UUID,
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS quote_type TEXT NOT NULL DEFAULT 'new_business',
  ADD COLUMN IF NOT EXISTS issuing_entity TEXT NOT NULL DEFAULT 'PTT-HCM',
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS audience TEXT,
  ADD COLUMN IF NOT EXISTS campaign_period TEXT,
  ADD COLUMN IF NOT EXISTS owner_staff_id INTEGER,
  ADD COLUMN IF NOT EXISTS co_owner_staff_ids JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS confidentiality_level TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS crm_proposals_quote_code_uq
  ON crm_proposals (quote_code) WHERE quote_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_proposals_agency_client_idx
  ON crm_proposals (agency_client_id);
CREATE INDEX IF NOT EXISTS crm_proposals_owner_idx
  ON crm_proposals (owner_staff_id);

DO $$ BEGIN
  ALTER TABLE crm_proposals
    ADD CONSTRAINT crm_proposals_agency_client_fk
    FOREIGN KEY (agency_client_id) REFERENCES clients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE crm_quote_line_item
  ADD COLUMN IF NOT EXISTS option_key TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'fee',
  ADD COLUMN IF NOT EXISTS qty NUMERIC(12,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_amount_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_labor_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS cost_outsource_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS cost_other_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS catalog_snapshot_json JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS crm_quote_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id),
  n INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'working',
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  fee_vnd BIGINT NOT NULL DEFAULT 0,
  media_vnd BIGINT NOT NULL DEFAULT 0,
  discount_vnd BIGINT NOT NULL DEFAULT 0,
  tax_vnd BIGINT NOT NULL DEFAULT 0,
  payable_vnd BIGINT NOT NULL DEFAULT 0,
  nsr_vnd BIGINT,
  direct_cost_vnd BIGINT,
  gm_bps INTEGER,
  recommended_option_key TEXT,
  valid_until TIMESTAMPTZ,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, n),
  CONSTRAINT crm_quote_versions_state_chk CHECK (
    state IN ('working','submitted','approved','published','accepted','superseded')
  )
);

CREATE TABLE IF NOT EXISTS crm_quote_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  pct_bps INTEGER NOT NULL,
  amount_vnd BIGINT NOT NULL,
  milestone TEXT NOT NULL,
  UNIQUE (version_id, seq)
);

CREATE TABLE IF NOT EXISTS crm_quote_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id),
  version_id UUID,
  actor_staff_id INTEGER,
  actor_kind TEXT NOT NULL DEFAULT 'staff',
  action TEXT NOT NULL,
  resource TEXT,
  snapshot_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_quote_activity_proposal_idx
  ON crm_quote_activity (proposal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_quote_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, target_type)
);

CREATE TABLE IF NOT EXISTS crm_quote_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
```

- [ ] **Step 2: Apply script** — copy `scripts/apply_pg_ddl_cp.sh` pattern; file `docs/specs/2026-09-08-postgresql-ddl-qt.sql`.

```bash
bash scripts/apply_pg_ddl_qt.sh
```

Expected: `OK  QT DDL applied`

- [ ] **Step 3: Verify**

```bash
psql "$DATABASE_URL" -c "\d crm_proposals" -c "\dt crm_quote_*"
```

Expected: new columns + 5 `crm_quote_*` tables. Existing rows keep `id` integer.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/2026-09-08-postgresql-ddl-qt.sql scripts/apply_pg_ddl_qt.sh
git commit -m "feat(qt): wave 1 DDL for quotation versions and codes"
```

---

### Task 2: RBAC catalog (no user grants)

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Create: `scripts/seed_qt_rbac.sh`
- Test: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.spec.ts` (or existing catalog test)

**Interfaces:**
- Consumes: SRS §3
- Produces: sections `crm_quote`, `crm_quote.approve`, `crm_quote.finance`, `crm_quote.legal`, `crm_quote.publish`, `crm_quote.convert`, `crm_quote.catalog`, `crm_quote.audit`

- [ ] **Step 1: Add catalog entries** next to `crm_cp` block:

```json
"crm_quote": ["view", "view_all", "edit", "manage"],
"crm_quote.approve": ["execute"],
"crm_quote.finance": ["view", "edit"],
"crm_quote.legal": ["execute"],
"crm_quote.publish": ["execute"],
"crm_quote.convert": ["execute"],
"crm_quote.catalog": ["view", "manage"],
"crm_quote.audit": ["view"]
```

Also add matching `sections[]` objects (`id`, `label_vi`, `actions`) and include ids in the published section list — same shape as `crm_cp`.

- [ ] **Step 2: seed script** prints SQL **catalog only**. File MUST contain:

```bash
# FORBIDDEN: INSERT INTO staff_section_permissions
```

and must not run that INSERT.

- [ ] **Step 3: Test** — catalog JSON parses; forbidden grant string absent.

```bash
cd services/ptt-crm-api && npx jest src/staff-permissions/rbac-admin-catalog.spec.ts -v
```

Expected: PASS. `rg "staff_section_permissions" scripts/seed_qt_rbac.sh` finds only the FORBIDDEN comment.

- [ ] **Step 4: Commit** `feat(qt): add crm_quote RBAC catalog (no user grants)`

---

### Task 3: Types, money, format, scope, code, status

**Files:**
- Create: `services/ptt-crm-api/src/proposals/quote.types.ts`
- Create: `services/ptt-crm-api/src/proposals/quote-format.util.ts`
- Create: `services/ptt-crm-api/src/proposals/quote-scope.util.ts`
- Create: `services/ptt-crm-api/src/proposals/quote-money.util.ts`
- Create: `services/ptt-crm-api/src/proposals/quote-code.util.ts`
- Create: `services/ptt-crm-api/src/proposals/quote-status.util.ts`
- Test: `*.spec.ts` beside each util
- Modify: `quote-pricing.util.ts` — product path must not use `DEFAULT_QUOTE_TIER_PRICING` when catalog has no rate (return nulls + `rate_missing`)

**Interfaces:**
- Consumes: Task 1 money columns
- Produces:

```ts
export type QuoteStatus =
  | 'draft' | 'in_review' | 'pending_approval' | 'returned' | 'approved'
  | 'sent' | 'viewed' | 'negotiation' | 'accepted' | 'rejected'
  | 'expired' | 'cancelled' | 'superseded' | 'archived';

export type QuoteScope = 'me' | 'team' | 'all';
export const QT_KPI_KEYS = [
  'open_quote_value',
  'pending_approval_count',
  'quote_win_rate',
  'forecast_gross_margin',
] as const;

export function emptyKpis(): Record<(typeof QT_KPI_KEYS)[number], number | null> {
  return {
    open_quote_value: null,
    pending_approval_count: null,
    quote_win_rate: null,
    forecast_gross_margin: null,
  };
}

export function calcPayable(input: {
  feeVnd: bigint; mediaVnd: bigint; discountVnd: bigint; vatBps: number;
}): { taxVnd: bigint; payableVnd: bigint };

export function calcGmBps(nsrVnd: bigint, directCostVnd: bigint): number | null;
export function allocatePayment(payableVnd: bigint, pctBps: number[]): bigint[];
export function formatQuoteCode(year: number, seq: number): string; // QT-PTT-2026-000089
export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean;
export function mapLegacyStatus(s: 'draft'|'sent'|'accepted'|'rejected'): QuoteStatus;
```

- [ ] **Step 1: Failing tests**

```ts
it('GM null when NSR is 0', () => {
  expect(calcGmBps(0n, 1n)).toBeNull();
});
it('payment 50/30/20 remainder on last', () => {
  expect(allocatePayment(265647600n, [5000, 3000, 2000])).toEqual([
    132823800n, 79694280n, 53129520n,
  ]);
});
it('rejects media in NSR', () => {
  const nsr = calcNsr([{ itemType: 'fee', netVnd: 126000000n }, { itemType: 'media', netVnd: 120000000n }]);
  expect(nsr).toBe(126000000n);
});
it('quote code pads 6', () => {
  expect(formatQuoteCode(2026, 89)).toBe('QT-PTT-2026-000089');
});
it('legacy sent maps to sent', () => {
  expect(mapLegacyStatus('sent')).toBe('sent');
});
```

- [ ] **Step 2: Run** `npx jest src/proposals/quote-money.util.spec.ts src/proposals/quote-code.util.spec.ts src/proposals/quote-status.util.spec.ts -v`  
  Expected: FAIL (modules missing)

- [ ] **Step 3: Implement** until PASS. `allocatePayment` puts rounding remainder on the last installment. `calcGmBps` = `round((nsr-cost)*10000/nsr)` or `null`.

- [ ] **Step 4: Commit** `feat(qt): money, code, status, and empty KPI helpers`

---

### Task 4: StaffQuoteGuard + resolveCrmStaffUserId

**Files:**
- Create: `services/ptt-crm-api/src/proposals/guards/staff-quote.guard.ts`
- Create: `services/ptt-crm-api/src/proposals/guards/staff-quote.guard.spec.ts`
- Modify: `guards/staff-proposals.guard.ts` — view allowed if `crm_quote.view` **or** (compat) `crm_board.view`
- Modify: `proposals.module.ts` — provide `StaffQuoteGuard`

**Interfaces:**
- Consumes: Task 2 caps
- Produces: `RequireQuoteAction`, `RequireQuoteSection`, `StaffQuoteGuard` (copy CP `StaffCpGuard` + `resolveCrmStaffUserId`)

```ts
export const RequireQuoteSection = (section: QuoteCapSection, action: QuoteCapAction) =>
  applyDecorators(
    SetMetadata(QT_REQUIRED_SECTION_KEY, section),
    SetMetadata(QT_REQUIRED_ACTION_KEY, action),
  );
```

Unresolved staff → `{ error: 'qt_unresolved_staff' }`. Missing cap → `{ error: 'missing_cap', section, action }`.

- [ ] **Step 1: Test** JWT `sub` UUID resolves via mocked `resolveCrmStaffUserId` → 99; null → 403 `qt_unresolved_staff`; no `crm_quote.finance` on BLD-05 route.

```bash
cd services/ptt-crm-api && npx jest src/proposals/guards/staff-quote.guard.spec.ts -v
```

- [ ] **Step 2: Implement + commit** `feat(qt): StaffQuoteGuard resolves staff from JWT sub`

---

### Task 5: Settings API (SET-01…04 store)

**Files:**
- Create: `quote-settings.repository.ts` + `.service.ts`
- Modify: `proposals.controller.ts` — `GET/PATCH settings` **before** `:id`
- Test: `quote-settings.service.spec.ts`

**Interfaces:**
- Consumes: `crm_quote_settings`
- Produces: `GET /api/crm/proposals/settings` → row; `PATCH` requires `crm_quote.manage`

W1 fields: pattern (readonly), validity_days, vat_bps, payment_template, gm_floor_bps, discount_auto_bps, director_value_vnd, payment_term_max_days, share flags, `ai_enabled` always persisted `false` unless env `QT_AI_ENABLED=1` **and** UAT note — PATCH cannot set `ai_enabled=true` if env unset.

- [ ] Tests: GET default PTT; PATCH vat_bps=800; PATCH ai_enabled ignored when env unset.
- [ ] Commit `feat(qt): commercial settings API`

---

### Task 6: Overview + Action Center + Activity API (OVR-01…03)

**Files:**
- Create: `quote-overview.service.ts` + spec
- Create: `quote-audit.repository.ts`
- Modify: controller

```
GET /api/crm/proposals/overview?from&to&scope=me|team|all&owner=
GET /api/crm/proposals/actions
GET /api/crm/proposals/activity
```

**Interfaces:**
- Consumes: Task 3 `emptyKpis`, Task 4 guard
- Produces:

```ts
{
  last_updated: string; // ISO
  kpis: ReturnType<typeof emptyKpis>;
  win_rate_formula: 'accepted/(accepted+rejected)';
  by_status: Array<{ status: QuoteStatus; count: number; payable_vnd: number | null }>;
  health: { below_floor: number; discount_over_cap: number; cost_missing: number; viewed_no_reply: number };
}
```

Open value = Σ `payable_vnd` where status ∈ `draft…negotiation` (not accepted). Finance-less callers get `forecast_gross_margin: null` (omit NSR). Zero rows → all KPI `null` except counts that are truly 0 (`pending_approval_count` may be 0).

Action Center rows: `{ severity, title, impact, owner_staff_id, sla, href, resource_type, resource_id }`.

Activity export requires `crm_quote.audit`. Never log OTP/token raw.

- [ ] **Tests:** empty tenant → `open_quote_value === null` or `0` only if query ran and sum is 0 — prefer `null` when no rows in scope; no `8460000000` literal in source (`rg "8460000000|8,46" src/proposals` empty).
- [ ] Commit `feat(qt): overview KPIs, actions, and activity`

---

### Task 7: List + create from Lead / AM 360 (LST-01, NEW-01)

**Files:**
- Create: `quote-list.service.ts`, `quote-create.service.ts` + specs
- Modify: `proposals.service.ts` `create()` to call `quote-create` when `title` / `agency_client_id` present; keep old Deal Room body
- Modify: `GET /` list — add `scope`, `status`, `q`, `expiring`, `pending_my_approval`, `page`, `page_size`

**Interfaces:**
- Consumes: Task 1 columns, Task 3 `formatQuoteCode`
- Produces:

```ts
POST /api/crm/proposals
Idempotency-Key: required
{
  source: 'lead' | 'am360' | 'blank';
  lead_id?: number;
  agency_client_id?: string; // UUID from select, never free-text
  customer_id?: number;      // resolved from lead if missing
  title: string;
  quote_type: 'new_business'|'renewal'|'upsell'|'retainer'|'campaign'|'project'|'change_request';
}
→ { proposal: { id: number; quote_code: string; status: 'draft'; current_version_id: string } }
```

Rules: source `lead` requires lead with client (agency or customer). Blank/AM360 requires `agency_client_id` existing in `clients`. Unknown UUID → `client_not_found` 400. No INSERT into `clients`. Allocates `quote_code` via `nextval('crm_quote_code_seq')`. Creates working version `n=1`. Audit `quote.created`.

List columns: quote_code, version n, client name, lead code, option (null W1), payable, fee, gm_bps (null if !finance), status, valid_until, owner. Never return cost fields without finance.

- [ ] Tests: AC-01 create from lead; AC-12 scope `me` hides other owner; UUID that is not a client → 400; create does not INSERT clients.
- [ ] Commit `feat(qt): scoped list and create from lead or AM 360`

---

### Task 8: Builder W1 — header, SKU lines, money, payment (BLD-01,03,05,06)

**Files:**
- Create: `quote-builder.service.ts`, `quote-versions.repository.ts` + specs
- Modify: `PUT /:id/lines` to write version snapshot + `item_type` + media + tax
- Modify: `quote-pricing.util.ts` — `allowDefaultFallback=false` on product add

**Interfaces:**
- Consumes: catalog `dv_code` + tier
- Produces:

```
PATCH /api/crm/proposals/:id          If-Match: row_version
POST  /api/crm/proposals/:id/versions/:vid/recalculate
PUT   /api/crm/proposals/:id/lines
PUT   /api/crm/quote-versions/:vid/payments
```

Recalc: fee/media/discount/VAT/payable/NSR/GM. Submit validation: header complete, ≥1 client-visible line, payment pct_bps sum = 10000, no Draft catalog line.

BLD-05 fields only if `crm_quote.finance`. Otherwise 403 `{ error: 'missing_cap', section: 'crm_quote.finance' }` — do not send `cost_*` as 0.

Payment default from settings `50/30/20`. Remainder on last (Task 3).

- [ ] Tests: AC-02 snapshot — change catalog price, old version unchanged; AC-07 265647600 50/30/20; AC-09 Draft service → `catalog_not_active`; missing cost flagged not invented; `If-Match` stale → 409.
- [ ] Commit `feat(qt): builder recalc, SKU lines, and payment 100%`

---

### Task 9: Catalog grid API (CAT-01, CAT-05 link)

**Files:**
- Create: `quote-catalog.service.ts` (wrap existing `getCatalogForQuote`)
- Modify: `GET quote-catalog` response: `status: 'active'|'draft'`, `can_add_to_client_quote: boolean`, `dv_code`, `package_tiers[]`, `group`

**Interfaces:**
- Consumes: `crm_catalog_services` / `ops_service_profile`
- Produces: 13 group keys matching mockup CAT-01. Draft → `can_add_to_client_quote=false`.

CAT-05: return `template_key: 'VID-TPL-01'` on DV12 / brand-film family; no video binary.

- [ ] Tests: Draft cannot add; Active + valid rate can add; no default 10tr fallback when rate missing (`rate_missing`).
- [ ] Commit `feat(qt): catalog add rules for client-facing quotes`

---

### Task 10: Convert idempotent (CVT-01, AC-08 start)

**Files:**
- Create: `quote-convert.service.ts` + spec
- Modify: accept path — **do not** spawn lifecycle from `PATCH status=accepted` anymore; accepted only locks; convert is explicit `POST /:id/versions/:vid/convert`
- Keep: if old clients still PATCH accepted, call convert once internally with Idempotency-Key `legacy-accept:{id}`

**Interfaces:**

```
POST /api/crm/proposals/:id/versions/:vid/convert
RequireQuoteSection('crm_quote.convert','execute')
Idempotency-Key required
→ { conversion_id, lifecycles: [{ line_id, lifecycle_id, dv_code }], invoice_draft_ids }
```

Unique `(version_id, target_type)` where `target_type` ∈ `lifecycle_bundle|invoice_schedule`. Second POST returns same ids (AC-08).

Do not create CSD tickets. Do not INSERT `crm_cp_projects` in W1 (record `optional_handoff: []`).

- [ ] Tests: two converts → one lifecycle set; accepted without convert leaves no extra lifecycle if using new path; missing cap 403.
- [ ] Commit `feat(qt): idempotent convert to lifecycle and invoice draft`

---

### Task 11: QtShell, routes, OpsNav, rbac-routes

**Files:**
- Create: `services/ops-web/src/app/crm/proposals/layout.tsx`
- Create: `qt.css`, `QtShell.tsx`, `qt-nav.util.ts`, `qt-api.ts`, `qt-format.ts`
- Create: route `page.tsx` files listed in file map (placeholders with chrome)
- Modify: `OpsNav.tsx` label `Báo giá`
- Modify: `rbac-routes.ts` — `/crm/proposals` **before** `/crm`:

```ts
{
  prefix: '/crm/proposals',
  anyOf: [
    { section: 'crm_quote', action: 'view' },
    { section: 'crm_quote', action: 'view_all' },
    { section: 'crm_board', action: 'view' }, // compat until Admin grants crm_quote
  ],
},
```

- Modify: `auth.spec.ts` — `/crm/proposals` true with `crm_quote.view`; false with unrelated cap
- Modify: `page.tsx` — if `searchParams.id` → redirect `/crm/proposals/{id}`; if `wizard=1` → `/crm/proposals/new?...`

**Interfaces:**
- Consumes: Task 2/4 caps
- Produces: 7 sidebar items only. `dash(null)==='—'`. Class prefix `qt-*`. One `<main>` inside shell.

- [ ] **Tests (Vitest):** `qt-nav.util.spec.ts` length 7; no 8th Studio; `qt-format.spec.ts` dash.
- [ ] **Manual:** `rg "Nhảy màn|Toàn catalog|NOVA" services/ops-web/src/components/crm/qt services/ops-web/src/app/crm/proposals` empty (except comments).
- [ ] Commit `feat(qt): QtShell, 7-item nav, and proposal routes`

---

### Task 12: OVR UI (OVR-01…03)

**Files:** `QtOverview.tsx`, `QtActivity.tsx`, `app/crm/proposals/page.tsx`, `activity/page.tsx`

**Interfaces:**
- Consumes: Task 6 API
- Produces: exactly 4 tiles; formula text on win-rate tile; Action Center table; activity filters

Empty: tiles show `—`. Alert bar only if `actions.length>0`. Click tile 1 → `/crm/proposals/list?open=1`; tile 2 → `/approvals`.

- [ ] Vitest: render with null KPIs → four `—`; no `8,46`.
- [ ] Commit `feat(qt): overview dashboard and action center`

---

### Task 13: List + Create UI (LST-01, NEW-01)

**Files:** `QtQuoteList.tsx`, `QtCreateForm.tsx`, `list/page.tsx`, `new/page.tsx`

**Interfaces:**
- Consumes: Task 7
- Produces: chips All / Mine / Pending me / Expiring / Sent no reply; named `<select>` for lead and client; three source cards

Forbidden: `<input name="agency_client_id">` text. Use select from `GET /api/crm/agency/clients` (existing AM list).

Deal Room link keeps working via layout redirect.

- [ ] Vitest + Playwright helper create from lead.
- [ ] Commit `feat(qt): quote list and create wizard`

---

### Task 14: Builder UI W1 (BLD-01…07 chrome)

**Files:** `QtBuilder.tsx`, `QtStickyCommercial.tsx`, `[id]/page.tsx`

Tabs all exist. W1 enabled: Bối cảnh, Dịch vụ (SKU 3-tier), Chi phí (finance), Điều khoản (payment). W2 disabled content still **renders** empty/`—` (Phương án one implicit A; KPI table empty; History shows v1 only).

Sticky: fee, media, discount, VAT, payable, NSR/GM if finance, payment flow.

Copy: no “NOVA”. Status pill Vietnamese.

- [ ] Vitest: sticky hides GM without finance; Draft catalog CTA disabled.
- [ ] Commit `feat(qt): builder workspace with SKU and sticky commercial`

---

### Task 15: Catalog UI W1 (CAT-01, CAT-05)

**Files:** `QtCatalog.tsx`, `catalog/page.tsx`

13 group cards + Draft badge. CAT-05 page: static template 6-scene table (copy from mockup as **template text**, not a quote). Button “Dùng khi convert DV12” disabled until W3 — still visible.

- [ ] Commit `feat(qt): service catalog grid`

---

### Task 16: Chrome APR / Studio / Reports / Settings

**Files:** `QtApprovals.tsx`, `QtStudio.tsx`, `QtReports.tsx`, `QtSettings.tsx` + pages

W1: Settings GET/PATCH live (Task 5). Approvals/Studio/Reports: real page, empty table / `—`, no “sẽ có ở W2” toast.

Studio 9 section nav visible; publish button disabled with reason `version_not_approved`.

- [ ] Commit `feat(qt): placeholder chrome for approvals, studio, and reports`

---

### Task 17: Convert UI (CVT-01)

**Files:** `QtConvert.tsx`, `[id]/convert/page.tsx`

Shows accepted version, planned lifecycles, Idempotent note. Button calls Task 10. Second click shows same ids.

- [ ] Commit `feat(qt): convert panel`

---

### Task 18: Portal min + expire (PUB-01…03)

**Files:**
- Create: `quote-public.controller.ts` `@Controller('api/public/proposals')`
- Create: portal `app/proposals/[token]/page.tsx`
- W1 token: 32-byte random, store sha256 in `crm_quote_shares.token_hash` (table from Task 1). Wave 2 ALTER adds `publication_id`.

**W1 accept:** checkbox + name/email (no OTP yet). Writes status `accepted`, option_key `A`. PUB-03 when `valid_until` past or revoked.

Public GET strips cost/margin (Task 3 types — implement `stripPublicQuote` now, used again in W2).

- [ ] Tests: public JSON keys exclude `cost`, `margin`, `gm_bps`, `nsr`; expired → 410 body without investment section.
- [ ] Commit `feat(qt): public proposal page and checkbox accept`

---

### Task 19: Expiry worker + W1 UAT

**Files:**
- Create: `quote-expiry.worker.ts` (copy AM/CP timer style)
- Create: `services/ops-web/e2e/qt-w1-uat.spec.ts`
- Create: `e2e/helpers/qt-w1-helpers.ts`
- Create: `docs/evidence/qt-w1-signoff.json` (filled after run)

**UAT must assert:**
1. 403 without cap
2. 4 KPI tiles present; formula string visible
3. Create from lead → `QT-PTT-20` prefix
4. No UUID text field
5. Draft catalog add rejected
6. Payment 100%
7. Convert twice same lifecycle ids
8. Public accept wording `Xác nhận đề xuất`
9. One `<main>`
10. `rg` no `265647600` in `components/crm/qt`

Do **not** enable `QT_AI_ENABLED`.

- [ ] Commit `test(qt): wave 1 UAT and expiry worker`

**Stop.** Do not start Wave 2 until this file is green.

---

# Wave 2 — Options, approval, Studio, OTP, catalog drawer

**UAT gate:** A/B/C + one recommended; GM 22.4% sample path routes Finance+GDKD; revision creates v2; public leak test; OTP accept; Draft still blocked.

### Task 20: Wave 2 DDL

**Files:** `docs/specs/2026-09-08-postgresql-ddl-qt-w2.sql`, `scripts/apply_pg_ddl_qt_w2.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_quote_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  name TEXT NOT NULL,
  recommended BOOLEAN NOT NULL DEFAULT FALSE,
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  payable_vnd BIGINT NOT NULL DEFAULT 0,
  UNIQUE (version_id, option_key)
);

CREATE TABLE IF NOT EXISTS crm_quote_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  option_key TEXT,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  value_text TEXT NOT NULL,
  source TEXT,
  assumption TEXT,
  CONSTRAINT crm_quote_kpis_class_chk CHECK (
    class IN ('committed','optimization_target','projected_result','assumption_input')
  )
);

CREATE TABLE IF NOT EXISTS crm_quote_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id INTEGER NOT NULL REFERENCES crm_quote_line_item(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty INTEGER,
  format TEXT,
  acceptance TEXT
);

CREATE TABLE IF NOT EXISTS crm_quote_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  body TEXT NOT NULL,
  diverged BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS crm_quote_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  policy_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_quote_approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES crm_quote_approvals(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  section TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'locked',
  assignee_staff_id INTEGER,
  sla_hours INTEGER,
  acted_at TIMESTAMPTZ,
  comment TEXT,
  delegate_from INTEGER,
  CONSTRAINT crm_quote_step_state_chk CHECK (
    state IN ('done','waiting','locked','skipped')
  )
);

CREATE TABLE IF NOT EXISTS crm_quote_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by INTEGER NOT NULL,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE crm_quote_shares
  ADD COLUMN IF NOT EXISTS publication_id UUID REFERENCES crm_quote_publications(id);

CREATE TABLE IF NOT EXISTS crm_quote_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES crm_quote_shares(id),
  section_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_quote_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  author_kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_quote_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES crm_quote_versions(id),
  option_key TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_title TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS crm_quote_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  dv_code TEXT NOT NULL,
  package_tier TEXT NOT NULL,
  fee_vnd BIGINT NOT NULL,
  cost_labor_vnd BIGINT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  state TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS crm_quote_cost_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES crm_quote_rate_cards(id),
  labor_vnd BIGINT,
  outsource_vnd BIGINT,
  tools_vnd BIGINT
);

CREATE TABLE IF NOT EXISTS crm_quote_catalog_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_service_id TEXT NOT NULL,
  profile_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] Apply + commit `feat(qt): wave 2 DDL for options, approval, and shares`

---

### Task 21: Options A/B/C API (BLD-02)

**Files:** `quote-options.service.ts` + spec

```
POST /quote-versions/:vid/options
POST /quote-versions/:vid/options/:key/duplicate
PATCH /quote-versions/:vid/options/:key  { recommended, client_visible, name }
```

Max one recommended. Hidden option excluded from public DTO (`quote-public-strip.util.ts`).

- [ ] Tests: second recommended flips the first; public strip drops `client_visible=false`.
- [ ] Commit `feat(qt): quote options A/B/C`

---

### Task 22: Approval policy (APR-01…02, SET-02, SET-05)

**Files:** `quote-policy.util.ts`, `quote-approval.service.ts` + specs

Triggers from SRS §9.2. `POST /quote-versions/:vid/submit-approval`.  
`POST /quote-approval-steps/:sid/actions` `{ action: 'approve'|'return'|'reject'|'delegate', comment, delegate_staff_id?, until? }`.

Return/reject **require** comment. Delegate stores actor + delegate + until + reason.

GM &lt; floor → Finance + GDKD steps (AC-03). Cannot publish until all required `done`.

- [ ] Tests: AC-03 route; comment missing → 400; BR-QT-006 no bypass via extra zero line (policy recompute after recalc).
- [ ] Commit `feat(qt): approval policy engine`

---

### Task 23: Version compare (BLD-07, AC-04)

**Files:** extend `quote-versions.repository.ts`

`GET /proposals/:id/versions/:a/diff/:b` → list of `{ path, from, to, critical }`.  
Critical paths: price, qty, discount, tax, cost, scope, visible KPI, payment, clause.

PATCH of critical field on `approved`/`published` → 409 `{ error: 'revision_required' }` unless `POST /versions` created working v_n+1.

- [ ] Tests: AC-04.
- [ ] Commit `feat(qt): immutable versions and commercial diff`

---

### Task 24: Studio 9 sections (PRS-01, SET-06)

**Files:** `quote-studio.service.ts`, gate 08+09

Publish `POST /quote-versions/:vid/publish` requires: version `approved`, sections 08+09 on, payable&gt;0, payment 100%, forecast has assumption.  
Merge fields from version. Renderer output is the **same DTO** as public GET.

- [ ] Tests: AC-06 leak on publish payload; gate off section 09 → 400 `studio_gate`.
- [ ] Commit `feat(qt): proposal studio publish gate`

---

### Task 25: Catalog drawer + packages + rates (CAT-02…04)

**Files:** extend `quote-catalog.service.ts`, `QtCatalog.tsx` 6 tabs

Tabs: overview, deliverable, KPI, timeline, pricing (finance), policy.  
CAT-03 package add = N snapshot lines. CAT-04 lists `crm_quote_rate_cards`.

- [ ] Tests: package add snapshots N lines; expired rate → `rate_expired`.
- [ ] Commit `feat(qt): catalog drawer, industry packages, rate cards`

---

### Task 26: Share token + OTP (PUB-02, SET-04)

**Files:** `quote-share.service.ts`

Token: 32-byte random, store **sha256** only. Expiry from settings. Revoke → PUB-03.  
OTP: 6-digit, email via existing PTT mailer (not browser SMTP), 5-min TTL, 5 attempts.  
Accept writes `crm_quote_acceptances`. Locks option (AC-05).

- [ ] Tests: expired token 410; wrong OTP 401; raw token not in activity snapshot; AC-05 option B lock.
- [ ] Commit `feat(qt): share tokens and OTP acceptance`

---

### Task 27: Builder UI W2 (BLD-02…07 live)

**Files:** `QtBuilder.tsx` — enable option cards, Meta funnel, KPI class table, history diff

Funnel numbers from KPI rows class `projected_result` only — never invent CTR.

- [ ] Commit `feat(qt): builder options, funnel, and KPI classes`

---

### Task 28: Approval UI (APR-01…02, SET-05)

**Files:** `QtApprovals.tsx`

Inbox + step timeline + policy badges + snapshot NSR (finance).

- [ ] Commit `feat(qt): approval inbox and step actions`

---

### Task 29: Studio UI + portal OTP (PRS-01, PUB-01…02)

**Files:** `QtStudio.tsx`, portal `PublicProposal.tsx`

Same section order 01–09. Client CTA **Xác nhận đề xuất**.

- [ ] Playwright: accept B + OTP; public HTML has no “margin” / “NSR”.
- [ ] Commit `feat(qt): studio editor and portal OTP accept`

---

### Task 30: Wave 2 UAT

**Files:** `e2e/qt-w2-uat.spec.ts`, `docs/evidence/qt-w2-signoff.json`

Cover AC-03, 04, 05, 06, 11.

- [ ] Commit `test(qt): wave 2 UAT`
- **Stop** until green.

---

# Wave 3 — Reports, engagement, brand-video handoff, import, SLA

**UAT gate:** AC-08 already green; AC-10 brand film deep-link; five report tabs; lost_reason required on reject; import does not rewrite old snapshots; AI still off.

### Task 31: Wave 3 DDL + SLA / delegate polish

**Files:** `docs/specs/2026-09-08-postgresql-ddl-qt-w3.sql`, `scripts/apply_pg_ddl_qt_w3.sh`

```sql
CREATE TABLE IF NOT EXISTS crm_quote_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  filename TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',
  result_json JSONB NOT NULL DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_quote_approval_steps
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS crm_quote_esign_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id UUID REFERENCES crm_quote_acceptances(id),
  provider TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'stub',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

E-sign rows stay `stub` until a provider is chosen. No vendor SDK this wave.

- [ ] Commit `feat(qt): wave 3 DDL`

---

### Task 32: Reports RPT-01…05

**Files:** `quote-reports.service.ts`, `QtReports.tsx`

```
GET /api/crm/proposals/reports?tab=executive|funnel|margin|loss|engagement&from&to&scope=
GET /api/crm/proposals/reports/export  → audit crm_quote.audit
```

RPT-01: sent count/value, sent-to-viewed, sent-to-accepted, avg approval hours.  
RPT-02: funnel with **denominator on each step**.  
RPT-03: finance only; NSR fee-only.  
RPT-04: rejected requires `lost_reason` enum (`budget|competitor|priority|scope|other`).  
RPT-05: first/last view + section.

Agency revenue **excludes** media.

- [ ] Tests: RPT-03 403 without finance; reject without lost_reason 400; export writes activity.
- [ ] Commit `feat(qt): quotation reports and export audit`

---

### Task 33: Brand video / CP / Video SOP after convert (CAT-05, AC-10)

**Files:** extend `quote-convert.service.ts`

If line `dv_code` in allowlist (`DV12` or snapshot `kind=human_video|brand_film`) and settings flag `handoff_video=true`:

- create or link `vd_project_id` via existing Video SOP API (do not clone tables)
- attach `template_key=VID-TPL-01`
- optional CP project only if `kind=ai_video`

QT still has no timeline editor.

- [ ] Tests: AC-10; non-production line → no vd_project; convert still idempotent.
- [ ] Commit `feat(qt): production line handoff to Video SOP / CP`

---

### Task 34: Catalog import + lost-reason UI + engagement

**Files:** import job worker (sync W3), RPT-04/05 UI already in Task 32 — wire reject modal on LST-01

Import CSV/JSON → `crm_quote_catalog_revisions` + rate cards. Never rewrite published quote snapshots.

- [ ] Tests: import then old version snapshot unchanged (AC-02 regression).
- [ ] Commit `feat(qt): catalog import and lost-reason capture`

---

### Task 35: AI draft flag (off) + docs

**Files:** `proposals.service.ts` `generate()` — if `!process.env.QT_AI_ENABLED` → 404 `{ error: 'qt_ai_disabled' }`

User guide: `docs/huong-dan-su-dung/35-quotation-os.md` + index link (Vietnamese).  
Do not write AI copy into proposals.

- [ ] Tests: generate 404 when unset.
- [ ] Commit `feat(qt): keep AI generate disabled and add user guide`

---

### Task 36: Wave 3 UAT + signoff

**Files:** `e2e/qt-w3-uat.spec.ts`, `docs/evidence/qt-w3-signoff.json`

Platform checks from SRS §21 AC-01…12 as automated or documented manual.

Do **not** set `QT_AI_ENABLED` in this task.

- [ ] Commit `test(qt): wave 3 UAT and signoff`

---

## Workers / ops (fold into waves)

| Unit | Wave | Pattern |
|---|---|---|
| `quote-expiry.worker` | 1 | daily ICT: status `expired` when `valid_until < now()` and not accepted |
| Approval SLA escalate | 2 | +24h → owner + GDKD action row |
| Catalog import | 3 | job row + sync worker |
| E-sign | 3 stub | table only |

Scripts applying timers **must not** GRANT RBAC.

---

## Compatibility (do not break)

| Caller | Keep |
|---|---|
| Deal Room `proposals_href` + `?lead_id=&wizard=1` | Redirect NEW-01 |
| `GET /api/crm/proposals?lead_id=` / `customer_id=` | Still returns `{ proposals }` |
| `PUT /:id/lines` | Still works; writes current working version |
| `PATCH /:id/status` legacy 4-state | Map through `quote-status.util`; `accepted` triggers convert once |
| `GET quote-catalog` | Keep path |
| `POST /:id/export` | Keep; new PDF uses fee/media/VAT |
| `POST /:id/generate` | 404 until flag |
| `DELETE /:id` | Becomes archive (`archived_at`), 200 `{ archived: true }` |
| `crm_proposals.id` integer | Never migrate to UUID |

---

## Self-review (plan vs SRS)

| SRS area | Tasks |
|---|---|
| §2 locks (shell 7, SoR, NSR, VAT 8%, OTP, code) | Constraints + 1, 3, 5, 11, 26 |
| OVR 4 KPI + 3 screens | 6, 12 |
| LST + NEW + no UUID | 7, 13 |
| BLD dual packaging + funnel + KPI class | 8, 14, 21, 27 |
| CAT 13 + drawer + VID-TPL-01 | 9, 15, 25, 33 |
| APR policy table | 22, 28 |
| PRS 9 + gate | 24, 29 |
| PUB wording + OTP + expire | 18, 26, 29 |
| CVT idempotent | 10, 17, 33 |
| RPT 5 + media excluded | 32 |
| SET 6 | 5, 16, 22, 26 |
| BR-QT-001…025 | 3, 4, 7, 8, 10, 18, 22, 23, 26 |
| API table §18 | 5–10, 21–26, 32 |
| Events | `quote-audit.repository` + expiry worker |
| AC-01…12 | 7, 8, 10, 18, 19, 22, 23, 26, 30, 33, 36 |
| Wave table SRS §22 | W1=1–19 · W2=20–30 · W3=31–36 |
| Mockup 35 screens | Screen → Task matrix — no orphan |

**Placeholder scan:** no TBD / “implement later” / “similar to Task N”. W2/W3 name files, SQL, and tests.

**Type consistency:** `QuoteStatus` 14, `QuoteScope`, `emptyKpis` 4 keys, `Idempotency-Key`, `client_not_found`, `catalog_not_active`, `rate_missing`, `revision_required`, `qt_unresolved_staff`, `qt_ai_disabled`, `studio_gate`, BIGINT VND, `package_tier` `basic|standard|premium`, option `A|B|C`.

**SoR note:** SRS text “crm_clients” = AM 360 = Postgres **`clients`**. Plan uses `clients.id`.

---

## Execution

Plan saved to `docs/superpowers/plans/2026-09-08-quotation-os.md`. Two options:

1. **Subagent-Driven (recommended)** — one fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, `executing-plans`, batch with checkpoints  

Which approach?
