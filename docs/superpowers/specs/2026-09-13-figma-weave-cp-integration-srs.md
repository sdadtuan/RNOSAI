# Software Requirements Specification

# Figma Weave × Creative OS — Tích hợp nghiệp vụ & chất lượng vận hành (CP-WEAVE-WIN)

| Thuộc tính | Giá trị |
|---|---|
| Tên | PTT Creative OS — thắng đối thủ trên vòng kín brief → Weave → asset có luật → duyệt → bàn giao |
| Mã tài liệu | SPEC-CP-WEAVE-WIN-2026-09-13 |
| Phiên bản | **1.0 — nghiệp vụ + chất lượng vận hành** |
| Cha | [Creative Production OS SRS v2.0](./2026-09-07-creative-production-os-srs.md) — **không thu hồi** |
| Nhà máy đa provider | [SPEC-CP-ACO-WIN](./2026-09-13-cp-ai-ops-provider-integration-srs.md) — tài liệu này = **Wave A** (Weave Mức 2); Magnific/Comfy không viết ở đây |
| Playbook video | [CP Video Agency Win](./2026-09-10-cp-video-agency-win-design.md) — Weave **không** thay PL-1/2/3; là studio ngoài cho output AI/canvas |
| Plan kỹ thuật | [2026-09-12-figma-weave-work-order.md](../plans/2026-09-12-figma-weave-work-order.md) |
| Sản phẩm ngoài | Figma Weave / Weavy canvas ([app.weavy.ai](https://app.weavy.ai/), [weave.figma.com](https://weave.figma.com/)) — **không** Weavy UIKit Chat/Files |
| Pilot | 1 khách CRM thật (`client_code`) + 1 `service_lifecycle` + 1 Work Order `CR-YYYY-MMDD-NNN` + 1 file `final/` đúng convention |
| Prod | `https://rs.pttads.vn` · tenant `PTT` · UI tiếng Việt · empty `—` |
| Trạng thái | Draft — SoT nghiệp vụ/vận hành; **chưa code** |
| Flag | `PTT_WEAVE=0` mặc định. Bật sau UAT Task 6 của plan |

**Tuyên bố kế thừa:** Mọi khóa Q1–Q19 của CP OS SRS vẫn đúng. Khách = `clients`. Campaign = `service_lifecycle`. Project = `crm_cp_projects`. Duyệt khách = Creative Hub `submit-creative`. Launch ads = Campaign Write. Video người = Video SOP. CSD Chat **không đụng**.

**Tuyên bố thắng:** PTT không cạnh tranh canvas. PTT cạnh tranh **nhà máy creative**: đúng khách, đúng campaign, đúng phiên bản, đúng lane, đúng người duyệt, đúng file bàn giao — trong thời gian đo được.

---

## 0. Vì sao phải viết SRS này

Plan kỹ thuật đã khóa **Mức 2** (export → object storage quy ước → ingest → CRM). Đó là cầu nối. Chưa đủ để thắng deal.

Đối thủ (và PTT nếu làm sai) sẽ bán một trong ba thứ yếu:

1. **Canvas** — Weave / Runway / Kling / Fal: render đẹp, file rơi Zalo/Drive, không biết file nào là bản gửi khách.  
2. **DAM + thư mục** — Bynder / Drive convention: có kho, không có Work Order, không có cổng duyệt CRM, không có checksum.  
3. **CP OS khép kín** — Nova: brief → render nội bộ → QC generic; **không** nhường studio ngoài, **không** đóng vòng CRM/Ads/lead.

Thắng = nhân viên PTT **không hỏi “file mới nhất ở đâu?”**. Account bấm **Sync output**. Producer thấy checksum, tỷ lệ, duration. Brand/Legal/khách duyệt đúng bản. Ads nhận đúng `final/`. Thử nghiệm Fal/LoRA/CivitAI **không** lọt vào bản gửi khách.

Không thắng = embed iframe Weave, chờ REST native, clone chat Weavy, hoặc tự launch ads từ canvas.

---

## 1. Câu thắng (một câu)

**PTT không tích hợp “tool AI”. PTT vận hành Work Order: campaign CRM sinh brief có SoR → designer làm trên Weave → export đúng `{client}/{campaign}/{task_id}/{lane}` → CRM ingest fail-closed (checksum, thumb, probe, watermark) → Hub duyệt → Campaign Write nhận bản `final` — trong khi đối thủ dừng ở file Drive hoặc canvas không governance.**

---

## 2. Ba hướng — đã chốt A

| | **A — Nhà máy semi-auto (khuyến nghị, khóa)** | B — Chờ API Weave | C — Clone studio |
|---|---|---|---|
| Làm | Deep-link + quy ước path + Sync output + webhook S3/MinIO + cổng lane + Hub/Campaign Write | Đợi Figma mở REST chạy graph | Embed canvas, tự render, tự publish |
| Thắng ai | Agency Drive+Zalo+Excel; Nova không có studio ngoài có luật; Weave standalone không có CRM | Không thắng được 2026 | Không thắng — phá SoR, phá human-in-the-loop |
| Rủi ro | Designer lệch convention (giải = fail-closed + warning rõ) | Deal chết chờ vendor | Scope nổ, CORS/session Figma, không API key |
| Thời gian | 1 wave W0–W5 theo plan | Không kiểm soát | 3+ wave, lệch CP OS |

**Chốt: A = Mức 2.** Khi Figma có REST native: thêm adapter chạy graph — **không** đổi convention path, không đổi state machine, không đổi cổng lane.

---

## 3. Đối thủ và sân đánh

### 3.1. Ai đang giữ việc thật (không phải slide)

| Việc hàng ngày | Đối thủ điển hình | Chúng đang thua ở đâu |
|---|---|---|
| Giao brief cho designer | Notion / mail / chat | Brief không khóa khách + campaign + format |
| Sinh prompt / shot list | ChatGPT tab riêng | Prompt không gắn Work Order; mất lineage |
| Render / tinh chỉnh | Weave, Runway, Kling, Fal, Comfy | Output không có `task_id`; version = “final_v3_that.mp4” |
| Nộp duyệt | Zalo / Drive link | Không lane; khách thấy draft; không watermark |
| Lấy metadata | Mở file tay | Thiếu duration/ratio; số `0` giả |
| Bàn giao ads | “File trong group” | Campaign Write không có URI + checksum |
| Tái sử dụng | Search Drive | Không biết seed/model/origin; LoRA trộn với final |

### 3.2. Ma trận thắng

| Capability | Weave standalone | Nova CP OS | In-house Drive+chat | **PTT moat** |
|---|---|---|---|---|
| Canvas / Import Node / LoRA / Fal / Replicate / CivitAI | ✅ Core | ⚠️ Provider nội bộ | ❌ | **Ngoài SoR** — catalog `source/` thôi |
| Brief có khách + lifecycle | ❌ | ⚠️ Workspace | ❌ | ✅ `clients` + `service_lifecycle` + WO |
| Task id đọc được trên path | ❌ | ❌ UUID | ⚠️ tự đặt | ✅ `CR-YYYY-MMDD-NNN` = khóa Sync |
| Lane source/drafts/review/approved/final | ❌ | ⚠️ version nội bộ | ❌ | ✅ fail-closed + watermark |
| Một nút lấy output | ❌ Export tay | ✅ render xong vào DAM | ❌ | ✅ **Sync output** + webhook |
| Checksum idempotent | ❌ | ⚠️ hash DAM | ❌ | ✅ `(task_id, sha256)` |
| Probe: duration `null` khi thiếu, không `0` | ❌ | ⚠️ | ❌ | ✅ NFR-DQ-01 |
| Duyệt khách / Legal | ❌ | ⚠️ portal riêng | Mail | ✅ Creative Hub (Q7 CP OS) |
| Bàn giao ads + UTM | ❌ | ❌ | Tay | ✅ Campaign Write (Q8) |
| Tự launch ads | ❌ | ❌ | Tay | **Cấm** — cổng người |
| Closed-loop CPL / lead | ❌ | ❌ | ❌ | ✅ CRM đã có — WO chỉ gắn asset |
| Chat UIKit Weavy | N/A (sản phẩm khác) | ❌ | Zalo | **Ngoài scope** |

**Kết luận:** Đừng cạnh tranh editor. Thắng bằng **Work Order + convention + ingest chất lượng + cổng người + SoR sẵn**.

---

## 4. Quyết định khóa (Q-W)

| # | Khóa |
|---|---|
| Q-W1 | CRM PTT là SoR. Weave là studio ngoài. Không clone campaign/client/project. |
| Q-W2 | Không gọi API chạy graph Weave (2026-09: Figma chưa mở integration REST trên mọi plan). Không `WEAVE_API_KEY`. |
| Q-W3 | Open in Weave = deep-link `WEAVE_OPEN_BASE` + `template_key`. Không iframe, không web component chat. |
| Q-W4 | Cầu nối duy nhất phase 1: prefix storage + **Sync output** + webhook trung gian (S3/MinIO ObjectCreated hoặc cron list). Không webhook native Weave. |
| Q-W5 | Path bắt buộc `{client_code}/{campaign_code}/{task_id}/{lane}/{filename}`. Lệch → skip + warning, **không đoán**. |
| Q-W6 | `task_id` = `CR-YYYY-MMDD-NNN` (sequence ngày). UUID chỉ là PK DB. Sync tìm folder theo `task_id`. |
| Q-W7 | Chỉ `review/` và `final/` vào pipeline duyệt. `source/` `drafts/` không submit-review. `approved/` do CRM ghi — designer không drop. |
| Q-W8 | Watermark `DRAFT` / `REVIEW` khi ingest lane tương ứng. `final/` không watermark. |
| Q-W9 | Idempotent: cùng `task_id` + SHA-256 → không tạo asset lần 2. Báo `duplicate`, không 500. |
| Q-W10 | Import Fal/Replicate/CivitAI/LoRA = experimentation → `source/` + metadata `origin=weave_import`. Không vào Hub. |
| Q-W11 | AI brief chỉ khi `CP_AI_ENABLED=1`; không thì stub JSON + cờ `ai_stub`. AI không duyệt, không ingest, không deliver, không launch. |
| Q-W12 | Flag `PTT_WEAVE=0` mặc định. Tab Weave ẩn khi tắt. |
| Q-W13 | Workplace = PRJ-03 tab **AI Ops** (`?tab=ai-ops&pane=weave`) — tab thứ 9, không thay 8 tab SoT. Không tab `weave` riêng. Class `cp-weave-*` trong pane. SoT IA: [SPEC-CP-ACO-WIN §4A](./2026-09-13-cp-ai-ops-provider-integration-srs.md). |
| Q-W14 | Cap: `crm_cp.edit` tạo/sync/submit; `crm_cp.view` xem; `crm_cp.export_final` deliver. HMAC hook không dùng staff JWT. |
| Q-W15 | Không tự launch Ads. Deliver = handoff file + UTM sang Campaign Write hoặc CP Publish video-only. |

---

## 5. Personas và RACI

| Persona | RNOSAI | Chịu | Không |
|---|---|---|---|
| Account Manager | AM | Tạo campaign + project + WO; theo dõi SLA; gửi Hub | Sửa asset gốc; ghi `approved/` tay; launch ads |
| Creative Producer | SP Content | Chọn template, sinh/sửa brief, mở Weave, Sync output, submit-review | Override lane `source` thành review; deliver nếu QC blocked |
| Designer / AI Operator | Creator | Làm trên Weave; export đúng path; sidecar JSON nếu có | Tự approve Hub; drop vào `approved/` |
| Brand Lead | Brand | Duyệt visual trên Hub/CP | Chạy Sync nếu không cap edit |
| Legal | Legal | Claim / rights / disclaimer | Ingest |
| Client Reviewer | Portal `/creatives` | Approve/reject bản được share | Ops-web; thấy `drafts/` `source/` |
| Ads / Campaign Write | Ads Ops | Nhận `final` + UTM | Tự lấy file Drive |
| Admin / Producer lead | `crm_cp.manage` | Template URL, prefix, bật flag | Bịa số KPI |

**RACI rút:** AM = A (Work Order sống), Producer = R (brief + sync + submit), Designer = R (export đúng convention), Brand/Legal/Client = C/A trên cổng duyệt, Ads = I đến khi `delivered`.

---

## 6. Nghiệp vụ — 8 bước (SoT)

Mọi bước có **đầu vào / hệ thống làm / đầu ra / cổng**. Thiếu cổng = chưa xong bước.

```
AM / Producer          AI Gateway            CRM PTT                 Designer              Weave
     │                      │                    │                       │                   │
 1. Campaign + task ───────►│                    │                       │                   │
 2. Sinh brief ────────────►│ brief_json ───────►│ WO brief_ready        │                   │
 3. Tạo Work Order ─────────────────────────────►│ task_id + path        │                   │
 4. Open in Weave ──────────────────────────────►│ opened ──────────────►│ canvas template   │
 5. Làm việc / import ──────────────────────────────────────────────────►│ in_weave          │
 6. Export đúng lane ───────────────────────────────────────────────────►│ prefix            │
 7. Sync output / webhook ──────────────────────►│ ingest + probe        │                   │
 8. Review → approve → deliver ─────────────────►│ Hub + Campaign Write  │                   │
```

### B1 — Mở việc trên SoR (không trên canvas)

| | |
|---|---|
| **Đầu vào** | Khách đã có `clients`; campaign = `service_lifecycle`; project CP đã tạo |
| **Hệ thống** | Ghi `agency_client_id`, `lifecycle_id`, `project_id` lên WO sau này |
| **Cổng** | GT-W01 — thiếu khách hoặc lifecycle → không tạo WO |
| **Thắng** | Không có “project mồ côi trên Weave” |

### B2 — Brief có hợp đồng, không đoạn chat

| | |
|---|---|
| **Đầu vào** | Project + template_key + (optional) brief tay |
| **Hệ thống** | `POST .../generate-brief` → `creative_brief`, `prompt`, `negative_prompt`, `shot_list[]`, `output_format` |
| **Cổng** | GT-W02 — thiếu `prompt` hoặc `output_format` → không `brief_ready` |
| **Thắng** | Designer mở Weave đã có prompt copy được; lineage gắn WO |

### B3 — Work Order = phiếu sản xuất

| | |
|---|---|
| **Đầu vào** | `project_id`, `template_key` ∈ {`feed-1x1`,`reel-9x16`,`banner-wide`} hoặc template active |
| **Hệ thống** | Sinh `task_id`, snapshot `client_code` + `campaign_code`, hiện path export |
| **Cổng** | GT-W03 — `task_id` unique theo ngày; code không đổi sau tạo |
| **Thắng** | Mọi file trên disk đọc được “việc nào” không cần mở CRM |

### B4 — Open in Weave (không embed)

| | |
|---|---|
| **Đầu vào** | WO `brief_ready` hoặc sau; staff có session Figma riêng |
| **Hệ thống** | `POST .../open` ghi `opened_at`, `opened_by_staff_id`; trả `href`; FE `window.open` |
| **Cổng** | GT-W04 — URL chỉ từ `weave_flow_url` đã seed; không tự ghép domain lạ |
| **Thắng** | 1 click; CRM biết ai mở lúc nào; không giả lập login Figma |

### B5 — Studio ngoài (PTT không điều khiển graph)

Designer import ref, chạy flow, tinh chỉnh, thử model ngoài. CRM giữ `opened` / `in_weave`. Không poll canvas. Không coi đây là “đã có asset”.

**Checklist bắt buộc trên UI (copy, không tick giả):** import reference → chạy flow → export vào path đang hiện.

### B6 — Export = hành vi có luật

Designer (hoặc rclone/Dropbox-S3) ghi:

```
{WEAVE_EXPORT_PREFIX}/
  {client_code}/{campaign_code}/{task_id}/
    source/    drafts/    review/    approved/    final/
```

Filename: `{task_id}_v{nn}_{ratio}.{ext}`  
`ratio` ∈ `1x1` \| `9x16` \| `16x9` \| `4x5` \| `og`  
Sidecar optional `{stem}.json`: `{ prompt, negative_prompt, model, seed }` — thiếu không chặn.

**Cổng GT-W05:** parse fail → không ingest.

### B7 — Sync output / webhook (khoảnh khắc thắng)

Producer bấm **Sync output** hoặc object-created gọi cùng `ingestKey()`.

Hệ thống: resolve folder theo `task_id` → list → parse → SHA-256 → copy vào DAM CP → thumb 320px → probe MIME/bytes/width/height/`duration_ms` → watermark theo lane → gắn campaign/project.

**Cổng GT-W06:** không có file `review`/`final` hợp lệ → WO không lên `linked`; UI nêu `warnings[]`.

### B8 — Duyệt và bàn giao (SoR sẵn)

| Hành động | Điều kiện | SoR |
|---|---|---|
| Gửi review | ≥ 1 asset lane `review` hoặc `final`; WO `linked` | Hub `submit-creative` |
| Approve | Theo CP/Hub (`internal_review` → `final_approved`) | CRM **ghi** copy/pointer sang `approved/` |
| Deliver | Cap `export_final`; QC không Blocked | Campaign Write (file + UTM) hoặc CP Publish video-only |
| Launch ads | Ngoài module | Người ở Ads Ops — **không** nút trên tab Weave |

**Cổng GT-W07 / GT-W08 / GT-W09** — §8.

---

## 7. Hợp đồng thư mục và tên file (nghiệp vụ, không “gợi ý”)

Đây là **hợp đồng vận hành** giữa Designer và CRM. Vi phạm = file không tồn tại với nhà máy.

### 7.1. Lane

| Lane | Ai ghi | Watermark | Catalog | Submit Hub | Deliver | Ý nghĩa nghiệp vụ |
|---|---|---|---|---|---|---|
| `source/` | Designer | Không | Có (origin bắt buộc nếu import ngoài) | Không | Không | Ref, LoRA, Fal/Replicate/CivitAI — experimentation |
| `drafts/` | Designer | `DRAFT` | Chỉ khi `include_drafts` | Không | Không | Thử — khách không thấy |
| `review/` | Designer | `REVIEW` | Có | Có | Không | Nộp nội bộ / sẵn sàng share có kiểm |
| `approved/` | **CRM** | Không | Có | — | Không (đã duyệt, chưa bàn giao ads) | Snapshot sau approve |
| `final/` | Designer | Không | Có | Có | Có | Bản giao Ads / publish |

Lane khác (`tmp/`, `export/`, `out/`) → skip.

### 7.2. Ví dụ chuẩn (UAT bắt buộc)

```
nova/mid-autumn-2026/CR-2026-0912-028/final/
  CR-2026-0912-028_v01_9x16.mp4
  CR-2026-0912-028_v01_1x1.jpg
```

### 7.3. Fail-closed (bảng quyết định)

| Tình huống | Hệ thống |
|---|---|
| Thiếu segment / lane lạ | `skipped` + warning mã `path_invalid` |
| Filename không khớp `{task_id}_v{nn}_{ratio}.{ext}` | `skipped` + `name_invalid` |
| `task_id` trên path ≠ WO đang sync | `skipped` + `task_mismatch` — **không** gắn nhầm campaign |
| `client_code` / `campaign_code` ≠ snapshot WO | `skipped` + `scope_mismatch` |
| Hash đã có trên cùng `task_id` | `duplicate` — không lỗi |
| Hash đã có trên **WO khác** | ingest được (file tái dùng) nhưng ghi `reused_checksum=true`; không merge campaign |
| Sidecar JSON lỗi cú pháp | ingest file media; warning `sidecar_invalid` |
| Probe video không đọc được duration | `duration_ms=null` — **cấm** ghi `0` |
| Designer thả vào `approved/` | bỏ qua; warning `lane_crm_owned` |
| File 0 byte / MIME cấm | `skipped` + `payload_rejected` |

---

## 8. Cổng chất lượng (GT-W)

Cổng là luật server. UI chỉ phản ánh.

| ID | Cổng | Pass | Fail |
|---|---|---|---|
| GT-W01 | Mở WO | `project_id` + `agency_client_id` + `lifecycle_id` (hoặc campaign_code suy từ lifecycle) + template active | 409 `wo_scope_incomplete` |
| GT-W02 | Brief sẵn | `normalizeWeaveBrief` pass | Ở `draft`; nút Open được phép nhưng checklist cảnh báo |
| GT-W03 | Task id | Format `CR-YYYY-MMDD-NNN`; unique | Không tạo WO |
| GT-W04 | Open URL | `href` từ template đã seed + `wo` + `project` query | 409; không fallback URL cứng |
| GT-W05 | Path | `parseWeaveExportKey` ≠ null **và** khớp snapshot WO | Skip file |
| GT-W06 | Linked | ≥ 1 asset `review` hoặc `final` sau ingest | Không `submit-review` |
| GT-W07 | Submit review | GT-W06 + cap edit + không chỉ `source`/`drafts` | 409 |
| GT-W08 | Approved lane | Chỉ job CRM sau Hub/CP approve | Drop tay bị bỏ qua |
| GT-W09 | Deliver | `export_final` + QC ≠ Blocked + có `final` hoặc bản approved | 409; không launch ads |
| GT-W10 | Webhook | HMAC `X-PTT-Weave-Sign` đúng + body `{ key }` | 401; không ingest |
| GT-W11 | Flag | `PTT_WEAVE=1` | 404/ẩn tab |
| GT-W12 | AI | Brief AI không gọi ingest/deliver | Guard server |

AI **không** override cổng.

---

## 9. Máy trạng thái Work Order

```
draft → brief_ready → opened → in_weave → assets_exported → linked → in_review → approved → delivered
                 ↘ cancelled
```

| Từ → đến | Trigger | Ghi chú |
|---|---|---|
| `draft` → `brief_ready` | generate-brief hợp lệ hoặc Producer lưu brief tay pass GT-W02 | Stub AI vẫn transition + `ai_stub` |
| `brief_ready` → `opened` | Open in Weave lần đầu | Mở lại không đổi status lùi |
| `opened` → `in_weave` | Open lần 2 **hoặc** ingest `drafts`/`source` đầu tiên | Tín hiệu “đã làm việc”, không phải đã nộp |
| `*` → `assets_exported` | Ingest được ≥ 1 file lane hợp lệ | Kể cả chỉ `source` (catalog) — **chưa** GT-W06 |
| `assets_exported` → `linked` | Có `review` hoặc `final` | Điều kiện submit |
| `linked` → `in_review` | submit-review | Hub |
| `in_review` → `approved` | Hub/CP final_approved | CRM ghi `approved/` |
| `approved` → `delivered` | deliver | Campaign Write / publish |
| bất kỳ trừ `delivered` → `cancelled` | Producer + lý do | Prefix giữ; không xóa object |

Cấm nhảy `draft` → `approved`. Cấm `delivered` → status trước (tạo WO mới nếu làm lại).

---

## 10. Yêu cầu chức năng (FR)

| ID | Tên | Tóm tắt |
|---|---|---|
| FR-W-001 | Tạo WO | Từ project + template; snapshot client/campaign code; cấp `task_id` |
| FR-W-002 | Sinh / sửa brief | AI hoặc stub hoặc tay; validate; revision giữ JSON cũ trong audit |
| FR-W-003 | Sao chép prompt | Một click; không ghi SoR |
| FR-W-004 | Open in Weave | POST open + href; audit staff |
| FR-W-005 | Hiện path export | Đúng prefix + 5 lane; copy path `final/` |
| FR-W-006 | Sync output | Quét `review`+`final`; `include_drafts` opt-in; trả `scanned/ingested/skipped/warnings` |
| FR-W-007 | Webhook ingest | HMAC; cùng `ingestKey` |
| FR-W-008 | Cron ingest | Flag `PTT_WEAVE_INGEST=1`; ≤ 60s/cycle; không chồng job |
| FR-W-009 | Checksum + idempotent | SHA-256; duplicate im lặng có đếm |
| FR-W-010 | Probe + thumb | Ảnh: w/h; video: duration_ms hoặc null; thumb JPEG 320 |
| FR-W-011 | Watermark lane | DRAFT/REVIEW trên proxy/thumb; không cháy vào master `final` |
| FR-W-012 | Sidecar | Merge metadata nếu parse được |
| FR-W-013 | Catalog source | Gắn `origin`, `provider` nếu biết; không Hub |
| FR-W-014 | Submit review | Chỉ lane được phép → Hub |
| FR-W-015 | Ghi approved | Sau approve; designer không ghi |
| FR-W-016 | Deliver | Handoff Campaign Write / publish; không ads launch |
| FR-W-017 | Upload/link tay | Fallback khi prefix chết; vẫn parse tên nếu có; gắn `source=upload\|link` |
| FR-W-018 | List WO theo project | Pane Weave trong tab AI Ops; status + số asset + warning mới nhất |
| FR-W-019 | Template seed | 3 flow PTT; tắt template → không tạo WO mới |
| FR-W-020 | Activity | Mọi open/sync/skip/submit/deliver trên timeline project |

---

## 11. Chất lượng vận hành (NFR) — sân thắng thật

Đối thủ thua ở **vận hành bẩn**: file trùng, số giả, ingest im lặng, không biết ai nộp. Phần này là SoT chất lượng.

### 11.1. Dữ liệu — không bịa (NFR-DQ)

| ID | Luật |
|---|---|
| NFR-DQ-01 | Thiếu probe → `null` / `—`. Cấm `0` cho duration, width, height khi không đo được. |
| NFR-DQ-02 | `scanned/ingested/skipped/duplicate` đếm từ lần chạy, không cộng dồn ảo trên UI. |
| NFR-DQ-03 | KPI Tổng quan CP **không** cộng số Weave giả. Thiếu ingest = không tăng “Video tạo”. |
| NFR-DQ-04 | Warning mã máy (`path_invalid`, …) + câu tiếng Việt trên UI. Không nuốt lỗi. |

### 11.2. SLA ingest (NFR-SLA)

| Tình huống | Mục tiêu | Breach |
|---|---|---|
| Sync output ≤ 20 file, mỗi file ≤ 80 MB | p95 < **30s** (không kể ffprobe timeout) | Toast + log `sync_slow`; không rollback file đã ingest |
| Sync 1 file ≤ 20 MB | p50 < **8s** | — |
| Webhook → `ingestKey` xong | p95 < **60s** kể từ ObjectCreated | Metric `weave_ingest_lag_seconds` |
| Cron cycle | Chạy xong < 50s hoặc nhả lock; interval 60s | Cấm 2 worker cùng prefix |
| ffprobe | Timeout **10s**/file → duration null + warning `probe_timeout` | Không treo Sync |
| Thumb | Timeout **8s** → asset vẫn ingest, `thumb_uri` null | Warning `thumb_failed` — không fail cả batch |
| HMAC sai | < 50ms reject | 401; counter `weave_hook_reject` |

**Định nghĩa xong Sync:** response JSON đủ 4 đếm + `warnings[]` + danh sách asset mới (id, lane, checksum 12 ký tự đầu). FE không spinner vô hạn > 90s — hiện “đang chạy, tải lại”.

### 11.3. An toàn và biên mật (NFR-SEC)

| ID | Luật |
|---|---|
| NFR-SEC-01 | Hook không JWT. Secret `PTT_WEAVE_WEBHOOK_SECRET` chỉ server. Secret trống + hook gọi → 401 (fail-closed). |
| NFR-SEC-02 | Không log raw secret, không đưa key vào AI brief. |
| NFR-SEC-03 | Signed URL tải `final` theo cap; audit download. |
| NFR-SEC-04 | Prefix ngoài `WEAVE_EXPORT_PREFIX` → reject path traversal (`../`, absolute lạ). |
| NFR-SEC-05 | MIME allowlist phase 1: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime`, `image/gif`. Khác → `payload_rejected`. |
| NFR-SEC-06 | Max 100 file/lần Sync; max 512 MB/file. Vượt → skip phần dư + warning `quota`. |
| NFR-SEC-07 | Tenant `PTT` only. WO không cross-client dù path giả client khác. |

### 11.4. Idempotency và cạnh tranh (NFR-ID)

| ID | Luật |
|---|---|
| NFR-ID-01 | Khóa ingest theo `sha256` + `task_id`. Sync và webhook cùng file = 1 asset. |
| NFR-ID-02 | Hai Sync song song cùng WO: advisory lock; cái sau đợi hoặc 409 `sync_in_progress`. |
| NFR-ID-03 | Webhook trùng `key` trong 5 phút: trả `duplicate` 200, không 5xx. |
| NFR-ID-04 | `client_request_id` optional trên Sync — retry cùng id không đếm ingested lần 2. |

### 11.5. Quan sát và sự cố (NFR-OBS)

Event tối thiểu (append-only):

`wo.created` · `brief.generated` · `weave.opened` · `ingest.scanned` · `ingest.ingested` · `ingest.skipped` · `ingest.duplicate` · `hook.rejected` · `review.submitted` · `wo.approved` · `wo.delivered` · `wo.cancelled`

Mỗi event: `task_id`, `staff_id` (null nếu hook), `storage_key` (nếu có), `checksum` (nếu có), `warning_code`.

Dashboard vận hành (OVR-03 hoặc hàng trên tab Weave, **số query thật**):

| Chỉ số | Công thức | Cửa xanh (pilot 30 ngày) |
|---|---|---|
| Tỷ lệ convention | `ingested / (ingested + skipped_path_or_name)` | ≥ **90%** sau tuần huấn luyện 1 |
| Tỷ lệ Sync sạch | lần Sync có `skipped=0` trừ duplicate | ≥ 70% |
| Lag webhook p95 | §11.2 | < 60s |
| WO mở > 7 ngày chưa `linked` | count | Action Center — việc quá hạn |
| Hook reject 24h | count | = 0 trừ penetration test |

Cấm hard-code các số này trên UI.

### 11.6. Sẵn sàng / phục hồi (NFR-RES)

| ID | Luật |
|---|---|
| NFR-RES-01 | Mất prefix / disk: Sync 503 `export_prefix_unavailable` + bước “kiểm tra WEAVE_EXPORT_PREFIX”. Không 200 rỗng giả thành công. |
| NFR-RES-02 | Partial batch: file A ok, B skip — commit A; warnings đủ B. |
| NFR-RES-03 | Xóa WO không xóa object storage. Cancel = trạng thái. |
| NFR-RES-04 | Khi Figma down: Open vẫn tạo `href`; status không tự `linked`. Designer làm lại khi canvas sống. |
| NFR-RES-05 | Re-hydrate: cùng file thả lại → duplicate; không nhân version. Version mới = đổi bytes hoặc `v{nn}` mới **và** hash mới. |

### 11.7. Trải nghiệm vận hành (NFR-UX)

| ID | Luật |
|---|---|
| NFR-UX-01 | Nút primary duy nhất sau khi đã mở Weave: **Sync output**. Upload/link là secondary. |
| NFR-UX-02 | Kết quả Sync: 4 số + danh sách warning tiếng Việt + link asset. Không “Thành công” nếu `ingested=0` và `skipped>0`. |
| NFR-UX-03 | Copy path một click. Path luôn hiện cả khi chưa có file. |
| NFR-UX-04 | Empty: “Chưa có file `review/` hoặc `final/` — kéo file đúng tên vào path trên.” Không mock thumbnail. |
| NFR-UX-05 | 403 ẩn nút mutate. 409 hiện lý do cổng (mã + câu). |
| NFR-UX-06 | Không tick checklist B5 tự xanh. |

### 11.8. Định nghĩa sẵn sàng / xong (DoR / DoD)

**DoR — Designer được bảo “làm đi”**

- WO có `task_id`, path hiện trên màn.  
- Brief có prompt + output_format (GT-W02) hoặc Producer xác nhận làm không brief (ghi audit).  
- Template URL sống (mở được tay 1 lần lúc seed).  
- 5 folder lane đã tạo dưới prefix (script ops hoặc lần Sync tạo `approved/` only).

**DoD — Việc đóng với nhà máy**

- ≥ 1 file `final/` ingest, checksum hiện, probe không bịa.  
- GT-W07 đã chạy **hoặc** lý do cancel.  
- Nếu deliver: Campaign Write có URI + checksum; WO `delivered`.  
- Activity đủ để trả lời “ai nộp file nào lúc nào”.

---

## 12. Mục tiêu thắng (business + vận hành)

| ID | Mục tiêu | Cửa UAT / 30 ngày | Không đo |
|---|---|---|---|
| BG-W-01 | Một việc Mid-Autumn **không hỏi file trên chat** | WO `CR-2026-0912-028` (hoặc số ngày UAT): drop đúng path → Sync → thấy mp4 + jpg + checksum | Số canvas Weave |
| BG-W-02 | Convention là luật | 1 file `tmp/` hoặc sai tên → skip + warning; **không** gắn campaign | Độ “thông minh” đoán folder |
| BG-W-03 | Experiment không lọt khách | File `source/` (LoRA/Fal) không hiện nút Gửi review | Số model ngoài |
| BG-W-04 | Duyệt đúng SoR | 1 lần submit-review → Creative Hub; portal không thấy `drafts` | Portal mới |
| BG-W-05 | Bàn giao ads sạch | 1 deliver → Campaign Write nhận file `final` + UTM; 0 lần tự launch | Spend / CPL (đã có module khác) |
| BG-W-06 | Zero bịa metadata | 1 video không probe được → `duration_ms` null / `—` | — |
| BG-W-07 | Zero AI vượt cổng | 0 job AI gọi sync/submit/deliver | — |
| BG-W-08 | Idempotent | Sync 2 lần cùng file → `ingested=0`, `duplicate≥1` | — |
| BG-W-09 | SLA Sync | 2 file < 20 MB xong < 30s trên UAT VPS | Benchmark GPU |
| BG-W-10 | Không clone SoR | 0 bảng campaign/client mới; 0 đụng CSD Chat | — |

Chỉ số cửa 30 ngày (§11.5) **giữ** khi bật prod flag.

---

## 13. UI — pane Weave trong tab AI Ops (PRJ-03)

Route: `/crm/creative-os/projects/[id]?tab=ai-ops&pane=weave`  
Chrome: `CpShell` + 8 tab cũ + **AI Ops**. Ẩn cả tab khi mọi flag provider tắt. Pane `magnific` / `comfy` hiện nhưng không phải SoT Wave A.

**Khối bắt buộc (thứ tự):**

1. Chọn template (Feed 1:1, Reel 9:16, Banner ngang) → **Tạo Work Order**  
2. Brief: 5 field sửa tay được → **Sinh brief AI** (disabled + lý do nếu AI off)  
3. **Sao chép prompt** · **Open in Weave**  
4. Checklist 3 dòng (không state giả)  
5. Path export monospace + copy  
6. **Sync output** (primary) · Tải lên / Dán link (secondary)  
7. Kết quả ingest: bảng asset (lane, tên, ratio, duration, checksum ngắn, warning)  
8. **Gửi review** · **Đưa delivery** (đúng cap + cổng)

Copy lỗi / empty tiếng Việt. Không CTA “Gọi ngay”.

---

## 14. API (mỏng — chi tiết plan)

Prefix `/api/crm/cp`.

| Method | Path | Cap | Việc |
|---|---|---|---|
| POST | `/weave-orders` | edit | FR-W-001 |
| GET | `/weave-orders?project_id=` | view | FR-W-018 |
| GET | `/weave-orders/:id` | view | Chi tiết |
| POST | `/weave-orders/:id/generate-brief` | edit | FR-W-002 |
| POST | `/weave-orders/:id/open` | edit | FR-W-004 |
| POST | `/weave-orders/:id/sync-output` | edit | FR-W-006 |
| POST | `/weave-orders/:id/assets` | edit | FR-W-017 |
| POST | `/weave-ingest/hook` | HMAC | FR-W-007 |
| POST | `/weave-orders/:id/submit-review` | edit | FR-W-014 |
| POST | `/weave-orders/:id/deliver` | export_final | FR-W-016 |

Chi tiết DTO, DDL, test path: plan 2026-09-12. SRS này **thắng** nếu API không phá cổng §8 và NFR §11.

---

## 15. Quan hệ module (không nuốt)

```
clients ──┐
service_lifecycle ──► crm_cp_projects ──► crm_cp_weave_work_orders
                                              │
                         DAM / crm_cp_assets ◄─┤ ingest
                         Creative Hub          │ submit-review
                         Campaign Write        │ deliver
                         Video SOP             │ không INSERT
                         CSD Chat              │ không đụng
                         Content OS            │ copy/lịch chữ — không lấy video Weave
                         Fal/Replicate/CivitAI │ chỉ trong Weave; CRM = source/
```

Playbook BĐS / lead / TVC (CP-VIDEO-WIN) vẫn ingest file master vào DAM. Weave là **đường studio ngoài** cho việc cần canvas; cùng cổng QC/Hub khi asset đã `linked`.

---

## 16. Ngoài phạm vi (cố định phase 1)

- Weavy UIKit Chat / Files / token user / directory sync.  
- `POST` chạy workflow Weave; MCP tạo/sửa graph; embed iframe.  
- Webhook native Figma Weave.  
- Portal designer riêng.  
- Thay Video SOP human shoot; thay Nova render queue nội bộ.  
- Tự launch Ads; tự publish social; listening; bidding.  
- DAM thay Bynder cho khách; CDN public không auth.  
- Đoán folder lệch convention.  
- Seed Nova / Sunlight / Tâm An trên prod.  
- Hard-code KPI.  
- Đụng CSD Chat.

Phase 2 (khi Figma mở API): adapter graph — **giữ** path, lane, checksum, cổng.

---

## 17. Case thắng (UAT bắt buộc — 12 phút demo)

**Kịch bản:** Khách `nova`, campaign `mid-autumn-2026`, việc `CR-2026-0912-028`, Reel 9:16 + ảnh 1:1.

| Phút | Làm | Thấy | Đối thủ không làm được |
|---|---|---|---|
| 0–2 | AM mở project CRM, tạo WO template `reel-9x16` | `task_id` + path hiện | Weave không có khách/campaign SoR |
| 2–3 | Sinh brief (stub được) + copy prompt + Open in Weave | Tab mới canvas; CRM `opened` + tên staff | ChatGPT tab mất lineage |
| 3–7 | Designer export 2 file đúng `final/` (ngoài hệ thống) | Folder quy ước | Drive “final_final” |
| 7–9 | Producer **Sync output** | 2 asset, ratio, duration hoặc `—`, checksum; 0 bịa | Upload tay thiếu probe |
| 9–10 | Thả thêm file `tmp/x.png` + Sync | warning `path_invalid`; campaign không dính rác | DAM nuốt mọi file |
| 10–11 | Gửi review | Hub có bản `final`; không có LoRA `source` | Khách thấy draft |
| 11–12 | Deliver | Campaign Write có URI + hash; **không** campaign ads tự chạy | File trong group Zalo |

**Fail UAT nếu:** đoán folder; duration = 0 khi probe fail; `source` submit được; hook không HMAC vẫn ingest; tab Weave hiện khi `PTT_WEAVE=0`.

---

## 18. Lộ trình (khớp plan, không cắt nghiệp vụ)

| Phase | Việc | Xong khi (nghiệp vụ) |
|---|---|---|
| W0 | Path/brief/status/DDL | Test convention + máy trạng thái xanh |
| W1 | API WO + brief | Tạo phiếu + brief trên project thật/staging |
| W2 | Sync + hook + probe + watermark | Case phút 7–10 xanh |
| W3 | Tab Weave | Case phút 0–3 trên UI |
| W4 | Hub + deliver | Case phút 10–12 |
| W5 | Seed template + flag VPS | UAT 12 phút trên `rs.pttads.vn` |

Wave là thứ tự code. **SRS không cắt** cổng hay NFR để “làm sau”.

---

## 19. Self-review spec

| Kiểm | Kết quả |
|---|---|
| Placeholder / TBD | Không |
| Mâu thuẫn plan | Path, lane, HMAC, SoR, no API key — khớp plan 2026-09-12 |
| Phá CP OS | Tab 9 thêm; 8 tab Nova giữ; Q7/Q8 giữ |
| Hai cách hiểu Sync | Chỉ `review`+`final` mặc định; drafts opt-in; approved CRM-owned |
| Scope | Một sản phẩm: Work Order + ingest. Không chat, không ads launch, không clone DAM |
| Thắng đo được | BG-W-01…10 + SLA + convention % |

---

## 20. Tài liệu liên quan

| Tài liệu | Vai trò |
|---|---|
| [CP OS SRS](./2026-09-07-creative-production-os-srs.md) | SoT module cha |
| [CP Video Agency Win](./2026-09-10-cp-video-agency-win-design.md) | Thắng Nova trên playbook ngành — **song song**, không thay |
| [Plan Weave Work Order](../plans/2026-09-12-figma-weave-work-order.md) | Task code W0–W5 |
| Plan Weavy Chat UIKit | **Ngoài scope** — không triển khai theo SRS này |
