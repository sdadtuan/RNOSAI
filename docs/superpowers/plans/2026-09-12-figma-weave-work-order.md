# Figma Weave × RNOSAI — Creative Work Order Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Không phải chat.** Plan [2026-09-12-weavy-rnosai-integration.md](./2026-09-12-weavy-rnosai-integration.md) (Weavy UIKit Chat/Files) **ngoài scope**. Đây là Figma Weave (Weavy bị Figma mua, console [app.weavy.ai](https://app.weavy.ai/), canvas [weave.figma.com](https://weave.figma.com/)).

**SoT nhà máy đa provider:** [2026-09-13-cp-ai-ops-provider-integration-srs.md](../specs/2026-09-13-cp-ai-ops-provider-integration-srs.md) (SPEC-CP-ACO-WIN v1.1). **Plan triển khai cả nhà máy:** [2026-09-13-cp-aco-win-implementation.md](./2026-09-13-cp-aco-win-implementation.md) — Wave A = Task 3 (chạy plan này sau tab AI Ops). UI: PRJ-03 `?tab=ai-ops`. **SoT Weave Mức 2:** [2026-09-13-figma-weave-cp-integration-srs.md](../specs/2026-09-13-figma-weave-cp-integration-srs.md). Plan này là task code path/ingest Wave A (pane `weave`). Cổng GT-W **không cắt**.

**Goal:** Gắn Figma Weave vào Creative OS theo **Mức 2 — semi-automated**: Weave export → object storage quy ước → PTT ingest worker → asset CRM (checksum, thumbnail, metadata, watermark) → review & approval. User CRM chỉ bấm **Sync output**.

**Architecture:** CRM PTT là SoR. Weave không có REST API (2026-09) nên **không chạy graph từ server**. Cầu nối là **thư mục cloud + webhook trung gian** (S3/MinIO object-created, hoặc folder watcher). Worker tìm đúng `{client_code}/{campaign_code}/{task_id}/…`, ingest file mới, gắn campaign. Governance (source/drafts/review/approved/final + watermark) nằm **phía CRM**, vì Weave Import/Export + Fal/Replicate/CivitAI/LoRA là experimentation, không phải SoR.

**Tech Stack:** Nest `ptt-crm-api` module `cp` (`/api/crm/cp/weave-orders`) · ops-web Creative OS · Postgres `crm_cp_weave_*` · AI Gateway hiện có (flag `CP_AI_ENABLED`) · disk/`PTT_CMKT_S3_BUCKET` prefix · Jest · Vitest · Playwright.

## Global Constraints

- Prefix `/api/crm/cp`. Tenant `PTT`. Staff JWT + cap `crm_cp.edit` (tạo WO) / `crm_cp.view` (xem) / `crm_cp.export_final` (đưa delivery).
- Customer SoR = `clients`. Campaign SoR = `service_lifecycle` (`lifecycle_id`). Project SoR = `crm_cp_projects`. Không tạo campaign table mới.
- Client review SoR = Creative Hub `POST /projects/:id/submit-creative`. Ads launch SoR = Campaign Write.
- **Không** gọi API chạy graph Weave từ backend (Figma Weave chưa mở API integration trên mọi plan — [help.weavy.ai API Integration](https://help.weavy.ai/en/articles/12301695-api-integration), 2026-03).
- Open in Weave = deep-link `WEAVE_OPEN_BASE` + `template_key` đã map. Không embed iframe (CORS/session Figma).
- `WEAVE_API_KEY` **không tồn tại**. Env: `WEAVE_OPEN_BASE`, `WEAVE_EXPORT_PREFIX`, `PTT_WEAVE_INGEST`, `PTT_WEAVE_WEBHOOK_SECRET`.
- Flag `PTT_WEAVE=0` mặc định. AI brief chỉ chạy khi `CP_AI_ENABLED=1`; không thì stub JSON.
- **Mức 2 bắt buộc** quy ước path/filename dưới đây. File lệch convention → ingest **skip + warning**, không đoán folder.
- Chỉ folder `review/` và `final/` được đưa pipeline duyệt. `source/` `drafts/` không submit-review. `approved/` do CRM ghi sau khi duyệt — designer không drop vào đây.
- Draft/review asset nhận watermark `DRAFT` / `REVIEW` khi ingest. `final/` không watermark.
- Checksum SHA-256 là khóa idempotent: file trùng hash + cùng `task_id` không tạo asset lần 2.
- Copy UI tiếng Việt. Empty → `—`. Không mock số.
- CSS class `cp-weave-*`. Không đụng CSD Chat.

---

## Luồng vận hành (8 bước → hệ thống)

```
Account          AI Gateway           CRM PTT              Designer              Weave
   │                  │                  │                     │                   │
   │ tạo campaign +   │                  │                     │                   │
   │ creative task    │                  │                     │                   │
   │─────────────────►│                  │                     │                   │
   │                  │ brief, prompt,   │                     │                   │
   │                  │ negative, shots, │                     │                   │
   │                  │ output format    │                     │                   │
   │                  │─────────────────►│ Work Order          │                   │
   │                  │                  │ status=brief_ready  │                   │
   │                  │                  │── Open in Weave ───►│  mở flow template │
   │                  │                  │                     │ import ref        │
   │                  │                  │                     │ chạy / tinh chỉnh │
   │                  │                  │                     │ export → prefix   │
   │                  │                  │◄── upload / link ───│                   │
   │                  │                  │ ingest → asset      │                   │
   │                  │                  │ review → approve    │                   │
   │                  │                  │ → delivery          │                   │
```

| Bước user | Hệ thống làm gì |
|-----------|-----------------|
| 1. Account tạo campaign + creative task | `service_lifecycle` + `crm_cp_projects` + deliverable/task CP đã có |
| 2. Claude/AI Gateway tạo brief | `POST .../weave-orders/:id/generate-brief` → `brief_json` (prompt, negative_prompt, shot_list, output_format) |
| 3. CRM tạo Weave Work Order | `POST /api/crm/cp/weave-orders` gắn `project_id`, `lifecycle_id`, `template_key` |
| 4. Open in Weave | Nút mở `{WEAVE_OPEN_BASE}` + query `wo`, `template`; status → `opened` |
| 5. Designer làm việc trong Weave | Ngoài CRM. WO giữ `opened` / `in_weave` |
| 6. Export asset | Designer Export Node → drop đúng `{client}/{campaign}/{task_id}/{lane}/` |
| 7. **Sync output** (hoặc webhook object-created) | Worker ingest + checksum + thumb + probe → `crm_cp_assets` |
| 8. Review → approval → delivery | Chỉ asset `review`/`final`; Hub + Campaign Write |

---

## Giới hạn Figma Weave (khóa thiết kế)

| Có thể (phase 1) | Không làm (chờ API) |
|------------------|---------------------|
| Deep-link mở canvas / flow đã publish | `POST` chạy workflow từ CRM |
| Copy brief/prompt vào clipboard trước khi mở | Đẩy prompt vào node Weave tự động |
| Prefix S3/disk + webhook object-created | Webhook **native** từ Weave |
| MCP Figma (P2, chạy tool đã có) | Tạo/sửa graph Weave từ CRM |
| Import Node (ảnh/video/audio/3D) trong Weave | Coi LoRA/Fal/Replicate/CivitAI là SoR |

`WEAVE_OPEN_BASE` mặc định `https://app.weavy.ai/`. Canvas: `https://weave.figma.com/`. Map `template_key` → URL flow trong settings.

---

## Mức 2 — Semi-automated (khóa)

```
Weave Export Node
    ↓  (designer / Dropbox-S3 sync / rclone)
{WEAVE_EXPORT_PREFIX}/{client_code}/{campaign_code}/{task_id}/{lane}/
    ↓  Sync output  hoặc  webhook S3 ObjectCreated
PTT Asset Ingestion Worker
    ↓
crm_cp_assets + crm_cp_weave_assets
    ↓
thumbnail · SHA-256 · duration/resolution · watermark (nếu drafts/review)
    ↓
Review & approval (CRM)
```

### Quy ước thư mục

```
{WEAVE_EXPORT_PREFIX}/
  {client_code}/
    {campaign_code}/
      {task_id}/
        source/      # ref, LoRA, import Fal/Replicate — không review
        drafts/      # thử nghiệm Weave — watermark DRAFT
        review/      # nộp duyệt nội bộ — watermark REVIEW
        approved/    # CRM ghi sau approve — designer không ghi
        final/       # bàn giao — không watermark
```

Ví dụ:

```
nova/mid-autumn-2026/CR-2026-0912-028/final/
  CR-2026-0912-028_v01_9x16.mp4
  CR-2026-0912-028_v01_1x1.jpg
```

| Segment | Nguồn | Rule |
|---------|--------|------|
| `client_code` | `clients` slug/code (lowercase `[a-z0-9-]`) | Bắt buộc |
| `campaign_code` | `service_lifecycle` / campaign slug | Bắt buộc |
| `task_id` | Work Order code `CR-YYYY-MMDD-NNN` (= PK nghiệp vụ, không phải UUID thuần) | Khóa tìm folder khi Sync |
| `lane` | một trong 5 tên trên | Khác → skip |
| filename | `{task_id}_v{nn}_{ratio}.{ext}` | `v` = version 2 chữ số; `ratio` ∈ `1x1` `9x16` `16x9` `4x5` `og` |

`task_id` sinh khi tạo WO (sequence ngày). UUID vẫn là PK DB; path luôn dùng `task_id` đọc được.

### Governance (vì Weave là experimentation)

- Import Node + model Fal/Replicate/CivitAI + LoRA → chỉ được đặt `source/`. Metadata bắt buộc: `origin=weave_import`, `provider` nếu biết.
- `drafts/` không vào Hub. `review/` mới submit. `final/` mới `deliver`.
- CRM **không** tin tên file Weave; parse convention, fail-closed.
- Sidecar optional `{filename}.json`: `{ prompt, negative_prompt, model, seed }` — nếu có, gắn `brief_json` / asset metadata; thiếu sidecar không chặn ingest.

### Webhook trung gian (không phải Weave)

1. **S3/MinIO:** `ObjectCreated` → `POST /api/crm/cp/weave-ingest/hook` (HMAC `PTT_WEAVE_WEBHOOK_SECRET`) body `{ key }`.
2. **Folder watcher:** cron 60s list prefix (flag `PTT_WEAVE_INGEST=1`).
3. Cả hai đều gọi cùng `ingestKey(storageKey)` — idempotent theo checksum.

Nút CRM **Sync output** = `POST /weave-orders/:id/sync-output` → resolve path từ `client_code`+`campaign_code`+`task_id` → ingest lane `review`+`final` (và `drafts` chỉ để catalog, `include_drafts=false` mặc định).

---

## File map

| File | Việc |
|------|------|
| `docs/specs/2026-09-12-postgresql-ddl-cp-weave.sql` | `crm_cp_weave_templates`, `crm_cp_weave_work_orders`, `crm_cp_weave_assets` |
| `services/ptt-crm-api/src/cp/cp-weave.types.ts` | Status, brief DTO, template |
| `services/ptt-crm-api/src/cp/cp-weave-brief.util.ts` | Validate/normalize AI brief |
| `services/ptt-crm-api/src/cp/cp-weave-open.util.ts` | Build Open-in-Weave URL |
| `services/ptt-crm-api/src/cp/cp-weave-path.util.ts` | Parse/build `{client}/{campaign}/{task}/{lane}` + filename |
| `services/ptt-crm-api/src/cp/cp-weave.repository.ts` | CRUD WO + ingest |
| `services/ptt-crm-api/src/cp/cp-weave.service.ts` | Rules 8 bước + Sync output |
| `services/ptt-crm-api/src/cp/cp-weave-ingest.worker.ts` | Scan prefix + webhook ObjectCreated |
| `services/ptt-crm-api/src/cp/cp.controller.ts` | Routes `/weave-orders` |
| `services/ops-web/src/lib/crm/cp-weave-api.ts` | Client |
| `services/ops-web/src/components/crm/cp/CpWeaveWorkOrder.tsx` | Panel WO + Open in Weave + ingest |
| `services/ops-web/src/app/crm/creative-os/projects/[id]/page.tsx` | Tab **AI Ops** (`pane=weave`) |
| `scripts/apply_pg_ddl_cp_weave.sh` | Apply DDL |

---

### Task 1: DDL + status machine + Open URL (pure)

**Files:**
- Create: `docs/specs/2026-09-12-postgresql-ddl-cp-weave.sql`
- Create: `services/ptt-crm-api/src/cp/cp-weave.types.ts`
- Create: `services/ptt-crm-api/src/cp/cp-weave-brief.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-weave-open.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-weave-path.util.ts`
- Test: `services/ptt-crm-api/src/cp/cp-weave-brief.util.spec.ts`
- Test: `services/ptt-crm-api/src/cp/cp-weave-open.util.spec.ts`
- Test: `services/ptt-crm-api/src/cp/cp-weave-path.util.spec.ts`

**Interfaces:**

```ts
export const CP_WEAVE_STATUSES = [
  'draft',
  'brief_ready',
  'opened',
  'in_weave',
  'assets_exported',
  'linked',
  'in_review',
  'approved',
  'delivered',
  'cancelled',
] as const;
export type CpWeaveStatus = (typeof CP_WEAVE_STATUSES)[number];

export type CpWeaveBrief = {
  creative_brief: string;
  prompt: string;
  negative_prompt: string;
  shot_list: string[];
  output_format: { kind: 'image' | 'video' | 'carousel'; width: number; height: number; notes?: string };
};

export function canTransitionWeave(from: CpWeaveStatus, to: CpWeaveStatus): boolean;
export function buildWeaveOpenUrl(input: {
  base: string;
  templateUrl: string | null;
  workOrderId: string;
  projectId: string;
}): { href: string; copied_brief: boolean };
export function normalizeWeaveBrief(raw: unknown): CpWeaveBrief;

export type CpWeaveLane = 'source' | 'drafts' | 'review' | 'approved' | 'final';
export function buildWeaveExportRelPath(input: {
  clientCode: string;
  campaignCode: string;
  taskId: string;
  lane: CpWeaveLane;
}): string;
export function parseWeaveExportKey(key: string): {
  clientCode: string;
  campaignCode: string;
  taskId: string;
  lane: CpWeaveLane;
  fileName: string;
} | null;
export function parseWeaveFileName(fileName: string): {
  taskId: string;
  version: number;
  ratio: string;
  ext: string;
} | null;
export function nextWeaveTaskId(ymd: string, seq: number): string; // CR-2026-0912-028
```

Path tests bắt buộc:

```ts
expect(parseWeaveExportKey(
  'nova/mid-autumn-2026/CR-2026-0912-028/final/CR-2026-0912-028_v01_9x16.mp4',
)).toEqual({
  clientCode: 'nova',
  campaignCode: 'mid-autumn-2026',
  taskId: 'CR-2026-0912-028',
  lane: 'final',
  fileName: 'CR-2026-0912-028_v01_9x16.mp4',
});
expect(parseWeaveFileName('CR-2026-0912-028_v01_1x1.jpg')?.ratio).toBe('1x1');
expect(parseWeaveExportKey('nova/mid-autumn-2026/CR-2026-0912-028/tmp/x.png')).toBeNull();
expect(nextWeaveTaskId('2026-09-12', 28)).toBe('CR-2026-0912-028');
```

**DDL (rút gọn):**

```sql
CREATE TABLE IF NOT EXISTS crm_cp_weave_templates (
  template_key TEXT PRIMARY KEY,
  name_vi TEXT NOT NULL,
  weave_flow_url TEXT NOT NULL,
  output_kind TEXT NOT NULL CHECK (output_kind IN ('image', 'video', 'carousel')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS crm_cp_weave_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  lifecycle_id TEXT,
  agency_client_id UUID NOT NULL REFERENCES clients(id),
  deliverable_id UUID,
  template_key TEXT NOT NULL REFERENCES crm_cp_weave_templates(template_key),
  status TEXT NOT NULL DEFAULT 'draft',
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  export_prefix TEXT,
  opened_at TIMESTAMPTZ,
  opened_by_staff_id INT,
  created_by_staff_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_weave_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES crm_cp_weave_work_orders(id),
  asset_id UUID,
  storage_uri TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'prefix_sync', 'link')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 1: Write failing tests** — `normalizeWeaveBrief` thiếu `prompt` → throw; `buildWeaveOpenUrl` gắn `wo` + không dùng `app.weavy.ai` làm API; `canTransitionWeave('draft','brief_ready')` true, `'draft'→'approved'` false
- [ ] **Step 2: Run** `npx jest --testPathPattern='cp-weave-' --no-coverage` → FAIL
- [ ] **Step 3: Implement utils + DDL + apply script**
- [ ] **Step 4: Tests PASS**
- [ ] **Step 5: Commit** `feat(cp): Weave work-order types, brief, and open URL.`

---

### Task 2: Work Order API + generate-brief

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-weave.repository.ts`
- Create: `services/ptt-crm-api/src/cp/cp-weave.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-weave.service.spec.ts`
- Modify: `services/ptt-crm-api/src/cp/cp.controller.ts`
- Modify: `services/ptt-crm-api/src/cp/cp.module.ts`

**Routes:**

| Method | Path | Cap | Việc |
|--------|------|-----|------|
| `POST` | `/weave-orders` | edit | Tạo WO từ project + template_key |
| `GET` | `/weave-orders?project_id=` | view | List |
| `GET` | `/weave-orders/:id` | view | Chi tiết + brief + assets |
| `POST` | `/weave-orders/:id/generate-brief` | edit | AI Gateway hoặc stub |
| `POST` | `/weave-orders/:id/open` | edit | Ghi `opened`, trả `{ href }` |
| `POST` | `/weave-orders/:id/assets` | edit | Upload/link tay (fallback) |
| `POST` | `/weave-orders/:id/sync-output` | edit | **Sync output** — quét folder theo `task_id` |
| `POST` | `/weave-ingest/hook` | HMAC | Webhook S3/MinIO ObjectCreated |
| `POST` | `/weave-orders/:id/submit-review` | edit | → CP/Hub review |
| `POST` | `/weave-orders/:id/deliver` | export_final | Handoff Campaign Write / publish |

**Generate-brief (AI Gateway):**

Khi `CP_AI_ENABLED=1`, gọi adapter text đã có (cùng pattern Video SOP / CP stub):

```ts
{
  system: 'PTT Creative Weave brief. Output JSON only.',
  user: { project, client, campaign: lifecycle, template_key, existing_brief }
}
```

JSON bắt buộc: `creative_brief`, `prompt`, `negative_prompt`, `shot_list[]`, `output_format`. Validate bằng `normalizeWeaveBrief`. Status `draft` → `brief_ready`. Khi AI off: trả stub + `ai_stub: true`.

- [ ] **Step 1: Service spec** — create requires project+template; generate-brief transitions; open returns href; illegal transition 409
- [ ] **Step 2: FAIL then implement**
- [ ] **Step 3: Jest PASS**
- [ ] **Step 4: Commit** `feat(cp): Weave work-order API and AI brief generation.`

---

### Task 3: Sync output — ingest worker + webhook + governance

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-weave-ingest.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-weave-ingest.worker.ts`
- Modify: `cp-weave.service.ts` — `syncOutput(workOrderId)`, `ingestKey(storageKey)`
- Modify: `cp.controller.ts` — `POST /weave-orders/:id/sync-output`, `POST /weave-ingest/hook`
- Test: `cp-weave-ingest.util.spec.ts`
- Test: `cp-weave.service.spec.ts` (idempotent checksum)

**Interfaces:**

```ts
export type CpWeaveIngestResult = {
  scanned: number;
  ingested: number;
  skipped: number;
  warnings: string[];
  assets: Array<{ id: string; lane: CpWeaveLane; checksum: string }>;
};

async syncOutput(workOrderId: string, opts?: { include_drafts?: boolean }): Promise<CpWeaveIngestResult>;
async ingestKey(storageKey: string): Promise<'ingested' | 'duplicate' | 'skipped'>;
```

**Khi Sync output:**

1. Load WO → `task_id`, `client_code`, `campaign_code`.
2. Prefix = `{client}/{campaign}/{task_id}/`.
3. List object/file dưới prefix. Parse key; skip nếu `parseWeaveExportKey` = null (ghi `warnings`).
4. Lane mặc định ingest: `review`, `final`. `source` catalog-only (gắn metadata, không review). `drafts` chỉ khi `include_drafts`. `approved` bỏ qua (CRM-owned).
5. Với mỗi file mới: SHA-256; nếu `(task_id, checksum)` đã có → `duplicate`.
6. Copy vào asset store CP. Probe: MIME, bytes, `width`/`height` (image), `duration_ms` (video, ffprobe nếu có — thiếu thì `null`, không `0`).
7. Thumbnail 320px JPEG. Watermark chữ `DRAFT` / `REVIEW` theo lane.
8. Insert `crm_cp_weave_assets` + `crm_cp_assets`. Status WO: có `final`/`review` mới → `assets_exported` rồi `linked`.
9. Sidecar `.json` cùng stem → merge metadata; không chặn nếu thiếu.

**Webhook:** `POST /weave-ingest/hook` header `X-PTT-Weave-Sign`. Body `{ key: "nova/.../final/....mp4" }`. Verify HMAC. Gọi `ingestKey`. 401 nếu sai secret.

**DDL bổ sung** (Task 1): `crm_cp_weave_work_orders.task_id TEXT UNIQUE`, `client_code`, `campaign_code`, `export_prefix`; `crm_cp_weave_assets.checksum`, `lane`, `width`, `height`, `duration_ms`, `watermark`.

- [ ] **Step 1: Tests** — parse example path; skip `tmp/`; duplicate checksum; hook reject bad HMAC
- [ ] **Step 2: FAIL then implement worker + sync-output + hook**
- [ ] **Step 3: Jest PASS**
- [ ] **Step 4: Commit** `feat(cp): Weave Sync output ingest with path convention and checksum.`

---

### Task 4: UI Creative OS — tab AI Ops / pane Weave + Open in Weave

**Files:**
- Create: `services/ops-web/src/lib/crm/cp-weave-api.ts`
- Create: `services/ops-web/src/components/crm/cp/CpWeaveWorkOrder.tsx`
- Modify: `services/ops-web/src/app/crm/creative-os/projects/[id]/page.tsx` — tab **AI Ops** (`tab=ai-ops&pane=weave`)
- Modify: `services/ops-web/src/app/crm/creative-os/cp.css` (hoặc `cp.css`) — `.cp-weave-*`
- Test: `services/ops-web/src/lib/crm/cp-weave-open.spec.ts`
- E2E: `services/ops-web/e2e/cp-weave.spec.ts` (mock API)

**UI panel (tiếng Việt):**

1. Chọn template (Feed 1:1, Reel 9:16, Banner…)
2. **Tạo Work Order**
3. **Sinh brief AI** → hiện brief / prompt / negative / shot list / format (sửa tay được)
4. **Sao chép prompt** + **Open in Weave** (`target=_blank`, `rel=noopener`)
5. Checklist: import reference → chạy flow → export vào prefix đã hiện trên màn
6. Hiện path export: `{client}/{campaign}/{task_id}/final/`
7. **Sync output** (primary). Fallback: tải lên / dán link
8. **Gửi review** (chỉ lane `review`/`final`) → **Đưa delivery**

`Open in Weave` gọi `POST /open` rồi `window.open(href)`. Không nhúng web component chat.

- [ ] **Step 1: Vitest buildOpenHref**
- [ ] **Step 2: Panel + tab**
- [ ] **Step 3: Playwright** — tạo WO, thấy nút Open in Weave, mock generate-brief
- [ ] **Step 4: Commit** `feat(cp): Weave work-order panel on Creative OS project.`

---

### Task 5: Review → approval → delivery (nối SoR sẵn)

**Files:**
- Modify: `cp-weave.service.ts` `submitReview` / `deliver`
- Modify: `CpProjectsService` / `CreativesService` (đã có `submit-creative`)
- Test: `cp-weave.service.spec.ts` thêm case

**Rules:**

- `submit-review`: WO phải `linked` + ≥1 asset lane `review` hoặc `final`. Asset `source`/`drafts` không đủ. Gọi Hub. Status → `in_review`.
- Sau approve: worker/CRM **ghi copy** (hoặc pointer) sang `{prefix}/.../approved/` — designer không drop lane này.
- Approve đi theo CP/Hub hiện có (`internal_review` → `final_approved`). Hook: khi deliverable `final` và có WO mở → WO `approved`.
- `deliver`: cap `crm_cp.export_final` + không QC blocked. Handoff Campaign Write (file + UTM) **hoặc** CP Publish video-only. Status → `delivered`.
- Không tự launch Ads.

- [ ] **Step 1: Tests 409 khi chưa có asset; deliver bị QC block**
- [ ] **Step 2: Implement hooks**
- [ ] **Step 3: Commit** `feat(cp): Weave work-order review and delivery handoff.`

---

### Task 6: Vận hành tay (trước khi bật `PTT_WEAVE=1`)

1. Đăng nhập [app.weavy.ai](https://app.weavy.ai/) (hoặc [weave.figma.com](https://weave.figma.com/)).
2. Tạo **3 flow template** PTT: `feed-1x1`, `reel-9x16`, `banner-wide`. Publish / copy URL từng flow.
3. Seed `crm_cp_weave_templates` (`template_key` → `weave_flow_url`).
4. Env:
   ```
   PTT_WEAVE=1
   WEAVE_OPEN_BASE=https://app.weavy.ai/
   WEAVE_EXPORT_PREFIX=/var/www/rnosai/data/cp-weave-export
   PTT_WEAVE_INGEST=1
   PTT_WEAVE_WEBHOOK_SECRET=
   CP_AI_ENABLED=0
   ```
5. Tạo bucket/folder `.../{client_code}/{campaign_code}/{task_id}/{lane}/`. Designer ghi `source|drafts|review|final`. CRM ghi `approved`.
6. UAT: WO `CR-2026-0912-028` → drop `.../nova/mid-autumn-2026/CR-2026-0912-028/final/CR-2026-0912-028_v01_9x16.mp4` → **Sync output** → thấy duration/ratio/checksum → gửi review.
7. (Tuỳ chọn) Bật S3 notify → hook. Khi Figma có REST native: thêm adapter — **không** đổi convention path hay state machine.

---

## Seed templates (chạy Task 1)

| `template_key` | `name_vi` | `output_kind` |
|----------------|-----------|---------------|
| `feed-1x1` | Feed vuông 1080 | image |
| `reel-9x16` | Reel / Shorts | video |
| `banner-wide` | Banner ngang | image |

---

## Phase

| Phase | Task | Xong khi |
|-------|------|----------|
| W0 | 1 | Brief + URL + DDL |
| W1 | 2 | API WO + AI/stub brief |
| W2 | 3 | Sync output + convention + checksum + hook |
| W3 | 4 | Tab AI Ops / pane Weave trên project |
| W4 | 5 | Review → delivery |
| W5 | 6 | UAT + flag VPS |

## Ngoài scope

- Weavy UIKit Chat / Files / token user
- Tự chạy graph Weave từ server
- Thay Video SOP human shoot
- Portal designer riêng (dùng ops-web + Weave)

## Self-review

- 8 bước user → Task 2–5 + bảng luồng.
- Auth Weave: không API key; Open URL + session Figma của designer.
- Embed: không web component chat; nút deep-link.
- Sync user: không cần directory Weavy chat. Designer = `crm_staff` đã login CRM.
- Mức 2 path/filename + Sync output + HMAC hook + watermark/governance: Task 1 (`cp-weave-path`) + Task 3.
- Weave Import/LoRA/Fal không vào review — lane `source` only.
