# LMP Discover v1 — Output spec (parse Tavily)

> **Document ID:** LMP-DISCOVER-SPEC-v1  
> **Prompt:** [`docs/prompts/lmp/lmp-discover-v1.system.md`](../prompts/lmp/lmp-discover-v1.system.md)  
> **JSON Schema:** [`lmp-discover-v1-output.schema.json`](./lmp-discover-v1-output.schema.json)  
> **Pipeline:** Discover (step 0) → Verify → Collect → Strategize → Arm  
> **Validator (planned):** `ptt_crm/lead_meeting_prep/discover_schema.py`

---

## 1. Mục đích

Chuẩn hoá output LLM sau bước **Tavily search** khi lead chỉ có **SĐT và/hoặc email**, chưa có `company_name` trên CRM.

Worker lưu toàn bộ object vào `discover_json` (cột riêng hoặc `collect_json.discover`).

---

## 2. Input gửi kèm prompt (user message)

```typescript
interface DiscoverLlmUserPayload {
  lead_id: number;
  full_name: string;           // display only — KHÔNG dùng search cá nhân
  phone: string;
  email: string;
  tier1_hints?: {
    email_domain?: string;     // abcspa.vn — null nếu free email
    website_url?: string;
    social_urls?: string[];
    meta_company_name?: string;
    meta_page_name?: string;
  };
  tavily_docs: Array<{
    title: string;
    url: string;
    content: string;           // truncated ≤8000 chars
    sourceType: 'search' | 'extract' | 'provided';
  }>;
  tavily_queries: string[];
}
```

---

## 3. Output root — `DiscoverResult`

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `discover_status` | enum | ✅ | `found_single` \| `found_multiple` \| `not_found` \| `tier1_only` |
| `discover_message_vi` | string | ✅ | 1–2 câu hiển thị AM |
| `query_context` | object | ✅ | Audit input đã dùng |
| `candidates` | array | ✅ | 0–5 phần tử |
| `recommended_candidate_id` | string \| null | ✅ | Auto-pick khi an toàn |
| `am_action` | enum | ✅ | `none` \| `select_candidate` \| `enter_company_manual` |
| `meta` | object | ✅ | Version + timestamp |

---

## 4. `query_context`

| Field | Type | Required |
|-------|------|----------|
| `lead_phone_normalized` | string \| null | ✅ |
| `lead_email_normalized` | string \| null | ✅ |
| `tavily_queries` | string[] | ✅ |
| `tier1_hints_used` | enum[] | ✅ |

**`tier1_hints_used` values:** `email_domain`, `meta_page`, `meta_company_field`, `provided_website`

---

## 5. `candidates[]` — BusinessIdentityCandidate

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `candidate_id` | string | ✅ | `^[a-z0-9_-]{8,32}$` — stable per `source_url+company_name` |
| `company_name` | string | ✅ | length 2–200; không trùng `full_name` lead nếu chỉ 1 token |
| `website_url` | string \| null | ✅ | http(s) URL hoặc null |
| `social_urls` | string[] | ✅ | max 3 |
| `tax_id` | string \| null | ✅ | MST 10–14 số hoặc null |
| `address_vi` | string \| null | ✅ | max 300 chars |
| `industry_hint` | string \| null | ✅ | max 120 chars |
| `phones_on_record` | string[] | ✅ | normalized digits |
| `emails_on_record` | string[] | ✅ | lowercase |
| `source_url` | string | ✅ | phải ∈ `tavily_docs[].url` hoặc tier1 hint URL |
| `source_type` | enum | ✅ | xem §6 |
| `confidence` | enum | ✅ | `verified` \| `likely` \| `weak` |
| `match_signals` | enum[] | ✅ | min 1 nếu confidence ≠ weak |
| `note_vi` | string \| null | ✅ | max 240 chars |

**Cardinality:** `candidates.length` 0 khi `not_found`; 1–5 otherwise.

---

## 6. Enums

### `source_type`

| Value | Nguồn |
|-------|-------|
| `masothue` | masothue.com |
| `business_directory` | thongtincongty, hsct, … |
| `company_website` | Trang About/Liên hệ DN |
| `google_business` | Snippet Maps / GMB |
| `meta_page` | Facebook page (business) |
| `email_domain` | Suy từ domain email |
| `other` | Khác |

### `match_signals`

`phone_match`, `email_match`, `domain_match`, `name_only`

### `discover_status` → pipeline action

| Status | DB prep status | Next step |
|--------|----------------|-----------|
| `found_single` | `running` → verify | `verify_entities()` với `company_name` + `website_url` inject vào PrepInput |
| `found_multiple` | `awaiting_identity_choice` | AM chọn → `resume_discover` job |
| `not_found` | `awaiting_am_input` | Form AM nhập DN |
| `tier1_only` | `awaiting_am_input` hoặc auto nếu `recommended_candidate_id` + verify OK | Policy: default `awaiting_am_input` P0 |

---

## 7. Validation rules (code)

```python
# discover_schema.py — sketch

def validate_discover_result(obj: dict, *, tavily_urls: set[str]) -> dict:
    assert obj["discover_status"] in {...}
    assert obj["meta"]["prompt_version"] == "lmp-discover-v1"
    cands = obj["candidates"]
    if obj["discover_status"] == "not_found":
        assert len(cands) == 0
        assert obj["am_action"] == "enter_company_manual"
    if obj["discover_status"] == "found_single":
        assert len(cands) >= 1
    for c in cands:
        assert c["source_url"] in tavily_urls or c["source_type"] == "email_domain"
        assert len(c["company_name"]) >= 2
    rec = obj.get("recommended_candidate_id")
    if rec:
        assert any(c["candidate_id"] == rec for c in cands)
    return obj
```

**Post-LLM hard gates (không tin LLM):**

1. `source_url` ∈ docs Tavily thật  
2. `phones_on_record` khớp lead → bump confidence server-side  
3. Loại candidate trùng `company_name` (merge)  
4. Cap `candidates` ≤ 5  

---

## 8. Mapping → PrepInput (sau Discover)

Khi AM chọn hoặc auto `found_single`:

```typescript
PrepInput.company_name = candidate.company_name;
PrepInput.website_url = candidate.website_url ?? tier1.website_url;
PrepInput.social_urls = candidate.social_urls.join(',') || tier1.social_urls;
// sources_map:
// company_name → discover:candidate_id
// website_url → discover|meta_json|provided
```

Ghi ngược CRM (Phase 2):

```json
meta_json.lmp_discover = {
  "candidate_id": "...",
  "source_url": "...",
  "discovered_at": "ISO8601",
  "confirmed_by_am": true
}
```

---

## 9. UI copy (`discover_message_vi`)

| Status | Template |
|--------|----------|
| `found_single` | `Đã xác định doanh nghiệp: {company_name}. Đang research SCI…` |
| `found_multiple` | `Tìm thấy {n} doanh nghiệp khớp SĐT/email. Chọn đúng pháp nhân.` |
| `not_found` | `Không tìm thấy DN công khai từ SĐT/email. Nhập tên công ty để tiếp tục.` |
| `tier1_only` | `Gợi ý từ email/trang Meta: {company_name}. Xác nhận hoặc sửa trước khi prep.` |

---

## 10. Acceptance (EC-DISC)

| ID | Pass |
|----|------|
| EC-DISC-01 | Output parse JSON hợp lệ 100% trên gold set 20 snippets |
| EC-DISC-02 | 0 candidate không có `source_url` |
| EC-DISC-03 | `not_found` không hallucinate `company_name` |
| EC-DISC-04 | `found_multiple` khi ≥2 verified/likely |
| EC-DISC-05 | Free email không sinh `website_url` từ domain |

---

## 11. Env & model

| Var | Default |
|-----|---------|
| `PTT_AI_LLM_MODEL` | `gpt-4o-mini` |
| Prompt version | `lmp-discover-v1` |
| Max Tavily docs in prompt | 8 |
| Max content/doc | 4000 chars (truncate server-side) |
