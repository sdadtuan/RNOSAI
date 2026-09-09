# Design: Thông tin khách trên Lead cho Báo giá (chưa AM 360)

**Ngày:** 2026-09-09  
**Trạng thái:** Đã triển khai (wave 1)  
**Document ID:** QT-LEAD-PARTY-20260909  
**Branch dự kiến:** `feat/quotation-os`  
**Sửa:** [QT-20260908](./2026-09-08-quotation-os-srs.md) §6.2 NEW-01, header bắt buộc trước *gửi khách*  
**Khớp:** [Pre-sales trên Lead](./2026-07-02-lead-presales-then-lifecycle-design.md) — chưa ký HĐ thì chưa có hồ sơ khách AM; [WS2 promote Agency Client](./2026-08-29-lifecycle-ws2-promote-agency-client-design.md) — copy party → client lúc HĐ active

**Quyết định sản phẩm**

1. Báo giá new business **không** bắt tạo `/crm/account-management/clients/new`.  
2. **Không** gộp module Proposals vào Account Management.  
3. Tên công ty + liên hệ + logo khách là **`lead_party` trên Lead**. `agency_client_id` chỉ khi khách đã có trong sổ AM 360 (upsell/renewal) hoặc sau promote HĐ.

---

## 1. Vấn đề

Form NEW-01 bắt **Khách (AM 360)**. Lead new business (ví dụ LD-5) thường chưa có `agency_client_id`. Sales phải tạo account trước khi báo giá → khách ảo trong AM, lệch SoT “không tạo khách ma”, lẫn presales với after-sales.

Báo giá gửi khách vẫn cần header ấn tượng: **tên công ty (bắt buộc)**, địa chỉ, SĐT, email, logo. Thông tin đó phải xem lại khi mở Lead.

---

## 2. Phạm vi

| Trong scope | Ngoài scope |
|---|---|
| Schema + API `lead_party` trên Lead | Tạo / merge AM 360 từ form báo giá |
| NEW-01: nguồn Lead không bắt `agency_client_id` | Gộp `/crm/proposals` vào `/crm/account-management` |
| Card thông tin khách trên NEW-01 + chi tiết Lead | Đổi catalog / line / approval / OTP |
| Gate **gửi / publish / share** theo §4 | Gate **tạo nháp** (vẫn chỉ cần lead + title) |
| Snapshot party vào version lúc gửi | Portal tự sửa party |
| Prefill từ cột lead + `meta_json` / LMP / intake | OCR logo, brand kit CP |

---

## 3. Mô hình dữ liệu

### 3.1. Lead (nguồn sự thật khi draft)

Thêm cột trên `crm_leads` (OLTP đang dùng — cùng bảng API lead đọc/ghi):

| Cột | Type | Ý nghĩa |
|---|---|---|
| `company_name` | TEXT NOT NULL DEFAULT '' | Tên đơn vị trên báo giá. **Khác** `full_name` (người liên hệ). |
| `company_address` | TEXT NOT NULL DEFAULT '' | Địa chỉ in header PDF |
| `logo_asset_id` | TEXT NULL | File đã ingest (lead attachment / ops upload). Không dán URL tùy ý trên PDF. |

`phone` và `email` **giữ cột hiện có** — vừa liên hệ lead vừa header báo giá. Không thêm cột SĐT/email công ty riêng ở wave này.

Index: `idx_crm_leads_company_name` (trigram hoặc `lower(company_name)`) chỉ khi search sau này; wave 1 không bắt buộc.

Backfill:

1. `company_name` ← `meta_json.company_name` / `meta_json.company` / LMP `lead_identity.company_name` / intake `company_name` (thứ tự: cột rỗng thì copy lần đầu).  
2. `phone` / `email` đã có thì giữ.  
3. `company_address` / `logo_asset_id` mặc định rỗng.

### 3.2. Snapshot trên báo giá (bất biến sau gửi)

Khi **gửi khách** (publish / share token), copy `lead_party` vào `crm_quote_versions.party_json`:

```json
{
  "company_name": "360 Auto Detailing",
  "contact_name": "Tuan Truong",
  "address": "…",
  "phone": "…",
  "email": "…",
  "logo_asset_id": "…"
}
```

PDF / portal đọc snapshot, **không** đọc live lead. Sửa lead sau khi gửi không đổi bản đã gửi; bản draft / revision mới lấy party hiện tại.

`crm_proposals.agency_client_id` **nullable**. Nguồn Lead: được NULL. Nguồn AM 360: bắt buộc UUID đã có trong sổ.

---

## 4. Quy tắc nghiệp vụ

### 4.1. Tạo nháp (NEW-01)

| Nguồn | Bắt buộc submit nháp |
|---|---|
| Lead | `lead_id` + `title` |
| AM 360 | `agency_client_id` + `title` |
| Trống | `title` + (chọn Lead **hoặc** AM 360) — không invent client |

Submit nháp **ghi** `lead_party` nếu user sửa card (PATCH lead trong cùng request tạo quote, một transaction).

### 4.2. Gửi / publish / share (chặn)

Chặn nếu thiếu:

1. `company_name` trim ≥ 2 ký tự.  
2. **Ít nhất một** trong `phone` hoặc `email` (trim, email có `@`).

`company_address` và logo: **không chặn**. UI ghi “nên có trên PDF”. Thiếu thì PDF để `—` / không in logo.

Thông báo lỗi tiếng Việt, ví dụ: `Nhập tên công ty trước khi gửi báo giá.` / `Cần SĐT hoặc email trên Lead để gửi báo giá.`

### 4.3. Không làm

- Không POST `createAmAccount` từ NEW-01.  
- Không redirect `/crm/account-management/clients/new`.  
- Không bắt dán UUID.  
- Không dùng `full_name` làm `company_name` tự động nếu `full_name` là tên người (LD-5 · Tuan Truong). Prefill công ty chỉ từ nguồn công ty (§3.1).

### 4.4. Promote sau HĐ (wave sau, khóa hướng)

WS2: khi HĐ `active`, tạo Agency Client từ `company_name` + contact + address + logo. Gắn `lead.agency_client_id`. Wave này **chỉ** ghi chú; không implement promote.

---

## 5. UI

### 5.1. NEW-01 — card «Thông tin khách (trên Lead)»

Thay bắt buộc select AM 360 khi nguồn = Lead.

| Field | Control | Required gửi |
|---|---|---|
| Tên công ty / đơn vị | text | Có |
| Người liên hệ | read-only `full_name` | — |
| Địa chỉ | textarea 2 dòng | Không |
| Số điện thoại | text, bind `lead.phone` | Một trong SĐT/email |
| Email | email, bind `lead.email` | Một trong SĐT/email |
| Logo | upload 1 file (PNG/JPEG/WebP, ≤ 2 MB) | Không |

Select **Khách (AM 360)** vẫn hiện, optional: “Đã có trên AM 360 (upsell)”. Hint: không tạo khách mới tại đây.

Cột prefill bên phải: Khách = `company_name` hoặc `—` (không còn “Khách đã chọn” UUID).

### 5.2. Chi tiết Lead `/crm/leads/{id}`

Block **Thông tin khách** (dưới hero hoặc property rail):

- Hiển thị đủ 5 field + người liên hệ.  
- Logo thumbnail nếu có.  
- AM / Sales có `crm_leads.edit` được sửa tại chỗ (cùng PATCH `lead_party`).  
- Link «Mở báo giá» nếu đã có proposal theo `lead_id`.  
- Không link AM 360 trừ khi `agency_client_id` đã set.

### 5.3. Builder / PDF header

Header khách: snapshot `party_json` nếu version đã gửi; không thì live `lead_party`. Logo từ `logo_asset_id` qua URL nội bộ đã auth, không hotlink ngoài.

---

## 6. API

| Method | Path | Việc |
|---|---|---|
| GET | `/api/v1/leads/:id` | Thêm `company_name`, `company_address`, `logo_asset_id` (cùng `phone`, `email`, `full_name`) |
| PATCH | `/api/v1/leads/:id` | Cho phép 3 field mới + phone/email. Cap `crm_leads.edit` |
| POST | `/api/v1/leads/:id/party-logo` | Multipart; trả `logo_asset_id`. MIME allowlist. |
| DELETE | `/api/v1/leads/:id/party-logo` | Gỡ logo |
| POST | tạo quote (NEW-01) | `agency_client_id` optional nếu `source=lead` + `lead_id` |
| POST | publish / share | Validate §4.2 trên **lead hiện tại**, rồi ghi `party_json` |

List leads (`GET /api/v1/leads`) trả `company_name` để NEW-01 prefill không cần GET từng lead khi đã có trong list; nếu list chưa có thì NEW-01 GET `:id`.

---

## 7. Acceptance

| ID | Tiêu chí |
|---|---|
| AC-LP-01 | Lead không `agency_client_id` + nguồn Lead + title → tạo nháp **thành công**. |
| AC-LP-02 | Cùng lead, thiếu `company_name` → publish/share **4xx** + message VI. |
| AC-LP-03 | Có `company_name`, thiếu cả phone và email → publish/share **4xx**. |
| AC-LP-04 | Có công ty + phone, không địa chỉ/logo → gửi được; PDF không crash. |
| AC-LP-05 | Sửa card NEW-01 → GET lead thấy cùng giá trị. |
| AC-LP-06 | Chi tiết Lead hiện block Thông tin khách (công ty, địa chỉ, SĐT, email, logo). |
| AC-LP-07 | Gửi xong, đổi `company_name` trên lead → PDF/share cũ **không** đổi. |
| AC-LP-08 | NEW-01 nguồn Lead **không** có input UUID `agency_client_id`. |
| AC-LP-09 | Không gọi `POST /api/crm/am/accounts` trên happy path Lead → nháp. |

---

## 8. Test

- Unit: validate send gate; prefill order `company_name`; không map `full_name` → company.  
- Unit NEW-01: `buildQuoteCreateRequest` nguồn lead không gửi `agency_client_id` nếu trống.  
- API: PATCH party + upload logo allowlist.  
- E2E (qt): tạo nháp từ `?lead_id=` không client; chặn share khi thiếu công ty.

---

## 9. Sửa QT OS SRS (delta)

[2026-09-08-quotation-os-srs.md](./2026-09-08-quotation-os-srs.md):

- §6.2: `agency_client_id` **không** bắt buộc khi nguồn Lead; bắt buộc khi nguồn AM 360.  
- Header bắt buộc trước **gửi khách** (không phải trước tạo nháp): `company_name` + (phone hoặc email) từ Lead party.  
- AC-NEW-01 / AC-01: bỏ điều kiện “Lead có client”; thay “Lead có `lead_id` + title → Draft”.  
- Nguyên tắc “không tạo khách ma” giữ nguyên.

---

## 10. Rollout

1. DDL cột + backfill `company_name`.  
2. API GET/PATCH + upload logo.  
3. NEW-01 + Lead detail UI.  
4. Publish/share gate + `party_json`.  
5. PDF header đọc snapshot.

Flag không cần: hành vi mới thay NEW-01 nguồn Lead. Rollback = revert PR (cột DEFAULT '' an toàn).
