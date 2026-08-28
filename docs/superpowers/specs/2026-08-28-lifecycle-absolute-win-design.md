# Lifecycle tuyệt đối — Design Spec (Project lớn PTT)

> **Document ID:** LIFE-WIN-20260828  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-28  
> **Trạng thái:** Design — chờ PO duyệt; S0 được phép plan/code ngay sau sign-off mục 12  
> **Phạm vi hệ thống:** ops-web + ptt-crm-api + agency (không portal-web)  
> **Quyết định:** **Hai nhà máy / một CRM**; UI theo **bước hiện tại**; promote HĐ **khép Agency Client**; đo 4 số vận hành. Không thêm module CRM.  
> **Không làm trong spec này:** clone HubSpot sequences, inbox 3-pane, wizard onboard 20 bước, gộp SOP B2B với CSKH spa.  
> **Parent:** [LEAD-WS-20260828](./2026-08-28-lead-detail-workspace-design.md) · [SOP B2B onboard](../../runbooks/sales-b2b-lead-client-onboard-sop.md) · [Lead → Retain](../../crm/huong-dan-day-du-lead-den-cham-soc-khach-hang.md) · [SYS-UC-001](../../specs/modules/RNOSAI-BA-SYS-UseCases.md)

---

## 0. Tóm tắt điều hành

PTT không thắng bằng “CRM nhiều màn hơn HubSpot”. PTT thắng khi **vòng tiền khép và đo được**:

1. Chốt HĐ agency (Factory A).  
2. Client **active** nhận ads **≤ 14 ngày** (SYS-UC-001).  
3. Lead khách cuối chạy Factory B (CSKH 15 phút / 4 giờ / 24 giờ).  
4. Gia hạn / retain trên lifecycle.

**As-is (2026-08-28, `main` @ lead workspace + B2 outcome):** xương sống API gần đủ (SCI, B2 1 outcome, Intake, Solution queue, Deal Room, readiness HĐ, promote → customer + lifecycle, CSKH board + closed-loop). **Lỗ vận hành:** AM thấy form tương lai trên lead chưa tới bước; GDKD duyệt HĐ **không** tạo Agency Client (AM vào `/agency/clients/new`); journey dừng ở HĐ; B2B `won` không debrief/closed-loop.

**To-be:** cùng API, **kỷ luật mặt người** + **một cầu promote→Client** + **bốn số** trên `/crm/owner-weekly`.

---

## 1. Mục tiêu & định nghĩa thắng

### 1.1. Mục tiêu sản phẩm

| ID | Mục tiêu | Không phải mục tiêu |
|----|----------|---------------------|
| G1 | AM/CSKH luôn có **một việc / một nút xanh** đúng giai đoạn | Dashboard thứ 5 trên lead detail |
| G2 | Factory A và B **không trộn SOP** trên cùng lead | Một “funnel thống nhất” cho spa + agency |
| G3 | HĐ `active` → Client draft **cùng giao dịch promote** | Link tay `/agency/clients/new` |
| G4 | GDKD xem 4 số mỗi tuần, không Excel | Báo cáo mới nếu 4 số chưa sống |

### 1.2. Định nghĩa “thắng tuyệt đối” (90 ngày)

Đạt **cả bốn** — thiếu một = chưa thắng:

| # | Chỉ số | Đích 90 ngày | Nguồn sự thật |
|---|--------|--------------|---------------|
| K1 | Phút từ lead B2B có SĐT → B2 complete | Median ≤ 1 ngày làm việc (SOP 2 ngày; nội bộ siết hơn) | `care_pipeline` + `created_at` |
| K2 | Ngày B2 complete → Intake decision `go` | Median ≤ 5 ngày | `crm_lead_intake_sessions` |
| K3 | Ngày HĐ `active` → Agency Client `active` | ≤ 14 ngày (SYS-UC-001) | `crm_contracts` + agency client |
| K4 | Factory B: % lead Meta có `client_id` first-call trong 15 phút | ≥ ngưỡng PO (đặt khi WS4 sống) | CSKH board SLA |

### 1.3. Persona & nhà máy

Mọi epic **phải** gắn Factory A hoặc B. Lead `#5` = A. Lead Meta có `client_id` = B.

| Nhà máy | Đơn vị kinh tế | Spine | Cấm |
|---------|----------------|-------|-----|
| **A — Bán agency** | HĐ VND + Client active | B2 → Pre-sales → Intake → Consult → Proposal → HĐ → Onboard → Client → Retain | Dùng SOP 24h spa làm việc AM B2B |
| **B — Chạy ads khách cuối** | Lead spa chốt trong 24h | Webhook + `client_id` → board → gọi → B2 outcome → chốt | Panel HĐ agency, Intake BANT HĐ mới, Deal Room |

`lead_flow_kind`: `b2b_prospect` vs `spa_operational` — `services/ops-web/src/lib/crm/lead-flow-kind.ts` (mirror API `lead-flow-kind.util.ts`).

---

## 2. As-is — bản đồ code (đã rà 2026-08-28)

### 2.1. Spine Factory A

| Bước | Route / UI | API / util | Gate |
|------|------------|------------|------|
| Ingest | `/crm/b2b-projects`, unmatched, inbox | `B2bIngestService` | Map form/page → project |
| B2 | `#funnel-b2` + `LeadB2OutcomeCard` | `POST .../care-pipeline/report` + `complete` | Review queue chặn funnel |
| Pre-sales ensure | `#funnel-presales` trong `LeadFunnelPanel` | `POST .../presales/ensure` | `presales_care_gate` = B2 xong |
| Intake | `/crm/intake?lead_id=` | intake sessions complete | BANT Go ≥ 24 |
| Consult | tab Tư vấn / `LeadConsultWorkspace` | handoff / claim / release | Intake Go |
| Proposal | `/crm/leads/{id}/deal-room`, `/crm/proposals` | deal-room + proposals | `dealRoomEnabled()` |
| HĐ | `LeadContractPanel` `#lead-contract`; Hub contracts | contract CRUD + approvals | `contract-readiness.util.ts` |
| Promote | GDKD approve | `ContractPromotePgUtil.run` | Tasks Pre-sales + KH MKT sơ bộ |
| Delivery | `/crm/service-delivery/{lifecycle_id}` | lifecycle stage + gates | 1 bước; TMMT / QA / finance |
| Agency | `/agency/clients/new` **thủ công** | `AgencyService` | `PTT_CLIENT_STRICT_ONBOARDING` |
| Retain | lifecycle `retain`; `/agency?tab=retain` | renewal-agent T90/T60/T30 | Finance confirm handover→retain |

Promote tạo: `customer_id`, `case_id`, `lifecycle_id` (stage **`onboard`**), clone KH MKT, `presales.status=converted`, lead `won`. **Không** tạo Agency Client.

### 2.2. Spine Factory B

| Bước | UI | Gate |
|------|----|------|
| Ingest | webhook + `client_id` | Map Meta page → client |
| Board | `/crm/cskh-board` | SLA 15m / 4h / 24h |
| Lead | `/crm/leads/{id}` — **không** NBA rule 5–8 B2B | `LeadSlaCarePanel` + `ClosedLoopPanel` khi `chot` |
| B2 | cùng `LeadB2OutcomeCard` | Không mở Pre-sales / HĐ |

Closed-loop: `ChotClosedLoopService` khi status → `chot`. B2B `won` **bypass**.

### 2.3. Lệch SOP vs UI (phải sửa)

| SOP / spec | Code |
|------------|------|
| “Contract khi tới lúc” (LEAD-WS §3) | `showContractPanel = showContractForFlow(kind)` → **mọi** `b2b_prospect` |
| Deal Room khi sẵn sàng chốt | Banner khi B2 xong **và** đã có presales — **trước** Intake Go |
| SYS-UC-001 Client ≤ 14 ngày | Promote xong → link `/agency/clients/new` |
| Một việc / một CTA | NBA + journey + `LeadFunnelPanel` đầy + HĐ + banner |
| Journey qua Agency | `LeadJourneyStepper` 6 bước, dừng HĐ. `LeadB2bSalesFlowBar` (có Agency) **không mount** |

### 2.4. File neo

| Concern | Path |
|---------|------|
| Orchestration lead | `services/ops-web/src/app/crm/leads/[id]/page.tsx` |
| NBA | `services/ops-web/src/lib/crm/lead-next-action.ts` |
| Journey | `services/ops-web/src/lib/crm/lead-journey.ts` |
| B2 outcome | `services/ops-web/src/lib/crm/lead-b2-outcome.ts` + `LeadB2OutcomeCard.tsx` |
| Funnel / Pre-sales forms | `services/ops-web/src/components/LeadFunnelPanel.tsx` |
| HĐ | `services/ops-web/src/components/LeadContractPanel.tsx` |
| Readiness | `services/ptt-crm-api/src/leads-contract/contract-readiness.util.ts` |
| Promote | `services/ptt-crm-api/src/leads-contract/contract-promote-pg.util.ts` |
| Flow kind | `services/ops-web/src/lib/crm/lead-flow-kind.ts` |
| Dead stepper | `LeadB2bSalesFlowBar.tsx`, `LeadPresalesFunnelStepper.tsx` |

---

## 3. Nguyên tắc thiết kế (bắt buộc mọi PR)

1. **Gate ở backend; UI chỉ hỏi việc hiện tại.** Không xóa `buildReadinessChecks` / promote validation.  
2. **Một NBA trên B2B lead detail** = `LeadNextActionCard`. `LeadSlaCarePanel` / AI NBA / `ClosedLoopPanel` chỉ `spa_operational`. Canopy = gợi ý nav, không CTA lead.  
3. **Không file CSS mới** — overlay `html.ops-shell-bitrix` trong `bitrix-theme.css`.  
4. **Không API mới cho S0–S1.** S2 (Client lúc promote) được phép API/transaction trong cùng approve.  
5. **Cấm phình Bitrix:** PR thêm card trên `/crm/leads/[id]` phải trả lời “thuộc stage nào? ẩn khi nào?”.  
6. **Cùng card B2 outcome** cho A và B; **khác** SLA và cấm HĐ trên B.

---

## 4. Luật hiện panel (S0 — khóa hành vi)

Hàm thuần (unit test bắt buộc). Đặt `services/ops-web/src/lib/crm/lead-stage-visibility.ts`.

### 4.1. Input

```ts
type LeadStageVisibilityInput = {
  flowKind: 'b2b_prospect' | 'spa_operational';
  b2Complete: boolean;
  presalesStage: string | null;       // '', lead, consult, proposal
  intakeGo: boolean;                  // session decision === 'go' nếu có trên funnel; S0 tạm: stage consult|proposal
  hasContract: boolean;
  contractStatus: string | null;
  dealRoomEnabled: boolean;
};
```

S0 được phép xấp xỉ `intakeGo = presalesStage ∈ {consult, proposal}` nếu funnel chưa expose intake decision trên page. S1 nối đúng field API nếu đã có.

### 4.2. Output

| Flag | `spa_operational` | `b2b_prospect` |
|------|-------------------|----------------|
| `showNbaB2b` | false | true |
| `showJourney` | false | true |
| `showB2Outcome` | true nếu B2 chưa xong | true nếu B2 chưa xong |
| `showPresalesBlock` | false | `b2Complete` |
| `showDealRoomBanner` | false | `dealRoomEnabled ∧ b2Complete ∧ intakeGo` |
| `showContractPanel` | false | `hasContract ∨ presalesStage === 'proposal' ∨ contractStatus ∈ {draft, pending, active}` |

`LeadFunnelPanel` vẫn mount khi `showPresalesBlock` **hoặc** cần B2 (panel chứa `#funnel-b2`). Khi `!b2Complete`, **không render** `#funnel-presales` và task/R5. Khi `b2Complete` nhưng `presalesStage` rỗng: chỉ khối “bắt đầu Pre-sales” (chọn slug + ensure), không dump task consult/proposal.

### 4.3. Journey — trạng thái HĐ

Sửa `resolveLeadJourney`: bước `contract` chỉ `current` khi `presalesStage === 'proposal'` **và** (`hasContract` hoặc mọi task proposal xong — S1). **Cấm** `current` chỉ vì đang ở proposal mà chưa có draft (as-is dòng 60–67 luôn `current`).

Khi `contractActive` + `lifecycleId`: `done` + `href` `/crm/service-delivery/{id}`.

### 4.4. Acceptance S0

| ID | Pass |
|----|------|
| VIS-01 | `/crm/leads/5` B2B, B2 mở, sidebar mở: **không** `#lead-contract`, **không** checklist HĐ đỏ |
| VIS-02 | Cùng lead: **không** banner Deal Room |
| VIS-03 | Sau B2, chưa Intake Go: `#funnel-presales` (ensure) được; banner Deal Room vẫn tắt |
| VIS-04 | `spa_operational`: không contract panel, không NBA rule 5–8 |
| VIS-05 | Lead đã có HĐ draft: panel HĐ hiện dù stage chưa proposal (sửa tay / lệch data) |

---

## 5. NBA — mở rộng (S1)

File: `lead-next-action.ts`. **Không** phá rule 1–7, 9–10 đã lock LEAD-WS.

### 5.1. Kind mới

```
create_contract | submit_contract | wait_contract_approval
```

### 5.2. Luật (chèn trước rule 8 nếu Deal Room, sau rule 7)

| Điều kiện | Title | Primary | Secondary |
|-----------|-------|---------|-----------|
| `proposal` + !hasContract | Tạo HĐ draft | `create_contract` (scroll `#lead-contract` hoặc mở form) | `open_deal_room` |
| draft + readiness trừ `no_pending` | Gửi GDKD duyệt | `submit_contract` | Hub contracts |
| approval pending | Chờ GDKD duyệt | `wait_contract_approval` (disabled) | Hub |
| `proposal` + Deal Room + !m3 conflict | giữ rule 8 | `open_deal_room` | `create_contract` nếu chưa HĐ |

Rule 8 hiện thắng khi `m3_pre_close` hoặc `stage===proposal`. S1: nếu **chưa HĐ**, secondary luôn có Tạo HĐ; nếu **đã draft sẵn sàng submit**, primary có thể là Gửi GDKD (PO chọn một: Deal Room vs HĐ — **đề xuất:** Deal Room primary khi chưa có proposal accept; HĐ primary khi đã có amount/proposal accept).

**Mở PO:** nguồn “proposal accept” trên funnel snapshot. Nếu chưa có field, S1 dùng `hasContract` / stage only.

### 5.3. Softphone → B2 (S1, không API mới)

Nếu `placeB2bSoftphoneCall` success: set local `b2Outcome=talked` + focus `#funnel-b2` / `LeadB2OutcomeCard`. Không auto-complete B2 (AM vẫn bấm Xong B2).

---

## 6. Workstream

### WS1 — Spine AM (S0–S1)

**Owner:** ops-web.  
**Làm:** mục 4 + 5; gate đỏ trên `LeadContractPanel` thành `Link` (`#funnel-b2`, `/crm/intake`, deal-room, `#funnel-presales`). Disable **Tạo HĐ draft** khi `!submitReady` trừ `contract_draft` (tức chưa đủ B2/Pre-sales/KH MKT) — S1.  
**Không:** đổi copy status DB.  
**UAT:** VIS-01…05 + NBA HĐ trên lead proposal.

### WS2 — Cầu Agency Client (S2) — **cần PO spec 2 trang trước code**

**Mục tiêu:** `ContractPromotePgUtil.run` (cùng transaction approve) tạo hoặc gắn Agency Client **draft**.

**Hành vi đề xuất (PO khóa trước impl):**

| Field Client | Nguồn |
|--------------|--------|
| Tên | Lead company / full_name |
| Owner AM | `assigned_am` / lead owner |
| `contract_id`, `lifecycle_id`, `customer_id` | promote result |
| Brand / page Meta | để trống; AM điền trên checklist SYS-UC-001 |

**Fail-soft:** trùng brand/tên → không fail approve; gắn client hiện có hoặc tạo draft + flag `needs_merge`.  
**UI:** `LeadContractPanel` khi HĐ active: **Mở Client** `/agency/clients/{id}` — **xóa** CTA `/agency/clients/new` trên happy path.  
**UAT:** 1 HĐ pilot: approve → URL client tồn tại; webhook test page gắn client → lead Factory B.

**Cấm S2:** wizard 20 bước; tạo client `active` tự động (vẫn cần checklist onboard).

### WS3 — Delivery spine (S3 tuần 9–10)

Mở rộng `LeadJourneyStep['key']` **chỉ khi** `contractActive || lifecycleId`:

`onboard | deliver | agency | retain` (nhãn ngắn: OB / Giao / CL / Ret).

Lead **chưa won:** giữ 6 bước hiện tại — **cấm** stepper 9 bước trên first-call.

CTA trên `/crm/service-delivery/{id}`: một việc = task cổng `validateStageAdvance` (TMMT / Launch QA / finance).

### WS4 — Đo (song song tuần 1)

Bốn số mục 1.2 trên `/crm/owner-weekly` (block nhỏ, không dashboard mới).  
Event tối thiểu: `stage_entered` (b2_done, intake_go, contract_active, client_active) — dùng bảng hiện có nếu đủ timestamp; thiếu thì 1 bảng `crm_lifecycle_milestones` (S2+).

Debrief B2B: kích hoạt rule 9 khi `won`/`lost` + `debrief_pending` (đã có kind; nối `won` không chỉ `chot`).

---

## 7. Lịch 90 ngày

| Tuần | WS | Outcome bắt buộc | Cấm |
|------|----|------------------|-----|
| 1–2 | WS1 S0 + WS4 skeleton | VIS-01…05 trên lead #5 | API mới, redesign Deal Room |
| 3–4 | WS1 S1 | NBA HĐ; link gate; softphone prefill | Field HĐ mới |
| 5–8 | WS2 | Promote → Client draft; 1 HĐ thật | Wizard dài |
| 9–10 | WS3 | Journey sau won; CTA delivery | Stepper 9 bước trên lead chưa won |
| 11–12 | WS4 | 4 số owner-weekly; debrief won; xóa dead TSX | Dashboard mới nếu K1–K3 trống |

---

## 8. Đối thủ — chỉ lấy thứ họ yếu / ta thiếu

| Đối thủ | Lấy | Không lấy |
|---------|-----|-----------|
| HubSpot | Một việc / một CTA; ẩn form tương lai | Sequences inbox; clone UI 3-pane |
| Bitrix | Deal won → entity công ty (Client draft) | Phình module / form 20 field |
| Salesforce | Path + approval GDKD (đã có Hub) | Implementation nặng; custom object mới |

**Moat giữ:** SCI/Cockpit, Intake BANT, Solution queue, Deal Room 3 gói, promote lifecycle, CSKH 15 phút Meta.

---

## 9. Kiểm thử

| Loại | Nội dung |
|------|----------|
| Unit | `lead-stage-visibility.spec.ts` — fixture lead #5; spa; proposal+HĐ; B2 xong chưa Go |
| Unit | `lead-journey.spec.ts` — HĐ không current trước proposal “sẵn” |
| Unit | `lead-next-action.spec.ts` — kind HĐ mới; rule 5–7 không regress |
| Manual | Hard-refresh `#5` sidebar mở; lead spa; lead có draft HĐ |
| WS2 | Jest promote: approve tạo/gắn `agency_client_id` (sau PO spec) |
| Không S0 | `next build` ad-hoc trên VPS; E2E Playwright bắt buộc |

---

## 10. Rủi ro

| Rủi ro | Dấu hiệu | Chặn |
|--------|----------|------|
| Phình Bitrix | PR thêm card lead detail | Review câu hỏi stage/ẩn |
| Hai NBA | AI SLA trên B2B | Giữ `LeadSlaCarePanel` spa-only |
| SQLite/PG | Promote dual-write | WS2 chỉ PG |
| Pilot không đo | UI ship, weekly trống | WS4 từ tuần 1 |
| Gộp Factory | Ticket “B2 một SOP” | Cùng outcome card; khác SLA/HĐ |
| WS2 sai field | Client rác / trùng | Cấm code trước spec 2 trang PO |

---

## 11. Câu hỏi PO (chặn WS2 / một nhánh S1)

1. Field bắt buộc Client lúc promote (MST, brand, Facebook Page ID)?  
2. Trùng tên DN: gắn client cũ hay draft + `needs_merge`?  
3. Ai được bấm Client `active` (AM vs ops)?  
4. HĐ nhiều `service_slug`: 1 Client / nhiều lifecycle hay 1:1?  
5. Rule 8 vs Tạo HĐ: primary nào khi `stage=proposal` chưa accept?  
6. Ngưỡng K4 (% first-call 15m Factory B)?

---

## 12. Sign-off

| Vai trò | Duyệt | OK |
|---------|-------|-----|
| PO / GDKD | Hai nhà máy, 4 số, luật ẩn HĐ | ☐ |
| AM pilot | Lead #5: không thấy HĐ khi B2 | ☐ |
| Agency / Ops | WS2 field + fail-soft trùng | ☐ |
| Eng | S0 không API mới; file map | ☐ |

**S0** được plan/code khi PO + Eng tick. **WS2** chỉ sau câu hỏi mục 11.

---

## 13. Next step

1. PO duyệt file này (đặc biệt §4 và §12).  
2. Plan S0: [2026-08-28-lifecycle-s0-stage-visibility.md](../plans/2026-08-28-lifecycle-s0-stage-visibility.md).  
3. Spec con 2 trang **Promote → Agency Client** trước WS2.  
4. Không implement WS2/WS3 trong cùng PR với S0.

---

## 14. Traceability

| Artifact | Vai trò |
|----------|---------|
| LEAD-WS-20260828 | Workspace AM; “Contract khi tới lúc” — spec này **thi hành** |
| SOP sales-b2b-lead-client-onboard | SLA 2 / 5 / 3 / 14 ngày — K1–K3 |
| Hướng dẫn Lead→Retain | 11 công đoạn — WS3 nối Onboard…Retain |
| Canvas playbook | Bản thảo điều hành; spec này là source of truth |

---

## 15. Spec self-review

| Check | Kết quả |
|-------|---------|
| Placeholder / TBD lung tung | Không — chỗ mở nằm mục 11 (PO) |
| Mâu thuẫn LEAD-WS | Bổ sung, không đảo NBA 1–7 |
| Phạm vi S0 vs WS2 | Tách rõ; cấm gộp PR |
| File / acceptance đo được | VIS-01…05, K1–K4 |
