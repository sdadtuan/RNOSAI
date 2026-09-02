# Internal Work Report (IWRS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Wave gate:** Execute **W1 (Tasks 1–12)** first. Stop for UAT before starting W2. Do **not** implement W2–W6 in the first session unless PO says so. Isolated worktree via `superpowers:using-git-worktrees` at execution time. Branch: `feat/iwr-w1`.

**Goal:** Xây IWRS trên RNOSAI đúng SRS v2.0 — lớp báo cáo nội bộ ngày/tuần/tháng, hộp thư To/Cc, cây kỳ, rồi lần lượt bằng chứng, phân phối DN, dashboard, builder, AI — **không** đụng báo cáo khách CSD.

**Architecture:** Module Nest mới `IwrModule` (`/api/crm/iwr`) + App Router `/crm/internal-reports`. Đọc `crm_staff.reports_to_id`, ghi `iwr_*`. Notify/audit tái `csd_notifications` / `csd_audit_logs` với `entity_type='iwr_*'`. PDF = `pdfkit` (đã có). Không Kafka, không GraphQL, không ghi `csd_reports`.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL `iwr_*` · Jest · Playwright mock · `pdfkit` + `exceljs` (W2).

**Spec:** `docs/superpowers/specs/2026-09-03-internal-work-report-srs.md` v2.0.

## Global Constraints

- Prefix `/api/crm/iwr`. Route tĩnh (`inbox`, `directory`, `team`, `templates`, `lists`, `schedules`, `dashboards`) **trước** `:id`.
- Staff id = **INTEGER** `crm_staff.id` qua `resolveCrmStaffUserId`. `tenant_id='PTT'`.
- Copy UI tiếng Việt. Không badge Stub. Không status `sent` (tránh CSD).
- **BR-32:** 0 lần ghi `csd_reports` / `shareToClientChat` / portal khách.
- Cây duyệt = `reports_to_id` only. To = QLTT, không xoá (W1). Bcc off trừ `iwr.bcc` (W3).
- `PTT_IWR_LLM=0` mặc định. Core W1–W5 chạy khi flag tắt. Không bật LLM đến W6 + PO.
- Unique `(author_staff_id, template_id, period_start, period_end)` trừ `is_deleted`.
- BR-38: comment insert-first (hoặc cùng transaction) trước `changes_requested`.
- Ack/waived/archived: sections immutable. Mở lại = `iwr.manage` + lý do (W5).
- Deploy: `APPLY=1 ./scripts/deploy_iwr_vps.sh`. **Không** `deploy_csd_vps.sh`.
- Một implementer / task. Không sửa file CSD trừ export `CsdNotificationsRepository` + `CsdAuditRepository` từ `CsdModule` (Task 8).

## Wave gates (UAT trước khi mở sóng sau)

| Sóng | Tasks | UAT xong khi |
|------|-------|----------------|
| **W1** | 1–12 | NV A nộp ngày/tuần → QLTT B thấy Inbox ≤30s; Cc cùng phòng; ack / yêu cầu bổ sung; PDF; **không** nút Gửi khách |
| **W2** | 13–16 | ≥1 dòng xong có `ref`; rollup ngày→tuần chọn dòng; RAG gợi ý không ghi đè; XLSX; `first_viewed_at` |
| **W3** | 17–20 | Bcc không lộ Reply-all; DL tĩnh; mention; `iwr_risks` critical notify; delivery log |
| **W4** | 21–23 | 4 dashboard; digest in-app; lịch gửi; SMTP **nội bộ** domain PTT; leave → waived |
| **W5** | 24–26 | Builder lưu + chạy; masking field; approval entity; reopen + audit |
| **W6** | 27–28 | Flag off → 404 AI, nộp vẫn được; ngoài org phải approval + allowlist |

## File map

| File | Sóng | Responsibility |
|------|------|----------------|
| `docs/specs/2026-09-03-postgresql-ddl-iwr.sql` | W1+ | DDL tăng dần, `IF NOT EXISTS` |
| `scripts/apply_pg_ddl_iwr.sh` | W1 | `psql -f` DDL |
| `scripts/seed_iwr_rbac.sh` | W1 | Cap `iwr.*` |
| `scripts/deploy_iwr_vps.sh` | W1 | DDL + build + HUP; không bật LLM |
| `services/ptt-crm-api/src/iwr/iwr.types.ts` | W1 | Status, DTO, actor |
| `services/ptt-crm-api/src/iwr/iwr-period.util.ts` | W1 | Workday, period, due 17:00 VN |
| `services/ptt-crm-api/src/iwr/iwr-workflow.util.ts` | W1 | Transition map |
| `services/ptt-crm-api/src/iwr/iwr-org.util.ts` | W1 | Ancestor / cùng phòng / subtree |
| `services/ptt-crm-api/src/iwr/iwr-recipient.util.ts` | W1 | To khoá, Cc policy |
| `services/ptt-crm-api/src/iwr/iwr-sections.util.ts` | W1 | Empty sections theo template |
| `services/ptt-crm-api/src/iwr/iwr-export.util.ts` | W1/W2 | PDF rồi XLSX/CSV |
| `services/ptt-crm-api/src/iwr/iwr-reports.repository.ts` | W1 | SQL reports/recipients/comments/sources |
| `services/ptt-crm-api/src/iwr/iwr-org.repository.ts` | W1 | Directory + `reports_to_id` |
| `services/ptt-crm-api/src/iwr/iwr-reports.service.ts` | W1 | Create/submit/ack/waive |
| `services/ptt-crm-api/src/iwr/iwr-inbox.service.ts` | W1 | 4 tab |
| `services/ptt-crm-api/src/iwr/iwr-reports.controller.ts` | W1 | HTTP reports |
| `services/ptt-crm-api/src/iwr/iwr-inbox.controller.ts` | W1 | `/inbox` `/directory` `/team` |
| `services/ptt-crm-api/src/iwr/iwr-templates.controller.ts` | W1 | Templates |
| `services/ptt-crm-api/src/iwr/guards/staff-iwr.guard.ts` | W1 | Cap `iwr` |
| `services/ptt-crm-api/src/iwr/iwr.module.ts` | W1 | Nest module |
| `services/ptt-crm-api/src/iwr/iwr-items.service.ts` | W2 | Dòng + evidence |
| `services/ptt-crm-api/src/iwr/iwr-suggest.service.ts` | W2 | Ticket/lead gợi ý (đọc) |
| `services/ptt-crm-api/src/iwr/iwr-rag.util.ts` | W2 | `rag_hint` rule |
| `services/ptt-crm-api/src/iwr/iwr-lists.service.ts` | W3 | DL |
| `services/ptt-crm-api/src/iwr/iwr-distribution.service.ts` | W3 | Reply/forward/delivery |
| `services/ptt-crm-api/src/iwr/iwr-risks.service.ts` | W3 | Blocker entity |
| `services/ptt-crm-api/src/iwr/iwr-dashboards.service.ts` | W4 | 4 vai + snapshot |
| `services/ptt-crm-api/src/iwr/iwr-schedule.worker.ts` | W4 | Digest / nhắc / SMTP nội bộ |
| `services/ptt-crm-api/src/iwr/iwr-builder.service.ts` | W5 | Saved reports |
| `services/ptt-crm-api/src/iwr/iwr-masking.util.ts` | W5 | Field sensitivity |
| `services/ptt-crm-api/src/iwr/iwr-ai.service.ts` | W6 | 404 nếu `PTT_IWR_LLM=0` |
| `services/ops-web/src/lib/crm/iwr-api.ts` | W1 | Client |
| `services/ops-web/src/lib/crm/iwr-nav.util.ts` | W1 | `canSeeIwrNav` |
| `services/ops-web/src/components/crm/iwr/**` | W1+ | UI |
| `services/ops-web/src/app/crm/internal-reports/**` | W1+ | Routes |
| `services/ops-web/e2e/iwr-w1.spec.ts` | W1 | E2E mock |
| `docs/huong-dan-su-dung/30-bao-cao-cong-viec-noi-bo.md` | W1 | Guide |

Modify (không viết lại module cũ):

- `services/ptt-crm-api/src/app.module.ts` — `IwrModule`
- `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts` — catalog + super-admin merge `iwr.*`
- `services/ptt-crm-api/src/csd/csd.module.ts` — **chỉ** export notify + audit repos
- `services/ops-web/src/components/OpsNav.tsx` — mục **Tổ chức → BC công việc**

## Locked types (mọi task dùng đúng tên này)

```ts
export const IWR_TENANT_ID = 'PTT';
export const IWR_TZ = 'Asia/Ho_Chi_Minh';
export const IWR_DAILY_DUE_HOUR = 17;

export const IWR_STATUSES = [
  'draft',
  'submitted',
  'changes_requested',
  'supplemented',
  'acknowledged',
  'waived',
  'archived',
] as const;
export type IwrReportStatus = (typeof IWR_STATUSES)[number];

export const IWR_TEMPLATE_CODES = ['daily_work', 'weekly_work', 'monthly_work'] as const;
export type IwrTemplateCode = (typeof IWR_TEMPLATE_CODES)[number];

export type IwrRecipientKind = 'to' | 'cc' | 'bcc';
export type IwrInboxBox = 'action' | 'unread' | 'inbox' | 'sent' | 'draft';
export type IwrRag = 'green' | 'yellow' | 'red' | 'gray' | null;

export type IwrCapAction =
  | 'view' | 'write' | 'review' | 'lists' | 'schedule'
  | 'export' | 'manage' | 'executive' | 'bcc' | 'external';

export type IwrActor = {
  staffId: number;
  staffLabel: string;
  departmentId: number | null;
  caps: { section: string; action: string }[];
};

export type IwrPeriod = {
  period_start: string; // YYYY-MM-DD
  period_end: string;
  due_at: string; // ISO
};

export type IwrStaffNode = {
  id: number;
  name: string;
  email: string | null;
  department_id: number | null;
  reports_to_id: number | null;
  active: boolean;
};

export const IWR_DAILY_SECTIONS = [
  'general', 'done', 'wip', 'next', 'blocked', 'approvals', 'notes',
] as const;
export const IWR_WEEKLY_SECTIONS = [
  'rag', 'priorities', 'highlights', 'kpi', 'deliverables',
  'wip', 'blocked', 'plan_vs_actual', 'next_week', 'decisions',
] as const;
export const IWR_MONTHLY_SECTIONS = [
  ...IWR_WEEKLY_SECTIONS, 'month_highlights', 'people',
] as const;
```

Lỗi ổn định W1: `iwr_not_workday` `iwr_period_exists` `iwr_immutable` `iwr_bad_transition` `iwr_not_author` `iwr_not_direct_manager` `iwr_cc_not_allowed` `iwr_bcc_forbidden` `iwr_to_locked` `late_reason_required` `rag_required` `comment_required`.

---

# Wave W1 — Nhân + hộp thư cơ bản

FR: MDM-01 đọc, MDM-03 rule cứng, MDM-04 cơ bản, TPL-01 seed, DAILY-01/04/05/06/07, WEEKLY-01 tạo / 02 / 04 cây / 05 text, DIST-01 To+Cc, DIST-02 To+Cc, DIST-05 hard-code, DIST-06 4 tab, APR-01 ack, NOTI-01/02 in-app, EXP-01 PDF, AUD-01 lõi. US-10, US-14 (không nút AI).

---

### Task 1: Period + workflow utils (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr-period.util.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-period.util.spec.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-workflow.util.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-workflow.util.spec.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-sections.util.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-sections.util.spec.ts`

**Interfaces:**

```ts
export function vnYmd(now: Date, tz?: string): string;
export function isIwrWorkday(ymd: string): boolean;
export function iwrPeriodForTemplate(code: IwrTemplateCode, now: Date): IwrPeriod;
export function isIwrLate(submittedAt: Date, dueAt: Date): boolean;

export const IWR_TRANSITIONS: Record<IwrReportStatus, IwrReportStatus[]>;
export function canTransitionIwr(from: IwrReportStatus, to: IwrReportStatus): boolean;
export function emptySectionsForCode(code: IwrTemplateCode): Record<string, { body: string; items: unknown[] }>;
```

Rules:
- Workday = Mon–Fri (`getUTCDay` trên lịch VN: parse `ymd` + `T12:00:00+07:00`).
- Daily: `period_start = period_end = vnYmd(now)`; `due_at = ymdT17:00:00+07:00`.
- Weekly: Mon → Fri cùng tuần ISO (Mon=đầu); `due_at` = Friday 17:00 VN.
- Monthly: ngày 1 → ngày cuối tháng; `due_at` = last **workday** 17:00 VN.
- Late: `submittedAt.getTime() > dueAt.getTime()`.
- Transitions:

```
draft → submitted | waived | archived
submitted → changes_requested | acknowledged | archived
changes_requested → supplemented | waived | archived
supplemented → changes_requested | acknowledged | archived
acknowledged → archived
waived → archived
archived → []
```

- `emptySectionsForCode('daily_work')` có đúng 7 key; weekly 10; monthly 12. Mỗi value `{ body: '', items: [] }`.

- [ ] **Step 1: Failing tests**

```ts
// iwr-period.util.spec.ts
import { iwrPeriodForTemplate, isIwrLate, isIwrWorkday, vnYmd } from './iwr-period.util';

it('vnYmd uses Asia/Ho_Chi_Minh', () => {
  expect(vnYmd(new Date('2026-09-03T17:30:00+07:00'))).toBe('2026-09-03');
  expect(vnYmd(new Date('2026-09-03T00:30:00+07:00'))).toBe('2026-09-03');
});

it('weekend is not a workday', () => {
  expect(isIwrWorkday('2026-09-04')).toBe(true); // Fri
  expect(isIwrWorkday('2026-09-05')).toBe(false); // Sat
  expect(isIwrWorkday('2026-09-06')).toBe(false); // Sun
});

it('daily due is 17:00 VN same day', () => {
  const p = iwrPeriodForTemplate('daily_work', new Date('2026-09-03T09:00:00+07:00'));
  expect(p).toEqual({
    period_start: '2026-09-03',
    period_end: '2026-09-03',
    due_at: '2026-09-03T17:00:00.000+07:00',
  });
});

it('weekly is Mon–Fri due Friday 17:00 VN', () => {
  const p = iwrPeriodForTemplate('weekly_work', new Date('2026-09-03T09:00:00+07:00'));
  expect(p.period_start).toBe('2026-08-31');
  expect(p.period_end).toBe('2026-09-04');
  expect(p.due_at).toBe('2026-09-04T17:00:00.000+07:00');
});

it('marks late after due', () => {
  expect(isIwrLate(new Date('2026-09-03T17:00:01+07:00'), new Date('2026-09-03T17:00:00+07:00'))).toBe(true);
  expect(isIwrLate(new Date('2026-09-03T16:59:59+07:00'), new Date('2026-09-03T17:00:00+07:00'))).toBe(false);
});
```

```ts
// iwr-workflow.util.spec.ts
import { canTransitionIwr } from './iwr-workflow.util';

it('allows the W1 happy path and blocks sent-like jumps', () => {
  expect(canTransitionIwr('draft', 'submitted')).toBe(true);
  expect(canTransitionIwr('submitted', 'changes_requested')).toBe(true);
  expect(canTransitionIwr('changes_requested', 'supplemented')).toBe(true);
  expect(canTransitionIwr('supplemented', 'acknowledged')).toBe(true);
  expect(canTransitionIwr('acknowledged', 'draft')).toBe(false);
  expect(canTransitionIwr('acknowledged', 'submitted')).toBe(false);
  expect(canTransitionIwr('waived', 'submitted')).toBe(false);
});
```

```ts
// iwr-sections.util.spec.ts
import { emptySectionsForCode } from './iwr-sections.util';

it('seeds daily weekly monthly keys', () => {
  expect(Object.keys(emptySectionsForCode('daily_work'))).toEqual([
    'general', 'done', 'wip', 'next', 'blocked', 'approvals', 'notes',
  ]);
  expect(Object.keys(emptySectionsForCode('weekly_work'))).toHaveLength(10);
  expect(emptySectionsForCode('monthly_work').people).toEqual({ body: '', items: [] });
});
```

- [ ] **Step 2: Run RED**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/iwr/iwr-period.util.spec.ts src/iwr/iwr-workflow.util.spec.ts src/iwr/iwr-sections.util.spec.ts --no-coverage
```

Expected: FAIL cannot find module.

- [ ] **Step 3: Implement**

`vnYmd`: `new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit' }).format(now)`.

Weekly Mon: từ `ymd` T12:00+07, lùi `(day+6)%7` ngày (Sun=0 → lùi 6). `period_end` = Mon+4.

`due_at` format cố định `YYYY-MM-DDTHH:mm:ss.000+07:00` (không `Z`) để test ổn định.

`canTransitionIwr`: `IWR_TRANSITIONS[from]?.includes(to) ?? false`.

- [ ] **Step 4: Jest PASS** cùng lệnh.

- [ ] **Step 5: Commit** `feat(iwr): add period, workflow, and section seed utils.`

---

### Task 2: Org tree + recipient policy (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr-org.util.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-org.util.spec.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-recipient.util.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-recipient.util.spec.ts`

**Interfaces:**

```ts
export function ancestorIds(staffId: number, nodes: IwrStaffNode[]): number[];
export function descendantIds(managerId: number, nodes: IwrStaffNode[]): number[];
export function isOnPath(actorId: number, otherId: number, nodes: IwrStaffNode[]): boolean;
export function sameDepartment(a: IwrStaffNode | undefined, b: IwrStaffNode | undefined): boolean;

export type RecipientPolicyError =
  | 'iwr_to_locked'
  | 'iwr_cc_not_allowed'
  | 'iwr_bcc_forbidden';

export function defaultToStaffId(author: IwrStaffNode): number | null;

export function assertW1Recipients(input: {
  author: IwrStaffNode;
  actor: IwrActor;
  nodes: IwrStaffNode[];
  toIds: number[];
  ccIds: number[];
  bccIds: number[];
}): void;
```

W1 hard-code (FR-DIST-05):
- `defaultToStaffId` = `author.reports_to_id`.
- Nếu author có `reports_to_id`: `toIds` phải `=== [reports_to_id]` (đúng 1, không thêm/bớt) → không thì `iwr_to_locked`.
- Nếu **không** có QLTT (gốc cây): `toIds` rỗng được; không bắt ack.
- Cc: mỗi id phải (cùng `department_id`) **hoặc** `isOnPath(author.id, cc, nodes)` **hoặc** actor có `iwr.manage`. Không thì `iwr_cc_not_allowed`.
- `bccIds.length > 0` → `iwr_bcc_forbidden` (W1 luôn, kể cả manage).
- Self không được To/Cc.

Throw `Error` với `error` property (service map sang HttpException):

```ts
export class IwrPolicyError extends Error {
  constructor(public readonly error: RecipientPolicyError) {
    super(error);
  }
}
```

- [ ] **Step 1: Failing tests**

```ts
const nodes: IwrStaffNode[] = [
  { id: 1, name: 'CEO', email: 'c@x', department_id: 10, reports_to_id: null, active: true },
  { id: 2, name: 'TL', email: 't@x', department_id: 10, reports_to_id: 1, active: true },
  { id: 3, name: 'NV', email: 'n@x', department_id: 10, reports_to_id: 2, active: true },
  { id: 4, name: 'AM', email: 'a@x', department_id: 20, reports_to_id: 1, active: true },
];

it('walks ancestors and descendants', () => {
  expect(ancestorIds(3, nodes)).toEqual([2, 1]);
  expect(descendantIds(2, nodes).sort()).toEqual([3]);
  expect(isOnPath(1, 3, nodes)).toBe(true);
  expect(isOnPath(3, 4, nodes)).toBe(false);
});

it('locks To to direct manager and blocks other-dept Cc', () => {
  const author = nodes[2];
  const actor: IwrActor = { staffId: 3, staffLabel: 'NV', departmentId: 10, caps: [] };
  expect(() => assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [], bccIds: [] })).not.toThrow();
  expect(() => assertW1Recipients({ author, actor, nodes, toIds: [1], ccIds: [], bccIds: [] })).toThrow('iwr_to_locked');
  expect(() => assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [4], bccIds: [] })).toThrow('iwr_cc_not_allowed');
  expect(() => assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [], bccIds: [1] })).toThrow('iwr_bcc_forbidden');
});

it('allows same-dept Cc and manage bypass for Cc only', () => {
  const author = nodes[2];
  const actor: IwrActor = {
    staffId: 3, staffLabel: 'NV', departmentId: 10,
    caps: [{ section: 'iwr', action: 'manage' }],
  };
  expect(() => assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [1], bccIds: [] })).not.toThrow();
  expect(() => assertW1Recipients({ author, actor, nodes, toIds: [2], ccIds: [4], bccIds: [] })).not.toThrow();
});
```

- [ ] **Step 2: RED**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/iwr/iwr-org.util.spec.ts src/iwr/iwr-recipient.util.spec.ts --no-coverage
```

- [ ] **Step 3: Implement** — walk `reports_to_id` (guard cycle: visited set). `assertW1Recipients` throw `IwrPolicyError`.

- [ ] **Step 4: PASS** cùng lệnh.

- [ ] **Step 5: Commit** `feat(iwr): add org walk and W1 recipient policy.`

---

### Task 3: DDL + template seed + RBAC catalog

**Files:**
- Create: `docs/specs/2026-09-03-postgresql-ddl-iwr.sql`
- Create: `scripts/apply_pg_ddl_iwr.sh`
- Create: `scripts/seed_iwr_rbac.sh`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts` — thêm catalog + super-admin merge

**Interfaces:** DDL W1 only (W2+ append later, không tạo file DDL thứ hai):

```sql
-- iwr_templates, iwr_reports, iwr_report_versions, iwr_report_recipients,
-- iwr_comments, iwr_report_sources
-- tenant_id VARCHAR(32) NOT NULL DEFAULT 'PTT'
-- staff columns INTEGER
-- UNIQUE (tenant_id, author_staff_id, template_id, period_start, period_end) WHERE is_deleted = FALSE
```

Cột `iwr_reports` bắt buộc: `id UUID PK`, `tenant_id`, `template_id`, `author_staff_id`, `reviewer_staff_id` (snapshot To lúc nộp, nullable), `period_start DATE`, `period_end DATE`, `tz VARCHAR(64) DEFAULT 'Asia/Ho_Chi_Minh'`, `due_at TIMESTAMPTZ`, `status`, `version VARCHAR(16) DEFAULT 'v1.0'`, `rag VARCHAR(16)`, `is_late BOOLEAN DEFAULT FALSE`, `late_reason TEXT`, `first_viewed_at TIMESTAMPTZ`, `first_viewed_by_staff_id INTEGER`, `submitted_at`, `acknowledged_at`, `acknowledged_by_staff_id`, `waived_at`, `waived_by_staff_id`, `waive_reason`, `sensitivity VARCHAR(32) DEFAULT 'internal'`, `title VARCHAR(255)`, `sections_json JSONB NOT NULL DEFAULT '{}'`, `metrics_json JSONB`, `created_at`, `updated_at`, `is_deleted BOOLEAN DEFAULT FALSE`.

Check status đúng `IWR_STATUSES`. **Không** có `'sent'`.

Seed 3 template:

| code | name_vi | kind | sections_json |
|------|---------|------|----------------|
| `daily_work` | Báo cáo ngày | daily | IWR_DAILY_SECTIONS |
| `weekly_work` | Báo cáo tuần | weekly | IWR_WEEKLY_SECTIONS |
| `monthly_work` | Báo cáo tháng | monthly | IWR_MONTHLY_SECTIONS |

`due_rule_json`: daily `{hour:17}`; weekly `{weekday:5,hour:17}`; monthly `{last_workday:true,hour:17}`.

RBAC seed (mirror `seed_csd_rbac.sh`):
- Mọi position active: `iwr.view` + `iwr.write`
- `leader` function + codes `ceo,gd,gdkd,md,pd`: + `iwr.review`
- `super-admin,ceo,gd`: + `iwr.manage` `iwr.executive` `iwr.export`
- `gdkd`: + `iwr.executive` `iwr.export`
- Không seed `iwr.bcc` / `iwr.external` ở W1

Catalog `KNOWN_CAPS` thêm 10 cặp `{ section: 'iwr', action }`. Super-admin `me()` merge đủ 10 (bcc/external có trong catalog nhưng W1 API vẫn cấm Bcc).

- [ ] **Step 1: Write DDL + scripts** — copy cấu trúc `apply_pg_ddl_csd.sh` / `seed_csd_rbac.sh` (dry-run mặc định, `--apply` mới ghi).

`apply_pg_ddl_iwr.sh` cuối cùng gọi `bash scripts/seed_iwr_rbac.sh --apply`.

- [ ] **Step 2: Apply local**

```bash
bash scripts/apply_pg_ddl_iwr.sh
```

Expected: `OK  IWR DDL applied` và 3 row `iwr_templates`.

- [ ] **Step 3: Catalog** — trong `staff-auth.service.ts` sau block `csd`:

```ts
  { section: 'iwr', action: 'view' },
  { section: 'iwr', action: 'write' },
  { section: 'iwr', action: 'review' },
  { section: 'iwr', action: 'lists' },
  { section: 'iwr', action: 'schedule' },
  { section: 'iwr', action: 'export' },
  { section: 'iwr', action: 'manage' },
  { section: 'iwr', action: 'executive' },
  { section: 'iwr', action: 'bcc' },
  { section: 'iwr', action: 'external' },
```

Trong `isSuperAdminPositionCode` merge, thêm 10 cặp `iwr`.

- [ ] **Step 4: Commit** `feat(iwr): add W1 DDL, templates, and iwr RBAC caps.`

---

### Task 4: Types + repositories

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr.types.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-reports.repository.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-org.repository.ts`

**Interfaces:**

```ts
export type IwrTemplateRow = {
  id: string;
  code: IwrTemplateCode | string;
  name_vi: string;
  kind: string;
  sections_json: string[];
  due_rule_json: Record<string, unknown>;
  active: boolean;
};

export type IwrRecipientRow = {
  id: string;
  report_id: string;
  staff_id: number;
  kind: IwrRecipientKind;
  staff_name?: string;
};

export type IwrCommentRow = {
  id: string;
  report_id: string;
  section_key: string;
  body_text: string;
  created_by_staff_id: number;
  created_at: string;
};

export type IwrReportRow = {
  id: string;
  template_id: string;
  template_code: string;
  template_name_vi: string;
  title: string;
  author_staff_id: number;
  author_name?: string;
  reviewer_staff_id: number | null;
  period_start: string;
  period_end: string;
  due_at: string;
  status: IwrReportStatus;
  version: string;
  rag: IwrRag;
  is_late: boolean;
  late_reason: string | null;
  first_viewed_at: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  sections_json: Record<string, unknown>;
  source_report_ids?: string[];
};

export type IwrReportDetail = IwrReportRow & {
  recipients: IwrRecipientRow[];
  comments: IwrCommentRow[];
  versions: { version: string; status: string; created_at: string }[];
};

export class IwrReportsRepository {
  getTemplateByCode(code: string): Promise<IwrTemplateRow | null>;
  listTemplates(): Promise<IwrTemplateRow[]>;
  insertReport(input: {
    template_id: string;
    title: string;
    author_staff_id: number;
    reviewer_staff_id: number | null;
    period_start: string;
    period_end: string;
    due_at: string;
    sections_json: Record<string, unknown>;
  }): Promise<IwrReportRow>;
  getReport(id: string): Promise<IwrReportRow | null>;
  listMine(authorStaffId: number, query: { status?: string; template_code?: string }): Promise<IwrReportRow[]>;
  updateSections(id: string, sections: Record<string, unknown>, title?: string): Promise<IwrReportRow>;
  updateStatus(id: string, patch: Partial<IwrReportRow> & { status: IwrReportStatus }): Promise<IwrReportRow>;
  replaceRecipients(reportId: string, rows: { staff_id: number; kind: IwrRecipientKind }[]): Promise<void>;
  listRecipients(reportId: string): Promise<IwrRecipientRow[]>;
  insertComment(input: {
    report_id: string; section_key: string; body_text: string; created_by_staff_id: number;
  }): Promise<IwrCommentRow>;
  listComments(reportId: string, sectionKey?: string): Promise<IwrCommentRow[]>;
  insertVersionSnapshot(reportId: string, version: string, status: string, sections: Record<string, unknown>): Promise<void>;
  replaceSources(reportId: string, sourceIds: string[]): Promise<void>;
  listInbox(staffId: number, box: IwrInboxBox): Promise<IwrReportRow[]>;
}

export class IwrOrgRepository {
  getStaff(id: number): Promise<IwrStaffNode | null>;
  listActiveStaff(): Promise<IwrStaffNode[]>;
  searchDirectory(q: string, limit: number): Promise<IwrStaffNode[]>;
}
```

SQL directory: `crm_staff` `active=TRUE`, `ILIKE` name/email/internal_code, `LIMIT 20`.

Inbox SQL:
- `action`: recipient `to` + status IN (`submitted`,`supplemented`,`changes_requested`)
- `unread`: recipient to/cc + `first_viewed_at IS NULL` + status not draft/waived
- `inbox`: recipient to/cc
- `sent`: author = me + status not draft
- `draft`: author = me + status draft

`insertReport` bắt `23505` → ném object `{ code: '23505' }` để service map `iwr_period_exists`.

- [ ] **Step 1:** Viết types + repo (Pool pattern y `CsdReportsRepository`: lazy Pool từ `AppConfigService.databaseUrl`, `OnModuleDestroy`).

- [ ] **Step 2:** Không cần Jest repo (I/O). Compile check:

```bash
cd services/ptt-crm-api && npx tsc --noEmit --pretty false | head
```

Expected: không lỗi `src/iwr`.

- [ ] **Step 3: Commit** `feat(iwr): add report and org repositories.`

---

### Task 5: Create / patch / submit / withdraw

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr-reports.service.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-reports.service.spec.ts`

**Interfaces:**

```ts
export class IwrReportsService {
  create(actor: IwrActor, input: {
    template_code: IwrTemplateCode;
    period_start?: string;
    period_end?: string;
  }): Promise<IwrReportDetail>;
  get(actor: IwrActor, id: string): Promise<IwrReportDetail>;
  patch(actor: IwrActor, id: string, input: {
    title?: string;
    sections_json?: Record<string, unknown>;
    rag?: IwrRag;
    cc_staff_ids?: number[];
    source_report_ids?: string[];
  }): Promise<IwrReportDetail>;
  submit(actor: IwrActor, id: string, input: {
    late_reason?: string;
    cc_staff_ids?: number[];
  }): Promise<IwrReportDetail>;
  withdraw(actor: IwrActor, id: string): Promise<IwrReportDetail>;
}
```

Rules:
- `create`: template active; period mặc định `iwrPeriodForTemplate`; daily + `!isIwrWorkday` → 400 `iwr_not_workday`; unique → 409 `iwr_period_exists`; title = `{name_vi} {period_start}`; recipients chưa ghi (nháp).
- `get`: author **hoặc** recipient **hoặc** ancestor của author **hoặc** `iwr.executive` / `iwr.manage`. Không thì 403.
- `patch`: chỉ author + status `draft|changes_requested`. Ack/waived/archived → 409 `iwr_immutable`. Weekly/monthly: nếu `rag` set phải thuộc enum.
- `submit`: author only; `draft|changes_requested` → `submitted` hoặc `supplemented` (nếu from changes_requested). Gọi `assertW1Recipients` với To=`reports_to_id`. Weekly **bắt** `rag` (từ sections.rag.body hoặc `report.rag`) → 400 `rag_required`. Nếu `isIwrLate` và `late_reason` trim &lt; 3 → 400 `late_reason_required`. Snapshot version, set `reviewer_staff_id`, `submitted_at`, `is_late`.
- `withdraw`: author + status `submitted|supplemented` + chưa ack + chưa có comment của reviewer → `draft`. Nếu đã có comment reviewer → 409 `iwr_bad_transition`.

Notify (gọi stub `notify` inject): submit → To `iwr_report_submitted`; mỗi Cc `iwr_report_cc`.

- [ ] **Step 1: Failing tests** — mock repo + org + notify:

```ts
function actor(id = 3): IwrActor {
  return { staffId: id, staffLabel: 'NV', departmentId: 10, caps: [{ section: 'iwr', action: 'write' }] };
}

it('creates today daily and rejects weekend daily', async () => {
  repo.getTemplateByCode.mockResolvedValue({
    id: 't1', code: 'daily_work', name_vi: 'Báo cáo ngày', kind: 'daily',
    sections_json: ['general','done','wip','next','blocked','approvals','notes'],
    due_rule_json: {}, active: true,
  });
  org.getStaff.mockResolvedValue({ id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true });
  repo.insertReport.mockResolvedValue({ id: 'r1', status: 'draft', template_code: 'daily_work' });
  const svc = makeSvc();
  await expect(svc.create(actor(), { template_code: 'daily_work' })).resolves.toBeTruthy();
  await expect(
    svc.create(actor(), { template_code: 'daily_work', period_start: '2026-09-05', period_end: '2026-09-05' }),
  ).rejects.toMatchObject({ response: { error: 'iwr_not_workday' } });
});

it('submit locks To to manager and requires late_reason after due', async () => {
  repo.getReport.mockResolvedValue({
    id: 'r1', status: 'draft', author_staff_id: 3, template_code: 'daily_work',
    due_at: '2026-09-03T17:00:00.000+07:00', sections_json: emptySectionsForCode('daily_work'),
  });
  org.getStaff.mockResolvedValue({ id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true });
  org.listActiveStaff.mockResolvedValue([
    { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
    { id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true },
  ]);
  const svc = makeSvc(new Date('2026-09-03T18:00:00+07:00'));
  await expect(svc.submit(actor(), 'r1', {})).rejects.toMatchObject({
    response: { error: 'late_reason_required' },
  });
});
```

Helper `makeSvc(now?)` inject `nowFn: () => Date` vào constructor (mặc định `() => new Date()`).

- [ ] **Step 2: RED**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/iwr/iwr-reports.service.spec.ts --no-coverage
```

- [ ] **Step 3: Implement service** — map `IwrPolicyError` → `ForbiddenException({ error })`. Unique → `ConflictException({ error: 'iwr_period_exists' })`.

- [ ] **Step 4: PASS**.

- [ ] **Step 5: Commit** `feat(iwr): create patch submit and withdraw reports.`

---

### Task 6: Ack, request-changes, waive

**Files:**
- Modify: `services/ptt-crm-api/src/iwr/iwr-reports.service.ts`
- Modify: `services/ptt-crm-api/src/iwr/iwr-reports.service.spec.ts`

**Interfaces:**

```ts
class IwrReportsService {
  acknowledge(actor: IwrActor, id: string): Promise<IwrReportDetail>;
  requestChanges(actor: IwrActor, id: string, input: {
    body_text: string;
    section_key?: string;
  }): Promise<IwrReportDetail>;
  waive(actor: IwrActor, id: string, input: { reason: string }): Promise<IwrReportDetail>;
}
```

Rules:
- `acknowledge`: status `submitted|supplemented`; actor = `reviewer_staff_id` **hoặc** `iwr.manage`; cap `iwr.review` (manage bypass). Set `acknowledged_at`. Immutable sau đó.
- `requestChanges`: cùng quyền ack; `body_text.trim().length >= 3` else 400 `comment_required`; **insert comment trước** `updateStatus('changes_requested')` (BR-38). Notify author `iwr_changes_requested`.
- `waive`: `iwr.manage` only; status `draft` (chưa nộp) hoặc tạo row waived cho kỳ (nếu chưa có report: service `waive` yêu cầu `id` của draft — UI tạo draft rồi waive). Reason ≥ 3. Notify author `iwr_report_waived`.

- [ ] **Step 1: Failing tests**

```ts
it('acks only the To reviewer', async () => {
  repo.getReport.mockResolvedValue({
    id: 'r1', status: 'submitted', author_staff_id: 3, reviewer_staff_id: 2, sections_json: {},
  });
  await expect(svc.acknowledge(actor(3), 'r1')).rejects.toMatchObject({
    response: { error: 'iwr_not_direct_manager' },
  });
  repo.updateStatus.mockResolvedValue({ id: 'r1', status: 'acknowledged' });
  await expect(svc.acknowledge({ ...actor(2), caps: [{ section: 'iwr', action: 'review' }] }, 'r1'))
    .resolves.toMatchObject({ status: 'acknowledged' });
});

it('inserts comment before changes_requested', async () => {
  const order: string[] = [];
  repo.getReport.mockResolvedValue({
    id: 'r1', status: 'submitted', author_staff_id: 3, reviewer_staff_id: 2, sections_json: {},
  });
  repo.insertComment.mockImplementation(async () => {
    order.push('comment');
    return { id: 'c1' };
  });
  repo.updateStatus.mockImplementation(async () => {
    order.push('status');
    return { id: 'r1', status: 'changes_requested' };
  });
  await svc.requestChanges(
    { ...actor(2), caps: [{ section: 'iwr', action: 'review' }] },
    'r1',
    { body_text: 'Thiếu evidence' },
  );
  expect(order).toEqual(['comment', 'status']);
  await expect(
    svc.requestChanges({ ...actor(2), caps: [{ section: 'iwr', action: 'review' }] }, 'r1', { body_text: 'x' }),
  ).rejects.toMatchObject({ response: { error: 'comment_required' } });
});
```

- [ ] **Step 2: RED** · **Step 3: Implement** · **Step 4: PASS**

- [ ] **Step 5: Commit** `feat(iwr): acknowledge, request-changes, and waive.`

---

### Task 7: Inbox, directory, team tree

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr-inbox.service.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-inbox.service.spec.ts`

**Interfaces:**

```ts
export class IwrInboxService {
  list(actor: IwrActor, box: IwrInboxBox): Promise<{ items: IwrReportRow[] }>;
  directory(actor: IwrActor, q: string, purpose: 'cc' | 'to' | 'mention'): Promise<{ items: IwrStaffNode[] }>;
  team(actor: IwrActor, query: {
    period_start: string;
    period_end: string;
    template_code?: string;
  }): Promise<{
    nodes: Array<IwrStaffNode & { report: IwrReportRow | null; derived: 'missing' | 'draft' | 'submitted' | 'late' | 'waived' | 'acked' }>;
  }>;
}
```

`directory`: `purpose=to` W1 trả **chỉ** QLTT của actor (0–1 người). `purpose=cc` filter bằng `assertW1Recipients` từng ứng viên (nuốt lỗi, bỏ người sai). `purpose=mention` = cùng phòng hoặc trên cây. `q` min 0 (empty → top 20 cùng phòng). LIMIT 20. Không trả `active=false`.

`team`: subtree `descendantIds(actor.staffId)` + chính mình. Nếu `iwr.executive` / `iwr.manage`: cả forest. Gắn report kỳ (list theo period+template). `derived`: không row → `missing`; draft → `draft`; is_late submitted → `late`; v.v.

- [ ] **Step 1: Failing tests**

```ts
it('filters cc directory by W1 policy', async () => {
  org.searchDirectory.mockResolvedValue([
    { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
    { id: 4, name: 'AM', email: 'a', department_id: 20, reports_to_id: 1, active: true },
  ]);
  org.getStaff.mockResolvedValue({ id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true });
  org.listActiveStaff.mockResolvedValue(/* same 4 nodes as Task 2 */);
  const out = await inbox.directory(actor(3), 'a', 'cc');
  expect(out.items.map((x) => x.id)).toEqual([2]);
});

it('team marks missing when no report in period', async () => {
  org.listActiveStaff.mockResolvedValue([
    { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
    { id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true },
  ]);
  reports.listForPeriod.mockResolvedValue([]);
  const out = await inbox.team({ ...actor(2), caps: [{ section: 'iwr', action: 'review' }] }, {
    period_start: '2026-09-03', period_end: '2026-09-03', template_code: 'daily_work',
  });
  expect(out.nodes.find((n) => n.id === 3)?.derived).toBe('missing');
});
```

Thêm `listForPeriod(period_start, period_end, template_code?)` vào repository.

- [ ] **Step 2–4:** RED / impl / PASS

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/iwr/iwr-inbox.service.spec.ts --no-coverage
```

- [ ] **Step 5: Commit** `feat(iwr): inbox directory and team period tree.`

---

### Task 8: Comments, notify, audit, PDF + Nest HTTP

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr-export.util.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-export.util.spec.ts`
- Create: `services/ptt-crm-api/src/iwr/guards/staff-iwr.guard.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-reports.controller.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-inbox.controller.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-templates.controller.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr.module.ts`
- Modify: `services/ptt-crm-api/src/csd/csd.module.ts` — export `CsdNotificationsRepository`, `CsdAuditRepository`
- Modify: `services/ptt-crm-api/src/app.module.ts` — `IwrModule`
- Modify: `services/ptt-crm-api/src/iwr/iwr-reports.service.ts` — `addComment`, `exportPdf`, audit hooks

**Interfaces:**

```ts
export function renderIwrReportPdf(detail: {
  title: string;
  author_name: string;
  period_start: string;
  period_end: string;
  status: string;
  sections: { key: string; label: string; body: string }[];
}): Promise<Buffer>;

@Controller('api/crm/iwr')
@UseGuards(StaffOrInternalKeyGuard, StaffIwrGuard)
class IwrInboxController {
  @Get('inbox') list(@Query('box') box: IwrInboxBox);
  @Get('directory') directory(@Query('q') q: string, @Query('purpose') purpose: string);
  @Get('team') team(@Query('period_start') a: string, @Query('period_end') b: string, @Query('template_code') c?: string);
}

@Controller('api/crm/iwr/templates')
class IwrTemplatesController {
  @Get() list();
  @Patch(':id') update(@Body() body: { name_vi?: string; sections_json?: string[]; due_rule_json?: object }); // iwr.manage
}

@Controller('api/crm/iwr/reports')
class IwrReportsController {
  @Post() create;
  @Get() listMine;
  @Get(':id') get;
  @Patch(':id') patch;
  @Post(':id/submit') submit;
  @Post(':id/withdraw') withdraw;
  @Post(':id/acknowledge') acknowledge; // iwr.review
  @Post(':id/request-changes') requestChanges;
  @Post(':id/waive') waive; // iwr.manage
  @Get(':id/comments') listComments;
  @Post(':id/comments') addComment;
  @Get(':id/export.pdf') exportPdf;
}
```

Guard copy `StaffCsdGuard`, section `'iwr'`, errors `iwr_unresolved_staff` / `missing_cap`.

`renderIwrReportPdf`: pdfkit, dòng đầu **không** chứa «khách» / client. Test:

```ts
it('pdf starts with %PDF and has no client-share wording', async () => {
  const buf = await renderIwrReportPdf({
    title: 'Báo cáo ngày 2026-09-03',
    author_name: 'NV A',
    period_start: '2026-09-03',
    period_end: '2026-09-03',
    status: 'submitted',
    sections: [{ key: 'done', label: 'Việc xong', body: 'Xong ticket' }],
  });
  expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  expect(buf.toString('latin1').includes('Gửi khách')).toBe(false);
});
```

Audit actions: `iwr.create` `iwr.submit` `iwr.acknowledge` `iwr.request_changes` `iwr.waive` `iwr.export_pdf` — `entity_type='iwr_report'`.

Notify events: `iwr_report_submitted` `iwr_report_cc` `iwr_changes_requested` `iwr_report_waived` `iwr_comment_added` (nếu comment không phải chính request-changes).

`IwrModule` imports `ConfigModule`, `StaffAuthModule`, `CsdModule`.

- [ ] **Step 1:** PDF test RED · **Step 2:** impl PDF · **Step 3:** PASS export spec

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/iwr/iwr-export.util.spec.ts --no-coverage
```

- [ ] **Step 4:** Wire controllers + module + export Csd repos.

- [ ] **Step 5:**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest --testPathPattern='src/iwr' --no-coverage
```

Expected: all PASS.

- [ ] **Step 6: Commit** `feat(iwr): expose /api/crm/iwr HTTP, PDF, notify, and audit.`

---

### Task 9: ops-web client + nav + shells

**Files:**
- Create: `services/ops-web/src/lib/crm/iwr-api.ts`
- Create: `services/ops-web/src/lib/crm/iwr-nav.util.ts`
- Create: `services/ops-web/src/lib/crm/iwr-nav.util.spec.ts` (nếu ops-web có vitest; **nếu không** bỏ file spec, test e2e Task 12)
- Create: `services/ops-web/src/components/crm/iwr/useIwrPageAuth.ts` — copy `useCsdPageAuth`, cap `iwr`
- Create: `services/ops-web/src/app/crm/internal-reports/page.tsx`
- Create: `services/ops-web/src/app/crm/internal-reports/inbox/page.tsx`
- Create: `services/ops-web/src/app/crm/internal-reports/team/page.tsx`
- Create: `services/ops-web/src/app/crm/internal-reports/templates/page.tsx`
- Modify: `services/ops-web/src/components/OpsNav.tsx`

**Client functions (đủ chữ ký):**

```ts
export function canSeeIwrNav(user: StoredStaffUser | null | undefined): boolean {
  return !!user && hasCap(user, 'iwr', 'view');
}

export async function fetchIwrReports(token: string): Promise<{ items: IwrReportRow[] }>;
export async function createIwrReport(token: string, input: { template_code: string }): Promise<IwrReportRow>;
export async function fetchIwrReport(token: string, id: string): Promise<IwrReportDetail>;
export async function patchIwrReport(token: string, id: string, body: object): Promise<IwrReportDetail>;
export async function submitIwrReport(token: string, id: string, body?: { late_reason?: string; cc_staff_ids?: number[] }): Promise<IwrReportDetail>;
export async function withdrawIwrReport(token: string, id: string): Promise<IwrReportDetail>;
export async function ackIwrReport(token: string, id: string): Promise<IwrReportDetail>;
export async function requestIwrChanges(token: string, id: string, body: { body_text: string; section_key?: string }): Promise<IwrReportDetail>;
export async function waiveIwrReport(token: string, id: string, body: { reason: string }): Promise<IwrReportDetail>;
export async function fetchIwrInbox(token: string, box: IwrInboxBox): Promise<{ items: IwrReportRow[] }>;
export async function fetchIwrDirectory(token: string, q: string, purpose: string): Promise<{ items: IwrStaffNode[] }>;
export async function fetchIwrTeam(token: string, qs: Record<string, string>): Promise<{ nodes: IwrTeamNode[] }>;
export async function fetchIwrTemplates(token: string): Promise<{ items: IwrTemplateRow[] }>;
export function iwrPdfUrl(id: string): string; // `${API_BASE}/api/crm/iwr/reports/${id}/export.pdf`
```

Fetch wrapper: copy `csd-api.ts` (`API_BASE`, `parseJson`, `Authorization: Bearer`).

`OpsNav`:
- `PAGE_TITLES['/crm/internal-reports'] = 'BC công việc'`
- `PAGE_TITLES['/crm/internal-reports/inbox'] = 'Hộp thư BC'`
- `PAGE_TITLES['/crm/internal-reports/team'] = 'Cây kỳ'`
- `PAGE_TITLES['/crm/internal-reports/templates'] = 'Mẫu BC nội bộ'`
- Section mới **sau** `Nhân sự & Hiệu suất`:

```ts
const toChuc: NavLink[] = [];
if (canSeeIwrNav(user)) {
  toChuc.push({ href: '/crm/internal-reports', label: 'BC công việc' });
  toChuc.push({ href: '/crm/internal-reports/inbox', label: 'Hộp thư BC' });
  toChuc.push({ href: '/crm/internal-reports/team', label: 'Cây kỳ' });
  if (hasCap(user, 'iwr', 'manage')) {
    toChuc.push({ href: '/crm/internal-reports/templates', label: 'Mẫu BC nội bộ' });
  }
}
if (toChuc.length) sections.push({ label: 'Tổ chức', links: toChuc, defaultOpen: true });
```

**Cấm** thêm link IWR vào section `Service Desk`.

List page CTA: `Mở hôm nay` (`daily_work`), `Mở tuần này` (`weekly_work`). Banner cố định: `Nội bộ — không gửi khách trừ khi đã duyệt ngoại`.

Inbox: 4 tab `Cần xử lý | Chưa đọc | Đã nhận | Đã gửi` (+ nháp trên list chính).

Team: date input kỳ + bảng tên / trạng thái derived / link báo cáo.

Templates: `iwr.manage` — sửa `name_vi` only ở W1 (sections khoá).

- [ ] **Step 1:** Viết files. Không import `@/lib/crm/csd-api` trong iwr pages.

- [ ] **Step 2:** Typecheck ops-web:

```bash
cd services/ops-web && npx tsc --noEmit --pretty false | head -n 40
```

Expected: không lỗi `internal-reports` / `iwr-`.

- [ ] **Step 3: Commit** `feat(iwr): add ops-web shells and Tổ chức nav.`

---

### Task 10: Editor UI

**Files:**
- Create: `services/ops-web/src/components/crm/iwr/IwrReportEditor.tsx`
- Create: `services/ops-web/src/app/crm/internal-reports/[id]/page.tsx`

**Editor behavior:**
- Autosave `patch` debounce 800ms khi `draft|changes_requested`.
- Section theo `template_code` (keys từ detail). `blocked` = list item `{ title, description, severity }` tối thiểu 0–n; nút «Thêm blocker».
- Weekly: radio RAG bắt buộc trước Nộp.
- Cc: typeahead `fetchIwrDirectory(..., 'cc')`. To hiển thị tên QLTT, disabled.
- Nộp: nếu now &gt; due → modal lý do muộn. Không checkbox «Gửi khách». Không `shareToClientChat`.
- Reviewer (`iwr.review` + mình là To): nút **Xác nhận** / **Yêu cầu bổ sung** (textarea ≥ 3).
- Comment: list + form `section_key` optional (`Chung` = `''`).
- PDF: `<a href={iwrPdfUrl(id)}>` mở tab.
- Status `acknowledged|waived|archived`: inputs disabled.

- [ ] **Step 1:** Implement editor + detail page (`StaffPageShell` + `useIwrPageAuth('view')`).

- [ ] **Step 2:** `tsc --noEmit` ops-web lại.

- [ ] **Step 3: Commit** `feat(iwr): add internal report editor with To/Cc and review actions.`

---

### Task 11: E2E mock + guide + deploy script

**Files:**
- Create: `services/ops-web/e2e/iwr-w1.spec.ts`
- Create: `docs/huong-dan-su-dung/30-bao-cao-cong-viec-noi-bo.md`
- Create: `scripts/deploy_iwr_vps.sh`

**E2E** (pattern `csd-reports.spec.ts`: login fixture + `page.route` mock `/api/crm/iwr/**`):

```ts
test('staff opens today and submits without client-send control', async ({ page }) => {
  await page.goto('/crm/internal-reports');
  await expect(page.getByText('Nội bộ — không gửi khách')).toBeVisible();
  await page.getByRole('button', { name: 'Mở hôm nay' }).click();
  await expect(page).toHaveURL(/\/crm\/internal-reports\/r-daily/);
  await expect(page.getByText('Gửi khách')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nộp' }).click();
  await expect(page.getByText('Đã gửi')).toBeVisible();
});

test('manager inbox shows submitted report', async ({ page }) => {
  await page.goto('/crm/internal-reports/inbox');
  await page.getByRole('tab', { name: 'Cần xử lý' }).click();
  await expect(page.getByText('Báo cáo ngày 2026-09-03')).toBeVisible();
});
```

Mock tối thiểu: `POST /reports` → draft daily; `POST /:id/submit` → submitted; `GET /inbox?box=action` → 1 item.

Guide (VI): nộp ngày 17:00, To = QLTT, khác «Báo cáo SD», waived tay (admin), không AI.

`deploy_iwr_vps.sh`: copy `deploy_csd_vps.sh` — bước 0 `apply_pg_ddl_iwr.sh`; jest `--testPathPattern='src/iwr'`; **echo cấm** `PTT_IWR_LLM=1`.

- [ ] **Step 1:** Viết 3 file.

- [ ] **Step 2:** Chạy e2e nếu Playwright local có:

```bash
cd services/ops-web && npx playwright test e2e/iwr-w1.spec.ts --reporter=line
```

Expected: PASS (hoặc skip nếu thiếu browser — ghi trong PR). Jest API vẫn bắt buộc PASS.

- [ ] **Step 3: Commit** `feat(iwr): add W1 e2e, user guide, and deploy script.`

---

### Task 12: W1 gate (verification)

**Files:** none mới. Chạy lệnh, ghi `.local-dev/iwr-w1-gate-report.json` (untracked).

- [ ] **Step 1:**

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest --testPathPattern='src/iwr' --no-coverage
cd services/ops-web && npx tsc --noEmit --pretty false | head
```

Expected: Jest all PASS; tsc không lỗi iwr.

- [ ] **Step 2:** Manual UAT checklist (local hoặc VPS sau khi PO bảo deploy):
  1. NV A `Mở hôm nay` → nộp → B (QLTT) Inbox Cần xử lý.
  2. B yêu cầu bổ sung (comment) → A thấy `changes_requested` → bổ sung → nộp lại.
  3. B Xác nhận → sections khoá.
  4. Cc cùng phòng thấy Đã nhận; phòng khác 403/directory ẩn.
  5. PDF tải `%PDF`.
  6. `/crm/csd/reports` không list IWR; IWR không nút Gửi khách.
  7. Không có nút Tóm tắt AI.

- [ ] **Step 3:** **Không deploy** trừ khi PO bảo. Nếu deploy: `APPLY=1 ./scripts/deploy_iwr_vps.sh` rồi HUP `ptt-crm-api` + `ptt-ops-web`.

- [ ] **Step 4:** Commit không bắt buộc (gate report untracked). Đánh dấu W1 xong trên plan checkboxes.

**STOP.** Chờ PO UAT W1.

---

# Wave W2 — Bằng chứng + gộp

FR: MDM-02, DAILY-02/03, DAILY-05 bù, WEEKLY-01 rollup, WEEKLY-03 RAG, DIST-08 viewed, EXP-01 XLSX+CSV, TPL-03 cảnh báo. US-11, US-12.

---

### Task 13: Report items + evidence refs

**Files:**
- Append DDL: `iwr_report_items` (`report_id`, `section_key`, `title`, `body`, `ref_kind` `csd_ticket|lead|customer|url|none`, `ref_id`, `evidence_url`, `sort_order`)
- Create: `services/ptt-crm-api/src/iwr/iwr-items.service.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-items.service.spec.ts`
- Routes: `GET/POST/PATCH/DELETE /api/crm/iwr/reports/:id/items`

**Interfaces:**

```ts
export type IwrItemRow = {
  id: string;
  report_id: string;
  section_key: string;
  title: string;
  body: string;
  ref_kind: 'csd_ticket' | 'lead' | 'customer' | 'url' | 'none';
  ref_id: string | null;
  evidence_url: string | null;
  sort_order: number;
};

export class IwrItemsService {
  list(actor: IwrActor, reportId: string): Promise<{ items: IwrItemRow[] }>;
  add(actor: IwrActor, reportId: string, input: Omit<IwrItemRow, 'id' | 'report_id'>): Promise<IwrItemRow>;
  patch(actor: IwrActor, reportId: string, itemId: string, patch: Partial<IwrItemRow>): Promise<IwrItemRow>;
  remove(actor: IwrActor, reportId: string, itemId: string): Promise<{ ok: true }>;
}
```

`section_key=done` + `ref_kind=none` + empty `evidence_url` → **không** chặn nộp W2 (cảnh báo UI). Validate URL nếu `evidence_url` set.

- [ ] **Step 1: Test** `add` gắn `csd_ticket` lưu `ref_id`; patch trên acknowledged → 409 `iwr_immutable`.

- [ ] **Step 2–4:** RED / impl / PASS · **Step 5:** Commit `feat(iwr): add typed report items with evidence refs.`

---

### Task 14: Ticket / lead suggest (read-only)

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr-suggest.service.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-suggest.service.spec.ts`
- Modify: `services/ptt-crm-api/src/iwr/iwr-reports.controller.ts` — `GET :id/suggest`
- Modify: `services/ops-web/src/components/crm/iwr/IwrReportEditor.tsx` — panel «Gợi ý hôm nay»

**Interfaces:**

```ts
export type IwrSuggestHit = {
  kind: 'csd_ticket' | 'lead';
  id: string;
  label: string;
  reason: 'closed_today' | 'updated_today' | 'overdue' | 'blocked';
};

export class IwrSuggestService {
  suggestForReport(actor: IwrActor, reportId: string): Promise<{ items: IwrSuggestHit[] }>;
}
```

Đọc `CsdTicketsRepository` (đã export) + lead list qua query mỏng trong `IwrOrgRepository.listLeadUpdates(staffId, ymd)` — **SELECT only**, không `INSERT` ticket (tạo ticket từ dòng = W3).

Filter ticket: `assignee_staff_id = actor` và (`closed_at::date = period` OR `updated_at::date = period` OR overdue OR status blocked). LIMIT 20.

- [ ] **Step 1: Failing test**

```ts
it('returns closed_today tickets and does not write tickets', async () => {
  tickets.listForStaff.mockResolvedValue([
    { id: 't1', code: 'SD-1', title: 'Xong banner', status: 'closed', closed_at: '2026-09-03T10:00:00+07:00' },
  ]);
  const out = await suggest.suggestForReport(actor(3), 'r1');
  expect(out.items[0]).toMatchObject({ kind: 'csd_ticket', reason: 'closed_today', id: 't1' });
  expect(tickets.insert).not.toHaveBeenCalled();
});
```

- [ ] **Step 2–4:** RED / impl / PASS

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/iwr/iwr-suggest.service.spec.ts --no-coverage
```

- [ ] **Step 5: Commit** `feat(iwr): suggest CSD tickets and leads for daily items.`

---

### Task 15: Day → week rollup picker + RAG hint + viewed

**Files:**
- Create: `services/ptt-crm-api/src/iwr/iwr-rag.util.ts`
- Create: `services/ptt-crm-api/src/iwr/iwr-rag.util.spec.ts`
- Modify: `iwr-reports.service.ts` — `listRollupSources`, `applySources`, `markViewed`
- Routes: `GET /reports/:id/sources` · `POST /reports/:id/sources` `{ source_report_ids: string[] }` · `POST /reports/:id/viewed`

**Interfaces:**

```ts
export type IwrRagHint = {
  rag: Exclude<IwrRag, null>;
  reasons: string[];
};

export function computeRagHint(input: {
  overdue_p1: number;
  blocker_high: number;
  kpi_below: number;
}): IwrRagHint;

export class IwrReportsService {
  listEligibleSources(actor: IwrActor, weeklyId: string): Promise<{ items: IwrReportRow[] }>;
  applySources(actor: IwrActor, weeklyId: string, sourceIds: string[]): Promise<IwrReportDetail>;
  markViewed(actor: IwrActor, id: string): Promise<{ first_viewed_at: string }>;
}
```

`computeRagHint`: `blocker_high>=1 || overdue_p1>=1` → `red`; else `kpi_below>=1` → `yellow`; else `green`. Không ghi `report.rag` — chỉ `rag_hint` trên GET detail. User giữ RAG khác + `rag_override_reason` (PATCH).

`applySources`: mỗi source phải cùng author, `daily_work`, `period` nằm trong tuần, status không `draft`. Copy **không** đè `sections.highlights.body` / `rag` nếu user đã viết. Ghi `iwr_report_sources`. 400 `iwr_source_not_eligible` nếu sai kỳ.

`markViewed`: recipient To/Cc; set `first_viewed_at` một lần (idempotent).

- [ ] **Step 1: Tests**

```ts
it('hints red when blocker high and does not overwrite user rag', () => {
  expect(computeRagHint({ overdue_p1: 0, blocker_high: 1, kpi_below: 0 })).toEqual({
    rag: 'red',
    reasons: ['blocker_high'],
  });
});

it('rejects a daily outside the weekly period', async () => {
  repo.getReport.mockResolvedValue({
    id: 'w1', template_code: 'weekly_work', author_staff_id: 3,
    period_start: '2026-08-31', period_end: '2026-09-04', status: 'draft',
  });
  repo.getReport.mockResolvedValueOnce(/* weekly */).mockResolvedValueOnce({
    id: 'd1', template_code: 'daily_work', author_staff_id: 3,
    period_start: '2026-08-20', period_end: '2026-08-20', status: 'submitted',
  });
  await expect(svc.applySources(actor(3), 'w1', ['d1'])).rejects.toMatchObject({
    response: { error: 'iwr_source_not_eligible' },
  });
});
```

- [ ] **Step 2–4:** RED / impl / PASS · **Step 5:** Commit `feat(iwr): rollup picker, RAG hint, and first viewed.`

---

### Task 16: XLSX/CSV export + backfill day + W2 UI/e2e

**Files:**
- Modify: `iwr-export.util.ts` — `renderIwrReportXlsx`, `renderIwrReportCsv`
- Modify: controller `GET :id/export.xlsx` · `export.csv` — cap `iwr.export` (PDF vẫn `view`)
- Modify: `iwr-reports.service.ts` — `createBackfill(actor, { ymd })` (`iwr.manage` hoặc policy: chính author, ymd &lt; today, workday, chưa có row)
- Modify: editor — picker nguồn, chip RAG gợi ý, cảnh báo dòng xong không ref
- Create: `services/ops-web/e2e/iwr-w2.spec.ts`

**Interfaces:**

```ts
export function renderIwrReportXlsx(detail: Parameters<typeof renderIwrReportPdf>[0] & {
  items: { title: string; ref_kind: string; ref_id: string | null }[];
}): Promise<Buffer>;

export function renderIwrReportCsv(detail: Parameters<typeof renderIwrReportXlsx>[0]): string;
```

XLSX test: buffer zip `PK` header; sheet name `Bao cao`; không cột client.

- [ ] **Step 1: Test XLSX + backfill weekend → `iwr_not_workday`**

- [ ] **Step 2–4:** RED / impl / PASS + e2e: chọn ticket vào dòng xong; xem `Đã xem`.

- [ ] **Step 5: Commit** `feat(iwr): XLSX/CSV export and backfill daily reports.`

**W2 UAT:** ≥1 dòng có ref; rollup chọn dòng; RAG gợi ý Đỏ / user giữ Vàng + lý do; PDF/XLSX; viewed. **STOP.**

---

# Wave W3 — Phân phối doanh nghiệp

FR: DIST-01 đầy đủ, DIST-02 Bcc/subject/message, DIST-03/04/05 policy, DIST-06 đủ folder + FTS, DIST-07, DIST-08 log, DAILY-04 entity, DAILY-07 mention. US-02/04/08/13.

---

### Task 17: Bcc cap + recipient policies

**Files:**
- Append DDL: `iwr_recipient_policies (id, scope_json, rules_json, active)`
- Create: `iwr-policy.service.ts` + spec
- Modify: `iwr-recipient.util.ts` — `assertRecipients(policy, input)` thay hard-code khi policy row tồn tại; W1 fallback giữ nguyên
- Seed: GDKD/CEO `iwr.bcc`

**Interfaces:**

```ts
export function assertCanReceive(input: {
  actor: IwrActor;
  author: IwrStaffNode;
  nodes: IwrStaffNode[];
  toIds: number[];
  ccIds: number[];
  bccIds: number[];
  policy?: { allow_bcc: boolean; cc_mode: 'w1' | 'open' };
}): void;
```

`bccIds.length>0` và (`!hasCap iwr.bcc` hoặc `!policy.allow_bcc`) → `iwr_bcc_forbidden`. Bcc **không** trả về trong `GET` cho người không phải sender / không phải chính Bcc đó / không `iwr.manage`. Reply-all (Task 19) loại Bcc.

- [ ] **Step 1: Test** GDKD Bcc HR; NV GET không thấy HR id; NV không có cap → 403.

- [ ] **Step 2–5:** impl + commit `feat(iwr): Bcc policy and configurable recipient rules.`

---

### Task 18: Distribution lists

**Files:**
- Append DDL: `iwr_distribution_lists`, `iwr_list_members`
- Create: `iwr-lists.service.ts` + spec + `iwr-lists.controller.ts`
- Routes: `GET/POST /api/crm/iwr/lists` · `PATCH /lists/:id` · `POST /lists/:id/members` · `POST /lists/:id/preview-dynamic`
- UI: `/crm/internal-reports/lists` (`iwr.lists`)

**Interfaces:**

```ts
export type IwrListKind = 'static' | 'department' | 'role' | 'rule';
export type IwrListRow = {
  id: string;
  code: string;
  name_vi: string;
  owner_staff_id: number;
  kind: IwrListKind;
  rule_json: Record<string, unknown>;
  active: boolean;
};

export class IwrListsService {
  create(actor: IwrActor, input: Omit<IwrListRow, 'id' | 'owner_staff_id'>): Promise<IwrListRow>;
  resolveMembers(listId: string): Promise<number[]>;
}
```

`kind=department` + `rule_json.department_id` → mọi `crm_staff` active phòng đó. Submit report: `to` vẫn user; Cc có thể là list id → expand lúc nộp, snapshot `iwr_report_recipients`.

- [ ] **Step 1: Test** resolve phòng Marketing = 2 id; inactive list → rỗng.

- [ ] **Step 2–5:** impl + commit `feat(iwr): static and dynamic distribution lists.`

---

### Task 19: Reply / forward / mention + delivery log + FTS

**Files:**
- Append DDL: `iwr_distributions`, `iwr_delivery_logs`, `iwr_mentions`, `iwr_threads`; `tsvector` trên `iwr_reports.title` + `sections_json::text`
- Create: `iwr-distribution.service.ts` + spec
- Routes: `POST /reports/:id/reply` · `reply-all` · `forward` · `GET /delivery-logs`

**Interfaces:**

```ts
export class IwrDistributionService {
  reply(actor: IwrActor, id: string, input: { body_text: string; mention_staff_ids?: number[] }): Promise<IwrCommentRow>;
  replyAll(actor: IwrActor, id: string, input: { body_text: string }): Promise<IwrCommentRow>;
  forward(actor: IwrActor, id: string, input: { to_staff_ids: number[]; note: string }): Promise<{ distribution_id: string }>;
}
```

`replyAll`: recipients = To + Cc + author − self − mọi Bcc. Forward: `assertCanReceive` từng To mới; HR/finance `sensitivity` → 403 `iwr_recipient_masked`. Mention → notify `iwr_mention`. Delivery log row: `channel='in_app'`, `status='delivered'`, snapshot to/cc/bcc.

Inbox W3 folders map query `box=`: `waiting` `needs_changes` `blockers` `approvals` `archived` `trash` (trash = `is_deleted` soft, retention 30 ngày — cron W4).

- [ ] **Step 1: Test** reply-all không chứa bcc staff 99; forward confidential → 403.

- [ ] **Step 2–5:** impl + commit `feat(iwr): reply, forward, mentions, and delivery logs.`

---

### Task 20: Risk entity + W3 UI/e2e

**Files:**
- Append DDL: `iwr_risks`
- Create: `iwr-risks.service.ts` + spec + controller
- Routes: `GET/POST /api/crm/iwr/risks` · `POST /risks/:id/close` · `POST /risks/:id/assign`
- UI: section blocked promote → risk; inbox tab Blocker

**Interfaces:**

```ts
export type IwrRiskRow = {
  id: string;
  report_id: string | null;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  owner_staff_id: number | null;
  status: 'open' | 'mitigating' | 'closed';
  due_at: string | null;
};

export class IwrRisksService {
  createFromBlocker(actor: IwrActor, reportId: string, itemId: string): Promise<IwrRiskRow>;
}
```

`severity=critical` → notify owner + QLTT ngay (`iwr_risk_critical`, severity `critical`) — không chờ digest. Test: `notify.insert` gọi ≤ cùng tick (không setTimeout).

- [ ] **Step 1–5:** TDD + e2e US-13 Bcc + commit `feat(iwr): risk entity and W3 mailbox folders.`

**W3 UAT:** US-13; Reply-all sạch Bcc; DL; risk critical notify. **STOP.**

---

# Wave W4 — Dashboard + lịch

FR: DASH-01…04, DIST-09, DIST-10 SMTP nội bộ, NOTI-01/03, MDM-01 leave, MDM-03 calendar. US-06 một phần, US-09 in-app+email nội bộ.

---

### Task 21: Four dashboards + nightly snapshot

**Files:**
- Append DDL: `iwr_dash_snapshots (role, period_ymd, payload_json, computed_at)`
- Create: `iwr-dashboards.service.ts` + spec + `iwr-dashboards.controller.ts`
- Route: `GET /api/crm/iwr/dashboards/:role` `role=staff|leader|pm|bod`
- UI: `/crm/internal-reports/dashboards`
- Deeplink chip: Owner Weekly / CEO Tower **chỉ** link `/crm/internal-reports/dashboards?role=bod` — không ghi `ceo_command_turns`

**Interfaces:**

```ts
export type IwrDashStaff = {
  due_today: boolean;
  inbox_unread: number;
  my_late_rate_30d: number;
  open_blockers: number;
};
export type IwrDashLeader = {
  submitted: number;
  missing: number;
  late: number;
  action_needed: number;
  rag_red: number;
  open_blockers: number;
};
export type IwrDashPm = {
  client_blockers: number;
  unread_over_sla: number;
  overdue_tickets: number;
};
export type IwrDashBod = {
  submit_rate: number;
  rag_red_list: { report_id: string; author_name: string }[];
  critical_risks: number;
  pending_acks: number;
};

export class IwrDashboardsService {
  get(actor: IwrActor, role: 'staff' | 'leader' | 'pm' | 'bod'): Promise<unknown>;
  refreshSnapshot(ymd: string): Promise<void>;
}
```

`bod` cần `iwr.executive`. `pm` cần `iwr.review`. p95: đọc snapshot nếu `computed_at` &lt; 15 phút; else compute sync + upsert.

- [ ] **Step 1: Test** staff dash không gồm doanh thu; bod không cap → 403.

- [ ] **Step 2–5:** impl + commit `feat(iwr): role dashboards and snapshots.`

---

### Task 22: Schedules, digest, reminder worker

**Files:**
- Append DDL: `iwr_calendars`, `iwr_calendar_exceptions`, `iwr_schedules`, `iwr_jobs`
- Create: `iwr-schedule.worker.ts` + `iwr-schedule-worker.service.ts` (setInterval 5 phút, `FOR UPDATE SKIP LOCKED` như CSD)
- Create: spec idempotent BR-40
- UI: `/crm/internal-reports/schedules` (`iwr.schedule`)

**Interfaces:**

```ts
export type IwrScheduleRow = {
  id: string;
  kind: 'reminder' | 'digest' | 'precreate';
  cron_expr: string;
  timezone: 'Asia/Ho_Chi_Minh';
  channel: 'in_app';
  active: boolean;
};

export function reminderEventKey(staffId: number, templateId: string, periodStart: string, event: string): string;
export class IwrScheduleWorker {
  tick(now: Date): Promise<{ ran: number }>;
}
```

`reminderEventKey` = `iwr_remind:${staffId}:${templateId}:${periodStart}:${event}` (`before_due|due|overdue`). Worker insert notify **một lần** / key (unique trên `csd_notifications` không có — dùng `iwr_jobs (event_key UNIQUE)`). Skip nếu leave (Task 23) / waived / đã submitted.

Precreate 06:00 VN: tạo draft daily cho mọi staff active có QLTT nếu chưa có.

Digest 08:00: leader `missing+blockers+action`.

- [ ] **Step 1: Test** tick 2 lần cùng key → 1 notify; weekend daily không precreate.

- [ ] **Step 2–5:** impl + commit `feat(iwr): reminder digest and precreate worker.`

---

### Task 23: Internal SMTP, leave→waive, delegations, files

**Files:**
- Append DDL: `iwr_delegations (delegator, delegate, starts_at, ends_at, active)`
- Reuse `csd_attachments` `entity_type='iwr_item'|'iwr_report'` — **không** `visibility='client'`
- Modify: `IwrReportsService.acknowledge` — delegate còn hiệu lực được ack
- Create: `iwr-leave.adapter.ts` — đọc `staff_leave_requests` (`date_from`, `date_to`, `status IN ('approved')`). Join INTEGER `crm_staff.id` → UUID user: `crm_staff.email` = `staff_leave_requests.staff_email` (cùng cách `resolveCrmStaffUserId` map email). Không invent bảng leave mới.
- SMTP: `CsdEmailService.send` **chỉ** khi mọi recipient email kết thúc `@pttads.vn` (hoặc domain allowlist env `PTT_IWR_INTERNAL_EMAIL_DOMAINS=pttads.vn`). Ngoài domain → 400 `iwr_external_needs_approval` (chưa W6).
- File: mime allowlist + 100MB như CSD; `PTT_IWR_FILE_DIR` default `data/iwr-files`

**Interfaces:**

```ts
export function assertInternalEmailRecipients(emails: string[], domains: string[]): void;
export class IwrLeaveAdapter {
  isOnLeave(staffId: number, ymd: string): Promise<boolean>;
}
```

Worker: `isOnLeave` → auto `waive` draft ngày (reason `hr_leave`) + job key. Test: email `user@gmail.com` → throw `iwr_external_needs_approval`.

- [ ] **Step 1–5:** TDD + UI file input + commit `feat(iwr): internal SMTP, leave waive, delegations, files.`

**W4 UAT:** 4 dash; digest; email nội bộ; NV nghỉ → waived. **STOP.**

---

# Wave W5 — Builder + bảo mật field

FR: CUSTOM-01…04, TPL-02/03/04, APR-02, EXP JSON, BR-39 reopen, SEC masking. US-05/07.

---

### Task 24: Saved reports builder

**Files:**
- Append DDL: `iwr_saved_reports`, `iwr_dash_widgets`
- Create: `iwr-builder.service.ts` + spec + controller
- Routes: `GET/POST /saved-reports` · `POST /saved-reports/:id/run` · `POST /saved-reports/:id/share`
- UI: `/crm/internal-reports/builder`
- Chart: CSS/SVG hoặc Recharts nếu package đã có — **không** thêm Chart.js

**Interfaces:**

```ts
export type IwrSavedReport = {
  id: string;
  name_vi: string;
  owner_staff_id: number;
  query_json: {
    template_codes?: string[];
    statuses?: IwrReportStatus[];
    period_start?: string;
    period_end?: string;
    department_id?: number;
    rag?: IwrRag[];
  };
  viz: 'table' | 'kpi_tile' | 'rag_list';
};

export class IwrBuilderService {
  run(actor: IwrActor, id: string): Promise<{ rows: unknown[]; truncated: boolean }>;
}
```

`run`: LIMIT 5000; nếu count &gt; 100000 → 202 + `iwr_jobs` async (notify `iwr_export_ready`). Tôn trọng visibility `get()`.

- [ ] **Step 1: Test** run không trả report ngoài cây actor.

- [ ] **Step 2–5:** impl + commit `feat(iwr): custom report builder and widgets.`

---

### Task 25: Template fields, versions, masking

**Files:**
- Append DDL: `iwr_template_versions`, `iwr_template_fields`
- Create: `iwr-masking.util.ts` + spec
- Modify: templates admin — version `effective_from`; report giữ `template_version`

**Interfaces:**

```ts
export function maskSections(
  sections: Record<string, unknown>,
  fields: { key: string; sensitivity: 'internal' | 'hr' | 'finance' }[],
  viewer: IwrActor,
): Record<string, unknown>;
```

Viewer thiếu cap finance/HR → field `***`. Export PDF/XLSX/JSON cùng hàm. Test: AM xem không thấy `people` nếu sensitivity `hr`.

- [ ] **Step 1–5:** TDD + commit `feat(iwr): template versions and field masking.`

---

### Task 26: Approvals, reopen, webhooks, JSON export

**Files:**
- Append DDL: `iwr_approvals`, `iwr_webhooks`
- Create: `iwr-approvals.service.ts` + `iwr-webhooks.service.ts` + specs
- Routes: `GET/POST /approvals` · `POST /approvals/:id/decide` · `POST /webhooks/:id/test` · `GET /reports/:id/export.json` · `POST /reports/:id/reopen`
- `reopen`: `iwr.manage` + `reason.trim()>=5` + audit `iwr.reopen`; status → `draft`; không xoá versions

**Interfaces:**

```ts
export type IwrApprovalRow = {
  id: string;
  report_id: string;
  kind: 'budget' | 'scope' | 'extension' | 'staffing' | 'other';
  requester_staff_id: number;
  approver_staff_id: number;
  status: 'pending' | 'approved' | 'rejected';
  payload_json: Record<string, unknown>;
};

export function signWebhookBody(secret: string, body: string): string; // HMAC-SHA256 hex
```

Approve ngân sách **không** ghi payroll. Webhook POST JSON `{ event, report_id }` + header `X-Iwr-Signature`.

- [ ] **Step 1: Test** reopen không cap → 403; webhook test không ném nếu URL `https://`.

- [ ] **Step 2–5:** impl + commit `feat(iwr): approvals, reopen, webhooks, JSON export.`

**W5 UAT:** US-05/07; masking; reopen audit. **STOP.**

---

# Wave W6 — AI + kênh ngoài

FR: AI-01…03, DIST-10 ngoài, SEC-05/10, PWA. US-14.

---

### Task 27: LLM gateway (off by default)

**Files:**
- Create: `iwr-ai.service.ts` + spec + `iwr-ai.controller.ts`
- Routes: `POST /api/crm/iwr/ai/summaries` · `insights` · `feedback`
- Env: `PTT_IWR_LLM=0` (đọc `AppConfigService`, **default 0**)
- UI: nút «Tóm tắt AI» **chỉ** khi `GET /ai/status` `{ enabled: false|true }`

**Interfaces:**

```ts
export class IwrAiService {
  status(): { enabled: boolean };
  summarize(actor: IwrActor, reportId: string): Promise<{ text: string; citations: string[] }>;
}
```

`enabled=false` → mọi POST 404 `{ error: 'iwr_llm_disabled' }`. Khi on: prompt **chỉ** sections đã `maskSections` theo actor; cấm đưa report ngoài visibility. Output gắn `citations: report_id[]`. Không đổi KPI/status. Feedback `accept|dismiss|wrong` ghi audit `iwr.ai_feedback`.

- [ ] **Step 1: Test** flag 0 → 404; flag 1 + actor không thấy report → 403; prompt factory không chứa section masked.

- [ ] **Step 2–5:** impl (không bật trên VPS) + commit `feat(iwr): AI gateway behind PTT_IWR_LLM flag.`

---

### Task 28: External channels, secure links, PWA

**Files:**
- Append DDL: `iwr_external_shares (token, expires_at, revoked_at, allow_email)`
- Create: `iwr-external.service.ts` + spec
- Slack/Teams/Zalo: stub connector `IwrChannelAdapter.send(payload)` — implement adapter **chỉ** khi env `PTT_IWR_SLACK_WEBHOOK` / Teams / Zalo set; không set → skip
- PWA: `services/ops-web/public/iwr-manifest.json` + page `/crm/internal-reports/inbox` `display=standalone` (không rewrite app-wide manifest)
- Cap `iwr.external` + approval row (`iwr_approvals.kind` reuse hoặc status `external_pending`)

**Interfaces:**

```ts
export class IwrExternalService {
  requestShare(actor: IwrActor, reportId: string, email: string): Promise<{ approval_id: string }>;
  approveShare(actor: IwrActor, approvalId: string): Promise<{ url: string; expires_at: string }>;
  revoke(actor: IwrActor, shareId: string): Promise<{ ok: true }>;
}
```

Email ngoài: allowlist table/env; file nhạy → chỉ secure link, không attach. Test: `@gmail.com` không allowlist → 400; revoke → GET link 404.

- [ ] **Step 1–5:** TDD + guide §kênh ngoài + commit `feat(iwr): external share, connectors, and IWR PWA inbox.`

**W6 UAT:** US-14 trên VPS flag 0; AI không vượt quyền khi bật staging; ngoài org phải duyệt. **STOP — sản phẩm đủ SRS 2.0.**

---

## Spec coverage (self-review)

| SRS | Task |
|-----|------|
| FR-MDM-01 org / W4 leave+delegation | 2, 3, 23 |
| FR-MDM-02 đối tượng | 13–14 |
| FR-MDM-03 lịch W1 / W4 | 1, 22 |
| FR-MDM-04 directory | 7 |
| FR-TPL-01 seed / W5 version | 3, 25 |
| FR-TPL-02/03/04 fields | 25 |
| FR-DAILY-01…07 | 5–6, 10, 13–14, 20 |
| FR-WEEKLY-01…05 | 5, 10, 15 |
| FR-DIST-01…10 | 2, 5, 7, 17–19, 22–23, 28 |
| FR-CUSTOM-01…04 | 24 |
| FR-DASH-01…04 | 21 |
| FR-NOTI-01…03 | 8, 22 |
| FR-APR-01/02 | 6, 26 |
| FR-AI-01…03 | 27 |
| FR-EXP / FR-AUD | 8, 16, 26 |
| BR-32…40 | 5–6, 8, 12, 22, 27 |
| SCR-031…039 | 9–11, 18, 21–22, 24 |
| NFR-PERF/SEC | 7 LIMIT 20, 21 snapshot, 17 Bcc, 25 mask, 28 expiry |
| US-10…14 | 12, 16, 20, 27 |
| Ngoài phạm vi CSD/payroll/Kafka | Global Constraints |

Không còn FR SRS 2.0 thiếu task. W5 `iwr_okrs` / `iwr_projects`: **không** tạo trừ khi PO xác nhận thiếu master — Task 24 query dùng ticket/lead/department đã có.

## Execution notes

- Branch W1: `feat/iwr-w1`. Mỗi task 1 commit như message trên. Không `--no-verify`.
- Sau W1 merge: branch `feat/iwr-w2` … hoặc tiếp tục trên `feat/iwr-w1` nếu PO muốn 1 PR lớn — **không** trộn commit CSD.
- Không commit `.env`, không in password, không bật `PTT_IWR_LLM` trên VPS.
- Nếu một task chạm cả CSD export + IWR: CSD-only line = export 2 provider; logic IWR ở `src/iwr/**`.
