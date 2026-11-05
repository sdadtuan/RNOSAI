# Spec + Prompt — P8  
## Unify gates · Assumed Pain/ICP/Service · Bot draft Consult/Proposal · Return-to-AM

| Field | Value |
|-------|--------|
| Ticket ID | PTT-AI-P8-CONSULT-GATES-001 |
| Date | 2026-09-20 |
| Priority | P0 |
| Depends on | P6 WinningPlanGate, P7 autofill/insight/plan-review |
| Fixture | Lead **A Hưng 360** (BANT 0) · Lead **#5** / SD **#5** / Plan **#15** · 360 AUTO DETAILING |
| Implement | Local Cursor / PTTCRM |
| Verify | Grok Bot on `rs.pttads.vn` |

---

## 1. Problem

1. Gate copy lệch: screenshot `(BANT≥24)&(TMMT≥9)` vs UI TMMT R5 `≥6/12 + 4 core`.  
2. Khách/Sales thường **không biết** Pain, ICP, thậm chí **dịch vụ** → field trống → Bot autofill `empty_source` → kẹt.  
3. CEO bị đẩy nhập tay (sai RACI).  
4. Cần Bot **draft Assumed từ research**, AM **Confirm một lần**, thiếu thì **trả AM** — không fake Validated.

## 2. Goals

1. **Unify 2 gates** trên UI + API (Consult vs Winning Plan).  
2. Tools/UI: Bot draft **service recommended**, **Consult ICP/Pain**, optional **Proposal draft**.  
3. Field quality: `validated` | `assumed_confirmed` | `empty`.  
4. **Return-to-AM** với blockers cụ thể.  
5. Map Consult “Đối tượng mục tiêu” → TMMT `segmentation_icp`.  
6. Giữ P7 soft plan-review; P6 hard block breakdown/scale.

## 3. Non-goals

- Auto-send proposal/email  
- Auto-set plan `active` / insight `approved`  
- Fake `gate_passed`  
- Bắt Discovery 12/12 mới Consult  
- Bot tự `Selected` dịch vụ không qua AM Confirm  

---

# 4. Gate model (LOCKED)

## 4.1 Gate A — Đủ Tư vấn (Consult)

```text
consult_ready =
  (bant_score >= 24)
  AND (pain_status IN (validated, assumed_confirmed))
  AND (service_status IN (selected, recommended_confirmed))
  AND (qualify_decision == Go)
  AND (session completed per existing rules)
```

**Không** require: TMMT≥9, TMMT 6/12, Insight approved, Win 30, Handoff full, Proposal sent.

**UI copy (mọi chỗ):**  
`Đủ Tư vấn: BANT ≥ 24 + Pain (validated|assumed_confirmed) + Dịch vụ (selected|recommended_confirmed) + Go`

Remove/replace any `(BANT≥24)&(TMMT≥9)` string.

## 4.2 Gate B — Winning Plan (breakdown / scale-ads)

```text
winning_plan_ready =
  (tmmt_filled_count >= 6)
  AND (all 4 core fields non-empty with status IN (validated, assumed_confirmed))
  AND (geography present)
  AND (approved_insight_count >= 1)
```

**4 core (*):**  
1. `market_context` — Bối cảnh thị trường  
2. `segmentation_icp` — Phân khúc & ICP  
3. `personas_roles` — Persona & vai trò mua  
4. `pains_desired_outcomes` — Pain & kết quả mong muốn  

**UI copy:**  
`Winning gate: TMMT ≥ 6/12 + đủ 4 core + geo + Insight approved`  

Do **not** use numeric `TMMT score ≥ 9` unless product adds a real score later.

## 4.3 Soft vs hard

| Action | Consult gate | Winning gate |
|--------|--------------|--------------|
| Enter Consult workspace / draft proposal | require A | no |
| `marketing_plan.generate_review` / “Sinh plan review” | soft OK | soft OK + blockers |
| `plan.breakdown_to_roles` / scale-ads `task.create_draft` | — | **hard** 409 `winning_plan_gate_failed` |

---

# 5. Field quality statuses

Apply to: Need/Pain, ICP, Service.

| Status | Meaning |
|--------|---------|
| `empty` | No usable text / no service |
| `assumed_draft` | Bot wrote from research; **AM not confirmed** — **does not** satisfy gates |
| `assumed_confirmed` | AM clicked Confirm Assumed — **satisfies** Consult + Winning core |
| `validated` | Customer-stated or AM marked “khách xác nhận” |

Meta on each field (JSON/form_data):  
`{ status, source, confidence, cited_urls_or_ids[], filled_by, confirmed_by, confirmed_at }`

Vague customer text (“muốn bán chạy”) alone → stay `empty` or trigger Bot to upgrade to `assumed_draft`, never auto-`validated`.

---

# 6. Service when customer unknown

## 6.1 States

| `service_status` | |
|------------------|--|
| `unknown` | No industry, no SKU, no Confirm |
| `recommended_draft` | Bot proposed primary + alternate |
| `recommended_confirmed` | AM Confirm recommended |
| `selected` | Explicit customer/AM choice |

## 6.2 Tool `service.recommend_from_signals`

**Mutating** (writes draft recommendation only). Human approval header.

### Input
```json
{
  "lead_id": 0,
  "lifecycle_id": null,
  "signals": {
    "industry": null,
    "customer_utterance": null,
    "use_crm_similar_cases": true,
    "use_web_research": true
  },
  "dry_run": false
}
```

### Output
```json
{
  "ok": true,
  "phase": "P8",
  "service_status": "recommended_draft",
  "primary": { "sku": "quang-cao-facebook", "label": "Facebook Ads", "reason": "…" },
  "alternate": { "sku": "…", "label": "…", "reason": "…" },
  "menu": [{ "sku": "…", "label": "…", "when_to_pick": "…" }],
  "confidence": 0.7,
  "citations": [],
  "links": []
}
```

### Rules
- Never set `selected` via this tool.  
- AM Confirm UI sets `recommended_confirmed` or overrides to `selected`.  
- If signals too weak → `service_status=unknown` + `return_to_am` blockers (`need_industry_or_intent`).

---

# 7. Bot draft Pain / ICP / Consult

## 7.1 Tool `consult.draft_from_research`

**Mutating.** Human approval.

### Input
```json
{
  "lead_id": 0,
  "lifecycle_id": null,
  "overwrite_mode": "fill_empty_only",
  "include_web_research": true,
  "dry_run": false
}
```

### Writes (draft only → status `assumed_draft`)
1. Consult **Đối tượng mục tiêu** / ICP text  
2. BANT Discovery **Need / Pain** (structured: Pain · Context · Desired KPI · Constraints)  
3. Optionally seed TMMT core via existing autofill mapping after Confirm  

### Sources priority
1. Customer validated text (if any)  
2. Consult existing fields  
3. BANT answers  
4. Service recommended/selected pack  
5. CRM similar wins  
6. Web/industry research (cite)  
7. Never invent contract numbers / media-fee split  

### Output
```json
{
  "ok": true,
  "phase": "P8",
  "fields_written": [
    { "key": "need_pain", "status": "assumed_draft", "confidence": 0.75, "source": "research+sku" }
  ],
  "fields_skipped": [],
  "consult_ready_preview": false,
  "blockers": [],
  "links": []
}
```

## 7.2 Mapping fix (required)

| From | To |
|------|-----|
| Consult “Đối tượng mục tiêu” (and personas known) | TMMT `segmentation_icp` |
| Discovery Need/Pain (confirmed) | TMMT `pains_desired_outcomes` |

Update `presales.autofill_tmmt` so these are **not** `empty_source` when Consult/BANT text exists.

## 7.3 UI — AM Confirm

On BANT Discovery + Consult + TMMT core fields with `assumed_draft`:

- Button **“Confirm Assumed”** → status `assumed_confirmed`, audit actor  
- Button **“Khách đã xác nhận”** → `validated`  
- Button **“Reject / trả AM”** → clear or keep draft + open return-to-AM  

Gates only accept `assumed_confirmed` or `validated` (not bare `assumed_draft`).

---

# 8. Return-to-AM

## 8.1 Tool `presales.return_to_am` (or UI action)

### When (auto-suggest or force)
- `pain_status == empty` after draft attempt failed  
- `service_status == unknown` and recommend failed  
- AM rejected assumed drafts without replacement  
- Consult gate check failed with blockers list  

### Input
```json
{
  "lead_id": 0,
  "reason_codes": ["pain_empty", "service_unknown", "icp_empty"],
  "message": optional,
  "assignee_user_id": null
}
```

### Effect
- Lead/session flag `needs_am_rework=true`  
- Checklist blockers visible on Cockpit/BANT  
- Notify assignee (in-app; **no email send** unless separately approved later)  
- Bot stops treating lead as consult_ready  

### Message template (VN)
```text
Trả AM — chưa đủ Tư vấn/Winning:
- {blocker_1}
- {blocker_2}
Bot đã thử draft: {yes/no}. Cần Confirm Assumed hoặc bổ sung từ khách.
```

---

# 9. Proposal draft (optional same sprint if capacity)

## 9.1 Tool `proposal.draft_from_consult`

**Mutating.** Human approval. **Never send.**

### Preconditions
- `service_status IN (selected, recommended_confirmed)`  
- `pain_status IN (validated, assumed_confirmed)` preferred; if only `assumed_draft` → allow draft proposal with watermark “CHƯA CONFIRM”  

### Output
Creates proposal **draft** with scope, package A/B, assumptions, exclusions, pricing from internal price book if available else TBD lines.

Errors: 422 `insufficient_for_proposal` with blockers.

---

# 10. Architecture

```text
signals (utterance / industry / similar CRM / web)
    → service.recommend_from_signals → recommended_draft
    → AM Confirm → recommended_confirmed | selected
    → consult.draft_from_research → Pain/ICP assumed_draft
    → AM Confirm → assumed_confirmed | validated
    → Gate A consult_ready
    → (optional) proposal.draft_from_consult
    → autofill_tmmt (mapping fixed) + insight.draft + generate_review
    → Gate B winning_plan_ready → breakdown
```

Services (new, keep read services clean):  
`OpsServiceRecommendService`, `OpsConsultDraftService`, `OpsReturnToAmService`, `OpsProposalDraftService`  
Update: `WinningPlanGate`, Consult readiness checker, `OpsPresalesAutofillService` mapping.

---

# 11. RBAC

| Action | Who |
|--------|-----|
| Run recommend / consult draft / proposal draft tools | AM, Marketing lead, SUPER-ADMIN (+ human approval header) |
| Confirm Assumed / Validated | AM, Lead |
| Return-to-AM | Bot tool, AM lead, SUPER-ADMIN |
| Winning breakdown | unchanged P6 |

---

# 12. Files (suggested)

| Area | |
|------|--|
| Gates | consult_ready evaluator; winning_plan gate update; UI copy |
| Tools | service.recommend_from_signals, consult.draft_from_research, presales.return_to_am, proposal.draft_from_consult |
| Autofill | map Đối tượng mục tiêu → segmentation_icp; Need/Pain → pains_desired_outcomes |
| UI | Confirm Assumed, service recommend card, return-to-AM banner, gate labels |
| Policy allowlist | all new tools |
| Tests | A Hưng 360 (unknown service/pain); Lead #5 (mapping ICP from Consult) |

---

# 13. Acceptance

1. No UI string left as `(BANT≥24)&(TMMT≥9)` for Consult.  
2. Lead with BANT≥24 + Pain assumed_confirmed + service recommended_confirmed + Go → `consult_ready=true`.  
3. `assumed_draft` alone → `consult_ready=false`.  
4. Customer “không biết dịch vụ” → recommend tool fills menu; AM Confirm → consult path unblocked.  
5. Customer vague pain → consult.draft writes assumed_draft with citations; after Confirm, autofill fills TMMT core (not empty_source if Consult has Đối tượng mục tiêu).  
6. Winning gate uses `6/12+4 core+geo+insight`; breakdown still 409 until met.  
7. return_to_am sets rework flag + blockers.  
8. proposal draft never auto-sends.  
9. Plan review soft-generate still works with blockers.  

---

# 14. Implementation order

1. Gate unify (API + UI copy)  
2. Field status meta + Confirm Assumed UI  
3. `service.recommend_from_signals`  
4. `consult.draft_from_research`  
5. Autofill mapping fix  
6. `presales.return_to_am`  
7. `proposal.draft_from_consult` (same PR if time; else P8.1)  
8. Allowlist + Try samples + Bot verify  

---

# 15. Cursor Prompt (paste)

```text
Implement PTT-AI-P8-CONSULT-GATES-001 on PTTCRM (https://rs.pttads.vn).

Spec: SPEC-P8-consult-gates-assumed-drafts.md (attach).

LOCKED gates:
- Consult ready: bant_score>=24 AND pain_status in (validated, assumed_confirmed) AND service_status in (selected, recommended_confirmed) AND qualify Go + session rules. NO TMMT>=9.
- Winning plan: tmmt_filled>=6 AND 4 core (market_context, segmentation_icp, personas_roles, pains_desired_outcomes) each validated|assumed_confirmed AND geography AND approved_insight>=1. Soft allow marketing_plan.generate_review with blockers; HARD block plan.breakdown_to_roles and scale-ads drafts with winning_plan_gate_failed.

Build:
1) Unify UI/API gate copy; remove (BANT>=24)&(TMMT>=9) as Consult formula.
2) Field quality statuses empty|assumed_draft|assumed_confirmed|validated with meta (source, confidence, citations, confirmed_by).
3) Tool service.recommend_from_signals — primary+alternate+menu; never auto-selected; AM Confirm → recommended_confirmed|selected.
4) Tool consult.draft_from_research — draft Need/Pain + Consult ICP/Đối tượng mục tiêu as assumed_draft from research/CRM/SKU; no fabrication of fees; human-approved.
5) UI Confirm Assumed / Khách đã xác nhận / Reject; gates ignore assumed_draft until confirmed.
6) Fix presales.autofill_tmmt mapping: Consult Đối tượng mục tiêu → segmentation_icp; confirmed Need/Pain → pains_desired_outcomes.
7) Tool presales.return_to_am — blockers + needs_am_rework flag.
8) Tool proposal.draft_from_consult — draft only, never send; watermark if unconfirmed.
9) Allowlist + Try samples for lead fixtures A Hưng 360 and lead/lifecycle #5; tests for consult_ready vs winning_plan_ready.

Constraints: no email/proposal send; no auto-approve insight; no fake gate_passed; mask PII; audit AI drafts.

Done when: Bot can recommend service + draft Pain/ICP Assumed, AM Confirm unlocks Consult; Winning still needs 6/12+4 core+geo+insight; breakdown stays hard-gated; return-to-AM works when unknown and unconfirmed.
```
