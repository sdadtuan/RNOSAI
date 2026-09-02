# CSD Report MVP Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng toàn bộ **D. Báo cáo — MVP còn thiếu** trên `/crm/csd/reports`: workflow đủ, version + changelog, 4 template, block (KPI/chart/file/rollup), comment theo section, PDF/Excel thật, gửi email có retry, lịch, share vào Client Chat, admin CRUD template — không Ads/GA4, không portal, không AI draft report.

**Architecture:** Mở rộng `CsdReportsService` trên `csd_reports` / `csd_report_versions` / `csd_report_templates` / `csd_report_send_logs` / `csd_report_schedules` đã có. Thêm `csd_report_comments`. PDF = `pdfkit` (đã có trong `ptt-crm-api`). Excel = `exceljs` (đã có). SMTP tái dùng `CsdEmailService.send` — **chỉ** `status=sent` khi email `result=sent`. Worker lịch theo pattern `CsdSlaWorkerService` (setInterval + skip-locked).

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL `csd_*` · disk `data/csd-files` · Jest · Playwright mock.

## Global Constraints

- Prefix `/api/crm/csd`. Cấm ghi `crm_tickets` / `ceo_command_turns`.
- Staff id = **INTEGER** JWT `staffId` qua `resolveCrmStaffUserId`. `tenant_id='PTT'`.
- Copy UI tiếng Việt (UX §7 / §9). Không badge Stub.
- `PTT_CSD_LLM` giữ `0` trên VPS. **Không** làm UC-RPT-12 AI draft report.
- G3: 100% bản `Sent` có `current_version` + `csd_report_send_logs`; 0 overwrite bản đã gửi.
- Weekly Ops (`weekly_ops.requires_approval=false`) gửi thẳng từ Draft. Monthly / SLA / Executive bắt buộc `approved` (hoặc cap `csd.manage` bypass — audit).
- Kênh gửi MVP: Email + PDF. Chat share = slice R-4. Portal / Viewed / Acknowledged = P2.
- Deploy: `APPLY=1 ./scripts/deploy_csd_vps.sh` rồi HUP `ptt-crm-api` + `ptt-ops-web`. Không bật `PTT_CSD_LLM`.

## Đã có (không làm lại)

- DDL 4 template seed, `csd_reports` status check, versions, send_logs, schedules.
- Service skeleton: `createReport` v1.0, `submitReview`, `approve`, `send` (đánh dấu sent **không** SMTP), `updateSections` (409 nếu sent), `createRevisedVersion` (chỉ khi sent, luôn `vN+1.0`).
- Jest: send-before-approve 409; sent immutable; weekly_ops gửi không director.
- UI list + editor 4 mục cứng + modal gửi — **list API chưa có**, `GET :id` không trả `sections_json`.

## Hiện trạng gãy (phải vá trong R-1)

| Lỗi | File |
|-----|------|
| `GET /api/crm/csd/reports` không tồn tại → list 404 | `csd-reports.controller.ts` |
| `get()` không trả `sections_json` / `versions` | `csd-reports.service.ts` |
| `send()` set `sent` trước khi SMTP | `csd-reports.service.ts:108` |
| `bumpReportVersion` chỉ +major | `csd-reports.repository.ts:322` |
| Editor chỉ 4 key, bỏ section template | `CsdReportEditor.tsx` |
| `countDue` chỉ `draft/in_review` | `countDue()` |

## P2 — không làm trong plan này

Ads/GA4 auto-pull · portal publish/ack · Viewed/Acknowledged · AI draft report · Chart.js / Looker · KPI mapping ngoài ticket rollup + bảng tay · OAuth mailbox.

## Slices (ship độc lập)

| Slice | Tên | UAT xong khi |
|-------|-----|----------------|
| **R-1** | List/create + workflow đủ + 4 template + CTA | Tạo weekly + monthly; monthly Send lúc Draft = 409; Request changes; list hiện đủ status |
| **R-2** | Version + changelog + block + ticket rollup | Sửa trước gửi = `v1.1`; sau Sent = `v2.0`; OOS vào Risks + `upsell`; KPI/file block |
| **R-3** | PDF/Excel + SMTP + retry + notify | Export PDF `%PDF`; send fail không `Sent`; Retry gửi lại; owner có notify |
| **R-4** | Schedule + chat share + admin template + comment section | Cron tạo draft; share 1 tin Client Chat; CRUD template; comment theo mục |

Mỗi slice commit riêng, có thể deploy VPS trước slice sau.

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-09-02-postgresql-ddl-csd.sql` | `csd_report_comments` + index |
| `services/ptt-crm-api/src/csd/csd.types.ts` | Status, block, comment, schedule, detail DTO |
| `services/ptt-crm-api/src/csd/csd-report-version.util.ts` | `bumpReportVersion(current, kind)` |
| `services/ptt-crm-api/src/csd/csd-report-version.util.spec.ts` | Jest version |
| `services/ptt-crm-api/src/csd/csd-report-workflow.util.ts` | Transition map |
| `services/ptt-crm-api/src/csd/csd-report-workflow.util.spec.ts` | Jest workflow |
| `services/ptt-crm-api/src/csd/csd-report-rollup.util.ts` | Ticket → sections |
| `services/ptt-crm-api/src/csd/csd-report-export.util.ts` | pdfkit + exceljs |
| `services/ptt-crm-api/src/csd/csd-reports.repository.ts` | List, comments, schedules, send logs |
| `services/ptt-crm-api/src/csd/csd-reports.service.ts` | Rules R-1…R-4 |
| `services/ptt-crm-api/src/csd/csd-reports.service.spec.ts` | Jest |
| `services/ptt-crm-api/src/csd/csd-reports.controller.ts` | HTTP |
| `services/ptt-crm-api/src/csd/csd-report-schedule.worker.ts` | Recurrence tick |
| `services/ptt-crm-api/src/csd/csd-report-schedule-worker.service.ts` | setInterval 5 phút |
| `services/ops-web/src/lib/crm/csd-api.ts` | Fetch wrappers + types |
| `services/ops-web/src/app/crm/csd/reports/page.tsx` | List + tạo + filter |
| `services/ops-web/src/app/crm/csd/reports/[id]/page.tsx` | Builder + modal |
| `services/ops-web/src/app/crm/csd/reports/templates/page.tsx` | Admin CRUD (R-4) |
| `services/ops-web/src/components/crm/csd/CsdReportEditor.tsx` | Outline + blocks + approval |
| `services/ops-web/e2e/csd-reports.spec.ts` | E2e từng slice (mock API) |
| `docs/huong-dan-su-dung/29-csd-service-desk.md` | §5 Báo cáo |

---

# Slice R-1 — List / create / workflow / 4 template

### Task 1: Version + workflow utils (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-report-version.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-version.util.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-workflow.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-workflow.util.spec.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-reports.repository.ts` — `export { bumpReportVersion }` chuyển sang util; repo import lại.

**Interfaces:**

```ts
export type CsdReportVersionBump = 'minor' | 'major';

export function bumpReportVersion(current: string, kind: CsdReportVersionBump): string;

export const CSD_REPORT_TRANSITIONS: Record<CsdReportStatus, CsdReportStatus[]> = {
  draft: ['data_pending', 'in_review', 'approved', 'sent', 'cancelled'],
  data_pending: ['draft', 'in_review', 'cancelled'],
  in_review: ['approved', 'changes_requested', 'cancelled'],
  changes_requested: ['draft', 'in_review', 'cancelled'],
  approved: ['scheduled', 'sent', 'in_review', 'archived'],
  scheduled: ['sent', 'approved', 'cancelled'],
  sent: ['archived'],
  viewed: ['acknowledged', 'archived'],
  acknowledged: ['archived'],
  archived: [],
  cancelled: [],
};

export function canTransitionReport(
  from: CsdReportStatus,
  to: CsdReportStatus,
  opts: { requires_approval: boolean; bypass: boolean },
): boolean;
```

Rules `canTransitionReport`:
- `draft → sent` chỉ khi `requires_approval === false` **hoặc** `bypass`.
- `draft → approved` cùng điều kiện (weekly skip review).
- `in_review → approved` luôn (approver).
- `sent → draft` **cấm** (revise tạo version mới, không transition header cũ).
- P2 status `viewed` / `acknowledged` có trong map nhưng API MVP **không** expose.

- [ ] **Step 1: Failing tests**

```ts
it('bumps minor before send and major after send', () => {
  expect(bumpReportVersion('v1.0', 'minor')).toBe('v1.1');
  expect(bumpReportVersion('v1.2', 'minor')).toBe('v1.3');
  expect(bumpReportVersion('v1.2', 'major')).toBe('v2.0');
  expect(bumpReportVersion('bad', 'major')).toBe('v2.0');
});

it('blocks monthly draft→sent without bypass', () => {
  expect(canTransitionReport('draft', 'sent', { requires_approval: true, bypass: false })).toBe(false);
  expect(canTransitionReport('draft', 'sent', { requires_approval: false, bypass: false })).toBe(true);
  expect(canTransitionReport('approved', 'sent', { requires_approval: true, bypass: false })).toBe(true);
});
```

- [ ] **Step 2: Run RED**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/csd/csd-report-version.util.spec.ts src/csd/csd-report-workflow.util.spec.ts --no-coverage
```

Expected: FAIL `is not a function` / cannot find module.

- [ ] **Step 3: Minimal impl** — đúng signature trên.

- [ ] **Step 4: Jest PASS** cùng lệnh.

- [ ] **Step 5: Commit** `feat(csd): add report version bump and workflow transitions.`

---

### Task 2: List + get detail + workflow actions

**Files:**
- Modify: `services/ptt-crm-api/src/csd/csd.types.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-reports.repository.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-reports.service.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-reports.service.spec.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-reports.controller.ts`

**Interfaces:**

```ts
export type CsdReportListQuery = {
  status?: CsdReportStatus | 'due';
  template_code?: string;
  client_account_id?: string;
  q?: string;
  limit?: number;
};

export type CsdReportDetail = CsdReportRow & {
  sections_json: Record<string, unknown>;
  versions: CsdReportVersionRow[];
  send_logs: CsdReportSendLogRow[];
  template_name_vi: string | null;
  template_sections: string[];
};

export type TransitionCsdReportInput = {
  to: CsdReportStatus;
  comment?: string;
  approver_staff_id?: number;
};
```

`GET /` **phải** khai báo **trước** `GET :id`.

`countDue`: `status IN ('draft','data_pending','in_review','changes_requested','approved','scheduled') AND period_end <= CURRENT_DATE + 7`.

`requestChanges`: `to=changes_requested` bắt buộc `comment` trim ≥ 3 ký tự → 400 `comment_required`.

`submitReview`: `draft|data_pending|changes_requested → in_review` (weekly: có thể `→ approved` nếu `!requires_approval`).

- [ ] **Step 1: Failing tests** (thêm vào spec hiện có)

```ts
it('lists reports and due filter uses period_end window', async () => {
  repo.listReports.mockResolvedValue([{ id: 'r1', status: 'draft', period_end: '2026-09-05' }]);
  const out = await svc().list(actor, { status: 'due' });
  expect(repo.listReports).toHaveBeenCalledWith(expect.objectContaining({ status: 'due' }));
  expect(out.items).toHaveLength(1);
});

it('get returns current sections and version history', async () => {
  repo.getReport.mockResolvedValue({ id: 'r1', status: 'draft', current_version: 'v1.0' });
  repo.getCurrentVersion.mockResolvedValue({ version: 'v1.0', sections_json: { cover: { body: 'x' } } });
  repo.listVersions.mockResolvedValue([{ version: 'v1.0' }]);
  repo.listSendLogs.mockResolvedValue([]);
  const d = await svc().getDetail(actor, 'r1');
  expect(d.sections_json).toEqual({ cover: { body: 'x' } });
});

it('requestChanges without comment is 400', async () => {
  repo.getReport.mockResolvedValue({ id: 'r1', status: 'in_review', requires_approval: true });
  await expect(svc().transition(actor, 'r1', { to: 'changes_requested' })).rejects.toMatchObject({
    status: 400,
    response: { error: 'comment_required' },
  });
});
```

- [ ] **Step 2: RED** `./node_modules/.bin/jest src/csd/csd-reports.service.spec.ts --no-coverage`

- [ ] **Step 3: Repo methods**

```ts
listReports(q: CsdReportListQuery): Promise<CsdReportRow[]>
listVersions(reportId: string): Promise<CsdReportVersionRow[]>
listSendLogs(reportId: string): Promise<CsdReportSendLogRow[]>
```

SQL list: `JOIN csd_report_templates`, `is_deleted=FALSE`, `ORDER BY period_end ASC, updated_at DESC`, `LIMIT 100`.

- [ ] **Step 4: Controller**

```
GET    /api/crm/csd/reports
GET    /api/crm/csd/reports/:id
POST   /api/crm/csd/reports/:id/transition   { to, comment? }
POST   /api/crm/csd/reports/:id/request-changes  { comment }  // alias → changes_requested
```

Giữ `submit-review` / `approve` gọi `transition`.

- [ ] **Step 5: Jest PASS + commit** `feat(csd): list reports and complete review workflow.`

---

### Task 3: UI list/create + CTA theo status

**Files:**
- Modify: `services/ops-web/src/lib/crm/csd-api.ts` — `CsdReportRow.status` đủ enum; `createCsdReport`; `transitionCsdReport`.
- Modify: `services/ops-web/src/app/crm/csd/reports/page.tsx`
- Modify: `services/ops-web/src/app/crm/csd/reports/[id]/page.tsx`
- Modify: `services/ops-web/src/components/crm/csd/CsdReportEditor.tsx`
- Create: `services/ops-web/e2e/csd-reports.spec.ts`
- Modify: `docs/huong-dan-su-dung/29-csd-service-desk.md` §5

**Copy CTA (UX §7.2):**

| Status | Nút |
|--------|-----|
| Draft | Lưu · Chờ dữ liệu · Gửi duyệt · (weekly) Gửi PDF |
| Data Pending | Đủ dữ liệu · Gửi duyệt |
| In Review | Duyệt · Yêu cầu sửa |
| Changes Requested | Sửa · Gửi lại |
| Approved | Xuất PDF · Gửi khách · Lên lịch |
| Scheduled | Hủy lịch · Gửi ngay |
| Sent | Tạo bản sửa · Xem log |
| Cancelled / Archived | chỉ xem |

Outline lấy `template_sections`, không hardcode 4 key.

- [ ] **Step 1: E2e RED** (Playwright mock, pattern `e2e/csd-chat.spec.ts`)

```ts
test('R-1: create weekly and block monthly send while draft', async ({ page }) => {
  await mockCsdReportApis(page);
  await loginAsStaff(page);
  await page.goto('/crm/csd/reports');
  await page.getByTestId('csd-report-new').click();
  await page.getByTestId('csd-report-template').selectOption('weekly_ops');
  await page.getByTestId('csd-report-create').click();
  await expect(page.getByTestId('csd-report-editor')).toBeVisible();
  await expect(page.getByTestId('csd-report-send')).toBeVisible();

  await page.goto('/crm/csd/reports/monthly-1');
  await expect(page.getByTestId('csd-report-send')).toHaveCount(0);
  await expect(page.getByTestId('csd-report-submit-review')).toBeVisible();
});
```

- [ ] **Step 2: Form tạo** trên list: template (4 option), client, `period_start`, `period_end`, title optional → `POST /reports`.

- [ ] **Step 3: Filter chips** Tất cả · Đến hạn · Chờ duyệt · Đã gửi.

- [ ] **Step 4: Playwright** `./node_modules/.bin/playwright test e2e/csd-reports.spec.ts -g "R-1"` — không claim green nếu browser local thiếu.

- [ ] **Step 5: Commit** `feat(csd): add report list create and status CTAs.`

---

# Slice R-2 — Version, blocks, ticket rollup

### Task 4: Minor version + changelog

**Files:**
- Modify: `csd-reports.service.ts` / `.spec.ts` / `.repository.ts` / `.controller.ts`

**Interfaces:**

```ts
export type SnapshotCsdReportInput = {
  kind: 'minor' | 'major';
  changelog: string;
};

// POST /api/crm/csd/reports/:id/versions
snapshotVersion(actor, id, input): CsdReportDetail
```

Rules:
- Autosave `PATCH :id/sections` **không** đổi `current_version` (giữ hành vi hiện tại).
- `POST versions` copy `sections_json` → hàng version mới, `changelog` bắt buộc ≥ 3 ký tự, `kind=minor` trước `sent`, `kind=major` sau `sent` (hoặc `createRevisedVersion` gọi `kind='major'`).
- `createRevisedVersion` sau Sent: `status` header → `draft`, version `v2.0`, changelog mặc định `Tạo bản sửa sau khi gửi`.
- GET detail `versions` newest first.

- [ ] **Step 1: Test**

```ts
it('snapshots v1.1 with changelog before send', async () => {
  repo.getReport.mockResolvedValue({ id: 'r1', status: 'draft', current_version: 'v1.0', requires_approval: true });
  repo.getCurrentVersion.mockResolvedValue({ sections_json: { cover: { body: 'a' } } });
  repo.insertVersion.mockResolvedValue({ version: 'v1.1', changelog: 'Sửa KPI' });
  const out = await svc().snapshotVersion(actor, 'r1', { kind: 'minor', changelog: 'Sửa KPI' });
  expect(repo.insertVersion).toHaveBeenCalledWith(
    expect.objectContaining({ version: 'v1.1', changelog: 'Sửa KPI' }),
  );
  expect(out.current_version).toBe('v1.1');
});

it('revise after sent uses major bump', async () => {
  repo.getReport.mockResolvedValue({ id: 'r1', status: 'sent', current_version: 'v1.1' });
  repo.getCurrentVersion.mockResolvedValue({ sections_json: {} });
  repo.createRevisedVersion.mockResolvedValue({ id: 'r1', status: 'draft', current_version: 'v2.0' });
  const out = await svc().createRevisedVersion(actor, 'r1');
  expect(out.current_version).toBe('v2.0');
});
```

- [ ] **Step 2: RED → impl → PASS**

- [ ] **Step 3: UI** tab Version: list `v · changelog · người · lúc`. Sent read-only. Nút **Lưu phiên bản** (changelog prompt). Sent: **Tạo bản sửa**.

- [ ] **Step 4: Commit** `feat(csd): snapshot report versions with changelog.`

---

### Task 5: Blocks + ticket rollup + OOS upsell

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-report-blocks.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-rollup.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-rollup.util.spec.ts`
- Modify: `csd-reports.service.ts`, tickets repo (query period), `CsdReportEditor.tsx`

**Interfaces:**

```ts
export type CsdReportBlock =
  | { type: 'rich_text'; body: string }
  | { type: 'kpi_table'; rows: { metric: string; value: string; target?: string; note?: string }[] }
  | { type: 'chart'; title: string; labels: string[]; values: number[] }
  | { type: 'file'; attachment_id: string; caption?: string }
  | { type: 'ticket_rollup'; ticket_ids: string[]; summary: string };

export type CsdReportSection = { blocks: CsdReportBlock[] };

export function normalizeSection(raw: unknown): CsdReportSection {
  if (raw && typeof raw === 'object' && Array.isArray((raw as CsdReportSection).blocks)) {
    return raw as CsdReportSection;
  }
  if (raw && typeof raw === 'object' && 'body' in (raw as { body?: unknown })) {
    return { blocks: [{ type: 'rich_text', body: String((raw as { body: string }).body ?? '') }] };
  }
  return { blocks: [{ type: 'rich_text', body: '' }] };
}

export type CsdTicketRollup = {
  closed: { id: string; code: string; title: string }[];
  breached: { id: string; code: string; title: string }[];
  out_of_scope: { id: string; code: string; title: string }[];
};

export function applyTicketRollup(
  sections: Record<string, unknown>,
  rollup: CsdTicketRollup,
): Record<string, unknown>;
```

`applyTicketRollup`:
- `work_completed` / `ticket_sla` ← closed (block `ticket_rollup`).
- `risks` ← breached + out_of_scope; thêm `{ type:'rich_text', body:'Cờ upsell: ngoài phạm vi hợp đồng.' }` nếu `out_of_scope.length > 0`.
- Không gọi Ads/GA4.

`POST /reports/:id/rollup` — chỉ khi `status !== 'sent'`. Query ticket: `client_account_id` + `resolved_at/closed_at` hoặc `created_at` trong `[period_start, period_end]`.

File block: tái `csd_attachments` `entity_type='report'`, `entity_id=report_id`, visibility `internal` cho file nội bộ; PDF gửi khách copy `client`.

Chart MVP: CSS bar từ `labels/values` — không Chart.js.

Missing-data badge: section bắt buộc (`cover`, `executive_summary`) không có block text ≥ 10 ký tự → chấm cam trên outline.

- [ ] **Step 1: Test rollup**

```ts
it('puts OOS tickets into risks with upsell flag', () => {
  const next = applyTicketRollup({}, {
    closed: [{ id: 't1', code: 'PTT-2026-000001', title: 'Fix pixel' }],
    breached: [],
    out_of_scope: [{ id: 't2', code: 'PTT-2026-000002', title: 'Làm app' }],
  });
  const risks = normalizeSection(next.risks);
  expect(risks.blocks.some((b) => b.type === 'ticket_rollup' && b.ticket_ids.includes('t2'))).toBe(true);
  expect(JSON.stringify(risks)).toMatch(/upsell/i);
});
```

- [ ] **Step 2: Editor** nút **Thêm khối**: Văn bản · Bảng KPI · Biểu đồ · File · Rollup ticket. `data-testid="csd-report-add-block"`.

- [ ] **Step 3: Commit** `feat(csd): add report blocks and ticket rollup into risks.`

---

# Slice R-3 — Export thật + gửi + retry

### Task 6: PDF + Excel buffers

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-report-export.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-export.util.spec.ts`

**Interfaces:**

```ts
export function renderCsdReportPdf(detail: {
  title: string;
  version: string;
  period_start: string;
  period_end: string;
  client_label: string;
  sections: { key: string; label: string; section: CsdReportSection }[];
}): Promise<Buffer>;

export function renderCsdReportXlsx(detail: /* same */): Promise<Buffer>;
```

PDF: `pdfkit` như `gtm-proposal.service.ts` — cover (title, client, kỳ, version), mỗi section heading + rich_text + KPI table. Header `%PDF` bắt buộc.

XLSX: 1 sheet `KPI` (metric/value/target/note) + 1 sheet `Sections` (key, text).

- [ ] **Step 1: Test**

```ts
it('pdf starts with %PDF and xlsx is zip', async () => {
  const detail = {
    title: 'BC tuần',
    version: 'v1.0',
    period_start: '2026-08-25',
    period_end: '2026-08-31',
    client_label: 'ABC Land',
    sections: [
      { key: 'cover', label: 'Bìa', section: { blocks: [{ type: 'rich_text' as const, body: 'Xin chào' }] } },
    ],
  };
  const pdf = await renderCsdReportPdf(detail);
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  const xlsx = await renderCsdReportXlsx(detail);
  expect(xlsx.subarray(0, 2).toString()).toBe('PK');
});
```

- [ ] **Step 2: RED → impl → PASS**

- [ ] **Step 3: HTTP** (cap `view`)

```
GET /api/crm/csd/reports/:id/export.pdf
GET /api/crm/csd/reports/:id/export.xlsx
```

`Content-Disposition: attachment; filename="PTT-{code}-{version}.pdf"`.

- [ ] **Step 4: Commit** `feat(csd): export report PDF and XLSX.`

---

### Task 7: Send chỉ khi SMTP ok + retry + notify

**Files:**
- Modify: `csd-reports.service.ts` — inject `CsdEmailService` + `CsdNotificationsRepository`
- Modify: `csd-email.service.ts` nếu cần `attachments?: { filename: string; content_type: string; buffer: Buffer }[]`
- Modify: `csd-reports.service.spec.ts`

**Interfaces:**

```ts
// POST /reports/:id/send
send(actor, id, { to, subject, body, schedule_at?: string }): CsdReportSendLogRow

// POST /reports/:id/retry-send
retrySend(actor, id): CsdReportSendLogRow
```

Rules:
1. Gate workflow như hiện tại (`report_not_approved` / weekly skip).
2. Render PDF. Lưu `csd_attachments` (`file_name`, mime `application/pdf`).
3. Gọi `CsdEmailService.send` với `body_text` + dòng `Tệp: {filename}`. Nếu `emailSendEnabled=false` **hoặc** send ném lỗi → `insertSendLog({ result:'failed', error_text })`, **không** `updateReportStatus('sent')`, notify `owner_staff_id` event `report_send_failed`.
4. Thành công → `insertSendLog({ result:'sent', email_id })` **rồi** `status=sent`.
5. `schedule_at` tương lai → `status=scheduled`, `csd_report_schedules.next_run_at`, chưa SMTP.
6. Retry: chỉ khi last log `failed` và report **không** `sent`.

- [ ] **Step 1: Test**

```ts
it('does not mark sent when email send fails', async () => {
  repo.getReport.mockResolvedValue({
    id: 'r1', status: 'approved', current_version: 'v1.0', requires_approval: true, owner_staff_id: 5,
  });
  repo.getCurrentVersion.mockResolvedValue({ sections_json: { cover: { body: 'ok' } } });
  email.send.mockRejectedValue(new Error('smtp_down'));
  await expect(svc().send(actor, 'r1', { to: ['a@b.c'], subject: 'BC', body: 'gui' })).rejects.toMatchObject({
    response: { error: 'report_send_failed' },
  });
  expect(repo.updateReportStatus).not.toHaveBeenCalledWith('r1', 'sent', expect.anything());
  expect(repo.insertSendLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'failed' }));
  expect(notify.insert).toHaveBeenCalledWith(expect.objectContaining({ event_key: 'report_send_failed', staff_id: 5 }));
});
```

- [ ] **Step 2: UI** Send modal: To * · Subject · Body · checkbox PDF (mặc định bật) · Gửi ngay / Lên lịch. Failed: banner **Gửi lại**. Copy: `Báo cáo đã gửi — sửa sẽ tạo phiên bản mới`.

- [ ] **Step 3: Commit** `feat(csd): send report PDF only after email succeeds.`

---

# Slice R-4 — Schedule, chat share, template admin, comments

### Task 8: Schedule worker

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-report-schedule.worker.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-schedule.worker.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-report-schedule-worker.service.ts`
- Modify: `csd.module.ts` — register provider
- Modify: controller `POST /reports/schedules` cap `manage`

**Interfaces:**

```ts
export type CreateCsdReportScheduleInput = {
  template_code: string;
  client_account_id?: string;
  recurrence: 'weekly' | 'monthly' | 'quarterly';
  next_run_at: string;
  owner_staff_id: number;
  approver_staff_id?: number;
};

export async function tickCsdReportSchedules(deps: {
  claimDue: (limit: number) => Promise<CsdReportScheduleRow[]>;
  createDraft: (s: CsdReportScheduleRow) => Promise<{ id: string }>;
  notify: (staffId: number, reportId: string) => Promise<void>;
  bumpNextRun: (id: string, recurrence: string) => Promise<void>;
}): Promise<{ created: number }>
```

`claimDue`: `UPDATE … WHERE active AND next_run_at <= NOW() RETURNING *` + `FOR UPDATE SKIP LOCKED` (giống SLA).

Period: weekly = Mon–Sun tuần trước; monthly = tháng trước; quarterly = quý trước.

**Không** auto-send nếu `requires_approval` và chưa approved. Chỉ tạo Draft + notify owner `report_due`.

`bumpNextRun`: +7d / +1 month / +3 months.

- [ ] **Step 1: Test**

```ts
it('creates draft and notifies, does not send', async () => {
  const createDraft = jest.fn().mockResolvedValue({ id: 'r9' });
  const notify = jest.fn();
  const bumpNextRun = jest.fn();
  const claimDue = jest.fn().mockResolvedValue([
    { id: 's1', template_code: 'monthly_marketing', recurrence: 'monthly', owner_staff_id: 5 },
  ]);
  const out = await tickCsdReportSchedules({ claimDue, createDraft, notify, bumpNextRun });
  expect(out.created).toBe(1);
  expect(createDraft).toHaveBeenCalled();
  expect(notify).toHaveBeenCalled();
});
```

- [ ] **Step 2: Interval 5 phút** trong `CsdReportScheduleWorkerService` giống `CsdSlaWorkerService`.

- [ ] **Step 3: Commit** `feat(csd): schedule recurring report drafts.`

---

### Task 9: Share link vào Client Chat

**Files:**
- Modify: `csd-reports.service.ts` — inject chat service/repo
- Modify: `csd-chat.service.ts` nếu cần `postSystemMessage`
- Modify: `CsdReportEditor.tsx` — nút **Chia sẻ vào chat** khi `sent` hoặc `approved`

**Interfaces:**

```ts
// POST /reports/:id/share-chat
shareToClientChat(actor, id, { conversation_id: string }): { message_id: string }

// body tin (visibility=client):
`Báo cáo ${title} · ${version}\n${period_start} → ${period_end}\nTải PDF: /crm/csd/reports/${id}`
```

Rules:
- Conversation `kind='client'` và **cùng** `client_account_id` với report — khác → 409 `chat_client_mismatch`.
- Không conversation client → 404 `client_chat_not_found` (UI gợi ý tạo chat khách).
- `csd_report_send_logs` thêm `channel='chat'`, `result='sent'` — **không** đổi report `status` nếu đã `sent`.
- Không portal token.

- [ ] **Step 1: Test** mismatch 409; happy path insert message `visibility='client'`.

- [ ] **Step 2: UI** select hội thoại khách cùng account.

- [ ] **Step 3: Commit** `feat(csd): share sent report link into client chat.`

---

### Task 10: Section comments + admin templates

**Files:**
- Modify: `docs/specs/2026-09-02-postgresql-ddl-csd.sql` — thêm bảng (IF NOT EXISTS)
- Modify: repo/service/controller reports
- Create: `services/ops-web/src/app/crm/csd/reports/templates/page.tsx` (cap `csd.manage`)
- Modify: `CsdReportEditor.tsx` cột phải Comments
- Modify: `OpsNav.tsx` nếu cần link Admin mẫu
- Modify: `29-csd-service-desk.md` §5

**DDL:**

```sql
CREATE TABLE IF NOT EXISTS csd_report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES csd_reports (id) ON DELETE CASCADE,
  version VARCHAR(16) NOT NULL,
  section_key VARCHAR(64) NOT NULL DEFAULT '',
  body_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_staff_id INTEGER NOT NULL,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS csd_report_comments_idx
  ON csd_report_comments (report_id, version, section_key);
```

**Interfaces:**

```ts
// GET  /reports/:id/comments?section_key=
// POST /reports/:id/comments  { section_key, body_text }
// POST /reports/:id/comments/:cid/resolve

// GET    /reports/templates          cap view
// POST   /reports/templates          cap manage  { code, name_vi, requires_approval, sections_json }
// PATCH  /reports/templates/:id      cap manage
// POST   /reports/templates/:id/archive  active=false — cấm xóa nếu còn report
```

`requestChanges` (R-1) **cũng** insert comment `section_key=''` (chung).

Template `code` unique `(tenant_id, code)`. Archive: `active=false`. 409 `template_in_use` nếu vẫn muốn hard-delete (MVP không hard-delete).

- [ ] **Step 1: Jest** comment gắn `section_key='risks'`; archive template in use không xóa row.

- [ ] **Step 2: UI** comment list dưới editor mục đang mở. Trang `/crm/csd/reports/templates` — 4 seed hiện sẵn, sửa `name_vi` / sections / `requires_approval`.

- [ ] **Step 3: Cập nhật guide §5** — tạo → rollup → duyệt → PDF → gửi / lịch / share chat.

- [ ] **Step 4: E2e R-4** (mock) comment + template archive.

- [ ] **Step 5: Commit** `feat(csd): add report section comments and template admin.`

---

## Self-review (coverage list D)

| Chức năng D | Slice |
|-------------|-------|
| Workflow Data Pending / Changes Requested / Scheduled | R-1, R-3 schedule_at, R-4 worker |
| Version v1.1 / v2.0 + changelog UI | R-2 Task 4 |
| 4 template đủ trên UI | R-1 Task 3 + seed DDL đã có |
| Block chart, KPI, file/screenshot | R-2 Task 5 |
| Review comment theo section | R-4 Task 10 |
| Schedule gửi | R-4 Task 8 |
| Xuất PDF/Excel thật | R-3 Task 6 |
| Share link Client Chat | R-4 Task 9 |
| Retry fail + notify owner | R-3 Task 7 |
| Out of Scope → Risks + upsell | R-2 Task 5 |
| Admin CRUD template | R-4 Task 10 |
| AI draft report | **P2 — không làm** |

Vá thêm (không có trong list D nhưng chặn UAT): `GET` list + `getDetail` sections — R-1.

Không còn TBD cho MVP Báo cáo.

## UAT tối thiểu trước khi gọi xong

1. List `/crm/csd/reports` hiện hàng (không 404).  
2. Tạo `weekly_ops` + period → v1.0 Draft; Gửi PDF (SMTP on) → Sent + log.  
3. Tạo `monthly_marketing` Draft → Gửi = 409; Gửi duyệt → Yêu cầu sửa (có comment) → Gửi lại → Duyệt → Gửi.  
4. Lưu phiên bản → `v1.1` + changelog. Sent → Tạo bản sửa → `v2.0` Draft; bản v1.x không sửa.  
5. Rollup: ticket closed vào Công việc; ticket `out_of_scope` vào Rủi ro có chữ upsell.  
6. Export PDF mở được (header `%PDF`); XLSX mở được bằng Excel.  
7. Tắt SMTP / gửi fail → status **không** Sent; banner Gửi lại; notify owner.  
8. Schedule weekly → worker tạo Draft kỳ trước + notify.  
9. Share vào chat khách cùng account → 1 tin `visibility=client`.  
10. `/crm/csd/reports/templates`: sửa tên mẫu; archive không xóa seed.

## Deploy mỗi slice

```bash
# repo root, sau commit
git push origin main
APPLY=1 ./scripts/deploy_csd_vps.sh
# nếu WARN sudo restart skipped:
ssh deploy@rs.pttads.vn 'kill -HUP $(systemctl show ptt-crm-api -p MainPID --value); kill -HUP $(systemctl show ptt-ops-web -p MainPID --value)'
# đợi ~8s; smoke
# api :3000/health 200 · ops-web :3200/login 200
```

Hard-refresh. Không enable `PTT_CSD_LLM`.
