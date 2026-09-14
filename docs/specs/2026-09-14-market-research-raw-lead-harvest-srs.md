# SRS — Market Research: AI Raw Lead Harvest (Lead thô)

| Thuộc tính | Giá trị |
|------------|---------|
| **Sản phẩm** | RNOSAI / PTT Agency Operating System |
| **Phân hệ** | Market Research OS (`/crm/research`) |
| **Mã tính năng** | RES-UC-120 — Raw Lead Harvest |
| **Phiên bản** | 1.5 |
| **Ngày** | 2026-09-14 |
| **Trạng thái** | Draft for Review |
| **Yêu cầu gốc** | AM/researcher chọn ngành nghề + vị trí + thành phố → gọi AI (GPT / Perplexity) → lấy tên công ty, địa chỉ, SĐT, email → đẩy vào danh sách lead thô trong dự án nghiên cứu |
| **Ràng buộc** | **Ngành nghề**, **địa bàn**, **nguồn/kênh**, **Provider + Model + API token** lấy từ **Admin** (CRUD), không hard-code |
| **North star** | **Lead thật – liên hệ được – khớp ICP** để AM chốt khách; **không tối ưu số lượng ảo** |

---

## 0. Định vị sản phẩm — “Không ảo, đủ để gọi”

### 0.1. Mục tiêu đo được

| KPI | Định nghĩa | Mục tiêu vận hành |
|-----|------------|-------------------|
| **Contactable rate** | % dòng `accepted` có ≥1 kênh liên hệ **đã verify** (SĐT hoặc email pass gate) | ≥ 70% sau human accept |
| **Evidence rate** | % dòng có `evidence_url` mở được + khớp tên công ty | ≥ 90% dòng không bị auto-reject |
| **Hallucination reject rate** | % dòng AI trả về bị hệ thống loại trước khi hiện AM | Theo dõi; kỳ vọng cao ở lần chạy đầu |
| **AM connect rate** (sau 7 ngày) | % lead pushed mà AM gọi/nhắn được (feedback) | Baseline → cải thiện qua feedback loop |
| **False contact rate** | % SĐT/email AM đánh dấu “sai / không liên hệ được” | ≤ 15% (cải thiện theo sprint) |

> **Nguyên tắc:** Thà trả **ít lead thật** hơn **nhiều lead bịa**. UI mặc định sort theo **Quality Score**, không theo thứ tự AI trả về.

### 0.2. Pipeline chất lượng (bắt buộc từ H3+)

```text
[1. Discover]  AI/web tìm ứng viên (tên công ty + URL gợi ý)
      │
[2. Ground]    Mỗi công ty phải có evidence_url (website / Google Maps / trang vàng / báo)
      │
[3. Extract]   Chỉ lấy SĐT/email/địa chỉ xuất hiện trên evidence hoặc nguồn đối chiếu
      │
[4. Verify]    Rule + (tuỳ chọn) second-pass AI: format VN, email domain, geo khớp tỉnh
      │
[5. Score]     Quality Score + ICP Fit Score
      │
[6. Gate]      Auto-reject nếu thiếu evidence / contact không verify / điểm thấp
      │
[7. Human]     AM/researcher accept — checklist xác minh nhanh
      │
[8. Learn]     Feedback “sai số / công ty ảo” → blacklist + chỉnh prompt
```

## 1. Mục tiêu

Cho phép staff (AM / researcher / sales support) trong **một dự án Market Research** tạo **job thu thập lead thô chất lượng** theo bộ lọc:

1. **Ngành nghề** (catalog Admin)
2. **Vị trí / chức danh đối tượng** (catalog Admin — ví dụ Giám đốc Marketing, Chủ spa…)
3. **Địa bàn** (Tỉnh/TP, tùy chọn Phường/Xã từ Admin VN Geo)
4. **Nguồn** tìm kiếm (catalog Admin `source` — nơi AI được phép/search ưu tiên)
5. **Kênh** tìm kiếm (catalog Admin `channel` — kênh bổ sung, tùy chọn multi)
6. **Provider + Model AI** (catalog Admin — chỉ hiện provider/model **enabled** và có token hợp lệ)

Hệ thống gọi **AI provider + model đã chọn** theo pipeline **Discover → Ground → Extract → Verify → Score → Gate**, rồi lưu vào **danh sách lead thô** đã lọc ảo. Nhân viên duyệt với checklist trước khi (tuỳ phase) đẩy sang CRM Leads cho AM chốt.

### 1.1. Không thuộc phạm vi v1

- Scraping hàng loạt ngoài API provider đã cấu hình (không “cào” LinkedIn/Facebook vi phạm ToS)
- Cam kết pháp lý “dữ liệu 100% đúng” — hệ thống **giảm ảo**, không bảo hiểm tuyệt đối
- Tự động gọi điện / Zalo blast
- Web Push / mobile app riêng

### 1.2. Thuộc phạm vi nâng cấp độ chính xác (v1.2–1.3)

- Bắt buộc **evidence_url** + trích dẫn ngắn
- **Verify** SĐT (format VN), email (cú pháp + domain), địa chỉ khớp tỉnh filter
- **Quality Score / ICP Fit** + auto-gate
- Chế độ harvest **Quality** (mặc định) vs **Volume** (opt-in, cảnh báo)
- Feedback AM “sai liên hệ / công ty ảo” → học lại
- (Tuỳ chọn H3b) **Cross-check 2 provider** cho top N dòng
- **(v1.3)** Pass B **fetch evidence + literal match** SĐT/email trên HTML
- **(v1.3)** `dial_outcome` sau khi AM gọi — đóng KPI false contact
- **(v1.3, opt H3c)** MST / Places làm tín hiệu pháp nhân / địa điểm
- **(v1.4)** Điều kiện search **Nguồn / Kênh** từ Admin lead-lookups
- **(v1.4)** Chọn **model AI** theo provider (không free-text)
- **(v1.5)** Admin **CRUD Provider + Model + API token** (thêm/sửa/xóa/enable-disable); secret mã hóa

## 2. Bối cảnh RNOSAI

### 2.1. Module liên quan

| Module | Vai trò |
|--------|---------|
| Market Research OS | Chủ nhà: UI job harvest + danh sách lead thô gắn `project_id` |
| Admin → VN Geo (`/admin/crm/vn-geo`) | **Nguồn địa bàn**: Tỉnh/TP, Phường/Xã |
| Admin → Data config / Lead lookups | **Ngành nghề + chức danh + nguồn + kênh** (`crm_lead_lookup_options`) |
| Admin → Research AI Providers | **Provider + Model + API token** harvest (CRUD, enable/disable) |
| CRM Leads | Đích đẩy (phase 2, optional) — `lead_flow_kind` / classification hiện có |
| Secret crypto (reuse CP pattern) | Encrypt/decrypt API token at rest — **không** trả plaintext ra FE |
| Worker (`ptt_jobs` / Nest job) | Chạy harvest bất đồng bộ; đọc credential enabled để gọi AI |

### 2.2. Nguồn Admin bắt buộc

| Tham số UI | Nguồn Admin | API / bảng hiện có | Ghi chú |
|------------|-------------|--------------------|---------|
| **Ngành nghề** | Admin catalog — **CRUD đầy đủ** | `kind = 'industry'` | Thêm / sửa / xóa (hoặc vô hiệu hóa) trong Admin |
| **Vị trí (chức danh)** | Admin catalog — **CRUD đầy đủ** | `kind = 'job_title'` | Không dùng `crm_org_positions` (chức danh **nội bộ staff**) |
| **Nguồn (search)** | Admin Lead lookups — tab **Nguồn** đã có | `kind = 'source'` | Multi-select; **≥1 bắt buộc** — AI chỉ search / ưu tiên các nguồn này |
| **Kênh (search)** | Admin Lead lookups — tab **Kênh** đã có | `kind = 'channel'` | Multi-select; **tùy chọn** — thu hẹp thêm ngữ cảnh kênh |
| **Thành phố / địa bàn** | Admin VN Geo | `GET` provinces/wards (`vn-geo-api`) | **province_code** bắt buộc; **ward_code** tùy chọn |
| **Model AI** | Admin Research AI Providers | Models `enabled=true` thuộc provider enabled + có token | Không free-text; đổi Provider → reload models |
| **API token** | Admin Research AI Providers | Credential gắn provider (encrypted) | Chỉ Admin `configure`; FE chỉ thấy mask |

> **Quy tắc:** Dropdown harvest **chỉ** load option `active/enabled = true` từ Admin. Không free-text ngành / địa bàn / nguồn / kênh / model. Có thể thêm “ghi chú ICP” free-text cho AI.

> **Ngữ nghĩa Nguồn / Kênh khi harvest:** đây là **điều kiện nơi tìm** (vd. Google Maps, Website DN, Trang vàng, Directory ngành…), không chỉ nhãn attribution CRM. Admin nên seed các option phù hợp search; khi **push CRM (H5)** có thể map nguồn/kênh đã chọn làm default lead source/channel.

### 2.3. Admin UI — quản lý Ngành nghề & Chức danh (bắt buộc)

Staff có `crm_data_config.configure` quản lý master data **trực tiếp trên Admin**, không cần deploy:

| Hành động | Ngành nghề (`industry`) | Chức danh (`job_title`) |
|-----------|-------------------------|-------------------------|
| **Thêm** | Có — `option_key` + `label` + `sort_order` | Có — tương tự |
| **Sửa** | Có — đổi `label`, `sort_order`, `active` | Có |
| **Xóa / tắt** | Có — soft: `active=false` (khuyến nghị); hard delete nếu chưa từng dùng trong harvest job | Có — cùng quy tắc |
| **Xem danh sách** | Có — filter theo kind, tìm theo label | Có |

**Vị trí màn hình (một trong hai — chọn lúc implement H0):**

1. **Mở rộng** `/admin/crm/lead-lookups` thêm 2 tab: **Ngành nghề**, **Chức danh** (bên cạnh Nguồn / Kênh), **hoặc**
2. Trang Admin riêng `/admin/crm/research-lookups` (nếu muốn tách khỏi lead source/channel).

**Khuyến nghị SRS:** phương án (1) — tái dụng API `lead-lookups` đã có, chỉ thêm kind + UI tab.

**Ràng buộc xóa:**

- Nếu `option_key` đã được snapshot trong `crm_research_raw_lead_harvest_jobs` (industry / job_title / **source** / **channel**) → **không hard-delete**; chỉ cho `active=false` (ẩn khỏi form harvest mới, giữ audit lịch sử).
- Form harvest chỉ hiện `active=true`.

### 2.4. Admin UI — Provider + Model + API token (bắt buộc v1.5)

**Đường dẫn:** `/admin/crm/research-ai-providers`  
**Nav:** Admin → CRM → Research AI Providers (cạnh Lead lookups / VN Geo)  
**Cap:** `crm_data_config.view` (xem) / `crm_data_config.configure` (thêm/sửa/xóa/enable)

Admin quản lý **không cần deploy / không cần sửa env** (env chỉ còn master encryption key + feature flag).

#### 2.4.1. Provider

| Hành động | Chi tiết |
|-----------|----------|
| **Thêm** | `code` (unique, vd. `openai`, `perplexity`, `astra`), `display_name`, `base_url`, `auth_type` (`bearer_api_key` \| `header_api_key`), `enabled` |
| **Sửa** | Đổi tên, base_url, auth header name, sort_order, ghi chú |
| **Xóa** | Soft-delete / hard-delete chỉ khi **chưa** từng dùng trong harvest job; nếu đã dùng → chỉ `enabled=false` |
| **Enable / Disable** | Toggle; disabled → **không** hiện trên form harvest; job đang chạy giữ credential snapshot |

#### 2.4.2. Model (thuộc 1 provider)

| Hành động | Chi tiết |
|-----------|----------|
| **Thêm** | `model_id` (vd. `gpt-4o`, `sonar-pro`), `label`, `recommended_for` (`quality`\|`volume`\|`extract`\|`any`), `is_default`, `sort_order`, `enabled` |
| **Sửa** | label, recommended_for, default, sort |
| **Xóa** | Soft/hard cùng quy tắc provider (đã snapshot trên job → không hard-delete) |
| **Enable / Disable** | Toggle; chỉ model `enabled` + provider `enabled` hiện trên dropdown |

**Ràng buộc:** tối đa **1** `is_default=true` trong các model enabled của cùng provider.

#### 2.4.3. API token / credential (thuộc 1 provider)

| Hành động | Chi tiết |
|-----------|----------|
| **Thêm** | `label` (vd. “Prod Perplexity”), dán `api_token` / `api_key` **một lần**; server **encrypt** lưu `secret_cipher`; FE **không** đọc lại plaintext |
| **Sửa** | Đổi label, `enabled`; **rotate token** = nhập token mới (ghi đè cipher) — không hiện token cũ |
| **Xóa** | Xóa credential; nếu là token duy nhất enabled của provider → provider coi như `configured=false` trên harvest form |
| **Enable / Disable** | Toggle; worker chỉ dùng credential `enabled=true` (ưu tiên `is_primary`, rồi mới nhất) |

**Bảo mật UI/API:**

- GET list: chỉ `token_hint` dạng `sk-…xxxx` (4 ký tự cuối) + `has_secret=true` — **cấm** trả full token.
- Audit log: ai thêm/rotate/disable token (staff_id, timestamp) — không log plaintext.
- Nút **Test connection**: gọi ping/minimal completion với model default — kết quả ok/fail trên UI.
- Pattern crypto: tái dụng `encryptProviderSecret` / CP provider-connections (cùng master key hoặc key riêng research).

#### 2.4.4. Wireframe Admin (1 trang, 3 vùng)

```text
[ Providers table ]  + Thêm provider
   code | name | base_url | enabled | #models | has_token | Test | Edit | Disable

[ Models của provider đang chọn ]
   model_id | label | default | recommended | enabled | Edit | Disable | Xóa

[ Credentials của provider đang chọn ]
   label | hint …xxxx | primary | enabled | Rotate | Disable | Xóa
   + Thêm token (modal: label + secret input type=password)
```

---

## 3. Personas & quyền

| Persona | Cap tối thiểu | Hành vi |
|---------|---------------|---------|
| Researcher / AM | `crm_research.view` + `crm_research.run` | Tạo job, xem danh sách thô, verify dòng |
| Research editor | `crm_research.edit` | Sửa/xóa dòng thô, đánh dấu reject |
| Approver (optional) | `crm_research.approve` | Duyệt batch trước khi push CRM (phase 2) |
| Admin data | `crm_data_config.configure` | CRUD ngành / chức danh / **provider / model / token** |
| Admin geo | quyền VN Geo hiện có | CRUD Tỉnh/Phường |

---

## 4. User stories (ưu tiên)

| ID | Story | Ưu tiên |
|----|-------|---------|
| US-1 | Là researcher, tôi chọn ngành + chức danh + Tỉnh/TP + **nguồn (± kênh)** rồi bấm “Thu thập AI” | P0 |
| US-2 | Tôi chọn **provider + model AI** (chỉ model trong allowlist đã cấu hình) | P0 |
| US-3 | Tôi xem từng dòng: tên công ty, địa chỉ, SĐT, email, nguồn/kênh search, model, độ tin cậy | P0 |
| US-4 | Tôi duyệt (accept) / loại (reject) từng dòng; chỉ dòng accept được giữ trong “danh sách dùng” | P0 |
| US-5 | Hệ thống không tạo trùng trong cùng project (theo tên chuẩn hóa + SĐT/email) | P0 |
| US-6 | Tôi xuất CSV danh sách đã accept | P1 |
| US-7 | Tôi đẩy các dòng đã accept sang CRM Leads (B2B) với nguồn = “research_harvest” | P2 |
| US-8 | Admin **thêm / sửa / xóa (hoặc tắt)** ngành nghề và chức danh trên Admin mà không cần deploy | P0 |
| US-9 | Tôi thấy Quality Score + lý do (có web, SĐT verify, khớp tỉnh…) để ưu tiên gọi trước | P0 |
| US-10 | Hệ thống **không hiện** dòng thiếu evidence hoặc contact rõ ràng là bịa | P0 |
| US-11 | Tôi đánh dấu “SĐT sai / email sai / công ty ảo” để lần sau ít gặp lại | P1 |
| US-12 | Tôi chọn chế độ **Quality** (mặc định) hoặc Volume khi tạo job | P1 |
| US-13 | (Tuỳ chọn) Job chạy cross-check Perplexity ↔ GPT cho top leads | P2 |
| US-14 | Tôi chọn **một hoặc nhiều Nguồn** (và tùy chọn Kênh) từ Admin để AI chỉ search đúng nơi đó | P0 |
| US-15 | Tôi đổi model (vd. `sonar-pro` / `gpt-4o`) trong danh sách Admin đã enable | P0 |
| US-16 | Là Admin, tôi **thêm / sửa / xóa / enable-disable** Provider, Model, API token trên Admin | P0 |
| US-17 | Là Admin, tôi **rotate** token mà không lộ token cũ; Test connection trước khi bật | P0 |
| US-18 | Provider/model/token bị disable → không còn trên form harvest; job cũ vẫn audit được | P0 |

---

## 5. Luồng nghiệp vụ

```text
[Admin] ngành + chức danh + nguồn + kênh + VN Geo
        │     + Provider / Model / API token (CRUD, enable)
        ▼
[Research project] tab “Lead thô”
        │  industry + job_title + province[, ward]
        │  source_keys[] (≥1) + channel_keys[] (opt)
        │  mode: quality (default) | volume
        │  provider + model (từ Admin enabled) + target_count + notes
        ▼
POST harvest job (queued)
        │  worker decrypt token enabled của provider
        ├─[1] Discover candidates (AI/web) — scoped by nguồn/kênh
        ├─[2] Ground: bắt buộc evidence_url
        ├─[3] Extract contact CHỈ từ nguồn có căn cứ
        ├─[4] Verify: phone/email/geo/domain rules
        ├─[5] Score: quality_score + icp_fit_score
        ├─[6] Gate: auto_reject / hold_for_review
        └─[7] Persist rows (pending | auto_rejected)
        ▼
UI: sort theo score → AM checklist accept/reject + feedback sai
        │
        ├─ H4: Export CSV (accepted + verified)
        └─ H5: Push CRM (chỉ accepted & contactable; stamp source/channel)
```

---

## 6. UI / UX

### 6.1. Vị trí màn hình

- Trong dự án: `/crm/research/[id]?tab=raw_leads` (tab mới **Lead thô**)
- Banner cố định: *“Đây là lead thô đã qua cửa chất lượng — vẫn cần AM xác minh trước khi hứa với khách.”*
- Flag FE: `NEXT_PUBLIC_MARKET_RESEARCH` + `NEXT_PUBLIC_RESEARCH_RAW_LEAD_HARVEST=1`

### 6.2. Form tạo job

| Field | Control | Bắt buộc | Nguồn |
|-------|---------|----------|-------|
| Ngành nghề | Select | Có | Admin `industry` |
| Vị trí / chức danh | Select | Có | Admin `job_title` |
| Tỉnh/TP | Select | Có | VN Geo provinces |
| Phường/Xã | Select | Không | VN Geo wards |
| **Nguồn (search)** | Multi-select | Có (≥1) | Admin `source` |
| **Kênh (search)** | Multi-select | Không | Admin `channel` |
| **Chế độ** | Segmented | Có | `quality` (mặc định) \| `volume` |
| **Provider** | Select | Có | Admin providers `enabled` + `configured` |
| **Model AI** | Select | Có | Admin models `enabled` của provider đó |
| Cross-check 2 provider | Toggle | Không | Chỉ hiện nếu ≥2 provider configured (H3b) |
| Số lượng mục tiêu | Number | Có | Quality: 5–25 (default 15); Volume: 5–50 |
| Ghi chú ICP cho AI | Textarea | Không | ≤ 500 ký tự (vd. “chuỗi ≥ 3 chi nhánh”) |
| Nút | “Chạy thu thập” | — | Disabled khi job `running` |

Khi chọn **Volume**: hiện cảnh báo vàng *“Chế độ Volume tăng nguy cơ lead yếu/ảo — khuyến nghị chỉ dùng để thăm dò.”*

**UX model:** khi đổi Provider → reset Model về `is_default` của provider; chỉ list model enabled. Tooltip: *“Model quyết định độ sâu web / chi phí — Quality nên dùng model web-grounded.”*  
Link Admin (nếu `crm_data_config.view`): *“Quản lý Provider / Model / Token”* → `/admin/crm/research-ai-providers`.

**UX nguồn/kênh:** placeholder *“AI chỉ tìm trong các nguồn đã chọn”*; nếu Admin chưa seed nguồn phù hợp harvest → link nhanh sang `/admin/crm/lead-lookups` (tab Nguồn).

### 6.3. Bảng danh sách lead thô

| Cột | Mô tả |
|-----|--------|
| Score | `quality_score` (badge xanh/vàng/đỏ) + tooltip lý do |
| ICP fit | `icp_fit_score` |
| Tên công ty | + link `evidence_url` |
| Địa chỉ | |
| Địa bàn filter | province/ward snapshot |
| SĐT | + icon verify pass/fail |
| Email | + icon verify pass/fail |
| Chức danh LH | |
| Evidence | URL + snippet ngắn |
| Nguồn / Kênh | snapshot keys từ job (+ `discovered_via_source` nếu AI trả) |
| Provider / Model | |
| Trạng thái | `pending` \| `accepted` \| `rejected` \| `auto_rejected` \| `pushed` |
| Thao tác | Accept (checklist) / Reject / Sửa / Feedback sai |

**Mặc định filter:** ẩn `auto_rejected`; sort `quality_score DESC`.  
**Accept checklist (modal nhanh):** ☐ Đã mở evidence · ☐ SĐT/email hợp lý · ☐ Đúng địa bàn/ngành · ☐ Không trùng khách đang phục vụ (AM tự check).

### 6.4. Prompt quyền / lỗi

- Thiếu token enabled → 503 `provider_not_configured`
- Provider/model disabled → 400 `provider_disabled` / `model_disabled`
- Model không thuộc provider hoặc không enabled → 400 `model_not_allowed`
- `source_keys` rỗng hoặc key inactive → 400 `invalid_source`
- Job xong nhưng 0 dòng sau gate → `succeeded` + `result_count=0` + message *“AI không tìm đủ nguồn có căn cứ — thử thêm nguồn/kênh, nới filter hoặc đổi model.”*
- Rate limit → backoff worker

---

## 7. API (Nest — dưới `api/v1/research`)

### 7.1. Admin lookups (mở rộng)

```
GET  /api/crm/config/lead-lookups?kind=industry|job_title|source|channel
POST /api/crm/config/lead-lookups   { kind, option_key, label, sort_order }
PATCH/DELETE như hiện có
```

Cap: `crm_data_config.view` / `configure`.

### 7.1b. Admin — Providers / Models / Tokens (v1.5)

Cap: `crm_data_config.view` (GET) / `configure` (mutating).  
**Không bao giờ** trả `api_token` plaintext.

```
# Providers
GET    /api/v1/research/admin/ai-providers
POST   /api/v1/research/admin/ai-providers
       { code, display_name, base_url, auth_type?, auth_header_name?, enabled?, sort_order?, notes? }
PATCH  /api/v1/research/admin/ai-providers/:id
       { display_name?, base_url?, auth_type?, enabled?, sort_order?, notes? }
DELETE /api/v1/research/admin/ai-providers/:id
       // 409 nếu đã dùng trong job → bắt buộc disable

# Models
GET    /api/v1/research/admin/ai-providers/:id/models
POST   /api/v1/research/admin/ai-providers/:id/models
       { model_id, label, recommended_for?, is_default?, enabled?, sort_order? }
PATCH  /api/v1/research/admin/ai-models/:modelId
DELETE /api/v1/research/admin/ai-models/:modelId

# Credentials (API token)
GET    /api/v1/research/admin/ai-providers/:id/credentials
       → [{ id, label, token_hint, is_primary, enabled, created_at, updated_at }]
POST   /api/v1/research/admin/ai-providers/:id/credentials
       { label, api_token, is_primary? }   // api_token chỉ gửi 1 lần
PATCH  /api/v1/research/admin/ai-credentials/:credId
       { label?, enabled?, is_primary?, api_token? }  // api_token có = rotate
DELETE /api/v1/research/admin/ai-credentials/:credId

# Test
POST   /api/v1/research/admin/ai-providers/:id/test
       { model_id?: string }  → { ok: boolean, latency_ms?, error? }
```

### 7.1c. Staff — danh sách dùng trên form harvest

```
GET /api/v1/research/raw-lead-harvest/providers
→ {
  providers: [
    {
      code: string,
      display_name: string,
      configured: boolean,   // enabled + ≥1 credential enabled
      default_model: string | null,
      models: [ { id: string, label: string, recommended_for?: string } ]
    }
  ]
}
```

Chỉ trả provider/model **enabled**; không lộ token.  
(Thay thế allowlist env ở v1.4 — env chỉ còn fallback optional nếu bảng trống + `PTT_RESEARCH_HARVEST_*` legacy.)

### 7.2. Harvest jobs

```
POST /api/v1/research/projects/:id/raw-lead-harvests
Body: {
  industry_key: string,
  job_title_key: string,
  province_code: string,
  ward_code?: string | null,
  source_keys: string[],
  channel_keys?: string[],
  provider: string,               // code Admin
  model: string,                  // model_id Admin enabled
  mode?: 'quality' | 'volume',
  cross_check?: boolean,
  target_count: number,
  notes?: string
}
→ { job_id, status: 'queued' }

GET  /api/v1/research/projects/:id/raw-lead-harvests
GET  /api/v1/research/projects/:id/raw-lead-harvests/:jobId
```

Cap: `crm_research.run` để tạo; `view` để đọc.

### 7.3. Raw leads

```
GET    /api/v1/research/projects/:id/raw-leads?status=&job_id=&q=&min_score=
PATCH  /api/v1/research/projects/:id/raw-leads/:leadId
       { status?, company_name?, address?, phone?, email?, contact_title?,
         feedback_code?: 'bad_phone'|'bad_email'|'fake_company'|'wrong_geo'|'other',
         feedback_note?: string,
         dial_outcome?: 'connected'|'wrong_number'|'no_answer'|'gatekeeper'|'email_bounced'|'out_of_business' }
POST   /api/v1/research/projects/:id/raw-leads/export
POST   /api/v1/research/projects/:id/raw-leads/push-crm
       // P2: chỉ nhận lead_ids có status=accepted AND contactable=true
```

### 7.4. Resolve & validate (server)

Khi tạo job, server **validate**:

- `industry_key` / `job_title_key` tồn tại + `active` trong lookups
- Mỗi `source_keys[]` tồn tại + `active` (`kind=source`); **length ≥ 1**
- Mỗi `channel_keys[]` (nếu có) tồn tại + `active` (`kind=channel`)
- `province_code` tồn tại trong VN Geo; `ward_code` (nếu có) thuộc province đó
- `provider` tồn tại, `enabled`, có ≥1 credential `enabled`
- `model` thuộc provider đó và `enabled`

Lưu **snapshot** labels + keys lúc chạy (tránh đổi tên Admin làm lệch audit):

- `sources_json`: `[{ key, label }, …]`
- `channels_json`: `[{ key, label }, …]` (có thể `[]`)
- `provider` / `model` / `provider_base_url` (string)
- `credential_id` (FK audit — không lưu plaintext token trên job)

---

## 8. Mô hình dữ liệu (DDL đề xuất)

### 8.1. `crm_research_raw_lead_harvest_jobs`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | bigserial PK | |
| tenant_id | text | |
| project_id | bigint FK | |
| industry_key / industry_label | text | snapshot |
| job_title_key / job_title_label | text | snapshot |
| province_code / province_name | text | snapshot từ VN Geo |
| ward_code / ward_name | text null | |
| sources_json | jsonb | `[{key,label}]` — điều kiện search nguồn |
| channels_json | jsonb | `[{key,label}]` — điều kiện search kênh (có thể `[]`) |
| provider | text | code Admin |
| model | text | **bắt buộc** — model_id Admin |
| provider_base_url | text null | snapshot |
| credential_id | bigint null | credential dùng lúc chạy |
| mode | text | quality \| volume |
| cross_check | boolean | default false |
| target_count | int | |
| notes | text null | |
| status | text | queued\|running\|succeeded\|failed\|cancelled |
| error_message | text null | |
| result_count | int | số dòng insert (sau gate) |
| rejected_by_gate_count | int | số dòng AI trả về bị auto_reject |
| created_by_staff_id | int | |
| created_at / started_at / finished_at | timestamptz | |

### 8.2. `crm_research_raw_leads`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | bigserial PK | |
| project_id | bigint | |
| job_id | bigint FK | |
| company_name | text | |
| company_name_norm | text | lower + strip cho dedupe |
| address | text null | |
| phone | text null | |
| phone_norm | text null | |
| email | text null | |
| contact_title | text null | |
| website | text null | |
| evidence_url | text null | **bắt buộc** để không auto_reject (mode quality) |
| evidence_snippet | text null | ≤ 280 ký tự |
| source_provider | text | openai \| perplexity |
| source_model | text | model đã chạy |
| search_source_keys | text[] null | copy từ job (audit) |
| search_channel_keys | text[] null | copy từ job |
| discovered_via_source_key | text null | AI khai báo nguồn cụ thể tìm ra (∈ source_keys job) |
| confidence | numeric null | AI self-score |
| quality_score | numeric | 0–100 hệ thống |
| icp_fit_score | numeric | 0–100 |
| verify_json | jsonb | `{ phone_ok, email_ok, geo_ok, evidence_ok, fetch, reasons[] }` |
| contactable | boolean | phone_ok OR email_ok |
| phone_kind | text null | `mobile` \| `landline` \| `unknown` |
| legal_status | text null | `verified` \| `unverified` \| `mismatch` (H3c) |
| dial_outcome | text null | connected\|wrong_number\|no_answer\|gatekeeper\|email_bounced\|out_of_business |
| dial_outcome_at | timestamptz null | |
| raw_json | jsonb | payload AI gốc |
| status | text | pending\|accepted\|rejected\|auto_rejected\|pushed |
| feedback_code | text null | |
| feedback_note | text null | |
| feedback_by_staff_id | int null | |
| crm_lead_id | bigint null | P2 |
| created_at / updated_at | timestamptz | |

**Unique gợi ý (cùng project):**  
`(project_id, phone_norm)` WHERE phone_norm IS NOT NULL;  
`(project_id, lower(email))` WHERE email IS NOT NULL;  
soft dedupe thêm theo `company_name_norm` + `province_code`.

### 8.3. Lookups

Mở rộng seed/UI Admin:

- `kind = 'industry'` — ví dụ `spa`, `bds`, `edu`, `healthcare`, …
- `kind = 'job_title'` — ví dụ `owner`, `mkt_director`, `hr_manager`, …
- `kind = 'source'` — **đã có**; seed thêm option phù hợp harvest nếu thiếu, ví dụ: `google_maps`, `company_website`, `yellow_pages`, `industry_directory`, `news`…
- `kind = 'channel'` — **đã có**; dùng thu hẹp (vd. `organic_web`, `local_listing`, `b2b_directory`…)

> Không hard-code list nguồn/kênh trong code harvest — chỉ đọc Admin.

### 8.4. Blacklist học từ feedback (H4+)

`crm_research_raw_lead_blacklist`: `tenant_id`, `kind` (`phone`\|`email`\|`company_norm`\|`domain`), `value_norm`, `reason`, `created_at` — dùng để chặn insert lần sau.

### 8.5. Admin AI config (v1.5)

#### `crm_research_ai_providers`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | bigserial PK | |
| tenant_id | text | |
| code | text | unique per tenant (`openai`, `perplexity`, `astra`…) |
| display_name | text | |
| base_url | text | OpenAI-compatible endpoint |
| auth_type | text | `bearer_api_key` \| `header_api_key` |
| auth_header_name | text null | vd. `Authorization` / `x-api-key` |
| enabled | boolean | default true |
| sort_order | int | |
| notes | text null | |
| created_at / updated_at | timestamptz | |

#### `crm_research_ai_models`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | bigserial PK | |
| provider_id | bigint FK | |
| model_id | text | id gửi lên API |
| label | text | hiện UI |
| recommended_for | text null | quality\|volume\|extract\|any |
| is_default | boolean | |
| enabled | boolean | |
| sort_order | int | |
| UNIQUE(provider_id, model_id) | | |

#### `crm_research_ai_credentials`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | bigserial PK | |
| provider_id | bigint FK | |
| label | text | |
| secret_cipher | text | encrypted — **không** log / không trả API |
| token_hint | text | 4 ký tự cuối |
| is_primary | boolean | |
| enabled | boolean | |
| created_by_staff_id / updated_by_staff_id | int | |
| created_at / updated_at | timestamptz | |

Optional audit: `crm_research_ai_credential_audit` — action `create|rotate|disable|enable|delete`, staff_id, at — **không** lưu secret.

---

## 9. AI provider & prompt contract

### 9.1. Provider + Model (từ Admin)

| Nguồn cấu hình | Mô tả |
|----------------|--------|
| Bảng Admin §8.5 | **Nguồn chính** — CRUD UI `/admin/crm/research-ai-providers` |
| Env legacy (optional) | Bootstrap/fallback nếu bảng trống: `PTT_RESEARCH_HARVEST_*` |

Master flag: `PTT_RESEARCH_RAW_LEAD_HARVEST=1`.

Worker resolve:

1. Load provider by `code` + `enabled`  
2. Load model by `model_id` + `enabled`  
3. Load credential: `is_primary` enabled → else newest enabled  
4. Decrypt `secret_cipher` in-process → gọi `base_url`  
5. Không ghi token vào job log / `raw_json`

Khuyến nghị seed: Perplexity + `sonar-pro` (quality); OpenAI-compatible + model extract.

**Quy tắc model:**

- FE chỉ chọn từ `GET .../raw-lead-harvest/providers` (enabled + configured).
- Worker gọi đúng `model` đã snapshot trên job.
- Cross-check (H3b): provider B dùng default model + primary credential của B.

### 9.2. Output schema bắt buộc (JSON)

```json
[
  {
    "company_name": "string",
    "address": "string|null",
    "phone": "string|null",
    "email": "string|null",
    "contact_title": "string|null",
    "website": "string|null",
    "evidence_url": "string",
    "evidence_snippet": "string",
    "discovered_via_source_key": "string|null",
    "confidence": 0.0,
    "field_sources": {
      "phone": "evidence_url|null",
      "email": "evidence_url|null",
      "address": "evidence_url|null"
    }
  }
]
```

**Hard rules parse:**

- Thiếu `company_name` hoặc thiếu `evidence_url` → **bỏ dòng** (mode quality).
- `phone`/`email` chỉ giữ nếu `field_sources.*` trỏ evidence (hoặc null).
- `discovered_via_source_key` nếu có phải ∈ `source_keys` của job; sai → set `null` (không reject cả dòng).
- Cấm pattern bịa phổ biến (BR-Q series).

### 9.3. Prompt input (tóm tắt)

- Thị trường VN; filter Admin: ngành, chức danh, địa bàn, **danh sách Nguồn + Kênh (labels)** + notes ICP  
- **Chỉ tìm / ưu tiên** trong các nguồn đã chọn; không bịa listing từ nguồn ngoài list (trừ khi channel/notes mở rộng rõ)  
- **Cấm bịa** SĐT/email/MST; không có trên nguồn thì `null`  
- Mỗi công ty **một URL bằng chứng** phù hợp nguồn (website / Maps / trang vàng / directory…)  
- `evidence_snippet` phải chứa tên công ty hoặc SĐT/email đã trích  
- Ghi `discovered_via_source_key` khớp một nguồn đã chọn  
- Ưu tiên doanh nghiệp còn hoạt động; loại listing rao vặt cá nhân nếu không phải DN  

### 9.4. Multi-pass (H3)

1. **Pass A — Discover:** liệt kê công ty + website/Maps URL trong địa bàn+ngành.  
2. **Pass B — Extract:** với từng URL, chỉ extract contact có mặt trên trang/nguồn.  
3. **Pass C — Critic (optional):** model thứ 2 / cùng model: “dòng nào thiếu căn cứ?” → đánh dấu drop.

---

## 9A. Quality Engine — chống ảo, phục vụ AM chốt thật

### 9A.1. Verify rules (deterministic)

| Check | Pass khi | Fail → |
|-------|----------|--------|
| **evidence_ok** | `evidence_url` https hợp lệ; host không thuộc blacklist; (best-effort) HEAD/GET 200 | auto_reject (quality) |
| **phone_ok** | Match regex VN (`0[3-9]…` / `+84…`); độ dài hợp lệ; không dãy số tuần tự `0123456789`; không trùng blacklist | contactable-=phone |
| **email_ok** | RFC-lite; domain có dấu `.`; không `example.com`/`test.com`; (opt) MX lookup | contactable-=email |
| **geo_ok** | `address` chứa tên tỉnh filter **hoặc** AI `province_match=true` có căn cứ | hạ icp_fit; quality mode có thể hold |
| **title_ok** | `contact_title` gần với `job_title_label` (fuzzy) hoặc null | chỉ ảnh hưởng ICP |
| **dedupe_ok** | Không trùng phone/email/company trong project + CRM clients (best-effort name) | skip insert |

### 9A.2. Quality Score (0–100)

Gợi ý trọng số (configurable):

| Tín hiệu | Điểm |
|----------|------|
| evidence_ok | +25 |
| phone_ok | +25 |
| email_ok | +20 |
| geo_ok | +15 |
| website cùng registrable domain với evidence | +10 |
| confidence AI ≥ 0.7 | +5 |

**Gate mode quality:** chỉ đưa vào `pending` nếu `evidence_ok` AND (`phone_ok` OR `email_ok`) AND `quality_score ≥ 50`.  
**Gate mode volume:** `evidence_ok` bắt buộc; contact có thể null → score thấp, AM tự lọc.

### 9A.3. ICP Fit Score (0–100)

Dựa trên: khớp ngành (label), chức danh, địa bàn, keywords trong `notes` xuất hiện ở snippet/address.  
AM sort phụ: `icp_fit_score` để gọi đúng đối tượng quyết định.

### 9A.4. Cross-check 2 provider (H3b)

Với top `min(10, target_count)` theo score:

- Provider B chỉ **xác nhận** “công ty có tồn tại tại địa bàn + SĐT/email khớp?” → `cross_check_json`  
- Nếu B phủ nhận mạnh → hạ score hoặc `auto_rejected`

### 9A.5. Feedback loop AM

Khi AM gửi `feedback_code`:

- `bad_phone` / `bad_email` / `fake_company` → ghi blacklist  
- Dashboard nhẹ trên tab: % feedback xấu / job (cải thiện prompt)

### 9A.6. Chặn pattern ảo (BR-Q)

| ID | Pattern |
|----|---------|
| BR-Q1 | SĐT toàn số giống nhau hoặc tuần tự → reject |
| BR-Q2 | Email `@gmail.com` mà claim “hotline công ty” + không có trên evidence → null hóa email |
| BR-Q3 | Tên công ty generic (“Công ty TNHH ABC”, “Spa Hà Nội”) không gắn brand/evidence cụ thể → reject |
| BR-Q4 | evidence_url là trang tìm kiếm (google.com/search) → reject |
| BR-Q5 | Trùng MST/SĐT khách `clients` đang active → flag `already_customer` (không push CRM) |
| BR-Q6 | `company_name` (normalize) **không xuất hiện** trong `evidence_snippet` hoặc body fetch → reject |
| BR-Q7 | SĐT/email **không literal** trong HTML/text evidence (sau Pass B fetch) → null hóa field; nếu cả hai null → không contactable |
| BR-Q8 | Email domain ≠ website/evidence domain (trừ Gmail/Yahoo cá nhân đã gắn snippet) → hạ score mạnh; mode quality ưu tiên email corporate |
| BR-Q9 | evidence host thuộc mạng xã hội cá nhân / marketplace tin rao (configurable denylist) mà không có website DN → reject hoặc volume-only |

---

## 9B. Nâng cấp độ chính xác tối đa (v1.3) — phục vụ AM chốt thật

> Mục tiêu: giảm “AI bịa contact” xuống mức vận hành được. **Pass B fetch + literal match** là bắt buộc từ H3; các mục còn lại phase H3c–H4.

### 9B.1. Grounded Extract (bắt buộc H3) — anti-hallucination cứng

```text
Pass A (AI): candidates { company_name, evidence_url }
     │
Pass B (server): GET evidence_url → plain text / HTML strip
     │            Chỉ GIỮ phone/email/address nếu chuỗi xuất hiện trong body
     │            (normalize: bỏ space, +84↔0, lowercase email)
     │
Pass C (AI critic / rules): còn thiếu căn cứ? → drop
```

| Rule | Chi tiết |
|------|----------|
| **Literal contact** | Không tin AI nếu số/email không có trong body fetch |
| **Timeout / 403** | Không fetch được → giữ candidate nhưng `contactable=false`, `verify_json.fetch=fail`; mode quality **không** đưa `pending` trừ khi có nguồn thứ 2 |
| **Robots / ToS** | Chỉ fetch URL AI/provider đã trả; timeout ngắn; user-agent CRM; không crawl sâu site |
| **Snippet sync** | Sau fetch, cập nhật `evidence_snippet` từ đoạn chứa tên công ty hoặc contact (≤ 280 ký tự) |

### 9B.2. Tín hiệu “đáng gọi” cho AM (H3+)

| Tín hiệu | Cách tính | Ảnh hưởng |
|----------|-----------|-----------|
| **Corporate email** | email domain = registrable domain của website/evidence | +quality; ưu tiên sort |
| **Hotline vs mobile** | Phân loại `phone_kind`: landline / mobile / unknown | AM ưu tiên mobile khi cần Zalo; hotline vẫn contactable |
| **Decision-maker fit** | Fuzzy `contact_title` ↔ `job_title` Admin | `icp_fit_score`; không reject nếu null |
| **Multi-source agree** | Cùng SĐT trên ≥2 URL (website + Maps) | +15 quality (H3b/H3c) |
| **Already customer** | Match phone/email/MST vs `clients` | Flag; chặn push; AM thấy “đang phục vụ” |

### 9B.3. Xác minh pháp nhân VN (tuỳ chọn H3c — flag)

| Nguồn | Dùng để | Ghi chú |
|-------|---------|---------|
| MST / tra cứu ĐKKD công khai (API hoặc provider có tool) | Xác nhận **công ty tồn tại** + địa chỉ đăng ký gần tỉnh filter | Không bắt buộc v1; khi bật: `legal_status=verified\|unverified\|mismatch` |
| Google Places / Maps place_id (nếu provider trả) | Ground địa điểm + SĐT listing | Ưu tiên khi ngành F&B / spa / cửa hàng |

**Không** hard-fail toàn bộ B2B nếu thiếu MST (nhiều DN nhỏ khó khớp); chỉ **cộng điểm** khi verified.

### 9B.4. Vòng đời sau khi AM nhận lead (H4) — đóng KPI “không ảo”

AM/researcher ghi **kết quả liên hệ** trong 7 ngày (bắt buộc trước khi đánh giá chất lượng job):

| `dial_outcome` | Nghĩa |
|----------------|--------|
| `connected` | Nghe máy / reply email — người thật |
| `wrong_number` | Sai số / thuê bao không đúng DN |
| `no_answer` | Không nghe (sau ≥3 lần / policy) |
| `gatekeeper` | Nghe nhưng chưa tới đúng người |
| `email_bounced` | Email trả về |
| `out_of_business` | Đã đóng cửa |

- `wrong_number` / `email_bounced` / `out_of_business` → blacklist + trừ vào **False contact rate** của job/provider.  
- Dashboard research: contactable rate, false contact rate, % `connected` theo ngành — để chỉnh prompt & provider.

### 9B.5. Dedupe mở rộng

| Phạm vi | Key |
|---------|-----|
| Trong project | phone_norm, email_norm, company_norm+province |
| Cross-project (cùng tenant, 90 ngày) | Cảnh báo “đã harvest ở project X” — không insert trùng mặc định (config) |
| CRM leads + clients | Flag `already_in_crm` / `already_customer` |

### 9B.6. Thứ tự ưu tiên hiển thị cho AM (sort key)

```text
1. contactable = true
2. quality_score DESC
3. icp_fit_score DESC
4. corporate_email DESC
5. dial_outcome IS NULL (chưa gọi) trước đã gọi fail
```

AM chỉ cần gọi từ trên xuống — tối đa tỉ lệ chốt trên thời gian.

### 9B.7. Những gì cố ý KHÔNG làm (tránh ảo pháp lý / ToS)

- Không scrape LinkedIn / Facebook Graph trái phép  
- Không mua DB lead lậu / không nhập CSV “triệu SĐT” không nguồn  
- Không tự động blast Zalo/SMS từ raw lead  
- Không cam kết “100% đúng” trên UI — chỉ “đã qua cửa chất lượng + cần AM xác minh”

## 10. Quy tắc nghiệp vụ (BR)

| ID | Quy tắc |
|----|---------|
| BR-1 | Chỉ chạy harvest trong project Market Research hợp lệ, chưa archived |
| BR-2 | industry / job_title / province / **source_keys** phải resolve được từ Admin tại thời điểm tạo job |
| BR-3 | Một project tối đa **1 job running** cùng lúc |
| BR-4 | Dedupe trong project trước insert |
| BR-5 | Dòng `rejected` / `auto_rejected` không vào export “danh sách dùng” mặc định |
| BR-6 | Không auto-push CRM; P2 chỉ push `accepted` AND `contactable=true` |
| BR-7 | Audit: ai tạo job, ai accept/reject/feedback, provider/**model**/mode/**sources**/channels |
| BR-8 | PII (SĐT/email): chỉ staff có cap research; không lộ portal khách |
| BR-9 | Mode **quality**: thiếu evidence hoặc không contactable → không vào `pending` |
| BR-10 | Accept bắt buộc qua checklist (UI) — server ghi `accepted_checklist_json` (optional H2+) |
| BR-11 | Feedback xấu → blacklist; lần harvest sau skip giá trị đó |
| BR-12 | Mode quality: phone/email chỉ persist nếu **literal match** sau Pass B fetch (9B.1) |
| BR-13 | Trong 7 ngày sau accept/push, AM nên ghi `dial_outcome` (9B.4); thiếu outcome hàng loạt → cảnh báo chất lượng provider |
| BR-14 | `source_keys.length ≥ 1`; mọi key active |
| BR-15 | `model` bắt buộc, thuộc provider Admin **enabled**; không free-text |
| BR-16 | API token chỉ lưu encrypted; GET Admin không bao giờ trả plaintext |
| BR-17 | Disable provider/model/credential → ẩn khỏi form harvest ngay; không phá audit job cũ |
| BR-18 | Hard-delete provider/model/credential bị chặn nếu đã tham chiếu job (`409`) — dùng disable |

---

## 11. Non-functional

| Hạng mục | Yêu cầu |
|----------|---------|
| Latency | Job async; UI poll ≤ 3s; timeout AI 90s/pass; tối đa 3 pass/job |
| Volume | Quality ≤ 25/job; Volume ≤ 50/job; ≤ 10 jobs/project/ngày |
| Cost | Log token; cross-check chỉ top N |
| Observability | `rejected_by_gate_count`, quality histogram; log `research.raw_lead_harvest` (**không** log secret) |
| Security | Token encrypted at rest; FE chỉ `token_hint`; audit rotate/disable; cap `configure` |

---

## 12. Phase triển khai đề xuất

| Phase | Deliverable |
|-------|-------------|
| **H0** | Admin CRUD ngành/chức danh; seed nguồn/kênh; **Admin Provider+Model+Token** (UI + DDL §8.5 + encrypt) |
| **H1** | DDL jobs/raw_leads; API harvest stub; `GET .../raw-lead-harvest/providers` đọc từ Admin |
| **H2** | UI tab Lead thô + form (nguồn/kênh/provider/model + mode) + bảng score + accept checklist |
| **H3** | Provider thật + multi-pass + **Pass B fetch literal contact** + verify + quality gate |
| **H3b** | Cross-check 2 provider (flag) |
| **H3c** | (Opt) MST/Places enrich; multi-source agree; corporate-email boost |
| **H4** | Export CSV + feedback/blacklist + **dial_outcome** KPI |
| **H5** | Push CRM chỉ contactable + không `already_customer` / `already_in_crm` |

---

## 13. Tiêu chí nghiệm thu

### 13.1. Core (H0–H2)

1. Admin CRUD ngành/chức danh phản ánh đúng form harvest.  
2. Province chỉ từ VN Geo.  
3. Form bắt buộc chọn **≥1 Nguồn**; Kênh optional multi.  
4. Form bắt buộc chọn **Provider + Model** từ Admin enabled + configured; model lạ / disabled → 400.  
5. Admin **thêm/sửa/xóa/enable** Provider, Model, Token; GET credentials chỉ có `token_hint`.  
6. Rotate token không lộ token cũ; Test connection trả ok/fail.  
7. Disable provider → biến mất khỏi form harvest trong ≤ poll tiếp theo.  
8. Accept/reject + sort theo score trên UI.

### 13.2. Chống ảo (H3+)

9. Job quality: dòng **không có evidence_url** không xuất hiện ở `pending`.  
10. SĐT giả kiểu `0123456789` / trùng số → không `phone_ok`.  
11. Email `@example.com` → không `email_ok`.  
12. evidence_url là `google.com/search?...` → auto_reject.  
13. Ít nhất một job mẫu: `rejected_by_gate_count ≥ 0` và `result_count` ≤ số raw AI trả về.  
14. AM gửi feedback `bad_phone` → lần sau cùng SĐT không vào list.  
15. Push CRM (H5) từ chối lead `contactable=false`.  
16. **Pass B:** AI trả SĐT không có trong HTML evidence → field bị null; không `phone_ok`.  
17. `company_name` không nằm trong snippet/body → auto_reject (BR-Q6).  
18. Ghi `dial_outcome=wrong_number` → SĐT vào blacklist.  
19. Prompt/job log chứa đúng **labels nguồn/kênh + model** đã chọn; **không** chứa API token.

---

## 14. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|------------|
| AI bịa SĐT/email | Multi-pass; field_sources; verify; gate; human checklist |
| Lộ API token | Encrypt at rest; mask FE; audit rotate; cap configure; không log secret |
| Ít lead sau gate | Message rõ; gợi ý thêm nguồn / đổi model; không nới gate quality âm thầm |
| Chi phí API | Cap count; cross-check top N; cache evidence HEAD |
| Master data ngành thiếu | H0 + seed |
| Nhầm CRM lead | Copy + status machine riêng |
| AM tin score tuyệt đối | Tooltip “điểm hỗ trợ — vẫn phải gọi thử” |

---

## 15. Thuật ngữ

| Thuật ngữ | Nghĩa |
|-----------|--------|
| Lead thô / raw lead | Prospect trong research project, chưa phải CRM lead |
| Contactable | Có SĐT hoặc email **pass verify** |
| Evidence | URL + snippet chứng minh công ty/contact |
| Quality Score | Điểm hệ thống chống ảo (0–100) |
| ICP Fit | Độ khớp ngành/chức danh/địa bàn/notes |
| Auto-rejected | Bị Quality Engine loại, không hiện mặc định cho AM |
| Harvest job | Một lần chạy thu thập |
| Vị trí | Chức danh đối tượng tìm (Admin `job_title`) |
| Nguồn (search) | Admin `source` — nơi AI được phép/ưu tiên tìm |
| Kênh (search) | Admin `channel` — thu hẹp thêm ngữ cảnh tìm |
| Model AI | `model_id` trong catalog Admin (enabled) thuộc provider |
| API token / credential | Secret gọi AI; lưu encrypted; UI chỉ hint |
| configured (provider) | Provider enabled **và** ≥1 credential enabled |

---

## 16. Phê duyệt

| Vai trò | Tên | Ngày | Ký |
|---------|-----|------|-----|
| Product Owner | | | |
| Tech lead | | | |
| Research ops / AM lead | | | |

**Changelog**

- **v1.0** — Draft SRS; Admin VN Geo + lookups industry/job_title.
- **v1.1** — Admin CRUD đầy đủ ngành nghề & chức danh; soft-delete.
- **v1.2** — Nâng cấp **Quality Engine**: north-star KPI, multi-pass, evidence bắt buộc, verify SĐT/email/geo, Quality/ICP score, gate chống ảo, feedback→blacklist, mode quality/volume, cross-check tùy chọn — phục vụ AM chốt khách thật.
- **v1.3** — **Grounded Extract (Pass B literal match)**, BR-Q6–Q9, corporate email / phone_kind, MST–Places opt, dial_outcome KPI, dedupe cross-project, sort ưu tiên AM chốt.
- **v1.4** — Điều kiện search **Nguồn / Kênh** (Admin lookups, multi-select); chọn **Model AI**; API `GET .../providers`; snapshot `sources_json` / `channels_json` / `model` trên job.
- **v1.5** — Admin **CRUD Provider + Model + API token** (`/admin/crm/research-ai-providers`): thêm/sửa/xóa/enable-disable, rotate token, test connection, encrypt at rest; DDL §8.5; thay allowlist env bằng DB.
