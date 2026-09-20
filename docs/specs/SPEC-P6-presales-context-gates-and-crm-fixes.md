# Spec + Prompt — Dev #18 / #19 / #20  
## Presales Context Pack · Winning-Plan Gates · CRM Stability Fixes

| Field | Value |
|-------|--------|
| Ticket ID | PTT-AI-P6-PRESALES-001 |
| Date | 2026-09-20 |
| Priority | P0 (để Bot chuyên gia — plan triển khai được) |
| Client fixture | 360 AUTO DETAILING · Plan #8 · Lifecycle #5 · Lead #5 · Contract #1 |
| Depends on | P2 CrmContextPack, P5 breakdown_to_roles, Role KPI |
| Implement | Local Cursor / PTTCRM |
| Verify | Grok Bot trên `rs.pttads.vn` |

---

# Phần A — Spec chi tiết

## A0. Problem

Plan marketing hiện tại (vd #8) **không triển khai được** vì Bot không đọc đủ **presales** (TMMT, BANT, L2 Ads, HĐ/Quote, Insight duyệt, Hub campaign map). Bot đang dựa Assumed notes → KPI lệch, thiếu địa bàn, proposal 0₫, Hub không map campaign.

## A1. Goals (map 18 / 19 / 20)

| # | Goal |
|---|------|
| **18** | Tool/API đọc gộp TMMT + BANT + L2 Ads + HĐ/Quote (+ insight duyệt + hub map) → mở rộng **`CrmContextPack.presales`** |
| **19** | **Gate** chặn `plan.breakdown_to_roles` / scale-ads tasks / (optional) `marketing_plan` “ready_to_execute” nếu TMMT chưa pass **hoặc** chưa có insight duyệt |
| **20** | Fix ổn định: **401** noise + **500** `GET /api/crm/service-lifecycle/:id/context` + Proposal/QT search + Hub Agency client load |

## A2. Non-goals

- Bot tự điền TMMT / tự duyệt insight / tự ký HĐ  
- Tự Activate Assignment / fake actuals  
- Rewrite toàn bộ Consult UI  
- email.send / proposal.send  

---

# Mục 18 — `presales.context.read` → `CrmContextPack.presales`

## 18.1 Tool

**Name:** `presales.context.read`  
**Mutating:** No  
**Allowlist:** strategist + PM policies  

### Input

```json
{
  "lifecycle_id": 5,
  "lead_id": 5,
  "plan_id": 8,
  "client_id": "d437cc78-0757-44ba-aaa3-9ffb941121dd"
}
```

Resolve tối thiểu **một** trong: `lifecycle_id` | `lead_id` | `client_id` | `plan_id` (plan → client/lifecycle). Thiếu hết → 400 `context_id_required`.

### Output — extend CrmContextPack

```json
{
  "ok": true,
  "wired": true,
  "phase": "P6",
  "source": "ptt-crm",
  "as_of": "ISO-8601",
  "client": { "id": "", "name": "360 AUTO DETAILING", "lifecycle": "" },
  "presales": {
    "lead": {
      "id": 5,
      "name": "",
      "status": "",
      "source": "facebook_meta",
      "owner": "",
      "created_at": ""
    },
    "bant": {
      "session_id": 12,
      "score": "30/30",
      "decision": "Go",
      "completed_at": "",
      "discovery_answered": "3/12",
      "red_flags": 0,
      "sync_ok": false,
      "sync_issues": ["consult_shows_0_30_while_intake_30_30"]
    },
    "tmmt": {
      "lifecycle_id": 5,
      "progress": "0/12",
      "gate_passed": false,
      "missing_fields": ["market_context", "icp", "personas", "pains_outcomes", "geography"],
      "audience_bullets": [],
      "channels": [],
      "core_message": "",
      "suggested_am": "",
      "suggested_sp": ""
    },
    "l2_ads": {
      "ads_account_readable": true,
      "pixel_capi": true,
      "landing_page_url": "",
      "historical_spend_available": true,
      "gaps": []
    },
    "contract": {
      "id": 1,
      "title": "HD 360 AUTO DETAILING — Meta Lead Gen",
      "value_vnd": 45000000,
      "value_meaning": "contract_total_unspecified_media_vs_fee_split"
    },
    "proposal": {
      "ids": [],
      "qt_codes_found": [],
      "has_positive_total": false,
      "kpi_contract_score": 0,
      "gaps": ["totals_zero", "empty_kpi_table", "qt_0360_not_in_proposal_list"]
    },
    "insight": {
      "approved_count": 0,
      "approved_ids": [],
      "can_insert_into_plan": false
    },
    "hub_agency": {
      "client_key": "360-AUTO",
      "campaign_map_rows": 0,
      "launch_qa_skipped": true,
      "gaps": ["no_campaign_map", "agency_detail_loading_stuck"]
    }
  },
  "known": [],
  "assumed": [],
  "unknown": [],
  "blockers_for_winning_plan": [],
  "links": []
}
```

### 18.2 Rules

1. **Không bịa:** thiếu field → `unknown[]` + `gaps[]`.  
2. Tự điền `blockers_for_winning_plan` từ gaps (địa bàn, TMMT gate, insight, budget split, hub map, KPI malformed…).  
3. Reuse repos hiện có (lifecycle TMMT, intake BANT, lead L2, contracts, proposals, hub).  
4. PII: mask phone/email như CRM UI (chỉ trả nếu policy cho phép staff tool).  

### 18.3 Also extend

`marketing_plan.read` / `service_delivery.read` **optional** embed `presales` summary (short) OR document that Strategist must call `presales.context.read` first.

### 18.4 Acceptance — mục 18

1. Call với `lifecycle_id=5` → 200, `presales.tmmt.gate_passed === false`, `contract.value_vnd === 45000000` (nếu còn đúng DB).  
2. `insight.approved_count === 0` khi chưa có insight duyệt.  
3. `bant.sync_issues` non-empty khi Intake≠Consult.  
4. Không lộ raw phone/email nếu CRM mask.  
5. Tool trong catalog + allowlist.  

---

# Mục 19 — Winning-plan gates

## 19.1 Gate definition `WinningPlanGate`

```ts
pass = tmmt.gate_passed === true
    && insight.approved_count >= 1
    && geography_resolved === true   // from TMMT or plan
    && !kpi_targets_malformed        // optional strict mode
```

Configurable flags in admin (defaults above). Soft-warn vs hard-block by tool:

| Tool / action | If gate FAIL |
|---------------|--------------|
| `presales.context.read` | Always allow (read) |
| `marketing_plan.write_draft` | Allow (để Bot rewrite từ presales) |
| `plan.breakdown_to_roles` | **403/409** `winning_plan_gate_failed` + blockers list |
| `task.create_draft` với tag/scale ads (`Launch CPL`, `Scale winning ads`, media spend tasks) | **409** `winning_plan_gate_failed` |
| `task.create_draft` research/TMMT/insight tasks | Allow |
| `kpi_target.write_draft` | **409** unless `allow_assumed_kpi=true` (default false when gate fail) |
| `service_delivery.propose_transition` apply forward vào/qua deliver scale | Warn or block if gate fail (default **block** apply when from onboard→deliver or within deliver scale) — **P6.1:** block only `persist_tasks` scale; transition policy: **warn in dry_run, block apply** nếu gate fail |

## 19.2 Error shape

```json
{
  "ok": false,
  "error": "winning_plan_gate_failed",
  "http": 409,
  "blockers": [
    { "code": "tmmt_gate", "detail": "0/12" },
    { "code": "no_approved_insight", "detail": "" },
    { "code": "geography_missing", "detail": "" }
  ],
  "links": ["/crm/service-delivery/5?tab=tmmt", "/crm/marketing-plan/8"]
}
```

## 19.3 Bypass

- Header `X-AI-Gate-Bypass: 1` **chỉ SUPER-ADMIN** + audit log (optional; default **disabled** in prod).  

## 19.4 Acceptance — mục 19

1. Plan #8 / lifecycle #5 hiện tại: `breakdown_to_roles` → **409** `winning_plan_gate_failed` (TMMT 0/12 + no insight).  
2. Sau khi (test) mark TMMT pass + 1 insight approved + geography set → breakdown **200**.  
3. Scale-ads task create blocked khi gate fail; TMMT completion task still allowed.  
4. Error lists blockers + links.  

---

# Mục 20 — CRM stability / data consistency fixes

## 20.1 `GET /api/crm/service-lifecycle/:id/context` → 500

- Reproduce: open `/crm/service-delivery/5` (console 500 on `.../context`).  
- Fix root cause (null deref, bad join BANT slug, missing agency client).  
- Acceptance: HTTP **200** with JSON; UI tabs TMMT/Workflow không spam 500.  

## 20.2 401 noise on CSD / notifications / flags / lifecycle

- Auth cookie/token refresh; don’t block page on optional widgets.  
- Acceptance: hard navigation SD #5 không cascade 401 breaking workflow; optional endpoints fail soft.  

## 20.3 Proposal / QT search

- Search `QT-0360` / contract-linked quote returns consistent records **or** explicit empty with reason.  
- Fix drafts LD-5 showing 0₫ if they should link contract 45tr **or** hide garbage drafts from “all” default filter.  
- Acceptance: documented behavior + test case.  

## 20.4 Hub Agency client load

- Client `360-AUTO` detail không kẹt “Đang tải…”.  
- Campaign map editable; after 1 row mapped, Service Delivery không báo skip Launch QA vì thiếu agency client.  
- Account Management list ↔ Hub client cùng `client_id`.  
- Acceptance: open Hub client 360 < 3s load; campaign map save 1 row OK.  

## 20.5 BANT sync (related to gate)

- Single source of truth: Intake session decision vs Consult workspace BANT.  
- Acceptance: after fix, `presales.context.read` `bant.sync_ok === true` for lead 5 **or** clear migration note.  

---

# Phần B — Implementation plan (Dev)

| Order | Work | Estimate hint |
|-------|------|----------------|
| 1 | Fix 20.1 + 20.2 (unblocks QA) | S |
| 2 | Fix 20.4 Hub load + 20.3 search | M |
| 3 | 20.5 BANT sync | M |
| 4 | 18 `presales.context.read` + pack schema | M |
| 5 | 19 gates on breakdown / scale tasks | M |
| 6 | Allowlist + Try tool samples + tests | S |

---

# Phần C — Prompt Cursor (dán local)

```text
You are implementing PTT-AI-P6-PRESALES-001 on the PTTCRM codebase for https://rs.pttads.vn.

Read the full spec in uploads/SPEC-P6-presales-context-gates-and-crm-fixes.md (or repo docs copy).

## Deliverables

### 20 — Fixes first
1. Fix GET /api/crm/service-lifecycle/:id/context returning 500 (repro lifecycle id=5).
2. Reduce/fix 401 spam on service-delivery pages so workflow remains usable.
3. Hub Agency client 360-AUTO must load (no infinite “Đang tải…”); campaign map can save rows; align client_id with Account Management.
4. Proposal search: QT codes / 360-linked quotes behave consistently; document 0₫ drafts.
5. BANT sync between Intake Go and Consult/TMMT display for lead_id=5.

### 18 — Tool
6. Add non-mutating AI tool `presales.context.read` that aggregates TMMT + BANT + L2 Ads + Contract + Proposal gaps + approved insights + Hub campaign map into CrmContextPack.presales.
7. No fabricated fields — use known/assumed/unknown + blockers_for_winning_plan.
8. Register tool + allowlist on strategist/PM policies. Add Try tool sample for lifecycle_id=5.

### 19 — Gates
9. Implement WinningPlanGate: require TMMT gate_passed + ≥1 approved insight + geography resolved.
10. Enforce on `plan.breakdown_to_roles` and scale-ads style `task.create_draft`; allow write_draft plan + TMMT/research tasks.
11. Error `winning_plan_gate_failed` with blockers[] + deep links.

## Constraints
- Do not enable email/proposal send.
- Do not auto-approve insights or auto-pass TMMT.
- Do not invent media budget split; expose contract value + gap.
- Prefer tests around fixture lead 5 / lifecycle 5 / plan 8 / client 360 AUTO DETAILING.

## Done when
- SD #5 loads without context 500.
- Hub 360 loads; campaign map save works.
- Try tool presales.context.read returns pack with blockers for current 360 state.
- breakdown_to_roles on plan 8 currently returns winning_plan_gate_failed until TMMT+insight+geo fixed.
- PR describes QA steps for Grok Bot verifier.
```

---

# Phần D — Verify checklist (Grok Bot)

1. SD `#5` no `context` 500  
2. Hub `360-AUTO` loads  
3. `presales.context.read` lifecycle 5 → blockers include tmmt + insight + geo  
4. `breakdown_to_roles` plan 8 → 409 gate_failed  
5. After manual TMMT pass + insight + geo (test env) → breakdown 200  
6. Scale task create blocked when gate fail  

---

# Phần E — Traceability

| Item | Links |
|------|-------|
| 18 | CrmContextPack P2, TMMT/BANT/L2/HĐ |
| 19 | breakdown_to_roles P5, task.create_draft P3 |
| 20 | Service Delivery UX, Hub Agency, Proposals |

