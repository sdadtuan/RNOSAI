# Raw Lead Readiness — chuẩn hoá Lead thô theo RSR (Hướng 1)

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-18 |
| Trạng thái | Draft — chờ PO duyệt trước khi implement |
| Nguồn | `RSR_AI_Powered_Account_Intelligence_Revenue_Prospecting_System.md` §4.2, FR-INTAKE, FR-DQ, FR-DEDUPE, FR-READINESS |
| Codebase | `crm_research_raw_leads` / `crm_research_raw_lead_harvest_jobs` · ops-web `RawLeadHarvestPanel` |
| Quyết định | **Hướng 1** — giữ bảng Lead thô hiện có; thêm readiness RSR; không merge schema với `crm_leads` |

---

## 1. Mục tiêu

1. Job Places **insert hết** place scan được vào **Lead thô** (bảng riêng), chỉ bỏ trùng `place_id` trong cùng `project_id`.
2. **Chuẩn hoá + phân loại readiness** sau khi đã lưu DB (không hard-drop im lặng như Intent gate hiện tại).
3. UI Lead thô tổ chức theo **tab readiness** RSR; chỉ **push CRM** khi đủ điều kiện (và ghi `crm_leads` lúc đó).
4. Cấu hình job đầy đủ / rõ ràng trên UI.

**Ngoài MVP:** Account clustering, P1/P2/P3, battlecard, learning loop (RSR §5.5+).

---

## 2. Ranh giới dữ liệu

```text
Google Places API
      ↓
crm_research_raw_lead_harvest_jobs   (batch / job config)
      ↓
crm_research_raw_leads               (Lead thô — RSR Raw Prospect)
      ↓  staff Accept / Push CRM
crm_leads                            (CRM Lead — chỉ khi chuyển)
```

- Lead thô **không** ghi `crm_leads` khi harvest.
- `crm_lead_id` trên raw lead chỉ set sau push thành công (giữ flow hiện có).

---

## 3. Pipeline job (Intent / Places)

```text
1. Create job (config đầy đủ)
2. Places Text Search (lưới quận HCM nếu province=79)
3. Place Details enrich (SĐT / website / FB)
4. INSERT raw lead  — skip chỉ khi place_id đã có trong project
5. Normalize (FR-DQ) — phone/email/domain/FB/name
6. Lead Readiness Classification (FR-READINESS)
7. UI tabs theo readiness_status
8. Push CRM ← chỉ READY_TO_PUSH (hoặc NEEDS_REVIEW sau Accept thủ công)
```

### 3.1. Insert rule (khóa)

| Điều kiện | Hành động |
|---|---|
| `place_id` null/empty | Vẫn insert nếu có tên; dedupe theo name+address soft (ghi `POSSIBLE_DUPLICATE` nếu nghi) |
| `place_id` đã tồn tại trong **cùng project** | **Skip insert** (không tạo dòng mới); tăng `stats.skipped_place_id` |
| Trùng phone / CRM customer / blacklist | **Vẫn insert**; readiness = `DUPLICATE_OR_BLACKLIST` (không silent-drop) |

`target_count` đổi ý nghĩa: **không** cắt insert sớm theo “pending”. Optional: soft cap `scan_cap` cho số place discover; mặc định giữ scan_cap hiện có.

`result_count` job = **số dòng raw đã insert** (tổng vào DB), không chỉ pending. Stats bổ sung: `ready_to_push`, `needs_review`, `missing_contact`, `duplicate_or_blacklist`, `skipped_place_id`.

---

## 4. Schema thay đổi (ALTER, không tạo bảng mới)

### 4.1. `crm_research_raw_leads`

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `readiness_status` | TEXT NOT NULL DEFAULT `'NEEDS_REVIEW'` | RSR readiness code |
| `readiness_reason_codes` | TEXT[] / JSONB | Mã lý do FR-READINESS-002 |
| `phone_raw` | TEXT | Giữ bản Places gốc (optional; có thể map từ `phone` hiện có) |
| `website_url` | — | Dùng `website` hiện có |
| `facebook_url` | — | Dùng `fanpage_url` hiện có |
| `normalized_name` | — | Dùng / đồng bộ `company_name_norm` |
| `processing_status` | TEXT | `imported` \| `normalized` \| `classified` \| `pushed` (optional MVP: derive từ status) |

Giữ `status` workflow hiện có (`pending` / `accepted` / `rejected` / `auto_rejected` / `pushed`) **song song** readiness:

| readiness_status | status mặc định sau classify |
|---|---|
| READY_TO_PUSH | `pending` |
| NEEDS_REVIEW | `pending` |
| MISSING_CONTACT | `pending` (vẫn xem được trên tab; không auto_rejected) |
| DUPLICATE_OR_BLACKLIST | `auto_rejected` **hoặc** `pending` + tab riêng — **MVP: `pending` + readiness tab**, tránh lẫn “gate reject” cũ |

**Quyết định MVP:** Sau classify, **không** dùng `auto_rejected` cho thiếu SĐT. Mọi record insert đều `status=pending` trừ khi staff reject / push. `classification` legacy map:

| readiness | classification (legacy UI) |
|---|---|
| READY_TO_PUSH | `pass` |
| NEEDS_REVIEW | `needs_review` |
| MISSING_CONTACT | `needs_review` hoặc code mới `missing_contact` |
| DUPLICATE_OR_BLACKLIST | `rejected_blacklist` / `rejected_dedupe` |

Index: `(project_id, readiness_status)`, unique partial `(project_id, place_id) WHERE place_id IS NOT NULL`.

### 4.2. Job config (UI + API)

Mở rộng form / payload tạo job:

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `mode` | yes | `intent` (Places) chính cho MVP này |
| `industry_key` / label | yes | |
| `province_code` / name | yes | HCM → grid quận |
| `ward_*` | no | Nếu set → 1 query, không grid |
| `scan_cap` | yes | Max place discover (default 500) |
| `target_count` | no | Deprecated cho “cắt pending”; giữ tương thích API, UI ghi chú “không giới hạn insert” |
| `notes` | no | |
| Flags | | `enrich_place_details=true`, `classify_readiness=true` |

Jobs gần đây: giữ pagination 3/trang; hiển thị stats readiness.

---

## 5. Chuẩn hoá (FR-DQ) — MVP

Áp dụng ngay sau insert (cùng worker hoặc bước classify):

| Field | Rule |
|---|---|
| Phone | Strip non-digit; VN `0xxxxxxxxx` / `84…` → `0…`; lưu `phone` + `phone_norm` |
| Website | Strip tracking; tách FB/IG → `fanpage_url`, clear `website` nếu chỉ social |
| Facebook | Normalize URL; lưu `fanpage_url` |
| Company name | `company_name_norm` (lowercase, bỏ dấu, bỏ suffix phổ biến tối thiểu) |
| Address | Giữ raw; parse province hint từ job nếu thiếu |

Contact validation tối thiểu:

- `phone_valid` = `phone_norm` length ≥ 9–10 và không sequential/denylist pattern.
- `email_valid` = syntax OK (nếu có).
- `contact_path_valid` = phone_valid OR email_valid OR (website công ty hợp lệ, không denylist-only).

---

## 6. Lead Readiness (FR-READINESS) — rule MVP

Pseudo (rút gọn RSR cho Places batch):

```text
IF blacklist_hit OR dnc
 OR (existing CRM customer by phone_norm)
 OR (duplicate_confidence high: same place_id already in project — không insert)
 OR (duplicate phone_norm đã có raw lead khác trong project với readiness READY/NEEDS)
THEN DUPLICATE_OR_BLACKLIST

ELSE IF NOT phone_valid AND NOT email_valid AND NOT contact_path_valid
THEN MISSING_CONTACT

ELSE IF phone_valid
 AND industry/vertical từ job có
 AND province/territory từ job có
 AND quality_score >= 35   -- configured_minimum MVP
THEN READY_TO_PUSH

ELSE NEEDS_REVIEW
  -- có SĐT yếu / chỉ FB / không website / score thấp / data mơ hồ
```

### Reason codes (persist)

| Status | Ví dụ reason |
|---|---|
| READY_TO_PUSH | `VALID_PHONE`, `DATA_CONFIDENCE_OK` |
| NEEDS_REVIEW | `NO_WEBSITE`, `SOCIAL_ONLY`, `LOW_SCORE`, `WEAK_DATA` |
| MISSING_CONTACT | `MISSING_PHONE`, `INVALID_PHONE`, `NO_VALID_CONTACT_PATH` |
| DUPLICATE_OR_BLACKLIST | `EXISTING_CUSTOMER`, `DNC`, `DUPLICATE_PHONE`, `BLACKLIST` |

Reclassify (FR-READINESS-003) MVP: PATCH lead đổi `readiness_status` + reason + actor; không cho DNC → READY nếu không có override (stub: chỉ staff có cap research edit).

---

## 7. UI — Lead thô theo tab

### 7.1. Tabs (đếm theo project, filter API)

| Tab key | Nhãn | Filter |
|---|---|---|
| `READY_TO_PUSH` | Sẵn sàng push | readiness_status= |
| `NEEDS_REVIEW` | Cần review | |
| `MISSING_CONTACT` | Thiếu liên hệ | |
| `DUPLICATE_OR_BLACKLIST` | Trùng / blacklist | |
| `ALL` | Tất cả | không filter readiness |

Badge count trên mỗi tab (API `GET .../raw-leads/readiness-counts` hoặc aggregate trong list).

### 7.2. Hành động theo tab

| Tab | Hành động chính |
|---|---|
| Sẵn sàng push | Multi-select → Push CRM / Accept |
| Cần review | Accept → (tùy chọn) chuyển READY; hoặc Reject |
| Thiếu liên hệ | Enrich note / Reject; **không** Push CRM mặc định |
| Trùng / blacklist | Xem lý do; không Push |
| Tất cả | Đọc + filter phụ |

Push CRM: chỉ cho phép selection thuộc `READY_TO_PUSH` (hoặc `NEEDS_REVIEW` nếu đã Accept và staff override — **MVP: chỉ READY_TO_PUSH**).

### 7.3. Job form

- Section “Cấu hình Places”: ngành, tỉnh, phường (optional), scan_cap, notes.
- Helper text: “Insert mọi place (trừ trùng place_id); phân loại readiness sau khi lưu.”
- Toast job xong: `Job #N xong — {inserted} lead thô · Ready {a} · Review {b} · Thiếu LH {c} · Trùng {d}`.

### 7.4. Jobs gần đây

Giữ 3 job/trang; cột kết quả hiện insert + breakdown readiness ngắn.

---

## 8. API

| Endpoint | Thay đổi |
|---|---|
| `POST .../raw-lead-harvest` | Job config mở rộng; Intent worker insert-all |
| `GET .../raw-leads?readiness_status=` | Filter mới |
| `GET .../raw-leads/readiness-counts` | `{ READY_TO_PUSH: n, ... }` |
| `PATCH .../raw-leads/:id` | Cho phép `readiness_status` + reason |
| `POST .../raw-leads/push-crm` | Validate readiness ∈ {READY_TO_PUSH} |

---

## 9. Worker Intent — diff hành vi

**Trước:** filter CRM/blacklist/intent/gate → nhiều skip; `auto_rejected`; `result_count` = pending.

**Sau:**

1. Discover Places (grid + details + retry contact).
2. Skip insert chỉ khi `place_id` đã có trong project.
3. Insert mọi candidate còn lại (`status=pending`).
4. Normalize + classify → set `readiness_*` + `classification` map.
5. Không `continue` vì thiếu website / intent score thấp — những case đó thành `NEEDS_REVIEW` / `MISSING_CONTACT`.

Blacklist/CRM dup: vẫn insert + `DUPLICATE_OR_BLACKLIST` (để audit / tab).

---

## 10. Test plan

- Unit: readiness classifier (matrix phone/FB/blacklist/CRM).
- Unit: place_id unique skip.
- Unit: FB → fanpage, maps URL không BR-Q4 cứng reject khi đã có phone (classify path).
- API: list filter readiness + counts.
- UI: tabs + push chỉ READY.
- Manual VPS: job spa HCM → Vynami Spa vào tab Ready hoặc Review kèm SĐT/FB; không biến mất vì gate.

---

## 11. Rollout

1. DDL ALTER + deploy API.
2. Deploy ops-web tabs.
3. Job mới dùng pipeline mới; job cũ giữ classification legacy (readiness null → hiện tab Tất cả / map `NEEDS_REVIEW`).
4. Optional backfill: script classify lại job gần nhất.

---

## 12. Open points (chốt khi implement nếu PO không phản hồi)

| # | Mặc định |
|---|---|
| `quality_score` minimum READY | **35** |
| Push từ NEEDS_REVIEW | **Không** (chỉ READY) |
| Trùng phone trong project | DUPLICATE_OR_BLACKLIST, vẫn giữ 1 dòng |
| Unique DB `(project_id, place_id)` | **Có** (partial unique index) |

---

## 13. Approval

- [x] Hướng 1 đã chọn (PO)
- [ ] Spec này duyệt → tạo implementation plan → code

**Xin PO xác nhận spec** (OK / chỉnh mục …) trước khi viết plan và implement.
