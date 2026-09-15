# Design — Raw Lead Harvest: Mode All thị trường (Wave E → Wave D)

| Thuộc tính | Giá trị |
|------------|---------|
| **Sản phẩm** | RNOSAI / PTT Revenue OS |
| **Phân hệ** | Market Research — Raw Lead Harvest |
| **Mã** | RES-UC-121 — All-market / Intent / Market Graph |
| **Ngày** | 2026-09-15 |
| **Trạng thái** | Draft for Review |
| **Quyết định** | Hướng **3: E rồi D** (Intent/White space → Market Graph) |
| **Liên quan** | SRS Lead thô v1.5 (`docs/specs/2026-09-14-market-research-raw-lead-harvest-srs.md`) |

---

## 1. Vấn đề

Mode hiện tại (`quality` / `volume` / `marketing`) dùng **LLM Discover** → liệt kê vài chục DN quen thuộc (Hasaki, Kangnam…), thiếu SĐT/email, không phủ được thị trường thật (vd. ~1000 spa/massage HCM).

Đối thủ cũng mua được Google Places / Apify. PTT thắng nếu:

1. AM nhận **lead đáng gọi** (white space + intent), không phải danh bạ thô.
2. Hệ thống **tích lũy census** theo ngành × địa bàn và chỉ báo **diff** theo thời gian.

---

## 2. Mục tiêu đo được

| KPI | Wave E (Intent) | Wave D (Market Graph) |
|-----|-----------------|------------------------|
| Contactable rate (pending có SĐT hoặc email) | ≥ 60% | ≥ 70% |
| % lead không trùng CRM (phone/company) | ≥ 90% | ≥ 95% |
| Cover ước lượng ngành × tỉnh (Places) | N/A (lọc intent) | ≥ 70% vs baseline Places count |
| Thời gian job E (HCM spa, cap 200) | ≤ 30 phút | — |
| Diff job D (re-run tuần) | — | chỉ insert/update thay đổi |

North star giữ nguyên SRS: **lead thật – liên hệ được – khớp ICP**; All-market **không** được thành “1000 dòng không gọi được”.

---

## 3. Phạm vi

### 3.1. In scope

**Wave E — Intent / White space**

- Mode mới: `intent` (UI: 「Intent — white space thị trường」).
- Provider danh sách: **Google Places Text Search** (primary) + reuse scrape website/`/lien-he` hiện có.
- Lọc white space: chưa có trong CRM leads (phone_norm / company_name_norm), chưa blacklist harvest, chưa pushed gần đây (cấu hình ngày).
- Lọc intent (rule-based v1): thiếu website hoặc website yếu (fetch fail / không có SĐT trên trang), GBP thiếu vài field nếu Places trả về.
- Output: tối đa `target_count` (khuyến nghị 50–200) vào bảng lead thô hiện có; status `pending` / `auto_rejected` theo gate `marketing`-like.
- Không blast Zalo/SMS; không scrape LinkedIn/FB Graph (giữ ràng buộc SRS).

**Wave D — Market Graph**

- Bảng census bền vững theo `(industry_key, province_code, place_id|external_key)`.
- Job mode `market_graph`: crawl/pagination Places theo grid quận hoặc keyword pages; upsert census; tạo harvest leads chỉ từ **new / changed / still white-space**.
- Diff + lịch gợi ý (manual re-run trước; cron optional phase 2).
- Enrich nhẹ: website scrape, optional MST/legal đã có (H3c).

### 3.2. Out of scope (cả hai wave)

- Cam kết pháp lý 100% đúng / ToS Google bypass.
- Auto-dial / email blast.
- FB Ads Library / hiring signals (ghi **Wave E2** sau khi E ổn).
- Thay thế hoàn toàn mode AI Discover (giữ `quality`/`volume`/`marketing`).

---

## 4. Personas & UX

| Ai | Việc |
|----|------|
| AM / Researcher | Chọn ngành + HCM + mode Intent → nhận list white-space có SĐT |
| Admin | Cấu hình `GOOGLE_PLACES_API_KEY` (hoặc credential encrypted giống AI providers) |
| GDKD | Xem cover Market Graph theo ngành × tỉnh (dashboard đơn giản wave D) |

**UI (tab Lead thô):**

- Thêm option mode:
  - `intent` — 「Intent — white space (Places + lọc CRM)」
  - `market_graph` — 「All thị trường — census + diff」(Wave D; Wave E có thể ẩn hoặc disabled với tooltip “sắp ra”)
- Intent: bắt buộc `province_code` ≠ `all` (tránh bill Places toàn quốc lần đầu).
- Gợi ý `target_count` mặc định 100; cảnh báo nếu > 300.
- Job progress: `discovered` / `filtered_crm` / `filtered_intent` / `pending` / `rejected`.

---

## 5. Kiến trúc

```text
Wave E:
  [Places Text Search pages]
       → normalize Place → candidate
       → white_space filter (CRM + blacklist + recent push)
       → intent score (rules)
       → fetch website + scrape contact (reuse)
       → quality gate (intent ≈ marketing soft)
       → insert research_raw_leads

Wave D:
  [Places grid / pagination until exhausted or cap]
       → upsert research_market_entities
       → diff (new|phone_changed|website_changed|still_whitespace)
       → optional enqueue same verify/scrape path
       → insert only diff rows as raw leads (linked entity_id)
```

**Tái sử dụng bắt buộc:**

- `scrape-contact.util.ts`, `verify-contact.util.ts`, `quality-gate.util.ts`, `fetchEvidenceText`
- DDL/API lead thô, accept/reject, push CRM, feedback/blacklist
- Feature flags hiện có + flag mới `PTT_RESEARCH_HARVEST_INTENT=1`, `PTT_RESEARCH_HARVEST_MARKET_GRAPH=1`

**Không** nhét Places crawl vào `HarvestWorkerService.runRealHarvest` LLM path — tách worker:

- `IntentHarvestWorkerService` (E)
- `MarketGraphWorkerService` (D) gọi shared `PlacesClient` + shared `persistHarvestCandidate`

---

## 6. Mode & gate

| Mode | Nguồn list | Gate persist |
|------|------------|--------------|
| quality / volume / marketing | LLM | như hiện tại |
| **intent** | Places | như marketing: evidence hoặc Places phone; contact ưu tiên; soft-keep website-only |
| **market_graph** | Census diff | như marketing; gắn `market_entity_id` |

`target_count` với intent = **cap output pending** sau filter (không phải số trang Places). Places có thể scan nhiều hơn (internal `scan_cap`, mặc định `max(target_count*5, 200)`).

---

## 7. White space & Intent rules (E v1)

**White space (bắt buộc pass):**

1. `phone_norm` không khớp lead CRM active (reuse `findAlreadyCustomerByPhone` + mở rộng company norm).
2. Không khớp blacklist harvest.
3. Không phải raw lead `accepted`/`pushed` cùng project trong `N` ngày (default 90).

**Intent score (0–100), threshold mặc định 40 để vào pipeline scrape:**

| Tín hiệu | Điểm |
|----------|------|
| Places có `formatted_phone_number` | +25 |
| Không có website / website fetch fail | +20 |
| Có website nhưng scrape không ra SĐT/email | +15 |
| Rating count thấp (&lt; 20) hoặc mới (nếu có) | +10 |
| Types khớp industry mapping | +10 |
| Đã là chuỗi lớn denylist (Hasaki, Kangnam…) | −40 |

Denylist chuỗi lớn: config JSON Admin hoặc seed trong code (có thể override runtime.env).

---

## 8. Google Places

- API: Places API (New) Text Search Text Query hoặc legacy Text Search — chọn **một** trong plan implement; khuyến nghị **Places API New** nếu key hỗ trợ.
- Query template: `"{industry_label} {province_name}"` + optional ward; Wave D thêm grid theo quận HCM.
- Lưu `place_id`, name, address, phone, website, location, types, rating, user_ratings_total.
- Rate limit: queue + delay; budget guard `max_places_requests_per_job`.
- Secret: `PTT_GOOGLE_PLACES_API_KEY` hoặc credential table `research_places_credential` (encrypt như AI token).

---

## 9. Data model (DDL)

### Wave E (tối thiểu)

- Mở rộng `research_raw_lead_harvest_jobs.mode` check/constraint: thêm `intent`, (sau) `market_graph`.
- Cột job: `scan_cap INT`, `places_requests INT`, `stats_json JSONB` (`discovered`, `whitespace_kept`, `intent_kept`, …).
- Lead: `place_id TEXT NULL`, `intent_score INT NULL`, `source_provider` = `google_places`.

### Wave D

```text
research_market_entities
  id UUID PK
  industry_key TEXT NOT NULL
  province_code TEXT NOT NULL
  place_id TEXT NOT NULL
  company_name TEXT NOT NULL
  company_name_norm TEXT
  phone / phone_norm / email / website / address
  lat / lng
  places_json JSONB
  intent_score INT
  first_seen_at / last_seen_at
  content_hash TEXT  -- hash phone|website|name|address
  UNIQUE (industry_key, province_code, place_id)

research_market_entity_snapshots (optional v1)
  entity_id, seen_at, content_hash, places_json
```

Raw lead: `market_entity_id UUID NULL REFERENCES …`.

---

## 10. API

| Method | Path | Wave |
|--------|------|------|
| POST | `/api/v1/research/projects/:id/raw-lead-harvests` body.mode=`intent`\|`market_graph` | E/D |
| GET | job detail + `stats_json` | E |
| GET | `/api/v1/research/market-entities?industry=&province=` | D |
| GET | `/api/v1/research/market-entities/summary` cover counts | D |

Caps: giữ `crm_research.edit` / `view`.

---

## 11. Bảo mật & tuân thủ

- Không log Places API key.
- Tôn trọng ToS Google Places — chỉ qua API chính thức, không HTML scrape Maps.
- PII phone/email: cùng RBAC research; không public.
- Feature flag off → API 404/disabled như harvest hiện tại.

---

## 12. Rủi ro

| Rủi ro | Giảm thiểu |
|--------|------------|
| Bill Places cao | `scan_cap`, bắt buộc province, budget per job |
| Places thiếu SĐT | scrape website; soft pending marketing-like |
| Trùng CRM lệch format tên | phone_norm primary; company_norm secondary |
| Denylist chuỗi quá cứng | config + notes ICP override |
| Job dài | async worker + progress stats; 1 running/project |

---

## 13. Rollout

1. **E0** — Places client + credential + dry-run count  
2. **E1** — mode `intent` end-to-end → UAT spa HCM  
3. **E2** (optional) — tín hiệu ads/MST  
4. **D1** — census table + upsert  
5. **D2** — diff → raw leads + summary UI  
6. **D3** — scheduled re-crawl (optional)

Cờ: bật Intent trên staging trước; Market Graph sau khi Intent đạt KPI contactable.

---

## 14. Quyết định đã chốt

- Hướng **E rồi D**.
- List source primary: **Google Places API** (không Apify ở v1 E/D).
- AI Discover **không** dùng cho All-market; AI chỉ optional enrich sau (out of E1).
- Giữ pipeline lead thô / push CRM hiện có.

---

## 15. Open points (không chặn E1)

- Places API New vs Legacy — quyết trong Task Places client.  
- Có tách credential UI Admin riêng hay chỉ env — mặc định **env + runtime.env** cho E1; Admin UI ở E1.1 nếu cần rotate.  
- Grid quận HCM hard-code vs VN Geo districts — D1 dùng Geo nếu có; fallback danh sách quận seed.
