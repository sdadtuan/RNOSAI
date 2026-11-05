# Agency Communication & Service Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/crm/csd` — ticket có SLA + public/internal, chat native → ticket, email shared mailbox → ticket, báo cáo duyệt/gửi PDF; AI chỉ nháp; không đụng `crm_tickets` / CEO Command.

**Architecture:** Nest module mới `csd` trong `ptt-crm-api` (Postgres `csd_*`, JWT staff hiện có). ops-web routes `/crm/csd/*` tái dùng shell. Ticket là slice đầu tiên có thể UAT; chat/email/report/AI ghép sau cùng schema. SLA tick = worker Postgres skip-locked mỗi 60s, không Redis bắt buộc.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL · staff JWT + `staff_section_permissions` · SMTP/IMAP hiện có · không package mới trừ `imapflow` / `nodemailer` nếu chưa có trong api.

**Spec:** [CSD design](../specs/2026-09-02-agency-communication-service-desk-design.md) · [UX](../specs/2026-09-02-agency-csd-ux-ui-design.md) · [Use case](../specs/2026-09-02-agency-csd-use-cases.md) · **DDL:** [2026-09-02-postgresql-ddl-csd.sql](../../specs/2026-09-02-postgresql-ddl-csd.sql)

## Global Constraints

- API prefix **`/api/crm/csd`** (không `/api/v1`) — cùng JWT staff với CRM.
- Bảng **`csd_*` only**. Cấm INSERT/SELECT `crm_tickets` từ module CSD. Cấm ghi `ceo_command_turns`.
- Factory MVP **`A` only**. Reject `factory=B`.
- **BR-AI-01:** AI không gửi email/chat khách. Draft + log `csd_ai_interactions`. Gửi khách = user + (nếu policy) confirm.
- Internal note / file `visibility=internal` không vào Public Reply hoặc Client Chat (invariant test).
- Ticket `source_type + source_id` unique — tạo trùng trả ticket cũ.
- Out of Scope / Billable: không `in_progress` nếu chưa approval.
- Staff id = **INTEGER** JWT `staffId` (không UUID `staff_users.id`).
- `tenant_id` mặc định `'PTT'`.
- Copy UI tiếng Việt (UX §9). Không badge Stub. Không auto-scroll sang panel khác.
- VPS 3.3 GiB: không Ollama mới; AI CSD flag `PTT_CSD_LLM=0` mặc định.
- Không portal client, không omnichannel, không Ads/GA4 auto-pull.

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-09-02-postgresql-ddl-csd.sql` | Schema `csd_*` + seed SLA/template |
| `scripts/apply_pg_ddl_csd.sh` | Apply DDL |
| `scripts/deploy_csd_vps.sh` | Pull + DDL + build api/web + restart |
| `services/ptt-crm-api/src/csd/csd.types.ts` | Enums + DTO |
| `services/ptt-crm-api/src/csd/csd-ticket-status.util.ts` | Máy trạng thái |
| `services/ptt-crm-api/src/csd/csd-sla.util.ts` | Business minutes + remaining |
| `services/ptt-crm-api/src/csd/csd-visibility.util.ts` | Public vs internal |
| `services/ptt-crm-api/src/csd/guards/staff-csd.guard.ts` | Caps `csd` |
| `services/ptt-crm-api/src/csd/csd-tickets.repository.ts` | Persist tickets |
| `services/ptt-crm-api/src/csd/csd-tickets.service.ts` | Create/assign/status/resolve |
| `services/ptt-crm-api/src/csd/csd-tickets.controller.ts` | HTTP `/api/crm/csd/tickets` |
| `services/ptt-crm-api/src/csd/csd-sla.worker.ts` | Tick 60s |
| `services/ptt-crm-api/src/csd/csd-chat.*` | Conversations/messages |
| `services/ptt-crm-api/src/csd/csd-email.*` | IMAP + compose |
| `services/ptt-crm-api/src/csd/csd-reports.*` | Builder + send |
| `services/ptt-crm-api/src/csd/csd-ai.service.ts` | Draft only |
| `services/ptt-crm-api/src/csd/csd.module.ts` | Providers |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Section `csd` |
| `services/ops-web/src/app/crm/csd/**` | Pages |
| `services/ops-web/src/components/crm/csd/**` | UI |
| `services/ops-web/src/lib/crm/csd-api.ts` | Fetch wrappers |
| `services/ops-web/e2e/csd-tickets.spec.ts` | Isolation + happy path |

---

## Slice order

**CSD-0 DDL/caps → CSD-1 Ticket → CSD-2 Chat → CSD-3 Email → CSD-4 Report → CSD-5 AI + dashboard.**  
Không ship Chat/Email/Report trước khi Ticket create + SLA + public/internal pass test. Không bật `PTT_CSD_LLM=1` trên VPS cho đến CSD-5 UAT.

---

### Task 1: Apply DDL

**Files:**
- Exists: `docs/specs/2026-09-02-postgresql-ddl-csd.sql`
- Exists: `scripts/apply_pg_ddl_csd.sh`
- Test: `psql` verify (no Jest)

**Interfaces:**
- Consumes: spec §14
- Produces: tables `csd_tickets`, `csd_conversations`, `csd_emails`, `csd_reports`, `csd_sla_policies`, `csd_next_ticket_code()`

- [ ] **Step 1: Apply locally**

```bash
./scripts/apply_pg_ddl_csd.sh
```

Expected: `OK  CSD DDL applied`

- [ ] **Step 2: Verify isolation + seed**

```bash
psql "$DATABASE_URL" -c "\dt csd_*"
psql "$DATABASE_URL" -c "SELECT code FROM csd_sla_policies WHERE is_default;"
psql "$DATABASE_URL" -c "SELECT csd_next_ticket_code();"
psql "$DATABASE_URL" -c "SELECT to_regclass('crm_tickets');"
```

Expected: `PTT-DEFAULT`; code `PTT-2026-000001`; `crm_tickets` vẫn tồn tại (không drop).

- [ ] **Step 3: Commit** (DDL + script nếu chưa commit)

```bash
git add docs/specs/2026-09-02-postgresql-ddl-csd.sql scripts/apply_pg_ddl_csd.sh
git commit -m "$(cat <<'EOF'
feat(csd): add PostgreSQL schema for communication service desk

Lock csd_* tables so tickets, chat, email, and reports stay isolated from CSKH crm_tickets.
EOF
)"
```

---

### Task 2: Caps + guard

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` — thêm section `csd` cạnh `ceo_command`
- Create: `services/ptt-crm-api/src/csd/guards/staff-csd.guard.ts`
- Create: `services/ptt-crm-api/src/csd/guards/staff-csd.guard.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd.module.ts` (empty exports + guard)

**Interfaces:**
- Consumes: `StaffAuthService.loadCaps` pattern từ `staff-ceo-command.guard.ts`
- Produces: `@UseGuards(StaffCsdGuard)` với `requiredAction: 'view' | 'write' | 'assign' | 'manage' | 'admin'`

Caps trong catalog:

```json
"csd": ["view", "write", "assign", "manage", "admin"]
```

Section entry:

```json
{
  "id": "csd",
  "label": "Service Desk",
  "group": "CRM",
  "page": "/crm/csd",
  "description": "Ticket / chat / email / báo cáo agency — không phải ticket CSKH."
}
```

Map job function (seed SQL trong apply hoặc Task 2 follow-up):

| function | caps |
|----------|------|
| SUPER-ADMIN / admin | all |
| `am` | view, write |
| `pm` | view, write, assign |
| `leader` | view, write, assign, manage |
| design/content/ads/seo/tech | view, write |
| finance | view |

- [ ] **Step 1: Write failing guard spec**

```ts
it('denies staffId<=0', async () => {
  await expect(guard.canActivate(ctx({ staffId: 0, caps: ['csd:view'] }))).rejects.toMatchObject({ status: 403 });
});
it('allows view with csd:view', async () => {
  await expect(guard.canActivate(ctx({ staffId: 3, caps: ['csd:view'] }))).resolves.toBe(true);
});
it('denies write without csd:write', async () => {
  await expect(guard.canActivate(ctx({ staffId: 3, caps: ['csd:view'] }, 'write'))).rejects.toMatchObject({ status: 403 });
});
```

- [ ] **Step 2: Implement guard** — copy structure `StaffCeoCommandGuard`, section id `csd`.
- [ ] **Step 3: Run** `npx jest src/csd/guards/staff-csd.guard.spec.ts --no-coverage` — PASS
- [ ] **Step 4: Commit** `feat(csd): add staff guard and rbac catalog section`

---

### Task 3: Ticket status + visibility utils

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd.types.ts`
- Create: `services/ptt-crm-api/src/csd/csd-ticket-status.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-ticket-status.util.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-visibility.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-visibility.util.spec.ts`

**Interfaces:**

```ts
export const CSD_TICKET_STATUSES = [
  'draft', 'new', 'triaged', 'assigned', 'in_progress',
  'waiting_for_client', 'waiting_for_internal_approval', 'on_hold',
  'resolved', 'client_acceptance', 'closed',
  'cancelled', 'rejected', 'reopened', 'escalated',
] as const;
export type CsdTicketStatus = (typeof CSD_TICKET_STATUSES)[number];
export type CsdPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type CsdScopeStatus =
  | 'in_scope' | 'potentially_out_of_scope' | 'out_of_scope'
  | 'included_by_exception' | 'billable' | 'warranty';

export function canTransitionTicket(from: CsdTicketStatus, to: CsdTicketStatus): boolean;
export function canStartWork(scope: CsdScopeStatus, scopeApproved: boolean): boolean;
export function assertPublicAttachment(visibility: 'internal' | 'client' | 'restricted'): void;
```

Transitions — copy bảng Use case §14.4. `canStartWork`: `out_of_scope` → false; `billable` / `included_by_exception` → `scopeApproved`; còn lại true.

- [ ] **Step 1: Failing tests**

```ts
expect(canTransitionTicket('new', 'assigned')).toBe(true);
expect(canTransitionTicket('closed', 'in_progress')).toBe(false);
expect(canStartWork('out_of_scope', false)).toBe(false);
expect(canStartWork('in_scope', false)).toBe(true);
expect(() => assertPublicAttachment('internal')).toThrow(/internal/i);
```

- [ ] **Step 2: Implement maps** — `Record<CsdTicketStatus, CsdTicketStatus[]>`
- [ ] **Step 3: Jest PASS**
- [ ] **Step 4: Commit** `feat(csd): add ticket status machine and visibility rules`

---

### Task 4: SLA business-time util

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-sla.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-sla.util.spec.ts`

**Interfaces:**

```ts
export type CsdSlaPolicySlice = {
  workday_start: string; // '08:30'
  workday_end: string;   // '18:00'
  workdays: number[];    // 1=Mon .. 7=Sun
  holidays: string[];    // '2026-09-02'
  at_risk_pct: number;
  near_breach_pct: number;
};

export function addBusinessMinutes(start: Date, minutes: number, policy: CsdSlaPolicySlice): Date;
export function elapsedBusinessMs(from: Date, to: Date, policy: CsdSlaPolicySlice, pausedMs: number): number;
export function classifySlaStatus(usedPct: number, paused: boolean): 'on_track' | 'at_risk' | 'near_breach' | 'breached' | 'paused';
```

- [ ] **Step 1: Test** — Tuesday 09:00 + 60m → 10:00; Friday 17:30 + 60m → Monday 09:30; holiday skip; `classifySlaStatus(91, false) === 'near_breach'`; `classifySlaStatus(0, true) === 'paused'`.
- [ ] **Step 2: Implement** looping day-by-day, TZ `Asia/Ho_Chi_Minh`.
- [ ] **Step 3: Jest PASS**
- [ ] **Step 4: Commit** `feat(csd): add business-hours SLA calculator`

PTT-DEFAULT minutes (đã seed DDL): P1 60/240, P2 240/480, P3 480/1440, P4 960/2400.

---

### Task 5: Ticket repository + service + HTTP

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-tickets.repository.ts`
- Create: `services/ptt-crm-api/src/csd/csd-tickets.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-tickets.service.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-tickets.controller.ts`
- Create: `services/ptt-crm-api/src/csd/csd-audit.repository.ts`
- Modify: `csd.module.ts` — register
- Modify: `app.module.ts` — `CsdModule`

**Interfaces:**

```ts
export type CreateCsdTicketInput = {
  title: string;
  description?: string;
  ticket_type: string;
  priority: CsdPriority;
  client_account_id?: string;
  customer_id?: number | null;
  source_type?: 'manual' | 'chat_message' | 'email' | 'form' | 'ai_draft';
  source_id?: string | null;
  assignee_staff_id?: number | null;
  idempotency_key?: string;
};

export class CsdTicketsService {
  create(actorStaffId: number, input: CreateCsdTicketInput): Promise<CsdTicketRow>;
  get(actorStaffId: number, id: string): Promise<CsdTicketRow>;
  list(actorStaffId: number, q: CsdTicketListQuery): Promise<{ items: CsdTicketRow[]; next_cursor: string | null }>;
  assign(actorStaffId: number, id: string, assigneeStaffId: number): Promise<CsdTicketRow>;
  changeStatus(actorStaffId: number, id: string, to: CsdTicketStatus): Promise<CsdTicketRow>;
  addComment(actorStaffId: number, id: string, body: { visibility: 'public' | 'internal'; body_text: string; attachment_ids?: string[] }): Promise<CsdTicketCommentRow>;
  resolve(actorStaffId: number, id: string, body: { resolution_note: string; send_public?: boolean }): Promise<CsdTicketRow>;
}
```

HTTP (guard `view` GET, `write` POST/PATCH, `assign` assign):

```text
POST   /api/crm/csd/tickets
GET    /api/crm/csd/tickets
GET    /api/crm/csd/tickets/:id
POST   /api/crm/csd/tickets/:id/assign
POST   /api/crm/csd/tickets/:id/status
POST   /api/crm/csd/tickets/:id/comments
POST   /api/crm/csd/tickets/:id/resolve
GET    /api/crm/csd/tickets/:id/activities
```

Create flow: validate title → lookup source unique → `SELECT csd_next_ticket_code()` → resolve policy `PTT-DEFAULT` hoặc map → `addBusinessMinutes` for due → insert → activity `created` → audit → notify assignee/unassigned.

Resolve: `resolution_note` required else 422; `canTransition` to `resolved` or `client_acceptance`; `assertPublicAttachment` on public files.

Idempotency: insert `csd_idempotency_keys` ON CONFLICT return existing entity.

- [ ] **Step 1: Service spec** (mock repo)

```ts
it('returns existing ticket when source_ref repeats', async () => {
  repo.findBySource.mockResolvedValue({ id: 't1', code: 'PTT-2026-000001' });
  const row = await svc.create(3, { title: 'x', ticket_type: 'incident', priority: 'P2', source_type: 'chat_message', source_id: 'm1' });
  expect(row.code).toBe('PTT-2026-000001');
  expect(repo.insert).not.toHaveBeenCalled();
});
it('rejects resolve without note', async () => {
  await expect(svc.resolve(3, 't1', { resolution_note: '' })).rejects.toMatchObject({ status: 422 });
});
it('rejects in_progress when out_of_scope', async () => {
  repo.get.mockResolvedValue({ status: 'assigned', scope_status: 'out_of_scope' });
  await expect(svc.changeStatus(3, 't1', 'in_progress')).rejects.toMatchObject({ status: 409 });
});
```

- [ ] **Step 2: Implement repo SQL** — parameterized, `tenant_id='PTT'`, `is_deleted=false`
- [ ] **Step 3: Jest PASS** `src/csd/csd-tickets.service.spec.ts`
- [ ] **Step 4: Commit** `feat(csd): add ticket create assign status resolve APIs`

---

### Task 6: SLA worker

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-sla.worker.ts`
- Create: `services/ptt-crm-api/src/csd/csd-sla.worker.spec.ts`

**Interfaces:**

```ts
export async function tickCsdSla(now: Date, db: Pool): Promise<{ updated: number; escalated: number }>;
```

Query open tickets `FOR UPDATE SKIP LOCKED` limit 100. Recompute `usedPct` from `created_at` / `sla_resolution_due_at` + paused seconds. Update `sla_status`. At 70/90/100 insert notification + activity. P1 unassigned > 30 business minutes → `escalated`.

- [ ] **Step 1: Test** fake clock 100% → `breached` + notify called
- [ ] **Step 2: Interval 60s** in module `onModuleInit` (disable when `PTT_CSD_SLA_WORKER=0` for tests)
- [ ] **Step 3: Commit** `feat(csd): add SLA tick worker`

---

### Task 7: ops-web Ticket UI

**Files:**
- Create: `services/ops-web/src/lib/crm/csd-api.ts`
- Create: `services/ops-web/src/app/crm/csd/page.tsx` — redirect `/crm/csd/tickets` tạm
- Create: `services/ops-web/src/app/crm/csd/tickets/page.tsx`
- Create: `services/ops-web/src/app/crm/csd/tickets/[id]/page.tsx`
- Create: `services/ops-web/src/components/crm/csd/CsdTicketList.tsx`
- Create: `services/ops-web/src/components/crm/csd/CsdTicketDetail.tsx`
- Create: `services/ops-web/src/components/crm/csd/CsdTicketComposer.tsx`
- Modify: nav sidebar — nhóm Service Desk
- Create: `services/ops-web/e2e/csd-tickets.spec.ts`
- Modify: `globals.css` — class `csd-*` (không Tailwind mới)

**Interfaces (client):**

```ts
export function fetchCsdTickets(token: string, query: Record<string, string>): Promise<{ items: CsdTicketRow[] }>;
export function createCsdTicket(token: string, body: CreateCsdTicketInput): Promise<CsdTicketRow>;
export function postCsdComment(token: string, id: string, body: { visibility: 'public' | 'internal'; body_text: string }): Promise<void>;
```

UI theo [UX §4](../specs/2026-09-02-agency-csd-ux-ui-design.md): list table, detail 3 cột, composer Public/Internal, resolve modal. CTA copy: `Gửi cho khách hàng` / `Ghi chú nội bộ`.

E2e mock `/api/crm/csd/tickets**`:
- list 2 tickets
- create from UI
- public comment visible; internal labelled
- visit `/crm/tickets` vẫn CSKH fixture — **AT-ISO-01**

- [ ] **Step 1: Build** `cd services/ops-web && npm run build`
- [ ] **Step 2: E2e** `npx playwright test e2e/csd-tickets.spec.ts`
- [ ] **Step 3: Commit** `feat(csd): add ticket list and detail workspace`

---

### Task 8: Chat core + Chat → Ticket

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-chat.repository.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat.service.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat.controller.ts`
- Create: `services/ops-web/src/app/crm/csd/chat/page.tsx`
- Create: `services/ops-web/src/components/crm/csd/CsdChatWorkspace.tsx`
- Create: `services/ops-web/e2e/csd-chat.spec.ts`

**Interfaces:**

```ts
createConversation(actor, { kind, name_vi, client_account_id, project_ref? }): Conversation
sendMessage(actor, conversationId, { body_text, reply_to_id }): Message
createTicketFromMessage(actor, messageId, patch: Partial<CreateCsdTicketInput>): CsdTicketRow
```

Rules:
- `kind=client` bắt buộc `client_account_id` (BR-CHAT-01)
- Client conversation: message `visibility` luôn `client`
- `createTicketFromMessage` set `source_type='chat_message', source_id=message.id`; trùng → existing; set `csd_messages.ticket_id`
- Poll messages `GET .../messages?after=` mỗi 5s (không WS MVP)
- Test AT-ISO-02: sendMessage không insert `ceo_command_turns` (mock/spy)

HTTP:

```text
POST/GET /api/crm/csd/conversations
GET      /api/crm/csd/conversations/:id/messages
POST     /api/crm/csd/conversations/:id/messages
POST     /api/crm/csd/messages/:id/create-ticket
```

- [ ] **Step 1: Service spec** duplicate source + client visibility
- [ ] **Step 2: UI 3 cột** UX §5 — modal tạo ticket prefill
- [ ] **Step 3: Commit** `feat(csd): add native chat and create-ticket-from-message`

---

### Task 9: Email inbound + compose

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-email.repository.ts`
- Create: `services/ptt-crm-api/src/csd/csd-email.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-email-match.util.ts`
- Create: `services/ptt-crm-api/src/csd/csd-email-match.util.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-email-sync.worker.ts`
- Create: `services/ptt-crm-api/src/csd/csd-email.controller.ts`
- Create: `services/ops-web/src/app/crm/csd/email/page.tsx`
- Create: `services/ops-web/src/app/crm/csd/email/unmatched/page.tsx`

**Interfaces:**

```ts
export function parseTicketCodeFromSubject(subject: string): string | null; // [PTT-2026-000123]
export function isIgnorableInbound(headers: Record<string, string>): boolean; // Auto-Submitted, Precedence junk
export function needsEmailApproval(subject: string, body: string): boolean;
// keywords: báo giá, hoàn tiền, cam kết, khiếu nại, phạt, hủy hợp đồng
```

Inbound worker (5 phút): IMAP mailbox `support` → skip ignorable → match provider_message_id → parse code → append or create ticket → unmatched nếu không client.

Outbound: `POST /api/crm/csd/emails/send` — nếu `needsEmailApproval` và không cap manage → tạo `csd_approvals` kind=email, không SMTP.

- [ ] **Step 1: Util Jest** — subject parse, spam skip, keyword approval
- [ ] **Step 2: Service** create-from-email uses same `source_type='email'` unique
- [ ] **Step 3: Commit** `feat(csd): add shared mailbox inbound and CRM compose`

---

### Task 10: Report builder + approve + send

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-reports.repository.ts`
- Create: `services/ptt-crm-api/src/csd/csd-reports.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-reports.service.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-reports.controller.ts`
- Create: `services/ops-web/src/app/crm/csd/reports/page.tsx`
- Create: `services/ops-web/src/app/crm/csd/reports/[id]/page.tsx`

**Interfaces:**

```ts
createReport({ template_code, client_account_id, period_start, period_end }): Report // version v1.0
submitReview(id, approver_staff_id): Report // weekly_ops may skip if template.requires_approval=false
approve(id): Report
send(id, { to, subject, body }): SendLog // 409 unless approved; PDF via existing print path or simple HTML→PDF
createRevisedVersion(id): Report // after sent; old version immutable
```

Sent report `PATCH` sections → 409. Test that.

Ticket rollup: closed/breached in `[period_start, period_end]` for client → section `work_completed` / `risks` JSON.

- [ ] **Step 1: Service spec** send-before-approve 409; sent immutable; weekly_ops send without director
- [ ] **Step 2: UI** UX §7 — outline + editor + approval tab
- [ ] **Step 3: Commit** `feat(csd): add report versions approval and email send`

---

### Task 11: AI drafts (flag off)

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-ai.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-ai.service.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-ai.controller.ts`

**Interfaces:**

```ts
summarizeChat(actor, conversationId, period: '24h' | '7d' | 'all'): { summary, decisions, actions, risks }
classifyTicket(actor, ticketId): { ticket_type, priority, tags } // suggestion only
draftReply(actor, ticketId): { body_text } // never SMTP
```

Khi `PTT_CSD_LLM!=1`: stub structured Vietnamese từ title/last messages. Luôn insert `csd_ai_interactions`. `draftReply` **không** nhận `send`.

- [ ] **Step 1: Test AT-AI-01** — draftReply does not call email service
- [ ] **Step 2: Buttons** on ticket/chat: `Bản nháp AI` — insert vào composer, user gửi
- [ ] **Step 3: Commit** `feat(csd): add AI draft stubs with activity log`

---

### Task 12: Dashboard + nav + isolation UAT

**Files:**
- Create: `services/ops-web/src/app/crm/csd/page.tsx` — KPI cards
- Create: `services/ptt-crm-api/src/csd/csd-dashboard.service.ts`
- Create: `services/ops-web/e2e/csd-isolation.spec.ts`
- Create: `docs/huong-dan-su-dung/29-csd-service-desk.md`

Dashboard GET `/api/crm/csd/dashboard`: counts need_action, sla_risk, reports_due, inbox_waiting + top 8 tickets.

E2e AT-ISO-01, AT-ISO-02, AT-DUP-01, AT-VIS-01, AT-AI-01.

- [ ] **Step 1: Playwright isolation file**
- [ ] **Step 2: Guide 1 trang** AM/PM
- [ ] **Step 3: Commit** `feat(csd): add operations dashboard and isolation e2e`

---

### Task 13: VPS deploy script

**Files:**
- Create: `scripts/deploy_csd_vps.sh` — pattern `deploy_ceo_command_vps.sh`: pull, `apply_pg_ddl_csd.sh`, `npm ci && npm run build` api + ops-web, restart `ptt-crm-api` `ptt-ops-web`, **không** export `PTT_CSD_LLM=1`

- [ ] **Step 1: Dry-run** `./scripts/deploy_csd_vps.sh` (no APPLY)
- [ ] **Step 2: Commit** `chore(csd): add VPS deploy helper`

---

## Self-review (spec coverage)

| Spec | Task |
|------|------|
| D1–D12 / isolation | Global + T7/T8/T12 |
| Ticket lifecycle + SLA | T3–T6 |
| Public/internal | T3, T5, T7 |
| Chat → ticket unique | T8 |
| Email match/spam/approval keywords | T9 |
| Report version + approve + send | T10 |
| AI draft only | T11 |
| Dashboard | T12 |
| DDL all `csd_*` | T1 (file already written) |
| Portal / Ads / omnichannel | Out of this plan |

Không còn TBD cho MVP. Phase 2 (portal, OAuth mail, GA4) = plan riêng sau khi CSD-4 UAT.

---

## UAT tối thiểu trước khi gọi xong

1. Tạo ticket P2 tay → mã `PTT-YYYY-*` + SLA due.  
2. Chat client → tạo ticket từ tin 2 lần → 1 mã.  
3. Internal note không gửi SMTP.  
4. Resolve thiếu note → lỗi.  
5. Out of Scope không Start Work.  
6. `/crm/tickets` không list CSD.  
7. Report weekly gửi; monthly chặn Send khi Draft.  
8. AI Draft không gửi khách.
