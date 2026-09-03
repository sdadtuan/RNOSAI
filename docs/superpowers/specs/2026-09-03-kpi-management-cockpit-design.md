# Design: KPI Management Cockpit (hướng A)

**Ngày:** 2026-09-03  
**Trang:** `/crm/kpi`  
**Phê duyệt:** hướng A — bố cục theo mockup “Quản lý KPI”, ngôn ngữ CSS `kpi-*` / `DashboardShell`, không Tailwind, không trang mới.

---

## Vấn đề

`/crm/kpi` hiện là sổ điểm tháng (tile số NV / số KPI / AI acceptance, bar theo nhân viên, grid nhập actual). Mockup cần cockpit điều hành: RAG cuốn theo phòng, danh sách cần chú ý, donut, % cập nhật đúng hạn. Dữ liệu nền (`crm_staff_kpi`) đủ; thiếu cách đọc và layout.

## Phạm vi Wave 1 (làm) / ngoài scope

**Làm**

- Đổi layout `/crm/kpi` theo khối mockup.
- RAG tự tính từ actual/target (không ghi đè cột `status` tay).
- Thẻ tổng, bar phòng, bảng chú ý, tab danh sách, donut, insight rule-based.
- Nút **Xuất báo cáo** (Excel sẵn) và **+ Tạo KPI** (tạo *định nghĩa* metric, API sẵn).
- Thêm `staff_department` vào list staff KPI để gộp phòng.

**Không làm**

- Schema mới, bảng KPI song song, cột `project_id` / `customer_id` / chu kỳ tuần.
- Tab Team / Dự án / Khách hàng.
- Gán mục tiêu (`target_value`) cho nhân viên từ UI.
- Join IWR blocker / CSD ticket P1 / LLM (`PTT_IWR_LLM`, `PTT_CSD_LLM` không bật).
- Clone pixel mockup (font mới, card tím, topbar riêng).
- Đổi `/crm/staff-kpi`, `/crm/kpi/solution`, `/crm/business-dashboard`.

---

## Bố cục trang

Giữ `DashboardShell` + `ModuleSubNav` + `StaffPageShell`. Đổi title toolbar thành **Quản lý KPI**. Subtitle: `Theo dõi mục tiêu, kết quả và cảnh báo hiệu suất · Kỳ {tháng/năm}`.

Thứ tự khối (trên xuống):

1. **Filters** (trong `PageToolbar actions`): `KpiTeamToggle` (giữ, e2e WIN-2) · input năm · input tháng · select phòng ban · **Xuất báo cáo** · **+ Tạo KPI** (chỉ khi `hasCap(user, 'crm_kpi_records', 'edit')`).
2. **5 thẻ** trong `.kpi-tile-grid` (giữ class).
3. **Hàng giữa** `.kpi-page__section--split`: trái *Tiến độ KPI theo phòng ban* · phải *KPI cần chú ý*.
4. **Hàng dưới** grid 2 cột: trái *Danh sách KPI* (tab + bảng) · phải *Insight* + donut.
5. **Nhập actual KPI** — giữ `KpiEditableGrid` + heading `Nhập actual KPI` (e2e RNOS-44).
6. `<details>` — *So sánh NV theo chỉ tiêu* + `KpiTrendPanel` (ẩn mặc định; không mất API chart/trend).

Không thêm topbar tìm kiếm riêng; search global OpsNav giữ nguyên.

### Select phòng ban

Options = `Tất cả phòng ban` + các `crm_staff.department` khác rỗng xuất hiện trong kỳ (sau filter team). Giá trị rỗng hiển thị **Chưa gắn phòng**.

---

## Công thức (một nguồn, có unit test)

File: `services/ptt-crm-api/src/kpi/kpi.types.ts` — thêm hàm, ops-web copy cùng logic vào `services/ops-web/src/lib/kpi/rag.ts` (test vitest). Không extract package chung.

### `achievementPct(higherIsBetter, target, actual)`

Giữ đúng `kpiAchievementPct` hiện tại: thiếu target/actual hoặc target = 0 → `null`; higher-is-better `min(100, 100 * actual/target)`; lower-is-better `min(100, 100 * target / max(actual, ε))`. Làm tròn 2 chữ số.

### `deriveKpiRag(higherIsBetter, target, actual)` → `green | yellow | red | no_data`

| Điều kiện | RAG |
|-----------|-----|
| `achievementPct` là `null` | `no_data` |
| `pct >= 90` | `green` (Xanh — đúng tiến độ) |
| `75 <= pct < 90` | `yellow` (Vàng — cần theo dõi) |
| `pct < 75` | `red` (Đỏ — không đạt) |

Lower-is-better đã nằm trong `achievementPct` (CPA, thời gian xử lý: actual lớn → pct thấp → đỏ). Không dùng cột `status` cho màu cockpit. Alert cũ (`missed` / `at_risk` / `warn_ratio`) vẫn phục vụ API `/alerts`; UI cockpit không phụ thuộc chúng.

### Mẫu số thẻ

`scored` = bản ghi có `achievementPct != null`.  
`total` = mọi bản ghi trong bộ lọc kỳ + team + phòng.

| Thẻ | Giá trị | Hint |
|-----|---------|------|
| KPI đúng tiến độ | `{green}/{total}` | Sparkline 6 tháng: count green (metric bất kỳ — lấy trend `KpiTrendPanel` của metric đang chọn trong `<details>`, hoặc bỏ sparkline nếu chưa có series count). **Chốt:** hint = `+{Δ} so với tháng trước` với Δ = green kỳ này − green kỳ trước (cùng filter). Không vẽ sparkline mới nếu không có đủ 2 kỳ. |
| Cần theo dõi | `{yellow}` | Δ yellow vs tháng trước |
| Không đạt | `{red}` | Δ red vs tháng trước |
| Tỷ lệ hoàn thành | Trung bình `achievementPct` trên `scored`, 1 chữ số thập phân + `%`. Không có scored → `—` | Δ điểm % vs tháng trước |
| Cập nhật đúng hạn | `{ontime}/{total}` làm tròn % nguyên | Δ vs tháng trước |

Tháng trước: cùng `team` + cùng filter phòng, `month-1` (năm lùi nếu tháng 1). Fetch lần hai `GET /api/crm/staff/kpi?year&month`.

### Cập nhật đúng hạn

Hạn: 23:59 `Asia/Ho_Chi_Minh` ngày **5** của tháng *sau* kỳ (kỳ 9/2026 → 05/10/2026 23:59 ICT).

Một bản ghi **đúng hạn** khi `actual_value != null` **và** `updated_at` (timestamptz) ≤ hạn.

Nếu `now < hạn` (kỳ đang mở): đúng hạn = `actual_value != null` (chưa phạt muộn).

### Tiến độ phòng

Gom theo `staff_department` (rỗng → `Chưa gắn phòng`). Mỗi phòng:

- Đếm green / yellow / red / no_data.
- Bar xếp chồng 100% theo 4 nhóm (xám = no_data).
- **Tổng tiến độ** = trung bình `achievementPct` của hàng `scored` trong phòng; không scored → `—`.

Sắp xếp theo tên phòng `vi`.

### KPI cần chú ý

Tối đa 8 hàng: `red` trước, rồi `yellow`, rồi `no_data` có target nhưng chưa actual. Không lấy `green`. Cột: tên KPI, owner (tên), phạm vi = phòng, `actual / target` + đơn vị, thanh tiến độ màu RAG, pill Xanh/Vàng/Đỏ/Chưa có số.

### Donut

Ba lát: green / yellow / red (không vẽ no_data trên donut). Tâm: `total` scored+unscored hoặc số lát — **chốt:** tâm = `green+yellow+red` (chỉ hàng có RAG). Chú thích % trên tổng ba lát.

### Insight (rule, không LLM)

Một card, một headline + tối đa 2 đề xuất checkbox (chỉ hiển thị, không persist):

1. Nếu `red > 0`: *Có {red} KPI không đạt trong kỳ. Ưu tiên các hàng Đỏ.* Đề xuất: “Xử lý các KPI Đỏ trong danh sách cần chú ý.”
2. Else nếu `yellow > 0`: *Có {yellow} KPI cần theo dõi.* Đề xuất tương ứng.
3. Else: *Không có KPI vàng/đỏ trong bộ lọc hiện tại.*
4. Nếu `ontime_pct < 80` và `total > 0`: thêm đề xuất “Nhắc owner cập nhật actual trước hạn ngày 5.”
5. Link phụ: `Xem AI Insights` → `/crm/ai/insights` (thay tile AI trên đầu trang).

Không có “Xem rủi ro liên quan” (IWR) trong Wave 1.

---

## Danh sách KPI

Tabs (role=tablist): **Tất cả** · **Cá nhân** · **Phòng ban**. Không render tab Team / Dự án / Khách hàng.

- Tất cả: mọi hàng sau filter kỳ/team/phòng.
- Cá nhân: `staff_id === Number(user.id)` (`StoredStaffUser.id` là string).
- Phòng ban: nhóm bằng `<tbody>` / heading phòng; vẫn là bảng một, không trang mới.

Cột: Tên KPI · Owner · Phạm vi (phòng) · Chu kỳ (cố định chữ **Tháng**) · Mục tiêu · Thực tế · Tiến độ (bar + %) · Xu hướng · Trạng thái · menu `⋯`.

**Xu hướng:** so `achievementPct` kỳ này vs cùng staff+metric tháng trước. Tăng → mũi tên lên (xanh); giảm → xuống (đỏ); bằng hoặc thiếu dữ liệu → `—`.

**Menu hàng:** không bắt buộc hành động mới. Wave 1: một item “Sửa actual” scroll tới hàng tương ứng trong `KpiEditableGrid` (`data-kpi-id`). Nếu không làm được gọn, menu có thể bỏ — **chốt:** bỏ cột ⋯ Wave 1; sửa actual chỉ ở grid dưới.

Phân trang: 20 hàng/trang trên bảng cockpit. Grid nhập actual không phân trang (giữ hành vi cũ).

Empty: *Chưa có bản ghi KPI trong kỳ này.*

---

## API

Không endpoint mới.

1. `GET /api/crm/staff/kpi` — thêm field `staff_department: string` (từ `crm_staff.department`, `''` nếu null). `mapStaffKpiRow` + SELECT `s.department AS staff_department`.
2. `POST /api/crm/kpi/metrics` — giữ nguyên; UI drawer gọi khi bấm + Tạo KPI.
3. `GET /api/crm/kpi/board` — giữ `staff_count`, `kpi_count`, `summary`, `alerts` (trang khác / test có thể còn đọc). Trang cockpit **không** dùng `summary.critical/warn` cho 5 thẻ mới.

Jest: `kpi.types` test cho `deriveKpiRag` (higher/lower, biên 75/90, null). Repository map có `staff_department`.

---

## UI / CSS

- Chỉ `services/ops-web/src/app/globals.css` — block mới `.kpi-cockpit-*` cạnh block RNOS-42. Token: `--accent`, `--success`, `--danger`, `--border`, `--bg`, `--text`. Xanh CRM `#17692f` / `#2e7d4f` như tile hiện tại. Vàng `#c58a00`. Xám no_data = `--border`.
- Component mới dưới `services/ops-web/src/components/kpi/`:
  - `KpiCockpitTiles.tsx`
  - `KpiDeptStackChart.tsx`
  - `KpiAttentionTable.tsx`
  - `KpiCockpitList.tsx`
  - `KpiRagDonut.tsx`
  - `KpiCockpitInsight.tsx`
  - `KpiCreateMetricDrawer.tsx`
- `page.tsx` ráp khối; không rewrite `DashboardShell`.
- Drawer tạo metric: tên bắt buộc, code/unit tùy chọn, checkbox “Cao hơn càng tốt” (mặc định bật), `warn_ratio` số tùy chọn. Submit → POST → reload metrics. Lỗi hiện trong drawer.

Responsive: dưới ~800px, split thành 1 cột; 5 thẻ 2 cột.

---

## E2E phải sửa (cùng PR)

| File | Đổi |
|------|-----|
| `kpi-rnos42.spec.ts` | Heading `/quản lý kpi/i`. `.kpi-bar-chart` không còn visible mặc định → assert `.kpi-dept-stack` hoặc `.kpi-cockpit`. |
| `kpi-dashboard-rnos43a.spec.ts` | Bỏ assert “Tỷ lệ chấp nhận AI”. Button `/xuất báo cáo/i`. Giữ `.dashboard-shell` + `.kpi-page__section--split`. |
| `kpi-grid-rnos44.spec.ts` | Giữ heading `Nhập actual KPI`. |
| `win-2-kpi-vux-07.spec.ts` | Giữ team toggle. |

Thêm smoke: 5 thẻ có chữ *đúng tiến độ* / *Cần theo dõi* / *Không đạt*; tab *Tất cả*; donut `data-testid="kpi-rag-donut"`.

---

## RBAC

- Xem trang: `crm_kpi_records.view` (như cũ).
- Sửa actual: `crm_kpi_records.edit` (grid).
- + Tạo KPI: cùng `edit` (trùng `StaffKpiWriteGuard`).

---

## Kiểm thử unit

- `deriveKpiRag` / hạn ngày 5: file `kpi.types` (API) + `lib/kpi/rag.spec.ts` (ops-web).
- `buildCockpitSummary(rows, prevRows, now)` — đếm thẻ, ontime, by_department, attention order. Pure function, không React.

---

## Tiêu chí xong

1. `/crm/kpi` hiện 5 khối đúng thứ tự trên, số khớp công thức với data thật (không hardcode 42/58).
2. Đổi năm/tháng/team/phòng → mọi khối lọc cùng bộ.
3. Tab Cá nhân chỉ hàng của user đăng nhập.
4. Tạo metric (user edit) xuất hiện trong `<details>` catalog; không tự tạo `crm_staff_kpi`.
5. Excel vẫn tải được.
6. E2E liệt kê ở trên xanh (local hoặc CI).
7. Không bật flag LLM.

---

## Wave 2 / 3 (không implement lúc này)

- Wave 2: form gán target; `scope` dự án/KH; chu kỳ tuần; tab còn lại.
- Wave 3: insight nối IWR + CSD P1.
