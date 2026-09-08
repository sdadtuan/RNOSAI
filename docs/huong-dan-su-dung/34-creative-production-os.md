# Creative Production OS — Hướng dẫn sử dụng

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-09-08  
> **Đối tượng:** AM, Creative, Brand, Legal, Motion/Editor, Admin  
> **URL:** https://rs.pttads.vn/crm/creative-os  
> **Menu:** CRM · Triển khai dịch vụ → **Sản xuất sáng tạo**  
> **Quyền tối thiểu:** `crm_cp.view` hoặc `crm_cp.view_all`

Creative Production OS (CP OS) quản lý vòng đời **project → brief → asset → Brand Kit → video AI → QC → duyệt → lịch xuất bản → credit**. Module nằm **trong CRM** (`/crm/creative-os*`), không phải app tách, không thay Content OS hay Video SOP.

**Tài liệu liên quan**

| Chủ đề | File |
|--------|------|
| Đặc tả nghiệp vụ | [SRS Creative Production OS](../superpowers/specs/2026-09-07-creative-production-os-srs.md) |
| Video người (cinematic) | [20-video-sop-huong-dan-day-du.md](./20-video-sop-huong-dan-day-du.md) |
| Content / lịch copy | [18-content-marketing-os.md](./18-content-marketing-os.md) |
| Creative Hub (duyệt khách) | [03-agency-service-delivery.md](./03-agency-service-delivery.md) · `/crm/creatives` |

---

## Mục lục

1. [Mở module và phạm vi](#1-mở-module-và-phạm-vi)
2. [Quyền truy cập](#2-quyền-truy-cập)
3. [Tổng quan](#3-tổng-quan)
4. [Dự án](#4-dự-án)
5. [Video AI](#5-video-ai) — gồm [làm video đầu tiên từng bước](#51-làm-video-đầu-tiên--từng-bước)
6. [Thư viện media](#6-thư-viện-media)
7. [Brand Kit](#7-brand-kit)
8. [Lịch xuất bản](#8-lịch-xuất-bản)
9. [Báo cáo](#9-báo-cáo)
10. [Cấu hình](#10-cấu-hình)
11. [Luồng làm việc gợi ý](#11-luồng-làm-việc-gợi-ý)
12. [Sự cố thường gặp](#12-sự-cố-thường-gặp)

---

## 1. Mở module và phạm vi

### 1.1. Vào CP OS

1. Đăng nhập https://rs.pttads.vn/login
2. Sidebar **CRM · Triển khai dịch vụ** → **Sản xuất sáng tạo**
3. Hoặc mở trực tiếp `/crm/creative-os`

Không thấy menu → liên hệ Admin cấp `crm_cp.view` (hoặc `view_all`), rồi **đăng xuất / đăng nhập lại**.

Bên trong module có **đúng 8 mục** (sidebar trái):

| # | Mục | Route |
|---|-----|-------|
| 1 | Tổng quan | `/crm/creative-os` |
| 2 | Dự án | `/crm/creative-os/projects` |
| 3 | Video AI | `/crm/creative-os/video` |
| 4 | Thư viện | `/crm/creative-os/media` |
| 5 | Brand Kit | `/crm/creative-os/brand-kits` |
| 6 | Lịch xuất bản | `/crm/creative-os/calendar` |
| 7 | Báo cáo | `/crm/creative-os/reports` |
| 8 | Cấu hình | `/crm/creative-os/settings` |

### 1.2. Phạm vi dữ liệu (Của tôi / Team / Toàn bộ)

Hầu hết danh sách có bộ lọc **Phạm vi**:

| Giá trị | Ý nghĩa |
|---------|---------|
| **Của tôi** (`me`) | Project / draft bạn là owner hoặc member |
| **Team** | Phạm vi nhóm |
| **Toàn bộ** | Toàn tenant — cần `crm_cp.view_all` |

Mặc định là **Của tôi**. Nếu vừa import/tạo project mà không thấy trên danh sách, đổi phạm vi sang **Toàn bộ** rồi tìm lại.

### 1.3. Dấu `—` nghĩa là gì

Khi chưa có số liệu thật, ô KPI / cột / ô trống hiện **`—`**. Đây là trạng thái đúng, không phải lỗi. Hệ thống **không điền số mẫu** (không có 86 video, 3.840 credit giả).

### 1.4. CP OS không làm gì

| Việc | Dùng module nào |
|------|-----------------|
| Lịch copy / bài Content OS | Content OS trên lifecycle (`/crm/service-delivery/[id]?tab=content-os`) |
| Video người (quay, SOP cinematic) | **Video SOP** `/crm/video` — CP chỉ gắn `vd_project_id`, không clone pipeline |
| Khách duyệt creative | **Creative Hub** `/crm/creatives` (+ portal khách) |
| Tạo khách hàng mới | AM 360 — form project **không** tạo khách ma |
| Campaign / hợp đồng | Lifecycle dịch vụ — không có bảng campaign thứ hai trong CP |

---

## 2. Quyền truy cập

Admin gán tại **Admin → Permissions**. Script seed chỉ đăng ký catalog, **không** tự cấp quyền cho nhân viên.

| Section | Hành động | Dùng khi |
|---------|-----------|----------|
| `crm_cp` | `view` | Vào module, xem dữ liệu trong phạm vi của mình |
| `crm_cp` | `view_all` | Xem toàn PTT |
| `crm_cp` | `edit` | Tạo/sửa project, brief, draft, asset |
| `crm_cp` | `manage` | Cấu hình module, đóng project |
| `crm_cp.render` | `execute` | Gửi render |
| `crm_cp.render_high_cost` | `execute` | Render vượt ngưỡng chi phí |
| `crm_cp.export_final` | `execute` | Xuất file thành phẩm |
| `crm_cp.publish` | `execute` | Đưa vào lịch xuất bản |
| `crm_cp.brand` | `edit` | Sửa Brand Kit |
| `crm_cp.manage_brand_rule` | `manage` | Quy tắc brand |
| `crm_cp.approve_legal` | `execute` | Duyệt pháp lý |
| `crm_cp.finance` | `view` | Credit / ngân sách |
| `crm_cp.view_audit` | `view` | Nhật ký |

SUPER-ADMIN thấy đủ menu. Nhân viên khác chỉ thấy mục đã được cấp.

---

## 3. Tổng quan

**Route:** `/crm/creative-os`

Màn hình điều hành sản xuất. Lọc theo **Từ ngày / Đến ngày / Khách / Lifecycle / Owner / Phạm vi**, rồi bấm áp dụng.

### 3.1. Tám ô KPI

| Ô | Ý nghĩa |
|---|--------|
| Video đã tạo | Số draft / version đã tạo trong kỳ |
| Video đã duyệt | Số version đạt trạng thái duyệt |
| Render thành công | Tỷ lệ job render hoàn tất |
| Thời lượng render TB | Trung bình thời gian render |
| Credit đã dùng | Credit đã charge trong kỳ |
| Credit còn lại | Phần ngân sách còn |
| Asset sắp hết quyền | Asset gần ngày hết license |
| Việc quá hạn | Task / deliverable quá hạn |

Chưa có dữ liệu → **`—`**. Click ô (khi có số) đi tới danh sách liên quan (Video, Ops, Báo cáo credit, Thư viện quyền, …).

### 3.2. Action Center

Nút **Action Center (n)** mở ngăn việc cần xử lý (`?panel=actions`): render lỗi, asset hết quyền, việc quá hạn. Số `n` là số action thật, có thể là 0.

### 3.3. Các khối khác

- **Production health** — trạng thái provider / hàng đợi (thiếu = `—`)
- **Project đang chạy** — shortcut vào workspace
- **Milestone** — hạn gần nhất
- **Hoạt động** — nhật ký gần đây; xem đủ tại `/crm/creative-os/activity`
- **Ops monitor** — `/crm/creative-os/ops` theo dõi hàng đợi render

---

## 4. Dự án

### 4.1. Danh mục (`/crm/creative-os/projects`)

Ba ô trên cùng: **Số project**, **Deliverable xong**, **Credit at-risk**.

Chip lọc:

| Chip | Tác dụng |
|------|----------|
| Tất cả (n) | Bỏ lọc trạng thái |
| Active / At Risk / In Review | Lọc đúng status |
| Của tôi | Đặt phạm vi `me` |

Bộ lọc nâng: tìm tên/mục tiêu, tên khách, tên owner, slug/ID lifecycle, phạm vi → **Áp dụng**.

Cột bảng: Project · Khách / lifecycle · Deliverable (`x / y` hoặc `—`) · Hạn · Status · Owner · Credit (`%` hoặc `—`).

- Tên project → workspace CP
- Tên khách → AM 360
- Lifecycle → Content OS của lifecycle đó

**Trạng thái project:** Draft · Active · At Risk · In Review · Completed · Archived.

### 4.2. Lấy từ Dự án PTT

Nút **Lấy từ Dự án PTT** import project B2B đã có (idempotent — bấm lại không nhân bản).

1. Đứng trên **Dự án**
2. Bấm **Lấy từ Dự án PTT** (nút chuyển thành *Đang lấy…*)
3. Đổi phạm vi **Toàn bộ** nếu không thấy ngay trên **Của tôi**
4. Mở project bằng tên khách / mã (ví dụ PTT)

Chỉ import SoR B2B hiện có. Không tạo khách mới.

### 4.3. Tạo project (`/crm/creative-os/projects/new`)

1. **Tạo project**
2. Điền form (chọn từ danh sách, không dán UUID):

| Trường | Bắt buộc | Ghi chú |
|--------|----------|---------|
| Tên | Có | Tên hiển thị |
| Khách (agency_client) | Có | Dropdown khách AM 360 |
| Owner | Có | Dropdown nhân sự |
| Lifecycle | Không | Gắn chiến dịch / hợp đồng đang chạy |
| Ngành | Không | Tự copy từ khách khi chọn |
| Mục tiêu | Không | |
| Bắt đầu / Hạn | Không | |
| Team | Không | Giữ Ctrl/Cmd để chọn nhiều member |
| Credit budget | Không | Để trống → cột credit hiện `—` |
| Cost center | Không | |
| Tags | Không | Cách nhau bằng dấu phẩy |

3. **Tạo project** → vào workspace. Project mới ở trạng thái **Draft**.

**Hủy** quay về danh mục.

### 4.4. Workspace (`/crm/creative-os/projects/[id]`)

Tám tab:

| Tab | Việc làm |
|-----|----------|
| **Tổng quan** | KPI deliverable / video final / ngày còn / credit. Sửa status. **Đóng project** (không dùng cho Completed/Archived). Deep-link AM 360 và Content OS |
| **Brief** | Bối cảnh, mục tiêu, thông điệp + CTA, ràng buộc. **Tạo revision** (nháp) hoặc **Gửi duyệt Brand** |
| **Deliverables** | Thẻ loại `ai_video` / `motion` / `social` / `landing_asset` / `human_video`. Tạo mới: loại + hạn + owner. Human video: điền **VD project ID** (Video SOP), không sản xuất trong CP |
| **Công việc** | Việc nội bộ project (assignee, hạn, prio). Không clone ticket CSD; có thể gắn `am_task_id` / `csd_ticket_id` |
| **Media** | Asset đã gán project. **Upload gán project** mở Ingest |
| **Phê duyệt** | Bảng bước duyệt. Chọn version đã QC rồi **Chia sẻ review (Hub)** |
| **Ngân sách** | Used / budget / reserved. **Xuất CSV** credit khi có quyền finance |
| **Hoạt động** | Nhật ký của đúng project này |

Nút **Timeline** mở timeline project. Nút **Chia sẻ review (Hub)** chỉ bật khi đã chọn version **đã QC**. Khách xem trên Creative Hub / portal — CP không có cổng duyệt khách riêng.

---

## 5. Video AI

Video AI **không** xuất file ngay trên ô Preview. Luồng đúng:

```
Có project → tạo draft → mở Studio → viết Prompt → chỉnh tỉ lệ/duration
  → bấm Tạo video (reserve) → xem job ở Queue / tab Ops
```

Ô Preview giữa màn (`Preview 9:16 · — / 01:00`) là **khung tỷ lệ**, không phải máy phát. Dấu `—` = chưa có scene / chưa có version — bình thường trước khi render.

**Model `stub` trên môi trường hiện tại nghĩa là:** bấm **Tạo video (reserve)** chỉ **đặt chỗ credit + ghi job**. **Không** sinh file MP4 AI thật. Đó không phải lỗi thao tác. File AI thật chỉ có khi IT bật AI production và dropdown Model hiện model thật (không chỉ `stub`).

---

### 5.1. Làm video đầu tiên — từng bước

Làm **đúng thứ tự**. Bỏ bước 1–2 thì Studio mở được nhưng không biết “video nằm ở project nào”.

#### Bước 0 — Vào đúng module

1. Đăng nhập https://rs.pttads.vn/login
2. Sidebar trái: **CRM · Triển khai dịch vụ** → **Sản xuất sáng tạo**
3. Trong menu trái CP OS, bấm **Video AI**  
   URL: `/crm/creative-os/video`

Không thấy menu → Admin cấp `crm_cp.view`, **đăng xuất / đăng nhập lại**.

#### Bước 1 — Có project (bắt buộc)

Draft video **phải gắn project**. Chưa có project:

1. Menu trái → **Dự án** → **Tạo project** (`/crm/creative-os/projects/new`)
2. Điền tối thiểu:
   - **Tên \*** — ví dụ `PTT — Video Shorts 09/2026`
   - **Khách** — chọn agency client từ dropdown
   - **Owner \*** — chọn chính bạn
3. Bấm **Tạo project**
4. Quay lại **Video AI**

Đã có project: sang bước 2. Không thấy project trong ô tìm → đổi bộ lọc **Phạm vi** sang **Toàn bộ** (cần `crm_cp.view_all`).

#### Bước 2 — Tạo draft rồi vào Studio

Trên `/crm/creative-os/video` (trang **Video drafts**), khối **Tạo draft**:

1. Ô **Project** — gõ tên project (ví dụ `PTT`). **Không** dán UUID
2. Ô **Tên video** — ví dụ `Shorts khai trương HCM`
3. Bấm **Mở Studio**

Hệ thống tạo draft và chuyển tới `/crm/creative-os/video/[id]` — đúng màn **Video Studio — …** như ảnh.

Draft đã có trong bảng dưới: cột **Studio** để mở lại. Không tạo draft mới nếu chỉ muốn sửa draft cũ.

#### Bước 3 — Tab Studio (màn bạn đang thấy)

Giữ tab **Studio** (chip đầu tiên). Bỏ qua Storyboard / Timeline / Ops cho đến khi đã gửi render.

**Cột trái — nội dung**

1. Chip **Prompt** (sáng) — dùng cho lần đầu.  
   - **Kịch bản** = tự dán hook/scene/VO (nâng cao)  
   - **URL** = **khóa** (“URL extract chưa mở — chờ legal”) — **đừng** dùng
2. **Tên draft** — đổi nếu muốn; hệ thống **autosave ~2 giây** (dòng xám dưới tiêu đề hiện “Đang autosave…”)
3. Ô **Prompt** — **bắt buộc viết**. Ví dụ:

   ```
   Video 60 giây 9:16, tiếng Việt.
   Hook 3s: khai trương showroom HCM, ưu đãi 20%.
   Scene 1: mặt tiền showroom ban ngày.
   Scene 2: khách xem sản phẩm, overlay giá.
   VO: giọng nữ ấm, rõ.
   CTA cuối: inbox Zalo / gọi hotline.
   ```

4. Giữ tick **Tự tạo kịch bản (hook, scene, VO, overlay, CTA)** nếu muốn hệ thống tách scene từ prompt (khi AI bật). Bỏ tick nếu tự viết hết ở mode **Kịch bản**.
5. **DAM picker** — tuỳ chọn: gắn ảnh/clip từ Thư viện. Lần đầu **không bắt buộc**. Asset gắn mà chưa Ready / bị block quyền thì nút render bị chặn.

**Cột giữa — Preview**

- Chỉ hiện tỷ lệ + thời lượng (`Preview 9:16 · — / 01:00`).
- Dải scene phía dưới = `—` cho đến khi có scene (sau script/AI).
- **Không** chờ video chạy ở đây sau khi bấm reserve nếu Model = `stub`.

**Cột phải — cấu hình**

| Ô | Lần đầu nên chọn |
|---|------------------|
| **Tỉ lệ** | `9:16` Reels/TikTok/Shorts · `16:9` YouTube · `1:1` feed · `4:5` feed dọc |
| **Duration** | `15s` / `30s` / `60s` — khớp độ dài mô tả trong prompt |
| **Style** | Ví dụ `sạch, thương mại, ánh sáng studio` — có thể để trống |
| **Locale / Voice** | `vi-VN`. Ô Voice để trống nếu chưa có voice id |
| **Music** | Để trống hoặc mô tả `nhạc nền corporate nhẹ` |
| **Model** | Nếu chỉ thấy **`stub`** → render **không ra file thật** |
| **Brand Kit** | Chọn kit nếu đã tạo ở **Brand Kit**; `—` = không gắn |
| **Ước tính credit** | Để `—` trừ khi kế toán yêu cầu ghi số |

Chờ ~2 giây sau khi gõ — autosave. Không có nút Lưu riêng.

#### Bước 4 — Bấm **Tạo video (reserve)**

1. Góc phải trên, nút xanh **Tạo video (reserve)**
2. Nút đổi thành **Đang gửi…**
3. Thành công: banner `Đã gửi render job …` + một dòng mới ở bảng **Queue** cuối trang
4. Click mã job → **Render Ops** (`/crm/creative-os/video/ops`) xem trạng thái / stage

Đó **chính là** bước “tạo video”. Không có nút Render / Export / Download khác trên Studio.

#### Bước 5 — Xem kết quả

| Model | Việc xảy ra |
|-------|-------------|
| **`stub`** (ảnh của bạn) | Job vào Queue, credit được reserve. Preview vẫn `—`. **Không có MP4.** Dùng để quen luồng. |
| Model AI đã bật | Job chạy → có **version** → tab **Review / Version** → QC → **Chia sẻ review (Hub)** |

Video người (quay thật) **không** làm ở Video AI. Tạo deliverable Human video rồi mở Video SOP `/crm/video`.

#### Bước 6 — Làm lại / sửa

- Sửa prompt hoặc tỉ lệ → chờ autosave → bấm **Tạo video (reserve)** lần nữa (job mới).
- Mất draft: **Video AI** → bảng → **Studio**.
- Muốn file AI thật: nhờ IT/Legal bật AI production + thêm model ở **Cấu hình → Models**. Dropdown Model hết chỉ còn `stub`.

---

### 5.2. Danh sách draft (`/crm/creative-os/video`)

**Tạo draft**

1. Ô **Project** — gõ để tìm (ví dụ `PTT — PTT-HCM`). Không dán UUID
2. Nhập **Tên video**
3. **Mở Studio**

Chưa có project → link **Tạo project**.

Bảng: Tên · Mode · Revision · Autosaved · **Studio**.

Shortcut: **Mở Video SOP** (module cinematic `/crm/video`, không phải render AI), **Mẫu video**, **Tạo hàng loạt**, **Render Ops**.

Nút **Mở Video SOP** chỉ hiện khi bạn có quyền Video SOP (`crm_vd.project` hoặc Content + flag cinematic). Nếu đã chọn project có `lifecycle_id`, nút mở hub lọc đúng dịch vụ. Video người / bible / gate / render cinematic làm ở SOP — không trộn pipeline vào Studio AI.

### 5.3. Video Studio — tham chiếu ô (`/crm/creative-os/video/[id]`)

Tám tab: Studio · Storyboard · Timeline · Ops · Review · Batch · Template · Version.

**Cột Studio (tab chính)**

- Tên draft (autosave ~2 giây)
- Mode: **Prompt** / **Kịch bản** / **URL**
- Ô nội dung + đếm ký tự (mặc định tối đa 2.000, theo policy)
- Brand Kit (dropdown kit đã tạo)
- Tỷ lệ `9:16` · `16:9` · `1:1` · `4:5`
- Thời lượng 15 / 30 / 60 giây
- Resolution, style, ngôn ngữ, voice, phụ đề, nhạc, model
- Ước lượng credit (nếu có)

**URL:** ô hiện nhưng **khóa** cho đến khi Legal mở `url_extract`. Tooltip: *URL extract chưa mở — chờ legal (W2).* Dùng Prompt hoặc Kịch bản.

**Tạo video (reserve)** gửi job render:

- Chưa gắn asset sẵn sàng → vẫn gửi được (stub)
- Asset đã gắn mà **không Ready** → chặn
- Asset `rights = block` → chặn
- AI production **chưa bật** trên môi trường hiện tại: job chạy **stub** (ghi nhận hàng đợi / credit reserve), **không** ra file AI thật. Preview Studio cũng là stub

Theo dõi job: tab **Ops** hoặc `/crm/creative-os/video/ops`.

### 5.4. Storyboard / Timeline / Review / Version

- **Storyboard** — scene của draft
- **Timeline** — trục thời gian scene
- **Review / Version** — mở version (nếu đã có `latest_version_id`); QC phải pass trước khi gửi Hub
- **Batch / Template** — nhà máy hàng loạt và mẫu; dùng khi đã có template

Video người **không** làm ở đây. Tạo deliverable `human_video` rồi mở Video SOP.

---

## 6. Thư viện media

**Route:** `/crm/creative-os/media`

Tab: **Library · Ingest · Collections · Rights · Quality**.

### 6.1. Library

Lưới asset. Click → chi tiết (`/crm/creative-os/media/[id]`): file, MIME, state, quyền, hạn license.

### 6.2. Ingest (upload)

1. Tab **Ingest** (hoặc nút **Upload** trên Library / workspace **Upload gán project**)
2. Ô **Khách (Agency) \*** — gõ để tìm khách từ AM 360 (không dán UUID)
3. Ô **Project** — gõ để tìm project CP (lọc theo khách đã chọn; chọn project sẽ điền khách)
4. MIME trong allowlist + **Filename**
5. Tạo asset; nếu tick finalize thì nhập **bytes + hash**

MIME được phép: JPEG, PNG, WebP, MP4, QuickTime, WebM, MP3, WAV, audio/mp4, PDF.

Khác allowlist → lỗi `mime_not_allowed`.

### 6.3. Collections / Rights / Quality

- **Collections** — nhóm asset theo bộ
- **Rights** — license, ngày hiệu lực / hết hạn, trạng thái chặn
- **Quality** — kiểm tra kỹ thuật (thiếu dữ liệu = `—`)

Asset gần hết quyền xuất hiện trên KPI Tổng quan và Rights Center.

---

## 7. Brand Kit

**Route:** `/crm/creative-os/brand-kits`

1. Tạo kit: **Tên** + phạm vi `tenant` / `client` / `project`  
   - Phạm vi khách → chọn agency client  
   - Phạm vi project → chọn project
2. Mở kit → tab **Editor · Rules · Preview · History**

Editor lưu logo, palette, typography, CTA, disclaimer, motion, audio. Mỗi lần lưu tạo **version** (History). Gắn kit trên Video Studio để render dùng đúng nhận diện.

Cần `crm_cp.brand` để sửa; `crm_cp.manage_brand_rule` để quản lý Rules.

---

## 8. Lịch xuất bản

**Route:** `/crm/creative-os/calendar`  
Múi giờ mặc định: **Asia/Ho_Chi_Minh**.

| Tab | Việc làm |
|-----|----------|
| **Calendar** | Lịch tháng / tuần / danh sách các item đã schedule |
| **Composer** | Soạn lịch đăng (kênh, giờ) |
| **Gate** | Cổng chặn: brand / quyền / QC / policy phải đạt trước publish |
| **Phân phối** | Trạng thái đẩy kênh |
| **Lịch hàng loạt** | Schedule nhiều item |

Publish native có thể **OFF** trên Cấu hình → Integrations. Khi OFF, lịch vẫn soạn được nhưng không tự đăng kênh. Copy/bài Content OS **không** quản lý ở đây.

Cần `crm_cp.publish` để đưa item vào lịch.

---

## 9. Báo cáo

**Route:** `/crm/creative-os/reports`

| Tab | Nội dung |
|-----|----------|
| **Điều hành** | KPI kỳ, funnel chỉ khi đã ingest |
| **Sản xuất** | Success rate, hàng đợi, lớp lỗi |
| **Credit** | Used / charged / reserved / released |
| **Hiệu quả** | Metric kèm nguồn + độ tươi — không bịa CTR |
| **Quản trị** | Brand, QC, quyền 14 ngày, audit, policy |

Lọc kỳ + phạm vi. Export CSV khi có dữ liệu. Thiếu ingest → copy *chưa có nguồn*, ô = `—`. ROI không bịa.

---

## 10. Cấu hình

**Route:** `/crm/creative-os/settings` · cần `crm_cp.manage`

| Tab | Việc làm |
|-----|----------|
| **Profile** | Locale, timezone, Brand Kit mặc định, số ngày giữ asset |
| **Members** | Bảng phân vai CP (trống = `—` cho đến khi gán) |
| **SSO** | Deep-link Admin SSO |
| **Credit** | **Grant** credit cho khách (UUID khách + số + cost center). Cần `crm_cp.finance` |
| **Models** | Catalog model (id, max_res, duration, cap, region, fallback) — chưa bật AI production thì chỉ là danh mục |
| **Integrations** | Hub / Content OS / Campaign Write = ON. Webhook OFF. `publish_native` theo setting |
| **Security** | TTL signed URL, số ngày restore, legal hold |
| **Policy** | Policy an toàn (ví dụ `url_extract`, `prompt_max_chars`). Không hiện secret |

Không bật AI production từ màn này nếu Legal / IT chưa ký. URL extract chỉ mở sau khi Legal duyệt.

---

## 11. Luồng làm việc gợi ý

### AM / Creative — video AI cho khách đã có lifecycle

```
Dự án → Lấy từ Dự án PTT (hoặc Tạo project + chọn khách + lifecycle)
  → Workspace: Brief → Deliverable ai_video
  → Video AI: tìm project → đặt tên → Mở Studio
  → Chọn Brand Kit, tỷ lệ, prompt
  → Tạo video (reserve) → theo dõi Ops
  → Version QC pass → Chia sẻ review (Hub)
  → Khách duyệt trên Creative Hub / portal
  → Lịch xuất bản (khi được phép publish)
```

### Brand

1. Brand Kit → tạo / sửa version
2. Duyệt brief (trạng thái Brand review)
3. Rules: chặn logo sai, disclaimer thiếu

### Legal

1. Thư viện → Rights: hạn license, block nếu hết quyền
2. Policy / URL extract
3. Gate lịch xuất bản

### Motion / video người

1. Workspace → Deliverables → loại **Human video** + VD project ID
2. Làm việc trên **Video SOP** `/crm/video`
3. Không render AI thay cho footage người

---

## 12. Sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|------------|------------------------|------------|
| Không thấy menu Sản xuất sáng tạo | Thiếu `crm_cp.view` | Admin cấp quyền, đăng nhập lại |
| Danh sách project trống | Phạm vi **Của tôi** trong khi bạn không phải owner/member | Đổi **Toàn bộ** (cần `view_all`) hoặc nhờ owner thêm vào Team |
| KPI / cột toàn `—` | Chưa có sự kiện / chưa set budget / chưa có deliverable | Bình thường. Tạo brief, deliverable, grant credit rồi tải lại |
| Không tạo được project | Thiếu khách hoặc owner | Chọn từ dropdown. Khách phải có sẵn trên AM 360 |
| *URL extract chưa mở* | Policy legal chưa bật | Dùng Prompt / Kịch bản |
| Render báo asset không Ready | Asset gắn project chưa `ready` hoặc rights = block | Gỡ / finalize asset, hoặc Rights Center bỏ block |
| Render xong nhưng không có video AI | AI production chưa bật — job stub | Dùng để quen luồng / chấm credit. File AI thật chờ IT bật sau UAT |
| **Chia sẻ review (Hub)** xám | Chưa có version hoặc QC chưa pass | Render → có version → QC đạt |
| Human video không có studio trong CP | Đúng thiết kế | Mở Video SOP bằng VD project ID |
| `mime_not_allowed` | MIME ngoài allowlist | Đổi JPEG/PNG/WebP/MP4/PDF/… |
| Grant credit lỗi | Sai UUID khách hoặc thiếu `crm_cp.finance` | Copy ID khách từ AM 360 |

**Phiên hết hạn:** đăng nhập lại `/login`. Nút **Thử lại** trên banner lỗi tải lại API, không mất filter trên URL.
