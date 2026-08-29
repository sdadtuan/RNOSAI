# Lifecycle S1 — NBA HĐ + gate link + softphone B2

> **Document ID:** LIFE-S1-20260829  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-29  
> **Trạng thái:** Design — chờ PO/Eng duyệt trước implementation plan  
> **Route:** `/crm/leads/{id}` (ops-web)  
> **Parent:** [LIFE-WIN-20260828](./2026-08-28-lifecycle-absolute-win-design.md) §5 · §6 WS1 S1  
> **Workspace:** [LEAD-WS-20260828](./2026-08-28-lead-detail-workspace-design.md)  
> **S0 đã ship:** [2026-08-28-lifecycle-s0-stage-visibility.md](../plans/2026-08-28-lifecycle-s0-stage-visibility.md) (`cb7abdbb`)

---

## 0. Tóm tắt

S0 đã **ẩn** HĐ / Deal Room đúng lúc. S1 cho AM **một việc** khi đã tới proposal hoặc đã có draft: Tạo HĐ / Gửi GDKD / Chờ duyệt — không thêm API, không field HĐ mới, không phá NBA rule 1–7 và 9–10.

Ba việc, một PR:

1. Mở rộng `resolveLeadNextAction` — kind HĐ.  
2. Checklist đỏ trên `LeadContractPanel` thành `Link`; khóa **Tạo HĐ draft** khi chưa đủ gate upstream.  
3. Softphone thành công → focus B2 outcome, không auto-complete.

---

## 1. Mục tiêu & thắng

| Persona | Việc S1 tối ưu |
|---------|----------------|
| AM B2B ở `proposal` | Biết bấm Deal Room hay HĐ — một primary |
| AM đã có draft sẵn sàng | Primary = Gửi GDKD, không kêu mở Deal Room nữa |
| AM vừa gọi softphone (B2 mở) | Rơi đúng card kết quả gọi; vẫn tự bấm Xong B2 |

**Không** tối ưu: Hub duyệt HĐ, Deal Room internals, Agency Client (WS2).

---

## 2. Phạm vi

### 2.1. In scope

- `NextActionKind`: `create_contract` | `submit_contract` | `wait_contract_approval` | `open_contract_hub`.  
- Luật NBA HĐ (mục 4) + `onNbaAction` trên `page.tsx`.  
- `LeadNextActionCard`: disable primary khi `wait_contract_approval` (cùng kiểu `wait_prep` / `wait_handoff`).  
- Pure helpers từ `ContractReadinessCheck[]` (mục 5–6).  
- Gate đỏ → `Link` (mục 6).  
- Disable **Tạo HĐ draft** khi `!createReady` (mục 5).  
- Softphone success → banner + scroll `#funnel-b2` (mục 7).  
- Unit test: `lead-next-action.spec.ts` + helper spec mới.  
- Overlay CSS (nếu banner B2) chỉ trong `bitrix-theme.css` dưới `html.ops-shell-bitrix`.

### 2.2. Out of scope

- API / field HĐ / bảng mới. Field “proposal accept” — không invent.  
- WS2 Client, WS3 stepper 9 bước, WS4 owner-weekly.  
- `intakeGo` thật từ Intake session (giữ `deriveS0IntakeGo`).  
- Journey: `contract current` khi “mọi task proposal xong” — giữ S0 (`hasContract` only).  
- Đổi rule 1–7, 9–10 title/action đã lock LEAD-WS.  
- Gọi `createLeadContract` / `submitLeadContract` từ NBA (tránh tạo draft 0đ / submit kép). NBA chỉ scroll / mở Hub.  
- Redesign Deal Room, Intake, CSKH, `/crm/hub`.  
- `spa_operational`: không NBA HĐ (page đã `showNbaB2b === false`).  
- File CSS mới. `next build` ad-hoc trên VPS.

---

## 3. Quyết định khóa (LIFE-WIN §11.5)

Không có field “proposal accept” trên funnel snapshot.

| Trạng thái | Primary | Secondary |
|------------|---------|-----------|
| `proposal` + Deal Room + **chưa** HĐ | **Mở Deal Room** (rule 8 giữ nguyên) | **Tạo HĐ draft** |
| `proposal` + Deal Room tắt + chưa HĐ | **Tạo HĐ draft** | (không) |
| Đã draft + `submitReady` | **Gửi GDKD duyệt** | Hub · HĐ chờ duyệt |
| Approval `pending` | **Chờ GDKD duyệt** (disabled) | Hub · HĐ chờ duyệt |
| Đã draft + `!submitReady` | Rule 8 Deal Room nếu `m3`/`proposal` + Deal Room; không thì scroll HĐ | Scroll `#lead-contract` nếu primary là Deal Room |

`m3_pre_close` ở stage `consult` **không** thêm secondary Tạo HĐ — panel S0 chưa hiện (trừ VIS-05 đã có draft).

---

## 4. NBA — luật HĐ

File: `services/ops-web/src/lib/crm/lead-next-action.ts`.  
`rule` vẫn thuộc `1…10`. Mọi variant HĐ dùng **`rule: 8`** (không thêm số rule).

### 4.1. Input thêm

```ts
// LeadNextActionInput — thêm, không xóa field cũ
hasContract: boolean;
contractStatus: string | null;       // draft | pending | active | …
pendingApproval: boolean;
submitReady: boolean;                // helper mục 5; false nếu chưa fetch
createReady: boolean;
```

Page map từ `fetchLeadContractReadiness` (S0 đã gọi) + helper. Fetch lỗi → `hasContract/submitReady/createReady = false` (S0 fail-closed).

### 4.2. Thứ tự đánh giá (chèn đúng chỗ)

Giữ nguyên block rule 1–4 và rule 9 (`debrief` + `chot`/`lost`).

**Sau rule 9, trước block `m3` / rule 8 hiện tại:**

```
nếu pendingApproval:
  rule 8
  title: Chờ GDKD duyệt
  body: Đã gửi — không submit lại.
  primary: wait_contract_approval / Chờ GDKD duyệt
  secondary: [{ Hub · HĐ chờ duyệt, open_contract_hub }]

nếu hasContract && contractStatus===draft && submitReady && !pendingApproval:
  rule 8
  title: Gửi GDKD duyệt
  body: Gate đủ — gửi HĐ, GDKD duyệt trên Hub.
  primary: submit_contract / Gửi GDKD duyệt
  secondary: [{ Hub · HĐ chờ duyệt, open_contract_hub }]
```

Kind `open_contract_hub` **không** thêm nếu có thể tái dùng navigation: secondary action = `open_contract_hub` **hoặc** page handle `submit_contract` chỉ scroll và thêm secondary bằng kind mới tối thiểu.

Khóa: thêm **một** kind `open_contract_hub` (push `/crm/hub`). Không mở tab mới.

**Rồi** block rule 8 hiện tại (`dealRoomEnabled && b2Complete && (m3_pre_close || stage===proposal)`):

- Primary / title / body **không đổi** (Chuẩn bị buổi chốt / Mở Deal Room).  
- Secondary: giữ `apply_offer_ladder` khi `prep===ready`.  
- **Thêm** `{ Tạo HĐ draft, create_contract }` khi `stage===proposal && !hasContract` (cuối mảng, tối đa 2 secondary — nếu đã có ladder thì **thay** ladder bằng `create_contract`? **Không.** Khóa: tối đa 2 nút secondary. Ưu tiên `create_contract` hơn `apply_offer_ladder` khi `!hasContract` ở proposal: secondary = `[create_contract]` only. Ladder vẫn bấm được trong Deal Room.

**Sau** block rule 8, **trước** rule 7:

```
nếu stage===proposal && !hasContract && !dealRoomEnabled && createReady:
  rule 8
  title: Tạo HĐ draft
  body: Deal Room tắt — tạo draft trên panel HĐ.
  primary: create_contract / Tạo HĐ draft
  secondary: []
```

Nếu `!createReady` ở nhánh này: **không** bịa primary HĐ — rơi xuống rule 10 (hoặc rule 7 nếu stage nhầm). AM thấy checklist link trên panel khi S0 `showContractPanel` (stage proposal → panel hiện).

Rule 7 → 6 → 5 → 10 không đổi.

### 4.3. Copy khóa

| Kind | `title_vi` | Primary `label_vi` |
|------|------------|-------------------|
| `create_contract` | Tạo HĐ draft | Tạo HĐ draft |
| `submit_contract` | Gửi GDKD duyệt | Gửi GDKD duyệt |
| `wait_contract_approval` | Chờ GDKD duyệt | Chờ GDKD duyệt |
| (rule 8 Deal Room) | Chuẩn bị buổi chốt | Mở Deal Room |

「Chờ dọn」 không bao giờ là `title_vi`. Hero vẫn **Gọi ngay**. Rule 5 primary vẫn **Copy script** / `add_activity`.

### 4.4. `onNbaAction`

| Kind | Hành vi |
|------|---------|
| `create_contract` | `scrollIntoView` `#lead-contract`; focus `#lead-contract-amount` nếu có |
| `submit_contract` | `scrollIntoView` `#lead-contract`; focus `#lead-contract-submit` nếu có |
| `wait_contract_approval` | no-op (nút disabled) |
| `open_contract_hub` | `router.push('/crm/hub')` |

Không gọi `createLeadContract` / `submitLeadContract` từ card.

Gắn `id="lead-contract-amount"` lên input VND (cả khối tạo và khối draft). Gắn `id="lead-contract-submit"` lên nút **Gửi GDKD duyệt**.

---

## 5. Ready helpers

File mới: `services/ops-web/src/lib/crm/lead-contract-ready.ts`.

`ContractReadinessCheck` đã có `{ key, ok, label, message? }` từ `@/lib/api`.

```ts
const UPSTREAM_SKIP = new Set(['no_pending_approval', 'contract_draft']);

export function contractCreateReady(checks: Array<{ key: string; ok: boolean }>): boolean {
  const upstream = checks.filter((c) => !UPSTREAM_SKIP.has(c.key));
  return upstream.length > 0 && upstream.every((c) => c.ok);
}

export function contractSubmitReady(checks: Array<{ key: string; ok: boolean }>): boolean {
  return checks.filter((c) => c.key !== 'no_pending_approval').every((c) => c.ok);
}
```

`createReady === false` khi chưa fetch (`checks = []`) — vì `upstream.length > 0` fail. Đúng: không hiện NBA Tạo HĐ / không enable nút tạo cho đến khi readiness về.

Panel **Tạo HĐ draft**: `disabled={busy || !contractCreateReady(checks)}`.

Panel **Gửi GDKD**: giữ `submitReady` hiện tại; đổi sang `contractSubmitReady(checks)` (cùng công thức).

Backend `buildReadinessChecks` **không** sửa. UI chỉ hỏi việc hiện tại.

---

## 6. Gate đỏ → Link

Khi `!c.ok`, bọc `c.label` (hoặc cả dòng) bằng `Link` / `<a href>`. Check `ok` giữ text thường, không link.

| `c.key` | `href` |
|---------|--------|
| `b2_complete` | `#funnel-b2` |
| `presales_active` | `#funnel-presales` |
| `presales_lead` | `/crm/intake?lead_id={id}` |
| `presales_consult` | `#funnel-presales` (tab Tư vấn nếu AM đang overview — hash đủ) |
| `presales_proposal` | `/crm/leads/{id}/deal-room` |
| `marketing_plan` | `/crm/leads/{id}/deal-room` |
| `contract_draft` | `#lead-contract-amount` |
| `no_pending_approval` | `/crm/hub` |
| key khác / lạ | không link |

Helper: `readinessCheckHref(key, leadId): string | null` cùng file `lead-contract-ready.ts`.

Không đổi màu / icon ✓ ○ hiện tại.

---

## 7. Softphone → B2

`placeB2bSoftphoneCall` không đổi (không API mới).

Callers: `LeadContactActions`, `LeadMobileCallBar`.

Thêm callback tùy chọn:

```ts
onCallPlaced?: (mode: 'webrtc' | 'server' | 'tel') => void
```

Gọi **sau** return thành công (mọi mode, kể cả `tel` fallback sau `startLeadB2bCall`). Không gọi khi throw ra ngoài (user không gọi được).

Page, khi `!funnelSnap.care_pipeline.all_complete`:

1. `setB2CallJustPlaced(true)`.  
2. `document.getElementById('funnel-b2')?.scrollIntoView({ behavior: 'smooth', block: 'start' })`.

`LeadB2OutcomeCard`:

- Prop `highlightAfterCall?: boolean`.  
- Chip mặc định vẫn `talked` (đã vậy).  
- Khi `highlightAfterCall`: một dòng `Vừa gọi. Chọn kết quả rồi bấm Xong B2.` — class overlay `.lead-b2-outcome--after-call` trong `bitrix-theme.css`.  
- **Cấm** `onSubmit` tự chạy. AM vẫn bấm Xong B2.

Spa: cùng card; callback vẫn chạy (Factory B cũng gọi). Không NBA HĐ.

---

## 8. File map

| File | Việc |
|------|------|
| Modify `lead-next-action.ts` + `.spec.ts` | Kind + luật mục 4; regress rule 5–7, 9–10 |
| Create `lead-contract-ready.ts` + `.spec.ts` | `createReady` / `submitReady` / href |
| Modify `LeadNextActionCard.tsx` | Disable `wait_contract_approval` |
| Modify `leads/[id]/page.tsx` | Map input HĐ; `onNbaAction`; softphone callback |
| Modify `LeadContractPanel.tsx` | Link gate; `createReady`; id amount/submit |
| Modify `LeadContactActions.tsx`, `LeadMobileCallBar.tsx` | `onCallPlaced` |
| Modify `LeadB2OutcomeCard.tsx` | Banner after-call |
| Modify `LeadFunnelPanel.tsx` | Truyền `highlightAfterCall` |
| Modify `bitrix-theme.css` | Overlay banner B2 nếu cần |
| Modify LIFE-WIN §13 | Trỏ spec này |

Không xóa `showContractForFlow`. Không đụng Deal Room page.

---

## 9. Acceptance

| ID | Pass |
|----|------|
| S1-N1 | Lead `proposal` + Deal Room + chưa HĐ: NBA rule 8, primary Mở Deal Room, secondary Tạo HĐ draft |
| S1-N2 | Cùng lead, Deal Room **tắt** + `createReady`: primary Tạo HĐ draft |
| S1-N3 | Draft + `submitReady` + !pending: primary Gửi GDKD; bấm → scroll `#lead-contract` |
| S1-N4 | Approval pending: primary disabled Chờ GDKD; secondary → `/crm/hub` |
| S1-N5 | Rule 5–7, 9 fixture hiện tại **không đổi** action/title |
| S1-G1 | Check `b2_complete` fail → link `#funnel-b2` |
| S1-G2 | `presales_lead` fail → `/crm/intake?lead_id=` |
| S1-G3 | `marketing_plan` fail → deal-room |
| S1-G4 | Thiếu B2: nút Tạo HĐ draft disabled; đủ upstream, chưa draft: enabled |
| S1-P1 | Softphone success + B2 mở: scroll `#funnel-b2`, banner, không POST complete B2 |
| S1-P2 | Softphone fail (throw): không banner |
| S1-S | `spa_operational`: không kind HĐ trên NBA |

Manual: hard-refresh lead proposal + lead #5 (S0 VIS vẫn pass).

---

## 10. Kiểm thử

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/lead-next-action.spec.ts \
  src/lib/crm/lead-contract-ready.spec.ts \
  src/lib/crm/lead-stage-visibility.spec.ts \
  src/lib/crm/lead-journey.spec.ts \
  src/lib/crm/lead-b2-outcome.spec.ts
```

Fixture rule 8 hiện tại (`proposal + deal room → rule 8`) **cập nhật** secondary chứa `create_contract`, primary vẫn `open_deal_room`.

Không bắt Playwright.

---

## 11. Rủi ro

| Rủi ro | Chặn |
|--------|------|
| Hai CTA xanh | Một `btn-primary` trên NBA; HĐ panel primary riêng frame |
| NBA tự tạo HĐ 0đ | Cấm API từ card |
| Rule 8 nuốt consult+m3 | Secondary Tạo HĐ chỉ khi `stage===proposal` |
| VIS-01 regress | `showContractPanel` S0 không đổi; NBA HĐ không mount panel |
| Softphone auto-B2 | Cấm `onSubmit` trong callback |

---

## 12. Sign-off

| Vai trò | Duyệt | OK |
|---------|-------|-----|
| PO | Deal Room primary khi chưa HĐ (§3) | ☐ |
| Eng | Không API; file map; rule 5–7 giữ | ☐ |

WS2 vẫn chặn LIFE-WIN §11.1–4.

---

## 13. Spec self-review

| Check | Kết quả |
|-------|---------|
| TBD / TODO | Không — Q5 khóa ở §3 |
| Mâu thuẫn LIFE-WIN §5 bảng hàng 1 vs hàng 4 | Khóa hàng 4 + đề xuất PO: Deal Room primary khi chưa HĐ |
| Mâu thuẫn LEAD-WS | Không đổi rule 1–7, 9–10 |
| Phạm vi 1 plan | 3 bề mặt, cùng page; không WS2 |
| Ambiguity secondary 2 nút | Ưu tiên `create_contract` hơn ladder trên overview |

---

## 14. Next step

1. PO/Eng tick §12.  
2. Plan S1: [2026-08-29-lifecycle-s1-nba-contract.md](../plans/2026-08-29-lifecycle-s1-nba-contract.md).  
3. Không gộp WS2/WS4 trong cùng PR.
