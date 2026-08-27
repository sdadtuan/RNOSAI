# Wave 1 — SQLite-only modules → PostgreSQL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Các module Nest còn đọc `ptt.db` chuyển sang PostgreSQL; service không còn nhánh SQLite fallback.

**Architecture:** Clone pattern `CatalogPgRepository` (`Pool` + `ensureSchema` + `OnModuleDestroy`). Service inject PG repo only. Bảng đã có trên PG (`crm_customers` từ contract promote) thì `ALTER` thêm cột — không `CREATE` bảng mới trùng tên. VPS hiện không có `ptt.db`: không viết job migrate data trừ khi file xuất hiện. Worker Python còn mở SQLite xử lý ở Task 11.

**Tech Stack:** NestJS  `services/ptt-crm-api`, `pg` Pool, Jest (`*.spec.ts` cạnh repo), PostgreSQL production `/var/www/rnosai`.

## Global Constraints

- Không mở `node:sqlite` / `DatabaseSync` / `PTT_SQLITE_PATH` trên đường request của module đã cutover
- Không dual-read (cấm `usePg ? pg : sqlite` trên module Wave 1 — cutover cứng)
- Tên bảng giữ nguyên `crm_*` để contract/lifecycle/finance join được
- ID integer giữ `SERIAL` / existing sequence — không đổi sang UUID
- Timestamp text ISO như `catalogTs()` hoặc `timestamptz` map ra string ISO khi trả API
- Copy method public 1-1 từ `*-sqlite.repository.ts` (cùng tên, cùng type trong `*.types.ts`)
- Test trước, code sau. Commit theo từng module khi user yêu cầu
- Deploy VPS: copy `services/ptt-crm-api` + `npm run build` + `systemctl restart ptt-crm-api`. Không `git reset --hard` nếu ingest PG-only chưa push
- Wave 0 flags (payroll/funnel/SOP…) không thuộc plan này

---

## File map (toàn Wave 1)

| Module | Tạo PG repo | Sửa service / module | Test |
|--------|-------------|----------------------|------|
| Kit | `src/config/app-config.service.ts` (không thêm flag fallback) | — | `src/persistence/pg-repo.playbook.spec.ts` |
| Customers | `src/customers/customers-pg.repository.ts` | `customers.service.ts`, `customers.module.ts` | `customers-pg.repository.spec.ts` |
| Tickets | `src/tickets/tickets-pg.repository.ts` | `tickets.service.ts`, `tickets.module.ts` | `tickets-pg.repository.spec.ts` |
| Cases | `src/cases/cases-pg.repository.ts` | `cases.service.ts`, `cases.module.ts` | `cases-pg.repository.spec.ts` |
| Orders | `src/orders/orders-pg.repository.ts` | `orders.service.ts`, `orders.module.ts` | `orders-pg.repository.spec.ts` |
| Invoices | `src/invoices/invoices-pg.repository.ts` | `invoices.service.ts`, `invoices.module.ts` | `invoices-pg.repository.spec.ts` |
| Sales | `src/sales/sales-pg.repository.ts` | `sales.service.ts`, `sales.module.ts` | `sales-pg.repository.spec.ts` |
| Proposals | `src/proposals/proposals-pg.repository.ts` | `proposals.service.ts`, `proposals.module.ts`, `lead-meeting-prep.service.ts`, `deal-room.service.ts` | `proposals-pg.repository.spec.ts` |
| Marketing plans | `src/marketing-plans/marketing-plans-pg.repository.ts` | `marketing-plans.service.ts`, `marketing-plans.module.ts`, `market-research.service.ts` | `marketing-plans-pg.repository.spec.ts` |
| CRM config | `src/crm-config/crm-config-pg.repository.ts` | `crm-config.service.ts`, `crm-config.module.ts` | `crm-config-pg.repository.spec.ts` |
| Owner weekly | `src/owner-weekly/owner-weekly-pg.repository.ts` | `owner-weekly.service.ts`, `owner-weekly.module.ts` | `owner-weekly-pg.repository.spec.ts` |
| Re-projects | `src/re-projects/re-projects-pg.repository.ts` | `re-projects.service.ts` + accounting/ops nếu inject sqlite | `re-projects-pg.repository.spec.ts` |
| Worker | `ptt_jobs/handlers/form_ingest.py`, `ptt_crm/lead_ingest_config.py` | không hydrate SQLite khi PG | `tests/test_lead_ingest_config.py` |

Xóa `*-sqlite.repository.ts` **sau khi** module đó xanh trên VPS (cuối mỗi task, bước delete). Wave 2 mới cấm `PTT_SQLITE_PATH` toàn repo.

---

## Playbook (mọi task module)

1. Đọc `*-sqlite.repository.ts`: liệt kê method public + `CREATE TABLE`.
2. Jest: mock `Pool.query` **hoặc** test schema SQL string + service không import sqlite (prefer: repo method với fake pool như catalog tests nếu có; không thì test service wiring).
3. `customers-pg.repository.ts` (và anh em): copy skeleton:

```ts
@Injectable()
export class CustomersPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  constructor(private readonly config: AppConfigService) {}
  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }
  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}
```

4. `ensureSchema`: `CREATE TABLE IF NOT EXISTS` chỉ khi bảng chưa có; với `crm_customers` dùng `ALTER ... ADD COLUMN IF NOT EXISTS`.
5. Service: thay constructor sqlite → pg; xóa import `*-sqlite`.
6. Module: providers/exports PG, bỏ SQLite.
7. Grep module: `DatabaseSync`, `sqlitePath`, `SqliteRepository` phải 0.
8. `npm test -- --testPathPattern=<module>` trong `services/ptt-crm-api`.
9. Smoke: `GET` list + `POST` create trên staging/VPS.

Thứ tự bắt buộc: **Customers → Tickets → Cases → Orders+Invoices → Sales → Proposals → Marketing plans → CRM config → Owner weekly → Re-projects**. Tickets/Cases/Orders FK `customer_id`.

---

### Task 0: Kit — không thêm flag SQLite, ghi convention vào config comment

**Files:**
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` (chỉ comment gần `sqlitePath` — không đổi default)
- Create: `services/ptt-crm-api/src/persistence/wave1-pg.constants.ts`

**Interfaces:**
- Consumes: `AppConfigService.databaseUrl`
- Produces: `WAVE1_PG_MODULES` string list để grep/test

- [ ] **Step 1: Write the failing test**

Create `services/ptt-crm-api/src/persistence/wave1-pg.constants.spec.ts`:

```ts
import { WAVE1_PG_MODULES } from './wave1-pg.constants';

describe('WAVE1_PG_MODULES', () => {
  it('lists every sqlite-only nest module to cut over', () => {
    expect(WAVE1_PG_MODULES).toEqual([
      'customers',
      'tickets',
      'cases',
      'orders',
      'invoices',
      'sales',
      'proposals',
      'marketing-plans',
      'crm-config',
      'owner-weekly',
      're-projects',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/persistence/wave1-pg.constants.spec.ts --no-coverage`

Expected: FAIL `Cannot find module './wave1-pg.constants'`

- [ ] **Step 3: Write minimal implementation**

```ts
export const WAVE1_PG_MODULES = [
  'customers',
  'tickets',
  'cases',
  'orders',
  'invoices',
  'sales',
  'proposals',
  'marketing-plans',
  'crm-config',
  'owner-weekly',
  're-projects',
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: same jest command. Expected: PASS

- [ ] **Step 5: Commit** (khi user yêu cầu)

```bash
git add services/ptt-crm-api/src/persistence/wave1-pg.constants.ts services/ptt-crm-api/src/persistence/wave1-pg.constants.spec.ts
git commit -m "Add Wave 1 PG cutover module list."
```

---

### Task 1: Customers (template cutover)

**Files:**
- Create: `services/ptt-crm-api/src/customers/customers-pg.repository.ts`
- Create: `services/ptt-crm-api/src/customers/customers-pg.repository.spec.ts`
- Modify: `services/ptt-crm-api/src/customers/customers.service.ts`
- Modify: `services/ptt-crm-api/src/customers/customers.module.ts`
- Read: `customers-sqlite.repository.ts`, `customers.types.ts`, `leads-contract-pg.repository.ts` (bảng `crm_customers` đã tồn tại)

**Interfaces:**
- Consumes: `CreateCustomerBody`, `CustomerRow`, `listCustomers(q, limit)`, `getCustomerById`, `createCustomer`, `patchCustomer`, relations/purchases/issues/brief
- Produces: cùng shape JSON API hiện tại (`{ customers }`, `{ customer, relations, purchases, issues, stats }`)

Cột profile phải `ALTER` trên PG nếu thiếu (contract chỉ có name/phone/email/address/company/created_at/placeholder):

`lead_source`, `lead_source_note`, `date_of_birth`, `gender`, `id_number`, `occupation`, `interests`, `profile_notes`

Bảng phụ: `crm_customer_relations`, `crm_customer_purchases`, `crm_customer_issues`, `crm_customer_brief_scans` — copy DDL từ sqlite repo, đổi `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`, `TEXT` → `VARCHAR`/`TEXT`, FK `customer_id` → `crm_customers(id) ON DELETE CASCADE`.

- [ ] **Step 1: Write the failing test**

```ts
import { CustomersService } from './customers.service';
import { CustomersModule } from './customers.module';

describe('CustomersModule Wave 1', () => {
  it('does not import sqlite repository', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, 'customers.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/CustomersSqliteRepository/);
    expect(src).toMatch(/CustomersPgRepository/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/customers/customers-pg.repository.spec.ts --no-coverage`

Expected: FAIL — service vẫn import `CustomersSqliteRepository`

- [ ] **Step 3: Implement PG repo + wire service**

`ensureSchema` (rút gọn — đủ cột list/create):

```sql
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lead_source VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lead_source_note TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS id_number VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS occupation VARCHAR(240) NOT NULL DEFAULT '';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS interests TEXT NOT NULL DEFAULT '';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS profile_notes TEXT NOT NULL DEFAULT '';
```

`listCustomers`: `SELECT ... FROM crm_customers WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1 ORDER BY id DESC LIMIT $2`.

Service constructor:

```ts
constructor(
  private readonly pg: CustomersPgRepository,
  private readonly timeline: CustomerTimelineService,
) {}
```

Mọi `this.sqlite.` → `this.pg.`. Module providers: `CustomersPgRepository` only.

- [ ] **Step 4: Run tests**

Run: `cd services/ptt-crm-api && npx jest src/customers --no-coverage`

Expected: PASS. Grep `customers.service.ts` không còn `Sqlite`.

- [ ] **Step 5: VPS smoke**

`GET /api/v1/customers` (hoặc path hiện tại trên controller) → 200, `customers: []` nếu chưa có data. `POST` một khách test (SĐT nội bộ) → hiện trên `/crm/customers`.

- [ ] **Step 6: Commit** (khi user yêu cầu)

```bash
git add services/ptt-crm-api/src/customers
git commit -m "Serve CRM customers from PostgreSQL only."
```

---

### Task 2: Tickets

**Files:**
- Create: `services/ptt-crm-api/src/tickets/tickets-pg.repository.ts`
- Create: `services/ptt-crm-api/src/tickets/tickets-pg.repository.spec.ts`
- Modify: `tickets.service.ts`, `tickets.module.ts`
- Read: `tickets-sqlite.repository.ts` (`crm_tickets`, `crm_ticket_messages` + sentiment columns)

**Interfaces:**
- Consumes: `list`, `getById`, `create`, `patch`, messages, `UpdateTicketSentimentInput` (AI sentiment)
- Produces: `TicketRow` / `TicketMessageRow` không đổi

DDL PG:

```sql
CREATE TABLE IF NOT EXISTS crm_tickets (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES crm_customers(id),
  ticket_type VARCHAR(64) NOT NULL DEFAULT 'phan_anh',
  status VARCHAR(32) NOT NULL DEFAULT 'moi',
  priority VARCHAR(32) NOT NULL DEFAULT 'binh_thuong',
  channel VARCHAR(32) NOT NULL DEFAULT 'khac',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  assigned_staff_id INTEGER,
  sentiment_label VARCHAR(64) NOT NULL DEFAULT '',
  sentiment_score INTEGER,
  sentiment_confidence DOUBLE PRECISION,
  sentiment_scored_at VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS crm_ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES crm_tickets(id) ON DELETE CASCADE,
  author_staff_id INTEGER,
  body TEXT NOT NULL DEFAULT '',
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 1: Failing test** — `tickets.service.ts` must import `TicketsPgRepository` not sqlite (cùng pattern Task 1).
- [ ] **Step 2: Jest fail** — `npx jest src/tickets/tickets-pg.repository.spec.ts --no-coverage`
- [ ] **Step 3: Implement + wire** — `TicketsService` chỉ `TicketsPgRepository`. `is_internal` sqlite `0/1` → PG `boolean`, map ra number/boolean đúng `TicketMessageRow`.
- [ ] **Step 4: Jest pass** + grep 0 `TicketsSqliteRepository` trong service/module.
- [ ] **Step 5: Smoke** `/crm/tickets` list + tạo ticket gắn customer Task 1.
- [ ] **Step 6: Commit** `Serve CRM tickets from PostgreSQL only.`

---

### Task 3: Cases

**Files:**
- Create: `src/cases/cases-pg.repository.ts`, `cases-pg.repository.spec.ts`
- Modify: `cases.service.ts`, `cases.module.ts`
- Read: `cases-sqlite.repository.ts`; `crm_cases` có thể đã được contract/lifecycle tạo trên PG — `CREATE IF NOT EXISTS` rồi `ALTER` cột pipeline.

**Interfaces:**
- Consumes: list/get/create/patch/assign của `CasesService`
- Produces: cùng row type hiện tại

- [ ] **Step 1–6:** Playbook Task 1. Commit: `Serve CRM cases from PostgreSQL only.`

Kiểm tra `information_schema.columns` trên VPS trước DDL để không phá row contract đang dùng.

---

### Task 4: Orders + Invoices (cùng billing)

**Files:**
- Create: `src/orders/orders-pg.repository.ts`, `src/invoices/invoices-pg.repository.ts` + spec
- Modify: `orders.service.ts`, `orders.module.ts`, `invoices.service.ts`, `invoices.module.ts`
- Read: `src/billing/billing-schema.util.ts` (DDL nguồn)
- Create: `src/billing/billing-schema-pg.util.ts` — bản PG của `ensureBillingSchema`

**Interfaces:**
- Consumes: `crm_orders`, `crm_order_lines`, `crm_invoices`, `crm_invoice_lines`; optional `crm_svc_payments.invoice_id` nếu bảng payments đã PG
- Produces: API orders/invoices không đổi

DDL: dịch `billing-schema.util.ts` sang PG (`SERIAL`, `INTEGER` money giữ VND nguyên, `REFERENCES crm_customers(id)`).

- [ ] **Step 1:** Test `invoices.module.ts` + `orders.module.ts` không import sqlite.
- [ ] **Step 2:** Jest fail.
- [ ] **Step 3:** Implement cả hai repo (cùng PR/task — invoice cần `order_id`).
- [ ] **Step 4:** `npx jest src/orders src/invoices src/billing --no-coverage`
- [ ] **Step 5:** Smoke tạo order + invoice draft trên UI.
- [ ] **Step 6:** Commit `Serve CRM orders and invoices from PostgreSQL only.`

---

### Task 5: Sales

**Files:**
- Create: `src/sales/sales-pg.repository.ts` + spec
- Modify: `sales.service.ts`, `sales.module.ts`
- Read: `sales-sqlite.repository.ts` (bảng/query hiện tại)

**Interfaces:**
- Consumes: dashboard/list methods trên `SalesService`
- Produces: cùng JSON

Nếu Sales chỉ aggregate từ `crm_leads` / `crm_customers` / `crm_orders` đã PG: repo PG query các bảng đó, **không** tạo bảng mới.

- [ ] **Step 1–6:** Playbook. Commit: `Serve CRM sales views from PostgreSQL only.`

---

### Task 6: Proposals + quote lines

**Files:**
- Create: `src/proposals/proposals-pg.repository.ts` + spec
- Modify: `proposals.service.ts`, `proposals.module.ts`
- Modify: `src/lead-meeting-prep/lead-meeting-prep.service.ts` (`ProposalsSqliteRepository` → PG)
- Modify: `src/deal-room/deal-room.service.ts` nếu import sqlite proposals/leads
- Read: `proposals-sqlite.repository.ts` (`crm_proposals`, `crm_quote_line_item`)

**Interfaces:**
- Consumes: list/get/create/patch proposal, quote lines, export PDF (buffer không đổi)
- Produces: `ProposalRow` giữ nguyên

DDL:

```sql
CREATE TABLE IF NOT EXISTS crm_proposals (
  id SERIAL PRIMARY KEY,
  -- copy cột từ proposals-sqlite.repository.ts ensureSchema
);
CREATE TABLE IF NOT EXISTS crm_quote_line_item (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE
);
```

Mở file sqlite và copy **đủ cột** — không rút cột. `lead_id` / `customer_id` integer nullable.

- [ ] **Step 1:** Spec: `proposals.service.ts` + `lead-meeting-prep.service.ts` không chứa `ProposalsSqlite`.
- [ ] **Step 2–6:** Playbook. Smoke `/crm` đề xuất + tạo quote. Commit: `Serve CRM proposals from PostgreSQL only.`

---

### Task 7: Marketing plans

**Files:**
- Create: `src/marketing-plans/marketing-plans-pg.repository.ts` + spec
- Modify: `marketing-plans.service.ts`, `marketing-plans.module.ts`
- Modify: `src/market-research/market-research.service.ts` (inject `MarketingPlansSqliteRepository` → PG)
- Read: sqlite SELECT `crm_marketing_plans`, `crm_marketing_plan_campaigns`, `crm_marketing_plan_milestones`; schema có thể nằm `leads-funnel-sqlite.repository.ts`

**Interfaces:**
- Consumes: `listPlans`, `getPlanById`, `createPlan`, `patchPlan`, milestones, campaigns
- Produces: `MarketingPlanRow` + counts `linked_campaign_count`, `milestone_total`, `milestone_done`

Join `crm_staff` đã PG (`PTT_CRM_STAFF_PG`).

- [ ] **Step 1–6:** Playbook. Smoke list plan + Market Research gắn plan. Commit: `Serve marketing plans from PostgreSQL only.`

---

### Task 8: CRM config (lookup / pipeline / custom fields)

**Files:**
- Create: `src/crm-config/crm-config-pg.repository.ts` + spec
- Modify: `crm-config.service.ts`, `crm-config.module.ts`
- Read: `crm-config-sqlite.repository.ts` (`crm_custom_field_defs`, `crm_pipeline_stages`, `crm_lead_lookup_options`)

**Interfaces:**
- Consumes: list/update lookup options (source/channel), pipeline stages, custom fields
- Produces: API admin config không đổi

Không nhầm với `CRM_FACEBOOK_PAGE_ACCESS_TOKEN` trên `.env`. Facebook page/form B2B đã ở `crm_b2b_project_pages`. Task này chỉ bảng config UI.

- [ ] **Step 1–6:** Playbook. Smoke `/crm` filter source/channel vẫn load options. Commit: `Serve CRM config lookups from PostgreSQL only.`

---

### Task 9: Owner weekly

**Files:**
- Create: `src/owner-weekly/owner-weekly-pg.repository.ts` + spec
- Modify: `owner-weekly.service.ts`, `owner-weekly.module.ts`
- Read: `owner-weekly.util.ts` (`crm_owner_cash_snapshots`); `ops-weekly-pg.repository.ts` đã PG cho ops weekly — **không gộp** hai domain

**Interfaces:**
- Consumes: snapshot cash methods hiện tại
- Produces: cùng DTO

- [ ] **Step 1–6:** Playbook. Commit: `Serve owner-weekly snapshots from PostgreSQL only.`

---

### Task 10: Re-projects (cuối — file sqlite ~1600 dòng)

**Files:**
- Create: `src/re-projects/re-projects-pg.repository.ts` (có thể tách `re-projects-facebook-pg.repository.ts` nếu >800 dòng)
- Modify: `re-projects.service.ts`, `re-projects.module.ts`, `re-projects-accounting.repository.ts` nếu mở sqlite
- Read: `re-projects-sqlite.repository.ts` tables: `crm_re_project_staff`, `crm_re_project_lead_config`, `crm_re_project_facebook_forms`, `crm_re_project_zalo_campaigns`, `crm_re_project_website_routes`, cash flow

**Interfaces:**
- Consumes: mọi method public sqlite repo (list projects, staff, facebook forms, zalo, website routes)
- Produces: API RE không đổi

Cấm rewrite UI. Chỉ đổi persistence. B2B `crm_b2b_*` **không đụng**.

- [ ] **Step 1:** Test module không import `ReProjectsSqliteRepository`.
- [ ] **Step 2:** Jest fail.
- [ ] **Step 3:** Port method theo nhóm (projects → staff → channels → accounting). Mỗi nhóm một commit nếu user cho phép nhiều commit.
- [ ] **Step 4:** `npx jest src/re-projects --no-coverage`
- [ ] **Step 5:** Smoke màn RE còn dùng (nếu PTT còn bật RE).
- [ ] **Step 6:** Commit `Serve RE projects from PostgreSQL only.`

---

### Task 11: Worker / Python — không mở file SQLite khi write source = pg

**Files:**
- Modify: `ptt_jobs/handlers/form_ingest.py` — nếu `leads_write_source_pg()` thì gọi PG ingest, không `sqlite3.connect`
- Modify: `ptt_crm/form_lead_ingest.py` — nhánh PG hoặc fail closed
- Modify: `ptt_crm/lead_ingest_config.py` — `open_ingest_rules_conn` khi `ingest_rules_from_pg()` không `_hydrate_rules_conn_from_snapshot` nếu caller Wave 1 không cần; tối thiểu: không `_open_sqlite_readonly`
- Modify: `ptt_crm/lead_sync.py` / `lead_shadow_sync.py` — no-op khi `PTT_LEAD_SHADOW_SYNC=0` (đã vậy thì chỉ harden)
- Test: `tests/test_lead_ingest_config.py` (đã có `test_open_ingest_rules_conn_pg_never_opens_sqlite_file`)
- Test: thêm `tests/test_form_ingest_pg.py` — `form_ingest` với `PTT_LEADS_WRITE_SOURCE=pg` không gọi `sqlite3.connect`

- [ ] **Step 1: Failing test**

```python
from unittest.mock import patch
import os

@patch.dict(os.environ, {"PTT_LEADS_WRITE_SOURCE": "pg"}, clear=False)
@patch("sqlite3.connect", side_effect=AssertionError("SQLite forbidden"))
def test_form_ingest_pg_does_not_open_sqlite(mock_connect):
    from ptt_jobs.handlers import form_ingest
    # invoke the handler entry that would have opened sqlite
    ...
```

Viết đúng theo signature `run_form_ingest_job` / hàm public trong `form_ingest.py` (đọc file trước khi patch).

- [ ] **Step 2:** `python3 -m unittest tests.test_form_ingest_pg -v` → FAIL (vẫn connect).
- [ ] **Step 3:** PG path only.
- [ ] **Step 4:** unittest PASS.
- [ ] **Step 5:** Restart `ptt-worker` trên VPS.
- [ ] **Step 6:** Commit `Keep form ingest on PostgreSQL when write source is pg.`

---

### Task 12: Definition of done Wave 1

**Files:** không code mới trừ checklist

Grep từ repo root (bỏ `node_modules`, `releases`, `tests`, `*.spec.ts`):

```bash
rg -n "DatabaseSync|PTT_SQLITE_PATH|SqliteRepository" services/ptt-crm-api/src \
  --glob '!*sqlite*' --glob '!*spec.ts' \
  | rg -v "catalog-sqlite|leads/sqlite-leads|funnel-sqlite|contract-sqlite|intake-sqlite|payroll-sqlite|kpi-sqlite|sop-sqlite|finance-sqlite|svc-finance-sqlite|crm-staff-sqlite|crm-leads-sqlite|service-lifecycle-sqlite"
```

Wave 1 xong khi **11 module** ở `WAVE1_PG_MODULES` không còn `*SqliteRepository` trong `*.service.ts` / `*.module.ts` tương ứng.

Smoke VPS:

| Màn | URL | Pass |
|-----|-----|------|
| Khách hàng | `/crm/customers` | list + tạo |
| Ticket | `/crm/tickets` | list + tạo |
| Case | path CSKH cases | list |
| Order / Invoice | màn billing | tạo draft |
| Đề xuất | proposals | tạo |
| Marketing plan | plans | list |
| Lead B2B | `/crm/b2b/leads` | lead #5 vẫn còn |

---

## Ngoài scope (Wave 2)

- Xóa mọi `*-sqlite.repository.ts` dual (intake, funnel, payroll, sop…)
- Xóa `PTT_SQLITE_PATH`, `crm_sqlite.py`
- CI `rbac_no_sqlite_gate.sh` mở rộng toàn Nest
- SEO `SEO_AEO_DB=pg` nếu chưa bật (Wave 0)

## Self-review

- 9 module SQLite-only + worker + DoD đều có task
- Customers ghi rõ ALTER trên bảng contract — không tạo `crm_customers` thứ hai
- Orders/Invoices một task vì FK
- Re-projects cuối, được phép tách commit
- Không placeholder TBD; playbook + DDL/test mẫu đủ để agent làm Task 1–2 rồi clone
