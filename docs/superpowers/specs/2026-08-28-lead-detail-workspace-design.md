# Lead Detail Workspace — Design Spec (B + khung C nhẹ)

> **Document ID:** LEAD-WS-20260828  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-28  
> **Trạng thái:** Design — chờ PO duyệt trước implementation plan  
> **Route:** `/crm/leads/{id}` (ops-web)  
> **Quyết định:** **B + khung C nhẹ** — Next Best Action + một hành trình + SCI inline; cột Việc ~70% / Timeline+rail ~30%  
> **Không làm đợt này:** command palette, clone HubSpot 3-pane, redesign Deal Room / Intake / CSKH board  
> **Parent UI:** [25-lead-meeting-prep-ui-guide.md](../../huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md) · [26-sales-cockpit-huong-dan-day-du.md](../../huong-dan-su-dung/26-sales-cockpit-huong-dan-day-du.md)

---

## 1. Mục tiêu

Trang lead detail hiện là **bộ sưu tập card** (2 stepper, điểm AI lạnh, nút Sales Cockpit tách, SĐT lặp). AM không biết việc tiếp theo trong 15 phút đầu — đây là chỗ HubSpot/Salesforce thắng.

**Đợt này** biến `/crm/leads/{id}` thành **workspace bán hàng**:

| Persona | % màn | Việc được tối ưu |
|---------|-------|------------------|
| AM B2B first-call | ~70% cột chính | Một việc tiếp theo + script + gọi + log |
| GDKD / trưởng nhóm | ~30% cột phải | Owner, gán, trạng thái, audit, band, timeline |

**Không** tối ưu trang này thành dashboard giám sát (GDKD có `/crm/ai/insights` và kanban).

---

## 2. Phạm vi

### 2.1. In scope

- Gộp 2 stepper (Luồng B2B + Pre-sales) thành **một hành trình** trên overview.
- Khối **Việc tiếp theo (NBA)** trên cùng cột chính, luật ưu tiên cố định (mục 4).
- SCI / Discover **inline** trong NBA khi rule 4–5; hero giữ CTA Cockpit + deep link `?prep=1`.
- Hero: SĐT/email **một lần**; CTA Gọi + Sales Cockpit.
- Rail: bỏ trùng contact; giữ quản trị.
- Form 「Thêm hoạt động」 lên **trên** timeline (cột phải).
- Overlay CSS dưới `html.ops-shell-bitrix` (không file CSS mới).
- Unit test luật NBA (fixture kiểu lead #5).

### 2.2. Out of scope

- API mới (`/meeting-prep` giữ nguyên).
- Command palette, inbox 3-pane.
- Đổi copy trạng thái lead trong DB (「Chờ dọn」 vẫn là status; UI không lấy đó làm tiêu đề việc).
- Deal Room (`/crm/leads/{id}/deal-room`), Intake (`/crm/intake`), CSKH board.
- `LeadConsultWorkspace` (vẫn mở từ NBA rule 7 / CTA Tư vấn).
- Rebuild điểm AI / explainability engine (band chỉ chuyển xuống rail).

---

## 3. Bố cục

### 3.1. Desktop (≥1280px)

```
┌─ Hero ─────────────────────────────────────────────────────────┐
│ ← Leads   #{id}                                                │
│ Avatar  Tên   B2B · {nhãn việc NBA}           [Gọi] [Cockpit] │
│         SĐT · Email (chỉ hero)                                 │
└────────────────────────────────────────────────────────────────┘
┌─ Cột chính ~70% ──────────────┐  ┌─ Cột phải ~30% ────────────┐
│ 1. LeadNextActionCard (NBA)   │  │ Form thêm hoạt động        │
│ 2. LeadJourneyStepper (1)     │  │ Timeline hoạt động         │
│ 3. Funnel / BANT khi tới lúc  │  │ Rail GDKD                  │
│ 4. Contract khi tới lúc       │  │ Owner · Gán · Status       │
└───────────────────────────────┘  │ Audit · Band               │
                                   └────────────────────────────┘
```

Grid hiện có: `.lead-detail-grid--record` trong `bitrix-theme.css`. Đợt này chỉnh tỷ lệ cột + thứ tự DOM; không đổi breakpoint 1280 / 1024.

### 3.2. Tablet (1024–1279) và mobile (<1024)

- Tablet: stack cột phải dưới cột chính; NBA vẫn trên cùng.
- Mobile: giữ tab **Việc | Nhật ký | Quản trị** (map từ `detail | activity | ai` hiện tại: `detail` = Việc, `activity` = Nhật ký, rail/status = Quản trị hoặc gộp vào Nhật ký nếu chỉ 2 tab sẵn có).
  - Tab mobile giữ 3: `Chi tiết` đổi nhãn **Việc**; `Hoạt động` đổi nhãn **Nhật ký**; tab AI Copilot giữ nếu flag. Rail GDKD nằm cuối tab Việc. Không thêm tab thứ 4.
- NBA luôn top tab Việc.

### 3.3. Bỏ / gộp so với as-is

| As-is | To-be |
|-------|--------|
| `LeadB2bSalesFlowBar` + `LeadPresalesFunnelStepper` cùng lúc | **Một** `LeadJourneyStepper` trên overview |
| Nút Sales Cockpit trong `.lead-workspace-links` (mồ côi) | CTA hero + NBA; pane `meeting-prep` chỉ khi AM chủ động hoặc `?prep=1` |
| Card Điểm AI 15 LẠNH trên main | Band trên rail GDKD; AM không thấy score như việc phải làm |
| SĐT/email hero + `LeadPropertyRail` | Chỉ hero (+ `LeadContactActions` Gọi/Copy) |
| Status 「Chờ dọn」 làm tiêu điểm | Badge phụ trên hero; tiêu đề việc = NBA title |
| Form hoạt động dưới đáy cột chính | Cột phải, **trên** list timeline |

`LeadFunnelPanel` (BANT, M1/M2 cards) **không xóa**. Ẩn card M1 trùng khi NBA đã cover first-call (`hideM1Card` giữ / mở rộng). Deal Room banner chỉ hiện khi funnel presales đã qua B2 **và** flag Deal Room bật — không hiện trên lead #5 chưa B2.

---

## 4. Luật Việc tiếp theo (NBA)

### 4.1. Contract

Pure function, không I/O:

```ts
type LeadNextAction = {
  rule: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  title_vi: string;
  body_vi: string;
  primary: { label_vi: string; action: NextActionKind };
  secondary: Array<{ label_vi: string; action: NextActionKind }>; // 0–2
};

type NextActionKind =
  | 'edit_contact'
  | 'save_company_run_prep'
  | 'select_entity'
  | 'wait_prep'
  | 'open_cockpit'
  | 'call_now'
  | 'copy_script'
  | 'complete_b2'
  | 'open_intake'
  | 'copy_m2_brief'
  | 'open_consult'
  | 'handoff_solution'
  | 'wait_handoff'
  | 'advance_presales'
  | 'open_deal_room'
  | 'apply_offer_ladder'
  | 'submit_debrief'
  | 'add_activity';
```

Input: `lead` (phone, email, status) + `funnel.presales` (B2 done) + `prep.status` / `skip_reason` / `debrief_pending` + flags (`leadMeetingPrepEnabled`, `dealRoomEnabled`).

**Một việc chính.** Không render cùng lúc primary của hai rule.

### 4.2. Thứ tự (dừng ở rule đầu khớp)

| Rule | Điều kiện | `title_vi` | Primary | Secondary (≤2) |
|------|-----------|------------|---------|----------------|
| 1 | Không SĐT và không email | Bổ sung SĐT hoặc email | `edit_contact` | — |
| 2 | LMP bật và `awaiting_am_input` | Nhập tên công ty để chạy prep | `save_company_run_prep` | website tuỳ chọn (cùng form) |
| 3 | LMP bật và `awaiting_entity_choice` | Chọn đúng pháp nhân | `select_entity` | — |
| 4 | LMP bật và status `pending` hoặc `running` | Đang chuẩn bị SCI | `wait_prep` (disabled / spinner) | `open_cockpit` |
| 5 | B2 chưa xong và có SĐT | Gọi đầu trong 15 phút | `copy_script` nếu LMP + prep `ready`; không thì `add_activity` | `complete_b2` |
| 6 | B2 xong, Intake chưa Go | Qualify BANT | `open_intake` | `copy_m2_brief` nếu prep ready |
| 7 | Intake Go (`consult`) | Theo `handoff.status`: chưa giao → `handoff_solution`; `pending` → `wait_handoff`; `with_solution` → `open_consult`; `released` → `advance_presales` | secondary: Mở Tư vấn / Copy brief M2 (≤2) |
| 8 | Deal Room flag **và** B2 xong **và** (`prep_stage === 'm3_pre_close'` **hoặc** funnel đã vào giai đoạn báo giá / proposal) | Chuẩn bị buổi chốt | `open_deal_room` | `apply_offer_ladder` nếu prep `ready` |
| 9 | Status `chot` hoặc `lost` và `debrief_pending` | Học từ cuộc chốt | `submit_debrief` | — |
| 10 | Fallback | Xem SCI hoặc nhật ký | `open_cockpit` nếu LMP; không thì `add_activity` | `add_activity` |

**Lead #5 (Tuan Truong) — fixture bắt buộc:** có SĐT, B2 chưa xong, status chờ xử lý → **rule 5**. Badge 「Chờ dọn」 không thay `title_vi`. Nếu prep `running`, rule 4 thắng rule 5 (SCI chưa sẵn — không copy script giả).

### 4.3. Cấm

- Không dùng Điểm AI / band LẠNH làm tiêu đề việc.
- Không bắt AM đổi pane Cockpit mới thấy opening M1 khi rule 5 và prep `ready`.
- Không hiện cùng lúc Gọi + Nhập công ty + Chọn DN.
- Không enqueue prep mới từ NBA trừ CTA đã có (`save_company_run_prep`, `select_entity`).

### 4.4. SCI inline

| Tình huống | UI trong `LeadNextActionCard` |
|------------|-------------------------------|
| Rule 4 | Message `discover_message_vi` hoặc progress 4 bước (reuse `LeadMeetingPrepProgress`) |
| Rule 5 + prep `ready` | 2 dòng opening từ M1 script + 「Xem Talk Track」 → `open_cockpit` |
| Rule 5 + prep chưa ready | Không bịa script; dòng 「SCI đang chạy / chưa có — vẫn gọi được」 |
| Rule 2–3 | Embed form / entity picker hiện có (`LeadMeetingPrepPanel` slices), không nhân đôi API |

Full panel `LeadMeetingPrepPanel` giữ khi `b2bPane === 'meeting-prep'` hoặc `?prep=1`.

---

## 5. Hành trình một stepper

Nhãn cố định (B2B prospect):

1. B2 Liên hệ  
2. Pre-sales  
3. Intake BANT  
4. Tư vấn  
5. Báo giá  
6. HĐ / Agency  

Nguồn: `funnelSnap` + `contractSummary` (cùng data `LeadB2bSalesFlowBar` / `LeadPresalesFunnelStepper`). Step active = bước **chưa xong sớm nhất**. Click step đã mở: cuộn/mở panel tương ứng (Funnel, Intake link, Consult pane, Deal Room, Contract) — không invent wizard mới.

Lead `spa_operational`: **không** hiện stepper B2B; giữ banner CSKH 24h hiện có.

---

## 6. Kiến trúc file

| Đơn vị | Path | Việc | Phụ thuộc |
|--------|------|------|-----------|
| Luật NBA | `services/ops-web/src/lib/crm/lead-next-action.ts` | Pure resolve | lead, funnel, prep DTO |
| Test luật | `lead-next-action.spec.ts` | Rule 1–10 + fixture #5 | vitest |
| Card NBA | `components/crm/LeadNextActionCard.tsx` | Render 1 việc + CTA | flags, callbacks page |
| Stepper | `components/crm/LeadJourneyStepper.tsx` | 1 hành trình | funnel + contract |
| Hero | `LeadDetailHero.tsx` | CTA Gọi/Cockpit; meta contact | `LeadContactActions` |
| Rail | `LeadPropertyRail.tsx` + `lead-property-rows.ts` | Bỏ phone/email khỏi rows | — |
| Page | `app/crm/leads/[id]/page.tsx` | Thứ tự DOM, chuyển form activity | — |
| Theme | `bitrix-theme.css` overlay | Card NBA, grid | `html.ops-shell-bitrix` |

**Không** tạo `*.css` mới. CTA brand: `#17692f` / hover `#114d24`. Một CTA primary PTT mỗi khung (NBA primary **hoặc** Gọi trên hero — nếu hero đã Gọi thì NBA primary rule 5 dùng cùng hành động, không hai nút xanh cạnh nhau: hero Gọi = shortcut; NBA primary trên rule 5 là **Copy script** nếu hero đã có Gọi, **hoặc** hero chỉ hiện Gọi khi rule 5. **Quyết định:** Hero luôn có Gọi nếu có SĐT. Rule 5 primary trên card = **Copy script** (hoặc 「Mở script」); secondary = Hoàn thành B2. Tránh 2 nút Gọi xanh.

---

## 7. Data flow

```
page load
  → fetchLead + fetchLeadFunnel + fetchLeadMeetingPrep (nếu LMP)
  → resolveLeadNextAction(...)
  → LeadNextActionCard
        callbacks: call / copy / completeB2 / runPrep / selectEntity
        / openIntake / openConsult / openDealRoom / debrief
```

Không polling mới ngoài poll prep 5s đã có khi `pending`/`running`. NBA re-render khi `prep` hoặc `funnelSnap` đổi.

---

## 8. Lỗi & trạng thái biên

| Tình huống | UI |
|------------|-----|
| Chưa load prep | NBA dùng lead+funnel only; không flash rule 10 rồi nhảy 4 |
| LMP tắt | Bỏ rule 2–4; rule 5 không `copy_script` nếu không có script |
| 403 meeting-prep | Rule 5 không script; không banner đỏ che NBA |
| Worker treo `running` > 5 phút | Vẫn rule 4; secondary Cockpit + 「Chạy lại」 nếu `crm_lmp.run` |
| Lead CSKH | Không NBA B2B rule 5–8; banner 24h + SLA panel hiện có |

---

## 9. Kiểm thử

| Loại | Nội dung |
|------|----------|
| Unit | `lead-next-action.spec.ts`: #5 → rule 5; thiếu contact → 1; awaiting_am → 2; running → 4 thắng 5; chot+debrief → 9 |
| Manual browser | `/crm/leads/5`: NBA trên cùng, 1 stepper, không SĐT kép, Gọi trên hero, form activity trên timeline |
| Không | `next build` trên VPS; E2E Playwright bắt buộc đợt này |

---

## 10. Acceptance

| ID | Pass |
|----|------|
| WS-01 | Lead có SĐT, B2 mở → title 「Gọi đầu trong 15 phút」 |
| WS-02 | Một stepper trên overview B2B; không còn 2 bar song song |
| WS-03 | SĐT/email không lặp rail |
| WS-04 | Điểm AI không chiếm cột chính như card việc |
| WS-05 | `?prep=1` vẫn mở full Sales Cockpit |
| WS-06 | Form hoạt động nằm cột phải, trên list |
| WS-07 | Rule 4 thắng 5 khi prep running |
| WS-08 | Overlay Bitrix: 1 CTA primary xanh PTT trên card NBA |

---

## 11. Rủi ro

| Rủi ro | Giảm |
|--------|------|
| Gộp stepper sai bước HĐ | Map 1-1 từ 2 bar cũ; QA trên lead có contract |
| SCI inline lệch script M1 | Chỉ lấy cùng util `buildM1Script` / opening hiện có |
| Mobile chật | NBA compact; stepper horizontal scroll |

---

## 12. Sign-off

| Vai trò | Nội dung duyệt | OK |
|---------|----------------|-----|
| PO / GDKD | NBA copy + 1 hành trình | ☐ |
| AM pilot | Lead #5: gọi được trong 1 màn | ☐ |
| Eng | File map + không API mới | ☐ |

---

## 13. Next step

Sau khi PO duyệt file này: skill **writing-plans** → plan implementation task-sized, rồi mới code.
