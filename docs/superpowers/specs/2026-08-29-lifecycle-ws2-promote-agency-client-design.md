# Lifecycle WS2 — Promote → Agency Client draft

> **Document ID:** LIFE-WS2-20260829  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-29  
> **Trạng thái:** Design — chờ PO/Eng duyệt trước implementation plan  
> **Phạm vi:** `ptt-crm-api` (promote transaction) + `ops-web` (`LeadContractPanel`, readiness payload)  
> **Parent:** [LIFE-WIN-20260828](./2026-08-28-lifecycle-absolute-win-design.md) §6 WS2 · §11 · G3 · K3  
> **S1 đã ship:** [2026-08-29-lifecycle-s1-nba-contract-design.md](./2026-08-29-lifecycle-s1-nba-contract-design.md) (`a2614cac`)  
> **SOP:** [sales-b2b-lead-client-onboard-sop.md](../../runbooks/sales-b2b-lead-client-onboard-sop.md) §F · [SYS-UC-001](../../specs/modules/RNOSAI-BA-SYS-UseCases.md)

---

## 0. Tóm tắt

S0/S1 đã ẩn HĐ đúng lúc và NBA HĐ trên lead. **Lỗ còn lại lớn nhất Factory A:** GDKD approve HĐ → promote tạo `customer` + `lifecycle`, nhưng AM vẫn vào `/agency/clients/new` thủ công — `crm_contracts.agency_client_id` trống, Launch QA / onboarding checklist chặn.

WS2 khép **một giao dịch promote** với **một Agency Client draft** (`status=onboarding`), gắn UUID lên HĐ + lead, UI happy-path **Mở Client** thay **Tạo Client**.

Hai việc, một PR backend + một PR UI (hoặc gộp nếu nhỏ):

1. **`ContractPromotePgUtil`** — resolve hoặc tạo client; cập nhật `agency_client_id` trên contract + lead; log event.  
2. **`LeadContractPanel`** — khi HĐ `active` + có `agency_client_id`: link `/agency/clients/{id}`; ẩn `/agency/clients/new` trên happy path.

---

## 1. Mục tiêu & thắng

| ID | Mục tiêu | Không phải mục tiêu |
|----|----------|---------------------|
| G3 | HĐ `active` → Client draft **cùng transaction approve** | Wizard onboard 20 bước trên promote |
| K3 | Bắt đầu đo ngày HĐ active → Client active (WS4 dùng timestamp) | Client `active` tự động lúc promote |
| AM | Sau GDKD duyệt: một URL Client, không nhập lại tên/code | Redesign tab Agency checklist |
| Ops | Lifecycle onboarding / Launch QA đọc được `contract.agency_client_id` | Gộp Factory B CSKH |

**Persona chính:** AM B2B sau khi GDKD approve HĐ pilot (lead #5 class).

---

## 2. Phạm vi

### 2.1. In scope

- Logic **resolve / create / link** Agency Client trong `ContractPromotePgUtil.run` (PG only — LIFE-WIN §10 SQLite).  
- Cập nhật `crm_contracts.agency_client_id`, `crm_leads.agency_client_id` (UUID FK nếu cột PG đã UUID).  
- `contract_events`: `client_linked` (+ payload dedup).  
- Trả `agency_client_id` trong response approve + GET readiness/contract.  
- `LeadContractPanel`: CTA **Mở Agency Client**; fallback link `/new` chỉ khi promote cũ chưa có client.  
- Jest: promote tạo client; idempotent re-approve; dedup tên; pre-set `agency_client_id`.  
- Gọi `seed_client_onboarding` + `AgencySideEffectsService.onClientCreated` khi **tạo mới** (không gọi lại khi link client cũ).

### 2.2. Out of scope

- WS3 journey 9 bước, WS4 owner-weekly, NBA kind mới post-won.  
- Field MST / brand / Page Meta bắt buộc lúc promote (AM điền trên checklist SYS-UC-001).  
- Tự `active` client; tự map Meta page; tự tạo portal user.  
- Sửa onboarding checklist UI, `/agency/clients/new` form (giữ route cho edge case).  
- SQLite dual-write promote.  
- `spa_operational` lead flow.  
- API REST công khai mới (chỉ mở rộng payload approve/readiness hiện có).

---

## 3. Quyết định khóa (LIFE-WIN §11 → PO tick)

Spec **đề xuất khóa** để Eng plan được. PO sửa trước plan nếu lệch.

| # | Câu hỏi LIFE-WIN §11 | Khóa WS2 (đề xuất) |
|---|----------------------|-------------------|
| Q1 | Field bắt buộc Client lúc promote? | **Auto-fill tối thiểu:** `code`, `name`, `owner_am_id`, `status=onboarding`. **Không** bắt MST / brand / Page ID — để trống checklist. Ghi `notes` 1 dòng: `Promote HĐ #{contractId} · Lead #{leadId} · lifecycle #{lifecycleId}`. |
| Q2 | Trùng tên DN? | **Fail-soft:** không fail approve. Xem mục 5. |
| Q3 | Ai bấm Client `active`? | **Không đổi:** AM/Ops qua checklist onboard (SYS-UC-001 F4–F7). Promote chỉ tạo `onboarding`. |
| Q4 | HĐ nhiều `service_slug`? | **1 Client / công ty (lead):** promote đầu tạo/link; promote sau (cùng lead / client đã gắn) **reuse** `agency_client_id`. Nhiều lifecycle có thể trỏ cùng client; **không** tạo client/lifecycle 1:1 bắt buộc. |
| Q5 | (S1 đã khóa) Deal Room vs HĐ | Không thuộc WS2. |
| Q6 | Ngưỡng K4 | WS4. |

---

## 4. As-is (code đã rà 2026-08-29)

| Bước | Hiện tại |
|------|----------|
| GDKD approve | `LeadsContractPgRepository.approveAndPromote` → `ContractPromotePgUtil.run` |
| Promote tạo | `crm_customers`, `crm_cases`, `crm_service_lifecycle` stage `onboard`, lead `won`, clone TMMT |
| Client | **Không** tạo; `crm_contracts.agency_client_id` giữ giá trị draft (thường rỗng) |
| UI active | `LeadContractPanel` link **Tạo Agency Client** → `/agency/clients/new` |
| Block downstream | `lifecycle-onboarding.service`: thiếu `agency_client_id` → chặn onboard widget |
| Manual create | `AgencyService.createClient` — `clients` PG, `status=onboarding`, seed checklist |

File neo:

| Concern | Path |
|---------|------|
| Promote | `services/ptt-crm-api/src/leads-contract/contract-promote-pg.util.ts` |
| Approve | `services/ptt-crm-api/src/leads-contract/leads-contract-pg.repository.ts` |
| Client CRUD | `services/ptt-crm-api/src/agency/agency.repository.ts` (`createClient`) |
| Side effects | `services/ptt-crm-api/src/agency/agency-side-effects.service.ts` |
| Panel UI | `services/ops-web/src/components/LeadContractPanel.tsx` |
| Types | `services/ptt-crm-api/src/leads-contract/contract.types.ts` |

---

## 5. Resolve / create Client (backend)

Thêm bước **`ensureAgencyClientOnPromote`** trong cùng transaction `ContractPromotePgUtil.run`, **sau** `promotePresalesToLifecycle`, **trước** `COMMIT`.

### 5.1. Input nguồn

| Field Client | Nguồn promote |
|--------------|---------------|
| `name` | `meta_json.company` → `meta_json.company_name` → `full_name` lead (trim, max 240) |
| `code` | Auto `L{leadId}` upper; collision → `L{leadId}A`, `L{leadId}B`… regex `[A-Za-z0-9][A-Za-z0-9_-]{1,30}` |
| `owner_am_id` | Email staff: `presales.assigned_am` → `lead.owner_id` → `actor` (approve GDKD) |
| `industry_slug` | Optional: map 1:1 từ `service_slug` qua bảng catalog có sẵn; **nếu không map được → NULL** (AM sửa trên client detail) |
| `notes` | Dòng promote (mục 3 Q1) + `[needs_merge]` nếu dedup mơ hồ |
| `status` | Luôn `onboarding` khi insert mới |

### 5.2. Thuật toán resolve (thứ tự)

```
1. clientId = trim(contract.agency_client_id)
   nếu UUID hợp lệ AND EXISTS clients.id → dùng (link_preexisting)

2. clientId = trim(crm_leads.agency_client_id) — cùng lead re-promote / idempotent
   nếu hợp lệ AND EXISTS → dùng (link_lead)

3. candidates = SELECT id FROM clients
     WHERE lower(trim(name)) = lower(trim($name))
       AND status NOT IN ('offboarded', 'archived')
   nếu count = 1 → dùng (link_dedup_name)
   nếu count > 1 → tạo mới + notes needs_merge + payload candidate_ids (link_ambiguous)

4. INSERT clients … onboarding → (created)
   seed_client_onboarding(clientId) — try/catch giống AgencyRepository
   onClientCreated(clientId, owner_am_id) — ngoài transaction hoặc afterCommit hook;
   **khuyến nghị:** gọi sau COMMIT qua callback từ service layer để không rollback side effect

5. UPDATE crm_contracts SET agency_client_id = $clientId WHERE id = contractId
   UPDATE crm_leads SET agency_client_id = $clientId::uuid WHERE sqlite_lead_id = leadId
   INSERT contract_event client_linked { mode, client_id, … }
```

**Không** throw khi trùng tên. **Không** ghi đè client `active` bằng `onboarding`.

### 5.3. Return type promote

Mở rộng return `ContractPromotePgUtil.run`:

```ts
{
  lifecycle_id: number;
  customer_id: number;
  case_id: number | null;
  presales_id: number;
  agency_client_id: string;      // UUID
  agency_client_link_mode:       // created | link_preexisting | link_lead | link_dedup_name | link_ambiguous
    'created' | 'link_preexisting' | 'link_lead' | 'link_dedup_name' | 'link_ambiguous';
}
```

`approveAndPromote` forward field này; contract row sau commit đã có `agency_client_id`.

### 5.4. Idempotency

- Lead đã `converted` + lifecycle tồn tại: path early-return hiện tại **vẫn** chạy ensure client nếu `agency_client_id` trống (backfill promote cũ).  
- Client đã gắn: no-op, không duplicate insert.

---

## 6. API & payload (không route mới)

| Surface | Thay đổi |
|---------|----------|
| `POST …/contracts/approvals/:id/approve` | Response thêm `agency_client_id`, `agency_client_link_mode` |
| `GET …/leads/:id/contract/readiness` | `contract.agency_client_id` populated sau promote |
| `GET …/leads/:id/contract` | Giữ nguyên shape; đảm bảo map field |

Không thêm controller mới. Không đổi cap RBAC.

---

## 7. UI — `LeadContractPanel`

Khi `contract.status === 'active'`:

| Điều kiện | UI |
|-----------|-----|
| `agency_client_id` có giá trị | Primary link: **Mở Agency Client →** `/agency/clients/{agency_client_id}` |
| Có `lifecycleId`, chưa có client | Giữ **Tạo Agency Client →** `/agency/clients/new` + muted: «Promote trước WS2 — tạo tay» |
| `link_mode === link_ambiguous` (optional từ API) | Banner vàng: «Trùng tên — Ops review merge» + vẫn mở client draft |

Vẫn hiển thị **Mở workflow triển khai** → `/crm/service-delivery/{lifecycleId}`.

**Không** thêm card mới trên `page.tsx`. **Không** NBA post-won (WS3).

Readiness reload sau approve (Hub / panel refresh) phải thấy client id — page đã fetch readiness; đảm bảo panel nhận field từ API map.

---

## 8. Acceptance (UAT + test)

| ID | Given | Then |
|----|-------|------|
| WS2-01 | Lead B2B đủ gate, chưa client | Approve → `clients` row `onboarding`; contract + lead có cùng UUID |
| WS2-02 | Panel lead sau approve | Link **Mở Agency Client**, không bắt `/new` |
| WS2-03 | Client tên trùng 1 row active | Approve link client cũ; không insert thứ hai |
| WS2-04 | Client tên trùng ≥2 row | Approve vẫn OK; client mới + `needs_merge` trong notes/event |
| WS2-05 | `contract.agency_client_id` preset hợp lệ | Link preset; không create |
| WS2-06 | Re-approve / idempotent promote | Không duplicate client/lifecycle |
| WS2-07 | `/crm/service-delivery/{id}` onboard gate | Không còn lỗi «HĐ chưa liên kết agency client» |
| WS2-08 | Lead spa / không B2B funnel | Không chạy path này (out of scope — guard b2b presales) |

### 8.1. Jest (bắt buộc)

File mới gợi ý: `contract-promote-client.spec.ts` hoặc mở rộng promote spec PG.

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern=contract-promote
```

Cases: WS2-01, 03, 04, 05, 06 — mock PG hoặc test DB seed tối thiểu theo pattern repo hiện có.

---

## 9. File map (implementation)

| File | Việc |
|------|------|
| `contract-promote-pg.util.ts` | `ensureAgencyClientOnPromote`, mở rộng return |
| `contract-promote-client.util.ts` (mới, thuần) | resolve/create, code gen, dedup — unit test dễ |
| `leads-contract-pg.repository.ts` | Forward fields; afterCommit side effect hook |
| `contract.types.ts` | Types link mode |
| `leads-contract.service.ts` | Bubble `agency_client_id` approve response |
| `LeadContractPanel.tsx` | CTA Mở Client |
| `lib/api.ts` (ops-web) | Type response nếu typed |

**Không** sửa `lead-next-action.ts` (WS3 có thể thêm `open_agency_client`).

---

## 10. Kiểm thử & deploy

- Jest promote WS2-01…06 trước merge.  
- Manual: 1 HĐ pilot trên VPS — approve → mở client → checklist onboard hiện.  
- Deploy: `APPLY=1 ./scripts/deploy_lmp_s2_vps.sh` (Nest build + ops-web nếu UI đổi).  
- **Không** DDL bắt buộc nếu cột `agency_client_id` đã có (Wave B5). Nếu VPS thiếu FK `crm_leads.agency_client_id` → script idempotent riêng (Task 0 plan).

---

## 11. Rủi ro

| Rủi ro | Chặn |
|--------|------|
| Client rác code `L5` | Collision suffix; Ops merge sau |
| Side effect trong TX | `onClientCreated` sau COMMIT |
| Dedup sai công ty | `needs_merge` + không auto-active |
| Promote cũ thiếu client | Backfill path bước 2 + manual link `/new` fallback UI |
| owner_am email sai | Resolver staff id → email; fallback actor |

---

## 12. Sign-off

| Vai trò | Duyệt | OK |
|---------|-------|-----|
| PO | §3 Q1–Q4 khóa dedup + không auto-active | ☐ |
| Agency / Ops | Fail-soft trùng tên + `needs_merge` | ☐ |
| Eng | PG-only; không route mới; file map §9 | ☐ |
| AM pilot | Happy path không `/new` | ☐ |

---

## 13. Spec self-review

| Check | Kết quả |
|-------|---------|
| TBD / TODO | Không — Q1–Q4 khóa §3; Q5/Q6 out of scope |
| Mâu thuẫn LIFE-WIN §6 WS2 | Khớp: draft, fail-soft, xóa CTA `/new` happy path |
| Mâu thuẫn S1 | S1 giữ link `/new`; WS2 thay khi có id |
| Phạm vi 1 plan | Backend util + panel; không WS3/WS4 |
| Ambiguity SQLite | Cấm — PG only |
| Bitrix phình | Không card mới lead detail |

---

## 14. Next step

1. PO/Eng tick §12 (đặc biệt §3 dedup).  
2. Plan WS2: [2026-08-29-lifecycle-ws2-promote-agency-client.md](../plans/2026-08-29-lifecycle-ws2-promote-agency-client.md) — **implemented on branch `feat/lifecycle-ws2-promote-client`**.  
3. Không gộp WS3 journey / WS4 metrics trong PR WS2.
