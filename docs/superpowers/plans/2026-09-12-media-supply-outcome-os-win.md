# Media Supply & Outcome OS (W1 + WIN-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec cha:** [`docs/superpowers/specs/2026-09-12-media-supply-outcome-os-design.md`](../specs/2026-09-12-media-supply-outcome-os-design.md) · SPEC-MSOS v1.0  
**Spec thắng:** [`docs/superpowers/specs/2026-09-12-media-supply-outcome-os-win-design.md`](../specs/2026-09-12-media-supply-outcome-os-win-design.md) · SPEC-MSOS-WIN v1.0 · hướng A  
**UI contract (prod parity):** [`docs/superpowers/mocks/2026-09-12-media-supply-outcome-os-win.html`](../mocks/2026-09-12-media-supply-outcome-os-win.html)  
**UI chrome kế thừa:** [`docs/superpowers/mocks/2026-09-12-media-supply-outcome-os.html`](../mocks/2026-09-12-media-supply-outcome-os.html)

**Goal:** Nhân viên vận hành **một booking publisher thật** (PTT inventory + 1 partner + 1 property do staff tạo) hết xương sống trong Media OS: capacity → package → reserve → IO → traffic → Live (người) → evidence pack → discrepancy/make-good → request Finance — UI 8 màn **parity mockup WIN**, **không hàng demo cứng**.

**Architecture:** Context mới `msos_*` trong `ptt-crm-api` (`/api/crm/media-os/*`). ops-web hub `/crm/media-os` (8 route). CRM/Finance/Creative chỉ **ref ID** (422 nếu không tồn tại; 0 INSERT `clients` / `leads` / `crm_invoices`). Flag master default **off**. Cổng C và connector write **khóa**. AI A1 = draft template từ số thật; không Live / issue IO / invoice.

**Tech Stack:** NestJS + Jest (`services/ptt-crm-api`) · Next.js + Vitest (`services/ops-web`) · PostgreSQL DDL `docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql` · apply `scripts/apply_pg_ddl_msos_w1_win.sh`

## Global Constraints

- Hub `/crm/media-os` · API `/api/crm/media-os/*` · cap `crm_media` (`view` / `write` / `publish` / `finance_request` / `admin`). Label nav **Media OS** — cấm “Ad Network”, cấm “CRM Ad Network”.
- Flag default **off:** `PTT_MEDIA_OS_ENABLED`, `NEXT_PUBLIC_MEDIA_OS`, `PTT_MEDIA_OS_RESELLER`, `PTT_MEDIA_OS_CONNECTOR_WRITE`. Tắt → nav ẩn, API `404` `{ error: "media_os_disabled" }`, CRM/Ads không vỡ. URL `/meta/*` `/google/*` `/zalo/*` không đổi.
- **Không dữ liệu ảo trên UI/API mặc định.** Không seed inventory/partner/IO/line. Không hardcode hàng `CL-1042`, `IO-VNE-0912`, `PKG-2026-048`, `publisher-pilot.example`, `VnExpress`, `Admicro`, Nova / Sunlight / Tâm An. Mockup HTML = contract layout, **không** copy dataset vào React. Jest/Vitest được dùng fixture synthetic (`clt_test_*`, `ptn_test_*`) **chỉ trong `*.spec.ts`**.
- Empty state bắt buộc khi list API = `[]`. Copy tiếng Việt (khóa dưới Task 19). Không “sample row” khi loading xong.
- Pilot thật = staff tạo trên UI: 1 inventory PTT + 1 partner + 1 property publisher. Hostname property = staff gõ (có thể là site thật).
- IO ≠ invoice. MSOS **không** gọi `InvoicesService.create`. Chỉ `msos_finance_requests`.
- GT-P06: cấm ghi `actual_qty = plan_qty` khi report thiếu. GT-P10 chặn request invoice nếu pack chưa official hoặc discrepancy material không waiver.
- AI không `confirm: true` trên Live / issue IO / partner confirm / make-good close / finance request.
- BR-MSOS-01…08 + BR-MSOS-WIN-01…04 giữ. §4 chỉ chip khóa — không wizard ghi connector, không portal, không che buy-side sống.
- UI prod **không** ribbon `WIN · A`. Token CSS = mockup (`--nav #101a30`, `--blue #3268f6`, …).
- TDD: test đỏ → code → test xanh → commit. Không `--no-verify`. Không commit `.env` / secrets / `.DS_Store`.
- Worktree lúc thực thi: `superpowers:using-git-worktrees`.
- CRM ID sai: **422** `{ error: "client_not_found" }` / `lead_not_found` / `creative_not_found` (spec MSOS, không theo CP 400).
- Timezone `Asia/Ho_Chi_Minh`. Tiền VND integer (đồng).

---

## File map (khóa trước khi code)

### Tạo — DDL / scripts

| File | Trách nhiệm |
|---|---|
| `docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql` | Mọi bảng `msos_*` W1+WIN |
| `scripts/apply_pg_ddl_msos_w1_win.sh` | `psql -f` DDL |
| `scripts/deploy_msos_w1_vps.sh` | Pull + apply DDL + build; **không** bật flag; **không** seed catalog |

### Tạo — API `services/ptt-crm-api/src/msos/`

| File | Trách nhiệm |
|---|---|
| `msos.module.ts` | Nest module |
| `msos.controller.ts` | `@Controller('api/crm/media-os')` |
| `msos.service.ts` | Orchestration |
| `msos.repository.ts` | SQL `msos_*` only |
| `msos.types.ts` | DTO / row types |
| `msos-flags.util.ts` | env parse |
| `msos-errors.util.ts` | Nest HTTP errors |
| `msos-ids.util.ts` | `ML-` / `IO-` / `PKG-` / `INV-` display codes |
| `msos-crm-ref.util.ts` | `requireClient` / `requireLead` / `requireCreative` — SELECT only |
| `msos-capacity.util.ts` | hard/soft/waitlist + overbook |
| `msos-rate.util.ts` | bind published only |
| `msos-gates.util.ts` | GT-01…08 + GT-P01…P06 + GT-P10 |
| `msos-margin.util.ts` | waterfall + make-good line + floor |
| `msos-discrepancy.util.ts` | plan vs report vs evidence |
| `msos-traffic.util.ts` | spec + https + backup |
| `msos-evidence-pack.util.ts` | official = hash + freshness SLA |
| `msos-exceptions.util.ts` | P0/P1 từ row thật |
| `msos-ai-lock.util.ts` | cấm A4/A5 mutate |
| `msos-draft.util.ts` | A1 template từ facts thật |
| `msos-forbidden-seed.util.ts` | denylist tên ảo (prod insert) |
| `guards/staff-msos.guard.ts` | `RequireMsosAction` |
| `*.spec.ts` cạnh mỗi util + `msos-acceptance.spec.ts` | Jest |

### Sửa — API

| File | Việc |
|---|---|
| `src/app.module.ts` | `MsosModule` |
| `src/config/app-config.service.ts` | `mediaOsEnabled`, `mediaOsReseller`, `mediaOsConnectorWrite` default false |
| `src/staff-permissions/rbac-admin-catalog.json` | `crm_media` + metadata |

### Tạo — ops-web

| File | Việc |
|---|---|
| `src/lib/media-os-flags.ts` | `isMediaOsFeEnabled()` |
| `src/components/ops-nav-media-os.ts` | `shouldShowMediaOsNav` |
| `src/lib/crm/msos-nav.ts` | 8 href |
| `src/lib/crm/msos-api.ts` | `msosFetch` → `/api/crm/media-os` |
| `src/lib/crm/msos-empty.ts` | empty copy + denylist |
| `src/lib/crm/msos-gates-ui.ts` | Live / invoice button enable |
| `src/styles/msos.css` | token mockup |
| `src/components/media-os/MsosShell.tsx` | chrome 8 nav + ref links |
| `src/components/media-os/MsosEmpty.tsx` | empty card |
| `src/components/media-os/MsosSpine.tsx` | xương sống + §4 lock |
| `src/components/media-os/MsosCommand.tsx` | Command |
| `src/components/media-os/MsosInventory.tsx` | Inventory + calendar |
| `src/components/media-os/MsosPackages.tsx` | Packages + Tạo IO |
| `src/components/media-os/MsosCampaigns.tsx` | Lines + Live Gate |
| `src/components/media-os/MsosEvidence.tsx` | Pack + DC + MG |
| `src/components/media-os/MsosOutcomes.tsx` | Outcome links |
| `src/components/media-os/MsosMargin.tsx` | Waterfall + request |
| `src/components/media-os/MsosGovernance.tsx` | Flags / scorecard / policy |
| `src/app/crm/media-os/layout.tsx` + 8 `page.tsx` | routes |
| `src/lib/crm/msos-*.spec.ts` | Vitest empty / denylist / gates |

### Sửa — ops-web

| File | Việc |
|---|---|
| `src/lib/auth.ts` | `canViewMediaOs` / `canWriteMediaOs` / `canPublishMediaOs` / `canFinanceRequestMediaOs` |
| `src/lib/rbac-routes.ts` | `/crm/media-os` |
| `src/components/OpsNav.tsx` | link Media OS trong Delivery |
| `src/lib/crm/delivery-module-nav.ts` | cùng link |

**Cấm tạo:** Client 360 page, invoice studio, AI chat hub, knowledge editor, partner portal route, seed SQL inventory.

---

### Task 1: DDL `msos_*` W1+WIN

**Files:**
- Create: `docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql`
- Create: `scripts/apply_pg_ddl_msos_w1_win.sh`
- Create: `services/ptt-crm-api/src/msos/msos-ddl.util.ts`
- Create: `services/ptt-crm-api/src/msos/msos-ddl.util.spec.ts`

**Interfaces:**
- Consumes: none (greenfield)
- Produces: `MSOS_DDL_REQUIRED` needles; migration `2026-09-12-msos-w1-win`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { MSOS_DDL_REQUIRED } from './msos-ddl.util';

describe('MSOS W1+WIN DDL', () => {
  const sql = readFileSync(
    join(__dirname, '../../../../docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql'),
    'utf8',
  );

  it('creates owned tables and forbids CRM/invoice clone', () => {
    for (const needle of MSOS_DDL_REQUIRED) {
      expect(sql).toContain(needle);
    }
    expect(sql).not.toMatch(/CREATE TABLE clients/i);
    expect(sql).not.toMatch(/CREATE TABLE crm_invoices/i);
    expect(sql).not.toMatch(/CREATE TABLE leads/i);
    expect(sql).not.toMatch(/INSERT INTO msos_partners/i);
    expect(sql).not.toMatch(/Sunlight|Tâm An|Admicro/i);
  });
});
```

```ts
export const MSOS_DDL_REQUIRED = [
  'msos_partners',
  'msos_inventories',
  'msos_placements',
  'msos_capacity_buckets',
  'msos_reservations',
  'msos_rate_cards',
  'msos_rate_versions',
  'msos_packages',
  'msos_package_lines',
  'msos_media_lines',
  'msos_insertion_orders',
  'msos_io_revisions',
  'msos_brand_safety_snapshots',
  'msos_traffic_packs',
  'msos_evidence',
  'msos_evidence_packs',
  'msos_evidence_pack_items',
  'msos_discrepancy_cases',
  'msos_make_goods',
  'msos_outcome_links',
  'msos_margin_snapshots',
  'msos_deal_wallets',
  'msos_partner_scorecards',
  'msos_eligibility',
  'msos_exceptions',
  'msos_finance_requests',
  'msos_policies',
  'msos_settings',
  'msos_audit',
  '2026-09-12-msos-w1-win',
] as const;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/msos/msos-ddl.util.spec.ts --no-coverage
```

Expected: FAIL (file missing)

- [ ] **Step 3: Write DDL + apply script**

`scripts/apply_pg_ddl_msos_w1_win.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DATABASE_URL="${DATABASE_URL:-postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb}"
DDL="$ROOT/docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql"
echo "==> Apply MSOS W1+WIN DDL"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DDL"
echo "OK  MSOS W1+WIN DDL applied (schema_migrations: 2026-09-12-msos-w1-win)"
```

`docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql` — **không INSERT nghiệp vụ**. Toàn bộ PK `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. Cột tiền `BIGINT` (đồng). Timestamp `TIMESTAMPTZ`.

```sql
-- docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql
-- Media Supply & Outcome OS W1 + WIN-A. No CRM/invoice clone. No demo seed.
CREATE TABLE IF NOT EXISTS msos_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','watchlist','suspended')),
  kyc_pass BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT
);

CREATE TABLE IF NOT EXISTS msos_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('ptt','partner')),
  partner_id UUID REFERENCES msos_partners(id),
  property_host TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','available','low','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((owner_kind = 'ptt' AND partner_id IS NULL) OR (owner_kind = 'partner' AND partner_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS msos_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES msos_inventories(id),
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  device TEXT,
  geo TEXT,
  unit_kind TEXT NOT NULL CHECK (unit_kind IN ('slot_day','slot_week','cpm','lead','package_week')),
  brand_safety_tier TEXT NOT NULL DEFAULT 'A',
  backup_required BOOLEAN NOT NULL DEFAULT FALSE,
  max_weight_kb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_capacity_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID NOT NULL REFERENCES msos_placements(id),
  bucket_date DATE NOT NULL,
  total_qty BIGINT NOT NULL,
  reserved_soft BIGINT NOT NULL DEFAULT 0,
  reserved_hard BIGINT NOT NULL DEFAULT 0,
  delivered_qty BIGINT NOT NULL DEFAULT 0,
  released_qty BIGINT NOT NULL DEFAULT 0,
  UNIQUE (placement_id, bucket_date)
);

CREATE TABLE IF NOT EXISTS msos_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('ptt','partner')),
  partner_id UUID REFERENCES msos_partners(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_rate_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES msos_rate_cards(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','expired')),
  published_at TIMESTAMPTZ,
  published_by BIGINT,
  unit_price_vnd BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  UNIQUE (rate_card_id, version)
);

CREATE TABLE IF NOT EXISTS msos_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL,
  commercial_ref TEXT,
  sell_vnd BIGINT NOT NULL DEFAULT 0,
  hide_buy_side BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT
);

CREATE TABLE IF NOT EXISTS msos_package_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  placement_id UUID NOT NULL REFERENCES msos_placements(id),
  rate_version_id UUID NOT NULL REFERENCES msos_rate_versions(id),
  qty BIGINT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS msos_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  placement_id UUID NOT NULL REFERENCES msos_placements(id),
  bucket_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('soft','hard','waitlist')),
  qty BIGINT NOT NULL,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_brand_safety_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL,
  alcohol_pharma_banned BOOLEAN NOT NULL DEFAULT TRUE,
  exclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_insertion_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  media_line_id UUID,
  client_id UUID NOT NULL,
  rate_version_id UUID NOT NULL REFERENCES msos_rate_versions(id),
  safety_snapshot_id UUID NOT NULL REFERENCES msos_brand_safety_snapshots(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  qty BIGINT NOT NULL,
  sell_vnd BIGINT NOT NULL,
  buy_vnd BIGINT NOT NULL,
  partner_confirmed_at TIMESTAMPTZ,
  partner_confirm_ref TEXT,
  issued_at TIMESTAMPTZ,
  issued_by BIGINT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','confirmed','cancelled'))
);

CREATE TABLE IF NOT EXISTS msos_io_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  io_id UUID NOT NULL REFERENCES msos_insertion_orders(id),
  revision INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT,
  UNIQUE (io_id, revision)
);

CREATE TABLE IF NOT EXISTS msos_media_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  package_id UUID NOT NULL REFERENCES msos_packages(id),
  io_id UUID REFERENCES msos_insertion_orders(id),
  client_id UUID NOT NULL,
  commercial_ref TEXT,
  connector_external_id TEXT,
  tracking_owner_staff_id BIGINT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','live','paused','ended','stale')),
  live_at TIMESTAMPTZ,
  live_by BIGINT,
  p03_override_by BIGINT,
  p03_override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE msos_insertion_orders
  ADD CONSTRAINT msos_io_media_line_fk
  FOREIGN KEY (media_line_id) REFERENCES msos_media_lines(id);

CREATE TABLE IF NOT EXISTS msos_traffic_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  creative_id UUID,
  width_px INTEGER,
  height_px INTEGER,
  weight_kb INTEGER,
  click_url TEXT,
  backup_attached BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved_by_partner','rejected')),
  reject_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  source TEXT NOT NULL,
  hash TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  storage_key TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_evidence_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','official')),
  official_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_evidence_pack_items (
  pack_id UUID NOT NULL REFERENCES msos_evidence_packs(id),
  evidence_id UUID NOT NULL REFERENCES msos_evidence(id),
  PRIMARY KEY (pack_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS msos_discrepancy_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  io_qty BIGINT NOT NULL,
  report_qty BIGINT,
  evidence_qty BIGINT,
  tolerance_bps INTEGER NOT NULL DEFAULT 300,
  material BOOLEAN NOT NULL DEFAULT FALSE,
  hypothesis TEXT,
  owner_staff_id BIGINT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','waived','closed')),
  waiver_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_make_goods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  discrepancy_id UUID NOT NULL REFERENCES msos_discrepancy_cases(id),
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  qty BIGINT NOT NULL,
  value_vnd BIGINT NOT NULL DEFAULT 0,
  capacity_reserved BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_outcome_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code TEXT NOT NULL UNIQUE,
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  lead_id UUID,
  sale_id UUID,
  model TEXT,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched','unmatched')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_margin_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  gross_sell_vnd BIGINT NOT NULL,
  discount_vnd BIGINT NOT NULL DEFAULT 0,
  media_cost_vnd BIGINT NOT NULL DEFAULT 0,
  make_good_cost_vnd BIGINT NOT NULL DEFAULT 0,
  rebate_accrued_vnd BIGINT NOT NULL DEFAULT 0,
  service_cost_vnd BIGINT NOT NULL DEFAULT 0,
  contribution_vnd BIGINT NOT NULL,
  contribution_bps INTEGER NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_deal_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES msos_partners(id),
  commitment_vnd BIGINT NOT NULL,
  used_vnd BIGINT NOT NULL DEFAULT 0,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_partner_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES msos_partners(id),
  delivery_bps INTEGER,
  discrepancy_bps INTEGER,
  safety_incidents INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_eligibility (
  partner_id UUID PRIMARY KEY REFERENCES msos_partners(id),
  kyc_pass BOOLEAN NOT NULL DEFAULT FALSE,
  scorecard_pass BOOLEAN NOT NULL DEFAULT FALSE,
  rate_published BOOLEAN NOT NULL DEFAULT FALSE,
  reseller_open BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS msos_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL CHECK (priority IN ('P0','P1','P2')),
  kind TEXT NOT NULL,
  media_line_id UUID,
  placement_id UUID,
  title TEXT NOT NULL,
  evidence_text TEXT NOT NULL,
  open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_finance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_line_id UUID NOT NULL REFERENCES msos_media_lines(id),
  evidence_pack_id UUID REFERENCES msos_evidence_packs(id),
  requested_by BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','rejected')),
  invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msos_policies (
  key TEXT PRIMARY KEY,
  rule_text TEXT NOT NULL,
  enforcement TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS msos_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS msos_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_json JSONB,
  after_json JSONB,
  correlation_id TEXT,
  ai_trace_id TEXT
);

INSERT INTO schema_migrations (version) VALUES ('2026-09-12-msos-w1-win')
ON CONFLICT (version) DO NOTHING;

INSERT INTO msos_policies (key, rule_text, enforcement) VALUES
  ('margin_floor', 'CM < 24% → director; < 18% block', 'hard_approval'),
  ('io_not_invoice', 'Issue IO không tạo số HĐ', 'hard'),
  ('discrepancy_tolerance', '> 3% qty → material; chặn invoice', 'hard_waiver'),
  ('actual_ne_plan_shortfall', 'GT-P06', 'hard'),
  ('brand_safety_lock', 'Đổi sau IO = revision + duyệt', 'change_control'),
  ('ai_action', 'Cấm issue IO / confirm / Live / make-good close / invoice', 'hard'),
  ('reseller_c', 'Eligibility §4.2', 'flag_hard')
ON CONFLICT (key) DO NOTHING;
```

Chỉ `msos_policies` được INSERT (rule registry, không phải booking). Không INSERT partner/inventory.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd services/ptt-crm-api && npx jest src/msos/msos-ddl.util.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-09-12-postgresql-ddl-msos-w1-win.sql scripts/apply_pg_ddl_msos_w1_win.sh services/ptt-crm-api/src/msos/msos-ddl.util.ts services/ptt-crm-api/src/msos/msos-ddl.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(msos): add W1+WIN PostgreSQL schema without demo seed

EOF
)"
```

---

### Task 2: Flags default off

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-flags.util.ts`
- Create: `services/ptt-crm-api/src/msos/msos-flags.util.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` (thêm 3 readonly + parse, default `'0'`)
- Create: `services/ops-web/src/lib/media-os-flags.ts`
- Create: `services/ops-web/src/lib/media-os-flags.spec.ts`

**Interfaces:**
- Consumes: `process.env`
- Produces: `parseMediaOsFlag(raw: string | undefined): boolean` · `AppConfigService.mediaOsEnabled` · `isMediaOsFeEnabled()`

- [ ] **Step 1: Write the failing tests**

```ts
import { parseMediaOsFlag } from './msos-flags.util';

describe('msos flags', () => {
  it('defaults off on undefined/empty', () => {
    expect(parseMediaOsFlag(undefined)).toBe(false);
    expect(parseMediaOsFlag('')).toBe(false);
    expect(parseMediaOsFlag('0')).toBe(false);
  });
  it('accepts 1/true/yes/on', () => {
    expect(parseMediaOsFlag('1')).toBe(true);
    expect(parseMediaOsFlag('true')).toBe(true);
  });
});
```

```ts
import { isMediaOsFeEnabled } from './media-os-flags';

describe('isMediaOsFeEnabled', () => {
  const prev = process.env.NEXT_PUBLIC_MEDIA_OS;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_MEDIA_OS;
    else process.env.NEXT_PUBLIC_MEDIA_OS = prev;
  });
  it('is off by default', () => {
    delete process.env.NEXT_PUBLIC_MEDIA_OS;
    expect(isMediaOsFeEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ptt-crm-api && npx jest src/msos/msos-flags.util.spec.ts --no-coverage
cd ../ops-web && npx vitest run src/lib/media-os-flags.spec.ts
```

- [ ] **Step 3: Implement**

```ts
export function parseMediaOsFlag(raw: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((raw ?? '0').trim().toLowerCase());
}
```

```ts
export function isMediaOsFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_MEDIA_OS ?? '0').trim().toLowerCase(),
  );
}
```

Trong `AppConfigService` constructor:

```ts
this.mediaOsEnabled = parseMediaOsFlag(process.env.PTT_MEDIA_OS_ENABLED);
this.mediaOsReseller = parseMediaOsFlag(process.env.PTT_MEDIA_OS_RESELLER);
this.mediaOsConnectorWrite = parseMediaOsFlag(process.env.PTT_MEDIA_OS_CONNECTOR_WRITE);
```

Khai báo `readonly mediaOsEnabled: boolean` (và 2 flag còn lại) cạnh `contentMarketingEnabled`.

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit** `feat(msos): default-off feature flags`

---

### Task 3: Caps `crm_media` + guard

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Create: `services/ptt-crm-api/src/msos/guards/staff-msos.guard.ts`
- Create: `services/ptt-crm-api/src/msos/guards/staff-msos.guard.spec.ts`
- Modify: `services/ops-web/src/lib/auth.ts`
- Create: `services/ops-web/src/lib/crm/msos-auth.spec.ts`

**Interfaces:**
- Consumes: `StaffAuthService.hasCap`
- Produces: `MsosCapAction = 'view' | 'write' | 'publish' | 'finance_request' | 'admin'` · `RequireMsosAction(action)` · `canViewMediaOs(user)`

- [ ] **Step 1: Failing tests**

Guard: thiếu cap → `ForbiddenException({ error: 'missing_cap', section: 'crm_media', action })`. Internal key bypass. Default action `view`.

`canViewMediaOs`: false nếu flag helper không liên quan — chỉ cap `crm_media.view|write|publish|admin` (không bắt `crm_board` — Media OS không nằm trên service-lifecycle).

Catalog test đọc JSON:

```ts
const catalog = require('../../staff-permissions/rbac-admin-catalog.json');
expect(catalog.sections.crm_media).toEqual(
  expect.arrayContaining(['view', 'write', 'publish', 'finance_request', 'admin']),
);
```

(Nếu catalog dùng shape khác — `capabilities` map như `crm_cp` — thêm key `"crm_media": ["view","write","publish","finance_request","admin"]` đúng chỗ `crm_cp` đang đứng, **và** metadata `{ id, label: "Media OS", page: "/crm/media-os" }`.)

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement guard** — copy cấu trúc `StaffCpGuard` (`services/ptt-crm-api/src/cp/guards/staff-cp.guard.ts`): `staffAuthVia === 'internal'` pass; else `hasCap(me.caps, 'crm_media', action)`.

```ts
export function canViewMediaOs(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_media', 'view') ||
    hasCap(user, 'crm_media', 'write') ||
    hasCap(user, 'crm_media', 'publish') ||
    hasCap(user, 'crm_media', 'admin')
  );
}
export function canWriteMediaOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_media', 'write') || hasCap(user, 'crm_media', 'admin');
}
export function canPublishMediaOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_media', 'publish') || hasCap(user, 'crm_media', 'admin');
}
export function canFinanceRequestMediaOs(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_media', 'finance_request') || hasCap(user, 'crm_media', 'admin');
}
```

Không seed grant. Admin UI gán cap.

- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit** `feat(msos): add crm_media capabilities and staff guard`

---

### Task 4: Module skeleton — flag-off 404

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-errors.util.ts` + spec
- Create: `services/ptt-crm-api/src/msos/msos.module.ts`
- Create: `services/ptt-crm-api/src/msos/msos.controller.ts` + spec
- Create: `services/ptt-crm-api/src/msos/msos.service.ts` + spec
- Create: `services/ptt-crm-api/src/msos/msos.repository.ts`
- Create: `services/ptt-crm-api/src/msos/msos.types.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — import `MsosModule`

**Interfaces:**
- Consumes: `AppConfigService.mediaOsEnabled`
- Produces: `MsosService.assertEnabled(): void` · `GET /api/crm/media-os/health` → `{ ok: true, reseller: false, connector_write: false }`

- [ ] **Step 1: Test**

```ts
it('throws media_os_disabled when flag off', () => {
  const svc = new MsosService({ mediaOsEnabled: false } as AppConfigService, repo);
  expect(() => svc.assertEnabled()).toThrow(/media_os_disabled/);
});
```

Controller spec: `assertEnabled` gọi trước mọi handler.

```ts
export function throwDisabled(): never {
  throw new NotFoundException({ error: 'media_os_disabled' });
}
```

- [ ] **Step 2: FAIL**
- [ ] **Step 3: Implement** `@UseGuards(StaffOrInternalKeyGuard, StaffMsosGuard)` · `@RequireMsosAction('view')` trên GET health. `reseller` / `connector_write` luôn đọc từ config (default false).
- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit** `feat(msos): register Nest module with disabled 404`

---

### Task 5: CRM / Creative ref — SELECT only

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-crm-ref.util.ts` + spec

**Interfaces:**
- Consumes: `db.query` inject
- Produces:

```ts
export async function requireClient(db: { query: Function }, clientId: string): Promise<void>
export async function requireLead(db: { query: Function }, leadId: string): Promise<void>
export async function requireCreative(db: { query: Function }, creativeId: string): Promise<void>
```

HTTP: `UnprocessableEntityException({ error: 'client_not_found' })` (422).

- [ ] **Step 1: Test**

```ts
it('422 when client missing and never inserts', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [] }), sqls: [] as string[] };
  db.query.mockImplementation(async (sql: string) => {
    db.sqls.push(sql);
    return { rows: [] };
  });
  await expect(requireClient(db, '00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({
    status: 422,
    response: { error: 'client_not_found' },
  });
  expect(db.sqls.join(' ')).toMatch(/SELECT/i);
  expect(db.sqls.join(' ')).not.toMatch(/INSERT/i);
});
```

SQL:

```sql
SELECT id::text FROM clients WHERE id = $1::uuid LIMIT 1
SELECT id::text FROM leads WHERE id = $1::uuid LIMIT 1
SELECT id::text FROM crm_cp_assets WHERE id = $1::uuid LIMIT 1
```

Nếu bảng lead/asset tên khác trong repo lúc implement — dùng **đúng** bảng SoT hiện có (grep `FROM leads` / `FROM crm_cp_assets`). Không tạo bảng mới.

`requireCreative` chỉ chạy khi `creative_id` được gửi (optional trên traffic pack).

- [ ] **Step 2–4:** FAIL → impl → PASS
- [ ] **Step 5: Commit** `feat(msos): validate CRM refs without inserting`

---

### Task 6: Partner + Inventory + Placement (staff-created)

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-ids.util.ts` + spec
- Create: `services/ptt-crm-api/src/msos/msos-forbidden-seed.util.ts` + spec
- Modify: repository/service/controller — CRUD list/create
- Routes: `GET/POST /partners` · `GET/POST /inventory` · `GET/POST /placements`

**Interfaces:**
- Produces: `createPartner({ legal_name })` · `createInventory({ name, owner_kind, partner_id?, property_host? })` · `createPlacement({ inventory_id, name, format, unit_kind, backup_required, max_weight_kb })`
- List default `[]`. Display codes: `PTN-YYYYMMDD-XXXX` / `INV-YYYYMMDD-XXXX` via `msos-ids.util.ts` (`randomBytes` 2 bytes hex).

- [ ] **Step 1: Tests**

```ts
it('lists empty partners', async () => {
  expect(await svc.listPartners()).toEqual([]);
});
it('rejects forbidden demo names', () => {
  expect(() => assertAllowedMsosName('Sunlight Residence')).toThrow(/forbidden_demo_name/);
  expect(() => assertAllowedMsosName('Admicro giả')).toThrow(/forbidden_demo_name/);
});
it('creates partner from staff legal_name only', async () => {
  const row = await svc.createPartner({ legal_name: 'Cong ty TNHH ABC Truyen thong', staffId: 9 });
  expect(row.legal_name).toBe('Cong ty TNHH ABC Truyen thong');
  expect(row.display_code).toMatch(/^PTN-\d{8}-[A-F0-9]{4}$/);
});
```

```ts
const FORBIDDEN_MSOS_NAME = /sunlight|nova home|tâm an|tam an|admicro|adtima/i;
export function assertAllowedMsosName(name: string): void {
  if (FORBIDDEN_MSOS_NAME.test(name)) {
    throw new UnprocessableEntityException({ error: 'forbidden_demo_name' });
  }
}
```

`VnExpress` **không** nằm denylist (có thể là property thật). Cấm seed tự động hostname đó.

Suspended inventory: `status='suspended'` → reserve sau này fail (Task 8).

- [ ] **Step 2–4**
- [ ] **Step 5: Commit** `feat(msos): staff-created partner inventory and placements`

---

### Task 7: Rate card append-only + GT-01

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-rate.util.ts` + spec
- Routes: `POST /rate-cards` · `POST /rate-cards/:id/versions` · `POST /rate-cards/:id/versions/:version/publish`

**Interfaces:**

```ts
export function assertRateBindable(status: string): void {
  if (status !== 'published') throw new UnprocessableEntityException({ error: 'rate_not_published' });
}
```

Publish: set version `published`, previous published → `expired`. Không UPDATE `unit_price_vnd` của version cũ (append-only). Test: update published price → fail `rate_version_immutable`.

- [ ] **Step 5: Commit** `feat(msos): append-only rate versions and GT-01`

---

### Task 8: Capacity + conflict + GT-02

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-capacity.util.ts` + spec
- Routes: `PUT /placements/:id/capacity` (set `total_qty` theo ngày) · `GET /placements/:id/calendar?from&to`

**Interfaces:**

```ts
export type CapacityDecision =
  | { ok: true; kind: 'soft' | 'hard' | 'waitlist' }
  | { ok: false; error: 'overbook_hard' | 'partner_suspended' };

export function decideReserve(input: {
  total: number;
  reservedHard: number;
  reservedSoft: number;
  addQty: number;
  kind: 'soft' | 'hard' | 'waitlist';
  partnerStatus: string;
}): CapacityDecision
```

Rules:
- `partnerStatus === 'suspended'` → `partner_suspended`
- `kind === 'hard'` && `reservedHard + addQty > total` → `overbook_hard`
- `kind === 'soft'` && `reservedHard + reservedSoft + addQty > total` → vẫn cho soft **nhưng** service phải `insertException` P0 `capacity_conflict` (không im lặng)
- `kind === 'waitlist'` luôn ok, không cộng reserved_hard

Calendar DTO: `{ date, total, reserved_hard, reserved_soft, conflict: boolean }` với `conflict = reserved_hard + reservedSoft > total || reservedHard > total`.

- [ ] **Step 5: Commit** `feat(msos): capacity ledger with visible overbook`

---

### Task 9: Package + reservation

**Files:**
- Modify: service/repo/controller
- Routes: `GET/POST /packages` · `POST /packages/:id/reserve`

**Interfaces:**
- `createPackage({ client_id, lines: [{ placement_id, rate_version_id, qty, period_start, period_end }] })` gọi `requireClient` + `assertRateBindable`.
- `hide_buy_side` **bỏ qua / force false** nếu `!mediaOsReseller` hoặc eligibility fail (Wave 1 luôn fail C). Test: body `hide_buy_side: true` → stored false + không 500.
- Soft reserve `expires_at = now + 24h`. Hard reserve chỉ khi capacity `decideReserve` ok.
- Soft chồng hard → 200 + exception P0 (Task 8). Hard chồng hard → 422 `overbook_hard`.

List packages `[]` khi chưa có.

- [ ] **Step 5: Commit** `feat(msos): packages and reservations with C locked`

---

### Task 10: Insertion Order + brand-safety lock + GT-P01

**Files:**
- Modify: service/repo/controller
- Routes: `POST /packages/:id/io` · `GET /insertion-orders/:id` · `POST /insertion-orders/:id/issue` · `POST /insertion-orders/:id/safety-change`

**Interfaces:**

```ts
export function canIssueIo(input: {
  rateStatus: string;
  clientOk: boolean;
  hasSafetySnapshot: boolean;
  hardOrValidSoft: boolean;
}): { pass: boolean; gate: 'GT-P01'; fail?: string }
```

`issueIo`: status `issued`, append `msos_io_revisions`, **không** insert invoice. Test SQL dump không chứa `INSERT INTO crm_invoices`.

Safety change sau issue: tạo snapshot mới + revision; không silent UPDATE snapshot cũ.

Export: `GET /insertion-orders/:id/export` trả JSON IO (PDF Wave sau). UI nút “Export” tải JSON/print — đủ WIN-003 Wave 1.

- [ ] **Step 5: Commit** `feat(msos): issue insertion orders without invoices`

---

### Task 11: Media line + Publisher Live Gate (GT-03 + P01–P03)

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-gates.util.ts` + spec
- Routes: `GET/POST /media-lines` · `POST /media-lines/:id/live` · `POST /media-lines/:id/p03-override`

**Interfaces:**

```ts
export type GateResult = { id: string; pass: boolean; level: 'pass' | 'fail' | 'warning'; detail: string };

export function evaluateLiveGates(input: {
  ioIssued: boolean;
  ratePublished: boolean;
  reserveOk: boolean;
  clientOk: boolean;
  safetyLocked: boolean;
  trafficReady: boolean;
  partnerConfirmed: boolean;
  p03Override: boolean;
  trackingOwner: boolean;
}): { canLive: boolean; gates: GateResult[] }
```

`canLive` = GT-P01 pass + GT-P02 pass + (GT-P03 pass **hoặc** `p03Override`) + tracking owner (GT-03 v1.0).

`POST live` body **bắt buộc** `{ confirm: true, actor: 'human' }`. Thiếu → 422 `human_confirm_required`. Header/body `actor: 'ai'` → 403 `ai_action_forbidden`.

Cap: `@RequireMsosAction('publish')`.

Map connector: lưu `connector_external_id` text. Không gọi Graph. Deep-link Ads Ops ở UI.

- [ ] **Step 5: Commit** `feat(msos): human-only media line live gate`

---

### Task 12: Traffic pack + GT-P02

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-traffic.util.ts` + spec
- Routes: `GET/PUT /media-lines/:id/traffic` · `POST /media-lines/:id/traffic/submit`

**Interfaces:**

```ts
export function evaluateTraffic(input: {
  creativeId?: string | null;
  width?: number | null;
  height?: number | null;
  weightKb?: number | null;
  maxWeightKb?: number | null;
  clickUrl?: string | null;
  backupRequired: boolean;
  backupAttached: boolean;
  status: string;
}): { ready: boolean; reasons: string[] }
```

Ready khi: `status === 'approved_by_partner'` + `clickUrl` match `^https://` + size present + (`!maxWeightKb || weightKb <= maxWeightKb`) + (`!backupRequired || backupAttached`) + creativeId present.

Rejected / draft → Live fail.

`requireCreative` nếu `creative_id` set.

- [ ] **Step 5: Commit** `feat(msos): creative traffic pack gate`

---

### Task 13: Evidence + pack official (GT-04 / GT-P04)

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-evidence-pack.util.ts` + spec
- Routes: `POST /evidence` · `POST /evidence-packs` · `POST /evidence-packs/:id/items` · `POST /evidence-packs/:id/official`

**Interfaces:**

```ts
export const EVIDENCE_SLA_HOURS = 24;
export function isFresh(capturedAt: Date, now: Date, slaHours = EVIDENCE_SLA_HOURS): boolean
export function canOfficial(items: { hash?: string | null; capturedAt: Date; source: string }[], now: Date): boolean
```

`canOfficial` = ≥1 item có `hash` non-empty + `source` non-empty + `isFresh`.

Không bịa delivery khi không có row.

- [ ] **Step 5: Commit** `feat(msos): evidence packs with freshness and hash`

---

### Task 14: Discrepancy lite + make-good (GT-P05 / GT-P06)

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-discrepancy.util.ts` + spec
- Routes: `POST /media-lines/:id/discrepancy` · `POST /discrepancy/:id/make-good` · `POST /make-goods/:id/reserve-capacity`

**Interfaces:**

```ts
export function classifyDiscrepancy(ioQty: number, reportQty: number | null, toleranceBps: number): {
  bps: number | null;
  material: boolean;
}
export function assertNotSilentActual(planQty: number, actualQty: number, reportQty: number | null): void
```

`assertNotSilentActual`: nếu `reportQty != null && reportQty < planQty && actualQty === planQty` → 422 `actual_eq_plan_forbidden`.

Tạo DC khi staff nhập report (hoặc từ evidence qty). Không lock Finance period.

Make-good: `insert` + optional hard reserve ngày **khác** (Task 8). Close make-good = người + `crm_media.write`; AI bị chặn Task 18.

- [ ] **Step 5: Commit** `feat(msos): discrepancy and make-good without silent actuals`

---

### Task 15: Outcome links (GT-05)

**Files:**
- Routes: `GET/POST /outcome-links`
- Modify: service — `requireLead` khi `lead_id` gửi; không `lead_id` → `match_status='unmatched'`

**Interfaces:**
- Cấm INSERT leads. Test: `db.sqls` không match `/INSERT INTO leads/i`.
- List unmatched + matched từ DB thật; KPI đếm trên query, không số cứng.

- [ ] **Step 5: Commit** `feat(msos): outcome links to existing CRM ids only`

---

### Task 16: Margin waterfall + finance request (GT-06 / GT-08 / GT-P10)

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-margin.util.ts` + spec
- Routes: `GET /media-lines/:id/margin` · `POST /media-lines/:id/margin/submit` · `POST /media-lines/:id/finance-request`

**Interfaces:**

```ts
export function computeWaterfall(input: {
  grossSell: number;
  discount: number;
  mediaCost: number;
  makeGoodCost: number;
  rebateAccrued: number;
  serviceCost: number;
}): { net: number; contribution: number; contributionBps: number }

export const MARGIN_FLOOR_BPS = 2400;
export const MARGIN_BLOCK_BPS = 1800;
```

`closed: true` trên snapshot **chỉ** khi pack official (GT-P04). Rebate không cộng vào contribution (accrued display only) — `computeWaterfall` **không** trừ/cộng rebate.

`POST finance-request`:
- cap `finance_request`
- GT-P10: official pack AND (không material open OR waived)
- INSERT `msos_finance_requests` only
- Test cấm `InvoicesService` / `INSERT INTO crm_invoices`

Submit margin: CM < 1800 bps → 422 `margin_blocked`; < 2400 → 422 `margin_needs_director` trừ khi cap `admin`.

- [ ] **Step 5: Commit** `feat(msos): margin waterfall and finance request guard`

---

### Task 17: Exceptions + scorecard + eligibility lock

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-exceptions.util.ts` + spec
- Routes: `GET /exceptions` · `GET /partners/:id/scorecard` · `GET /partners/:id/eligibility` · `POST /partners/:id/scorecard/recompute`

**Interfaces:**
- `rebuildExceptions()` derive:
  - P0 `capacity_conflict` nếu calendar conflict
  - P0 `evidence_unofficial` nếu line live + pack draft/missing
  - P1 `make_good_unreserved` nếu MG `capacity_reserved=false`
  - P1 `traffic_rejected` nếu traffic rejected
- Không exception AR aging.
- Scorecard: từ DC discrepancy_bps + evidence on-time; nếu chưa có data → score `null` list empty, **không** hiện 74 cứng.
- Eligibility: `reseller_open` luôn `false` trong W1. `GET` trả `locked: true`. `POST` bật C → 403 `reseller_locked`.

- [ ] **Step 5: Commit** `feat(msos): derived exceptions and locked reseller eligibility`

---

### Task 18: AI A1 draft + A4/A5 lock

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-ai-lock.util.ts` + spec
- Create: `services/ptt-crm-api/src/msos/msos-draft.util.ts` + spec
- Route: `POST /drafts` body `{ kind: 'io' | 'traffic' | 'discrepancy', media_line_id }` → `{ text, facts, actor: 'template_a1' }` **không** mutate

**Interfaces:**

```ts
export const MSOS_AI_FORBIDDEN = ['live', 'issue_io', 'partner_confirm', 'make_good_close', 'finance_request', 'enable_reseller'] as const;
export function assertHumanMsosAction(action: string, actor: 'human' | 'ai'): void
```

`actor === 'ai'` + forbidden → 403 `ai_action_forbidden`.

Draft text interpolate **facts từ DB** (qty, report_qty, rate version). Không gọi LLM bắt buộc. Không bịa số nếu field null — viết “chưa có report”.

Audit `ai_trace_id` nullable; không log token.

- [ ] **Step 5: Commit** `feat(msos): A1 drafts and forbidden AI mutations`

---

### Task 19: FE chrome — nav, tokens, empty copy, denylist

**Files:**
- Create: `services/ops-web/src/lib/crm/msos-nav.ts`
- Create: `services/ops-web/src/lib/crm/msos-empty.ts` + spec
- Create: `services/ops-web/src/lib/crm/msos-api.ts` + spec
- Create: `services/ops-web/src/styles/msos.css`
- Create: `services/ops-web/src/components/media-os/MsosShell.tsx`
- Create: `services/ops-web/src/components/media-os/MsosEmpty.tsx`
- Create: `services/ops-web/src/components/media-os/MsosSpine.tsx`
- Create: `services/ops-web/src/app/crm/media-os/layout.tsx`
- Create: 8 `page.tsx` (command + 7 sub)
- Modify: `OpsNav.tsx`, `ops-nav-media-os.ts`, `delivery-module-nav.ts`, `rbac-routes.ts`

**Interfaces:**

```ts
export const MSOS_NAV = [
  { screen: 'command', href: '/crm/media-os', label: 'Command Center', glyph: '▦' },
  { screen: 'inventory', href: '/crm/media-os/inventory', label: 'Inventory & Rate', glyph: '▣' },
  { screen: 'packages', href: '/crm/media-os/packages', label: 'Packages', glyph: '◫' },
  { screen: 'campaigns', href: '/crm/media-os/campaigns', label: 'Campaigns', glyph: '▶' },
  { screen: 'evidence', href: '/crm/media-os/evidence', label: 'Evidence', glyph: '▤' },
  { screen: 'outcomes', href: '/crm/media-os/outcomes', label: 'Outcomes', glyph: '⌁' },
  { screen: 'margin', href: '/crm/media-os/margin', label: 'Margin & Deal', glyph: '₫' },
  { screen: 'settings', href: '/crm/media-os/settings', label: 'Governance', glyph: '⚙' },
] as const;

export const MSOS_EMPTY = {
  command: 'Chưa có ngoại lệ. Tạo inventory và booking trên các màn Inventory / Packages.',
  inventory: 'Chưa có placement. Tạo inventory PTT hoặc property publisher của partner thật.',
  packages: 'Chưa có package. Chọn placement đã có rate published và client CRM thật.',
  campaigns: 'Chưa có media line.',
  evidence: 'Chưa có evidence pack.',
  outcomes: 'Chưa có outcome link. Chỉ gắn lead/sale ID đã có trên CRM.',
  margin: 'Chưa có waterfall. Mở sau khi có media line.',
  settings: 'Chưa có partner để chấm scorecard.',
} as const;

export const MSOS_UI_DENYLIST = [
  'CL-1042', 'IO-VNE-0912', 'PKG-2026-048', 'PKG-2026-051', 'PKG-2026-044',
  'publisher-pilot.example', 'Sunlight', 'Nova Home', 'Tâm An', 'Admicro',
  'ML-2026-0912-VNE', 'WIN · A',
] as const;
```

Vitest:

```ts
it('empty copy has no demo ids', () => {
  const blob = JSON.stringify(MSOS_EMPTY);
  for (const n of MSOS_UI_DENYLIST) expect(blob).not.toContain(n);
});
```

`shouldShowMediaOsNav(user) = isMediaOsFeEnabled() && canViewMediaOs(user)`.

`msosFetch(token, path, init)` → `${API_BASE}/api/crm/media-os${path}` Bearer, `cache: 'no-store'`. 404 `media_os_disabled` → UI “Media OS chưa bật”.

`msos.css` copy token từ mockup WIN `:root` (nav, blue, green, amber, red, radius 14px, Inter). Sidebar 258px. **Không** `.winbar`.

Shell: 8 nav + nhóm “Tham chiếu” deep-link `/crm/clients`, `/crm/creative-os`, `/crm/financials` (anchor, không embed). Help: “MSOS sở hữu inventory… Client / Lead / Invoice chỉ deep-link.”

Layout import `msos.css` + `MsosShell`. Mỗi `page.tsx` chỉ mount 1 screen component (Task 20). Tạm thời screen = `<MsosEmpty title="…" copy={MSOS_EMPTY.*} />` để route sống + test denylist.

`PATH_CAP_RULES`: `{ prefix: '/crm/media-os', anyOf: [view, write, publish, admin].map(...) }`.

- [ ] **Step 5: Commit** `feat(msos): Media OS chrome and empty routes`

---

### Task 20: Tám màn parity mockup — bind API thật

**Files:**
- Create: 8 component files listed in file map
- Create: `services/ops-web/src/lib/crm/msos-gates-ui.ts` + spec
- Create: `services/ops-web/src/lib/crm/msos-screens.spec.ts` (denylist scan source)
- Create: `services/ops-web/src/styles/msos.css` additions (table `.msos-t`, `.msos-tag`, `.msos-gate`, `.msos-cal` = class names mockup)

**Interfaces:**

```ts
export function canEnableLiveButton(gates: { id: string; pass: boolean }[]): boolean {
  return gates.some((g) => g.id === 'GT-P01' && g.pass) &&
    gates.some((g) => g.id === 'GT-P02' && g.pass);
}
export function canEnableInvoiceButton(input: { packOfficial: boolean; discrepancyBlock: boolean }): boolean {
  return input.packOfficial && !input.discrepancyBlock;
}
```

Mỗi màn:
1. `useEffect` + `msosFetch` list/detail.
2. Nếu `[]` → `MsosEmpty` đúng copy Task 19.
3. Nếu có row → table/card **cùng hierarchy mockup** (head, spine, kpi, layout 2 cột, tag màu). KPI đếm từ payload (`lines.length`), không literal `6` / `29,4%`.
4. Modal tạo: form field thật (tên, UUID client, placement id từ dropdown API). Submit POST. Toast lỗi 422.
5. Campaigns: checklist GT-P01–P03 từ `GET /media-lines/:id/gates`. Nút Live `disabled` khi `!canEnableLiveButton`. Confirm modal `{ confirm: true }`.
6. Packages: “Tạo IO” gọi issue; conflict → toast `overbook_hard` / P0, không fake success.
7. Inventory: calendar từ `GET .../calendar` — ô conflict class `.slot.conflict` như mockup.
8. Evidence: pack status + DC + MG từ API.
9. Margin: waterfall rows từ `compute` API; dòng make-good chỉ render nếu `make_good_cost_vnd > 0`. Request invoice disabled theo `canEnableInvoiceButton`.
10. Governance: flags từ `/health`; policy từ `GET /policies`; scorecard từ API hoặc empty; C `tag.lock` + button disabled.
11. Outcomes: deep-link `/crm/leads/:id` khi matched.
12. Command: `GET /exceptions` — không AR.

Denylist scan:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
const files = [/* 8 component paths */];
for (const f of files) {
  const src = readFileSync(join(process.cwd(), f), 'utf8');
  for (const n of MSOS_UI_DENYLIST) expect(src).not.toContain(n);
}
```

Parity checklist (gắn comment đầu mỗi component): class names `msos-head`, `msos-spine`, `msos-kpi5`, `msos-layout`, `msos-notice`, `msos-ai` (AI card chỉ hiện khi `GET /drafts` preview — không chat). §4 chips `msos-spine em.lock` luôn 4 chip: Write connector · Cổng C · Recon sâu · Portal.

- [ ] **Step 5: Commit** `feat(msos): bind eight Media OS screens to live APIs`

---

### Task 21: Acceptance + deploy (flag off, no seed)

**Files:**
- Create: `services/ptt-crm-api/src/msos/msos-acceptance.spec.ts`
- Create: `services/ops-web/src/lib/crm/msos-acceptance.spec.ts`
- Create: `scripts/deploy_msos_w1_vps.sh`

**Interfaces:** Acceptance = in-process service với repo fake/pg test, **không** HTTP browser bắt buộc trong task này.

Jest cases (fixture synthetic, không tên cấm):
1. Flag off → `assertEnabled` throws `media_os_disabled`.
2. Booking happy path **in memory/pg**: create partner+ptt inventory+publisher placement+rate publish+package+hard reserve+issue IO+traffic approve+human live+evidence official+finance request **cùng `media_line_id`**.
3. Hard+hard cùng ngày → `overbook_hard`.
4. Report 282 / plan 300 → material DC; `actual=300` → `actual_eq_plan_forbidden`.
5. Finance request khi pack draft → 422 `evidence_not_official`.
6. AI actor live → `ai_action_forbidden`.
7. `hide_buy_side` ignored.
8. SQL never `INSERT INTO clients|leads|crm_invoices`.
9. Connector write endpoint **không tồn tại** (404) hoặc 403 `connector_write_locked`.

Vitest: denylist + empty copy + live/invoice button helpers.

`scripts/deploy_msos_w1_vps.sh`:
- apply DDL
- build api + ops-web
- echo “Do NOT set PTT_MEDIA_OS_ENABLED / NEXT_PUBLIC_MEDIA_OS unless pilot”
- **không** `\copy` / INSERT partners

Pilot UAT tay (không automate prod): staff tạo property thật → một booking. Ghi vào runbook 5 dòng cuối script comment.

- [ ] **Step 5: Commit** `feat(msos): acceptance locks and flag-off deploy script`

---

## UAT tay (sau khi flag on **staging**, không prod seed)

1. Grant `crm_media.*` cho 1 staff qua Admin IAM.
2. Bật `PTT_MEDIA_OS_ENABLED=1` và `NEXT_PUBLIC_MEDIA_OS=1` **chỉ staging**.
3. Mở `/crm/media-os` — 8 màn empty, không hàng mockup.
4. Tạo partner thật + inventory PTT + 1 property publisher (hostname thật) + rate publish + capacity tuần.
5. Package + hard reserve + Issue IO + traffic (creative_id Creative OS thật hoặc 422) + Live.
6. Cố reserve hard chồng → lỗi, Command hiện P0.
7. Upload evidence hash + official → request Finance (deep-link), 0 số HĐ trên MSOS.
8. Tắt flag → nav biến mất, `/api/crm/media-os/health` 404, `/meta/ads-ops` vẫn vào.

---

## Ngoài plan này

§4.1 connector write · §4.2 cổng C sống · §4.3 recon-close đủ · §4.4 portal · DSP · PDF IO có chữ ký số · push ad server VnExpress/Admicro · incrementality.

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| MSOS-FR-001…004 inventory/rate/package | 6–9 |
| MSOS-FR-005 line Live | 11 |
| MSOS-FR-006 evidence | 13 |
| MSOS-FR-007 outcome | 15 |
| MSOS-FR-008…009 margin/wallet | 16 |
| MSOS-FR-010…012 scorecard/command/governance | 17, 19–20 |
| MSOS-FR-013 AI lock | 18 |
| WIN-001…010 | 6–16 |
| GT-01…08 + GT-P* | 7–16 |
| BG-WIN-01…06 / BR-* | 21 + constraints |
| UI 8 màn + empty + no demo | 19–20 |
| Flag off / no URL break | 2, 4, 21 |
