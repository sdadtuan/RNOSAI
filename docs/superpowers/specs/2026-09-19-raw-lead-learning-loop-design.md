# Raw Lead Phase 7 — Learning Loop Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-19 |
| Trạng thái | Approved via “viết plan rồi implement Learning loop” |
| Parent | RSR sâu · Phase 5 priority · Phase 6 battlecard |
| Scope | **MVP** — rule-based score/priority từ dial + feedback; không ML / LLM |

## Goal

AM ghi **dial outcome** / **feedback** → hệ thống **học** bằng cách chỉnh `quality_score` + `priority_tier` để thứ tự gọi lần sau tốt hơn.

## Approach

| Option | Pros | Cons |
|---|---|---|
| **A. Rule delta + recompute priority (chọn)** | Test được, giải thích được | Không “học” thống kê |
| B. Aggregate project weights | Cá nhân hóa theo project | Cần đủ mẫu, phức tạp |
| C. ML model | Dài hạn | Out of scope |

Blacklist từ feedback (đã có) **giữ nguyên**; learning loop bổ sung **score/priority**.

## Data

ALTER `crm_research_raw_leads`:

| Column | Type | Meaning |
|---|---|---|
| `learning_delta` | NUMERIC NOT NULL DEFAULT 0 | Delta đã áp vào quality |
| `learning_reasons` | TEXT[] | Mã lý do (vd. `dial:connected`) |
| `learning_applied_at` | TIMESTAMPTZ | Lần apply gần nhất |

**Idempotent:** `base = quality_score - learning_delta` rồi `quality_score = clamp(base + new_delta, 0, 100)`.

## Delta matrix (cộng dồn các signal hiện có)

| Signal | Delta |
|---|---|
| dial `connected` | +10 |
| dial `no_answer` | −2 |
| dial `gatekeeper` | 0 |
| dial `wrong_number` | −25 |
| dial `out_of_business` | −40 |
| dial `email_bounced` | −15 |
| feedback `bad_phone` | −20 |
| feedback `bad_email` | −10 |
| feedback `fake_company` | −35 |
| feedback `wrong_geo` | −15 |
| feedback `other` | −5 |

Sau khi set score: `priority_tier = computePriorityTier(...)` (reuse Phase 5). Cluster key không đổi.

## Triggers

1. **Auto** trên `PATCH` raw lead khi `dial_outcome` hoặc `feedback_code` đổi (và có giá trị).
2. **Batch** `POST .../projects/:id/raw-leads/apply-learning`  
   Body: `{ lead_ids?, job_id?, limit? }` — mọi lead có dial/feedback (non-pushed), max 2000.

Return: `{ updated, scanned, counts: { boosted, demoted, unchanged }, priority_counts }`.

## API / UI

- Batch endpoint + counts trong message toast.
- UI: nút **Áp dụng học dial** (cạnh Tính ưu tiên).
- Cột Score: hiện delta nhỏ (`+10` / `−25`) nếu `learning_delta ≠ 0`.
- Battlecard: thêm dòng `learning_reasons` nếu có (optional cùng PR).

## Out of scope

ML weights, cross-project learning, auto-retrain harvest critic, LLM, thay đổi readiness chỉ vì dial (trừ khi score/priority kéo theo).
