# Intake BANT Checklist Phase 1 — Design Spec

> **Document ID:** INT-BANT-CL-P1-20260830  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-30  
> **Trạng thái:** Implemented  
> **Route:** `/crm/intake?lead_id=` · `/crm/intake?lifecycle_id=` (ops-web)  
> **Quyết định:** Discovery = sự thật từ KH · drawer **BANT** = AM tick 1 dòng/mục · máy ghi `bant_json` · Qualify **không** còn radio 1–5 · copy **Đủ Tư vấn** (không “Đủ chốt / Đủ Go”)  
> **Parent:** [INT-P1](../../specs/2026-08-04-intake-bant-phase1-professional-ui-design.md) · [INT-P2](../../specs/2026-08-04-intake-bant-phase2-structured-discovery-design.md) · [INT-SK](./2026-08-29-intake-deal-bar-sales-kit-design.md) · [Checklist presales](../../crm/checklist-presales-thu-thap-yeu-cau-khach-hang.md)  
> **Đã ship trước spec:** drawer BANT + `answers_json.bant_checklist` + `IntakeBantChecklistPanel` (`9fd4c376`) — Phase 1 **gỡ radio**, gắn tag Discovery, gợi ý bước tiếp, đổi copy

---

## 1. Tóm tắt

AM đang chấm BANT **ba lần**: ghi Discovery → bấm radio 1–5 trên Qualify → (mới) tick checklist trong drawer. Phase 1 **một nguồn điểm**: lời KH ở Discovery, AM đối chiếu trong drawer BANT, hệ thống ra `/30` và **gợi ý bước tiếp** (hỏi thêm / nuôi / chuyển Tư vấn).

Qualify giữ **Quyết định + Lý do + Red flags + Lead—Qualify**. Khối radio 1–5 biến mất. Deal Bar và badge nói **Đủ Tư vấn**, không hiểu nhầm “đủ ký HĐ”.

**Pitch 1 câu:** Đang gọi — hỏi Discovery, bấm BANT, tick đúng câu KH vừa nói — máy chấm và chỉ bước tiếp; không bấm số cảm tính trên Qualify.

---

## 2. Mục tiêu & phạm vi

### 2.1. Mục tiêu

| # | Mục tiêu | Đo thành công |
|---|----------|----------------|
| G1 | Một chỗ chấm điểm BANT | Không còn radio 1–5 trên tab Qualify; `bant_json` chỉ đổi từ drawer (hoặc Sales Kit Áp dụng `bant_hints` đã confirm) |
| G2 | Discovery là nguồn câu hỏi | 6 nhóm BANT map được sang `question_items.key`; UI Discovery hiện nhóm (nhãn nhỏ) |
| G3 | Máy chấm từ checklist | Tick 1 dòng/mục → điểm 1–5; tổng live; badge Go ≥24 / Nurture 18–23 / No-Go &lt;18 **không đổi ngưỡng** |
| G4 | Gợi ý bước tiếp trong drawer | Sau mỗi lần tick (hoặc mở drawer): 1 khối “Bước tiếp theo” theo bảng §5.3 |
| G5 | Copy không = chốt HĐ | Mọi chuỗi AM thấy “Đủ Go” / “Còn N để Go” → **Đủ Tư vấn** / **Còn N để Tư vấn** |
| G6 | Cảnh báo tick ảo | Tick BANT mà Discovery nhóm đó chưa có bằng chứng → warn trong drawer; **không** chặn tick, **không** chặn Complete (chỉ warn Complete nếu mục = 0 như INT-P1) |
| G7 | Không phá gate | Complete / consult-gate / Sales Kit `gap_to_go` dùng cùng `bant_json` + `GO_THRESHOLDS` 24/18 |

### 2.2. In scope

- Gỡ `IntakeBantScoreRow` khỏi Qualify; `IntakeBantSection` chỉ còn total bar + mismatch quyết định + CTA “Mở checklist BANT”.
- Tag `bant_key` trên `IntakeQuestionItem` (ops-web + API definition).
- Nhãn nhóm trên checklist Discovery (Budget / Authority / …).
- Drawer BANT: khối gợi ý bước tiếp + warn thiếu Discovery.
- Copy Deal Bar, Sales Kit chip “Còn thiếu để Go” **giữ label chip**; text **trong reply** có thể vẫn nói “Go” theo spec kit (quyết định nội bộ). Deal Bar / drawer / Qualify badge: **Tư vấn**.
- Unit: map câu → nhóm, next-step helper, copy `gapToTuVan`, parse checklist.
- E2e: mở drawer BANT, tick Budget 4 → Deal Bar hiện 4 và không còn radio Qualify.

### 2.3. Out of scope (cố ý — Phase 2+)

- Tự chấm BANT từ LLM / từ text Discovery.
- Win-score /30, bắt Win intel trước Consult, MEDDPICC.
- Đổi `GO_THRESHOLDS` 24/18.
- Đổi schema `bant_json` 6 key.
- Bỏ tab Qualify hoặc chuyển Quyết định sang Handoff.
- Ép L2 / cam kết / stakeholder trước Complete.
- Đổi consult-gate (No-Go block, Nurture confirm).
- Đổi Sales Kit 8 intent / kho admin.

---

## 3. Nghiệp vụ Phase 1

```text
Cuộc gọi
  → Tab Discovery: hỏi + tick + ghi trả lời (bằng chứng)
  → Nút Deal Bar "BANT": tick 1 dòng / 6 mục
  → Máy: bant_json + tổng + badge + "Bước tiếp theo"
  → Tab Qualify: xem tổng (chỉ đọc) + chọn Quyết định + RF
  → Hoàn thành phiên → Funnel (không đổi)
```

### 3.1. Discovery

- Giữ bộ câu hiện tại (`_common` + 3 slug pilot). **Không** thêm 5 câu rubrik vào form KH.
- Mỗi `question_item` có `bant_key?: BantKey` (optional). Câu không map (KPI, domain, GSC…) → không gắn.
- AM vẫn tick “đã hỏi” + trả lời ngắn + độ chắc như INT-P2.
- **Bằng chứng nhóm** (để warn drawer): nhóm *có bằng chứng* khi **một** trong các điều kiện:
  1. Có `question_item` cùng `bant_key` mà `checked[key] === true`, **hoặc**
  2. `responses[key].answer` trim không rỗng, **hoặc**
  3. `responses[key].confidence === 'confirmed' | 'partial'`.
- Fit / History trên `_common` phone: map `phone_industry`+`phone_expectation`+`phone_priority_service` → **fit**; `phone_prior_attempts` → **history**. In-person: `ip_icp`+`ip_agency_criteria` → fit; `ip_pain_solutions` (phần đã thử) + `ip_competitors` → history **và** need/history theo bảng §4 — một câu có thể chỉ một `bant_key` (không multi-tag Phase 1).

### 3.2. Drawer BANT (nguồn điểm)

- Đã có: 6 khối × 5 dòng exclusive; tick lại = bỏ (điểm 0).
- Ghi `answers_json.bant_checklist` + `bant_json` (server vẫn `computeBantTotal` on PATCH).
- **Cấm** sửa điểm bằng radio Qualify.
- Sales Kit `bant_hints` + AM confirm Áp dụng: vẫn ghi `bant_json` **và** set `bant_checklist[key] = hint` (đã có `checklistFromBant` khi apply).

### 3.3. Qualify sau Phase 1

| Giữ | Bỏ |
|-----|-----|
| `IntakeBantTotalBar` (chỉ đọc) | `IntakeBantScoreRow` / lưới 1–5 |
| Cảnh báo quyết định lệch badge | Hint “Ngân sách thực tế…” dưới radio |
| Quyết định + Lý do | — |
| Lead — Qualify + Red flags | — |
| Nút phụ “Mở BANT” (mở cùng drawer Deal Bar) | — |

Tiêu đề section: **C. Quyết định** (không “C. BANT + Quyết định” như đang chấm tay). Dòng phụ: “Điểm từ checklist BANT trên Deal Bar.”

### 3.4. Quyết định & Complete

Không đổi rule INT-P1:

- Error: Contact trống; chưa Quyết định; Nurture/No-Go thiếu Lý do.
- Warn: BANT còn key = 0; Discovery dưới min 8/6; Need trống; RF ≥ 2.
- Lệch badge ↔ quyết định: warn inline, không block.

---

## 4. Map Discovery → nhóm BANT

API `GET /api/crm/intake/definitions/:slug` thêm `bant_key` trên từng item (phone + in-person). Ops-web type `IntakeQuestionItem` thêm `bant_key?: BantKey`.

### 4.1. `_common` phone

| `key` | `bant_key` |
|-------|------------|
| `phone_pain_point` | `need` |
| `phone_budget` | `budget` |
| `phone_timeline` | `timeline` |
| `phone_deadline` | `timeline` |
| `phone_decision_maker` | `authority` |
| `phone_prior_attempts` | `history` |
| `phone_industry` | `fit` |
| `phone_expectation` | `fit` |
| `phone_priority_service` | `fit` |
| `phone_service_interest` | `fit` |
| `phone_kpi` | `need` |
| `phone_domain` | — (không map) |

### 4.2. `_common` in-person

| `key` | `bant_key` |
|-------|------------|
| `ip_pain_solutions` | `need` |
| `ip_budget_approved` | `budget` |
| `ip_timeline` | `timeline` |
| `ip_approval_process` | `authority` |
| `ip_icp` | `fit` |
| `ip_agency_criteria` | `fit` |
| `ip_partner_risk` | `fit` |
| `ip_competitors` | `history` |
| `ip_business_goals` | `need` |
| `ip_marketing_team` | — |

### 4.3. Pilot slug

Reuse key chung (`phone_budget`, `phone_decision_maker`, `phone_pain_point`, `phone_timeline`, `seo_history` / `gads_history` → `history`, `seo_domain` → không map). File definition: thêm `bant_key` cạnh `critical` khi build items (cùng chỗ `phone_keys`).

Câu không có trong bảng → `bant_key` omit.

---

## 5. Chấm điểm & gợi ý bước tiếp

### 5.1. Điểm (đã ship, giữ nguyên)

- 1 dòng/mục; rubrik `BANT_CHECKLIST` trong `intake-bant-checklist.ts`.
- Tổng = `computeBantTotal`; 0 không cộng.
- Badge: ≥24 `go` · 18–23 `nurture` · &lt;18 `no_go`.

### 5.2. Warn thiếu bằng chứng

Trong drawer, dưới mỗi mục nếu `selected >= 1` và nhóm **không** có bằng chứng §3.1:

> Chưa có ghi chú Discovery cho mục này. Nên mở Discovery và ghi lời KH trước khi tin điểm.

Không disable checkbox.

### 5.3. “Bước tiếp theo” (một khối, ưu tiên trên xuống)

Helper thuần `nextBantStep(input) → { code, title_vi, body_vi, cta: 'discovery' \| 'qualify' \| 'handoff' }`.

| Thứ tự | Điều kiện | `title_vi` | `body_vi` (ý) | CTA |
|--------|-----------|------------|---------------|-----|
| 1 | Số mục đã chấm (điểm 1–5) &lt; 6 | Còn mục chưa chấm | Liệt kê key còn 0, bảo tick nốt hoặc hỏi Discovery | `discovery` nếu nhóm thiếu bằng chứng, else ở lại drawer |
| 2 | Tổng &lt; 18 | Gợi ý: Từ chối / dừng Tư vấn | BANT n/30 dưới Nurture. Hỏi thêm mục thấp nhất **hoặc** chọn No-Go + lý do | `qualify` |
| 3 | 18 ≤ tổng &lt; 24 | Gợi ý: Nuôi dưỡng | Còn `24 - total` điểm để Tư vấn. Câu gợi ý = hint mục **điểm thấp nhất** (nếu hòa: budget → authority → need → timeline → fit → history) | `discovery` |
| 4 | Tổng ≥ 24 | Gợi ý: Đủ Tư vấn | Chọn Quyết định Go trên Qualify, Hoàn thành phiên, Funnel **Chuyển → Tư vấn** (còn task Lead) | `qualify` |

CTA trong drawer: nút **Mở Discovery** / **Mở Qualify** gọi `onFocusTab` (đã có từ Sales Kit).

Không tự set `decision`. Không tự Complete.

### 5.4. Copy Deal Bar

| Cũ | Mới |
|----|-----|
| `Đủ Go` | `Đủ Tư vấn` |
| `Còn ${gap} để Go` | `Còn ${gap} để Tư vấn` |
| Chip Sales Kit `Còn thiếu để Go` | **Giữ** (AM đã quen); reply kit không đổi Phase 1 |

Hàm: `gapToGo` giữ tên + ngưỡng 24; thêm `gapToConsultLabel(gap)` cho UI Deal Bar / drawer footer.

---

## 6. Dữ liệu & API

| Field | Vai trò Phase 1 |
|-------|-----------------|
| `bant_json` | Điểm 6 key — nguồn gate / kit / Deal Bar |
| `answers_json.bant_checklist` | Điểm đã chọn (trùng `bant_json` sau tick) |
| `answers_json` discovery | Bằng chứng; **không** ghi điểm |
| `GET definitions` | Thêm `bant_key` trên items |

Không migration PG. Session cũ: không `bant_checklist` → `checklistFromBant(bant_json)` (đã có). Radio biến mất: AM chỉ sửa điểm qua drawer.

`GET definitions` thêm field **không** breaking: client cũ bỏ qua `bant_key`.

---

## 7. UI / file chạm

| File | Việc |
|------|------|
| `IntakeQualifyTab.tsx` / `IntakeBantSection.tsx` | Bỏ score grid; total + mismatch + nút mở drawer |
| `IntakeBantScoreRow.tsx` | Ngừng dùng trên Intake (có thể giữ file, không import) |
| `IntakeDealBar.tsx` | Copy Tư vấn |
| `IntakeBantChecklistPanel.tsx` | Warn + khối bước tiếp + CTA tab |
| `IntakeContent.tsx` | Pass discovery evidence + `onFocusTab` vào panel; Qualify không `onBantChange` từ radio |
| `intake-definitions.util.ts` + `IntakeQuestionItem` | `bant_key` |
| `intake-discovery` checklist UI | Chip nhóm cạnh câu |
| `intake-bant-next-step.ts` (mới) | `nextBantStep` + tests |
| `intake-service-resolve.ts` | `gapToConsultLabel` |
| `docs/huong-dan-su-dung` Intake (nếu đã có mục BANT) | 1 đoạn: chấm qua Deal Bar |

---

## 8. Kiểm thử

### 8.1. Unit

- Map: mọi key §4 có `bant_key` đúng; `phone_domain` / `ip_marketing_team` không map.
- `nextBantStep`: 0 mục → code thiếu chấm; total 16 → no_go; 20 → nurture + gap 4; 24 → consult.
- Evidence: checked-only / answer-only / không gì → warn true/false.
- `gapToConsultLabel(0)` = `Đủ Tư vấn`; `(16)` chứa `16` và `Tư vấn`.

### 8.2. E2e / UAT

| ID | Bước | Kỳ vọng |
|----|------|---------|
| U1 | Mở Intake phiên draft | Deal Bar có nút BANT; Qualify **không** có radiogroup 1–5 |
| U2 | Drawer tick Budget dòng 4 | Deal Bar BANT ≥ 4; tab Qualify total tăng; không radio |
| U3 | Tick Budget khi Discovery budget trống | Warn trong khối Budget |
| U4 | Tick đủ 6×4 (24) | Bước tiếp “Đủ Tư vấn” + nút Mở Qualify |
| U5 | Complete + gate | Không regress: Go 24 vẫn CTA Tư vấn; No-Go vẫn block |

Playwright: mở drawer (`getByRole('button', { name: 'BANT' })`), tick label chứa “khung rõ”, assert không `getByRole('radio', { name: '5' })` trong Qualify (hoặc count radio BANT = 0).

---

## 9. Rủi ro & không làm

| Rủi ro | Xử lý Phase 1 |
|--------|----------------|
| AM quen radio Qualify | Nút “Mở BANT” trên section C + Deal Bar |
| Tick 5/5 không có bằng chứng | Warn only |
| Hiểu “Đủ Tư vấn” = ký HĐ | Câu body bước 4: “chưa phải đủ báo giá / HĐ” |
| Definition API quên `bant_key` | Warn drawer coi như không có evidence map → chỉ warn khi có ít nhất 1 item cùng key trong definition hiện tại; nếu definition không item nào cho nhóm → **không** warn (tránh false positive slug cũ) |

---

## 10. Tiêu chí xong Phase 1

- [ ] Qualify không chỉnh được điểm bằng radio.
- [ ] Drawer là UX chấm duy nhất trên Intake (trừ kit apply confirm).
- [ ] Discovery hiện nhóm BANT cho câu đã map.
- [ ] Bước tiếp theo đúng bảng §5.3.
- [ ] Copy Deal Bar: Tư vấn.
- [ ] Unit + U1–U5.
- [ ] Ngưỡng 24/18 và consult-gate không đổi.

**Không** tuyên bố Phase 1 “đủ thắng HĐ”. Đó là Phase 2+ (Win intel bắt buộc, win-score, cam kết bước tiếp).

---

## 11. Self-review

- Không TBD / TODO mở.  
- Không đổi ngưỡng / schema điểm.  
- Phạm vi một plan: UI Qualify + tag definition + next-step + copy.  
- “Go” nội bộ (decision value, kit chip) giữ; **chuỗi AM trên Deal Bar/drawer/Qualify** dùng Tư vấn.
