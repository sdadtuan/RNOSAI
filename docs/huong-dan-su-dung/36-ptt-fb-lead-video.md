# PTT Facebook Lead Video — Hướng dẫn sử dụng

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-09-10  
> **Đối tượng:** Editor / Motion, AM, Media Buyer, Tracking  
> **Mục tiêu ads:** Lead (`OUTCOME_LEADS` / Instant Form) — **không** tối ưu cuộc gọi  
> **Hub:** Creative OS `/crm/creative-os` · Ads Ops `/meta/ads-ops` · Hub `/meta/facebook-ads` · Lead `/crm/leads`  
> **Spec:** [2026-09-10-ptt-fb-lead-video-design.md](../superpowers/specs/2026-09-10-ptt-fb-lead-video-design.md)  
> **Pack khóa:** [docs/creative/ptt-fb-lead/](../creative/ptt-fb-lead/)

Module này **không** phải màn hình CRM mới. Đây là **gói chạy ads Lead 9:16** + cửa QC trong code + form + launch Ads Ops. Làm đúng thứ tự dưới đây. Không cắt lại `PTT MKT.mp4` làm master.

**Tài liệu liên quan**

| Việc | File |
|------|------|
| Bible mặt AI | [character-bible.md](../creative/ptt-fb-lead/character-bible.md) |
| Lời thoại + caption + primary text | [vo-scripts.md](../creative/ptt-fb-lead/vo-scripts.md) |
| Shot list / quay UI | [shot-list.md](../creative/ptt-fb-lead/shot-list.md) |
| Form + tên campaign | [launch-brief.md](../creative/ptt-fb-lead/launch-brief.md) |
| Creative OS (ingest / QC tab) | [34-creative-production-os.md](./34-creative-production-os.md) |
| Meta Ads / Ads Ops | [05-meta-ads.md](./05-meta-ads.md) |

---

## Mục lục

1. [Việc mỗi vai trò](#1-việc-mỗi-vai-trò)
2. [Luồng 8 bước](#2-luồng-8-bước)
3. [Làm 4 file video](#3-làm-4-file-video)
4. [QC pack (bắt buộc trước ingest)](#4-qc-pack-bắt-buộc-trước-ingest)
5. [Ingest Creative OS](#5-ingest-creative-os)
6. [Tạo Instant Form](#6-tạo-instant-form)
7. [Duyệt Hub + launch Ads Ops](#7-duyệt-hub--launch-ads-ops)
8. [Ngày 0 — kiểm vòng kín](#8-ngày-0--kiểm-vòng-kín)
9. [Ngày 7 — giữ / cắt / scale](#9-ngày-7--giữ--cắt--scale)
10. [Sự cố thường gặp](#10-sự-cố-thường-gặp)

---

## 1. Việc mỗi vai trò

| Vai | Việc | Không làm |
|-----|------|-----------|
| **Editor** | Thu VO người, render Advisor `ptt-advisor-f-01`, quay UI, edit 4 MP4, chạy probe + QC | TTS làm bản chính; chữ `Hình ảnh AI`; mặt từ clip brand cũ |
| **AM** | Project CP, Brand Kit, duyệt Hub, nhận lead audit, gọi 15 phút | Bịa % CPL trên video; tạo khách AM 360 chỉ để chạy ads |
| **Buyer** | Instant Form, launch 3 ad set, map Hub | CTA **Gọi ngay**; tối ưu cuộc gọi; bật H1-30 trước ngày 7 |
| **Tracking** | Token page, webhook lead, CAPI | Đổi key field form |

---

## 2. Luồng 8 bước

```
Bible + VO  →  Quay / render  →  Edit 4 MP4  →  Probe + QC Jest
    →  Ingest CP OS  →  Instant Form  →  Ads Ops (3 ad set)
    →  Test lead CRM  →  Ngày 7 kill/scale
```

Gate: **không ingest** nếu QC pack fail. **không spend** nếu test lead chưa vào `/crm/leads`.

---

## 3. Làm 4 file video

Bốn tên file **khớp đúng** (QC chặn tên khác):

| File | Hook | Độ dài | Ngân sách test |
|------|------|--------|----------------|
| `ptt-lead-h1-15.mp4` | Đốt click | 15s ±0.2 | 60% |
| `ptt-lead-h2-15.mp4` | Agency slide | 15s ±0.2 | 25% |
| `ptt-lead-h3-15.mp4` | Cắt mặt + UI | 15s ±0.2 | 15% |
| `ptt-lead-h1-30.mp4` | Scale H1 | 30s ±0.2 | Paused đến ngày 7 |

Kỹ thuật: 1080×1920, 30 fps, H.264 + AAC, ≤ 30 MB. Logo PT góc phải, cách mép trên ≥ 110px. Caption **cách từ**, neo **1/3 trên**. Đáy 280px trống (Reels che).

### 3.1. Talent AI

1. Mở [character-bible.md](../creative/ptt-fb-lead/character-bible.md).
2. Dán nguyên prompt. `face_id` = `ptt-advisor-f-01` cho cả pack.
3. Cần 5 take: H1 hook, H1 CTA, H2 CTA, H3 hook, H3 CTA.
4. Thu **giọng người Việt** (mic), lipsync. Miệng lệch > 2 khung → loại.
5. Không nhận «tôi là founder / giám đốc PTT». Không burn chữ `Hình ảnh AI`.

**Thời lượng mặt** (cộng các shot Advisor, làm tròn xuống 0.1s):

- H1 / H2 / H1-30 ≤ **5.5s** — H1 = 0.0–2.5 + 12.0–15. **11.5–12.0 giữ khung UI**, không đưa mặt vào.
- H3 ≤ **7s** (0–3 + 11–15).

### 3.2. B-roll UI (thật)

Đăng nhập https://rs.pttads.vn. Quay / crop 9:16. **Blur tên khách** trước khi gửi ai xem.

1. `/crm/creative-os` — QC fail rồi pass  
2. `/meta/ads-ops` hoặc `/meta/facebook-ads` — Spend / CPL  
3. `/crm/leads/{id}` — lead mới vào  

Cấm dashboard tiếng Anh giả, phòng họp AI, clip `PTT MKT.mp4`.

### 3.3. Lời thoại

Copy nguyên [vo-scripts.md](../creative/ptt-fb-lead/vo-scripts.md). Không tự viết slogan TED Talk.

Export (ví dụ H1):

```bash
ffmpeg -y -i timeline.mov \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -r 30 -s 1080x1920 -b:v 12M -maxrate 16M -bufsize 24M \
  -c:a aac -b:a 160k -ac 2 -ar 48000 \
  -movflags +faststart -t 15 \
  ptt-lead-h1-15.mp4
```

H1-30: `-t 30`.

---

## 4. QC pack (bắt buộc trước ingest)

Từ máy có repo (nhánh `feat/ptt-fb-lead-video` hoặc bản đã merge):

```bash
# 1) Đo file
./scripts/probe_ptt_fb_lead_video.sh /path/to/ptt-lead-h1-15.mp4
```

Kỳ vọng JSON: `width` 1080, `height` 1920, `has_audio` true, `duration_sec` 15±0.2 (hoặc 30).

2) Copy [qc-facts.example.json](../creative/ptt-fb-lead/qc-facts.example.json) thành `qc-facts.json`. **Bốn object** (h1, h2, h3, h1_30). Điền `face_sec`, `ui_shot`, `safe_*` từ timeline. `filename` phải đúng tên bảng trên.

3) Chạy cửa:

```bash
cd services/ptt-crm-api
PTT_LEAD_QC_FACTS=/path/to/qc-facts.json \
  npx jest src/cp/ptt-fb-lead-video-qc.pack.optional.spec.ts --no-coverage
```

- Wave 1 (chưa cần H1-30): ba file 15s `passed`. H1-30 có thể thiếu.  
- Scale: đủ 4 file `passed`.  
- Sai tên file → `filename_mismatch`. Mặt > 5.5s (H1) → `face_too_long`.  
- Không đặt `PTT_LEAD_QC_FACTS` mà file facts không tồn tại → test **fail** (không ingest).

---

## 5. Ingest Creative OS

1. https://rs.pttads.vn/crm/creative-os — tạo project `PTT FB Lead 2026-09`, chọn khách PTT (house) bằng combobox.  
2. Brand Kit: logo PT, màu `#07152e` / `#2a6cff` / `#ff715d`.  
3. `/crm/creative-os/media?tab=ingest` — upload 4 MP4, MIME `video/mp4`, **đúng filename**.  
4. Tab Quality — facts kỹ thuật (1080×1920, có tiếng, safe area, logo, CTA form). `disclaimer` = dòng offer audit, **không** phải chữ AI.  
5. Metadata nội bộ (comment / snapshot): `contains_human=true`, `ai_disclosure=true`, `face_id=ptt-advisor-f-01`. **Không** hiện các dòng này trên hình.  
6. `/crm/creatives` — nộp H1 / H2 / H3 → status **approved**. Ads Ops từ chối creative chưa duyệt.

Quyền: `crm_cp.view` (hoặc `view_all`) + quyền upload; launch sau cần `meta_ads_ops.launch`.

---

## 6. Tạo Instant Form

Làm trên **Ads Manager** (Page PTT đã map khách house). Chi tiết: [launch-brief.md](../creative/ptt-fb-lead/launch-brief.md).

| Ô | Giá trị khóa |
|---|---|
| Tên form | `PTT Audit CPL 2026-09` |
| Headline | `Nhận audit CPL + creative — 15 phút` |
| Privacy | Bật |
| Cảm ơn | `AM PTT liên hệ trong giờ hành chính.` |

**Key Graph** (không đổi). Nhãn VI trên form được; **giá trị gửi về** phải ASCII:

| Key | Nhãn hiện | Giá trị |
|-----|-----------|---------|
| `full_name` | Họ tên | — |
| `phone_number` | SĐT | — |
| `company_name` | Tên công ty | ≥ 2 ký tự |
| `ad_budget_band` | NS ads / tháng | `<20tr` · `20-50` · `50-100` · `>100` |
| `ad_channels` | Kênh đang chạy | `meta` · `tiktok` · `google` · `none` |

Cấm `20–50` (gạch dài) và `chưa chạy` — QC qualific sẽ **trượt**, không scale được.

Ghi `form_id` thật vào `launch-brief.md` (thay `PENDING`).

---

## 7. Duyệt Hub + launch Ads Ops

**Điều kiện:** `PTT_META_ADS_OPS_ENABLED`, Launch QA khách house passed, creative approved, cap `meta_ads_ops.launch`.

1. `/meta/ads-ops` → tab Launch.  
2. Chọn client house, template **`re_lead_default`**.  
3. Preflight xanh (hoặc PO tick ack).  
4. Launch **ba lần** (hoặc 1 campaign / 3 ad set nếu worker hỗ trợ):

| campaign_name | adset_name | ad_name | Ngân sách/ngày (VND) |
|---------------|------------|---------|----------------------|
| `PTT \| Lead \| Audit15 \| 2026-09` | `AS \| H1 pain` | `AD \| H1 15` | 300.000 |
| cùng campaign (hoặc `… \| H2`) | `AS \| H2 agency` | `AD \| H2 15` | 125.000 |
| cùng campaign (hoặc `… \| H3`) | `AS \| H3 face` | `AD \| H3 15` | 75.000 |

5. Form = `PTT Audit CPL 2026-09`. CTA nút **Đăng ký** hoặc **Tìm hiểu thêm**. Placement Reels + feed.  
6. **Không** submit H1-30. Ad set `AS | H1 30 scale` để paused.  
7. Theo dõi `/crm/campaign-writes` đến khi worker tạo campaign.  
8. Ads Manager: kiểm CTA ≠ Gọi ngay; primary text lấy từ `vo-scripts.md`; không có chữ AI.

Primary text khóa:

- H1: `Ngân sách chạy. Inbox im. Để lại SĐT — PTT chỉ chỗ đang thủng.`  
- H2: `Agency gửi slide. Bạn cần khách. PTT đo Spend–lead–CPL trên một màn.`  
- H3: `Đừng tăng ngân sách nếu lịch không tăng. Audit 15 phút — không 40 slide.`

---

## 8. Ngày 0 — kiểm vòng kín

1. Submit **một lead test** từ form (SĐT thật của team).  
2. `/crm/leads` — có dòng source Facebook, có SĐT.  
3. Mở chi tiết → `meta.raw_field_data` đủ 5 key.  
   - `fetch: pending_token` → sửa page token **trước khi** tăng spend.  
4. `/meta/facebook-ads` — **Map** campaign vào khách house.  
5. `/meta/tracking` — CAPI không phình `pending`.  
6. 10 phút không thấy lead → **pause ads**.

Offer khi AM gọi: audit 15 phút — (1) creative gãy chỗ nào, (2) form lấy sai người, (3) CPL đắt vì đâu. SĐT trên video `0900 353 9226` chỉ phụ (H1-30); event tối ưu vẫn là form.

---

## 9. Ngày 7 — giữ / cắt / scale

Trên `/meta/facebook-ads`: Spend, Lead CRM, CPL, hook rate (3s view) theo từng ad set.

Qualific ≥ 70% = lead có **công ty + band ngân sách + kênh** đúng ASCII. Export `raw_field_data` rồi tính (dev có thể dùng `leadFormQualificRate` trong `ptt-fb-lead-form.util.ts`).

| Điều kiện | Việc |
|-----------|------|
| 0 lead (`rate` null) | Không scale |
| Qualific < 70% | Sửa form, không bật H1-30 |
| H3 hook < H1 và H2 hơn 30% | Pause H3 trước |
| H1 CPL form ≤ baseline call-only (hoặc tốt nhất 3 hook) | Giữ H1 |
| H1 thắng + qualific ≥ 70% | QC đủ 4 file rồi launch `AS \| H1 30 scale` |
| Meta chặn vì người AI | Cắt ngắn mặt / làm lại take. **Không** tự burn `Hình ảnh AI` trừ khi PO bắt |

Ghi quyết định vào cuối `launch-brief.md`.

---

## 10. Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Xử lý |
|------------|-------------|--------|
| Jest `filename_mismatch` | Tên file ≠ `ptt-lead-h1-15.mp4` … | Đổi tên, sửa facts |
| `face_too_long` | H1 0–2.5 + 11.5–15 = 6s | CTA mặt từ **12.0s**; 11.5–12.0 giữ UI |
| `ai_label_on_creative` | Primary / caption có «Hình ảnh AI» | Xóa chữ |
| Qualific 0% | Dropdown `20–50` hoặc `chưa chạy` | Đổi value ASCII, form mới |
| Ads Ops `creative_not_approved` | Hub chưa approved | Duyệt `/crm/creatives` |
| Ads Ops `preflight_not_ready` | Launch QA / tracking thiếu | `/crm/launch-qa`, `/meta/tracking` |
| Lead không vào CRM | Token / webhook | Tracking; pause ads |
| Menu Ads Ops ẩn | Flag / cap | `PTT_META_ADS_OPS_ENABLED` + `meta_ads_ops.launch` |
| Không thấy CP OS | Thiếu cap | `crm_cp.view` rồi login lại |

---

## Phụ lục — lệnh một chỗ

```bash
# Probe
./scripts/probe_ptt_fb_lead_video.sh ~/Movies/ptt-fb-lead/out/ptt-lead-h1-15.mp4

# QC pack (thay path facts)
cd services/ptt-crm-api
PTT_LEAD_QC_FACTS=$HOME/Movies/ptt-fb-lead/out/qc-facts.json \
  npx jest src/cp/ptt-fb-lead-video-qc.pack.optional.spec.ts --no-coverage

# Unit (dev)
npx jest src/cp/ptt-fb-lead-video-qc.util.spec.ts \
  src/webhooks/ptt-fb-lead-form.util.spec.ts --no-coverage
```
