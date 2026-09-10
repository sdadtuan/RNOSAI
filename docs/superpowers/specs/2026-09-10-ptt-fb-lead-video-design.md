# Design: PTT Facebook Lead — video 9:16 thắng feed

**Ngày:** 2026-09-10  
**Trạng thái:** Chờ duyệt spec  
**Document ID:** PTT-FB-LEAD-VIDEO-20260910  
**Nguồn footage cũ:** `/Users/quoctuan/Downloads/PTT MKT.mp4` (9:16, 1080×1920, ~48.8s) — **không** dùng làm master  
**Khớp:** [Creative Production OS](./2026-09-07-creative-production-os-srs.md) · [Video SOP BR-15](./2026-08-20-video-sop-module-7-design.md) · Meta Ads Ops template `re_lead_default` · [Hướng dẫn Meta Ads](../../huong-dan-su-dung/05-meta-ads.md)

**Quyết định sản phẩm đã khóa**

1. Mục tiêu ads: **Lead** (`OUTCOME_LEADS` / `LEAD_GENERATION`), Instant Form — không tối ưu cuộc gọi.  
2. Creative = **performance pack** (15s chính), không brand-film 49s.  
3. Talent trên hình: **một nhân vật AI** (Advisor), không quay người thật, không nhận founder/AM có tên.  
4. **Không** burn chữ `Hình ảnh AI` / `Hình ảnh minh họa bằng AI` lên video, caption, hay primary text.  
5. Proof = **UI thật** trên `rs.pttads.vn` (blur khách). Cấm số case bịa.  
6. Làm pack + ingest CP OS + launch Ads Ops. Không regenerate phim AI stock trong Video Studio cho wave này.

---

## 1. Vấn đề

Clip `PTT MKT.mp4` thua creative Lead đang chạy trên feed VN: mở 0–2s trừu tượng, caption dính chữ, dashboard tiếng Anh giả (`VIDEEO`), CTA SĐT (tối ưu call), look phòng họp AI, 49s / file nặng.

Bản cắt 15s + thêm khoảng trắng **không đủ**. Đối thủ thắng bằng nỗi đau cụ thể, offer audit, talking-head, và màn hình ads/CRM. PTT thắng khi show **vòng kín** đã có: Creative QC → Instant Form → `crm_leads` — không giả TVC.

---

## 2. Phạm vi

| Trong scope | Ngoài scope |
|---|---|
| 4 file: H1/H2/H3 15s + H1-30 | Brand-film 49s, YouTube 16:9 |
| Character bible + prompt talent AI | Quay người thật, clone mặt staff |
| Script VO + caption + primary text | Số case / % CPL khi chưa có số được phép |
| Instant Form + thank-you | Landing page riêng, click-to-call là optimization |
| QC CP OS + ingest 9:16 | Model render mới trong CP Video Studio |
| Launch brief `re_lead_default` | Đổi schema Ads Ops, webhook lead (đã có) |
| Flag nội bộ `contains_human` + `ai_disclosure` | Dòng chữ AI trên khung hình / copy feed |

---

## 3. Định vị

**Một câu:** PTT bán máy lấy lead — chiến lược → creative đạt QC → form → CRM trong phút — không bán “làm marketing” hay slide cuối tuần.

**Đối thủ bị đánh:** agency chỉ tối ưu spend + gửi Excel.  
**Tone:** chủ DN đang đốt ads. Câu ngắn. Không TED Talk, không “chiến lược đúng trước — ngân sách sau”.

**Cấm claim:** «Tôi là founder / giám đốc PTT», họ tên giả, «CPL giảm X%», «cam kết doanh thu» trên video.

---

## 4. Hệ visual

| Lớp | Tỷ lệ | Luật |
|---|---|---|
| Talent AI | H1/H2/H1-30 ≤ 5.5s; H3 ≤ 7s | H1 hook 0–2.5 + CTA 11.5–15. H2 chỉ CTA 12–15. H3 = 0–3 + 11–15 |
| UI thật | Phần còn lại của phần giữa | Creative OS QC, Meta Ads Ops (Spend/CPL), lead vào CRM. Blur tên khách |
| Type card | CTA / beat 30s | Nền `#07152e`, accent `#2a6cff` / `#ff715d`, ≤ 6 từ/dòng |

Khác:

- 9:16, 1080×1920, 30 fps, H.264 + AAC, target ≤ 25 Mbps, ≤ 30 MB/file.  
- Logo **PT** góc phải, cách mép trên ≥ 110px.  
- Caption: Be Vietnam Pro / Inter, trắng + stroke đen, **cách từ**, neo **phần trên 1/3** khung (không đáy — Reels che).  
- Safe zone đáy: **280px** trống (CTA Meta + caption hệ thống).  
- Nhạc: bed căng, duck −12 dB khi có thoại.  
- Cấm: phòng họp AI, funnel stock, typo, dashboard fake tiếng Anh, mặt từ `PTT MKT.mp4`, CTA “gọi ngay” làm primary.

---

## 5. Talent AI (character bible)

Một face ID cho cả pack. Gắn Brand Kit / `vd_character_bibles` nếu project SOP; không lấy avatar thư viện generic.

| Thuộc tính | Giá trị khóa |
|---|---|
| Vai | Advisor PTT — **không tên** |
| Tuổi / giới | 32–38, nữ |
| Ngoại hình | Việt, da sáng trung, không makeup búp bê, không da nhựa |
| Tóc / đồ | Buộc hoặc ngang vai gọn; sơ mi trắng hoặc navy; không blazer studio stock |
| Nền | Tường `#0b2147` hoặc cửa sổ lệch, nông DOF |
| Ánh sáng | Key trái, fill nhẹ, không rim vàng cinematic AI |
| Khung | 9:16, nhìn ống kính, headroom 12–15%, vai–đầu ~60% |

**Thời lượng mặt:** H1/H2/H1-30 ≤ **5.5s**. H3 ≤ **7s** (0–3 + 11–15). Giữa clip = UI `rs.pttads.vn`. Không monologue 15s.

**Thoại:** thu **giọng người Việt** (mic), lipsync lên mặt. Không TTS làm bản chính. Miệng lệch > 2 khung = loại take.

**Nhãn AI trên creative:** không. Không watermark, không end-card, không primary text.  
**Nội bộ:** Video SOP / CP QC ghi `contains_human=true`, `ai_disclosure=true` (BR-15). Ops không đưa cờ này ra copy khách.  
**Ads Manager:** nếu form publish bắt checkbox nội dung tạo bằng AI thì tick lúc launch — **không** biến thành chữ trên video.

---

## 6. Script

Nhịp: câu ngắn, nghỉ ~0.2s sau hook. Giọng 28–40 tuổi, một vùng miền cho cả pack.

### 6.1. H1 — Đốt ngân sách (15s, 60% budget)

| t | Màn | Caption | VO |
|---|---|---|---|
| 0.0–2.5 | Mặt AI | `Bạn đang trả tiền cho click.` | «Bạn đang trả tiền cho click — không phải cho khách.» |
| 2.5–3.5 | Cắt UI | `Không phải cho khách.` | (kéo nốt câu trên) |
| 3.5–7.5 | QC fail → pass | `Creative đạt — form mới ăn.` | «Creative không đạt QC thì form không ăn.» |
| 7.5–11.5 | Form → lead CRM | `Lead vào CRM trong phút.` | «Lead vào CRM trong phút. Không chờ báo cáo thứ Hai.» |
| 11.5–15 | Mặt AI + type | `Audit 15 phút — miễn phí.` | «Để lại SĐT. PTT audit CPL và creative — 15 phút.» |

**Primary text:** Ngân sách chạy. Inbox im. Để lại SĐT — PTT chỉ chỗ đang thủng.

### 6.2. H2 — Agency báo cáo (15s, 25% budget)

| t | Caption | VO |
|---|---|---|
| 0–1 | `Agency gửi slide.` | «Agency của bạn gửi slide.» |
| 1–4 | `Bạn cần khách.` | «Bạn cần khách.» |
| 4–9 | UI Ads Ops + CPL | «PTT đo Spend, lead, CPL trên một màn — không Excel cuối tuần.» |
| 9–12 | Field form | «Form lấy đúng người quyết định. Không lấy cho đủ số.» |
| 12–15 | Mặt AI · `Audit funnel — 0đ` | «Điền form. Audit funnel không lấy phí.» |

**Primary text:** Agency gửi slide. Bạn cần khách. PTT đo Spend–lead–CPL trên một màn.

### 6.3. H3 — Cắt mặt + UI (15s, 15% budget)

Không monologue 15s.

| t | Màn | VO |
|---|---|---|
| 0–3 | Mặt AI | «Đừng tăng ngân sách nếu lịch tư vấn không tăng.» |
| 3–11 | QC + CRM | (nhạc; caption `Audit creative · form · CPL`) |
| 11–15 | Mặt AI | «Audit 15 phút. Không pitch 40 slide.» |

**Primary text:** Đừng tăng ngân sách nếu lịch không tăng. Audit 15 phút — không 40 slide.

### 6.4. H1-30 — Scale khi H1 thắng

0–8s = H1.  
8–18s: ba beat UI `Chiến lược` → `Creative QC` → `Form → CRM`.  
18–26s: «Không cam kết doanh thu trên video. Cam kết quy trình đo được.»  
26–30s: type `Audit 15 phút` + logo. SĐT `0900 353 9226` **phụ**, góc nhỏ, ngoài 280px đáy — primary vẫn form.

---

## 7. Offer + Instant Form

**Offer:** Audit 15 phút — trả trên Zalo/call: (1) chỗ creative gãy, (2) form lấy sai người, (3) CPL đắt vì đâu.

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| Họ tên | Có | |
| SĐT | Có | |
| Tên công ty | Có | B2B |
| NS ads / tháng | Có | `<20tr` / `20–50` / `50–100` / `>100` |
| Kênh đang chạy | Có | Meta / TikTok / Google / chưa chạy |

Headline form: `Nhận audit CPL + creative — 15 phút`. Privacy bắt buộc. Thank-you: AM liên hệ giờ hành chính.  
Cấm field dài. SĐT trên video không phải optimization event.

Webhook form → `crm_leads` + CAPI: giữ luồng hiện có, không invent ingest mới.

---

## 8. Pack media + Ads Ops

| File | Ad set | Ghi chú |
|---|---|---|
| `ptt-lead-h1-15.mp4` | Hook pain | 60% ngân sách test |
| `ptt-lead-h2-15.mp4` | Hook agency | 25% |
| `ptt-lead-h3-15.mp4` | Hook cắt mặt | 15% |
| `ptt-lead-h1-30.mp4` | Scale | Bật khi hook rate H1 ổn |

Cùng 1 Instant Form. Template `re_lead_default`. Một hook / ad set.  
CTA nút: **Đăng ký** / **Tìm hiểu thêm** → form. Không **Gọi ngay** làm CTA chính.

---

## 9. CP OS + QC (gate trước launch)

Ingest 4 file vào `/crm/creative-os` (9:16). QC chặn launch nếu fail:

| Check | Pass |
|---|---|
| Technical | 1080×1920, 15s hoặc 30s ±0.2s, có audio |
| Safe area | Không chữ / logo / SĐT trong 280px đáy và 110px trên |
| Caption | Có cách từ; không overflow; neo trên 1/3 |
| Logo | Mark PT đúng Brand Kit, góc phải |
| CTA | Offer audit + form; không call-only |
| Talent | H1/H2/H1-30 ≤ 5.5s mặt; H3 ≤ 7s; một face ID; không claim founder |
| UI | Có ≥ 1 shot `rs.pttads.vn` (H1, H2, H1-30 bắt buộc; H3 bắt buộc đoạn 3–11s) |
| Claim | Không % CPL / doanh thu bịa |
| Nội bộ | `contains_human` + `ai_disclosure` trên metadata SOP/CP — không hiện trên file |
| Loudness | Thoại rõ, nhạc duck |

Launch brief Ads Ops chỉ nhận version QC **passed**.

---

## 10. Thắng / thua (7 ngày, cùng ngân sách)

| Metric | Đạt |
|---|---|
| Hook rate 15s | ≥ clip cũ cùng account (hoặc ≥ 25% 3s view nếu chưa có baseline) |
| CPL Instant Form | ≤ baseline call-only nếu đang chạy SĐT |
| Qualific | ≥ 70% lead có công ty + NS ads |
| QC | 4 file passed trước khi scale H1-30 |

Kill H3 trước nếu hook rate thấp hơn H1/H2 > 30% tương đối.

---

## 11. Wave triển khai (sau plan)

1. Thu VO + render talent AI theo bible §5; screen-record UI (blur).  
2. Edit 4 file theo §6; caption; mix.  
3. Ingest + QC §9.  
4. Tạo Instant Form §7.  
5. Launch 3 ad set 15s qua Ads Ops; H1-30 paused.  
6. Ngày 7: giữ hook thắng, scale H1-30 hoặc kill.

Không sửa Nest/Next trừ khi QC checklist CP thiếu item §9 (wave code riêng, plan tách).

---

## 12. Lỗi / biên

| Tình huống | Xử lý |
|---|---|
| Lipsync fail | Quay lại take; không ship TTS |
| Không vào được UI prod | Dùng staging `rs` + data demo; vẫn cấm mock tiếng Anh |
| Có 1 KPI case được phép | Chỉ gắn H1-30; không sửa 3 hook 15s trong tuần test |
| Meta chặn ad vì người AI | Sửa take / giảm mặt; không thêm chữ “Hình ảnh AI” lên video trừ khi policy bắt **trên creative** (lúc đó PO quyết, không tự burn) |
