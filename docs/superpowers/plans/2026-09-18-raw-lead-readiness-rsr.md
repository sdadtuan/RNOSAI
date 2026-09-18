# Raw Lead Readiness (RSR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Places harvest inserts all scanned places into raw leads (skip only duplicate `place_id` per project), classifies RSR readiness, and exposes UI tabs; CRM leads only on push from READY_TO_PUSH.

**Architecture:** Keep `crm_research_raw_leads`. Add `readiness_status` + reason codes. Intent worker: insert-all → normalize → classify. List/filter/counts by readiness; push-CRM gated. Ops-web tabs replace status-centric filter for primary navigation.

**Tech Stack:** NestJS `ptt-crm-api`, PostgreSQL, Next.js ops-web, Jest/Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-18-raw-lead-readiness-rsr-design.md`](../specs/2026-09-18-raw-lead-readiness-rsr-design.md)

## Global Constraints

- Lead thô ≠ CRM: never write `crm_leads` during harvest.
- Insert skip only: existing `(project_id, place_id)`.
- Readiness codes: `READY_TO_PUSH` | `NEEDS_REVIEW` | `MISSING_CONTACT` | `DUPLICATE_OR_BLACKLIST`.
- Push CRM: only `READY_TO_PUSH` (MVP).
- READY minimum quality_score: **35**.
- After classify: `status=pending` (stop using auto_rejected for missing contact).

---

## File map

| File | Responsibility |
|---|---|
| `…/quality/readiness-classify.util.ts` (+ spec) | RSR readiness rules |
| `…/raw-lead-harvest.repository.ts` | DDL, unique place_id, insert/list/counts |
| `…/raw-lead-list-query.util.ts` | Parse `readiness_status` query |
| `…/intent/intent-harvest.worker.ts` | Insert-all + classify |
| `…/raw-lead-harvest.service.ts` | Push gate, counts |
| `…/raw-lead-harvest.controller.ts` | Counts endpoint |
| `…/raw-lead-harvest.types.ts` + ops-web `api.ts` | Types |
| `RawLeadHarvestPanel.tsx` | Tabs, toast, filters |

---

### Task 1: Readiness classifier (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/readiness-classify.util.ts`
- Create: `services/ptt-crm-api/src/market-research/raw-lead-harvest/quality/readiness-classify.util.spec.ts`

- [x] **Step 1:** Write failing tests for matrix: blacklist/CRM → DUPLICATE; no phone → MISSING_CONTACT; phone+score≥35 → READY; else NEEDS_REVIEW (+ reason codes).
- [x] **Step 2:** Implement `classifyRawLeadReadiness(input) → { readiness_status, readiness_reason_codes, classification }`.
- [x] **Step 3:** `npm test -- --testPathPattern=readiness-classify` → pass.

---

### Task 2: Schema + repository

**Files:**
- Modify: `raw-lead-harvest.repository.ts`, `raw-lead-harvest.types.ts`, `raw-lead-list-query.util.ts` (+ specs)

- [x] **Step 1:** ALTER add `readiness_status`, `readiness_reason_codes` (JSONB/TEXT[]); partial unique `(project_id, place_id) WHERE place_id IS NOT NULL`.
- [x] **Step 2:** `hasPlaceIdInProject`, `insertLead` sets readiness; list filter `readiness_status`; `countByReadiness(projectId)`.
- [x] **Step 3:** Map row + list query parser tests pass.

---

### Task 3: Intent worker insert-all

**Files:**
- Modify: `intent/intent-harvest.worker.ts` (+ spec)

- [x] **Step 1:** Remove hard-drop paths (CRM/blacklist/intent threshold/gate reject that skip insert). Keep discover + details.
- [x] **Step 2:** Skip insert only if `hasPlaceIdInProject`; else insert `pending` + classify readiness.
- [x] **Step 3:** Stats: inserted, skipped_place_id, readiness breakdown; `result_count` = inserted.
- [x] **Step 4:** Worker spec updated → pass.

---

### Task 4: API — counts + push gate

**Files:**
- Modify: `raw-lead-harvest.service.ts`, `raw-lead-harvest.controller.ts`, ops-web `api.ts`

- [x] **Step 1:** `GET .../projects/:id/raw-leads/readiness-counts`.
- [x] **Step 2:** List accepts `readiness_status`.
- [x] **Step 3:** `pushRawLeadsToCrm` rejects non-READY_TO_PUSH with clear error.
- [x] **Step 4:** Service/unit test or light integration check.

---

### Task 5: UI tabs + toast

**Files:**
- Modify: `services/ops-web/src/components/research/RawLeadHarvestPanel.tsx`

- [x] **Step 1:** Tabs with counts; filter list by readiness; keep secondary filters.
- [x] **Step 2:** Push button only when selection is READY (or filter selection).
- [x] **Step 3:** Job done toast: inserted + readiness breakdown.
- [x] **Step 4:** Job form helper: insert-all copy; jobs pager unchanged (3/page).

---

### Task 6: Verify

- [x] **Step 1:** Run Jest for readiness, list-query, intent-worker, quality-gate.
- [x] **Step 2:** Typecheck ops-web if practical.
- [ ] **Step 3:** Commit (when user asks deploy separately).

---

## Out of scope (this plan)

Account clustering, P1/P2/P3, battlecard, learning loop, new prospect table, backfill script (optional follow-up).
