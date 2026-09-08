# Meta — Tạo tài sản bằng câu lệnh (Graph API)

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-09-08  
> **Đối tượng:** Tracking / IT, Media Buyer, AM  
> **Cách làm:** `curl` + Meta Graph API (không click wizard Ads Manager, trừ phần Meta **cấm API**)  
> **Bản UI từng bước:** [huong-dan-meta-setup-tai-khoan-app-form-token.md](../huong-dan-meta-setup-tai-khoan-app-form-token.md)  
> **Vận hành ads trên RNOSAI:** [05-meta-ads.md](./05-meta-ads.md)

Tài liệu này là **sổ tay câu lệnh**: tạo / gán Fanpage, Ad Account, Pixel, Lead Form, Campaign (và ad set / ad), rồi map ID + token vào RNOSAI. Mọi lệnh dùng **Graph `v21.0`** (Explorer / setup). Module nội bộ RNOSAI (`ptt_meta`) đang gọi **`v19.0`** — hai version song song được; đừng đổi `.env` Graph của server khi chỉ chạy lệnh tay.

---

## Mục lục

1. [Phạm vi: lệnh được / không được](#1-phạm-vi-lệnh-được--không-được)
2. [Chuẩn bị token & biến môi trường](#2-chuẩn-bị-token--biến-môi-trường)
3. [Facebook cá nhân & Business Portfolio](#3-facebook-cá-nhân--business-portfolio)
4. [Fanpage (Page)](#4-fanpage-page)
5. [Meta App (Developer)](#5-meta-app-developer)
6. [Ad Account](#6-ad-account)
7. [Pixel / Dataset](#7-pixel--dataset)
8. [Lead Form (Instant Form)](#8-lead-form-instant-form)
9. [Campaign → Ad set → Ad](#9-campaign--ad-set--ad)
10. [Subscribe webhook leadgen](#10-subscribe-webhook-leadgen)
11. [Map vào RNOSAI](#11-map-vào-rnosai)
12. [Cheat sheet](#12-cheat-sheet)
13. [Lỗi thường gặp](#13-lỗi-thường-gặp)

---

## 1. Phạm vi: lệnh được / không được

| Việc | Câu lệnh Graph? | Ghi chú |
|------|-----------------|--------|
| Tài khoản Facebook **cá nhân** | **Không** | Chỉ UI `facebook.com/reg` + 2FA |
| Business Portfolio mới + xác minh DN | **Không** (thực tế) | UI `business.facebook.com` |
| **Tạo** Meta App | **Không** | UI `developers.facebook.com` |
| Gán Page vào Business / lấy Page ID | **Có** | §4 |
| Tạo Ad Account | **Có** | `POST /{business-id}/adaccount` |
| Tạo Pixel | **Có** | `POST /{business-id}/owned_pixels` |
| Tạo Lead Form | **Có** | `POST /{page-id}/leadgen_forms` |
| Tạo Campaign / Ad set / Ad | **Có** | `POST /act_*/campaigns` … |
| Subscribe Page → webhook | **Có** | `POST /{page-id}/subscribed_apps` |
| **Tạo Fanpage brand mới** | **Hạn chế** | Meta đã thu hẹp API tạo Page — ưu tiên UI, rồi gán bằng lệnh |

Production campaign write trên RNOSAI **không** thay thế lệnh tay: Ads Ops (`/meta/ads-ops`) còn gate Launch QA + `PTT_META_ADS_OPS_ENABLED`. Lệnh trong file này là **setup / pilot trên Graph**, không bypass governance.

⚠️ **Không** dán token vào git, Slack, ticket. Export biến shell rồi chạy; sau phiên `unset ACCESS_TOKEN`.

---

## 2. Chuẩn bị token & biến môi trường

### 2.1. Token nào dùng lệnh nào

| Token | Lấy ở đâu | Dùng để |
|-------|-----------|---------|
| **User token** (Explorer) | [Graph API Explorer](https://developers.facebook.com/tools/explorer/) | Dev: list Page, đổi long-lived |
| **Page token** | `GET /me/accounts` | Form, subscribe webhook, fetch lead |
| **System User token** | Business → Users → System users → Generate token | Ad Account, Pixel, Campaign, insights (production) |

Quyền tối thiểu trên token (tick khi generate):

`ads_management` · `ads_read` · `business_management` · `pages_show_list` · `pages_manage_ads` · `pages_manage_metadata` · `leads_retrieval` · `pages_read_engagement`

### 2.2. Export biến (mỗi phiên terminal)

```bash
export GRAPH=https://graph.facebook.com/v21.0
export ACCESS_TOKEN='EAAx...'          # System User hoặc User long-lived
export BUSINESS_ID='123456789012345'   # Business Settings → Business info
export PAGE_ID=''                      # điền sau khi có Page
export ACT_ID=''                       # dạng act_1234567890
export PIXEL_ID=''
export FORM_ID=''
export CAMPAIGN_ID=''
```

Kiểm tra token còn sống:

```bash
curl -sS "$GRAPH/me?fields=id,name&access_token=$ACCESS_TOKEN" | python3 -m json.tool
```

Kỳ vọng HTTP 200 + `id`. Lỗi `Invalid OAuth access token` → generate lại, **đừng** sửa lệnh phía dưới.

### 2.3. Đổi User token ngắn → long-lived

```bash
export APP_ID='...'
export APP_SECRET='...'          # chỉ máy IT, không commit
export SHORT_TOKEN='...'         # token Explorer ~1–2 giờ

curl -sS -G "$GRAPH/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=$APP_ID" \
  --data-urlencode "client_secret=$APP_SECRET" \
  --data-urlencode "fb_exchange_token=$SHORT_TOKEN"
```

Lấy `access_token` trong JSON → gán lại `ACCESS_TOKEN`.

Lấy **Page token** từ User token:

```bash
curl -sS -G "$GRAPH/me/accounts" \
  --data-urlencode "fields=id,name,access_token,tasks" \
  --data-urlencode "access_token=$ACCESS_TOKEN" | python3 -m json.tool
```

Chọn Page đúng khách → `export PAGE_ID=...` và (nếu cần) `export PAGE_TOKEN='...'`.

---

## 3. Facebook cá nhân & Business Portfolio

### 3.1. Tài khoản Facebook

**Không có Graph API tạo user.** Làm trên UI:

1. https://www.facebook.com/reg/
2. Email công ty + bật **2FA** (Authenticator)
3. Tài khoản này là **admin Business** — không chia sẻ mật khẩu

### 3.2. Business Portfolio

Tạo + xác minh DN trên https://business.facebook.com (UI). Sau khi có Business ID:

```bash
# Thông tin Business
curl -sS -G "$GRAPH/$BUSINESS_ID" \
  --data-urlencode "fields=id,name,verification_status,created_time" \
  --data-urlencode "access_token=$ACCESS_TOKEN" | python3 -m json.tool

# Tài sản đang sở hữu
curl -sS -G "$GRAPH/$BUSINESS_ID/owned_pages" \
  --data-urlencode "fields=id,name" \
  --data-urlencode "access_token=$ACCESS_TOKEN"

curl -sS -G "$GRAPH/$BUSINESS_ID/owned_ad_accounts" \
  --data-urlencode "fields=id,name,account_status,currency,timezone_name" \
  --data-urlencode "access_token=$ACCESS_TOKEN"

curl -sS -G "$GRAPH/$BUSINESS_ID/owned_pixels" \
  --data-urlencode "fields=id,name" \
  --data-urlencode "access_token=$ACCESS_TOKEN"
```

---

## 4. Fanpage (Page)

### 4.1. Tạo Page mới (UI — khuyến nghị)

Meta hạn chế tạo Page brand qua API. Quy trình ổn định:

1. https://www.facebook.com/pages/creation/ — **Business or Brand**
2. Tên Page, category, mô tả → **Create Page**
3. Gán vào Business bằng lệnh §4.2

### 4.2. Gán Page đã có vào Business

Page **của mình** (owned):

```bash
curl -sS -X POST "$GRAPH/$BUSINESS_ID/owned_pages" \
  -F "page_id=$PAGE_ID" \
  -F "access_token=$ACCESS_TOKEN"
```

Page **của khách** (partner / request access) — khách duyệt trên Business:

```bash
curl -sS -X POST "$GRAPH/$BUSINESS_ID/client_pages" \
  -F "page_id=$PAGE_ID" \
  -F "permitted_tasks=['MANAGE','ADVERTISE','ANALYZE']" \
  -F "access_token=$ACCESS_TOKEN"
```

### 4.3. Đọc Page ID / kiểm tra

```bash
curl -sS -G "$GRAPH/$PAGE_ID" \
  --data-urlencode "fields=id,name,category,fan_count,access_token" \
  --data-urlencode "access_token=${PAGE_TOKEN:-$ACCESS_TOKEN}" | python3 -m json.tool
```

**Lưu RNOSAI:** `meta.facebook_page_id` = số thuần, không prefix.

---

## 5. Meta App (Developer)

**Không tạo App bằng Graph.** Làm một lần trên UI rồi dùng lệnh để đọc ID / subscribe.

### 5.1. Tạo App (UI — 1 lần / môi trường)

1. https://developers.facebook.com/ → **My Apps → Create App**
2. Use case **Other → Business** (hoặc tương đương wizard hiện tại)
3. Gắn **Business Portfolio** PTT / khách
4. Add products: **Webhooks**, **Marketing API**, **Facebook Login for Business**
5. App Review (Live): `ads_read`, `ads_management`, `leads_retrieval`, `pages_manage_ads`, `pages_show_list`, `business_management`

Chi tiết click-through: [setup UI §8](../huong-dan-meta-setup-tai-khoan-app-form-token.md#8-tạo-meta-app-developer).

### 5.2. Đọc App

```bash
export APP_ID='...'

curl -sS -G "$GRAPH/$APP_ID" \
  --data-urlencode "fields=id,name,app_type,link" \
  --data-urlencode "access_token=$APP_ID|$APP_SECRET"
```

`App Secret` chỉ nằm `.env` server: `CRM_FACEBOOK_APP_SECRET`.

### 5.3. Verify token webhook (tự sinh)

```bash
openssl rand -hex 32
# paste cùng một string vào:
#   - Meta App → Webhooks → Verify token
#   - .env → CRM_FACEBOOK_VERIFY_TOKEN
```

Callback production:

```
https://rs.pttads.vn/api/v1/webhooks/meta
```

---

## 6. Ad Account

Timezone Việt Nam trên Meta = **`timezone_id=67`** (Asia/Bangkok · GMT+7). Tiền tệ **`VND`**.

`end_advertiser` / `media_agency` / `partner` thường = `BUSINESS_ID` khi agency tự chạy.

```bash
curl -sS -X POST "$GRAPH/$BUSINESS_ID/adaccount" \
  -F "name=CLIENT_ABC_VN_2026" \
  -F "currency=VND" \
  -F "timezone_id=67" \
  -F "end_advertiser=$BUSINESS_ID" \
  -F "media_agency=$BUSINESS_ID" \
  -F "partner=$BUSINESS_ID" \
  -F "access_token=$ACCESS_TOKEN"
```

Response có `id` dạng `act_1234567890` (hoặc số — luôn chuẩn hoá prefix `act_`):

```bash
export RAW_ACT='1234567890'          # copy từ JSON
export ACT_ID="act_${RAW_ACT#act_}"

curl -sS -G "$GRAPH/$ACT_ID" \
  --data-urlencode "fields=id,name,account_status,currency,timezone_name,disable_reason" \
  --data-urlencode "access_token=$ACCESS_TOKEN" | python3 -m json.tool
```

`account_status: 1` = active. Billing (thẻ / invoice) **vẫn UI** Ads Manager → Billing.

Gán người vận hành (user Facebook ID):

```bash
export BUYER_FB_ID='...'   # Business → People → click user → User ID

curl -sS -X POST "$GRAPH/$ACT_ID/assigned_users" \
  -F "user=$BUYER_FB_ID" \
  -F "tasks=['MANAGE','ADVERTISE','ANALYZE']" \
  -F "access_token=$ACCESS_TOKEN"
```

**Lưu RNOSAI:** `channel=meta`, `external_account_id=$ACT_ID` (giữ `act_`).

---

## 7. Pixel / Dataset

```bash
curl -sS -X POST "$GRAPH/$BUSINESS_ID/owned_pixels" \
  -F "name=Pixel_CLIENT_ABC" \
  -F "access_token=$ACCESS_TOKEN"
```

```bash
export PIXEL_ID='...'   # field id trong JSON

# Gán Pixel ↔ Ad Account
curl -sS -X POST "$GRAPH/$PIXEL_ID/shared_accounts" \
  -F "account_id=${ACT_ID#act_}" \
  -F "access_token=$ACCESS_TOKEN"

# Đọc lại
curl -sS -G "$GRAPH/$PIXEL_ID" \
  --data-urlencode "fields=id,name,is_unavailable,owner_business" \
  --data-urlencode "access_token=$ACCESS_TOKEN"
```

CAPI token (nếu Events Manager không hiện Generate trên UI): dùng **cùng System User token** đã có `ads_management` — RNOSAI gửi event tại `/meta/tracking`.

**Lưu RNOSAI:** `meta.pixel_id`, `capi_enabled=1`.

---

## 8. Lead Form (Instant Form)

Cần **Page token** (`PAGE_TOKEN`) có `pages_manage_ads` + `leads_retrieval`.

Privacy policy **bắt buộc** URL https công khai (site khách hoặc pttads.vn).

```bash
curl -sS -X POST "$GRAPH/$PAGE_ID/leadgen_forms" \
  --data-urlencode "name=Lead Form ABC — 2026-09" \
  --data-urlencode "privacy_policy[url]=https://www.example.com/privacy" \
  --data-urlencode "privacy_policy[link_text]=Chính sách bảo mật" \
  --data-urlencode 'questions=[{"type":"FULL_NAME"},{"type":"PHONE"},{"type":"EMAIL"}]' \
  --data-urlencode "follow_up_action_url=https://www.example.com/cam-on" \
  --data-urlencode "access_token=$PAGE_TOKEN"
```

```bash
export FORM_ID='...'   # id trong JSON

# Liệt kê form trên Page
curl -sS -G "$GRAPH/$PAGE_ID/leadgen_forms" \
  --data-urlencode "fields=id,name,status,leads_count" \
  --data-urlencode "access_token=$PAGE_TOKEN" | python3 -m json.tool
```

`status` = `ACTIVE` mới gắn được vào ad. RNOSAI parse `full_name`, `phone_number`, `email`.

**Lưu RNOSAI:** `meta.facebook_form_id=$FORM_ID` (routing webhook multi-client).

---

## 9. Campaign → Ad set → Ad

Tạo **PAUSED**. Bật `ACTIVE` chỉ sau Launch QA trên RNOSAI (`/crm/launch-qa`) + cap `meta_ads_ops.launch`.

Objective Lead Gen hiện tại: **`OUTCOME_LEADS`** (template RNOSAI `re_lead_default`). `special_ad_categories` để `[]` trừ khi chạy housing/credit/employment.

Ngân sách daily **VND không có subunit** — gửi số nguyên (vd `500000` = 500.000 ₫).

### 9.1. Campaign

```bash
curl -sS -X POST "$GRAPH/$ACT_ID/campaigns" \
  --data-urlencode "name=ABC Lead — 2026-09 (PAUSED)" \
  --data-urlencode "objective=OUTCOME_LEADS" \
  --data-urlencode "status=PAUSED" \
  --data-urlencode "special_ad_categories=[]" \
  --data-urlencode "access_token=$ACCESS_TOKEN"
```

```bash
export CAMPAIGN_ID='...'
```

### 9.2. Ad set (Lead + Instant Form)

`promoted_object` bắt Page + form. Targeting tối thiểu 1 quốc gia. `optimization_goal=LEAD_GENERATION`.

```bash
curl -sS -X POST "$GRAPH/$ACT_ID/adsets" \
  --data-urlencode "name=ABC Lead — HN+HCM" \
  --data-urlencode "campaign_id=$CAMPAIGN_ID" \
  --data-urlencode "daily_budget=500000" \
  --data-urlencode "billing_event=IMPRESSIONS" \
  --data-urlencode "optimization_goal=LEAD_GENERATION" \
  --data-urlencode "bid_strategy=LOWEST_COST_WITHOUT_CAP" \
  --data-urlencode "status=PAUSED" \
  --data-urlencode "targeting={\"geo_locations\":{\"countries\":[\"VN\"]},\"age_min\":25,\"age_max\":55}" \
  --data-urlencode "promoted_object={\"page_id\":\"$PAGE_ID\"}" \
  --data-urlencode "destination_type=ON_AD" \
  --data-urlencode "access_token=$ACCESS_TOKEN"
```

```bash
export ADSET_ID='...'
```

> Nếu Graph trả `promoted_object` thiếu field: thêm `"lead_gen_form_id":"$FORM_ID"` vào JSON `promoted_object` (tùy version / objective).

### 9.3. Creative + Ad

Cần ảnh đã upload (`image_hash`) **hoặc** `object_story_spec` link. Upload ảnh Page:

```bash
curl -sS -X POST "$GRAPH/$PAGE_ID/photos" \
  -F "url=https://www.example.com/creative-1200x628.jpg" \
  -F "published=false" \
  -F "access_token=$PAGE_TOKEN"
# → export IMAGE_HASH / PHOTO_ID từ JSON
```

Ad dùng Instant Form (lead card). Thay `IMAGE_HASH` và copy:

```bash
curl -sS -X POST "$GRAPH/$ACT_ID/ads" \
  --data-urlencode "name=ABC Lead — creative 01" \
  --data-urlencode "adset_id=$ADSET_ID" \
  --data-urlencode "status=PAUSED" \
  --data-urlencode "creative={\"object_story_spec\":{\"page_id\":\"$PAGE_ID\",\"link_data\":{\"link\":\"https://fb.me/\",\"message\":\"Để lại SĐT nhận tư vấn\",\"name\":\"Đăng ký tư vấn\",\"call_to_action\":{\"type\":\"SIGN_UP\",\"value\":{\"lead_gen_form_id\":\"$FORM_ID\"}},\"image_hash\":\"$IMAGE_HASH\"}}}" \
  --data-urlencode "access_token=$ACCESS_TOKEN"
```

```bash
export AD_ID='...'
```

### 9.4. Đọc / pause / (cẩn thận) bật

```bash
# Đọc campaign
curl -sS -G "$GRAPH/$CAMPAIGN_ID" \
  --data-urlencode "fields=id,name,status,objective,daily_budget" \
  --data-urlencode "access_token=$ACCESS_TOKEN"

# Pause
curl -sS -X POST "$GRAPH/$CAMPAIGN_ID" \
  --data-urlencode "status=PAUSED" \
  --data-urlencode "access_token=$ACCESS_TOKEN"

# Chỉ ACTIVE khi Launch QA passed — lệnh này tốn tiền thật
# curl -sS -X POST "$GRAPH/$CAMPAIGN_ID" \
#   --data-urlencode "status=ACTIVE" \
#   --data-urlencode "access_token=$ACCESS_TOKEN"
```

Đổi budget daily (cùng cách RNOSAI `campaign_write.apply_daily_budget`):

```bash
curl -sS -X POST "$GRAPH/$CAMPAIGN_ID" \
  --data-urlencode "daily_budget=700000" \
  --data-urlencode "access_token=$ACCESS_TOKEN"
```

---

## 10. Subscribe webhook leadgen

App đã Verify URL + `CRM_FACEBOOK_VERIFY_TOKEN` khớp (§5.3).

```bash
# Page nhận lead → App
curl -sS -X POST "$GRAPH/$PAGE_ID/subscribed_apps" \
  --data-urlencode "subscribed_fields=leadgen" \
  --data-urlencode "access_token=$PAGE_TOKEN"

# Kiểm tra
curl -sS -G "$GRAPH/$PAGE_ID/subscribed_apps" \
  --data-urlencode "access_token=$PAGE_TOKEN" | python3 -m json.tool
```

Test: Meta App → Webhooks → **Test** field `leadgen`, hoặc submit form test. Lead phải vào `/crm/leads` (source facebook) trong ~1 phút.

---

## 11. Map vào RNOSAI

### 11.1. UI

`/agency/clients/[id]?tab=channels` → **+ Thêm kênh Meta**

| Field | Biến lệnh |
|-------|-----------|
| Ad Account ID | `$ACT_ID` |
| Access Token | System User token |
| Pixel ID | `$PIXEL_ID` |
| Facebook Page ID | `$PAGE_ID` |
| Form ID | `$FORM_ID` |

### 11.2. CLI seed (staging)

```bash
export CLIENT_CODE=DEMO
export META_AD_ACCOUNT_ID="$ACT_ID"
export META_ACCESS_TOKEN="$ACCESS_TOKEN"
export META_PIXEL_ID="$PIXEL_ID"
export TOKEN_EXPIRES=2026-12-31
# PTT_TOKEN_VAULT_KEY + DATABASE_URL đã có trong .env
./scripts/seed_meta_channel_account.py
```

### 11.3. Verify từ máy IT

```bash
curl -sS -G "$GRAPH/$ACT_ID" \
  --data-urlencode "fields=name,account_status" \
  --data-urlencode "access_token=$ACCESS_TOKEN"
```

Kỳ vọng `account_status: 1`. Hub T+1: `/meta/facebook-ads`.

---

## 12. Cheat sheet

```bash
# --- đọc ---
curl -sS -G "$GRAPH/me" --data-urlencode "access_token=$ACCESS_TOKEN"
curl -sS -G "$GRAPH/me/accounts" --data-urlencode "access_token=$ACCESS_TOKEN"
curl -sS -G "$GRAPH/$BUSINESS_ID/owned_ad_accounts" --data-urlencode "access_token=$ACCESS_TOKEN"
curl -sS -G "$GRAPH/$PAGE_ID/leadgen_forms" --data-urlencode "access_token=$PAGE_TOKEN"
curl -sS -G "$GRAPH/$ACT_ID/campaigns" \
  --data-urlencode "fields=id,name,status,objective" \
  --data-urlencode "access_token=$ACCESS_TOKEN"

# --- tạo ---
# Ad Account     POST $GRAPH/$BUSINESS_ID/adaccount
# Pixel          POST $GRAPH/$BUSINESS_ID/owned_pixels
# Lead Form      POST $GRAPH/$PAGE_ID/leadgen_forms
# Campaign       POST $GRAPH/$ACT_ID/campaigns
# Ad set         POST $GRAPH/$ACT_ID/adsets
# Ad             POST $GRAPH/$ACT_ID/ads
# Webhook Page   POST $GRAPH/$PAGE_ID/subscribed_apps
```

Thứ tự khuyến nghị:

```
FB cá nhân + 2FA (UI)
  → Business + verify (UI)
  → App + Review (UI)
  → System User token
  → Page (UI tạo) → owned_pages
  → adaccount → owned_pixels → leadgen_forms
  → campaigns / adsets / ads (PAUSED)
  → subscribed_apps
  → seed / map RNOSAI
  → Launch QA → ACTIVE
```

---

## 13. Lỗi thường gặp

| Graph / triệu chứng | Nguyên nhân | Xử lý |
|---------------------|-------------|--------|
| `(#200) Permissions error` | Token thiếu scope hoặc App Development mode | Generate lại token; App **Live** + Review |
| `(#100) Invalid parameter` | Thiếu `special_ad_categories`, timezone, hoặc JSON targeting lệch | So JSON với lệnh mẫu; escape quote trong `--data-urlencode` |
| `Unsupported post request` trên `/owned_pages` | Page chưa phải asset của user / sai Business | Admin Page chấp nhận; đúng `BUSINESS_ID` |
| Tạo Page bằng API fail | Meta đã đóng create Page public | Tạo UI rồi `POST .../owned_pages` |
| Form tạo xong `DRAFT` | Thiếu privacy / question | Thêm `privacy_policy` + `FULL_NAME`/`PHONE` |
| Campaign ACTIVE ngoài ý muốn | Quên `status=PAUSED` | Pause ngay `POST /$CAMPAIGN_ID status=PAUSED` |
| Lead webhook 200 nhưng CRM trống | Thiếu `leads_retrieval` hoặc sai `facebook_page_id` | App Review + map Page/Form |
| `Invalid OAuth access token` | Token revoke / hết hạn | System User generate mới → vault |
| `account_status` ≠ 1 | Chưa billing / disable | Ads Manager Billing (UI) |

Probe webhook local: `python3 scripts/ptt_fb_webhook_probe.py`  
Token refresh: [`runbooks/meta-token-refresh.md`](../runbooks/meta-token-refresh.md)

---

## Tài liệu liên quan

| File | Khi nào mở |
|------|------------|
| [huong-dan-meta-setup-tai-khoan-app-form-token.md](../huong-dan-meta-setup-tai-khoan-app-form-token.md) | Làm bằng UI Business / Ads Manager |
| [05-meta-ads.md](./05-meta-ads.md) | Hub, tracking, launch trên ops-web |
| [huong-dan-meta-enterprise-ops.md](../huong-dan-meta-enterprise-ops.md) | Vận hành enterprise |
| [`scripts/seed_meta_channel_account.py`](../../scripts/seed_meta_channel_account.py) | Seed channel staging |

*Meta đổi field / objective theo version Graph. Nếu lệnh 400, đối chiếu [Marketing API](https://developers.facebook.com/docs/marketing-api) đúng `v21.0` — đừng hạ `v19.0` trên server RNOSAI chỉ vì lệnh tay.*
