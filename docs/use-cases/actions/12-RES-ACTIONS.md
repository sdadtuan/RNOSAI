# Chi tiết hành động — Market Research OS (RES)

> **UC gốc:** [`../12-MARKET-RESEARCH-OS.md`](../12-MARKET-RESEARCH-OS.md)  
> **BA:** [`../../specs/modules/RNOSAI-BA-RES-UseCases.md`](../../specs/modules/RNOSAI-BA-RES-UseCases.md)  
> **UX:** [`../../specs/2026-08-14-market-research-os-ui-ux.md`](../../specs/2026-08-14-market-research-os-ui-ux.md)  
> **SRS:** [`../../specs/2026-08-14-market-research-os-srs.md`](../../specs/2026-08-14-market-research-os-srs.md)  
> **Phiên bản:** 1.0 · **Coverage:** RES-UC-001…020 (P0 UAT) + ghi chú P1–P3

---

## Walkthrough UAT — Happy path G0 → DOCX (≈40 phút)

**Mục tiêu khách hàng:** *«AM brief 1 quyết định → Analyst desk + evidence → Lead duyệt insight → xuất DOCX CB.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), QA

**Dữ liệu test:** Client `acme` trong scope AM+AN+LD · Client `beta` chỉ user khác (tenancy) · Flag research = 1 · Tavily key **có** trên staging (hoặc chạy nhánh E-Tavily)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | `/login` | Đăng nhập cap `crm_research.create` | credentials | JWT | ✓ flag on |
| 2 | AM | OpsNav | Thấy nhóm **Lên kế hoạch** | — | Research + Marketing plan | ✓ RES-UC-001 · EC-RES-01 |
| 3 | AM | Nav Triển khai | Xác nhận **không** còn «Kế hoạch marketing» | — | Plan chỉ ở Lên kế hoạch | ✓ |
| 4 | AM | `/crm/sales?tab=market` | Regression NCTT BĐS | — | Tab Market BĐS nguyên | ✓ EC-RES-07 |
| 5 | AM | `/crm/research` | **Tạo project** | — | Wizard | ✓ |
| 6 | AM | Wizard 1 | Client Acme, title, tier **CB** | Acme / Sữa uống 2026 | Valid | ✓ |
| 7 | AM | Wizard 2 | Card **Category review** | CAT_REVIEW | Selected | ✓ |
| 8 | AM | Wizard 3 | Decision ≥20 ký tự | *Quyết định có mở SKU premium Q4 tại MT HCM hay không.* | Counter OK | ✓ RES-UC-002 |
| 9 | AM | Wizard 4 | Geo VN, language vi, risk medium | — | Chips | ✓ |
| 10 | AM | Wizard 5 | 1 RQ | *Quy mô thị trường sữa uống VN 2025–26?* | ≥1 dòng | ✓ RES-UC-003 |
| 11 | AM | Submit | **Tạo dự án** | — | Redirect `tab=brief` status Tiếp nhận | ✓ EC-RES-02 |
| 12 | AN | Brief | **Đổi trạng thái → Thiết kế** rồi **Thu thập** | — | Status collecting | ✓ RES-UC-015 |
| 13 | AN | Sources | RQ Q1 · **Chạy Desk Tavily** | question_id | Chip job · 202 | ✓ RES-UC-004 |
| 14 | AN | Same | Đợi job succeeded | — | ≥1 source AI | ✓ EC-RES-03 |
| 15 | AN | Same | Tick **Keep** nguồn tin cậy | keep=true | PATCH | ✓ RES-UC-014 |
| 16 | AN | Evidence | **Tạo evidence** từ source | locator + excerpt hoặc value+unit | EV-xx pending | ✓ RES-UC-006 |
| 17 | AN | Same | **Verify** ≥5 nguồn / ≥5 evidence (pilot A tối thiểu 1 P0 UAT; staging 1+) | — | Lock icon | ✓ |
| 18 | AN | Insights | **+ Insight** gắn EV verified + rationale | statement 4 khối | draft → evidence_attached | ✓ RES-UC-007 |
| 19 | AN | Same | **Gửi Lead duyệt** | — | analyst_verified | ✓ |
| 20 | LD | Insight drawer | **Duyệt nội bộ** (user ≠ creator) | comments | `approved_internal` | ✓ RES-UC-008 · EC-RES-04 · EC-RES-11 |
| 21 | AM | Same | **Duyệt bản khách** | — | `approved_client_facing` | ○ RES-UC-018 |
| 22 | AN | Report | Tick insight · **Tạo bản báo cáo** | — | version v1 | ✓ RES-UC-009 |
| 23 | AN | Preview | Kiểm appendix + evidence index | — | Blocks đủ | ✓ EC-RES-05 |
| 24 | AM | Same | **Xuất DOCX** | cap export | Download | ✓ |
| 25 | QA | User client Beta | GET `/projects/{acmeId}` | token beta | 403 không title | ✓ RES-UC-010 · EC-RES-06 |
| 26 | QA | Activity | `crm_research_ai_runs` desk row | SQL/UI | logged | ✓ EC-RES-12 |
| 27 | QA | Flag 0 (staging copy) | Nav ẩn + API 404 | — | empty VI | ✓ RES-UC-013 · EC-RES-08 |

#### Nhánh E-Tavily — không key

Bước 13: job `failed` `tavily_unconfigured` · banner vàng · project vẫn mở · AN thêm nguồn thủ công (RES-UC-019) rồi tiếp bước 16.

#### Nhánh E-Deep

Sau bước 14: **Chạy Deep Research** → modal cảnh báo → sources nháp thêm · **không** insight mới (EC-RES-09).

#### Nhánh E-Gate

Bước 20 với 0 evidence: dialog «Thiếu evidence đã verify» · không đổi status.

#### Nhánh E-SoD

AN tự bấm Duyệt nội bộ: 403 / banner người tạo không tự duyệt.

#### Nhánh E-Immutable

PATCH excerpt evidence verified: 409 · phải supersede (RES-UC-017).

#### Tiêu chí nghiệm thu walkthrough

- [ ] Bước 1–27 pass staging (hoặc E-Tavily + thủ công)
- [ ] DOCX có cover, exec, findings, recs, methodology stub, evidence index
- [ ] Nav Lên kế hoạch đúng
- [ ] PO / Research Lead sign EC-RES-01…12

---

## RES-UC-001 — Nav + list

**Mục tiêu:** *«Vào đúng nhóm PLAN, thấy queue project.»*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Sidebar | Mở **Lên kế hoạch** | — | 2 link | ✓ |
| 2 | AM | `/crm/research` | Filter Client / Status / Type | Acme | Query persist | ✓ |
| 3 | AM | Row | Click tiêu đề | — | Workspace Brief | ✓ |
| 4 | AM | Empty (env sạch) | Đọc empty + CTA | — | Tạo project | ○ |

#### Tiêu chí nghiệm thu
- [ ] Marketing plan không nằm Triển khai
- [ ] Không deep-link Sales Market từ Research

---

## RES-UC-002 — Wizard G0

**Mục tiêu:** *«Brief đúng quyết định kinh doanh — lỗi field tiếng Việt.»*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | `/crm/research/new` | Bỏ trống client · Submit | — | Inline lỗi | ✓ |
| 2 | AM | Bước 3 | Gõ 10 ký tự | short | Counter đỏ <20 | ✓ |
| 3 | AM | Bước 5 | Xóa hết RQ · Submit | — | Chặn ≥1 RQ | ✓ |
| 4 | AM | Happy | 5 bước hợp lệ | payload SRS 5.2 | 201 + Brief | ✓ |

---

## RES-UC-003 — CRUD RQ

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Brief | **+ Thêm câu hỏi** | Q2 text | Row mới | ✓ |
| 2 | AM | Same | Sửa Q1 | — | PATCH | ✓ |
| 3 | AM | Same | Xóa RQ đã có EV | — | 409 + tooltip | ✓ |

---

## RES-UC-004 — Desk Tavily

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Sources | Chọn Q1 · **Chạy Desk Tavily** | — | Chip pending | ✓ |
| 2 | AN | Same | Click Chạy lần 2 khi running | — | Disabled / 409 | ✓ |
| 3 | System | Worker | Tavily | credits | sources AI | ✓ |
| 4 | AN | Activity | Mở run | — | provider tavily | ✓ |

---

## RES-UC-005 — Deep Research

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Sources | **Chạy Deep Research** | — | Modal cảnh báo | ✓ |
| 2 | AN | Modal | Chọn Q1 · **Chạy** | — | Job ≤15 phút | ✓ |
| 3 | AN | Insights | Đếm card mới | — | **0** insight auto | ✓ EC-RES-09 |

---

## RES-UC-006 — Evidence

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Source row | **Tạo evidence** | — | Drawer | ✓ |
| 2 | AN | Drawer | Bỏ locator · Lưu | — | 400 | ✓ |
| 3 | AN | Drawer | Locator + excerpt · **Verify** | page/URL# | EV verified lock | ✓ |

---

## RES-UC-007 / 008 — Insight + duyệt

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Insights | Tạo không gắn EV · Gửi duyệt | — | Dialog gate | ✓ |
| 2 | AN | Drawer | Gắn EV + rationale · Gửi | — | chờ Lead | ✓ |
| 3 | LD | Drawer | Duyệt nội bộ | comments | approved_internal | ✓ |
| 4 | AN | Drawer | Tự duyệt (SoD) | — | 403 banner | ✓ |

---

## RES-UC-009 — DOCX

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Report | Tạo version | insight IDs | v1 hash | ✓ |
| 2 | AM | Preview | **Xuất DOCX** | — | file | ✓ |
| 3 | AM | File | Mở Word | — | appendix + index EV | ✓ |

---

## RES-UC-010 / 013 / 017 / 020 — Cross-cut

| # | Actor | Thao tác | Phản hồi | Gate |
|---|-------|----------|----------|------|
| 1 | User Beta | Mở URL project Acme | 403 không title | ✓ 010 |
| 2 | Ops | Tắt flag | Nav ẩn, API 404 | ✓ 013 |
| 3 | AN | Sửa excerpt verified | 409 supersede | ✓ 017 |
| 4 | AN | Retry job failed | Run mới, project OK | ✓ 020 |

---

## P1–P3 (backlog actions — không UAT P0)

| UC | Hành động tóm tắt |
|----|-------------------|
| 021 | Mở rubric 5 slider trên drawer; lưu JSON |
| 022 | Tab Đối thủ · thêm alias · snapshot + source |
| 023 | Marketing-plan · Chèn insight ID cùng client |
| 024 | Export TC thiếu methodology → chặn |
| 025 | Lifecycle DV12 · CTA mở wizard prefill |
| 026 | Chạy 2 provider · so URL |
| 027 | Wizard hiện gợi ý consult |
| 030 | Tab Studies + consent |
| 031 | Alert pulse trên Ops |
| 032 | Tick EN exec · Lead duyệt |
| 033 | `/crm/research/analytics` |
| 040 | Portal watermark |
| 041 | Wave dates TRACKER |
| 042 | Ghi decision sau readout |
