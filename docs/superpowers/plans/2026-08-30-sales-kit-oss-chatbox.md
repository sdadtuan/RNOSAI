# Sales Kit OSS ChatBox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi Sales Kit từ 8 chip + 1 reply thành ChatBox thread persist; mở `AiLlmClient` gọi OpenAI-compatible OSS; nuôi kho bằng 👍/👎 + candidate từ Complete; cổng LoRA opt-in ngoài Nest — kit sống khi model off.

**Architecture:** Giữ `salesKitTurn` rules → retrieve S4 → `polish` theo **mode** `off` / `openai` / `ollama` (UI GDKD + env lock). SK-AI-0 persist `sales_kit_turns` + ChatBox. SK-AI-1 `baseUrl` trên `completeJson`. SK-AI-2 rating. SK-AI-3 Complete → candidates. SK-AI-4 JSONL + cổng LoRA. Không đổi `PlaybooksService.ragQuery`.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL · `AiLlmClient` · `exceljs` (đã có) · không package mới.

**Spec:** [2026-08-29-sales-kit-oss-chatbox-srs.md](../specs/2026-08-29-sales-kit-oss-chatbox-srs.md) v1.0 · **Đã ship:** S0–S4 + isolation `sales_kit` · **Prod VPS:** Vultr 2 vCPU / **3.3 GiB RAM** — **không** cài Ollama 7B trên máy này.

## Global Constraints

- Không đổi `GO_THRESHOLDS` `{ go: 24, nurture_min: 18 }` và 6 BANT keys.
- Kit không Complete / Reopen / advance funnel / enqueue SCI M2 (Complete hiện có giữ nguyên; chỉ **enqueue learn sau** Complete).
- Không mount `LeadCopilotPanel`; không draft Zalo/email gửi khách.
- Không Tesseract, puppeteer, package `xlsx`, dual-write S3.
- Không đổi ranking `PlaybooksService.ragQuery`. Giữ `COALESCE(category,'sales') <> 'sales_kit'` trên `list` / `listAllChunks`.
- Rules-first: luôn `runSalesKitRules` rồi mới `polish`.
- Giá / case / KPI chỉ khi citation `ready` kind `pricing` | `case` | `qa`.
- Money guard không nuốt “Còn 24 điểm” / “5 trang” / “2 đơn”; bắt `tỷ` / `k` / `vnd`.
- Session bag chỉ retrieve khi `lead_id` + `session_id` khớp.
- JWT `staffId <= 0`: không B2B-404 Intake; cap rỗng → không configure; rate bucket `intake-kit:unresolved` (không `internal`).
- Ba mode: `off` (Rules) / `openai` (LLM cloud) / `ollama`. Default `off`. Deploy **không** set `openai`/`ollama`.
- Đổi mode: UI `/crm/intake/sales-kit` (configure). `PTT_INTAKE_SALES_KIT_LLM_MODE_LOCK=1` khóa UI.
- `PTT_INTAKE_SALES_KIT_LLM=1` chỉ legacy alias → `openai` khi DB+MODE trống.
- Badge ChatBox lấy GET `/sales-kit/runtime`, không `NEXT_PUBLIC_*`.
- `PTT_AI_LOG_PII=0` và `PTT_AI_LOG_PROMPTS=0` trên prod.
- VPS hiện tại 3.3 GiB: mode `ollama` lưu được nhưng `healthy=false`; **không** cài 7B trên máy này.
- Composer ChatBox **luôn hiện**.
- Không SSE streaming, không sửa lượt cũ, không avatar, không file trong chat.

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-08-29-sales-kit-learn-ddl.sql` | `sales_kit_turns` + `sales_kit_learn_candidates` + `sales_kit_runtime` |
| `services/ptt-crm-api/src/intake/sales-kit-runtime.util.ts` | Resolve mode: lock → DB → env → legacy |
| `services/ptt-crm-api/src/intake/sales-kit-runtime.service.ts` | GET/PATCH runtime + health |
| `scripts/apply_pg_ddl_sales_kit_learn.sh` | Apply DDL |
| `services/ptt-crm-api/src/intake/sales-kit-pii.util.ts` | Mask SĐT/email |
| `services/ptt-crm-api/src/intake/sales-kit-turns.repository.ts` | CRUD turns + rating |
| `services/ptt-crm-api/src/intake/sales-kit-learn.repository.ts` | Candidates + metrics + export rows |
| `services/ptt-crm-api/src/intake/sales-kit-learn.util.ts` | Normalize question, strip money, build candidates |
| `services/ptt-crm-api/src/intake/sales-kit-learn.service.ts` | Propose / approve / reject / enqueue from Complete |
| `services/ptt-crm-api/src/intake/intake.service.ts` | Persist turn; GET thread; fire-and-forget learn |
| `services/ptt-crm-api/src/intake/intake.controller.ts` | Turns / rating / learn routes |
| `services/ptt-crm-api/src/intake/intake.module.ts` | Providers mới |
| `services/ptt-crm-api/src/ai-intelligence/ai-llm.client.ts` | `baseUrl` trên chat completions |
| `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts` | Kit BASE_URL / MODEL / KEY / TIMEOUT |
| `services/ptt-crm-api/src/intake/intake-sales-kit-llm.service.ts` | Override + prompt on-prem |
| `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.ts` | Thêm 1 dòng system prompt |
| `services/ops-web/src/lib/api.ts` | Client turns / rating / learn |
| `services/ops-web/src/components/crm/intake/IntakeSalesKitPanel.tsx` | ChatBox thread |
| `services/ops-web/src/app/crm/intake/sales-kit/learn/page.tsx` | Learn admin |
| `scripts/sales_kit_lora_train.sh` | Cổng LoRA (từ chối &lt;N) |
| `docs/runbooks/ai-service-operations.md` | Mục Ollama + cấm VPS 3.3 GiB |
| `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` | ChatBox AM |

---

### Task 1: DDL turns + candidates + mask PII

**Files:**
- Create: `docs/specs/2026-08-29-sales-kit-learn-ddl.sql`
- Create: `scripts/apply_pg_ddl_sales_kit_learn.sh`
- Create: `services/ptt-crm-api/src/intake/sales-kit-pii.util.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-pii.util.spec.ts`

**Interfaces:**
- Consumes: spec §6.3, §11.1–11.2
- Produces: `maskSalesKitPii(text: string): string`

- [ ] **Step 1: Write failing test**

```ts
import { maskSalesKitPii } from './sales-kit-pii.util';

describe('maskSalesKitPii', () => {
  it('masks VN mobile and email', () => {
    expect(maskSalesKitPii('Gọi 0912345678 hoặc a@b.com')).toBe(
      'Gọi ***5678 hoặc ***@b.com',
    );
  });

  it('leaves gap-to-go score alone', () => {
    expect(maskSalesKitPii('Còn 24 điểm để Go')).toBe('Còn 24 điểm để Go');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd services/ptt-crm-api && npx jest src/intake/sales-kit-pii.util.spec.ts --no-coverage`

Expected: `Cannot find module './sales-kit-pii.util'`

- [ ] **Step 3: Implement util + DDL**

`sales-kit-pii.util.ts`:

```ts
const PHONE = /(?:\+?84|0)(?:3|5|7|8|9)\d{8}\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function maskSalesKitPii(text: string): string {
  return String(text ?? '')
    .replace(PHONE, (m) => `***${m.slice(-4)}`)
    .replace(EMAIL, (m) => {
      const at = m.lastIndexOf('@');
      return `***${m.slice(at)}`;
    });
}
```

DDL `docs/specs/2026-08-29-sales-kit-learn-ddl.sql`:

```sql
CREATE TABLE IF NOT EXISTS sales_kit_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id INTEGER NOT NULL,
  actor_staff_id INTEGER,
  intent VARCHAR(64) NOT NULL,
  user_text TEXT NOT NULL DEFAULT '',
  reply_vi TEXT NOT NULL,
  stub_mode BOOLEAN NOT NULL DEFAULT TRUE,
  model_name VARCHAR(128) NOT NULL DEFAULT 'rules',
  citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  apply_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  rating VARCHAR(8),
  rating_reason VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_kit_turns_session_idx
  ON sales_kit_turns (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_kit_turns_rating_idx
  ON sales_kit_turns (rating, created_at DESC);

CREATE TABLE IF NOT EXISTS sales_kit_learn_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_key VARCHAR(191) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_session_id INTEGER NOT NULL,
  source_lead_id INTEGER,
  source_turn_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  reviewer_staff_id INTEGER,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_kit_learn_status_idx
  ON sales_kit_learn_candidates (status, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_kit_learn_folder_q_idx
  ON sales_kit_learn_candidates (folder_key, created_at DESC);

CREATE TABLE IF NOT EXISTS sales_kit_runtime (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  mode VARCHAR(16) NOT NULL DEFAULT 'off'
    CHECK (mode IN ('off', 'openai', 'ollama')),
  updated_by INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sales_kit_runtime (id, mode) VALUES (1, 'off')
  ON CONFLICT (id) DO NOTHING;
```

Script `scripts/apply_pg_ddl_sales_kit_learn.sh` — copy `scripts/apply_pg_ddl_sales_kit_files.sh`, đổi `DDL` sang file trên, echo `OK  sales_kit_learn DDL applied`.

- [ ] **Step 4: Run test — expect PASS**

Run: `cd services/ptt-crm-api && npx jest src/intake/sales-kit-pii.util.spec.ts --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-08-29-sales-kit-learn-ddl.sql scripts/apply_pg_ddl_sales_kit_learn.sh \
  services/ptt-crm-api/src/intake/sales-kit-pii.util.ts \
  services/ptt-crm-api/src/intake/sales-kit-pii.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add sales kit turns/learn DDL and PII mask

Persist ChatBox turns and learn candidates without storing raw phone/email in export paths.
EOF
)"
```

---

### Task 2: Turns repository

**Files:**
- Create: `services/ptt-crm-api/src/intake/sales-kit-turns.repository.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-turns.repository.spec.ts`

**Interfaces:**
- Consumes: `AppConfigService.databaseUrl`; table `sales_kit_turns`
- Produces:

```ts
export type SalesKitTurnRow = {
  id: string;
  session_id: number;
  actor_staff_id: number | null;
  intent: string;
  user_text: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  citations_json: unknown;
  apply_json: unknown;
  rating: 'up' | 'down' | null;
  rating_reason: string | null;
  created_at: string;
};

export type InsertSalesKitTurn = {
  session_id: number;
  actor_staff_id: number | null;
  intent: string;
  user_text: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  citations_json: unknown;
  apply_json: unknown;
};

class SalesKitTurnsRepository {
  tableReady(): Promise<boolean>;
  insert(row: InsertSalesKitTurn): Promise<SalesKitTurnRow | null>;
  listBySession(sessionId: number): Promise<SalesKitTurnRow[]>;
  findById(id: string): Promise<SalesKitTurnRow | null>;
  rate(id: string, rating: 'up' | 'down', reason?: string | null): Promise<SalesKitTurnRow | null>;
}
```

Pattern: copy pool/`tableReady` từ `sales-kit-library.repository.ts` nhưng `table_name = 'sales_kit_turns'`. `insert` trả `null` nếu `!tableReady()` (không throw — kit vẫn trả reply). `actor_staff_id` nếu `<= 0` ghi `NULL`.

- [ ] **Step 1: Write failing tests** (mock `query`)

```ts
import { SalesKitTurnsRepository } from './sales-kit-turns.repository';

function repoWithQuery(query: jest.Mock): SalesKitTurnsRepository {
  const repo = new SalesKitTurnsRepository({ databaseUrl: 'postgres://x' } as never);
  (repo as unknown as { pool: { query: jest.Mock } }).pool = { query };
  return repo;
}

describe('SalesKitTurnsRepository', () => {
  it('stores null actor when staffId is 0', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] }) // tableReady
      .mockResolvedValueOnce({
        rows: [{
          id: 't1', session_id: 12, actor_staff_id: null, intent: 'gap_to_go',
          user_text: '', reply_vi: 'Còn 24 điểm', stub_mode: true, model_name: 'rules',
          citations_json: [], apply_json: {}, rating: null, rating_reason: null,
          created_at: '2026-08-30T00:00:00.000Z',
        }],
      });
    const repo = repoWithQuery(query);
    (repo as unknown as { tableReadyCached: boolean }).tableReadyCached = true;
    await repo.insert({
      session_id: 12,
      actor_staff_id: 0,
      intent: 'gap_to_go',
      user_text: '',
      reply_vi: 'Còn 24 điểm',
      stub_mode: true,
      model_name: 'rules',
      citations_json: [],
      apply_json: {},
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/INSERT INTO sales_kit_turns/i);
    expect(query.mock.calls[0][1][1]).toBeNull();
  });

  it('returns empty list when table missing', async () => {
    const repo = new SalesKitTurnsRepository({ databaseUrl: 'postgres://x' } as never);
    jest.spyOn(repo, 'tableReady').mockResolvedValue(false);
    await expect(repo.listBySession(1)).resolves.toEqual([]);
  });
});
```

Adjust mock: if `tableReadyCached` short-circuits, first `query` is INSERT — assert `params[1] === null`.

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `cd services/ptt-crm-api && npx jest src/intake/sales-kit-turns.repository.spec.ts --no-coverage`

- [ ] **Step 3: Implement repository**

`INSERT ... RETURNING *`. `rate`: `UPDATE sales_kit_turns SET rating=$2, rating_reason=$3 WHERE id=$1 RETURNING *` với `rating IN ('up','down')`, `reason` cắt 200. `listBySession`: `ORDER BY created_at ASC`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Register provider** in `intake.module.ts` (`SalesKitTurnsRepository`). Commit.

```bash
git add services/ptt-crm-api/src/intake/sales-kit-turns.repository.ts \
  services/ptt-crm-api/src/intake/sales-kit-turns.repository.spec.ts \
  services/ptt-crm-api/src/intake/intake.module.ts
git commit -m "$(cat <<'EOF'
feat(crm): add sales kit turns repository

Store ChatBox history per intake session so refresh and learn jobs have a source of truth.
EOF
)"
```

---

### Task 3: Persist turn + GET thread (SK-AI-0 API)

**Files:**
- Modify: `services/ptt-crm-api/src/intake/intake.service.ts`
- Modify: `services/ptt-crm-api/src/intake/intake.service.spec.ts`
- Modify: `services/ptt-crm-api/src/intake/intake.controller.ts`
- Modify: `services/ptt-crm-api/src/intake/intake.controller.spec.ts`

**Interfaces:**
- Consumes: `SalesKitTurnsRepository.insert` / `listBySession`; `maskSalesKitPii`
- Produces: `salesKitTurn` thêm `turn_id: string | null` trên output.  
  `listSalesKitTurns(sessionId, actor): Promise<{ turns: SalesKitTurnRow[] }>`

`salesKitTurn` sau `polish` / empty-library return:

```ts
const persisted = await this.turns.insert({
  session_id: session.id,
  actor_staff_id: actor && actor.staffId > 0 ? actor.staffId : null,
  intent: body.intent,
  user_text: maskSalesKitPii(String(body.message ?? '').trim()),
  reply_vi: out.reply_vi,
  stub_mode: Boolean(out.stub_mode),
  model_name: out.stub_mode ? (this.aiConfig.intakeSalesKitLlmEnabled ? `${this.aiConfig.llmModel}-stub` : 'rules') : this.aiConfig.llmModel,
  citations_json: out.citations ?? [],
  apply_json: out.apply ?? {},
});
return { ...out, turn_id: persisted?.id ?? null };
```

`IntakeService` hiện **không** inject `AiIntelligenceConfigService` — thêm inject **hoặc** đọc `model_name` từ `out` nếu polish sau này trả `model_name`. **Chốt:** thêm field optional trên output polish:

Trong Task 3, `model_name` persist = `'rules'` khi `stub_mode`, else `'llm'` (Task 6 sẽ ghi đúng model). Không inject config ở task này.

`listSalesKitTurns`: `getSession` + `assertLeadVisible` giống `salesKitTurn`; `crm_leads.view` hoặc `edit` đủ (write guard trên GET không bắt buộc — dùng cùng guard session GET: không `StaffIntakeWriteGuard`).

Controller:

```ts
@Get('sessions/:id/sales-kit/turns')
async listSalesKitTurns(@Req() req: IntakeRequest, @Param('id', ParseIntPipe) id: number) {
  return this.intake.listSalesKitTurns(id, await this.actorContext(req));
}
```

- [ ] **Step 1: Extend `intake.service.spec.ts`**

Hiện spec mock `library` + `salesKitLlm`. Thêm mock `turns.insert` resolve `{ id: 'turn-1' }`. Assert `salesKitTurn(..., { intent: 'ask_library' })` gọi `insert` và `turn_id === 'turn-1'`. Empty query vẫn insert (thread hiện “Gõ câu hỏi…”).

- [ ] **Step 2: Run — expect FAIL** (`turns` undefined / no `turn_id`)

Run: `cd services/ptt-crm-api && npx jest src/intake/intake.service.spec.ts --no-coverage`

- [ ] **Step 3: Wire persist + list**

Mọi `return` trong `salesKitTurn` đi qua private `async finishTurn(...)`.

- [ ] **Step 4: Run service + controller specs — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): persist sales kit turns on each reply

ChatBox can reload the thread after refresh without changing BANT or Complete.
EOF
)"
```

---

### Task 4: ChatBox UI (SK-AI-0)

**Files:**
- Modify: `services/ops-web/src/lib/api.ts` (`IntakeSalesKitOutput.turn_id`; `fetchIntakeSalesKitTurns`)
- Modify: `services/ops-web/src/components/crm/intake/IntakeSalesKitPanel.tsx`
- Create: `services/ops-web/src/components/crm/intake/IntakeSalesKitPanel.spec.ts` **chỉ nếu** repo đã có pattern test component intake; **nếu không** — test bằng unit `parseThread` extract sang `intake-sales-kit-thread.util.ts`
- Create: `services/ops-web/src/lib/crm/intake-sales-kit-thread.util.ts`
- Create: `services/ops-web/src/lib/crm/intake-sales-kit-thread.util.spec.ts`

**Interfaces:**
- Consumes: `GET /api/crm/intake/sessions/:id/sales-kit/turns` → `{ turns }`
- Produces: ChatBox luôn có composer; chip = `runIntent`; load thread khi `sessionId` đổi

`api.ts`:

```ts
export type IntakeSalesKitTurnRow = {
  id: string;
  intent: string;
  user_text: string;
  reply_vi: string;
  stub_mode: boolean;
  model_name: string;
  citations_json: unknown;
  apply_json: unknown;
  rating: 'up' | 'down' | null;
  created_at: string;
};

export async function fetchIntakeSalesKitTurns(token: string, sessionId: number) {
  return crmFetch<{ turns: IntakeSalesKitTurnRow[] }>(
    token,
    `/api/crm/intake/sessions/${sessionId}/sales-kit/turns`,
  );
}
```

`intake-sales-kit-thread.util.ts`:

```ts
export type SalesKitMode = 'off' | 'openai' | 'ollama';

export function kitBadge(opts: {
  mode: SalesKitMode;
  stubMode: boolean;
}): 'Rules' | 'LLM' | 'Ollama' | 'Stub' {
  if (opts.mode === 'off') return 'Rules';
  if (opts.stubMode) return 'Stub';
  return opts.mode === 'openai' ? 'LLM' : 'Ollama';
}

export function chipUserLabel(intent: string, message?: string): string {
  const labels: Record<string, string> = {
    next_question: 'Câu tiếp theo',
    gap_to_go: 'Còn thiếu để Go',
    win_intel: 'Win intel',
    service_dive: 'Deep-dive dịch vụ',
    summary_30s: 'Tóm tắt 30s',
    red_flag: 'Red flag',
    ask_library: 'Hỏi kho / Q&A',
    pricing_band: 'Bảng giá / band',
    freeform: message?.trim() || 'Hỏi kit',
  };
  if (intent === 'ask_library' || intent === 'freeform') {
    return message?.trim() || labels[intent]!;
  }
  return labels[intent] ?? intent;
}
```

Panel thay đổi bắt buộc:

1. Header badge: load GET `/sales-kit/runtime` (Task 6b). Tạm Task 4: `kitBadge({ mode: 'off', stubMode: last.stub_mode })` nếu chưa có runtime API.
2. State `turns: IntakeSalesKitTurnRow[]` + `useEffect` load `fetchIntakeSalesKitTurns`.
3. Sau `postIntakeSalesKit` append user+assistant (hoặc reload GET).
4. Composer **luôn** render. Placeholder: `Hỏi kit hoặc gõ điều KH vừa nói…`. Enter gửi; Shift+Enter newline.
5. Chip 1–6: `runIntent(intent)` không cần text.
6. Chip 7 không text: server đã trả “Gõ câu hỏi…” — vẫn hiện bubble.
7. Chip 8 `pricing_band` không text.
8. Gõ + Enter: nếu chip 7/8 active → intent đó + message; else `freeform`.
9. Apply bar trên **lượt assistant cuối** có `apply` — giữ confirm S2, default BANT hints **tắt**.
10. Copy footer: `Nội bộ — không gửi khách`.
11. **Không** import `LeadCopilotPanel`.
12. Xóa điều kiện `showChat = llmEnabled || libraryChat` — composer không ẩn.

- [ ] **Step 1: Failing util tests**

```ts
import { chipUserLabel, kitBadge } from './intake-sales-kit-thread.util';

it('badge Rules when mode off', () => {
  expect(kitBadge({ mode: 'off', stubMode: true })).toBe('Rules');
});
it('badge LLM vs Stub vs Ollama', () => {
  expect(kitBadge({ mode: 'openai', stubMode: false })).toBe('LLM');
  expect(kitBadge({ mode: 'openai', stubMode: true })).toBe('Stub');
  expect(kitBadge({ mode: 'ollama', stubMode: false })).toBe('Ollama');
});

it('chip ask_library without text keeps label', () => {
  expect(chipUserLabel('ask_library')).toBe('Hỏi kho / Q&A');
});
```

- [ ] **Step 2–4:** implement util + rewrite panel.

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-sales-kit-thread.util.spec.ts`

Expected: PASS. ops-web dùng vitest (`npm run test:unit`).

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): render intake sales kit as a ChatBox thread

Chips become shortcuts; the composer stays visible when the LLM flag is off.
EOF
)"
```

---

### Task 5: `AiLlmClient` OpenAI-compatible base URL (SK-AI-1)

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-llm.client.ts`
- Create: `services/ptt-crm-api/src/ai-intelligence/ai-llm.client.spec.ts` (nếu chưa có) hoặc extend file spec hiện có

**Interfaces:**
- Consumes: `LlmJsonCompletionInput` hiện tại
- Produces: thêm optional

```ts
export interface LlmJsonCompletionInput {
  systemPrompt: string;
  userContent: string;
  model?: string;
  stubJson: () => Record<string, unknown>;
  baseUrl?: string;   // default https://api.openai.com/v1
  apiKey?: string;    // default aiConfig.llmApiKey
  timeoutMs?: number; // default aiConfig.llmTimeoutMs
}
```

Đổi `callOpenAiChat` → `callChatCompletions`:

```ts
const root = (args.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
const url = `${root}/chat/completions`;
```

`completeJson`: `apiKey = input.apiKey ?? this.aiConfig.llmApiKey`. Thiếu key → stub như cũ. **Không** đổi URL mặc định của Copilot nếu caller không truyền `baseUrl`.

`completeText` / `summarizeStructured` **không** đổi ở task này (tránh regress Copilot). Chỉ `completeJson` + private helper dùng chung.

- [ ] **Step 1: Failing test với mock `fetch`**

```ts
it('posts completeJson to override baseUrl', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"reply_vi":"ok"}' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  });
  global.fetch = fetchMock as never;
  const client = new AiLlmClient({
    llmApiKey: 'k',
    llmModel: 'gpt-4o-mini',
    llmTimeoutMs: 8000,
  } as never);
  await client.completeJson({
    systemPrompt: 's',
    userContent: 'u',
    stubJson: () => ({ reply_vi: 'stub' }),
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: 'ollama',
    model: 'qwen2.5:7b-instruct',
  });
  expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/chat/completions');
});
```

- [ ] **Step 2: Run FAIL** (vẫn gọi api.openai.com)

- [ ] **Step 3: Implement helper + wire `completeJson`**

- [ ] **Step 4: PASS** + chạy `npx jest src/ai-intelligence --no-coverage` không regress

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ai): allow OpenAI-compatible base URL on completeJson

Sales Kit can target Ollama/vLLM without changing Copilot defaults.
EOF
)"
```

---

### Task 6: Kit LLM overrides + on-prem prompt (SK-AI-1)

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.spec.ts` (nếu có)
- Modify: `services/ptt-crm-api/src/intake/intake-sales-kit-llm.service.ts`
- Modify: `services/ptt-crm-api/src/intake/intake-sales-kit-llm.service.spec.ts`
- Modify: `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.ts`
- Modify: `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.spec.ts`

**Interfaces:**
- Produces trên config:

```ts
readonly intakeSalesKitLlmBaseUrl: string | null; // PTT_INTAKE_SALES_KIT_LLM_BASE_URL || PTT_AI_LLM_BASE_URL || null
readonly intakeSalesKitLlmModel: string;          // kit MODEL || llmModel
readonly intakeSalesKitLlmApiKey: string | null;  // kit KEY || llmApiKey || (baseUrl ? 'ollama' : null)
readonly intakeSalesKitLlmTimeoutMs: number;      // kit TIMEOUT || llmTimeoutMs (kit cho phép 15000)
```

`PTT_AI_LLM_BASE_URL` rỗng = `null` (không đổi default OpenAI cho Copilot).

`shouldCallLlm` (Task 6 tạm): vẫn đọc env `intakeSalesKitLlmEnabled`. **Task 6b** thay bằng `resolveKitMode() !== 'off'`. Dummy key `ollama` khi mode=`ollama`.

`polish` gọi:

```ts
await this.llm.completeJson({
  systemPrompt,
  userContent,
  model: this.aiConfig.intakeSalesKitLlmModel,
  apiKey: this.aiConfig.intakeSalesKitLlmApiKey ?? undefined,
  baseUrl: this.aiConfig.intakeSalesKitLlmBaseUrl ?? undefined,
  timeoutMs: this.aiConfig.intakeSalesKitLlmTimeoutMs,
  stubJson: () => ({ reply_vi: rules.reply_vi }),
});
```

`buildKitLlmSystemPrompt()` thêm dòng: `Bạn chạy on-prem; không được bịa giá ngoài excerpt.`

Test: flag on + baseUrl + key `ollama` + timeout mock → `completeJson` nhận `baseUrl`. Flag off → không gọi. `ask_library` citations rỗng → không gọi (giữ).

- [ ] **Step 1–4:** TDD config + polish + prompt spec

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): route sales kit polish through kit OSS overrides

Kit can use Ollama without enabling Copilot or sharing the OpenAI host.
EOF
)"
```

**Không** sửa `scripts/deploy_intake_sales_kit_s4_vps.sh` để bật LLM.

---

### Task 6b: UI + API đổi 3 mode (off / openai / ollama)

**Files:**
- Create: `services/ptt-crm-api/src/intake/sales-kit-runtime.util.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-runtime.util.spec.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-runtime.repository.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-runtime.service.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-runtime.service.spec.ts`
- Modify: `intake.module.ts`, `intake.controller.ts`, `intake-sales-kit-llm.service.ts`
- Modify: `services/ops-web/src/lib/api.ts`
- Modify: `IntakeSalesKitAdminPanel.tsx` — khối radio **Chế độ AI**
- Modify: `IntakeSalesKitPanel.tsx` — badge từ GET runtime

**Interfaces:**

```ts
export type SalesKitLlmMode = 'off' | 'openai' | 'ollama';

export function resolveKitMode(input: {
  locked: boolean;
  envMode: string | null;          // PTT_INTAKE_SALES_KIT_LLM_MODE
  legacyOn: boolean;               // PTT_INTAKE_SALES_KIT_LLM
  dbMode: SalesKitLlmMode | null;
}): SalesKitLlmMode;

export type SalesKitRuntimeDto = {
  mode: SalesKitLlmMode;
  locked: boolean;
  healthy: boolean;
  hint_vi: string;
};
```

`resolveKitMode` (test hết 4 tầng spec §7.0.2):

1. `locked` → parse `envMode` (invalid → `off`)
2. else `dbMode` nếu `off|openai|ollama`
3. else parse `envMode`
4. else `legacyOn ? 'openai' : 'off'`

`SalesKitRuntimeService.get(actor)`: edit hoặc configure; `healthy` theo spec.  
`patch(mode, actor)`: configure; nếu locked → 403 `mode_locked`; persist; return dto kèm `warning` nếu unhealthy.

`IntakeSalesKitLlmService.shouldCallLlm`: `resolveKitMode(...) !== 'off'` + citation gate.  
`completeJson` args:

- `openai` → không truyền `baseUrl` (default api.openai.com), key cloud, model gpt-4o-mini hoặc kit MODEL
- `ollama` → `baseUrl` kit/global/`http://127.0.0.1:11434/v1`, key `ollama`, model `qwen2.5:7b-instruct` hoặc kit MODEL

Admin UI: 3 radio `Không LLM` / `LLM (OpenAI)` / `Ollama`. Disable khi `locked`. Hiện `hint_vi`. AM panel chỉ badge.

- [ ] **Step 1: Failing util tests**

```ts
import { resolveKitMode } from './sales-kit-runtime.util';

it('lock uses env even if db is ollama', () => {
  expect(resolveKitMode({
    locked: true, envMode: 'off', legacyOn: true, dbMode: 'ollama',
  })).toBe('off');
});

it('db wins when unlocked', () => {
  expect(resolveKitMode({
    locked: false, envMode: 'off', legacyOn: false, dbMode: 'openai',
  })).toBe('openai');
});

it('legacy flag maps to openai', () => {
  expect(resolveKitMode({
    locked: false, envMode: null, legacyOn: true, dbMode: null,
  })).toBe('openai');
});
```

- [ ] **Step 2: Run FAIL** (module missing)

Run: `cd services/ptt-crm-api && npx jest src/intake/sales-kit-runtime.util.spec.ts --no-coverage`

- [ ] **Step 3: Implement util + service + routes + admin radios + panel GET badge**

- [ ] **Step 4: Service spec PATCH lock 403; GET ollama down healthy=false; polish mode=off không gọi llm**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): switch sales kit among off, OpenAI, and Ollama

GDKD can change wording engine without a rebuild; IT can lock the mode on small VPS.
EOF
)"
```

---

### Task 7: Rating 👍/👎 (SK-AI-2)

**Files:**
- Modify: `sales-kit-turns.repository.ts` (đã có `rate`)
- Modify: `intake.service.ts` — `rateSalesKitTurn`
- Modify: `intake.controller.ts`
- Modify: `api.ts` + `IntakeSalesKitPanel.tsx`

**Interfaces:**

```ts
async rateSalesKitTurn(
  turnId: string,
  body: { rating?: string; reason?: string },
  actor?: IntakeStaffActor | null,
): Promise<SalesKitTurnRow>
```

Cap: `crm_leads.edit`. Load turn → session → `assertLeadVisible`. `rating` chỉ `up`|`down`. `reason` trim ≤200.

```ts
@Post('sales-kit/turns/:id/rating')
@UseGuards(StaffIntakeWriteGuard)
@HttpCode(HttpCode.OK)
```

UI: mỗi bubble assistant hai nút; sau rate disable. Task 7 **chưa** trang Learn.

- [ ] **Step 1:** service spec — 403 nếu session lead không visible; 400 rating lạ; 200 set `down`

- [ ] **Step 2–4:** implement + panel

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): rate sales kit turns up or down

AM signal feeds the learn queue without editing BANT from the thread.
EOF
)"
```

---

### Task 8: Learn util + propose from down turn (SK-AI-2 admin)

**Files:**
- Create: `services/ptt-crm-api/src/intake/sales-kit-learn.util.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-learn.util.spec.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-learn.repository.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-learn.repository.spec.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-learn.service.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-learn.service.spec.ts`
- Modify: `intake.module.ts`, `intake.controller.ts`

**Interfaces:**

```ts
export function normalizeLearnQuestion(q: string): string;
export function answerHasForbiddenMoney(answer: string, kind: 'qa' | 'battle_card' | 'pricing'): boolean;
export function candidateFromDownTurn(input: {
  turn: { id: string; user_text: string; reply_vi: string; citations_json: unknown };
  serviceSlug: string;
  sessionId: number;
  leadId: number | null;
}): { kind: 'qa'; folder_key: string; question: string; answer: string } | null;

class SalesKitLearnService {
  proposeFromTurn(turnId: string, actor): Promise<LearnCandidateRow>;
  listCandidates(query, actor): Promise<{ candidates: LearnCandidateRow[] }>;
}
```

`normalizeLearnQuestion`: lower, collapse space, cắt 200.  
`answerHasForbiddenMoney`: dùng `MONEY_PATTERN` từ llm.util (export pattern hoặc duplicate cùng regex). kind `qa`|`battle_card` mà match tiền → true.  
`candidateFromDownTurn`: question = `user_text` hoặc 80 ký tự đầu `reply_vi`; answer = `reply_vi` cắt 800, nếu forbidden money → `null` (admin phải sửa tay — Task 8 trả 400 `money_in_qa`).  
`folder_key` = `${serviceSlug}/qa` nếu slug hợp lệ, else `_common/qa`.

`hasConfigure` giống library. Duplicate question (normalize) cùng `folder_key` trong 90 ngày → 409 `duplicate_question`.

```ts
@Get('sales-kit/learn/candidates')
@Post('sales-kit/learn/turns/:id/propose')
```

- [ ] **Step 1–4:** TDD util (money + normalize + folder) rồi service

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): propose sales kit Q&A from down-rated turns

GDKD can queue learn candidates without auto-publishing ready chunks.
EOF
)"
```

---

### Task 9: Learn page UI (filter down + propose)

**Files:**
- Create: `services/ops-web/src/app/crm/intake/sales-kit/learn/page.tsx`
- Create: `services/ops-web/src/components/crm/intake/IntakeSalesKitLearnPanel.tsx`
- Modify: `api.ts` — `fetchSalesKitLearnCandidates`, `proposeSalesKitLearnFromTurn`, `fetchSalesKitDownTurns`  
  Down turns: thêm `GET /api/crm/intake/sales-kit/learn/turns?rating=down&days=30` (configure) trên repository `listByRating`.

**Interfaces:**
- Produces: page cap configure (cùng `playbooks.configure` || `crm_leads.configure`) như `/crm/intake/sales-kit`
- Link từ admin kho: “Vòng nuôi”

Panel: bảng candidates (status, question, folder); bảng lượt `down` + nút **Đề xuất Q&A**. Không sửa reply tại chỗ.

- [ ] **Step 1:** repository `listByRating('down', since)` test

- [ ] **Step 2–4:** API + page

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add sales kit learn inbox for down turns

Configure users can turn weak replies into pending Q&A without AM access.
EOF
)"
```

---

### Task 10: Win-loop từ Complete (SK-AI-3)

**Files:**
- Modify: `sales-kit-learn.util.ts` — `candidatesFromCompletedSession`
- Modify: `sales-kit-learn.service.ts` — `enqueueFromCompletedSession(session)`
- Modify: `intake.service.ts` `completeSession`
- Create: `sales-kit-learn.util.spec.ts` cases Complete

**Interfaces:**

```ts
export function candidatesFromCompletedSession(input: {
  session: {
    id: number;
    lead_id: number | null;
    service_slug?: string;
    decision?: string | null;
    decision_reason?: string | null;
    answers_json?: Record<string, unknown>;
  };
  upTurns: Array<{ id: string; user_text: string; reply_vi: string; citations_json: unknown }>;
}): Array<{
  kind: 'qa' | 'battle_card' | 'pricing';
  folder_key: string;
  question: string;
  answer: string;
  source_turn_id: string | null;
}>;
```

Quy tắc:

1. Tối đa **3** candidate.
2. Ưu tiên 1 từ `decision_reason` (kind `qa`, question `Vì sao ${decision}?`).
3. Thêm từ `upTurns` (tối đa còn lại), skip money nếu kind ≠ pricing.
4. `pricing` **chỉ** khi citation turn `kind==='pricing'`; không copy số từ form BANT. Không citation → kind `qa`, answer `KH hỏi giá — neo gói, hỏi ngân sách.` (không chứa `₫` / `triệu`).
5. Trùng normalize 90 ngày → skip (repository).

`completeSession` **sau** `pg.completeSession` thành công:

```ts
void this.learn.enqueueFromCompletedSession(updated).catch((err) => {
  this.logger.warn(`sales_kit_learn skipped session=${updated.id}: ${err}`);
});
```

Không `await` trước return. Complete fail → không enqueue. 0 candidate là OK.

- [ ] **Step 1:** util tests — Go + reason; pricing không citation; max 3; money strip

- [ ] **Step 2–4:** enqueue + `completeSession` spec: mock learn, assert called, Complete vẫn 200 nếu learn throw

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): enqueue sales kit learn candidates after Complete

Closed sessions feed Q&A review without blocking the AM complete path.
EOF
)"
```

---

### Task 11: Approve / reject → file pending S4 (SK-AI-3)

**Files:**
- Modify: `sales-kit-learn.service.ts`
- Modify: `sales-kit-library.service.ts` — thêm `ingestVirtualQa` **hoặc** learn service tự gọi `uploadFile` với buffer exceljs 1 hàng
- Modify: Learn panel — nút Duyệt / Sửa / Từ chối

**Interfaces:**

```ts
approveCandidate(id: string, body: { question?: string; answer?: string; folder_key?: string }, actor): Promise<{ candidate; file }>
rejectCandidate(id: string, body: { reason?: string }, actor): Promise<LearnCandidateRow>
```

Approve:

1. `hasConfigure`.
2. Optional overwrite question/answer/folder.
3. Nếu `answerHasForbiddenMoney` kind qa/battle → 400.
4. Build xlsx 1 hàng bằng `exceljs` (cùng header `parseSalesKitXlsx` — đọc `sales-kit-ingest.util.ts` columns `question`/`câu hỏi` + `answer`/`trả lời`).
5. `library.uploadFile({ file: { buffer, originalname, mimetype, size }, folderKey, actor })` → `pending`.
6. Candidate `status='ingested'` (spec: approved rồi ingest file pending — **chốt:** `ingested` sau upload thành công; trước đó có thể `approved` nếu muốn 2 bước. **Một bước:** `ingested` + file `pending`. GDKD vẫn phải Duyệt kho S4 để `ready`).
7. Không gọi `approveFile` (không auto-ready).

Reject: `status=rejected`, `reject_reason` bắt buộc trim ≥3 ký tự.

```ts
@Post('sales-kit/learn/candidates/:id/approve')
@Post('sales-kit/learn/candidates/:id/reject')
```

- [ ] **Step 1:** service spec — approve tạo file pending; không `ready`; money qa 400; reject

- [ ] **Step 2–4:** implement + UI

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): ingest approved learn candidates as pending kit files

GDKD still uses the existing Duyệt kho gate before chunks become ready.
EOF
)"
```

---

### Task 12: Learn metrics + JSONL export + LoRA gate (SK-AI-4)

**Files:**
- Modify: `sales-kit-learn.repository.ts` — `metrics()`, `listExportPairs()`
- Modify: `sales-kit-learn.service.ts` — `exportJsonl`, `metrics`
- Modify: Learn page — 3 số pending/approved/rejected 7d+30d; % up/down; chunk ready (query `listFiles` + parse_status hoặc SQL count chunks category sales_kit — **dùng** `repo.listReadyChunks` length theo folder, không đụng `ragQuery`)
- Create: `scripts/sales_kit_lora_train.sh`
- Create: `services/ptt-crm-api/src/intake/sales-kit-learn-export.util.ts` + spec

**Interfaces:**

```ts
export function buildLoraJsonlLine(input: {
  systemPrompt: string;
  userContent: string;
  assistant: string;
}): string;

export function canStartLora(opts: { pairs: number; minPairs: number; enabled: boolean }): { ok: boolean; error?: string };
```

Export `GET /api/crm/intake/sales-kit/learn/export.jsonl` configure:

- Nguồn: turns `rating=up` AND `stub_mode=false` **hoặc** candidates `ingested` (question/answer).
- Loại: `down`, `stub_mode`, reply chứa `[số đã ẩn]`.
- Mask `maskSalesKitPii` trên mọi field.
- Không include túi phiên raw / SĐT.

`canStartLora`: `enabled && pairs >= minPairs` (default min 200, `PTT_SALES_KIT_LORA_MIN_PAIRS`).

`scripts/sales_kit_lora_train.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
# Không chạy trên Nest. Máy GPU.
MIN="${PTT_SALES_KIT_LORA_MIN_PAIRS:-200}"
ENABLED="${PTT_SALES_KIT_LORA_ENABLED:-0}"
FILE="${1:-/dev/stdin}"
PAIRS=$(grep -c '"assistant"' "$FILE" || true)
if [[ "$ENABLED" != "1" ]]; then
  echo "refused: PTT_SALES_KIT_LORA_ENABLED!=1" >&2
  exit 2
fi
if (( PAIRS < MIN )); then
  echo "refused: pairs=$PAIRS min=$MIN" >&2
  exit 3
fi
echo "OK would train pairs=$PAIRS (implement on GPU host — no nest)"
# Không gọi ollama/curl prod. Exit 0 chỉ khi cổng mở — phần train thật: comment block + MODEL_CARD.md template.
```

v1 script **cổng only**: exit 2/3 khi chưa đủ; khi đủ in hướng dẫn `MODEL_CARD.md` (ngày, N, sha256 dataset) — **không** pull GPU trên VPS API.

- [ ] **Step 1:** `canStartLora` + `buildLoraJsonlLine` tests; export loại stub/down

- [ ] **Step 2–4:** implement

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): export masked sales kit JSONL with LoRA start gate

Fine-tune stays opt-in and offline until 200 clean pairs exist.
EOF
)"
```

---

### Task 13: Docs + runbook (không bật LLM trên VPS 3.3 GiB)

**Files:**
- Modify: `docs/runbooks/ai-service-operations.md` — mục **Sales Kit OSS**
- Modify: `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` — ChatBox
- Modify: `docs/superpowers/specs/2026-08-29-sales-kit-oss-chatbox-srs.md` header Trạng thái → `Plan ready`

Runbook bắt buộc ghi:

| Máy | Ollama 7B |
|-----|-----------|
| `rs.pttads.vn` 3.3 GiB (đo 2026-08-30) | **Cấm** |
| VPS ≥16 GiB hoặc host GPU riêng | Được — `PTT_AI_LLM_BASE_URL=http://127.0.0.1:11434/v1` |

Các bước L1 (máy đủ RAM): `curl` ollama install; `ollama pull qwen2.5:7b-instruct`; set kit env; restart **chỉ** API; `NEXT_PUBLIC_*` chỉ khi muốn badge OSS.

Guide AM: composer luôn có; chip lối tắt; Áp dụng confirm; 👍/👎; “nội bộ”.

- [ ] **Step 1:** Sửa docs (không test code)

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs(crm): document sales kit ChatBox and OSS capacity gate

Record that the current 3.3 GiB VPS must not run a local 7B model.
EOF
)"
```

---

## UAT map

| Spec ID | Task | Pass |
|---------|------|------|
| CB-1 | 4 | Thread trống + 8 chip + composer |
| CB-2 | 3–4 | Gap-to-Go bubble rules; không fetch OSS |
| CB-3 | 3–4 | Hỏi kho trống → “Gõ câu hỏi…” |
| CB-4 | 4 | “KH nói đắt” + citation (kho S4 sẵn) |
| CB-5 | 4 | Áp dụng confirm; BANT hints default tắt |
| CB-6 | 3–4 | Refresh còn thread |
| MODE-1…4 | 6b | off / openai / ollama + lock |
| OSS-1 | 5–6b | Mode Ollama + host đủ RAM |
| OSS-2 | 5–6b | Ollama down → stub, không 500 |
| OSS-3 | 6 | Bịa 20 triệu → strip |
| OSS-4 | 6 | “Còn 24 điểm” sống |
| LN-1 | 7 | 👎 |
| LN-2 | 10 | Complete không fail nếu 0 candidate |
| LN-3 | 11 | Duyệt → file pending → Duyệt kho → Hỏi kho |
| LN-4 | 10–11 | Pricing không citation → không số VND |
| FT-1 | 12 | &lt;200 → script exit 3 |
| FT-2 | 12 | Cổng only trên GPU host |
| FT-3 | 12 | Rollback = đổi env model, không DDL |
| T4 isolation | — | Không sửa `playbooks.repository` filter trừ regression test vẫn pass |

---

## Self-review

| Spec | Task |
|------|------|
| §6 ChatBox + persist | 1–4 |
| §7 OSS adapter + 3 mode UI | 5–6b |
| §8 money / no LLM empty ask | giữ S3 + Task 6 |
| §9.1 rating + propose down | 7–9 |
| §9.2 Complete candidates | 10–11 |
| §9.3 metrics | 12 |
| §10 LoRA cổng | 12 |
| §12 API table | 3, 7, 8, 11, 12 |
| §13 RBAC | 3, 7, 8, 11 |
| VPS 3.3 GiB | 13 + Global |
| Isolation CSKH | Global — không đụng ragQuery |
| Out of scope SSE / Copilot / 9 form | Global |

Không TBD. Tên thống nhất: `maskSalesKitPii`, `SalesKitTurnsRepository`, `listSalesKitTurns`, `rateSalesKitTurn`, `enqueueFromCompletedSession`, `canStartLora`.

**Cố ý không làm:** SSE; tóm tắt 4 lượt vào prompt; OCR; cron TTL 90 ngày túi phiên; cài Ollama trên `rs.pttads.vn`.

---

## Deploy

Sau Task 4 (ChatBox sống, LLM off):

```bash
# local / VPS — DDL turns
bash scripts/apply_pg_ddl_sales_kit_learn.sh
# rồi deploy Nest + ops-web theo script S4 hiện có (không set PTT_INTAKE_SALES_KIT_LLM=1)
```

SK-AI-1 trên prod **chỉ** khi có host ≥16 GiB hoặc `PTT_INTAKE_SALES_KIT_LLM_BASE_URL` trỏ máy khác. VPS 3.3 GiB: dừng ở SK-AI-0 + 2 + 3 (rules + kho + nuôi).
