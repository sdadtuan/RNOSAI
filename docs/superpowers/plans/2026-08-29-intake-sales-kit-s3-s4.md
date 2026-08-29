# Intake Sales Kit S4 + S3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AM hỏi kho Q&A / bảng giá trên Intake và nhận đúng hàng + citation (S4, không cần LLM); sau đó bật flag để model chỉ diễn đạt wording (S3).

**Architecture:** S4 nạp file vào `sales_kit_files` + chunk `ai_playbook_chunks` (`category=sales_kit`). Retrieve **intake-local** (keyword + cosine hiện có) — không đổi hành vi `PlaybooksService.ragQuery` của CSKH. `salesKitTurn` rules-first; chip 7–8 lấy rank-1 Q&A khi LLM off. S3 gọi `AiLlmClient.completeJson` sau rules, timeout/error → giữ output rules, `stub_mode: true`. Không tự ghi BANT.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL · `exceljs` (đã có) · `pdf-parse` (dep mới duy nhất) · `sharp` (đã có) · `AiLlmClient` / `AiSummarizeRateLimitService` / `AiAgentRunsRepository`

**Parent spec:** [2026-08-29-intake-deal-bar-sales-kit-design.md](../specs/2026-08-29-intake-deal-bar-sales-kit-design.md) v1.1 · **Shipped:** S0–S2 trên `main` `f16ee20a` · **Prod:** https://rs.pttads.vn/crm/intake?lead_id=5

**Thứ tự lệch spec §13 (cố ý):** spec liệt kê S3 rồi S4. **Plan này làm S4 trước** vì D12: keyword Q&A chạy khi LLM off; prod thường `PTT_AI_COPILOT_ENABLED=0`. S3 không mở được giá/case nếu chưa có kho.

## Global Constraints

- Không đổi `GO_THRESHOLDS` `{ go: 24, nurture_min: 18 }` và 6 BANT keys.
- Kit không Complete / Reopen / advance funnel / enqueue SCI M2.
- Không mount Lead Copilot trên Intake.
- Không thêm package `xlsx`. Không Tesseract. Không puppeteer/Chromium.
- Không dual-write storage: **S4 chỉ disk** `PTT_SALES_KIT_STORAGE_DIR` (default `var/sales-kit`). S3 CMS = backlog.
- Không đổi `PlaybooksService.ragQuery` ranking CSKH.
- File túi phiên chỉ retrieve khi `lead_id` + `session_id` khớp phiên đang hỏi.
- Giá / case / KPI chỉ khi có citation `ready` kind `pricing` | `case` | `qa`.
- `PTT_INTAKE_SALES_KIT_LLM` default `0`. `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT` giữ default `1`.
- Ingest không đọc cột ngoài whitelist header; không thực thi macro Excel.
- MIME: xlsx · pdf · png/jpeg/webp. `.docx` → 400 `unsupported_type`.
- Size: Excel ≤ 2 MB · PDF ≤ 8 MB · ảnh ≤ 4 MB. Org 40 file/folder · túi phiên 10/session.

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-08-29-sales-kit-files-ddl.sql` | `sales_kit_files` |
| `scripts/apply_pg_ddl_sales_kit_files.sh` | Apply DDL trên VPS/local |
| `services/ptt-crm-api/src/intake/sales-kit-library.util.ts` | folder_key, slug, MIME, size |
| `services/ptt-crm-api/src/intake/sales-kit-ingest.util.ts` | parse xlsx / pdf / image gate |
| `services/ptt-crm-api/src/intake/sales-kit-retrieve.util.ts` | score + session boost + money guard |
| `services/ptt-crm-api/src/intake/sales-kit-library.repository.ts` | files + ensure playbook + insert chunks |
| `services/ptt-crm-api/src/intake/sales-kit-library.service.ts` | upload / list / approve / retrieve |
| `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.ts` | prompt + `assertNoInventedMoney` |
| `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts` | `intakeSalesKitLlmEnabled` |
| `services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts` | `INTAKE_SALES_KIT` · `INTAKE_SALES_KIT_INGEST` · `INTAKE_AI_SUMMARY` |
| `intake.controller.ts` / `intake.service.ts` / `intake.module.ts` | routes + wire retrieve + LLM |
| `services/ops-web/src/app/crm/intake/sales-kit/page.tsx` | admin GDKD |
| `IntakeSalesKitLibrarySheet.tsx` | túi phiên + browse org |
| `IntakeSalesKitPanel.tsx` | citations live; chat Hỏi kho khi LLM off |
| `docs/crm/sales-kit/mau-qa-seo.xlsx` | seed 5 hàng (generate in test; commit binary OR generate on admin Tải mẫu) |
| `scripts/deploy_intake_sales_kit_s4_vps.sh` | DDL + Nest + ops-web |

---

### Task 1: Folder keys + `sales_kit_files` DDL

**Files:**
- Create: `docs/specs/2026-08-29-sales-kit-files-ddl.sql`
- Create: `scripts/apply_pg_ddl_sales_kit_files.sh`
- Create: `services/ptt-crm-api/src/intake/sales-kit-library.util.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-library.util.spec.ts`

**Interfaces:**
- Consumes: spec §8.9 folder tree; `folder_key` max 3 cấp `[a-z0-9-_]+`
- Produces: `folderKeyOk`, `playbookSlugForFolder`, `sessionFolderKey`, `ORG_KIND_FOLDERS`, `ALLOWED_SALES_KIT_MIME`, `salesKitFileTooLarge`

- [ ] **Step 1: Write failing tests**

```ts
import {
  folderKeyOk,
  playbookSlugForFolder,
  sessionFolderKey,
  salesKitFileTooLarge,
} from './sales-kit-library.util';

describe('sales-kit-library.util', () => {
  it('accepts org qa folder and rejects path escape', () => {
    expect(folderKeyOk('dich-vu-seo-tong-the/qa')).toBe(true);
    expect(folderKeyOk('dich-vu-seo-tong-the/qa/bds')).toBe(true);
    expect(folderKeyOk('../etc')).toBe(false);
    expect(folderKeyOk('SEO/qa')).toBe(false);
    expect(folderKeyOk('a/b/c/d')).toBe(false);
  });

  it('maps folder and session slugs', () => {
    expect(playbookSlugForFolder('dich-vu-seo-tong-the/qa')).toBe('sk-dich-vu-seo-tong-the-qa');
    expect(sessionFolderKey(5, 12)).toBe('session/5/12');
    expect(playbookSlugForFolder('session/5/12')).toBe('sk-session-5-12');
  });

  it('enforces size caps', () => {
    expect(salesKitFileTooLarge('application/pdf', 8 * 1024 * 1024 + 1)).toBe(true);
    expect(salesKitFileTooLarge('image/png', 4 * 1024 * 1024)).toBe(false);
  });
});
```

- [ ] **Step 2: Run fail**

Run: `cd services/ptt-crm-api && npx jest src/intake/sales-kit-library.util.spec.ts --no-coverage`  
Expected: FAIL module not found

- [ ] **Step 3: Implement util + DDL**

```ts
export const ORG_KIND_FOLDERS = ['qa', 'battle-cards', 'cases', 'pricing'] as const;

export const ALLOWED_SALES_KIT_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

const SIZE_CAP: Record<string, number> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 2 * 1024 * 1024,
  'application/pdf': 8 * 1024 * 1024,
  'image/png': 4 * 1024 * 1024,
  'image/jpeg': 4 * 1024 * 1024,
  'image/webp': 4 * 1024 * 1024,
};

export function folderKeyOk(key: string): boolean {
  const parts = String(key ?? '')
    .split('/')
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  return parts.every((p) => /^[a-z0-9][a-z0-9-_]*$/.test(p));
}

export function playbookSlugForFolder(folderKey: string): string {
  return `sk-${folderKey.replace(/\//g, '-')}`;
}

export function sessionFolderKey(leadId: number, sessionId: number): string {
  return `session/${leadId}/${sessionId}`;
}

export function salesKitFileTooLarge(mime: string, bytes: number): boolean {
  const cap = SIZE_CAP[mime];
  if (!cap) return true;
  return bytes > cap;
}

export function isAllowedSalesKitMime(mime: string): boolean {
  return (ALLOWED_SALES_KIT_MIME as readonly string[]).includes(mime);
}
```

DDL `docs/specs/2026-08-29-sales-kit-files-ddl.sql`:

```sql
CREATE TABLE IF NOT EXISTS sales_kit_files (
  id BIGSERIAL PRIMARY KEY,
  playbook_id UUID,
  lead_id INTEGER,
  session_id INTEGER,
  folder_key VARCHAR(191) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime VARCHAR(127) NOT NULL,
  storage_key TEXT NOT NULL,
  parse_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_kit_files_folder_idx ON sales_kit_files (folder_key);
CREATE INDEX IF NOT EXISTS sales_kit_files_lead_idx ON sales_kit_files (lead_id, session_id);
```

`scripts/apply_pg_ddl_sales_kit_files.sh` clone `scripts/apply_pg_ddl_lead_meeting_prep.sh`: source `.env`, `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/specs/2026-08-29-sales-kit-files-ddl.sql`.

- [ ] **Step 4: PASS** — same jest command

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-08-29-sales-kit-files-ddl.sql \
  scripts/apply_pg_ddl_sales_kit_files.sh \
  services/ptt-crm-api/src/intake/sales-kit-library.util.ts \
  services/ptt-crm-api/src/intake/sales-kit-library.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): add sales_kit_files schema and folder keys

EOF
)"
```

---

### Task 2: Parse Excel Q&A + pricing

**Files:**
- Create: `services/ptt-crm-api/src/intake/sales-kit-ingest.util.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-ingest.util.spec.ts`

**Interfaces:**
- Consumes: spec §8.10 header aliases; `exceljs` already in `ptt-crm-api/package.json`
- Produces:

```ts
export type IngestChunk = {
  chunk_key: string;
  title: string;
  body: string;
  kind: 'qa' | 'pricing' | 'battle_card' | 'case' | 'other';
};

export function parseSalesKitXlsx(
  buf: Buffer,
  kind: 'qa' | 'pricing' | 'auto',
): { chunks: IngestChunk[]; error?: 'xlsx_qa_columns' | 'xlsx_empty' };
```

- [ ] **Step 1: Failing tests** (in-memory workbook, no binary fixture)

```ts
import ExcelJS from 'exceljs';
import { parseSalesKitXlsx } from './sales-kit-ingest.util';

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet('qa');
  rows.forEach((r) => sh.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

it('parses Q/A aliases', async () => {
  const buf = await xlsx([
    ['cau_hoi', 'cau_tra_loi'],
    ['KH nói đắt', 'Neo gói TC 3 tháng, không giảm dưới band'],
  ]);
  const out = parseSalesKitXlsx(buf, 'qa');
  expect(out.chunks).toHaveLength(1);
  expect(out.chunks[0].body).toContain('KH nói đắt');
  expect(out.chunks[0].body).toContain('Neo gói TC');
  expect(out.chunks[0].kind).toBe('qa');
});

it('fails without Q/A columns', async () => {
  const buf = await xlsx([['foo', 'bar'], ['a', 'b']]);
  expect(parseSalesKitXlsx(buf, 'qa').error).toBe('xlsx_qa_columns');
});

it('parses pricing sheet', async () => {
  const buf = await xlsx([
    ['goi', 'min_vnd', 'max_vnd', 'note'],
    ['SEO TC', '15000000', '25000000', '3 tháng'],
  ]);
  const out = parseSalesKitXlsx(buf, 'pricing');
  expect(out.chunks[0].body).toMatch(/15/);
  expect(out.chunks[0].kind).toBe('pricing');
});
```

- [ ] **Step 2: Run fail**

Run: `cd services/ptt-crm-api && npx jest src/intake/sales-kit-ingest.util.spec.ts --no-coverage`

- [ ] **Step 3: Implement**

Normalize header: lowercase, strip dấu không bắt buộc — match exact aliases:

`question|cau_hoi|q` · `answer|cau_tra_loi|a` · `item|goi` · `min_vnd` · `max_vnd` · `note`

Q&A body: `Q: ${q}\nA: ${a}`. Title = 80 ký tự đầu câu hỏi.  
Pricing body: `Gói ${item}: ${min}–${max} VND. ${note}`.  
`auto`: nếu có cột Q/A → qa; else nếu có `min_vnd` → pricing; else `xlsx_qa_columns`.  
Skip hàng trống. Cap 200 hàng sync (nếu >200 vẫn parse trong S4 sync — ghi chú `parse_error=xlsx_truncated` và chỉ lấy 200; không làm job `sales_kit_parse` ở wave này).

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake/sales-kit-ingest.util.ts \
  services/ptt-crm-api/src/intake/sales-kit-ingest.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): parse sales-kit Excel Q&A and pricing sheets

EOF
)"
```

---

### Task 3: PDF text + image OCR gate

**Files:**
- Modify: `sales-kit-ingest.util.ts` + `.spec.ts`
- Modify: `services/ptt-crm-api/package.json` — add `pdf-parse` (no Chromium)

**Interfaces:**
- Produces:

```ts
export function parseSalesKitPdf(buf: Buffer): {
  chunks: IngestChunk[];
  error?: 'pdf_needs_ocr';
};

export function imageParseStatus(llmOn: boolean): 'pending_vision' | 'needs_ocr';
```

- [ ] **Step 1: Tests**

```ts
it('image stays needs_ocr when LLM off', () => {
  expect(imageParseStatus(false)).toBe('needs_ocr');
  expect(imageParseStatus(true)).toBe('pending_vision');
});

it('empty PDF extract is needs_ocr', () => {
  const out = parseSalesKitPdf(Buffer.from('%PDF-1.4 empty'));
  expect(out.error).toBe('pdf_needs_ocr');
});
```

Nếu `pdf-parse` extract được fixture nhỏ có chữ `Hello`: thêm test `chunks[0].body` chứa `Hello`. Nếu không, giữ test `needs_ocr` trên buffer không text.

- [ ] **Step 2: Run fail**

- [ ] **Step 3: Implement**

```bash
cd services/ptt-crm-api && npm install pdf-parse --save
```

`parseSalesKitPdf`: gọi `pdf-parse`, chunk ~800 ký tự overlap 80, `kind: 'other'`, `chunk_key` placeholder `p{page}:{i}` (service sẽ prefix `file:{id}:`). 0 text → `{ chunks: [], error: 'pdf_needs_ocr' }`.

`imageParseStatus(llmOn)` only — **không** gọi vision trong S4. S3 có thể đổi `pending_vision` → job; wave này approve ảnh chỉ khi LLM on **và** Task 8 implement vision (optional). S4 ship: ảnh luôn `needs_ocr` nếu LLM off, không vào RAG.

Resize ảnh (`sharp` max cạnh 1600) khi persist ở Task 4 — không parse text ở đây.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/package.json services/ptt-crm-api/package-lock.json \
  services/ptt-crm-api/src/intake/sales-kit-ingest.util.ts \
  services/ptt-crm-api/src/intake/sales-kit-ingest.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): extract sales-kit PDF text and gate images for OCR

EOF
)"
```

---

### Task 4: Retrieve scorer (session thắng org)

**Files:**
- Create: `services/ptt-crm-api/src/intake/sales-kit-retrieve.util.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-retrieve.util.spec.ts`

**Interfaces:**
- Consumes: `keywordScore`, `cosineSimilarity`, `embedPlaybookText` from `../playbooks/playbooks.types`
- Produces:

```ts
export type SalesKitHit = {
  file_id: string;
  file_name: string;
  folder_path: string;
  excerpt: string;
  score: number;
  kind: 'qa' | 'battle_card' | 'case' | 'pricing' | 'session_upload' | 'other';
  body: string;
  is_session: boolean;
};

export function scoreSalesKitChunks(input: {
  query: string;
  rows: Array<{
    body: string;
    title: string;
    file_id: string;
    file_name: string;
    folder_path: string;
    kind: SalesKitHit['kind'];
    is_session: boolean;
    parse_status: string;
  }>;
  limit?: number;
}): SalesKitHit[];

export function qaAnswerFromBody(body: string): string;
```

- [ ] **Step 1: Tests**

```ts
it('boosts session chunk on tie and drops draft/needs_ocr', () => {
  const hits = scoreSalesKitChunks({
    query: 'đắt',
    rows: [
      {
        body: 'Q: KH nói đắt\nA: Neo gói org',
        title: 'đắt',
        file_id: '1',
        file_name: 'org.xlsx',
        folder_path: 'dich-vu-seo-tong-the/qa',
        kind: 'qa',
        is_session: false,
        parse_status: 'ready',
      },
      {
        body: 'Q: KH nói đắt\nA: Neo gói session',
        title: 'đắt',
        file_id: '2',
        file_name: 'bag.xlsx',
        folder_path: 'session/5/12',
        kind: 'qa',
        is_session: true,
        parse_status: 'ready',
      },
      {
        body: 'Q: đắt\nA: draft',
        title: 'đắt',
        file_id: '3',
        file_name: 'draft.xlsx',
        folder_path: 'dich-vu-seo-tong-the/qa',
        kind: 'qa',
        is_session: false,
        parse_status: 'pending',
      },
    ],
  });
  expect(hits[0].file_id).toBe('2');
  expect(hits.some((h) => h.file_id === '3')).toBe(false);
});

it('qaAnswerFromBody returns A line', () => {
  expect(qaAnswerFromBody('Q: x\nA: Neo gói TC')).toBe('Neo gói TC');
});
```

- [ ] **Step 2: Run fail**

- [ ] **Step 3: Implement**

Filter `parse_status === 'ready'`. Score = same mix as playbooks (`vector*0.7 + keyword`). Session: `score += 0.2`. Sort desc, `limit` default 5. Excerpt = `body.slice(0, 120)`.  
`qaAnswerFromBody`: match `/^A:\s*(.*)/m` else full body.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake/sales-kit-retrieve.util.ts \
  services/ptt-crm-api/src/intake/sales-kit-retrieve.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(crm): score sales-kit chunks with session boost

EOF
)"
```

---

### Task 5: Library service + HTTP + wire `ask_library`

**Files:**
- Create: `services/ptt-crm-api/src/intake/sales-kit-library.repository.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-library.service.ts`
- Create: `services/ptt-crm-api/src/intake/sales-kit-library.service.spec.ts` (mock repo + fs)
- Modify: `intake.controller.ts` — `POST/GET sales-kit/files`, `POST sales-kit/files/:id/approve`
- Modify: `intake.service.ts` `salesKitTurn` — sau rules, nếu intent ∈ `ask_library` | `pricing_band` | `battle_card` (hoặc `freeform` + tín hiệu giá/case/đắt) → retrieve, ghi `citations`, override `reply_vi`
- Modify: `intake.module.ts` — providers
- Modify: `ai-audit.constants.ts` — `INTAKE_SALES_KIT_INGEST: 'intake_sales_kit_ingest'`

**Interfaces:**
- Consumes: Task 1–4 utils; `PlaybooksRepository.insertPlaybook` / `insertChunk` **hoặc** SQL trực tiếp trong library repo (prefer SQL trong library repo để không bắt playbooks seed CSKH)
- Produces: HTTP + `retrieveForSession(session, query, kindHint)`

Caps:
- Org upload / approve: `playbooks.configure` **hoặc** `crm_leads.configure`
- Túi phiên (`lead_id` + `session_id` trong body): `crm_leads.edit` + `assertLeadVisible`
- GET list: cùng cap view (`crm_leads.view` cho túi phiên của lead đó; configure cho org)

Storage: `path.join(process.env.PTT_SALES_KIT_STORAGE_DIR || 'var/sales-kit', storageKey)` dưới cwd API. `mkdirSync` recursive. `storage_key` = `{folder_key}/{id}-{safeName}` sau khi có id (write temp rồi move) hoặc `{folder}/{uuid}-{name}`.

Parse sync: xlsx / pdf. Ảnh → `needs_ocr`. Failed → `parse_status=failed` + `parse_error`. Thành công + có chunk → `ready`. Org file mặc định `pending` **duyệt** mới `ready` **hoặc** auto-ready nếu uploader có configure — **spec: nút Duyệt**. Org: insert chunks nhưng `playbook.status` giữ `draft` đến approve; retrieve chỉ `active` + file `ready`.  
Approve: `UPDATE ai_playbooks SET status='active'` + file `ready`.

Ensure playbook: `category='sales_kit'`, `slug=playbookSlugForFolder(folder_key)`, tags `['sales_kit', serviceSlug, kind]`. Túi phiên: tags `['sales_kit','session']`, status `active` ngay (AM tự upload).

Count caps trước insert: 40 org / folder_key; 10 session.

MIME unknown / `.docx` → `BadRequestException({ error: 'unsupported_type' })`.

`salesKitTurn` sau `runSalesKitRules`:

```ts
if (needsLibrary(intent, message)) {
  const hits = await this.library.retrieveForSession(session, query, intent);
  if (!hits.length) {
    return { ...rules, citations: [], reply_vi: emptyLibraryReply(intent) };
  }
  const top = hits[0];
  return {
    ...rules,
    reply_vi: intent === 'pricing_band' ? top.body : qaAnswerFromBody(top.body),
    citations: hits.map(toCitation),
    stub_mode: true,
  };
}
```

`needsLibrary`: intent `ask_library` | `pricing_band` | `battle_card` OR (`freeform` && `/(đắt|giá|case|báo giá|band)/i.test(message)`).

Query: `message` trim hoặc `'pricing ' + serviceSlug` cho `pricing_band`.

Rate limit: inject `AiSummarizeRateLimitService`, `check('intake-kit:'+actorId, aiConfig.summarizeRateLimitPerMin)`.

- [ ] **Step 1: Jest** `retrieveForSession` mock rows — session filter: org slug + `_common` + session folder; never other lead.

```ts
it('does not return other-lead session chunks', async () => {
  repo.listReadyChunks.mockResolvedValue([
    { lead_id: 9, session_id: 99, folder_path: 'session/9/99', body: 'A: leak', parse_status: 'ready', ... },
    { lead_id: null, folder_path: 'dich-vu-seo-tong-the/qa', body: 'Q: đắt\nA: Neo', parse_status: 'ready', ... },
  ]);
  const hits = await svc.retrieveForSession({ id: 12, lead_id: 5, service_slug: 'dich-vu-seo-tong-the' }, 'đắt', 'ask_library');
  expect(hits.every((h) => h.file_name !== 'leak.xlsx')).toBe(true);
});
```

- [ ] **Step 2: Run fail**

- [ ] **Step 3: Implement repo/service/controller**

Routes (cùng prefix intake hiện tại):

```
POST   /api/crm/intake/sales-kit/files          multipart field "file" + folder_key + optional lead_id,session_id
GET    /api/crm/intake/sales-kit/files          ?folder_key= | ?session_id=
POST   /api/crm/intake/sales-kit/files/:id/approve
GET    /api/crm/intake/sales-kit/files/:id/download   staff guard, disk stream
```

Không public URL không guard.

- [ ] **Step 4: PASS** jest library + existing sales-kit-rules (ask_library empty vẫn pass khi không mock library — `salesKitTurn` integration: nếu library empty, giữ empty-state).

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): upload sales-kit files and retrieve Q&A with citations

EOF
)"
```

---

### Task 6: Admin UI + túi phiên + e2e S4 + AEO label

**Files:**
- Create: `services/ops-web/src/app/crm/intake/sales-kit/page.tsx`
- Create: `services/ops-web/src/components/crm/intake/IntakeSalesKitAdminPanel.tsx`
- Create: `services/ops-web/src/components/crm/intake/IntakeSalesKitLibrarySheet.tsx`
- Modify: `OpsNav.tsx` — nếu `playbooks.configure` hoặc `crm_leads.configure`: `{ href: '/crm/intake/sales-kit', label: 'Kho Sales Kit' }` trong nhóm Bán hàng
- Modify: `IntakeSalesKitPanel.tsx` — luôn hiện citations; chip 7–8 không cần `llmEnabled`; placeholder Hỏi kho hiện khi chọn chip 7 (không chỉ khi LLM)
- Modify: `IntakeContent.tsx` — nút **Kho** mở sheet; `serviceSlug` đã có
- Modify: `services/ops-web/src/lib/api.ts` — `uploadIntakeSalesKitFile`, `listIntakeSalesKitFiles`, `approveIntakeSalesKitFile`
- Modify: `intake-service-resolve.ts` `LABELS` thêm catalog tối thiểu: `'dich-vu-aeo': 'AEO'` (UAT-11)
- Modify: `e2e/intake-deal-bar-sales-kit.spec.ts` — UAT-13/14 skip nếu không cap; hoặc API-level Playwright `request` với staff token nếu env có
- Modify: `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` — mục Kho + Hỏi kho
- Create: `scripts/deploy_intake_sales_kit_s4_vps.sh` clone `deploy_intake_deal_bar_vps.sh`: bước 0 `bash scripts/apply_pg_ddl_sales_kit_files.sh`; jest thêm ingest/retrieve/library; vitest giữ resolve/apply

**Admin panel (tối thiểu):**
- Cây folder cố định 3 pilot + `_common` × 4 kind (link query `?folder=`)
- Upload xlsx/pdf/ảnh
- Bảng: name, parse_status, Duyệt
- Nút **Tải mẫu**: client generate xlsx bằng SheetJS **không** — generate trên API `GET /api/crm/intake/sales-kit/sample.xlsx` (exceljs, 5 hàng SEO: gồm hàng `KH nói đắt` / `Neo gói TC 3 tháng, không giảm dưới band`)

**Sheet túi phiên:** dropzone; list file session; org browse read-only (không nút xóa org).

Chat Hỏi kho khi LLM off: `IntakeSalesKitPanel` hiện form 1 dòng “KH vừa nói…” luôn cho `ask_library` / `pricing_band` (không phụ thuộc `llmEnabled`). Gửi `postIntakeSalesKit({ intent, message })`.

- [ ] **Step 1:** Vitest `intakeServiceLabel('dich-vu-aeo') === 'AEO'`

- [ ] **Step 2–4:** UI + API client + e2e comment UAT-13–18 checklist trong spec file header

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add sales-kit library admin and session file bag

EOF
)"
```

**S4 ship gate:** upload mẫu SEO → chip Hỏi kho “KH nói đắt” → citation + không bịa số khi pricing trống. PO có thể merge/deploy S4 trước S3.

---

### Task 7: LLM safety util + flag

**Files:**
- Create: `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.ts`
- Create: `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.spec.ts`
- Modify: `ai-intelligence.config.ts` — `readonly intakeSalesKitLlmEnabled` từ `envFlag('PTT_INTAKE_SALES_KIT_LLM', false)`
- Modify: `ai-audit.constants.ts` — `INTAKE_SALES_KIT: 'intake_sales_kit'`, `INTAKE_AI_SUMMARY: 'intake_ai_summary'`

**Interfaces:**

```ts
export function assertNoInventedMoney(
  reply: string,
  citations: Array<{ kind: string }>,
): boolean;

export function buildKitLlmSystemPrompt(): string;
export function stripInventedMoney(reply: string): string;
```

- [ ] **Step 1: Tests**

```ts
it('blocks money without pricing/qa citation', () => {
  expect(assertNoInventedMoney('Gói 20 triệu', [])).toBe(false);
  expect(assertNoInventedMoney('Gói 20 triệu', [{ kind: 'pricing' }])).toBe(true);
  expect(assertNoInventedMoney('Gói 20 triệu', [{ kind: 'qa' }])).toBe(true);
  expect(assertNoInventedMoney('Hỏi ngân sách tháng', [])).toBe(true);
});
```

`assertNoInventedMoney`: nếu `/\d+\s*(tr|triệu|vnd|đ)/i` và không citation kind `pricing|qa|case` → false.

`buildKitLlmSystemPrompt` chứa: cấm bịa số/KPI/case; một ý; không draft outbound; mask SĐT; chỉ dùng excerpt citation.

- [ ] **Step 2–4: Implement** (chưa gọi LLM)

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): add sales-kit LLM money guard and flag

EOF
)"
```

---

### Task 8: Wire LLM wording + summary + deploy S3

**Files:**
- Modify: `intake.service.ts` `salesKitTurn` + `generateAiSummary`
- Create: thin `IntakeSalesKitLlmService` (clone pattern `LeadMeetingPrepLlmService.completeSynthesize`) — `completeJson` timeout catch → return rules payload
- Modify: `intake.module.ts`
- Guide: 27 + 25 — cách bật flag VPS (`PTT_INTAKE_SALES_KIT_LLM=1` + `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM=1` + API key). Default **không** bật trên deploy script
- Modify: `scripts/deploy_intake_sales_kit_s4_vps.sh` comment S3 flags (không auto-patch runtime)

**Rules:**
- Chỉ rewrite `reply_vi` / `apply.ai_summary` / `next_question.text` (không đổi key).
- `bant_hints` từ LLM **không** merge vào `bant_json`. Có thể trả trong `apply.bant_hints`; panel vẫn default **off**.
- Sau LLM: nếu `!assertNoInventedMoney(reply, citations)` → `stripInventedMoney` hoặc rollback `rules.reply_vi`.
- `stub_mode: true` khi flag off, no key, timeout, stubJson path.
- Intents LLM: `summary_30s`, `next_question`, `freeform` wording. `ask_library` LLM chỉ diễn đạt khi đã có citation; không citation → không gọi LLM (giữ empty-state).
- Ảnh `pending_vision`: **không** block S3 ship. Nếu còn giờ: 1 ảnh, 1 page, JSON `{ text_vi }` → 1 chunk; lỗi → `needs_ocr`. Có thể skip vision trong Task 8 nếu hết thời gian — ghi PR “vision backlog, UAT-17 vẫn needs_ocr”.

`completeJson` input:

```ts
{
  systemPrompt: buildKitLlmSystemPrompt(),
  userContent: JSON.stringify({
    intent,
    rules_reply: rules.reply_vi,
    citations: citations.map((c) => ({ excerpt: c.excerpt, kind: c.kind })),
    industry,
    service_slug,
  }),
  model: this.aiConfig.llmModel,
  stubJson: () => ({ reply_vi: rules.reply_vi }),
}
```

Parse `{ reply_vi: string }`. Try/catch `ServiceUnavailableException` → rules.

Audit `ai_agent_runs` use_case `intake_sales_kit` | `intake_ai_summary`.

- [ ] **Step 1: Jest** service với `llm.completeJson` mock — flag off không gọi; flag on + money không citation → strip; timeout → rules.

- [ ] **Step 2–4: Implement**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(crm): optional LLM path for intake sales kit

EOF
)"
```

---

## UAT map (còn lại)

| ID | Task | Pass |
|----|------|------|
| UAT-11 | 6 | Deal Bar “AEO”, form common |
| UAT-13 | 5–6 | Admin Excel, Duyệt, chunk ready |
| UAT-14 | 5–6 | “KH nói đắt” + citation |
| UAT-15 | 5 | Pricing trống → empty-state |
| UAT-16 | 5–6 | PDF túi phiên chỉ lead đó |
| UAT-17 | 3 | Ảnh + LLM off → `needs_ocr` |
| UAT-18 | 5 | `.docx` → 400 |
| UAT-8 + LLM | 8 | Flag on: summary model, không `[stub]`; flag off: rules |

Không regress stepper gate · playbooks CSKH ragQuery.

---

## Self-review

| Spec | Task |
|------|------|
| §8.9 folder + `sales_kit_files` + playbook slug | 1, 5 |
| §8.10 xlsx aliases + exceljs | 2 |
| §8.10 pdf text, no Tesseract; image needs_ocr | 3 |
| §8.11 retrieve + citation; keyword khi LLM off | 4, 5 |
| §9.2 chip 7–8 + túi phiên + admin | 6 |
| §8.8 money/case citation; §10 LLM flag | 7, 8 |
| D12 S4 độc lập S3 | S4 gate sau Task 6 |
| Out of scope: 9 slug, docx, M2 early, Tesseract, S3 dual-write | Global |

Không TBD. Tên hàm (`folderKeyOk`, `parseSalesKitXlsx`, `scoreSalesKitChunks`, `retrieveForSession`, `assertNoInventedMoney`) thống nhất.

**Cố ý không làm trong plan này:** job `sales_kit_parse` hàng đợi (xlsx >200 cắt 200); TTL 90 ngày túi phiên (SQL helper có thể thêm 1 hàm `sessionBagExpired` trong Task 4, cron = backlog); vision ảnh; sync slug session → funnel.

---

## Deploy

Sau Task 6:

```bash
APPLY=1 ./scripts/deploy_intake_sales_kit_s4_vps.sh
```

S3: set env tay trên VPS, rebuild ops-web (public flag), restart API. Không bật LLM trong script mặc định.
