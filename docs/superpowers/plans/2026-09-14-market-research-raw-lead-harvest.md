# Market Research — AI Raw Lead Harvest (SRS v1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trong project Market Research, AM/researcher tạo job thu thập lead thô theo ngành + chức danh + địa bàn + nguồn/kênh + Provider/Model (Admin), chạy pipeline Discover→Ground→Extract→Verify→Score→Gate, duyệt accept/reject, feedback/dial_outcome, export CSV, optional push CRM — ưu tiên lead thật contactable, không ảo.

**Architecture:** Nest `market-research` thêm submodule harvest (DDL + API + async worker). Admin mở rộng lead-lookups (`industry`/`job_title`) và trang mới Research AI Providers (provider/model/credential encrypted). ops-web tab `raw_leads` trên `/crm/research/[id]`. Quality Engine là pure utils + gate trước persist. Crypto tái dụng `encryptProviderSecret` / `decryptProviderSecret` từ CP (`PTT_SECRET_ENCRYPT_KEY`).

**Tech Stack:** NestJS + PostgreSQL (`ptt-crm-api`), Next.js ops-web, Vitest/Jest, existing caps `crm_research.*` / `crm_data_config.*`, VN Geo API.

**Spec:** `docs/specs/2026-09-14-market-research-raw-lead-harvest-srs.md` (v1.5)

## Global Constraints

- North star: **ít lead thật** hơn nhiều lead ảo; mode mặc định `quality`
- Master data (industry, job_title, source, channel, provider, model, token) **chỉ từ Admin** — không hard-code dropdown
- API token: encrypt at rest; GET **không** trả plaintext; audit rotate/disable
- Mode quality: thiếu `evidence_url` hoặc không contactable → không vào `pending` (auto_rejected)
- Pass B (H3): phone/email chỉ giữ nếu **literal** trong HTML evidence
- Không scrape LinkedIn/FB Graph; không auto blast Zalo/SMS
- Feature flags: `PTT_RESEARCH_RAW_LEAD_HARVEST=1`, `NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1`
- Một project tối đa **1** harvest job `running`
- Commit chỉ khi user yêu cầu; deploy api + ops-web khi user yêu cầu
- TDD cho pure utils (verify, score, gate, parse AI JSON, literal match); API/repo theo pattern Jest hiện có

## Wave map (SRS phases)

| Wave | Phase | Tasks | Ship được gì |
|------|-------|-------|--------------|
| A | H0 | 1–2 | Admin lookups + AI providers/tokens |
| B | H1–H2 | 3–5 | DDL, API stub/mock, UI tab Lead thô |
| C | H3 | 6–8 | Real AI + Pass B + Quality Engine |
| D | H3b–H3c | 9–10 | Cross-check; MST/Places opt |
| E | H4–H5 | 11–12 | Feedback/blacklist/dial_outcome/CSV; push CRM |

**Khuyến nghị execute:** xong Wave A+B (mock) → UAT form; rồi Wave C trước khi production harvest.

## File map

| File | Responsibility |
|------|----------------|
| `services/ptt-crm-api/src/crm-config/crm-config.types.ts` | Extend `LeadLookupKind` += `industry` \| `job_title` |
| `services/ptt-crm-api/src/crm-config/crm-config.defaults.ts` | Seed industry / job_title / harvest sources |
| `services/ptt-crm-api/src/crm-config/crm-config-pg.repository.ts` | Allow kinds; seed; soft-delete rules |
| `services/ptt-crm-api/src/crm-config/crm-config.controller.ts` | Normalize kind query |
| `services/ops-web/src/app/admin/crm/lead-lookups/page.tsx` | Tabs Ngành nghề + Chức danh |
| `services/ops-web/src/lib/api.ts` | `CrmLeadLookupKind` widen |
| `services/ops-web/src/lib/admin/admin-nav.ts` | Link Research AI Providers |
| `services/ptt-crm-api/src/market-research/raw-lead-harvest/*` | New harvest module (see Task 2–3) |
| `services/ops-web/src/app/admin/crm/research-ai-providers/page.tsx` | Admin Provider/Model/Token UI |
| `services/ops-web/src/lib/market-research-api.ts` | Client harvest + admin AI providers |
| `services/ops-web/src/components/research/RawLeadHarvestPanel.tsx` | Tab UI form + table |
| `services/ops-web/src/app/crm/research/[id]/page.tsx` | Add tab `raw_leads` |
| `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/*` | Verify, score, gate, BR-Q, literal fetch |
| `docs/specs/2026-09-14-market-research-raw-lead-harvest-srs.md` | Spec (source of truth) |

---

### Task 1: Admin lead-lookups — `industry` + `job_title` (+ harvest source seeds)

**Files:**
- Modify: `services/ptt-crm-api/src/crm-config/crm-config.types.ts`
- Modify: `services/ptt-crm-api/src/crm-config/crm-config.defaults.ts`
- Modify: `services/ptt-crm-api/src/crm-config/crm-config-pg.repository.ts` (`LEAD_LOOKUP_KINDS`, seed)
- Modify: `services/ptt-crm-api/src/crm-config/crm-config.controller.ts` (kind normalize)
- Modify: `services/ptt-crm-api/src/crm-config/crm-config-pg.repository.spec.ts`
- Modify: `services/ops-web/src/lib/api.ts` (`CrmLeadLookupKind`)
- Modify: `services/ops-web/src/app/admin/crm/lead-lookups/page.tsx` (4 tabs)

**Interfaces:**
- Produces: `LeadLookupKind = 'source' | 'channel' | 'industry' | 'job_title'`
- Seed examples:
  - industry: `spa`, `bds`, `edu`, `healthcare`, `fnb`, `agency`
  - job_title: `owner`, `mkt_director`, `hr_manager`, `sales_director`
  - source (harvest-oriented, upsert if missing): `google_maps`, `company_website`, `yellow_pages`, `industry_directory`, `news`

- [ ] **Step 1: Failing test** — `createLeadLookup({ kind: 'industry', ... })` accepted; list `kind=industry` returns rows after seed

- [ ] **Step 2: Run**

```bash
cd services/ptt-crm-api && npx jest src/crm-config/crm-config-pg.repository.spec.ts --testPathPattern=lead -i
```

Expected: FAIL on unknown kind or missing industry

- [ ] **Step 3: Implement** — widen `LEAD_LOOKUP_KINDS`, controller normalize, defaults + seed in `ensureLeadLookupOptions` (or equivalent), FE tabs

```ts
// controller normalize
const ALLOWED = new Set(['source', 'channel', 'industry', 'job_title']);
const normalizedKind = kind && ALLOWED.has(kind) ? (kind as LeadLookupKind) : undefined;
```

```tsx
// lead-lookups KIND_TABS
const KIND_TABS = [
  { id: 'source', label: 'Nguồn lead' },
  { id: 'channel', label: 'Kênh lead' },
  { id: 'industry', label: 'Ngành nghề' },
  { id: 'job_title', label: 'Chức danh' },
] as const;
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit** (when user asks)

```bash
git add services/ptt-crm-api/src/crm-config services/ops-web/src/lib/api.ts \
  services/ops-web/src/app/admin/crm/lead-lookups/page.tsx
git commit -m "$(cat <<'EOF'
feat(crm): add industry and job_title lead lookup kinds for harvest.

EOF
)"
```

---

### Task 2: DDL + Admin API — AI Providers / Models / Credentials

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/ai-providers.types.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/ai-providers.repository.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/ai-providers.service.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/ai-providers.controller.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/ai-providers.service.spec.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/token-hint.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/token-hint.util.spec.ts`
- Modify: `services/ptt-crm-api/src/market-research/market-research.module.ts` (register providers)
- Reuse: `encryptProviderSecret` / `decryptProviderSecret` from `services/ptt-crm-api/src/cp/cp-magnific-oauth.util.ts`

**Interfaces:**
- Tables (ensureSchema): `crm_research_ai_providers`, `crm_research_ai_models`, `crm_research_ai_credentials` (+ optional audit) — đúng SRS §8.5
- Produces Admin routes under `/api/v1/research/admin/ai-providers` (SRS §7.1b)
- Cap: `crm_data_config.view` / `configure` (reuse StaffCrmConfig* guards or mirror)
- `tokenHint(secret: string): string` → last 4 chars prefixed `…`
- Credential DTO **never** includes `secret_cipher` or plaintext

```ts
export type ResearchAiAuthType = 'bearer_api_key' | 'header_api_key';

export type ResearchAiProviderRow = {
  id: number;
  code: string;
  display_name: string;
  base_url: string;
  auth_type: ResearchAiAuthType;
  auth_header_name: string | null;
  enabled: boolean;
  sort_order: number;
  notes: string | null;
  model_count?: number;
  has_enabled_credential?: boolean;
};

export type ResearchAiCredentialPublic = {
  id: number;
  label: string;
  token_hint: string;
  is_primary: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 1: Tests** — `tokenHint('sk-live-abcdef')` → ends with `cdef`; create credential encrypts; list omits cipher; disable hides from “configured”

- [ ] **Step 2: Run FAIL → implement ensureSchema + service + controller**

```bash
cd services/ptt-crm-api && npx jest src/market-research/raw-lead-harvest/token-hint.util.spec.ts \
  src/market-research/raw-lead-harvest/ai-providers.service.spec.ts -i
```

- [ ] **Step 3: Test connection endpoint** — `POST .../test` decrypts primary credential, POST minimal chat/completions to `base_url`, return `{ ok, latency_ms?, error? }` (timeout 15s)

- [ ] **Step 4: Hard-delete** returns `409` if `credential_id` / `provider.code` / `model_id` referenced by harvest jobs (table may not exist yet — stub check `false` until Task 3, then wire real check)

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): admin AI providers, models, and encrypted API tokens.

EOF
)"
```

---

### Task 3: Admin UI — `/admin/crm/research-ai-providers`

**Files:**
- Create: `services/ops-web/src/app/admin/crm/research-ai-providers/page.tsx`
- Create: `services/ops-web/src/lib/research-ai-providers-api.ts` (or extend `market-research-api.ts`)
- Modify: `services/ops-web/src/lib/admin/admin-nav.ts` — link under CRM data config

**Interfaces:**
- Consumes Admin APIs from Task 2
- UI 3 panes: Providers | Models (selected) | Credentials (selected)
- Token input `type=password`; never echo back; Rotate modal

- [ ] **Step 1: Wire nav** if `crm_data_config.view`

```ts
{ href: '/admin/crm/research-ai-providers', label: 'Research AI Providers' },
```

- [ ] **Step 2: Implement page** — list/create/edit/enable toggles; Test button shows ok/fail toast

- [ ] **Step 3: Manual UAT checklist** in commit body: add provider → add model default → add token → Test → disable → confirm gone from later harvest providers list

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ops-web): admin UI for research AI providers and tokens.

EOF
)"
```

---

### Task 4: Harvest DDL + job/raw-lead repository + create job API (stub worker)

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.types.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.repository.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.service.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.controller.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.validation.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.validation.spec.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/raw-lead-harvest.service.spec.ts`
- Modify: `market-research.module.ts`, feature flag guard (extend `market-research-enabled` or new `rawLeadHarvestEnabled`)
- Modify: `market-research.constants.ts` — flag helper

**Interfaces:**
- Tables: `crm_research_raw_lead_harvest_jobs`, `crm_research_raw_leads` (SRS §8.1–8.2)
- `POST /api/v1/research/projects/:id/raw-lead-harvests`
- `GET .../raw-lead-harvests`, `GET .../:jobId`
- `GET /api/v1/research/raw-lead-harvest/providers` — enabled + configured only (SRS §7.1c)
- Caps: `crm_research.run` create; `crm_research.view` read
- Stub worker: set status `running` → insert 0–N **mock** rows with fake evidence → `succeeded` (flag `PTT_RESEARCH_HARVEST_MOCK=1` default until Task 6)

```ts
export type CreateRawLeadHarvestBody = {
  industry_key: string;
  job_title_key: string;
  province_code: string;
  ward_code?: string | null;
  source_keys: string[];
  channel_keys?: string[];
  provider: string;
  model: string;
  mode?: 'quality' | 'volume';
  cross_check?: boolean;
  target_count: number;
  notes?: string;
};
```

**Validation rules (pure):**
- `source_keys.length >= 1`
- quality: `target_count` 5–25; volume: 5–50
- provider/model must resolve enabled+configured
- reject if another job `running` on project

- [ ] **Step 1: Validation unit tests**

- [ ] **Step 2: Repository ensureSchema + createJob snapshots** `sources_json`, `channels_json`, labels from lookups + VN Geo

- [ ] **Step 3: Service create → queue mock run** (setImmediate/async same process OK for v1; mirror desk job pattern if `ptt_jobs` already used for research)

- [ ] **Step 4: Tests PASS**

```bash
cd services/ptt-crm-api && npx jest src/market-research/raw-lead-harvest/ --i
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): raw lead harvest jobs DDL and create API with mock worker.

EOF
)"
```

---

### Task 5: ops-web — tab Lead thô + form + bảng (mock)

**Files:**
- Create: `services/ops-web/src/components/research/RawLeadHarvestPanel.tsx`
- Create: `services/ops-web/src/components/research/RawLeadAcceptModal.tsx`
- Modify: `services/ops-web/src/lib/market-research-api.ts` — harvest client helpers
- Modify: `services/ops-web/src/app/crm/research/[id]/page.tsx` — tab + render panel
- Env: document `NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1`

**Interfaces:**
- Tab id: `raw_leads`, label: `Lead thô`
- Form fields per SRS §6.2
- Table: score, ICP, company+evidence link, phone/email verify icons, status, actions
- Default filter: hide `auto_rejected`; sort `quality_score DESC`
- Poll job every 3s while `queued|running`
- Banner: *“Đây là lead thô đã qua cửa chất lượng — vẫn cần AM xác minh trước khi hứa với khách.”*

```ts
// TABS append
{ id: 'raw_leads', label: 'Lead thô' },
```

- [ ] **Step 1: API client functions** — `fetchHarvestProviders`, `createRawLeadHarvest`, `listRawLeadHarvests`, `listRawLeads`, `patchRawLead`

- [ ] **Step 2: Panel UI** — gated by flag + `crm_research.run`

- [ ] **Step 3: Wire tab in `[id]/page.tsx`** — `{tab === 'raw_leads' ? <RawLeadHarvestPanel projectId={id} /> : ...}`

- [ ] **Step 4: Manual UAT** — create mock job → rows appear → accept checklist → status `accepted`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ops-web): research raw leads tab with harvest form and review table.

EOF
)"
```

---

### Task 6: Real AI caller (Discover / Extract / Critic) using Admin credentials

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/harvest-llm.client.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/harvest-prompt.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/harvest-parse.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/harvest-parse.util.spec.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/harvest-worker.service.ts`
- Modify: `raw-lead-harvest.service.ts` — call real worker when `PTT_RESEARCH_HARVEST_MOCK` off

**Interfaces:**
- OpenAI-compatible `POST {base_url}/chat/completions` with Bearer or custom header from provider
- Parse JSON array per SRS §9.2; drop invalid rows
- Multi-pass: A Discover → B Extract (per URL) → C Critic optional
- Snapshot `credential_id` on job; never log token

```ts
export type HarvestAiLead = {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_title: string | null;
  website: string | null;
  evidence_url: string;
  evidence_snippet: string;
  discovered_via_source_key: string | null;
  confidence: number;
  field_sources: { phone: string | null; email: string | null; address: string | null };
};
```

- [ ] **Step 1: Parse util tests** — missing evidence dropped; bad `discovered_via_source_key` nulled

- [ ] **Step 2: Implement client + prompt** (VN market; nguồn/kênh labels; cấm bịa)

- [ ] **Step 3: Worker orchestration** — replace mock when flag off

- [ ] **Step 4: Integration smoke** (local): provider Test OK → harvest 5 quality → job succeeded

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): real AI multi-pass raw lead harvest worker.

EOF
)"
```

---

### Task 7: Pass B grounded extract — fetch evidence + literal contact match

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/evidence-fetch.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/literal-contact.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/literal-contact.util.spec.ts`
- Modify: `harvest-worker.service.ts` — after AI extract, run Pass B

**Interfaces:**
- `fetchEvidenceText(url: string, opts: { timeoutMs: number }): Promise<{ ok: boolean; text: string; status?: number }>`
- `phoneAppearsInText(phone: string, text: string): boolean` — normalize `+84`↔`0`, strip spaces
- `emailAppearsInText(email: string, text: string): boolean`
- On fetch fail (quality): `contactable=false`, `verify_json.fetch=fail` → gate later

- [ ] **Step 1: Unit tests** — AI phone not in HTML → null; phone with spaces/+84 matches

- [ ] **Step 2: Implement fetch (timeout 8s, size cap, strip tags)** — no deep crawl

- [ ] **Step 3: Wire into worker before score/gate**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): grounded Pass B literal phone/email match on evidence HTML.

EOF
)"
```

---

### Task 8: Quality Engine — verify, BR-Q, score, gate, dedupe

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/verify-contact.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/verify-contact.util.spec.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/brq-patterns.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/brq-patterns.util.spec.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-score.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-score.util.spec.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-gate.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/quality-gate.util.spec.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/dedupe.util.ts`
- Modify: worker + repository insert with scores / `auto_rejected`

**Interfaces:**

```ts
export type VerifyResult = {
  evidence_ok: boolean;
  phone_ok: boolean;
  email_ok: boolean;
  geo_ok: boolean;
  title_ok: boolean;
  fetch: 'ok' | 'fail' | 'skip';
  reasons: string[];
  phone_kind?: 'mobile' | 'landline' | 'unknown';
};

export function computeQualityScore(v: VerifyResult, opts: { corporateEmail: boolean; confidence: number }): number;
// weights SRS §9A.2: evidence 25, phone 25, email 20, geo 15, website domain 10, conf 5

export function applyQualityGate(mode: 'quality' | 'volume', score: number, v: VerifyResult): 'pending' | 'auto_rejected';
// quality: evidence_ok && (phone_ok||email_ok) && score>=50
```

BR-Q coverage in tests: Q1 sequential phone, Q2 gmail hotline, Q3 generic name, Q4 google search URL, Q6 company not in snippet, Q7 literal, Q8 domain mismatch (score), Q9 denylist host.

- [ ] **Step 1: Write all util specs (FAIL)**

- [ ] **Step 2: Implement + wire worker** — increment `rejected_by_gate_count`

- [ ] **Step 3: Dedupe** phone_norm / email / company_norm+province before insert; check clients for `already_customer` flag in `verify_json` or column

- [ ] **Step 4: Run**

```bash
cd services/ptt-crm-api && npx jest src/market-research/raw-lead-harvest/quality/ -i
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): quality engine verify, BR-Q, score gate for raw leads.

EOF
)"
```

---

### Task 9: Cross-check 2 providers (H3b)

**Files:**
- Modify: `harvest-worker.service.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/cross-check.util.ts`
- Create: `.../cross-check.util.spec.ts`

**Interfaces:**
- If `job.cross_check` and ≥2 configured providers: take top `min(10, target_count)` by interim score; ask provider B “exists + contact match?”; write `cross_check_json`; deny → lower score or auto_reject

- [ ] **Step 1: Unit test deny → auto_rejected path**

- [ ] **Step 2: Implement + UI toggle already in Task 5**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): optional dual-provider cross-check for top raw leads.

EOF
)"
```

---

### Task 10: Optional enrich H3c — legal_status / Places (flagged)

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/enrich/legal-status.util.ts` (stub/adapter)
- Modify: worker behind `PTT_RESEARCH_HARVEST_LEGAL_ENRICH=1`

**Interfaces:**
- `legal_status`: `verified | unverified | mismatch` — **score boost only**, no hard-fail
- Skip if no adapter configured

- [ ] **Step 1: Stub returns `unverified` + test score boost when `verified`**

- [ ] **Step 2: Document adapter hook for MST/Places API**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): optional legal/places enrich hooks for raw lead scores.

EOF
)"
```

---

### Task 11: Feedback → blacklist + dial_outcome + export CSV (H4)

**Files:**
- Create: table `crm_research_raw_lead_blacklist` in repository ensureSchema
- Modify: `raw-lead-harvest.service.ts` — patch feedback / dial_outcome
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/blacklist.util.ts`
- Modify: worker skip blacklisted phone/email/company/domain
- Modify: `POST .../raw-leads/export` → CSV accepted+contactable (default)
- Modify: FE panel — feedback buttons + dial_outcome select + Export

**Interfaces:**
- `feedback_code`: `bad_phone | bad_email | fake_company | wrong_geo | other`
- `dial_outcome`: SRS §9B.4
- Blacklist write on bad_* / wrong_number / email_bounced / out_of_business

- [ ] **Step 1: Tests** — feedback bad_phone inserts blacklist; next insert skipped

- [ ] **Step 2: Export CSV columns** — company, address, phone, email, title, evidence_url, scores, sources

- [ ] **Step 3: FE wire + Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): raw lead feedback blacklist, dial outcomes, and CSV export.

EOF
)"
```

---

### Task 12: Push CRM Leads (H5)

**Files:**
- Modify: `raw-lead-harvest.service.ts` — `POST .../raw-leads/push-crm`
- Integrate existing leads create API/service (find `LeadsService` / create lead path)
- Modify: FE — push selected `accepted` + `contactable`

**Interfaces:**
- Reject if not `accepted` or not `contactable` or `already_customer` / `already_in_crm`
- Stamp lead source/channel from job snapshots when possible
- Set `crm_lead_id`, status `pushed`
- `lead_flow_kind` default B2B prospect per classification config

- [ ] **Step 1: Service tests** — push rejects non-contactable

- [ ] **Step 2: Implement mapping + FE button**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): push accepted contactable raw leads into CRM.

EOF
)"
```

---

### Task 13: Soft-delete guards + acceptance smoke script

**Files:**
- Modify: lead-lookup delete + AI provider delete to check harvest job snapshots → `409`
- Create: `scripts/smoke_raw_lead_harvest.sh` (optional) — health checks + flag docs
- Update SRS status note only if user asks (do not change spec casually)

**Acceptance matrix (manual / CI-ish):**

| # | Check |
|---|--------|
| 1 | Admin CRUD industry/job_title reflects harvest dropdowns |
| 2 | Province from VN Geo only |
| 3 | ≥1 source required; channels optional |
| 4 | Provider+model from Admin; disabled hidden |
| 5 | Token list shows hint only |
| 6 | Rotate + Test connection |
| 7 | Quality job: no evidence → not pending |
| 8 | `0123456789` not phone_ok |
| 9 | google.com/search evidence → auto_reject |
| 10 | Pass B: phone absent in HTML → null |
| 11 | bad_phone → blacklist |
| 12 | push CRM rejects `contactable=false` |
| 13 | Logs never contain API token |

- [ ] **Step 1: Implement 409 guards with tests**

- [ ] **Step 2: Run full harvest jest folder**

```bash
cd services/ptt-crm-api && npx jest src/market-research/raw-lead-harvest/ -i
cd services/ops-web && npx vitest run src/lib/market-research-api.ts 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(research): harden harvest delete guards and acceptance smoke checklist.

EOF
)"
```

---

## Spec coverage checklist

| SRS area | Task |
|----------|------|
| Admin industry/job_title | 1 |
| Admin source/channel search filters | 1 (seed) + 4–5 |
| Admin Provider/Model/Token CRUD | 2–3 |
| Harvest job + raw leads DDL/API | 4 |
| UI tab Lead thô | 5 |
| Real AI multi-pass | 6 |
| Pass B literal | 7 |
| Quality Engine / BR-Q / gate | 8 |
| Cross-check H3b | 9 |
| Legal/Places H3c | 10 |
| Feedback/blacklist/dial/CSV | 11 |
| Push CRM H5 | 12 |
| Soft-delete / AC | 13 |
| KPI dashboard charts | Out of scope v1 — log fields only (`dial_outcome`, gate counts) |

## Out of scope (do not implement in this plan)

- LinkedIn/Facebook scraping
- Web Push / mobile
- Auto dialer / Zalo blast
- Guaranteed 100% data accuracy copy
- Full analytics dashboard for false-contact KPI (store outcomes only)

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-09-14-market-research-raw-lead-harvest.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

**Which approach?** Start at Task 1 (Admin lookups) unless you want Wave A (Tasks 1–3) batched first.
