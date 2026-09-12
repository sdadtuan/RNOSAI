# Software Requirements Specification

# Media Supply & Outcome OS — Competitive Win (MSOS-WIN)

| Thuộc tính | Giá trị |
|---|---|
| Tên | PTT Media OS — thắng đối thủ trên booking publisher |
| Mã tài liệu | SPEC-MSOS-WIN-2026-09-12 |
| Phiên bản | **1.0 — Publisher booking close** |
| Cha | [`2026-09-12-media-supply-outcome-os-design.md`](./2026-09-12-media-supply-outcome-os-design.md) · **SPEC-MSOS v1.0** (không thu hồi) |
| UI vận hành | [`../mocks/2026-09-12-media-supply-outcome-os-win.html`](../mocks/2026-09-12-media-supply-outcome-os-win.html) — **contract WIN**; 8 màn kế thừa v1.0 |
| UI kế thừa | [`../mocks/2026-09-12-media-supply-outcome-os.html`](../mocks/2026-09-12-media-supply-outcome-os.html) — token, sidebar, xương sống, cổng §4 khóa |
| Pilot | Inventory **PTT** + **một partner thật** + **một property publisher** (vd. homepage banner trên site partner — case VnExpress) |
| Persist HTML | `localStorage` key `msos-ops-v1-win` (tách `msos-ops-v1`) |
| Trạng thái | Draft — plan sẵn, chưa code |
| Plan | [`../plans/2026-09-12-media-supply-outcome-os-win.md`](../plans/2026-09-12-media-supply-outcome-os-win.md) |

**Tuyên bố kế thừa:** Mọi khóa v1.0 vẫn đúng. Tài liệu này **không** clone Client 360, invoice, AI chat, knowledge; **không** DSP/SSP; **không** bật cổng C / connector write / portal partner / recon-close đủ (§4 cha); **không** seed Nova / Sunlight / Tâm An / mạng giả trên prod.

---

## 1. Vì sao phải viết tiếp

MSOS v1.0 đã khóa **hệ điều hành**: 8 màn, entity sở hữu vs tham chiếu, xương sống, cổng GT-01…08, AI A0–A5.

Nhân viên **chưa thắng** Excel + email + portal Admicro/VnExpress trên việc họ làm mỗi tuần:

1. **Giữ đúng chỗ** — Excel chồng lịch; overbook phát hiện sau khi đã hứa khách.  
2. **Ra IO sạch** — Word/PDF rời, không dính `media_line_id`, rate version, brand-safety.  
3. **Traffic creative** — Chat gửi file; thiếu spec (size, weight, click URL, backup).  
4. **Chứng minh đã chạy** — Screenshot Drive; không pack, không freshness, không discrepancy.  
5. **Make-good / lệch số** — Mail qua lại; margin vẫn tính đủ dù thiếu impression.  
6. **Hóa đơn** — Finance hỏi “chạy chưa?” vì không có evidence official.

Thắng = **một booking publisher** (banner VnExpress hoặc tương đương) đi hết xương sống **trong Media OS**, vẫn cổng người, vẫn ref CRM/Finance. Không rời sang Excel để giữ chỗ / IO / proof.

Không thắng = DSP, nhiều partner, portal publisher, che giá mua, tự push ad server.

---

## 2. Ba hướng — đã chốt A

| | A — Publisher booking close | B — Trading / yield | C — Clone Mediaocean |
|---|---|---|---|
| Làm | IO + traffic + safety + make-good + discrepancy + evidence pack trên 8 màn | Đa partner, yield, rebate | ERP, DSP, đa entity |
| Thắng ai | Agency Excel + email + portal rời | Holding / Admicro yield | Mediaocean |
| Rủi ro | IO/file + partner thật | Phá 1-partner Wave 1 | Trùng Finance, scope nổ |

**Chốt: A.** B/C = wave sau hoặc ngoài MSOS.

---

## 3. Case thắng (bắt buộc trên mockup + UAT)

Khách CRM `client_id` có sẵn book **1 placement banner** trên **1 property** của partner pilot (minh họa: homepage billboard, desktop, 7 ngày). PTT không sở hữu ad server VnExpress.

| Bước ngoài MSOS | Bước trong MSOS |
|---|---|
| Đàm phán / gửi IO PDF cho Admicro | Tạo IO nội bộ + bind rate published + reserve |
| Upload creative lên portal partner | Traffic pack + gate; ref Creative OS |
| Partner chạy | Line Live (người) |
| Báo cáo / screenshot | Evidence pack official |
| Thiếu impression | Make-good case; margin trừ |
| Xuất HĐ | Request Finance — không issue |

---

## 4. Entity WIN (MSOS sở hữu thêm)

Không phải CRM. Không phải invoice.

| Entity | Việc |
|---|---|
| `InsertionOrder` | IO nội bộ: số IO, period, placement, rate version, qty, sell, buy, brand-safety snapshot, `media_line_id`. Append-only revision |
| `CreativeTrafficPack` | Creative ref + kích thước + weight + click URL + backup + status (Draft / Submitted / Approved-by-partner / Rejected) |
| `BrandSafetySnapshot` | Copy exclusions + category + alcohol/pharma flag tại thời điểm IO lock |
| `EvidencePack` | Tập evidence của 1 line: IO, screenshot, partner report, hash, freshness → official / draft |
| `DiscrepancyCase` | Plan/IO vs partner report vs evidence; tolerance; root-cause hypothesis. **Không** lock period Finance |
| `MakeGood` | Qty/value bù; gắn line gốc; cộng capacity make-good; trừ margin nếu chưa bù |

Vẫn chỉ **tham chiếu:** Client, Brand, Opportunity, Lead, Invoice, Creative item (`creative_id`).

---

## 5. Cổng thắng (thêm, không thay GT-01…08)

| ID | Cổng | Pass | Fail |
|---|---|---|---|
| GT-P01 | IO issue | Rate published + reserve hard hoặc soft còn hạn + CRM `client_id` + safety snapshot | Không Live |
| GT-P02 | Traffic ready | Pack đủ spec + click URL https + backup (nếu placement bắt) + creative ref | Line không Live |
| GT-P03 | Partner confirm | IO marked `confirmed` (người; đính email/PDF). Portal partner = §4.4 **không** | Warning; Live cần override đúng role |
| GT-P04 | Evidence pack official | ≥ 1 proof + source + hash + freshness trong SLA | Không request invoice; waterfall không “closed” |
| GT-P05 | Discrepancy | Lệch ≤ tolerance **hoặc** case mở + chủ | Request invoice bị chặn nếu material |
| GT-P06 | Make-good | Qty thiếu → case; không im lặng cộng đủ delivery | Cấm ghi actual = plan khi report thiếu |
| GT-P10 | Finance request | GT-P04 official **và** (GT-P05 pass hoặc waiver Controller) | Nút request invoice khóa; 0 số HĐ MSOS |

GT-03 Live v1.0 **mở rộng:** Pass GT-P01 + GT-P02; GT-P03 Warning vẫn Live nếu override. AI **không** override.

---

## 6. FR thắng

| ID | Tên | Tóm tắt |
|---|---|---|
| MSOS-WIN-001 | Publisher placement | Property + placement + unit (slot/ngày, CPM, package/tuần) + brand-safety tier |
| MSOS-WIN-002 | Capacity conflict | Soft/hard/waitlist; overbook → case P0; calendar tuần trên Inventory |
| MSOS-WIN-003 | IO workspace | Tạo/revision IO; PDF/export; bind `media_line_id`; không phải invoice |
| MSOS-WIN-004 | Traffic pack | Checklist spec; ref Creative OS; Rejected chặn Live |
| MSOS-WIN-005 | Brand-safety lock | Snapshot vào IO; đổi exclusion sau lock = change control + duyệt |
| MSOS-WIN-006 | Evidence pack | Gom file + connector (nếu có) thành pack; official = GT-P04 |
| MSOS-WIN-007 | Discrepancy lite | So IO vs report; tạo case; **không** close calendar / FX / AR |
| MSOS-WIN-008 | Make-good | Tạo từ discrepancy; capacity bù; waterfall hiện make-good cost |
| MSOS-WIN-009 | Publisher Live gate | UI checklist GT-P01–P03 trước nút Live (người) |
| MSOS-WIN-010 | Finance request guard | Nút request invoice chỉ khi **GT-P10**: GT-P04 + (GT-P05 pass hoặc waiver Controller) |

AI: draft IO / traffic note / discrepancy narrative = A1. Không tự issue IO, không tự confirm partner, không tự make-good, không tự invoice.

---

## 7. Mục tiêu thắng (business)

| ID | Mục tiêu | Cửa UAT | Không đo |
|---|---|---|---|
| BG-WIN-01 | Booking publisher **không Excel** | 1 property thật: reserve → IO → traffic → Live → pack → request Finance | Số site |
| BG-WIN-02 | Overbook không im lặng | 1 conflict hiện P0 + không hard-reserve chồng | Thuật yield |
| BG-WIN-03 | IO = SoT chỗ/giá | Line Live có `io_id` + rate version | Chữ ký số luật |
| BG-WIN-04 | Thiếu delivery → make-good | 1 case từ report < IO qty | Tự đàm phán partner |
| BG-WIN-05 | Zero AI Live / IO issue / invoice | 0 | — |
| BG-WIN-06 | CRM/Finance không clone | 0 Client/Invoice insert từ MSOS | — |

BG v1.0 **giữ**.

---

## 8. Ngoài phạm vi WIN (cố định)

- DSP / RTB / tự push VnExpress ad server / Admicro API write.  
- Đa partner, cổng C, portal partner, recon/close đủ, connector write Meta (§4 cha).  
- Clone Client 360, invoice UI, knowledge, AI runtime.  
- Seed Nova / Sunlight / Tâm An / “Admicro giả” trên prod. Mockup được **minh họa** property kiểu VnExpress với nhãn “dataset minh họa”.  
- Incrementality, data-driven attribution.

---

## 9. IA — 8 màn, state thắng

Không thêm màn. Mỗi màn có state WIN:

| Màn | State thắng |
|---|---|
| Command | P0 overbook / P0 evidence / P1 make-good; không AR aging CRM |
| Inventory | Property publisher + capacity tuần + conflict |
| Packages | Reserve → **Tạo IO** |
| Campaigns | Line + Publisher Live Gate + traffic status |
| Evidence | Evidence pack + discrepancy lite |
| Outcomes | UTM → CRM (giữ v1.0) |
| Margin | Waterfall + dòng make-good; request invoice theo GT-P10 |
| Governance | Policy IO / safety / discrepancy tolerance; C vẫn khóa |

---

## 10. Chấp nhận WIN (go-live pilot)

1. Một property publisher **thật** dưới partner pilot + inventory PTT.  
2. Một booking: capacity → package → reserve → IO → traffic → Live (người) → evidence pack → discrepancy/make-good nếu thiếu → request Finance. Cùng `media_line_id`.  
3. Overbook bị case; 0 hard-reserve chồng im lặng.  
4. 0 invoice MSOS; 0 Client insert.  
5. 0 AI issue IO / confirm partner / Live / make-good close.  
6. Flag `MEDIA_OS_ENABLED=0` → CRM không vỡ.  
7. URL `/meta/*` `/google/*` `/zalo/*` không đổi.

---

## 11. Wave gợi ý (chưa plan)

| Wave | Việc |
|---|---|
| W1-core | v1.0: catalog PTT + 1 partner, xương sống |
| W1-win | WIN-001…010 trên 1 property publisher |
| W2+ | §4 cha (connector write, C, recon sâu, portal) |

Plan: [`../plans/2026-09-12-media-supply-outcome-os-win.md`](../plans/2026-09-12-media-supply-outcome-os-win.md) · W1-core + W1-win cùng file. W2+ §4 ngoài plan.

---

## 12. Khóa không đàm phán

BR-MSOS-01…08 của cha **giữ**. Thêm:

| ID | Khóa |
|---|---|
| BR-MSOS-WIN-01 | IO ≠ invoice |
| BR-MSOS-WIN-02 | Không ghi actual = plan khi report thiếu (GT-P06) |
| BR-MSOS-WIN-03 | Không tự push ad server publisher |
| BR-MSOS-WIN-04 | Mockup WIN = contract UI; ops-web phải parity state cổng |

---

**Cổng tài liệu:** spec + mockup đã duyệt. Plan W1+WIN đã viết. Chưa code cho đến khi chọn cách chạy plan.

**Kết thúc SPEC-MSOS-WIN v1.0.**
