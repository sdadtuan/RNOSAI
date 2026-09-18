# Raw Lead Phase 6 — Battlecard Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-18 |
| Trạng thái | Approved via “viết plan rồi implement Battlecard” |
| Parent | RSR sâu · Phase 5 cluster/priority |
| Scope | **MVP** — call sheet deterministic; không LLM / learning loop |

## Goal

AM mở **Battlecard** trên một Lead thô để biết gọi ai, nói gì, rủi ro gì, bước tiếp theo — trước khi dial / Accept / push CRM.

## Approach (khuyến nghị)

**Template deterministic** từ field sẵn có + siblings cùng `account_cluster_key`.

| Option | Pros | Cons |
|---|---|---|
| **A. Deterministic util (chọn)** | Nhanh, test được, 0 cost LLM | Copy cứng theo rule |
| B. LLM rewrite | Ngôn ngữ “bán hàng” | Latency, cost, flaky |
| C. Wire Lead Meeting Prep | Tái dùng LMP | LMP gắn `crm_leads`; raw chưa push |

## Data

Không cột mới bắt buộc. Battlecard **compute on read**.

Optional sau (out of scope MVP): `battlecard_json` cache.

## Battlecard shape (`version: 1`)

```ts
{
  version: 1,
  lead_id: number,
  generated_at: string, // ISO
  headline: string,     // company + P-tier
  priority_tier: string | null,
  readiness_status: string | null,
  classification: string | null,
  scores: { quality: number; icp: number; intent: number | null },
  why_call_now: string[],
  contact: {
    phone: string | null;
    email: string | null;
    website: string | null;
    fanpage_url: string | null;
    zalo_url: string | null;
    address: string | null;
    contact_title: string | null;
  },
  evidence: {
    url: string | null;
    snippet: string | null;
    place_id: string | null;
  },
  talking_points: string[],
  risks: string[],
  next_actions: string[],
  cluster: {
    key: string | null;
    mates: Array<{
      id: number;
      company_name: string;
      priority_tier: string | null;
      phone: string | null;
      readiness_status: string | null;
    }>;
  },
  dial_outcome: string | null,
  feedback_code: string | null,
}
```

## Rule matrix (deterministic)

### `why_call_now`

- P1 → “Ưu tiên cao (P1) — sẵn sàng gọi sớm.”
- READY_TO_PUSH → “Đã READY_TO_PUSH — đủ điều kiện push CRM.”
- quality_score ≥ 70 → “Quality score cao.”
- intent_score ≥ 0.6 (nếu có) → “Intent Places mạnh.”
- contactable + phone → “Có SĐT contactable.”
- Fallback: “Cần review trước khi gọi.”

### `talking_points` (tối đa 5)

- Mở: tên công ty + địa chỉ/quận nếu có.
- Website/fanpage → “Xác nhận dịch vụ trên web/FB trước khi pitch.”
- ICP ≥ 50 → “ICP fit khá — bám ngành đã harvest.”
- Evidence snippet rút gọn (≤120 chars) nếu có.
- Contact title nếu có → “Xin gặp {title}.”

### `risks`

- MISSING_CONTACT / !phone → thiếu SĐT.
- DUPLICATE_OR_BLACKLIST → trùng/blacklist.
- dial_outcome ∈ wrong_number | out_of_business | email_bounced → cảnh báo dial.
- dial_outcome = gatekeeper → chuẩn bị qua lễ tân.
- feedback_code bad_* / fake_company / wrong_geo → cảnh báo feedback.
- Cluster mates > 0 → “Cùng account cluster — tránh gọi trùng.”

### `next_actions` (ordered)

1. Nếu thiếu phone → “Bổ sung contact / Places enrich.”
2. Else nếu NEEDS_REVIEW → “Review evidence rồi Accept.”
3. Else nếu READY + P1/P2 → “Gọi SĐT · ghi dial outcome.”
4. Else nếu READY → “Push CRM khi đã xác nhận.”
5. Luôn: “Cập nhật feedback nếu sai dữ liệu.”

## API

`GET /api/v1/research/projects/:id/raw-leads/:leadId/battlecard`

- Auth: research view
- 404 nếu lead không thuộc project
- Load lead + tối đa 8 cluster mates (`account_cluster_key` cùng project, exclude self)

## UI

- Nút **Battlecard** trên mỗi row Lead thô
- Modal/drawer: headline, why, contact (click-to-call/mail), talking points, risks, next actions, cluster mates
- Không edit trên card (chỉ đọc); dial/feedback vẫn ở bảng

## Out of scope

LLM rewrite, persist cache, learning loop, cross-project cluster, CRM Account merge, auto-enqueue Lead Meeting Prep.
