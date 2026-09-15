# Raw Lead Harvest — All Market (Intent E → Market Graph D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm mode **Intent (Wave E)** lấy white-space thị trường từ Google Places + lọc CRM/intent, rồi **Market Graph (Wave D)** census + diff — để AM phủ spa/massage HCM thật sự thay vì LLM liệt kê vài brand lớn.

**Architecture:** Tách Places client + Intent/MarketGraph workers khỏi LLM `HarvestWorkerService`. Reuse scrape/verify/gate/persist lead thô. Feature flags `PTT_RESEARCH_HARVEST_INTENT` / `PTT_RESEARCH_HARVEST_MARKET_GRAPH`.

**Tech Stack:** NestJS `ptt-crm-api`, PostgreSQL, Next.js ops-web, Google Places API, Jest.

**Design:** `docs/superpowers/specs/2026-09-15-raw-lead-harvest-all-market-design.md`

## Global Constraints

- North star: lead thật contactable; không dump 1000 dòng không gọi được
- Intent/Market Graph **không** dùng LLM Discover để liệt kê thị trường
- Chỉ Google Places API chính thức — không scrape HTML Google Maps
- Một project tối đa 1 harvest job `running` (giữ rule hiện có)
- Intent bắt buộc `province_code` cụ thể (≠ `all`)
- `scan_cap` / `max_places_requests_per_job` bắt buộc để chặn bill
- Reuse: `scrape-contact.util.ts`, `verify-contact.util.ts`, `quality-gate.util.ts`, `fetchEvidenceText`
- Flags: `PTT_RESEARCH_RAW_LEAD_HARVEST=1` + Intent/Graph flags
- TDD pure utils trước; commit khi user yêu cầu

## Wave map

| Wave | Ship | Tasks |
|------|------|-------|
| E0–E1 | Places client + mode `intent` E2E | 1–5 |
| E1.1 | FE mode + stats + deploy script flags | 6 |
| D1–D2 | Census + diff + summary API/UI | 7–9 |
| D3 | Optional cron — chỉ khi D2 UAT OK | 10 (optional) |

## File map

| File | Responsibility |
|------|----------------|
| `…/places/places.types.ts` | PlaceCandidate types |
| `…/places/places.client.ts` | Google Places Text Search + details |
| `…/places/places.client.spec.ts` | Mock HTTP / parse tests |
| `…/intent/intent-score.util.ts` | White-space helpers + intent score |
| `…/intent/intent-score.util.spec.ts` | Unit tests |
| `…/intent/intent-harvest.worker.ts` | Wave E worker |
| `…/market-graph/market-entities.repository.ts` | Census DDL + upsert/diff |
| `…/market-graph/market-graph.worker.ts` | Wave D worker |
| `…/quality/quality-gate.util.ts` | Gate mode `intent` (= marketing rules) |
| `…/raw-lead-harvest.types.ts` | Mode union + stats fields |
| `…/raw-lead-harvest.validation.ts` | Validate intent province + caps |
| `…/raw-lead-harvest.service.ts` | Route worker by mode |
| `…/raw-lead-harvest.repository.ts` | mode mapping, place_id, stats_json |
| `RawLeadHarvestPanel.tsx` | Mode options + progress |
| `scripts/deploy_raw_lead_harvest_vps.sh` | Ensure new flags |

---

### Task 1: Types + validation — mode `intent`

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.types.ts`
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.validation.ts`
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.validation.spec.ts`
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-gate.util.ts`
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-gate.util.spec.ts`

**Interfaces:**
- Produces: `RawLeadHarvestMode = 'quality' | 'volume' | 'marketing' | 'intent'`
- Produces: `normalizeHarvestMode` returns `'intent'` when raw === `'intent'`
- Produces: `applyQualityGate('intent', …)` delegates to marketing rules

- [ ] **Step 1: Failing tests**

```typescript
expect(normalizeHarvestMode('intent')).toBe('intent');
expect(
  validateCreateRawLeadHarvest({
    ...base,
    mode: 'intent',
    province_code: 'all',
    target_count: 50,
  })?.error,
).toBe('intent_province_required');
expect(
  validateCreateRawLeadHarvest({
    ...base,
    mode: 'intent',
    province_code: '79',
    target_count: 50,
  }),
).toBeNull();
expect(
  applyQualityGate('intent', 40, v({ phone_ok: true, email_ok: false })),
).toBe('pending');
```

- [ ] **Step 2: Run**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='raw-lead-harvest.validation|quality-gate.util' --no-coverage
```

Expected: FAIL (mode unknown / no intent_province rule)

- [ ] **Step 3: Implement**

In `normalizeHarvestMode`: `if (raw === 'intent') return 'intent';`  
In `validateCreateRawLeadHarvest`: after count check, if mode intent and (!province_code \|\| province_code === 'all') return `{ error: 'intent_province_required' }`.  
For intent, allow missing `provider`/`model` AI **or** keep required but unused — **decision E1:** provider/model optional when mode intent (pass empty placeholders in FE). Prefer:

```typescript
const mode = normalizeHarvestMode(body.mode);
if (mode !== 'intent') {
  if (!String(body.provider ?? '').trim()) return { error: 'provider_required' };
  if (!String(body.model ?? '').trim()) return { error: 'model_required' };
} else {
  // Places-backed; AI provider not required
}
```

Update create body type: `provider?: string; model?: string`.  
Gate: `if (mode === 'intent') { /* same block as marketing */ }`.

- [ ] **Step 4: Re-run tests — PASS**

- [ ] **Step 5: Commit** (when user asks)

```bash
git add services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.types.ts \
  services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.validation.ts \
  services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.validation.spec.ts \
  services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-gate.util.ts \
  services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-gate.util.spec.ts
git commit -m "feat(research): add intent harvest mode validation and gate."
```

---

### Task 2: Intent score + chain denylist utils

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/intent/intent-score.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/intent/intent-score.util.spec.ts`

**Interfaces:**
- Produces:
  - `isChainDenylistName(name: string, extra?: string[]): boolean`
  - `computeIntentScore(input: IntentScoreInput): number`
  - `IntentScoreInput = { company_name, has_places_phone, has_website, website_fetch_ok, scraped_contact, ratings_total?: number | null }`

- [ ] **Step 1: Failing test**

```typescript
import { computeIntentScore, isChainDenylistName } from './intent-score.util';

expect(isChainDenylistName('Hasaki Clinic')).toBe(true);
expect(isChainDenylistName('Spa Hoa Mi Quan 3')).toBe(false);
expect(
  computeIntentScore({
    company_name: 'Spa Hoa Mi',
    has_places_phone: true,
    has_website: false,
    website_fetch_ok: false,
    scraped_contact: false,
    ratings_total: 5,
  }),
).toBeGreaterThanOrEqual(40);
expect(
  computeIntentScore({
    company_name: 'Benh vien tham my Kangnam',
    has_places_phone: true,
    has_website: true,
    website_fetch_ok: true,
    scraped_contact: true,
    ratings_total: 5000,
  }),
).toBeLessThan(40);
```

- [ ] **Step 2: Run — FAIL**

```bash
npx jest --testPathPattern='intent-score.util' --no-coverage
```

- [ ] **Step 3: Implement** per design §7 (weights + denylist seed: hasaki, kangnam, gangwhoo, diva, seoulspa, ngoc dung, thu cuc, … normalize NFD lower).

- [ ] **Step 4: PASS + commit when asked**

---

### Task 3: Google Places client

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/places/places.types.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/places/places.client.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/places/places.client.spec.ts`
- Modify: `services/ptt-crm-api/src/config/app-config.service.ts` — `googlePlacesApiKey`, `researchHarvestIntentEnabled`

**Interfaces:**
- Produces:
```typescript
export type PlaceCandidate = {
  place_id: string;
  company_name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  types: string[];
  maps_url: string | null;
};

export class PlacesClient {
  constructor(private readonly apiKey: string) {}
  async textSearch(query: string, opts: { pageToken?: string; language?: string }): Promise<{
    results: PlaceCandidate[];
    nextPageToken: string | null;
    rawStatus: string;
  }>
}
```

- Prefer **Places API (New)** `places:searchText` if key supports; else legacy `textsearch/json`. Implement **one** path; document in client header comment.
- Env: `PTT_GOOGLE_PLACES_API_KEY`.

- [ ] **Step 1: Spec with mocked `fetch`** — parses one place into `PlaceCandidate`; empty key throws `places_not_configured`.

- [ ] **Step 2: Implement client + AppConfig getters**

```typescript
// app-config
this.googlePlacesApiKey = (process.env.PTT_GOOGLE_PLACES_API_KEY ?? '').trim();
this.researchHarvestIntentEnabled = ['1','true','yes','on'].includes(
  (process.env.PTT_RESEARCH_HARVEST_INTENT ?? '').toLowerCase(),
);
```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit when asked**

---

### Task 4: DDL + repo fields for intent jobs/leads

**Files:**
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.repository.ts` (`ensureSchema` + `createJob` + `insertLead` + job row mapping)

**Interfaces:**
- Job columns: `scan_cap INT NULL`, `stats_json JSONB NULL`
- Lead columns: `place_id TEXT NULL`, `intent_score INT NULL`
- `mapJob` mode branch includes `intent`
- `createJob` accepts `scan_cap?: number`

- [ ] **Step 1: Extend `ensureSchema` ALTER/ADD** idempotent like existing harvest DDL.

- [ ] **Step 2: Unit/repo smoke** — if no DB in CI, at least mapping unit for mode `intent` in a small pure mapper test OR extend existing repository spec mocks.

- [ ] **Step 3: Commit when asked**

---

### Task 5: IntentHarvestWorker + service routing

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/intent/intent-harvest.worker.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/intent/intent-harvest.worker.spec.ts` (mock PlacesClient + repo)
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.service.ts`
- Modify: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.module.ts`

**Interfaces:**
- Produces: `IntentHarvestWorker.run(job): Promise<{ inserted: number; rejected: number; stats: IntentJobStats }>`
- Consumes: `PlacesClient`, `RawLeadHarvestRepository`, scrape/verify/gate utils
- Service: if `job.mode === 'intent'` → intent worker; else existing LLM worker
- Flag off → createJob throws/returns `intent_disabled`

**Worker algorithm:**

1. `scan_cap = job.scan_cap ?? Math.max(job.target_count * 5, 200)`
2. Query = `` `${job.industry_label} ${job.province_name}` `` (+ ward if set)
3. Loop textSearch pages until no token or `discovered >= scan_cap` or requests >= `max_places_requests_per_job` (default 20)
4. For each place: skip denylist if score would fail; white-space checks via repo helpers
5. Build evidence_url = website \|\| maps_url
6. fetchEvidenceBundle + scrape + verify (copy pattern from harvest-worker)
7. `computeIntentScore`; if &lt; 40 skip (count `filtered_intent`)
8. `applyQualityGate('intent', score, verified)`; insert until `inserted >= target_count`
9. Update job `stats_json`, result_count, rejected_by_gate_count

- [ ] **Step 1: Worker spec** with fake Places returning 3 candidates (1 chain, 1 CRM dup, 1 good) → expect 1 insert path called.

- [ ] **Step 2: Implement worker + wire module/service**

- [ ] **Step 3: PASS tests**

```bash
npx jest --testPathPattern='intent-harvest|intent-score|places.client' --no-coverage
```

- [ ] **Step 4: Commit when asked**

---

### Task 6: FE mode Intent + deploy flags

**Files:**
- Modify: `services/ops-web/src/components/research/RawLeadHarvestPanel.tsx`
- Modify: `services/ops-web/src/lib/market-research-api.ts` (types mode)
- Modify: `scripts/deploy_raw_lead_harvest_vps.sh` — `ensure_runtime_flag PTT_RESEARCH_HARVEST_INTENT 0` (default off; set 1 on VPS when ready)

**UI:**

- Option `intent`: 「Intent — white space (Places + lọc CRM)」
- When intent: hide AI provider/model **or** show note “Dùng Google Places — không cần model AI”; require province ≠ Tất cả
- Show job stats if present: discovered / whitespace / pending

- [ ] **Step 1: Wire select + validation client-side** (province required)

- [ ] **Step 2: Manual check Story/local** — form submits `mode: 'intent'`

- [ ] **Step 3: Commit + deploy when user asks (`APPLY=1 ./scripts/deploy_raw_lead_harvest_vps.sh` after setting Places key on VPS)

**UAT E1 checklist:**

1. Key Places trên VPS; flag Intent=1  
2. Project research → Lead thô → Intent → ngành spa → HCM → target 50  
3. ≥ 60% pending có phone hoặc email  
4. Không thấy Hasaki/Kangnam trong pending (hoặc intent_score thấp / rejected)  
5. Push CRM 1 lead thử

---

### Task 7: Market entities DDL + repository (Wave D)

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/market-graph/market-entities.repository.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/market-graph/market-entities.repository.spec.ts`
- Modify: ensureSchema in harvest repo **or** dedicated `ensureMarketGraphSchema()` called from module onModuleInit

**DDL:** per design §9 `research_market_entities` UNIQUE `(industry_key, province_code, place_id)`.

**Interfaces:**
```typescript
upsertFromPlace(input: PlaceCandidate & { industry_key; province_code }): Promise<{ entity_id: string; change: 'new' | 'updated' | 'unchanged' }>
listSummary(industry_key: string, province_code: string): Promise<{ total: number; with_phone: number; last_seen_at: string | null }>
```

`content_hash = sha256(phone_norm|website|company_name_norm|address)`.

- [ ] **Step 1–4:** TDD upsert new → updated → unchanged; commit when asked

---

### Task 8: Mode `market_graph` worker + validation

**Files:**
- Modify: types/validation/gate — add mode `market_graph` (gate = intent/marketing)
- Create: `…/market-graph/market-graph.worker.ts`
- Modify: `raw-lead-harvest.service.ts` routing
- Flag: `PTT_RESEARCH_HARVEST_MARKET_GRAPH`

**Algorithm:**

1. Places pagination/grid until exhausted or `scan_cap` (default 2000) / request budget  
2. Upsert each place into census  
3. Only `new` \| `updated` (phone/website change) **and** white-space → verify/scrape → insert raw lead with `market_entity_id`  
4. Cap inserts by `target_count`

- [ ] **Step 1:** Validation `market_graph` requires province  
- [ ] **Step 2:** Worker spec with mock upsert changes  
- [ ] **Step 3:** Wire + tests PASS  
- [ ] **Step 4:** Commit when asked

---

### Task 9: Market Graph API summary + FE

**Files:**
- Modify: `raw-lead-harvest.controller.ts` — `GET …/market-entities/summary?industry_key=&province_code=`
- Modify: `RawLeadHarvestPanel.tsx` — mode option + cover line “Census: N DN · M có SĐT · last_seen …”

- [ ] **Step 1:** API returns summary from repo  
- [ ] **Step 2:** FE shows summary when mode market_graph selected / after job  
- [ ] **Step 3:** UAT D2 — re-run job → mostly unchanged, few new leads  
- [ ] **Step 4:** Commit + deploy when asked

---

### Task 10 (optional): Scheduled re-crawl

**Files:**
- Cron provider or reuse existing jobs table — weekly Intent/Graph for pinned `(project, industry, province)`

Only after D2 KPI met. Skip in first execution unless user explicitly requests.

---

## Self-review

1. **Spec coverage:** E list source Places, white-space, intent score, soft gate, FE, flags → Tasks 1–6. D census, diff, summary → Tasks 7–9. Optional cron → 10.  
2. **No placeholders:** Tasks include signatures, algorithms, commands.  
3. **Types:** `intent` / `market_graph` modes; `PlaceCandidate`; `IntentScoreInput`; gate parity with marketing.

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-15-raw-lead-harvest-all-market-e-then-d.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans checkpoints  

**Which approach?** Start with **Tasks 1–6 (Wave E)** before D.
