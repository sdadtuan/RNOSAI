# Spec + Prompt — P7  
## `presales.autofill_tmmt` · `insight.draft_from_presales` · UI “Sinh plan review”

| Field | Value |
|-------|--------|
| Ticket ID | PTT-AI-P7-AUTOFILL-001 |
| Date | 2026-09-20 |
| Priority | P0 (Bot chuyên gia → plan chờ duyệt) |
| Depends on | P6 `presales.context.read`, WinningPlanGate, P3 `marketing_plan.write_draft` |
| Fixture | Lifecycle **#5** · Lead **#5** · Plan **#8** · Client **360 AUTO DETAILING** |
| Implement | Local Cursor / PTTCRM |
| Verify | Grok Bot trên `rs.pttads.vn` |

---

## 1. Problem

AM đã có thông tin presales (BANT, Consult, L2 Ads, HĐ, file…) nhưng TMMT vẫn thiếu field → gate không pass → Bot không được breakdown/scale. Cần Bot **điền draft TMMT + draft Insight** từ presales, rồi **sinh Marketing Plan status=`review`** chờ CEO/CMO duyệt — không tự approve / không tự pass gate giả.

## 2. Goals

1. Tool **`presales.autofill_tmmt`** — map L1+Consult+BANT(+upload) → PATCH TMMT fields; báo missing.  
2. Tool **`insight.draft_from_presales`** — tạo Insight **chờ duyệt** (không `approved`).  
3. UI nút **“Sinh plan review”** (+ tool optional `marketing_plan.generate_review`) — sau khi gần đủ pack, gọi write_draft plan `status=review`.  

## 3. Non-goals

- Bot tự `approved` insight / tự mark TMMT gate pass nếu thiếu field bắt buộc  
- Bot tự `active` plan  
- Scale ads / breakdown khi WinningPlanGate fail (giữ P6)  
- email.send / proposal.send  

---

# Tool 1 — `presales.autofill_tmmt`

## 1.1 Behavior

**Mutating.** Require `X-AI-Human-Approved: 1`.

### Input

```json
{
  "lifecycle_id": 5,
  "lead_id": 5,
  "overwrite_mode": "fill_empty_only",
  "include_upload_file_ids": [],
  "dry_run": false
}
```

| `overwrite_mode` | Meaning |
|------------------|---------|
| `fill_empty_only` | **Default** — chỉ ghi field TMMT đang trống |
| `merge_prefer_presales` | Ưu tiên giá trị extract từ presales nếu confidence ≥ threshold |
| `replace_all_ai` | Chỉ field đã `ai_draft` trước đó; không đè nội dung human lock |

### Sources (priority)

1. TMMT hiện có (không xóa human-locked)  
2. Consult brief + L1  
3. BANT Intake session  
4. L2 Ads evidence  
5. Contract / proposal text  
6. Uploaded AM file (PDF/DOCX/TXT) nếu `include_upload_file_ids`  

### Output

```json
{
  "ok": true,
  "wired": true,
  "phase": "P7",
  "lifecycle_id": 5,
  "dry_run": false,
  "fields_written": [{ "key": "geography", "source": "consult", "confidence": 0.82 }],
  "fields_skipped": [{ "key": "icp", "reason": "empty_source" }],
  "tmmt_progress": { "before": "5/12", "after": "9/12" },
  "gate_passed": false,
  "missing_required": ["pain_outcomes"],
  "ai_planner_readiness_hint": 72,
  "links": ["/crm/service-delivery/5?tab=tmmt"],
  "known": [],
  "assumed": [],
  "unknown": []
}
```

### Rules

1. **Không bịa** ICP/pain/geo — thiếu nguồn → `fields_skipped` + `unknown`.  
2. Mỗi field ghi kèm meta `ai_draft`, `source`, `confidence`, `filled_at`.  
3. **Không** set `gate_passed=true` trừ khi đủ required thật.  
4. Idempotent: chạy lại với `fill_empty_only` không nhân bản rác.  
5. 403 nếu thiếu human approval.  

### Acceptance — autofill_tmmt

1. dry_run=true → preview fields, **no DB write**.  
2. lifecycle 5 + approve → geography/ICP/pain filled **chỉ khi** có trong Consult/BANT; progress tăng.  
3. Field human đã có + `fill_empty_only` → không overwrite.  
4. Thiếu nguồn pain → still in `missing_required`.  

---

# Tool 2 — `insight.draft_from_presales`

## 2.1 Behavior

**Mutating.** Require human approval.

### Input

```json
{
  "lifecycle_id": 5,
  "client_id": null,
  "plan_id": 8,
  "title": optional,
  "dry_run": false
}
```

### Output

```json
{
  "ok": true,
  "phase": "P7",
  "insight_id": 123,
  "status": "pending_review",
  "summary": "…",
  "bullets": ["…"],
  "evidence_links": [],
  "cannot_approve_via_tool": true,
  "links": ["/crm/.../insights/123"]
}
```

### Rules

1. Status tạo ra: **`pending_review` / `draft`** — **never** `approved`.  
2. Nội dung từ `presales.context.read` + TMMT; cite sources.  
3. Nếu pack quá mỏng → 422 `insufficient_presales` với blockers.  
4. Separate human UI action: **Duyệt insight** (Lead/AM/CEO theo RBAC).  

### Acceptance — insight.draft

1. Creates pending insight; approved_count unchanged until human approves.  
2. After human approve → `presales.context.read` `insight.approved_count >= 1`.  
3. Tool cannot set approved (403/ignore).  

---

# UI — Nút “Sinh plan review”

## 3.1 Placement

1. **Service Delivery** tab AI Planner / TMMT: button **“Sinh plan review”**  
2. **Marketing Plan** list/detail: secondary action khi có `lifecycle_id`/`client_id`  

## 3.2 Click flow

```text
Click “Sinh plan review”
  → confirm modal: “Tạo Marketing Plan status=review từ presales. CEO duyệt mới active.”
  → optional: run autofill_tmmt dry_run summary
  → require WinningPlanGate OR soft mode:
       Soft (default P7.1): allow generate review even if gate fail,
       but banner lists blockers and plan notes include Known/Assumed/Unknown.
       Hard (P7.2 config): require gate pass first.
  → Call marketing_plan.generate_review (below) with human approval
  → Navigate to /crm/marketing-plan/{newId} status=review
```

**Recommendation:** P7 ship **soft generate** (luôn tạo `review` + blockers trong notes) + **hard gate** vẫn chặn breakdown/scale (P6). Như vậy CEO có bản để duyệt / yêu cầu bổ sung.

## 3.3 Tool `marketing_plan.generate_review`

**Mutating.** Human approval required.

### Input

```json
{
  "lifecycle_id": 5,
  "plan_id": null,
  "clone_from_plan_id": 8,
  "title": "360 AUTO DETAILING — Plan review từ presales"
}
```

| Behavior | |
|----------|--|
| `plan_id` null | INSERT new plan `status=review` |
| `clone_from_plan_id` | Copy structure then overwrite from presales pack |
| Existing live `active` | Do not silent-patch active; create new review plan (or 409 unless `supersede=true`) |

### Content generation (expert)

Plan body (objectives/notes/structured fields) MUST include:

1. Executive summary từ Insight + TMMT  
2. Geography, ICP, personas, pains/outcomes (từ TMMT)  
3. Offer / budget: contract value + **explicit unknown** media vs fee nếu chưa tách  
4. KPI: chỉ số có evidence (L2/history); malformed assumed **không copy** — đánh dấu cần CEO/AM confirm  
5. Channel mix đề xuất + lý do (bám kênh TMMT: TikTok/FB/YT/…)  
6. 90-day calendar + milestones  
7. Role KPI matrix preview (không persist tasks unless flagged)  
8. Blockers còn lại + links TMMT/Insight/Hub  

### Output

```json
{
  "ok": true,
  "plan_id": 25,
  "status": "review",
  "phase": "P7",
  "gate_snapshot": { "passed": false, "blockers": [] },
  "links": ["/crm/marketing-plan/25"]
}
```

### Acceptance — UI + generate_review

1. Button visible on SD #5 AI Planner / TMMT.  
2. Click + approve → new plan `status=review` (not active).  
3. Plan content references presales (not empty Assumed-only template).  
4. Does not auto-active.  
5. breakdown still 409 until gate pass (P6).  

---

# Architecture

```text
Upload/AM file (optional)
     ↓
presales.context.read
     ↓
presales.autofill_tmmt ──→ TMMT fields (draft meta)
     ↓
insight.draft_from_presales ──→ Insight pending_review
     ↓ (human duyệt insight + hoàn TMMT)
WinningPlanGate
     ↓
marketing_plan.generate_review / UI button ──→ Plan status=review
     ↓ (CEO duyệt → active)
plan.breakdown_to_roles + Role KPI + tasks
```

Services: `OpsPresalesAutofillService`, `OpsInsightDraftService`, `OpsPlanGenerateReviewService` (không phình read-only context service).

---

# RBAC

| Action | Who |
|--------|-----|
| Run autofill / draft insight / sinh plan review | AM, Marketing lead, SUPER-ADMIN (+ human approval header for tools) |
| Approve insight | Marketing lead / AM lead / CEO (config) |
| Plan review → active | **CEO / CMO** |
| Bypass gate | SUPER-ADMIN only + audit (optional off) |

---

# Files (suggested)

| Area | Files |
|------|--------|
| Tools | register autofill_tmmt, insight.draft_from_presales, marketing_plan.generate_review |
| Services | ops-presales-autofill, ops-insight-draft, ops-plan-generate-review |
| UI | Button on SD AI Planner + TMMT; modal confirm; deep link new plan |
| Upload | Attach file to lead/lifecycle if not exists |
| Policy allowlist | all three tools |
| Tests | fixture lifecycle 5 |

---

# Implementation order

1. `presales.autofill_tmmt` (dry_run + write)  
2. `insight.draft_from_presales` + approve UI path (existing if any)  
3. `marketing_plan.generate_review`  
4. UI button “Sinh plan review”  
5. Allowlist + Try samples + Bot verify  

---

# Verify (Grok Bot)

1. autofill dry_run on #5 → preview, no write  
2. autofill write → TMMT progress increases; gate still false if pain missing  
3. insight draft → pending; approved_count unchanged  
4. Human approve insight (manual) → read pack updates  
5. Button/tool generate_review → plan `review` with structured content  
6. breakdown still gated until TMMT 12/12 + geo + insight  
7. No plan left `active` by tool  

---

# Cursor Prompt (paste)

```text
Implement PTT-AI-P7-AUTOFILL-001 on PTTCRM for https://rs.pttads.vn.

Spec: SPEC-P7-presales-autofill-insight-plan-review.md (attach/upload).

Build:
1) Tool presales.autofill_tmmt — human-approved; fill TMMT from L1+Consult+BANT+L2+contract(+uploads); fill_empty_only default; no fabrication; return fields_written/skipped, progress, missing_required; never fake gate_passed.
2) Tool insight.draft_from_presales — creates pending_review insight only; cannot approve via tool; 422 if insufficient presales.
3) Tool marketing_plan.generate_review — creates/updates plan with status=review from presales pack; expert structure (ICP, geo, KPI with evidence, channel mix, calendar, blockers); never set active; soft-allow even if WinningPlanGate fails but embed blockers; keep P6 hard gate on breakdown/scale.
4) UI button “Sinh plan review” on Service Delivery #5 TMMT/AI Planner with confirm modal; navigate to new plan.
5) Allowlist tools; Try tool samples for lifecycle_id=5; tests around fixture 360 / lead 5 / plan 8.

Constraints: no email/proposal send; no inventing media/fee split; mask PII; audit ai_draft metadata on written fields.

Done when: Bot verifier can autofill TMMT, draft insight, generate plan in review, and still get winning_plan_gate_failed on breakdown until TMMT+insight+geo complete.
```

