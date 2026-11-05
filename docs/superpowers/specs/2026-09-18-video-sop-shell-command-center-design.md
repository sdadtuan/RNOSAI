# Design: Video SOP Shell + Command Center (SC-01 upgrade)

**Ngày:** 2026-09-18  
**Document ID:** RNOSAI-VD-SHELL-CC-20260918  
**Phiên bản:** 1.0  
**Trạng thái:** Spec UI — chờ plan / implement  
**Parent:** [`2026-08-20-video-sop-module-7-design.md`](./2026-08-20-video-sop-module-7-design.md) (Module 7 — Video SOP Studio)  
**Dual-studio:** [`2026-08-20-cmkt-video-dual-studio-design.md`](./2026-08-20-cmkt-video-dual-studio-design.md)  
**Tham chiếu UX:** Content Marketing OS shell (`CmktEShell` / Command Center)

> **Tên gọi:** Đây là **Video SOP Studio** (Module 7), **không** phải Shop/e-commerce.  
> Người dùng có thể gọi tắt “Video Shop” trong chat — tài liệu và UI dùng **Video SOP**.

---

## 1. Mục tiêu & phạm vi

### 1.1. Mục tiêu

Tổ chức lại hub `/crm/video` theo layout **Content Operations Command Center**:

- Sidebar trái (shell) riêng cho Video Operations.
- `/crm/video` = **Command Center** (nâng cấp SC-01), không còn trang trống chỉ một dòng empty.
- Các màn SC-02…SC-11, SC-13 giữ form/logic hiện tại; chỉ **bọc shell**, bỏ double-nav CRM delivery.

### 1.2. Trong phạm vi (wave này)

| ID | Deliverable |
|----|-------------|
| VD-SHELL-01 | `VideoSopShell` + `app/crm/video/layout.tsx` |
| VD-SHELL-02 | Nav sidebar + lifecycle query persistence |
| VD-CC-01 | Command Center UI (KPI, gate queue, project table, CTAs) |
| VD-CC-02 | Empty state thiếu `lifecycle_id` + CTA Content Board |
| VD-WRAP-01 | Wrap SC-02…11, 13 trong shell; bỏ `CrmDeliveryPageShell` tab ngang trùng |
| VD-NAV-01 | Link SC-15 Admin providers, SC-16 Dashboard |
| VD-NAV-02 | Asset Library nav → **stub** SC-12 (chưa build full) |
| VD-GAP-DOC | Bảng gap Module 7 (mục 6) — backlog rõ ràng |

### 1.3. Ngoài phạm vi

- Viết lại visual form Brief / Script / Bible / Keyframes / Render / Takes (UI laws SC-04/06/08 chi tiết).
- SC-12 Asset Library full (`/assets/search` UI).
- SC-14 portal-web redesign (giữ Delivery + API review-links).
- Đổi prefix URL sang `/crm/video-os`.
- Đổi API stage / Gate rules / cost engine.

### 1.4. Quyết định đã khóa

| # | Quyết định |
|---|------------|
| Q1 | **Hướng 1:** wrap `/crm/video/*` (không clone `/crm/video-os`) |
| Q2 | Phạm vi **B:** shell + Command Center; form SOP giữ nguyên |
| Q3 | Scope lifecycle vẫn `?lifecycle_id=` (giống hub hiện tại) |
| Q4 | CSS: **video-sop shell classes mới** (`vd-shell`, …), lấy cảm hứng `cmkte-*` nhưng **không** reuse class CMKT (tránh coupling) |

---

## 2. Đối chiếu Module 7 (gap)

Nguồn: Module 7 §11 SC-01…16, AC-R4, M5/FR-7.12, deep link service-delivery.

| Spec | Hiện trạng (2026-09-18) | Wave này | Backlog |
|------|-------------------------|----------|---------|
| SC-01 Project list | List + empty copy; CRM tabs | **Upgrade → Command Center** | — |
| SC-02 Overview | Link strip SOP | Wrap shell; optional step cards | Polish cards |
| SC-03…11, 13 | Forms shipped | Wrap only | UI laws BA |
| SC-12 Asset Library | **Thiếu route** | Nav stub | Full library UI |
| SC-14 Client portal | API + Delivery CTA | Link từ Delivery/CC khi có package | Portal UX |
| SC-15 Admin providers | `/admin/video/providers` | Nav shell | — |
| SC-16 Dashboard | `/crm/video/dashboard` | Nav + KPI tóm tắt trên CC | — |
| AC-R4 Content Board → `vd_projects` | Picker CMKT | CTA CC deep-link | Verify create path E2E |
| Deep link `service-delivery?tab=video-sop` | Chưa wire | Document + optional link | Implement tab |
| M5 widget trên hub | SC-16 tách | CC cards từ `GET /vd/reports/production` | — |
| Cap hide nav | `shouldShowVideoSopNav` | Giữ | — |

---

## 3. Information architecture

### 3.1. Shell sidebar

| Nav label | Route / hành vi | Spec map |
|-----------|-----------------|----------|
| Command Center | `/crm/video` (+ `lifecycle_id` nếu có) | SC-01 / CC |
| Projects | Cùng CC, focus `#projects` (hoặc filter sticky) | SC-01 table |
| Production Workspace | `/crm/video/{lastProjectId}` — `localStorage` key `vd-sop-last-project` | SC-02 |
| Gate Center | `/crm/video/{lastProjectId}/gates/1` — fallback CC nếu chưa có project | SC-10 |
| Production Dashboard | `/crm/video/dashboard?lifecycle_id=` | SC-16 |
| Asset Library | `/crm/video/{lastProjectId}/library` stub **hoặc** CC notice “SC-12 backlog” | SC-12 stub |
| Admin providers | `/admin/video/providers` | SC-15 |

Brand block:

- **Video SOP** / small: *Video Operations*
- WORKSPACE chip: lifecycle id hoặc “Chưa chọn lifecycle”

### 3.2. Lifecycle

- Mọi link shell gọi helper `withLifecycleQuery(href, lifecycleId)`.
- Thiếu `lifecycle_id`: Command Center empty state (không gọi list API); CTA mở Content Marketing OS / service-delivery.
- Có lifecycle: load projects + production report.

### 3.3. SOP step pages

Routes giữ nguyên:

`/crm/video/[id]`, `/brief`, `/script`, `/bible`, `/keyframes`, `/render`, `/takes`, `/post`, `/cost`, `/delivery`, `/gates/[n]`.

Chrome:

- Outer: `VideoSopShell`.
- Inner: bỏ `CrmDeliveryPageShell` module tabs; giữ breadcrumb gọn + banner SOP hiện có (hoặc rút gọn).

---

## 4. Command Center (SC-01 upgrade)

### 4.1. Layout (khớp cảm giác CMKT CC)

1. **Sticky header:** crumb `Video SOP / Command Center` · search (title / id) · CTA **Mở Dashboard** · CTA **+ Từ Content Board**.
2. **Hàng “Cần xử lý gate”:** project có bất kỳ gate `pending` (ưu tiên Gate 1–4 từ project list + optional gate fetch batch nếu rẻ).
3. **3 KPI tiles:**
   - Project active (count `status=active`)
   - Gate pending (ước lượng / đếm)
   - Throughput / stage mix (từ report hoặc groupBy `stage`)
4. **Bảng Projects (`#projects`):** TITLE · STAGE · STATUS · ITEM (`cmkt_item_id`) · UPDATED · action mở overview.
5. **Risk / health (nhẹ):** row stage kẹt lâu hoặc cost warning nếu API sẵn; không bắt buộc API mới wave 1.

### 4.2. Data

| Widget | Source |
|--------|--------|
| Project table | `GET /api/v1/vd/projects?lifecycle_id=` |
| KPI production | `GET /api/v1/vd/reports/production?lifecycle_id=` (đã có client `getProductionReport`) |
| Gate queue | Derive từ projects + optional `GET .../gates/{n}` cho top N project (giới hạn N≤10) |

Không thêm Nest endpoint bắt buộc trong wave 1 trừ khi derive quá nặng.

### 4.3. Empty / errors

| State | UI |
|-------|-----|
| Module flag off | “Module tắt” (giống hiện tại) |
| No cap | 403 / message quyền |
| No lifecycle | Empty + hướng dẫn Content Board / deep-link gợi ý |
| Lifecycle, 0 project | Empty list + CTA tạo từ Content Board (AC-R4) |
| API error | `error` text, không blank screen |

### 4.4. CTA “Từ Content Board”

- Prefer: `/crm/content-os?lifecycle={id}` hoặc deep-link picker cinematic nếu đã có helper.
- Secondary: `/crm/service-delivery/{id}` khi map được lifecycle → service delivery (backlog tab `video-sop`).

---

## 5. Component / file map (định hướng plan)

| Path | Vai trò |
|------|---------|
| `components/video-sop/VideoSopShell.tsx` | Shell + sidebar |
| `lib/crm/video-sop-nav.ts` | Nav constants + last-project helpers |
| `styles/video-sop-shell.css` (hoặc section `globals`) | Shell + CC layout |
| `app/crm/video/layout.tsx` | Wrap children |
| `app/crm/video/page.tsx` | Command Center (thay list tối giản) |
| `app/crm/video/[id]/library/page.tsx` | Stub SC-12 |
| SOP `page.tsx` files | Gỡ CrmDelivery chrome trùng; giữ business UI |

Pattern tham chiếu: `CmktEShell.tsx`, `CmktECommandCenter.tsx`, `cmkte.css` — **copy ý tưởng, không import class cmkte**.

---

## 6. Acceptance (wave này)

| ID | Tiêu chí |
|----|----------|
| AC-VD-S1 | `/crm/video` có sidebar Video SOP; không phụ thuộc CRM delivery tab strip |
| AC-VD-S2 | Có `lifecycle_id` → bảng project + ≥1 KPI tile load được (hoặc `—` rõ ràng) |
| AC-VD-S3 | Không `lifecycle_id` → empty + CTA Content Board; không crash |
| AC-VD-S4 | Click project → `/crm/video/[id]` vẫn trong shell; Brief/Script lưu được (regression) |
| AC-VD-S5 | Nav Dashboard / Admin providers mở đúng route |
| AC-VD-S6 | Asset Library stub không 404 (page stub có copy backlog SC-12) |
| AC-VD-S7 | Flag off / thiếu cap: hành vi an toàn như trước |
| AC-VD-S8 | Hard-refresh giữ `lifecycle_id` trên link shell |

---

## 7. Backlog (sau wave)

1. SC-12 Asset Library thật + FR-7.9 search.  
2. `service-delivery/[id]?tab=video-sop` deep link.  
3. Polish SC-04 3-cột / SC-06 zoom 200% / SC-08 sync players theo UI laws BA.  
4. Portal SC-14 UX (watermark, comment timecode) ngoài Delivery.  
5. Gate Center aggregate cross-project (không chỉ last project).  
6. Optional: theme token shared CMKT ↔ Video (design system) khi ổn định.

---

## 8. Rủi ro & mitigation

| Rủi ro | Mitigation |
|--------|------------|
| Double chrome (shell + CrmDelivery) | Checklist WRAP: strip delivery tabs trên mọi `/crm/video/**` |
| Coupling CSS CMKT | Class `vd-*` riêng |
| Gate queue N+1 API | Cap N=10; hoặc chỉ hiện stage-based “cần chú ý” wave 1 |
| User vào `/crm/video` không lifecycle | Empty CTA rõ (đã UAT pain) |

---

## 9. Lộ trình

1. Plan implement (writing-plans) từ spec này.  
2. Shell + layout + CSS.  
3. Command Center thay `page.tsx`.  
4. Wrap SOP pages + stub library.  
5. Browser UAT: empty lifecycle · lifecycle 4 · project #3 regression Brief/Gate 1.  
6. Deploy VPS.

---

## 10. Self-review checklist

- [x] Không placeholder TBD trong acceptance  
- [x] Phạm vi B khớp quyết định user  
- [x] Gap Module 7 documented (mục 2 + 7)  
- [x] Không claim SC-12/14 full trong wave  
- [x] URL giữ `/crm/video` (hướng 1)  
