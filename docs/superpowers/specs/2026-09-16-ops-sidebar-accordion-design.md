# Spec — Ops sidebar accordion (Bitrix-style IA, RNOSAI brand)

> **Document ID:** OPS-NAV-20260916  
> **Version:** 1.0 · **Date:** 2026-09-16  
> **Status:** Implemented locally (ops-web) — 2026-09-16 · chờ deploy VPS / PO smoke test  
> **App:** `services/ops-web` — `OpsNav` + `globals.css`  
> **Related:** `components/layout/nav-icons.tsx`, `ops-nav-tree.ts`, `ops-nav-accordion.ts`, RBAC caps / feature flags hiện có

---

## 1. Mục tiêu

Đổi sidebar ops-web theo mô hình **Bitrix accordion**:

- Icon rõ cho từng mục.
- Gom module vào **mục cha** có **mục con** hợp lý (IA agency).
- Click cha → **mở dần** danh sách con, **đẩy** các mục bên dưới xuống.
- **Highlight một khối** bao cha + toàn bộ con đang mở / đang làm việc.
- **Giữ brand RNOSAI** (xanh hiện tại) — không đổi sang tím Bitrix.
- Mục **không có con** = **leaf**: không mũi tên, click điều hướng thẳng.

**Không đổi:** route URL, RBAC/`hasCap`, feature flags, hành vi topbar / avatar / search.

---

## 2. Quyết định đã chốt

| # | Quyết định | Chọn |
|---|------------|------|
| 1 | Màu sidebar | Giữ brand RNOSAI |
| 2 | IA | Gom lại ~12–15 mục cấp 1 (hướng khoa học, không copy Bitrix 1:1) |
| 3 | Accordion | **Lai:** mở cha mới → đóng cha khác; **giữ mở** cha chứa route hiện tại |
| 4 | Leaf | Không mũi tên; chỉ parent (≥2 con sau RBAC) mới có chevron |
| 5 | Triển khai | Hướng **B**: config tree + UI accordion (không rewrite toàn shell) |

---

## 3. Mô hình dữ liệu UI

```ts
type NavLeaf = {
  kind: 'leaf';
  id: string;          // ổn định, dùng localStorage
  label: string;
  href: string;
  icon: string;        // key trong nav-icons
  badge?: number;
};

type NavParent = {
  kind: 'parent';
  id: string;
  label: string;
  icon: string;
  children: NavChild[];
};

type NavChild = {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

type NavItem = NavLeaf | NavParent;
```

**Rule collapse parent → leaf:** sau khi filter RBAC/flag, nếu `children.length < 2` thì render như leaf (href = child[0].href hoặc hub mặc định của nhóm). Không hiện chevron.

---

## 4. Cây menu (SoT)

Thứ tự cấp 1 = hành trình agency: thu hút → bán → giữ → chạy → đo → quản trị.

Nguyên tắc sắp con: **hub / việc hàng ngày → cấu hình / báo cáo / ít dùng**.

### 4.1. Tổng quan *(leaf)*

| Label | Href |
|-------|------|
| Tổng quan | `/` |

### 4.2. Bán hàng *(parent)*

| # | Label mới | Href (giữ) |
|---|-----------|------------|
| 1 | Lead B2B | `/crm/b2b/leads` |
| 2 | Inbox B2B | `/crm/b2b-inbox` |
| 3 | Hàng đợi Solution | `/crm/solution/queue` |
| 4 | Kinh doanh | `/crm/sales` |
| 5 | Báo giá | `/crm/proposals` |
| 6 | Tra cứu dịch vụ | `/crm/sales/services` |
| 7 | Hub hợp đồng | `/crm/hub` |
| 8 | Tạo lead B2B | `/crm/b2b/leads/new` |

### 4.3. CRM *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Bảng CSKH | `/crm` |
| 2 | Lead vận hành | `/crm/operational/leads` |
| 3 | Bảng CSKH SLA | `/crm/cskh-board` |
| 4 | Tất cả leads | `/crm/leads` |
| 5 | Khách hàng | `/crm/customers` |
| 6 | Catalog | `/crm/catalog` |
| 7 | Ticket CS | `/crm/tickets` |
| 8 | KPI GDKD Enterprise | `/crm/gdkd-enterprise` |
| 9 | Tạo lead vận hành | `/crm/operational/leads/new` |

*(Các mục bán hàng/hợp đồng phụ như Đơn hàng, Dự án BĐS, GDKD command, Ingress — map vào **Bán hàng** hoặc **CRM** theo cap; ưu tiên Bán hàng nếu liên quan SO/hợp đồng.)*

### 4.4. Service Desk *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Tổng quan | `/crm/csd` |
| 2 | Ticket | `/crm/csd/tickets` |
| 3 | Chat nội bộ | `/crm/csd/chat` *(badge unread)* |
| 4 | Email | `/crm/csd/email` |
| 5 | Báo cáo | `/crm/csd/reports` |
| 6 | Mẫu báo cáo | `/crm/csd/reports/templates` |

### 4.5. Account Management *(parent hoặc leaf)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Trung tâm AM | `/crm/account-management` |

*(Khi chỉ 1 con → leaf “Account Management”.)*

### 4.6. Agency *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Agency Hub | `/agency` |
| 2 | Ingest | `/agency/ingest` |
| 3 | Thông báo | `/agency/notifications` *(badge)* |
| 4 | Định nghĩa KPI | `/agency/kpi-definitions` |

### 4.7. Quảng cáo *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Meta Ads | `/meta/facebook-ads` |
| 2 | Meta Ads Ops | `/meta/ads-ops` |
| 3 | Meta Tracking | `/meta/tracking` |
| 4 | Meta Intelligence | `/meta/intelligence` |
| 5 | Google Ads | `/google/google-ads` |
| 6 | Ads CPL | `/meta/ads-combined` |
| 7 | Zalo Ads | `/zalo/zalo-ads` |
| 8 | Zalo Leads | `/zalo/leads` |
| 9 | Meta Migration | `/meta/migration` |

### 4.8. SEO / AEO *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Hub | `/seo/hub` |
| 2 | Khách hàng SEO | `/seo/clients` |
| 3 | Nghiên cứu | `/seo/research` |
| 4 | Nội dung | `/seo/content` |
| 5 | Technical | `/seo/technical` |
| 6 | Báo cáo | `/seo/reports` |
| 7 | Chiến lược | `/seo/strategy` |
| 8+ | Governance, AEO, Authority, Rank Tracker, Automations, Freshness, Experiments, SEO BI, CMS Pilot, Gate A | giữ href `/seo/*` hiện có; xếp **sau** các mục 1–7 |

### 4.9. Email Marketing *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Hub | `/email/hub` |
| 2 | Chiến dịch | `/email/campaigns` |
| 3 | Hành trình | `/email/journeys` |
| 4 | Liên hệ | `/email/contacts` |
| 5 | Phân khúc | `/email/segments` |
| 6 | Mẫu thư | `/email/templates` |
| 7 | Khách hàng Email | `/email/clients` |
| 8+ | Đồng thuận, Suppression, Deliverability, Governance, Báo cáo, Gate A | `/email/*` tương ứng |

### 4.10. Sản xuất *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Triển khai dịch vụ | `/crm/service-delivery` |
| 2 | Content OS | `/crm/content-os` |
| 3 | Creative OS | `/crm/creative-os` |
| 4 | Image SOP | `/crm/creative-os/image` |
| 5 | Media OS | `/crm/media-os` |
| 6 | Video SOP | `/crm/video` |
| 7 | Creative Hub | `/crm/creatives` |
| 8 | Campaign Write | `/crm/campaign-writes` |
| 9 | Quy trình SOP | `/crm/sop` |
| 10 | Launch QA | `/crm/launch-qa` |
| 11+ | Catalog DV / Ops Dashboard / Ops tasks / Ops alerts | `/crm/ops/*` khi flag bật |

### 4.11. Kế hoạch *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Nghiên cứu thị trường | `/crm/research` |
| 2 | Phân tích nghiên cứu | `/crm/research/analytics` |
| 3 | Taxonomy | `/crm/research/taxonomy` |
| 4 | Kế hoạch marketing | `/crm/marketing-plan` |
| 5 | Demo GTM | `/crm/gtm/demos` |
| 6 | CMS marketing | `/crm/gtm/cms` |

### 4.12. KPI Hub *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Executive | `/crm/kpi-hub/executive` |
| 2 | Marketing | `/crm/kpi-hub/marketing` |
| 3 | Sales | `/crm/kpi-hub/sales` |
| 4 | Trang chủ Hub | `/crm/kpi-hub` |
| 5+ | Hiệu suất (Operating + sub-routes performance) | `/crm/kpi-hub/performance*` |
| 6+ | Service KPI / War Room + templates… | `/crm/kpi-hub/service-*` / instances… |
| 7+ | Dictionary, Target, Sources, Quality, Reports, Settings | cuối nhóm |

### 4.13. Nhân sự *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | HR Hub | `/crm/hr` |
| 2 | Nhân viên | `/crm/staff` |
| 3 | KPI | `/crm/kpi` |
| 4 | KPI AM/SP | `/crm/staff-kpi` |
| 5 | Chấm công & lương | `/crm/payroll` |
| 6+ | Nhóm KPI, Loại KPI, KPI Solution, AI Insights, Coach digest | xếp sau |

### 4.14. Tài chính *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Dashboard kinh doanh | `/crm/business-dashboard` |
| 2 | Forecast | `/crm/forecast` |
| 3 | Tài chính | `/crm/financials` |
| 4 | Hóa đơn | `/crm/invoices` |
| 5 | CS Health | `/crm/health` |
| 6 | BC tuần chủ DN | `/crm/owner-weekly` |
| 7 | NL Analytics | `/crm/ai/query` |

### 4.15. CEO *(leaf)*

| Label | Href |
|-------|------|
| CEO | `/crm/ceo` |

### 4.16. Báo cáo nội bộ *(parent)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Báo cáo công việc | `/crm/internal-reports` |
| 2 | Hộp thư | `/crm/internal-reports/inbox` |
| 3 | Dashboard | `/crm/internal-reports/dashboards` |
| 4 | Cây kỳ | `/crm/internal-reports/team` |
| 5 | Lịch BC | `/crm/internal-reports/schedules` |
| 6 | DS phân phối | `/crm/internal-reports/lists` |
| 7 | Report builder | `/crm/internal-reports/builder` |
| 8 | Mẫu BC nội bộ | `/crm/internal-reports/templates` |
| 9 | Blocker & Rủi ro | `/crm/internal-reports/risks` |

### 4.17. Tự động hóa *(parent — ẩn nếu 0 con)*

| # | Label mới | Href |
|---|-----------|------|
| 1 | Workflows | `/crm/automation` |
| 2 | Playbooks | `/crm/playbooks` |
| 3 | Playbook DV | `/crm/admin/mkt-ai/playbooks` |

### 4.18. Admin *(leaf hoặc parent)*

Links từ `buildAdminSidebarLinks(user)` — thứ tự ưu tiên: Tổng quan Admin → Tổ chức → Phân quyền → còn lại.  
1 link → leaf; ≥2 → parent **Admin**.

### 4.19. Mục hiện có chưa liệt kê tường minh

Các link còn lại trong `buildSections` hiện tại (Chuẩn bị / Delivery projects / Revenue Ops / …) **phải được map** vào một cha ở trên khi implement; không bỏ route. Mapping cụ thể ghi trong PR / plan:

| Nguồn cũ (ví dụ) | Cha mới |
|------------------|---------|
| Chuẩn bị (Intake, Dự án PTT, …) | Bán hàng hoặc CRM (ưu tiên Bán hàng) |
| Revenue Operations | Bán hàng hoặc leaf nếu 1 link |
| CRM · Bán hàng & Hợp đồng (orders…) | Bán hàng |
| SERVICE KPI / HIỆU SUẤT | KPI Hub |
| AI & Automation | Tự động hóa |

---

## 5. Interaction & visual

### 5.1. Accordion (lai)

1. Click **parent** (không phải child): toggle open/close.
2. Khi **mở** parent A: đóng mọi parent khác **trừ**:
   - parent đang chứa `pathname` active, và
   - parent A vừa mở.
3. Khi route đổi: auto-open parent chứa link active; không force-close parent đó.
4. Persist: `localStorage` key mới khuyến nghị `ops-nav-accordion-v2` (tránh lệch schema cũ `ops-nav-sections-collapsed`). Migrate best-effort hoặc reset một lần.

### 5.2. Animation

- Mở/đóng children: ~220ms ease, dùng `grid-template-rows: 0fr → 1fr` (hoặc max-height tương đương) để **đẩy** mục dưới xuống mượt.
- `prefers-reduced-motion`: tắt animation (snap).

### 5.3. Highlight khối

- Khi parent **open** **hoặc** chứa route active: một container bo góc bao **cả cha + children** (nền accent RNOSAI nhẹ / border primary).
- Child active: nền đậm hơn trong khối; font weight tăng.
- Leaf active: highlight item đơn (như link hiện tại), không khung nhóm.

### 5.4. Icons & badge

- Parent: icon section; child: `iconForHref(href)` (mở rộng glyph nếu thiếu).
- Badge số (chat unread, email approvals, agency notifications) góc icon — đỏ tròn nhỏ như tham chiếu Bitrix.
- Chevron chỉ trên parent; xoay khi open.

### 5.5. Rail collapsed

- Giữ rail icon hiện tại khi sidebar thu gọn.
- Click icon parent trên rail: flyout / drawer danh sách con (giữ pattern hiện có nếu đang dùng); không phá mobile.

### 5.6. Brand

- Background sidebar: `var(--page-bg)` / token hiện có.
- Text/icon: `var(--text)`; active/hover: primary xanh RNOSAI.
- **Không** gradient tím Bitrix.

---

## 6. Phạm vi kỹ thuật

| Làm | Không làm (v1) |
|-----|----------------|
| Refactor `buildSections` → `buildNavTree` | Đổi URL / Nest API |
| UI accordion + CSS trong `OpsNav` + `globals.css` | Đổi topbar / brand logo |
| Đổi label VI theo §4 | Theme tím Bitrix |
| Tests: tree mapping + accordion open rules | Rewrite toàn bộ nav-icons |

**Files chính dự kiến**

- `services/ops-web/src/components/OpsNav.tsx`
- `services/ops-web/src/components/ops-nav-tree.ts` *(mới — pure build tree)*
- `services/ops-web/src/components/ops-nav-tree.spec.ts` *(mới)*
- `services/ops-web/src/app/globals.css`
- `services/ops-web/src/components/layout/nav-icons.tsx` *(bổ sung glyph nếu thiếu)*

---

## 7. Acceptance criteria

1. Sidebar có tối đa ~15 mục cấp 1 visible (sau RBAC), mix leaf + parent.
2. Leaf không có chevron; parent có chevron.
3. Click parent → children animate mở và đẩy mục dưới; đóng cha khác theo rule lai §5.1.
4. Khối highlight bao cha+con khi open/active.
5. Brand xanh RNOSAI; không tím Bitrix.
6. Mọi href trước đây vẫn reachable nếu user còn cap (không orphan route).
7. Badge chat/email/agency vẫn hoạt động.
8. Unit test: mapping nhóm + `children.length < 2` → leaf; accordion exclusive+keep-active.

---

## 8. Rủi ro & mitigation

| Rủi ro | Mitigation |
|--------|------------|
| User quen label cũ (English Hub names) | Spec đổi VI có chủ đích; có thể thêm `title` tooltip label cũ 1 sprint |
| Quên map link | Checklist §4.19 + test “mọi href cũ ∈ tree” |
| localStorage schema lệch | Key `v2` + default open theo active route |

---

## 9. Out of scope / follow-up

- Drag-reorder menu per user.
- Custom pin favorites.
- Đồng bộ nav portal-web.
- Bitrix purple theme skin.

---

## 10. Sign-off

| Vai trò | Tên | Ngày | Đồng ý |
|---------|-----|------|--------|
| PO / User | | | ☐ Spec §1–§5 |
| Dev lead | | | ☐ Ready for plan |

**Next:** Sau khi user duyệt file này → `writing-plans` → implement OpsNav tree + accordion CSS.
