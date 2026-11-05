# Raw Lead Contact Columns + List Paging/Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Fanpage/Zalo as dedicated URL columns, expose full contact fields on Lead thô UI, and paginate/filter the list at 50 leads per page.

**Architecture:** Extend `crm_research_raw_leads` via `ensureSchema`; change `listLeads` to COUNT + LIMIT/OFFSET with filter query params; return `{ leads, page, page_size, total, total_pages }`. Ops-web panel: filter bar + split contact columns + pager. Harvest workers pass through new fields when present; no fabrication.

**Tech Stack:** NestJS `ptt-crm-api`, PostgreSQL, Jest, Next.js ops-web (`RawLeadHarvestPanel`).

**Design:** `docs/superpowers/specs/2026-09-16-raw-lead-contact-paging-design.md`

## Global Constraints

- Page size product default **50**; clamp API `page_size` to 10–100
- Pages unbounded: `total_pages = ceil(total / page_size)` (0 when total = 0)
- Zalo stored as **`zalo_url`** (URL), not phone
- Fanpage stored as **`fanpage_url`**
- Do not backfill historical rows
- Do not invent Fanpage/Zalo in harvest
- Reuse existing phone/email/website/address columns
- Commit only when user asks (steps below say “commit when asked”)

## File map

| File | Responsibility |
|------|----------------|
| `…/raw-lead-list-query.util.ts` | Pure parse/clamp page + filter opts + total_pages |
| `…/raw-lead-list-query.util.spec.ts` | Unit tests for paging math / status parse |
| `…/raw-lead-harvest.types.ts` | `fanpage_url` / `zalo_url` on row + patch; list response type |
| `…/raw-lead-harvest.repository.ts` | DDL, map/insert/patch, `listLeadsPage` |
| `…/raw-lead-harvest.service.ts` | Wire list query → repo |
| `…/raw-lead-harvest.controller.ts` | Pass new query params |
| `…/export-csv.util.ts` (+ spec) | CSV columns website/fanpage/zalo |
| `…/harvest-parse.util.ts` | Optional map fanpage/zalo from AI JSON when present |
| Intent/Market Graph workers | Pass `website` already; set fanpage/zalo only if scraped later (nullable OK) |
| `services/ops-web/src/lib/market-research-api.ts` | Client types + list params |
| `…/RawLeadHarvestPanel.tsx` | Filters, columns, pager |

---

### Task 1: Pure list-query util (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-list-query.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-list-query.util.spec.ts`

**Interfaces:**
```typescript
export type RawLeadListQuery = {
  page: number;
  page_size: number;
  status?: string[];
  job_id?: number;
  q?: string;
  has_phone?: boolean;
  has_contact?: boolean;
  include_auto_rejected: boolean;
};

export function parseRawLeadListQuery(input: Record<string, string | undefined>): RawLeadListQuery
export function totalPages(total: number, pageSize: number): number
export function offsetForPage(page: number, pageSize: number): number
```

- [ ] **Step 1: Failing tests**

```typescript
expect(totalPages(0, 50)).toBe(0);
expect(totalPages(1, 50)).toBe(1);
expect(totalPages(50, 50)).toBe(1);
expect(totalPages(51, 50)).toBe(2);
expect(offsetForPage(1, 50)).toBe(0);
expect(offsetForPage(3, 50)).toBe(100);

const q = parseRawLeadListQuery({
  page: '2',
  page_size: '50',
  status: 'pending,accepted',
  has_phone: '1',
  q: ' spa ',
  include_auto_rejected: '1',
});
expect(q.page).toBe(2);
expect(q.page_size).toBe(50);
expect(q.status).toEqual(['pending', 'accepted']);
expect(q.has_phone).toBe(true);
expect(q.q).toBe('spa');
expect(q.include_auto_rejected).toBe(true);

expect(parseRawLeadListQuery({ page_size: '999' }).page_size).toBe(100);
expect(parseRawLeadListQuery({ page: '0' }).page).toBe(1);
```

- [ ] **Step 2: Run**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='raw-lead-list-query' --no-coverage
```

Expected: FAIL (module missing)

- [ ] **Step 3: Implement util**

- Defaults: `page=1`, `page_size=50`, `include_auto_rejected=false`
- Clamp `page_size` to [10, 100]; `page` to ≥ 1
- Split status on comma; trim; drop empties
- `has_phone` / `has_contact`: true iff value in `1|true|yes`
- `q`: trim; empty → undefined
- `job_id`: finite positive int or undefined

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit when asked**

---

### Task 2: Types + DDL + map/insert/patch columns

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.types.ts`
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.repository.ts`
- Test: extend or add thin map assertions via existing export/repo patterns; optional `raw-lead-harvest.types` not unit-tested — cover via CSV + list later

**Produces:**
- `RawLeadRow.fanpage_url: string | null`
- `RawLeadRow.zalo_url: string | null`
- `PatchRawLeadBody.website?`, `fanpage_url?`, `zalo_url?`
- `insertLead` accepts `fanpage_url?`, `zalo_url?` (website already)
- `ensureSchema` adds both columns
- `mapLead` maps both
- `patchLead` UPDATE sets `website`, `fanpage_url`, `zalo_url` via COALESCE like address/phone

- [ ] **Step 1: Update types** — add fields to `RawLeadRow` and `PatchRawLeadBody`

- [ ] **Step 2: DDL in `createSchema` / alter block**

```sql
ALTER TABLE crm_research_raw_leads
  ADD COLUMN IF NOT EXISTS fanpage_url TEXT;
ALTER TABLE crm_research_raw_leads
  ADD COLUMN IF NOT EXISTS zalo_url TEXT;
```

- [ ] **Step 3: mapLead + insertLead + patchLead** wire columns (keep param order consistent; extend INSERT column list)

- [ ] **Step 4: Service `patchLead`** pass `website`, `fanpage_url`, `zalo_url` into repo patch object

- [ ] **Step 5: Commit when asked**

---

### Task 3: Repository `listLeadsPage` + service/controller

**Files:**
- Modify: `raw-lead-harvest.repository.ts` — replace or wrap `listLeads`
- Modify: `raw-lead-harvest.service.ts` — `listLeads` uses `parseRawLeadListQuery`
- Modify: `raw-lead-harvest.controller.ts` — forward query bag
- Create: `raw-lead-harvest.list-query.spec.ts` OR extend validation-style tests with mocked `query` on repo (same pattern as `market-entities.repository.spec.ts`)

**Produces:**
```typescript
async listLeadsPage(
  projectId: number,
  opts: RawLeadListQuery,
): Promise<{ leads: RawLeadRow[]; total: number }>
```

SQL filters:
- `status` array → `status = ANY($n::text[])`
- else if !include_auto_rejected → `status <> 'auto_rejected'`
- `job_id` → equality
- `q` → `(company_name ILIKE $q OR phone ILIKE $q OR email ILIKE $q OR address ILIKE $q)` with `%${q}%`
- `has_phone` → `phone_norm IS NOT NULL AND phone_norm <> ''`
- `has_contact` → phone_norm or (email is not null and trim <> '')
- `ORDER BY quality_score DESC, id DESC LIMIT $page_size OFFSET $offset`
- Separate `SELECT COUNT(*)::int` with same WHERE

Service response:
```typescript
return {
  leads,
  page: parsed.page,
  page_size: parsed.page_size,
  total,
  total_pages: totalPages(total, parsed.page_size),
};
```

- [ ] **Step 1: Repo unit test with mocked `query`** — assert COUNT + SELECT LIMIT/OFFSET params for page 2 size 50; assert has_phone clause

- [ ] **Step 2: Implement `listLeadsPage`; keep `listLeads` as thin wrapper calling page 1 size 500 for any internal callers OR update all callers to `listLeadsPage`**

Check callers: `listLeads` in service only for HTTP; export uses `listLeadsForExport`. Prefer changing HTTP path only.

- [ ] **Step 3: Wire service + controller**

- [ ] **Step 4: Run**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='raw-lead-list-query|raw-lead-harvest.list|market-entities.repository' --no-coverage
```

- [ ] **Step 5: Commit when asked**

---

### Task 4: Export CSV columns

**Files:**
- Modify: `export-csv.util.ts`
- Modify: `export-csv.util.spec.ts`
- Modify: export mapping in service/repo if row type needs website/fanpage/zalo from DB (ensure `listLeadsForExport` SELECT * already returns them after mapLead)

**Headers order:**
`company_name, address, phone, email, website, fanpage_url, zalo_url, contact_title, evidence_url, …`

- [ ] **Step 1: Failing CSV test** expects new headers and cells

- [ ] **Step 2: Implement**

- [ ] **Step 3: PASS + commit when asked**

---

### Task 5: Harvest parse optional fanpage/zalo (LLM path)

**Files:**
- Modify: `harvest-parse.util.ts` (+ spec if fields asserted)
- Modify: `harvest-worker.service.ts` `insertLead` to pass `fanpage_url` / `zalo_url` from parsed lead when keys exist

**Produces:** If AI JSON has `fanpage_url` / `zalo_url` / `fanpage` / `zalo` strings starting with http or containing `facebook.com` / `zalo.me`, normalize into columns; else null.

Intent/Market Graph: leave null unless evidence_url clearly facebook/zalo — optional helper:

```typescript
export function inferChannelUrls(input: {
  website?: string | null;
  evidence_url?: string | null;
}): { fanpage_url: string | null; zalo_url: string | null }
```

Only set when host matches; do not overwrite explicit website. YAGNI: skip infer if timeboxed — null OK per spec.

- [ ] **Step 1–3:** Parse passthrough + worker insert fields; tests for parse keys

- [ ] **Step 4: Commit when asked**

---

### Task 6: Ops-web API client + Lead thô UI

**Files:**
- Modify: `services/ops-web/src/lib/market-research-api.ts`
- Modify: `services/ops-web/src/components/research/RawLeadHarvestPanel.tsx`

**Client:**
```typescript
export type RawLead = {
  // existing…
  website: string | null;
  fanpage_url?: string | null;
  zalo_url?: string | null;
  address: string | null;
};

export function listRawLeads(
  token: string,
  projectId: number,
  params?: {
    status?: string;
    job_id?: number;
    include_auto_rejected?: boolean;
    page?: number;
    page_size?: number;
    q?: string;
    has_phone?: boolean;
    has_contact?: boolean;
  },
) {
  // returns { leads, page, page_size, total, total_pages }
}
```

**UI state:** `page`, `statusFilter`, `jobFilter`, `q`, `hasPhone`, `hasContact`  
Default status view: `include_auto_rejected=1` when statusFilter empty/all (so AM sees auto_rejected like today screenshot); when specific status selected, pass `status=` and leave include flag off.

**Reload:** `listRawLeads` with `page_size: 50` and current filters; selection only within current page.

**Table columns:** replace Liên hệ with SĐT | Email | Website | Fanpage | Zalo | Địa chỉ (links as in spec).

**Pager footer:**
```
Trang {page}/{total_pages} · {total} lead
[Prev] [Next]
```
Disable Prev when page≤1; Next when page≥total_pages or total_pages=0.

- [ ] **Step 1: Update API client types + query string**

- [ ] **Step 2: Filter bar + columns + pager in panel**

- [ ] **Step 3: Manual / typecheck**

```bash
cd services/ops-web && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40
```

- [ ] **Step 4: Commit + deploy when asked**

---

## Self-review

1. **Spec coverage:** DDL fanpage/zalo → T2. Paging 50 + filters → T1+T3. UI columns + pager → T6. CSV → T4. Harvest optional → T5. No backfill → implicit.  
2. **No placeholders:** Signatures and SQL behavior specified.  
3. **Types:** `fanpage_url` / `zalo_url` consistent across API and FE.

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-16-raw-lead-contact-paging.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans checkpoints  

**Which approach?**
