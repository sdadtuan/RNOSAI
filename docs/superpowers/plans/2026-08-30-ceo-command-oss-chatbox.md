# CEO Command ChatBox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/crm/ceo` — ChatBox điều hành A (briefing) + B (hỏi số whitelist) + C (6 action confirm) + kho `ceo_os` + OSS polish optional; bot sống khi LLM off.

**Architecture:** Module Nest riêng `ceo-command` bọc service đọc đã ship (Ops / NL / pipeline risk / coach) rồi persist `ceo_command_turns`. Polish qua `AiLlmClient.completeJson` (adapter `baseUrl` đã ship SK-AI-1). Mutate chỉ tại `POST /actions/commit` gọi **cùng service + cùng cap** với API gốc. Kho `ceo_os` tách `sales_kit`; retrieve intake-local, không `PlaybooksService.ragQuery`.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL · `AiLlmClient` · `AiNlQueryService` · không package mới.

**Spec:** [2026-08-30-ceo-command-oss-chatbox-srs.md](../specs/2026-08-30-ceo-command-oss-chatbox-srs.md) v1.0 · **Sibling đã ship:** Sales Kit ChatBox `f1a66182` (thread + 3 mode + learn) · **Prod VPS:** Vultr 2 vCPU / **3.3 GiB RAM** — **không** cài Ollama 7B.

## Global Constraints

- Compose-first: luôn lấy fact từ API rồi mới `polish`. Số trên `reply_vi` phải khớp `facts_json` / `rows`.
- Không free SQL (BR-AI-016). B chỉ `AiNlQueryService.runQuery`. Không invent intent.
- Không auto-send khách (BR-AI-01). `remind_*` chỉ `staff_notifications` hoặc note nội bộ.
- Confirm 2 bước mọi mutate. LLM không set `auto_commit`. Cron / internal key **cấm** commit C.
- JWT `staffId ≤ 0` → **403** (không skip B2B như Intake).
- Isolation: CSKH `list` / `listAllChunks` thêm `category <> 'ceo_os'` cạnh `sales_kit`. Không import `LeadCopilotPanel`.
- Không đổi `NL_QUERY_CATALOG`, `GO_THRESHOLDS`, Sales Kit money gate, Sales Kit flags.
- Deploy **không** set `PTT_CEO_COMMAND_LLM=1`.
- Rate: `ceo-cmd:{staffId}` 30 lượt / 5 phút; commit C 10 / 5 phút.
- `PTT_AI_LOG_PII=0` và `PTT_AI_LOG_PROMPTS=0` trên prod.
- Không SSE, không avatar, không file trong chat, không multi-commit.
- VPS 3.3 GiB: LLM default off; Ollama không cài trên máy này.

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-08-30-ceo-command-ddl.sql` | turns + actions + learn + RBAC seed |
| `scripts/apply_pg_ddl_ceo_command.sh` | Apply DDL |
| `scripts/deploy_ceo_command_vps.sh` | Pull main + DDL + build + restart; **không** bật LLM |
| `services/ptt-crm-api/src/ceo-command/ceo-command.types.ts` | DTO turn / card / action |
| `services/ptt-crm-api/src/ceo-command/ceo-command.util.ts` | thread_id, nearest aliases, forbidden C, number gate |
| `services/ptt-crm-api/src/ceo-command/ceo-command-rate.service.ts` | Sliding window 5 phút |
| `services/ptt-crm-api/src/ceo-command/guards/staff-ceo-command.guard.ts` | view / act / configure |
| `services/ptt-crm-api/src/ceo-command/ceo-command-turns.repository.ts` | Persist thread |
| `services/ptt-crm-api/src/ceo-command/ceo-command-actions.repository.ts` | Commit + idempotency |
| `services/ptt-crm-api/src/ceo-command/ceo-command-briefing.service.ts` | A: 6 nguồn + timeout |
| `services/ptt-crm-api/src/ceo-command/ceo-command-nl.service.ts` | B: wrap NL + suggestions |
| `services/ptt-crm-api/src/ceo-command/ceo-command-actions.service.ts` | C: preview + commit |
| `services/ptt-crm-api/src/ceo-command/ceo-command-llm.service.ts` | Polish optional |
| `services/ptt-crm-api/src/ceo-command/ceo-command.service.ts` | Route turn |
| `services/ptt-crm-api/src/ceo-command/ceo-command.controller.ts` | `/api/crm/ceo` |
| `services/ptt-crm-api/src/ceo-command/ceo-command.module.ts` | Providers |
| `services/ptt-crm-api/src/ceo-command/ceo-command-learn.*` | Candidates + export |
| `services/ptt-crm-api/src/ceo-command/ceo-command-library.*` | Retrieve `ceo_os` |
| `services/ptt-crm-api/src/playbooks/playbooks.repository.ts` | Exclude `ceo_os` |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | Section `ceo_command` |
| `services/ops-web/src/app/crm/ceo/page.tsx` | ChatBox |
| `services/ops-web/src/app/crm/ceo/learn/page.tsx` | Kho + vòng nuôi |
| `services/ops-web/src/components/crm/ceo/CeoCommandPanel.tsx` | Thread + chips + confirm |
| `docs/huong-dan-su-dung/28-ceo-command-chatbox.md` | Guide CEO/GDKD |

---

## Slice order

CEO-0 vỏ → CEO-1 A → CEO-2 B → CEO-3 C → CEO-4 OSS → CEO-5 nuôi. **Không ship C trước A+B.**

---

### Task 1: DDL turns / actions / learn

**Files:**
- Create: `docs/specs/2026-08-30-ceo-command-ddl.sql`
- Create: `scripts/apply_pg_ddl_ceo_command.sh`
- Test: copy pattern `scripts/apply_pg_ddl_sales_kit_learn.sh` (no Jest — verify SQL syntax in comment; Task 3 mocks `tableReady`)

**Interfaces:**
- Consumes: spec §13
- Produces: tables `ceo_command_turns`, `ceo_command_actions`, `ceo_command_learn_candidates`

- [ ] **Step 1: Write DDL**

```sql
CREATE TABLE IF NOT EXISTS ceo_command_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id VARCHAR(64) NOT NULL,
  actor_staff_id INTEGER NOT NULL,
  intent VARCHAR(64) NOT NULL,
  user_text TEXT NOT NULL DEFAULT '',
  reply_vi TEXT NOT NULL,
  stub_mode BOOLEAN NOT NULL DEFAULT TRUE,
  model_name VARCHAR(128) NOT NULL DEFAULT 'facts',
  facts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_action_json JSONB,
  cards_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  degraded_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rating VARCHAR(8),
  rating_reason VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ceo_command_turns_actor_idx
  ON ceo_command_turns (actor_staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ceo_command_turns_thread_idx
  ON ceo_command_turns (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS ceo_command_turns_rating_idx
  ON ceo_command_turns (rating, created_at DESC);

CREATE TABLE IF NOT EXISTS ceo_command_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  action_id VARCHAR(64) NOT NULL,
  params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_staff_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ceo_command_actions_idem_idx
  ON ceo_command_actions (idempotency_key);
CREATE INDEX IF NOT EXISTS ceo_command_actions_turn_idx
  ON ceo_command_actions (turn_id);

CREATE TABLE IF NOT EXISTS ceo_command_learn_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_key VARCHAR(191) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_turn_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  reviewer_staff_id INTEGER,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ceo_command_learn_status_idx
  ON ceo_command_learn_candidates (status, created_at DESC);
```

Script `apply_pg_ddl_ceo_command.sh`: copy `scripts/apply_pg_ddl_sales_kit_learn.sh`, đổi `DDL` sang file trên, echo `OK  ceo_command DDL applied`.

- [ ] **Step 2: Commit**

```bash
git add docs/specs/2026-08-30-ceo-command-ddl.sql scripts/apply_pg_ddl_ceo_command.sh
git commit -m "$(cat <<'EOF'
feat(crm): add CEO Command turns/actions/learn DDL

Persist executive ChatBox history and confirm-gated actions without sharing Sales Kit tables.
EOF
)"
```

---

### Task 2: RBAC `ceo_command` + guards

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Modify: `services/ptt-crm-api/src/staff-permissions/staff-job-functions.catalog.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts` (fallback SUPER-ADMIN only)
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-caps.util.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-caps.util.spec.ts`
- Create: `services/ptt-crm-api/src/ceo-command/guards/staff-ceo-command.guard.ts`

**Interfaces:**
- Consumes: `StaffAuthService.hasCap`
- Produces:

```ts
export type StaffCap = { section: string; action: string };

export function hasCeoView(caps: StaffCap[]): boolean;
export function hasCeoAct(caps: StaffCap[]): boolean;
export function hasCeoConfigure(caps: StaffCap[]): boolean;
```

`hasCeoView` = `ceo_command.view` **hoặc** `ai_analytics.query` **hoặc** `crm_business_dashboard.view` **hoặc** `ai_admin.view`.  
`hasCeoAct` = `ceo_command.act` (không fallback NL).  
`hasCeoConfigure` = `ceo_command.configure` **hoặc** `ai_admin.configure` **hoặc** `playbooks.configure`.

Catalog JSON:

1. `extra_actions` thêm `"act"`; `extra_action_labels.act` = `"Điều hành (Xác nhận)"`.
2. `section_actions.ceo_command` = `["view","act","configure"]`.
3. `sections` thêm `{ "id": "ceo_command", "label": "CEO Command", "group": "CRM — Admin", "page": "/crm/ceo", "description": "ChatBox điều hành A+B+C." }`.
4. `permission_ids` thêm `"ceo_command"` (giữ sort nếu file đang alpha — chèn gần `ai_admin`).

`DEFAULT_JOB_FUNCTION_GRANTS.leader`:

```ts
ceo_command: ['view', 'act', 'configure'],
```

**Không** thêm vào `sales`. Fallback SUPER-ADMIN trong `staff-auth.service.ts` thêm 3 cap `ceo_command` view/act/configure (cùng khối `ai_admin`).

Guard: class `StaffCeoCommandViewGuard` — JWT bắt buộc; `staffId` resolve `≤0` → 403 `{ error: 'ceo_unresolved_staff' }`; thiếu view → 403 `{ error: 'ceo_view_forbidden' }`. Internal key: **chỉ** GET `context` (controller tách — Task 4); POST turns/commit từ internal → 403 `{ error: 'ceo_internal_forbidden' }`.

- [ ] **Step 1: Failing tests**

```ts
import { hasCeoAct, hasCeoView } from './ceo-command-caps.util';

it('AM crm_leads.edit cannot view', () => {
  expect(hasCeoView([{ section: 'crm_leads', action: 'edit' }])).toBe(false);
});

it('NL query can view but not act', () => {
  expect(hasCeoView([{ section: 'ai_analytics', action: 'query' }])).toBe(true);
  expect(hasCeoAct([{ section: 'ai_analytics', action: 'query' }])).toBe(false);
});

it('ceo_command.act is required to act', () => {
  expect(hasCeoAct([{ section: 'ceo_command', action: 'act' }])).toBe(true);
});
```

- [ ] **Step 2: Run FAIL**

Run: `cd services/ptt-crm-api && npx jest src/ceo-command/ceo-command-caps.util.spec.ts --no-coverage`

Expected: `Cannot find module`

- [ ] **Step 3: Implement util + catalog + guard**

- [ ] **Step 4: PASS** + `npx jest src/staff-permissions/staff-permissions.catalog.spec.ts --no-coverage`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add ceo_command RBAC view/act/configure

GDKD can open the ChatBox; AM with only crm_leads.edit cannot act or see nav.
EOF
)"
```

---

### Task 3: Utils + rate limit + turns repository

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.util.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.util.spec.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-rate.service.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-rate.service.spec.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-turns.repository.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-turns.repository.spec.ts`

**Interfaces:**

```ts
export function ceoThreadId(staffId: number, now?: Date): string;
// `ceo:{staffId}:YYYY-MM-DD` UTC+7 (Asia/Ho_Chi_Minh)

export function nearestNlAliases(
  question: string,
  catalog: Array<{ id: string; label: string; aliases: string[] }>,
  limit = 3,
): Array<{ id: string; label: string }>;

export const CEO_NUMBER_TOKEN =
  /\d[\d.,]*\s*(?:₫|đ|vnd|%|tỷ|triệu|lead|deal)/gi;

export function assertReplyNumbersInFacts(
  replyVi: string,
  facts: unknown,
): boolean;

export function maskCeoPii(text: string): string;
// re-export maskSalesKitPii from '../intake/sales-kit-pii.util'
```

`assertReplyNumbersInFacts`: mỗi match `CEO_NUMBER_TOKEN` trong reply phải xuất hiện (substring) trong `JSON.stringify(facts)`. Số nguyên cô lập không có đơn vị **không** bắt. `"Còn 24 điểm"` pass.

Rate service:

```ts
class CeoCommandRateService {
  check(actorKey: string, limit: number, windowMs: number): void;
  reset(): void;
}
```

Copy sliding window từ `AiSummarizeRateLimitService` nhưng `windowMs` tham số (300_000). Error `{ error: 'ceo_rate_limited', retry_after_sec }`.

Turns repo: pattern `SalesKitTurnsRepository` — `tableReady()`, `insert` trả `null` nếu schema missing (turn vẫn trả reply), `listByThread`, `listThreadsByStaff(staffId, days)`, `findById`, `rate`. `actor_staff_id` bắt buộc `>0`.

- [ ] **Step 1: Failing tests**

```ts
it('builds thread id in VN date', () => {
  expect(ceoThreadId(12, new Date('2026-08-29T18:00:00.000Z'))).toBe('ceo:12:2026-08-30');
});

it('rejects invented money vs facts', () => {
  expect(assertReplyNumbersInFacts('Doanh thu 2 tỷ', { amount_vnd: 1000 })).toBe(false);
  expect(assertReplyNumbersInFacts('Doanh thu 1.000 ₫', { amount_vnd: 1000 })).toBe(true);
});

it('rate limits 2 per window', () => {
  const r = new CeoCommandRateService();
  r.check('ceo-cmd:1', 2, 60_000);
  r.check('ceo-cmd:1', 2, 60_000);
  expect(() => r.check('ceo-cmd:1', 2, 60_000)).toThrow();
});
```

- [ ] **Step 2–4:** implement + PASS

Run: `cd services/ptt-crm-api && npx jest src/ceo-command --no-coverage`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add CEO Command thread id, number gate, and rate limit

Facts stay trusted when polish invents KPI tokens the payload does not contain.
EOF
)"
```

---

### Task 4: Module + GET context/threads/turns + POST persist (CEO-0 API)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.types.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.service.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.service.spec.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.controller.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.controller.spec.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` — import `CeoCommandModule`
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts` — `ceoCommandEnabled` (`PTT_CEO_COMMAND` default **true**)

**Interfaces:**

```ts
export type CeoIntent =
  | 'briefing_today' | 'briefing_pipeline' | 'briefing_sla'
  | 'briefing_ops' | 'briefing_finance' | 'briefing_coach'
  | 'nl_query' | 'propose_action' | 'freeform' | 'ask_library';

export type CeoTurnOutput = {
  turn_id: string | null;
  thread_id: string;
  intent: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  facts_json: Record<string, unknown>;
  citations: unknown[];
  cards: unknown[];
  degraded: Array<{ source: string; reason: string }>;
  proposed_action: null | {
    action_id: string;
    params: Record<string, unknown>;
    preview_vi: string;
    required_caps: Array<{ section: string; action: string }>;
    can_confirm: boolean;
  };
  rows?: unknown[];
  result_kind?: 'table' | 'chart';
  drill_href?: string;
};

class CeoCommandService {
  getContext(actor): Promise<{
    staff_id: number;
    can_act: boolean;
    can_configure: boolean;
    chips_a: string[];
    chips_b: string[];
    actions: string[];
    llm_enabled: boolean;
  }>;
  listThreads(actor, days: number): Promise<{ threads: Array<{ thread_id: string; date: string }> }>;
  listTurns(actor, threadId: string): Promise<{ turns: CeoTurnRow[] }>;
  turn(body, actor): Promise<CeoTurnOutput>;
}
```

Task 4 **chỉ** implement `freeform` / unknown: reply `"Câu hỏi ngoài phạm vi — chọn chip Hôm nay hoặc một chỉ số."`, persist, `proposed_action=null`. Briefing/NL/C ném chưa — Task 6/8/10 gắn router.

`assertActor(actor)`: `staffId > 0` else `ForbiddenException({ error: 'ceo_unresolved_staff' })`. Rate `check(\`ceo-cmd:${staffId}\`, 30, 300_000)` trước persist.

Controller prefix `@Controller('api/crm/ceo')` + `StaffOrInternalKeyGuard` + `StaffCeoCommandViewGuard`.

| Method | Path | Note |
|--------|------|------|
| GET | `/context` | internal OK |
| GET | `/threads?days=7` | JWT only |
| GET | `/turns?thread_id=` | JWT; 403 nếu thread không thuộc staff |
| POST | `/turns` | JWT only |

- [ ] **Step 1: Service spec**

```ts
it('403 when staffId is 0', async () => {
  await expect(svc.turn({ intent: 'freeform', message: 'hi' }, { staffId: 0, caps: [] }))
    .rejects.toMatchObject({ response: { error: 'ceo_unresolved_staff' } });
});

it('persists freeform out of scope', async () => {
  turns.insert.mockResolvedValue({ id: 't1' });
  const out = await svc.turn(
    { intent: 'freeform', message: 'xyz' },
    { staffId: 9, caps: [{ section: 'ceo_command', action: 'view' }] },
  );
  expect(out.reply_vi).toMatch(/ngoài phạm vi/i);
  expect(out.turn_id).toBe('t1');
  expect(turns.insert).toHaveBeenCalled();
});
```

- [ ] **Step 2–4:** implement + register module + PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): persist CEO Command freeform turns

Unresolved JWT is rejected; AM cannot skip into the executive thread.
EOF
)"
```

---

### Task 5: ChatBox UI + nav (CEO-0 DoD)

**Files:**
- Modify: `services/ops-web/src/lib/api.ts` — client functions
- Create: `services/ops-web/src/lib/crm/ceo-command-flags.ts`
- Create: `services/ops-web/src/lib/crm/ceo-command-thread.util.ts`
- Create: `services/ops-web/src/lib/crm/ceo-command-thread.util.spec.ts`
- Create: `services/ops-web/src/components/crm/ceo/CeoCommandPanel.tsx`
- Create: `services/ops-web/src/app/crm/ceo/page.tsx`
- Modify: `services/ops-web/src/lib/rbac-routes.ts` — prefix `/crm/ceo` **trước** `/crm`
- Modify: `services/ops-web/src/components/OpsNav.tsx`
- Modify: `services/ops-web/src/lib/admin/module-nav.ts` — link trong khối Quản trị

**Interfaces:**

```ts
export function ceoCommandEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_CEO_COMMAND ?? '1') !== '0';
}

export function canSeeCeoNav(user): boolean {
  return hasCap(user, 'ceo_command', 'view')
    || hasCap(user, 'ai_analytics', 'query')
    || hasCap(user, 'crm_business_dashboard', 'view')
    || hasCap(user, 'ai_admin', 'view');
}

export function ceoBadge(opts: { llmEnabled: boolean; stubMode: boolean }): 'Facts' | 'OSS' | 'Stub';
```

`rbac-routes.ts` rule:

```ts
{
  prefix: '/crm/ceo',
  anyOf: [
    { section: 'ceo_command', action: 'view' },
    { section: 'ai_analytics', action: 'query' },
    { section: 'crm_business_dashboard', action: 'view' },
    { section: 'ai_admin', action: 'view' },
  ],
},
```

OpsNav: trong section `Quản trị & Tài chính`, **đầu list** nếu `ceoCommandEnabled() && canSeeCeoNav(user)`: `{ href: '/crm/ceo', label: 'Điều hành CEO' }`.

Page: copy auth shell từ `services/ops-web/src/app/crm/intake/sales-kit/page.tsx` — nếu `!canSeeCeoNav` hiện 403 copy, không mount panel.

Panel v1 (Task 5): header “Điều hành RNOSAI” + badge Facts + composer luôn hiện + 6 chip A + 12 chip B (disabled đến Task 6/8 — chip gọi `postCeoTurn`). Load GET turns của thread hôm nay. **Không** `LeadCopilotPanel`. Footer: `Nội bộ — không gửi khách`.

Chip labels A: Hôm nay / Pipeline rủi ro / SLA / Delivery / Tài chính / Coach tuần.  
Chip B ids đúng spec §8.1.

Auto-run `briefing_today` on first mount — Task 6 mới có fact; Task 5 có thể gọi và nhận out-of-scope tạm **hoặc** skip auto-run đến Task 6. **Chốt:** Task 5 chưa auto-run; Task 6 bật.

- [ ] **Step 1:** vitest `ceoBadge` + `canSeeCeoNav` AM false

Run: `cd services/ops-web && npx vitest run src/lib/crm/ceo-command-thread.util.spec.ts`

- [ ] **Step 2–4:** implement

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add /crm/ceo ChatBox shell and nav

Composer stays visible with Facts badge while A/B/C slices land next.
EOF
)"
```

**DoD CEO-0:** V-1 header+composer+chips; V-2 AM không nav; V-3 freeform persist refresh còn; V-4 JWT fail 403.

---

### Task 6: Briefing composer (CEO-1)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-briefing.util.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-briefing.util.spec.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-briefing.service.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-briefing.service.spec.ts`
- Modify: `ceo-command.service.ts` — route `briefing_*`
- Modify: `ceo-command.module.ts` — import `OpsModule` / `AiIntelligenceModule` / exports cần thiết (`forwardRef` nếu vòng)

**Interfaces:**

```ts
export type CeoBriefingCard = {
  severity: 'red' | 'amber' | 'ok';
  title: string;
  metric?: string;
  href: string;
  source: 'ops_exec' | 'ops_alerts' | 'pipeline' | 'sla' | 'finance' | 'coach';
  suggest_action?: 'ack_ops_alert' | 'assign_pipeline_risk' | 'remind_staff' | 'assign_lead';
};

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T>;
export function cardsFromSources(input: {
  opsExec?: { alerts_open: number; kpi_dat_pct: number } | null;
  opsAlerts?: Array<{ id: number; title?: string }>;
  pipeline?: Array<{ recommendation_id: string; title: string }>;
  sla?: { breach: number; warning: number } | null;
  finance?: { overdue: number; rev7: number; rev30: number } | null;
  coach?: { week_key: string; created_at: string } | null;
  hasFinanceCap: boolean;
}): { cards: CeoBriefingCard[]; reply_vi: string; facts_json: Record<string, unknown> };
```

`withTimeout`: `Promise.race` + reject `timeout` sau `ms` (2500).

Service `compose(intent, actor)`:

`Promise.allSettled` 6 fetch:

1. `opsDashboard.getExecutiveDashboard()` — catch `ops_dv_disabled` → degraded
2. `ops.listAlerts({ status: 'open', limit: 8 })` — đọc đúng method hiện có trên `OpsService`
3. `pipelineRisk.listAtRiskDeals(8, 0)`
4. `nlQuery.runQuery({ intent_id: 'sla_breach_summary', actorId })` + `ops_sla_warning` nếu có trong catalog; không có thì chỉ breach
5. Nếu `hasCap crm_business_dashboard.view`: `revenue_received_7d`, `revenue_received_30d`, `ops_payments_overdue`
6. `managerCoach.getCurrentDigest()` — thẻ nếu `created_at` trong 8 ngày

Thiếu cap finance: **không gọi** nguồn 5, không thẻ ₫.  
Thiếu `StaffOpsView` (`crm_board.view` — đọc `staff-ops-view.guard.ts`): skip 1–2, `degraded`.  
Intent hẹp (`briefing_pipeline` …): chỉ compose nguồn đó, vẫn cùng shape.

`cards` cắt ≤8, ưu tiên `red` rồi `amber`. `reply_vi` ≤1200, 4–8 bullet từ card title+metric.

Cache in-memory 60s / `staffId` + intent (Map + expiry).

- [ ] **Step 1: Util tests**

```ts
it('hides finance cards without cap', () => {
  const { cards } = cardsFromSources({
    finance: { overdue: 2, rev7: 1, rev30: 1 },
    hasFinanceCap: false,
  });
  expect(cards.some((c) => c.source === 'finance')).toBe(false);
});

it('ops fail does not throw — degraded only', () => {
  const { cards, reply_vi } = cardsFromSources({
    pipeline: [{ recommendation_id: 'r1', title: 'Deal A' }],
    hasFinanceCap: true,
  });
  expect(cards.length).toBeGreaterThan(0);
  expect(reply_vi.length).toBeLessThanOrEqual(1200);
});
```

Service spec: mock dashboard throw `ops_dv_disabled` → `degraded` chứa `ops_exec`, vẫn 200.

- [ ] **Step 2–4:** implement + wire `turn` + PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): compose CEO briefing from six read-only sources

One source timeout degrades a card instead of failing the whole Hôm nay turn.
EOF
)"
```

---

### Task 7: Briefing cards UI + auto Hôm nay

**Files:**
- Modify: `CeoCommandPanel.tsx`
- Modify: `ceo-command-thread.util.ts` — `parseCards`

**Interfaces:**
- Consumes: `CeoTurnOutput.cards`
- Produces: thẻ severity + link `<a href>` + nút chip C gợi ý (disabled đến Task 12; hiện label)

Auto `useEffect` lần đầu `session ready`: `postCeoTurn({ intent: 'briefing_today' })` một lần / thread ngày (ref flag).

- [ ] **Step 1:** util parse cards skip malformed

- [ ] **Step 2–4:** UI + PASS vitest

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): render CEO briefing cards and auto-run Hôm nay

Opening /crm/ceo shows red/amber cards with drill links without waiting for a prompt.
EOF
)"
```

**DoD CEO-1:** A-1 ≤8 thẻ + href; A-2 Ops off không 500; A-3 không cap finance → không thẻ ₫.

---

### Task 8: NL wrap (CEO-2)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-nl.service.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-nl.service.spec.ts`
- Modify: `ceo-command.service.ts` — `nl_query` + `freeform` thử resolve trước library
- Modify: `ceo-command.util.ts` — `nearestNlAliases` dùng `normalizeQueryText` từ `nl-query.engine.ts`

**Interfaces:**

```ts
class CeoCommandNlService {
  run(input: { intent_id?: string; question?: string; actorId: string }): Promise<{
    ok: true;
    payload: NlQueryResultPayload;
    facts_json: Record<string, unknown>;
  } | {
    ok: false;
    error: 'query_out_of_scope';
    suggestions: Array<{ id: string; label: string }>;
  }>;
}
```

`run`: `resolveIntent` trước. Fail → **không** gọi `runQuery`, trả suggestions token-overlap (normalize, đếm token chung với label+aliases, top 3).  
Success → `nlQuery.runQuery({ intent_id, question, actorId })`. `facts_json = { intent_id, rows, narrative }`. `read_only` luôn. `proposed_action` luôn null.

Thiếu cap B (`hasCeoView` đã đủ theo spec §8.4): chip B ẩn trên GET context nếu không có NL bộ — `hasCeoView` đã gồm NL. Context `chips_b` empty chỉ khi không view.

Chip POST `{ intent: 'nl_query', message?, intent_id }` — body thêm optional `intent_id`.

- [ ] **Step 1:**

```ts
it('out of scope suggests aliases without calling runQuery', async () => {
  const out = await nl.run({ question: 'Xóa hết lead', actorId: '9' });
  expect(out.ok).toBe(false);
  expect(runQuery).not.toHaveBeenCalled();
});

it('chip revenue_received_30d uses catalog id', async () => {
  runQuery.mockResolvedValue({
    data: { intent_id: 'revenue_received_30d', rows: [{ amount_vnd: 1 }], narrative: 'x', result_kind: 'table', columns: [], read_only: true },
  });
  const out = await nl.run({ intent_id: 'revenue_received_30d', actorId: '9' });
  expect(out.ok && out.payload.intent_id).toBe('revenue_received_30d');
});
```

- [ ] **Step 2–4:** implement + PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): wrap NL analytics for CEO number questions

Out-of-scope questions stay read-only and never invent a new SQL intent.
EOF
)"
```

---

### Task 9: Number table UI + B chips

**Files:**
- Modify: `CeoCommandPanel.tsx`
- Create: `services/ops-web/src/lib/crm/ceo-command-nl-render.util.ts`
- Create: `services/ops-web/src/lib/crm/ceo-command-nl-render.util.spec.ts`

**Interfaces:**

```ts
export function rowsToTable(rows: unknown[], max = 12): Array<Record<string, string>>;
export function sparkPoints(values: number[]): string; // polyline points, no new chart lib
```

Bảng ≤12 hàng + link “Xem đầy đủ” → `/crm/ai/query?intent={intent_id}`.  
Chart: SVG polyline từ `chart.series[0].values`.

Chip B 12 id spec §8.1 — `postCeoTurn({ intent: 'nl_query', intent_id })`.

- [ ] **Step 1–4:** vitest table slice + panel

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): render CEO number chips as tables and sparklines

Rows stay sourced from the same NL payload as /crm/ai/query.
EOF
)"
```

**DoD CEO-2:** B-1 `revenue_received_30d`; B-2 alias; B-3 xóa lead → out_of_scope; B-4 cùng rows tab NL.

---

### Task 10: Action catalog preview (CEO-3)

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-action.catalog.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-action.catalog.spec.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-actions.service.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-actions.service.spec.ts`
- Modify: `ceo-command.service.ts` — `propose_action` + parse freeform cấm

**Interfaces:**

```ts
export const CEO_ACTION_IDS = [
  'ack_ops_alert',
  'assign_pipeline_risk',
  'log_pipeline_activity',
  'assign_lead',
  'remind_staff',
  'sla_remind_lead',
] as const;

export function parseForbiddenRequest(message: string): { href: string; label: string } | null;
export function validateActionParams(actionId: string, params: Record<string, unknown>): Record<string, unknown>;
```

`parseForbiddenRequest` (không tin LLM):

| regex (vi, không dấu) | href | label |
|-----------------------|------|-------|
| `duyet luong\|payroll\|bao hiem` | `/crm/hr` | HR |
| `xoa lead\|xoa hop dong\|xoa invoice` | `/crm/leads` | CRM |
| `cap quyen\|tao user\|rbac` | `/admin` | Admin |
| `ngan sach ads\|pause campaign` | `/meta/facebook-ads` | Ads |
| `gui zalo\|gui email khach` | `/crm/leads` | CRM |
| `spawn week\|ghi kpi ops` | `/crm/ops/dashboard` | Ops |

Match → reply spec §9.4, `proposed_action=null`.

`validateActionParams` throw `BadRequestException` nếu thiếu field spec §9.2. `note`/`body` cắt 500 + `maskCeoPii`.

`preview(actionId, params, actor)`:

1. Validate params.
2. Resolve `staff_name` từ roster (`CrmStaff` / `staffExists` + name query — dùng service staff đã có, **không** tin `params.staff_name` từ client).
3. `required_caps` theo bảng:

| action | caps |
|--------|------|
| `ack_ops_alert` | `{crm_board, edit}` (cùng `StaffOpsWriteGuard`) |
| `assign_pipeline_risk` / `log_pipeline_activity` | cap `StaffAiDealAccessGuard` dùng — đọc guard file, copy **cùng** check |
| `assign_lead` | `{crm_leads, assign}` |
| `remind_staff` | `ceo_command.act` **hoặc** `{crm_leads, assign}` |
| `sla_remind_lead` | `{crm_leads, edit}` |

4. `can_confirm` = `hasCeoAct` **và** đủ mọi required_caps. Thiếu → vẫn trả preview, `can_confirm=false` (ẩn nút).
5. Không ghi DB.

- [ ] **Step 1:**

```ts
it('payroll request is forbidden', () => {
  expect(parseForbiddenRequest('Duyệt lương tháng này')?.href).toBe('/crm/hr');
});

it('preview assign does not call assignFollowUpOwner', async () => {
  await actions.preview('assign_pipeline_risk', { recommendation_id: 'r1', staff_id: 3 }, actor);
  expect(pipeline.assignFollowUpOwner).not.toHaveBeenCalled();
});
```

- [ ] **Step 2–4:** implement

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): preview six CEO Command actions without writing

Forbidden payroll/ads/send phrases stay links to source screens.
EOF
)"
```

---

### Task 11: Commit + idempotency

**Files:**
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-actions.repository.ts`
- Create: `services/ptt-crm-api/src/ceo-command/ceo-command-actions.repository.spec.ts`
- Modify: `ceo-command-actions.service.ts` — `commit`
- Modify: `ceo-command.controller.ts` — `POST /actions/commit`
- Modify: `ai-audit.constants.ts` — `CEO_COMMAND: 'ceo_command'`, `CEO_COMMAND_ACT: 'ceo_command_act'`
- Modify: `ceo-command.service.spec.ts` — Complete không block nếu audit throw

**Interfaces:**

```ts
async commit(input: {
  turn_id: string;
  idempotency_key: string;
}, actor): Promise<{ status: string; result_json: unknown; reused: boolean }>;
```

Luồng:

1. JWT only; `staffId > 0`; `hasCeoAct` else 403.
2. Rate `ceo-cmd-act:{staffId}` 10 / 300_000.
3. `findByIdempotency(key)` trong 24h → trả kết quả cũ, `reused: true`.
4. Load turn; `proposed_action_json` bắt buộc; cùng `actor_staff_id`.
5. Re-validate params + re-check caps + target còn (alert exists / recommendation pending / lead visible).
6. Gọi service gốc:

```ts
ack_ops_alert: ops.acknowledgeAlert(alert_id, String(staffId))
assign_pipeline_risk: pipelineRisk.assignFollowUpOwner({ recommendationId, staffId, staffName: rosterName, actorId })
log_pipeline_activity: pipelineRisk.logFollowUpActivity({ recommendationId, note, actorId })
assign_lead: crmLegacy.assignLead(lead_id, { to_user_id: owner_staff_id, reason: 'CEO Command' }, actorLabel)
remind_staff: notifications.create({ user_id: staff_uuid, kind: 'ceo_remind', title, body, link_href })
sla_remind_lead: slaAutoTask.createReminder(lead_id, { tier, suggested_action }, actorLabel, staffId)
```

`remind_staff.user_id` là UUID staff_users — resolve từ `staff_id` integer qua repo staff (nếu không map được → `target_gone`).

7. Persist `ceo_command_actions` status `committed` | `rejected_cap` | `target_gone` | `failed`.
8. `ai_agent_runs` `use_case=ceo_command_act`.

Internal / cron: controller 403 trước service.

- [ ] **Step 1:**

```ts
it('second commit with same key does not assign again', async () => {
  repo.findByIdempotency.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'committed', result_json: { ok: true } });
  await actions.commit({ turn_id: 't', idempotency_key: 'k' }, actor);
  await actions.commit({ turn_id: 't', idempotency_key: 'k' }, actor);
  expect(pipeline.assignFollowUpOwner).toHaveBeenCalledTimes(1);
});

it('AM without act is 403', async () => {
  await expect(actions.commit({ turn_id: 't', idempotency_key: 'k' }, amActor))
    .rejects.toMatchObject({ status: 403 });
});
```

- [ ] **Step 2–4:** implement + PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): commit CEO actions through original services

Idempotency keys prevent double assign; cron keys cannot write.
EOF
)"
```

---

### Task 12: Confirm modal UI

**Files:**
- Modify: `CeoCommandPanel.tsx`
- Modify: `api.ts` — `commitCeoAction(token, { turn_id, idempotency_key })`
- Create: `services/ops-web/src/lib/crm/ceo-command-confirm.util.ts` + spec

**Interfaces:**

```ts
export function confirmCopy(action: { action_id: string; preview_vi: string; params: Record<string, unknown> }): string;
```

Nút **Xác nhận** chỉ khi `proposed_action.can_confirm`. Modal 1 câu từ `preview_vi`. Hủy = đóng. `idempotency_key = crypto.randomUUID()` một lần / click confirm (giữ cùng key nếu retry network). Không “xác nhận tất cả”.

Menu “Hành động”: 6 form ngắn (alert_id, recommendation_id+staff_id, …) → POST `propose_action`.

- [ ] **Step 1–4:** util copy + panel

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): confirm CEO Command mutations in a one-line modal

Preview stays on the bubble until the CEO confirms a single action.
EOF
)"
```

**DoD CEO-3:** C-1 không Xác nhận → DB không đổi; C-2 commit đúng service; C-3 idempotent; C-4 AM 403; C-5/C-6 từ chối Zalo/lương.

---

### Task 13: OSS polish (CEO-4)

**Files:**
- Modify: `ai-intelligence.config.ts` — `ceoCommandLlmEnabled` default false; `ceoCommandLlmBaseUrl`; `ceoCommandLlmModel`; `ceoCommandLlmTimeoutMs` default 12000; `ceoCommandLlmApiKey` (kit/global/`ollama`)
- Create: `ceo-command-llm.util.ts` + spec — `buildCeoSystemPrompt()`
- Create: `ceo-command-llm.service.ts` + spec
- Modify: `ceo-command.service.ts` — sau compose, `polish` rồi `assertReplyNumbersInFacts`; fail → revert narrative, `stub_mode=true`

**Interfaces:**

`completeJson` args:

```ts
{
  systemPrompt: buildCeoSystemPrompt(),
  userContent: JSON.stringify({ facts_json, reply_vi, intent }),
  model: aiConfig.ceoCommandLlmModel,
  apiKey: aiConfig.ceoCommandLlmApiKey ?? undefined,
  baseUrl: aiConfig.ceoCommandLlmBaseUrl ?? undefined,
  timeoutMs: aiConfig.ceoCommandLlmTimeoutMs,
  stubJson: () => ({ reply_vi: factsReply }),
}
```

System prompt đúng spec §11.2. Không đưa SĐT / `bant_json`.  
`highlight_ids` chỉ id card đã có — ignore id lạ.

Flag `PTT_CEO_COMMAND_LLM=0` → không gọi LLM. **Không** đọc `PTT_INTAKE_SALES_KIT_LLM`.

Badge panel: GET context `llm_enabled` + last `stub_mode` → `ceoBadge`.

- [ ] **Step 1:**

```ts
it('does not call completeJson when flag off', async () => {
  aiConfig.ceoCommandLlmEnabled = false;
  await llm.polish({ reply_vi: 'x', facts_json: {}, intent: 'briefing_today' });
  expect(completeJson).not.toHaveBeenCalled();
});

it('reverts when model invents 2 tỷ', async () => {
  aiConfig.ceoCommandLlmEnabled = true;
  completeJson.mockResolvedValue({ parsed: { reply_vi: 'Chốt 2 tỷ' }, stubMode: false, modelName: 'qwen' });
  const out = await llm.polish({ reply_vi: 'Overdue 0 ₫', facts_json: { overdue: 0 }, intent: 'briefing_finance' });
  expect(out.reply_vi).toBe('Overdue 0 ₫');
  expect(out.stub_mode).toBe(true);
});
```

- [ ] **Step 2–4:** implement — **không** sửa deploy Sales Kit để bật flag này

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): optional OSS polish for CEO Command narrative

Numbers fall back to facts when Ollama is down or invents a KPI.
EOF
)"
```

**DoD CEO-4:** O-1/O-2/O-3.

---

### Task 14: Isolation `ceo_os` + retrieve

**Files:**
- Modify: `playbooks.repository.ts` — `notKit` thành  
  `COALESCE(category,'sales') NOT IN ('sales_kit','ceo_os')` trên `list` + `listAllChunks`
- Modify: `playbooks.repository.spec.ts` — assert cả hai category
- Create: `ceo-command-library.util.ts` + spec — copy `scoreSalesKitChunks` đổi kind `policy` \| `qa` \| `metric_note`
- Create: `ceo-command-library.service.ts` — query chunks `category='ceo_os'` **trực tiếp SQL** (không `ragQuery`)

`needsLibrary`: `freeform` và `resolveIntent` null và `parseForbiddenRequest` null và không parse được action.

Citation money: kind không `policy`/`qa` → không polish số (giữ facts).

- [ ] **Step 1:** playbooks spec `ceo_os` excluded

- [ ] **Step 2–4:** implement + PASS `playbooks.repository.spec.ts`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(crm): keep ceo_os chunks out of CSKH RAG

CEO policy lives beside sales_kit isolation on list and listAllChunks.
EOF
)"
```

---

### Task 15: Rating + learn page (CEO-5)

**Files:**
- Create: `ceo-command-learn.util.ts` + spec + repository + service
- Modify: controller — rating, learn files/candidates (tái sử dụng upload exceljs 1 hàng như Sales Kit `SalesKitLearnService.approveCandidate`)
- Create: `services/ops-web/src/app/crm/ceo/learn/page.tsx`
- Create: `CeoCommandLearnPanel.tsx`
- Modify: panel — 👍/👎 trên bubble assistant

**Interfaces:** giống Sales Kit learn nhưng `folder_key` `_common/qa` \| `_common/policy`. Cấm copy số từ `rows` vào answer trừ `kind=metric_note` và chuỗi fact nguyên.

`enqueueNightly` **không** cron Nest v1 — `POST /learn/enqueue` configure thủ công **hoặc** gọi từ turn `rating=down` fire-and-forget `proposeFromTurn`. Briefing `briefing_today` không degraded: candidate tối đa 3 / ngày / staff (dedupe normalize 90 ngày).

Cap configure. Duyệt → file pending `ceo_os` — **không** auto-ready (gọi library upload pending; GDKD Duyệt kho).

- [ ] **Step 1–4:** TDD util money + page

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): rate CEO turns and queue ceo_os learn candidates

Down turns become pending Q&A without publishing ready chunks.
EOF
)"
```

**DoD:** L-1 rating down; L-2 ragQuery 0 chunk ceo_os + sales_kit.

---

### Task 16: Export JSONL + LoRA cổng + docs + deploy

**Files:**
- Create: `ceo-command-learn-export.util.ts` + spec — reuse `buildLoraJsonlLine` / `canStartLora` từ `sales-kit-learn-export.util.ts` (import, không copy)
- Modify: learn service `exportJsonl` — turns `rating=up` AND `stub_mode=false` + candidates `ingested`; mask PII; loại `[số đã ẩn]`
- Create: `scripts/ceo_command_lora_train.sh` — copy `sales_kit_lora_train.sh`, đổi env `PTT_CEO_COMMAND_LORA_*`
- Create: `docs/huong-dan-su-dung/28-ceo-command-chatbox.md`
- Modify: `docs/runbooks/ai-service-operations.md` — mục 12.2 CEO Command
- Create: `scripts/deploy_ceo_command_vps.sh`

Deploy script (copy `deploy_intake_sales_kit_s4_vps.sh`):

```bash
# KHÔNG export PTT_CEO_COMMAND_LLM=1
bash scripts/apply_pg_ddl_ceo_command.sh
cd services/ptt-crm-api && npm ci && npm run build
npx jest --testPathPattern='src/ceo-command|src/playbooks/playbooks.repository.spec' --no-coverage
# ops-web build + vitest ceo-command-*.spec.ts
sudo systemctl restart ptt-crm-api ptt-ops-web
```

Guide 28: A/B/C, confirm, cấm lương/Zalo, badge Facts/Stub, link Learn.

- [ ] **Step 1:** `canStartLora` reuse tests + export filter

- [ ] **Step 2–4:** scripts + docs

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs(crm): add CEO Command guide, LoRA gate, and VPS deploy

Default deploy keeps OSS polish off on the 3.3 GiB host.
EOF
)"
```

**DoD CEO-5:** export configure; LoRA script exit 2/3 khi chưa đủ; UAT L-2.

---

## UAT map (ai chạy xong plan)

| ID | Task xong |
|----|-----------|
| V-1…V-4 | 5 |
| A-1…A-3 | 7 |
| B-1…B-4 | 9 |
| C-1…C-6 | 12 |
| O-1…O-3 | 13 |
| L-1…L-2 | 15 |

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| §6 CEO-0 thread/nav | 1–5 |
| §7 A briefing | 6–7 |
| §8 B NL | 8–9 |
| §9 C catalog/confirm/idempotency | 10–12 |
| §10 ChatBox layout | 5, 7, 9, 12 |
| §11 OSS | 13 |
| §12 kho + nuôi + LoRA | 14–16 |
| §13 DDL + RBAC | 1–2 |
| §14 API | 4, 11, 15 |
| §4 JWT 403 / rate / PII / no Copilot | 2–5, 13 |
| §2.3 không phá NL/Sales Kit | 8, 14; không đụng GO_THRESHOLDS |
| Backlog §19 | **không** làm (SSE, cron 08:00, intent mới, voice) |

## Không làm trong plan này

- CEO 3-mode UI như Sales Kit (`off/openai/ollama` DB). SRS CEO dùng **flag** `PTT_CEO_COMMAND_LLM` + BASE_URL. Đủ cho VPS 3.3 GiB.
- Gán cap `act` hàng loạt user prod — GDKD gán trên `/admin` sau seed catalog; `leader` job function chỉ user mới / re-seed.
- Fine-tune bắt buộc, multi-commit, HR mutate.

---

## Phụ thuộc đã ship (đừng viết lại)

- `AiLlmClient.completeJson({ baseUrl, apiKey, timeoutMs })` — SK-AI-1.
- `maskSalesKitPii` — import, không fork regex.
- `AiNlQueryService.runQuery` / `resolveIntent` / `NL_QUERY_CATALOG`.
- `PipelineRiskService.assignFollowUpOwner` / `logFollowUpActivity` / `listAtRiskDeals`.
- `OpsDashboardService.getExecutiveDashboard`, `OpsService.acknowledgeAlert`.
- `SlaAutoTaskService.createReminder` (note nội bộ).
- `StaffNotificationsRepository.create`.
- Sales Kit learn approve → xlsx pending (copy pattern, category `ceo_os`).
