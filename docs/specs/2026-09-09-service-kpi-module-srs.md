# SRS — Module Service KPI (KPI Template theo Dịch vụ)

**Sản phẩm:** RNOSAI / PTT Agency Operating System  
**Phân hệ:** KPI Hub → Service KPI  
**Module:** Service KPI Template Management & Operations  
**Phiên bản:** 1.1  
**Ngày:** 09/09/2026  
**Trạng thái:** Draft for Review — nâng cấp cạnh tranh  
**Nguồn tham chiếu:** `SRS-Module-KPI-Template-Theo-Dich-Vu-Agency.md`, mockup KPI Governance, mockup KPI Template Management  
**Thiết kế thắng đối thủ:** [docs/superpowers/specs/2026-09-09-service-kpi-competitive-ops-design.md](../superpowers/specs/2026-09-09-service-kpi-competitive-ops-design.md)  
**Mockup HTML:** [docs/design/rnosai-service-kpi-mockup.html](../design/rnosai-service-kpi-mockup.html)  
**Route vận hành:** `https://rs.pttads.vn/crm/kpi-hub/service-*`

**Changelog v1.1:** Không cạnh tranh dashboard với AgencyAnalytics. Bổ sung KPI Contract OS: War Room, Contract Score (cùng GM floor), 3 sổ Quoted/Delivered/Reported, Industry Policy Pack, Client Assumption Confirmation, feedback loop vào báo giá lần sau.

---

## 1. Mục tiêu tài liệu

Tài liệu đặc tả module **Service KPI** — lớp vận hành KPI gắn với **Service Catalog (21 DV)**, kế thừa **KPI Dictionary** hiện có trong KPI Hub, và lan truyền sang **Quote OS**, **Proposal Studio**, **Project/Work Order**.

Module cho phép agency:

- Xây dựng **Service KPI Template** theo từng dịch vụ / package / ngành dọc.
- Tạo **KPI Instance** theo Quote, Proposal, Project, Campaign.
- Thiết lập **Measurement Plan**, thu thập **Actual**, theo dõi **Target vs Actual**, **Alert** và **Corrective Action**.
- Bảo đảm governance: classification, disclaimer, assumption, approval, snapshot, audit.

---

## 2. Bối cảnh RNOSAI

### 2.1. Module liên quan

| Module | Vai trò |
|---|---|
| KPI Hub — KPI Dictionary | Nguồn định nghĩa KPI chuẩn (MKT_003, MKT_006, …) |
| Service Catalog — Portfolio 21 DV | Service Catalog Item gắn KPI Template |
| Quote OS / Builder | Kế thừa template → KPI Instance trên Quote Line |
| Proposal Studio | Render KPI client-visible + disclaimer |
| Project Delivery / Work Order | Tracking actual sau Quote Accepted |
| KPI Hub — Target & Cảnh báo | Alert policy, variance, corrective action |
| KPI Hub — Nguồn dữ liệu / Data Quality | Connector, freshness, mapping |

### 2.2. Vấn đề cần giải

- KPI trên báo giá/proposal nhập tự do, không đồng bộ với Portfolio 21 DV.
- Cùng metric (CPL, Engagement Rate, …) có nhiều cách tính giữa team.
- Forecast bị diễn đạt như cam kết; thiếu disclaimer/assumption.
- Project triển khai không có measurement plan, owner, cadence rõ ràng.
- Template KPI thay đổi ghi đè snapshot quote/proposal đã gửi.

---

## 3. Mục tiêu nghiệp vụ

| Mục tiêu | Chỉ số thành công |
|---|---|
| Chuẩn hóa KPI theo dịch vụ | ≥ 95% DV active có Service KPI Template v1+ |
| Giảm KPI nhập tự do trên quote | ≥ 80% quote line kế thừa từ template |
| Bảo vệ commercial/legal | 100% forecast/optimization client-facing có disclaimer |
| Readiness trước publish | 100% proposal publish pass KPI readiness |
| Tracking sau triển khai | ≥ 95% project active có measurement plan + owner |
| Governance | 100% thay đổi template active có version + audit |
| Giảm dispute sau chốt | 0 client report từ actual Unverified; 0 forecast thiếu disclaimer |
| Chặn bán sai | ≥ 15% quote draft bị Contract Score chặn đúng trong 6 tháng |
| Compounding benchmark | ≥ 90% project Ads/SEO closed ghi band nội bộ |

---

## 4. Phạm vi

### 4.1. In scope (Phase 1–2)

- Service KPI Template CRUD + versioning + review.
- KPI Instance inherit/override từ Quote/Project.
- Classification 6 loại (Deliverable, Quality, Optimization, Forecast, Business Outcome, Internal).
- Target, baseline, scenario, assumption, dependency, disclaimer.
- KPI Readiness Validation.
- Approval workflow (Functional Lead, Data/BI, Finance, Legal theo policy).
- Measurement Plan, Actual Tracking (manual/import/API ưu tiên).
- Alert, corrective action, dashboard Service KPI trong KPI Hub.
- Menu KPI Hub: **Service KPI Template**, **KPI Instances**, **Measurement Plan**, **Actual Tracking**.
- **v1.1:** War Room, KPI Contract Score (cổng duyệt cùng GM), 3 sổ Quoted/Delivered/Reported, Industry Policy Pack, Client Assumption Confirmation, feedback loop đóng project → benchmark → quote sau.

### 4.2. Out of scope v1

- AI auto-optimize campaign/budget.
- Full BI warehouse thay thế.
- Connector toàn bộ ad platform (phase 1: Meta, CRM, GA4 ưu tiên).
- Xác thực pháp lý guarantee theo quốc gia (hệ thống chỉ policy + disclaimer + audit).
- White-label BI thay AgencyAnalytics; attribution data-driven; AI tối ưu ads; Power BI embed.

---

## 5. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| KPI Dictionary | Danh mục KPI chuẩn toàn agency (đã có trong KPI Hub) |
| Service KPI Template | Bộ KPI gắn Service Catalog Item / Package |
| KPI Instance | KPI cụ thể trên Quote/Proposal/Project/Campaign |
| KPI Snapshot | Bản KPI immutable theo version quote/proposal/project |
| Measurement Plan | Kế hoạch đo: source, mapping, owner, cadence, QA |
| Readiness | Trạng thái đủ cấu hình để submit/publish/track |

---

## 6. Phân loại KPI (bắt buộc)

| Code | Loại | Client wording | Ví dụ |
|---|---|---|---|
| `COMMITTED_DELIVERABLE` | Cam kết bàn giao | Cam kết bàn giao | 24 post/tháng, 12 video |
| `QUALITY_STANDARD` | Chuẩn chất lượng/SLA | Tiêu chuẩn chất lượng | 02 vòng revision, SLA < 24h |
| `OPTIMIZATION_TARGET` | Mục tiêu tối ưu | Mục tiêu tối ưu | CTR ≥ 1,8%, CPL ≤ 100K |
| `PROJECTED_RESULT` | Kết quả dự kiến | Kết quả dự kiến | 1.000–1.200 lead |
| `BUSINESS_OUTCOME` | Kết quả kinh doanh | KPI kinh doanh tham chiếu | booking, GMV |
| `INTERNAL_OPERATIONAL` | Nội bộ | Không hiển thị client | cost variance, margin |

---

## 7. Vai trò & phân quyền

| Role | Nhiệm vụ |
|---|---|
| KPI Dictionary Admin | Quản lý KPI Definition (module Dictionary hiện có) |
| Service Owner | Tạo/sửa Service KPI Template cho DV phụ trách |
| Functional Lead | Duyệt chuyên môn template/instance |
| Strategy Lead | Target rationale, scenario, assumptions |
| Account/BD | Chọn template trên quote, set target trong range |
| PM | Measurement plan, owner, corrective action |
| Data/BI | Mapping, formula, data quality |
| Finance/Legal | Review KPI nhạy cảm, disclaimer, guarantee risk |

**Permission RNOSAI (đề xuất):**

| Route | Capability |
|---|---|
| `/crm/kpi-hub/service-templates` | `crm_kpi_hub.view` + `crm_kpi_dictionary.view` |
| `/crm/kpi-hub/instances` | `crm_kpi_hub.view` |
| `/crm/kpi-hub/measurement` | `crm_kpi_hub.view` + `crm_kpi_hub_targets.view` |
| `/crm/kpi-hub/tracking` | `crm_kpi_hub.view` + `crm_kpi_hub_targets.view` |
| CRUD template | `crm_kpi_dictionary.manage` hoặc `spc.edit` |
| Approve template | `crm_kpi_hub.approve` (mới) |

Backend **bắt buộc** field-level authorization; không chỉ ẩn UI.

---

## 8. Vòng đời trạng thái

### 8.1. Service KPI Template

`DRAFT` → `IN_REVIEW` → `ACTIVE` → `SUSPENDED` / `RETIRED`

- Template **ACTIVE** chỉ sửa qua version Draft mới.
- Quote/Proposal/Project giữ **snapshot** theo version cũ.

### 8.2. KPI Instance

`DRAFT` → `READY_FOR_REVIEW` → `APPROVED` → `TRACKING` → `AT_RISK` / `ACHIEVED` / `MISSED` / `WAIVED` / `SUPERSEDED` / `ARCHIVED`

---

## 9. Data Model (tóm tắt)

### 9.1. Entity mới

| Entity | Mô tả |
|---|---|
| `service_kpi_template` | Template gắn `crm_catalog_services.dv_code` |
| `service_kpi_template_version` | Version template + rules |
| `template_kpi_rule` | KPI trong template: required, target default, visibility |
| `kpi_instance` | Instance theo quote/project/campaign |
| `kpi_target` | Target/scenario/period |
| `kpi_actual` | Actual theo time bucket |
| `kpi_measurement_plan` | Plan đo cho instance |
| `kpi_assumption` / `kpi_disclaimer` | Assumption & disclaimer snapshot |
| `kpi_alert` / `kpi_corrective_action` | Alert & action |
| `kpi_snapshot` | Immutable snapshot theo quote/proposal version |

### 9.2. Liên kết Service Catalog

```text
crm_catalog_services (DV01–DV21)
  └── service_kpi_template (1-N)
        └── service_kpi_template_version (1-N)
              └── template_kpi_rule (N) → kpi_definitions
```

Mỗi **DV** (ví dụ DV04 Performance Ads, DV02 Content) có thể có 1+ template active theo package/vertical.

---

## 10. Yêu cầu chức năng

### FR-SKPI-001 — Service KPI Template List

**Route UI:** `/crm/kpi-hub/service-templates`

- Danh sách template theo service, package, vertical.
- Cột: Service/Template, KPI bundle, Required, Client visible, Owner team, Version, Status.
- Filter: Active, In Review, service group (Performance, Social, SEO, …), client-facing.
- Action: Tạo template, Export, Mở cấu hình, Submit review.

**Acceptance:** Chỉ chọn KPI Definition **ACTIVE** từ Dictionary.

### FR-SKPI-002 — Service KPI Template Builder

- Chọn Service Catalog Item (21 DV + custom).
- Add KPI từ Dictionary (search/drawer).
- Nhóm KPI: Deliverables, Quality/SLA, Performance, Forecast, Business Outcome, Internal.
- Cấu hình per-KPI: required, classification, target default/range, scenario, owner, cadence, data source, assumption/disclaimer template, threshold.
- Drag/drop display order.
- Validation trước submit review.
- Versioning: Active → tạo Draft revision.

### FR-SKPI-003 — KPI Instances

**Route UI:** `/crm/kpi-hub/instances`

- Danh sách instance theo Quote, Proposal, Project, Campaign.
- Cột: KPI/Source, Classification, Target/Scenario, Actual, Variance, Readiness, Owner, Status.
- Filter: Tracking, At Risk, client, service, owner.
- Action: Tạo instance, Bulk update, Mở measurement/tracking.

**Acceptance:** Instance inherit template version tại thời điểm tạo; override có audit + re-approval nếu trigger.

### FR-SKPI-004 — Measurement Plan

**Route UI:** `/crm/kpi-hub/measurement`

- Form: KPI Instance, Owner, Cadence, Timezone, Data source, Freshness SLA, Field mapping.
- Formula snapshot (read-only từ Definition).
- Readiness checklist: mapping, formula, owner, freshness, QA.
- Escalation rule khi data stale.

### FR-SKPI-005 — Actual Tracking

**Route UI:** `/crm/kpi-hub/tracking`

- Summary: actual hôm nay, API vs manual, data issues.
- Chart Target vs Actual theo period.
- Actual records: value, quality status (Verified/Pending/Invalid).
- Import CSV/XLSX, manual entry.
- Duplicate detection, zero denominator → N/A + alert.

### FR-SKPI-006 — KPI Readiness Validation

Chạy khi: Save (optional), Submit Quote, Publish Proposal, Start Project, Publish Client Report.

Kết quả: `Pass` | `Warning` | `Blocking` | `Approval-required`.

Matrix theo classification — xem mục 12.

### FR-SKPI-007 — Quote/Proposal Integration

- Quote Builder: section "KPI & Hiệu quả" trên mỗi service line.
- Auto-clone template khi thêm DV vào quote.
- Visual phân biệt classification (màu/badge).
- Snapshot khi submit/publish quote.
- Proposal Studio: chỉ render `client_visible=true`; disclaimer bắt buộc cho forecast/optimization.

### FR-SKPI-008 — Project Inheritance

- Quote Accepted → tạo KPI Instance Tracking + Measurement Plan draft.
- PM hoàn tất mapping trước start date.
- Change request scope/KPI → quote revision + re-approval.

### FR-SKPI-009 — Alert & Corrective Action

- Tích hợp KPI Hub Target & Cảnh báo hiện có.
- Trigger: variance warning/critical, assumption not met, data stale, deliverable overdue.
- Corrective action: owner, due date, expected impact, closure evidence.

### FR-SKPI-010 — Approval Workflow

- Template mới Paid Media/SEO/AI → Functional Lead + Data/BI.
- Forecast vượt benchmark → + Finance/Commercial.
- Target override ngoài range → Strategy + Functional.
- Regulated claim → Legal/Compliance.

---

## 11. Business Rules

| ID | Rule |
|---|---|
| BR-SKPI-001 | KPI code unique trong tenant |
| BR-SKPI-002 | KPI client-visible phải có Definition version active hoặc snapshot hợp lệ |
| BR-SKPI-003 | PROJECTED_RESULT + OPTIMIZATION_TARGET client-facing bắt buộc disclaimer |
| BR-SKPI-004 | COMMITTED_DELIVERABLE bắt buộc quantity, unit, acceptance criteria, owner |
| BR-SKPI-005 | Ratio KPI bắt buộc formula + numerator/denominator + zero behavior |
| BR-SKPI-006 | INTERNAL_OPERATIONAL không render qua Proposal/Public API |
| BR-SKPI-007 | Target override ngoài range → reason + audit + review |
| BR-SKPI-008 | Actual verified không update trực tiếp; correction tạo revision |
| BR-SKPI-009 | Template update không sửa snapshot quote/proposal đã publish |
| BR-SKPI-010 | Alert critical → escalation owner → PM → Lead |

---

## 12. KPI Readiness Matrix

| Kiểm tra | Deliverable | Quality | Optimization | Forecast | Business Outcome |
|---|:---:|:---:|:---:|:---:|:---:|
| Definition/version | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quantity/unit | ✓ | ✓ | ✓ | ✓ | ✓ |
| Operator/target | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data source | — | ✓ | ✓ | ✓/method | ✓ |
| Formula | if calc | if calc | ✓ if ratio | ✓ if calc | ✓ if measured |
| Scenario | — | — | — | ✓ | rec |
| Assumption | — | — | ✓ client | ✓ | ✓ |
| Disclaimer | — | — | ✓ client | ✓ client | ✓ client |
| Client dependency | — | — | rec | ✓ | ✓ |

---

## 13. Luồng vận hành

### 13.1. Luồng A — Tạo Service KPI Template

1. Service Owner mở `/crm/kpi-hub/service-templates`.
2. Chọn DV từ Portfolio 21 (ví dụ DV04 Performance Ads).
3. Add KPI từ Dictionary (MKT_004 Spend, MKT_006 CPL, …).
4. Cấu hình required, target default, disclaimer, threshold.
5. Validate → Submit review → Functional Lead + Data/BI approve → Active.

### 13.2. Luồng B — Quote inherit KPI

1. Account thêm DV04 vào Quote Option.
2. System clone Meta Ads Template v4 → KPI Instances.
3. Account set target/scenario/assumption theo client context.
4. Readiness validation → Submit quote → KPI snapshot.

### 13.3. Luồng C — Project tracking

1. Quote Accepted → Project PRJ-2026-xxx.
2. PM hoàn tất Measurement Plan (`/crm/kpi-hub/measurement`).
3. Actual ingest (`/crm/kpi-hub/tracking`) → variance → alert nếu vượt ngưỡng.
4. Corrective action → client report theo snapshot.

---

## 14. UX/UI — Menu KPI Hub

### 14.1. Cấu trúc menu (bổ sung)

```text
KPI Hub
├── TỔNG QUAN
│   ├── Executive Command Center
│   ├── Marketing Performance
│   └── Sales Command Center
├── GOVERNANCE
│   ├── KPI Dictionary
│   ├── Target & Cảnh báo
│   ├── Nguồn dữ liệu
│   ├── Data Quality
│   └── Approval Center
├── SERVICE KPI
│   ├── War Room                /crm/kpi-hub/service-kpi
│   ├── Service KPI Template    /crm/kpi-hub/service-templates
│   ├── KPI Instances           /crm/kpi-hub/instances
│   ├── Measurement Plan        /crm/kpi-hub/measurement
│   ├── Actual Tracking         /crm/kpi-hub/tracking
│   ├── KPI Contract & Risk     /crm/kpi-hub/kpi-contracts
│   ├── Quoted vs Actual        /crm/kpi-hub/reconcile
│   └── Policy Pack             /crm/kpi-hub/policy-packs
└── PHÂN TÍCH
    ├── Báo cáo
    ├── Audit Log
    └── Cài đặt
```

### 14.2. Screen ID (mockup)

| ID | Màn hình | Route |
|---|---|---|
| SKPI-01 | Service KPI Template — List | `/crm/kpi-hub/service-templates` |
| SKPI-02 | Service KPI Template — Builder/Detail | `/crm/kpi-hub/service-templates/[id]` |
| SKPI-03 | KPI Instances — List | `/crm/kpi-hub/instances` |
| SKPI-04 | KPI Instance — Detail drawer | overlay trên SKPI-03 |
| SKPI-05 | Measurement Plan | `/crm/kpi-hub/measurement` |
| SKPI-06 | Actual Tracking | `/crm/kpi-hub/tracking` |
| SKPI-07 | Modal — Tạo Template | modal trên SKPI-01 |
| SKPI-08 | Modal — Tạo Instance | modal trên SKPI-03 |
| SKPI-00 | War Room | `/crm/kpi-hub/service-kpi` |
| SKPI-09 | KPI Contract & Risk | `/crm/kpi-hub/kpi-contracts` |
| SKPI-10 | Quoted vs Actual (3 sổ) | `/crm/kpi-hub/reconcile` |
| SKPI-11 | Industry Policy Pack | `/crm/kpi-hub/policy-packs` |
| SKPI-12 | Assumption Confirm | overlay / portal |

### 14.3. Visual classification (badge màu)

- Blue: Cam kết bàn giao
- Green: Quality/SLA
- Purple: Mục tiêu tối ưu
- Amber: Kết quả dự kiến / Business outcome
- Red/Gray: Internal (ẩn client)

---

## 15. API Outline

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/v1/kpi-hub/service-templates` | List template |
| POST | `/v1/kpi-hub/service-templates` | Tạo draft |
| GET | `/v1/kpi-hub/service-templates/{id}` | Detail + versions |
| POST | `/v1/kpi-hub/service-templates/{id}/versions` | Tạo revision |
| POST | `/v1/kpi-hub/service-template-versions/{id}/submit` | Submit review |
| POST | `/v1/kpi-hub/service-template-versions/{id}/activate` | Activate |
| GET | `/v1/kpi-hub/instances` | Search instances |
| POST | `/v1/kpi-hub/instances` | Tạo instance |
| PATCH | `/v1/kpi-hub/instances/{id}` | Update (optimistic lock) |
| POST | `/v1/kpi-hub/instances/{id}/validate-readiness` | Readiness check |
| POST | `/v1/kpi-hub/instances/{id}/measurement-plan` | Upsert plan |
| POST | `/v1/kpi-hub/instances/{id}/actuals` | Ingest actual |
| GET | `/v1/kpi-hub/service-kpi/dashboard` | Summary tiles |

Tích hợp Quote OS: `POST /v1/proposals/{id}/kpi-instances/sync-from-catalog`.

---

## 16. Event Model

| Event | Consumer |
|---|---|
| `service_kpi.template.activated` | Cache, Quote Builder |
| `kpi.instance.created` | Quote, Project, KPI Hub |
| `kpi.readiness.failed` | Quote workflow, notification |
| `kpi.actual.recorded` | Calculation, reporting |
| `kpi.alert.created` | Target & Cảnh báo, PM dashboard |
| `kpi.snapshot.created` | Proposal, audit |

---

## 17. Non-functional

| Hạng mục | Mục tiêu |
|---|---|
| Template list P95 | ≤ 2s |
| Readiness validation P95 | ≤ 3s / quote ≤ 200 KPI |
| Actual batch import | ≥ 10.000 rows/job async |
| Security | Public API không trả internal KPI/cost/margin |
| Audit | Mọi template/target/actual change có audit log |

---

## 18. Acceptance Criteria

### AC-SKPI-01 — Template Meta Ads (DV04)

- Given DV04 có template Draft.
- When thêm MKT_006 (CPL) client-visible PROJECTED_RESULT thiếu disclaimer.
- Then block submit review với lỗi field-level.

### AC-SKPI-02 — Quote inherit

- Given template Meta Ads v4 Active.
- When Account thêm DV04 vào Quote.
- Then tạo KPI Instances theo v4; template v5 sau đó không sửa snapshot quote đang mở.

### AC-SKPI-03 — Measurement readiness

- Given instance TRACKING thiếu data source mapping.
- When mở Measurement Plan.
- Then readiness = Warning; block client report nếu policy yêu cầu.

### AC-SKPI-04 — Actual duplicate

- Given actual CPL 07/10 đã Verified.
- When import cùng period/source.
- Then detect duplicate; yêu cầu skip/merge/correction.

### AC-SKPI-05 — Menu KPI Hub

- Given user có `crm_kpi_hub.view`.
- When mở `/crm/kpi-hub`.
- Then sidebar hiển thị nhóm **SERVICE KPI** với 4 mục; route hoạt động.

---

## 18A. Nâng cấp v1.1 — thắng đối thủ lớn

Đối thủ lớn thắng **từng lớp**: AgencyAnalytics/Whatagraph (dashboard), HubSpot/Salesforce (CRM+approval), Productive/Kantata (PSA/utilization), Ads Manager/GA4 (số nguồn). Không ai khép vòng **bán → phân lớp pháp lý → margin → giao → đối soát → bán lần sau**.

RNOSAI đánh đúng vòng đó. Chi tiết thiết kế: `2026-09-09-service-kpi-competitive-ops-design.md`.

### FR-SKPI-011 — KPI Contract Score

Mỗi Quote Version tính `kpi_contract_score` (0–100, internal). Công thức:

```text
Risk = w1*ClassificationRisk + w2*TargetAggressiveness + w3*AssumptionOpen
     + w4*DataReadinessGap + w5*MarginPressure
```

- Submit quote đọc **cùng lúc** `gm_floor` và `kpi_contract_score`.
- GM < floor **và** KPI aggressive → block; bắt buộc phương án B hoặc waiver Finance+GDKD.
- Score, weight, margin **không** xuống Proposal/Public API.

### FR-SKPI-012 — Ba sổ Quoted / Delivered / Reported

| Sổ | Nguồn | Ai xem |
|---|---|---|
| Quoted | Snapshot lúc publish/accept | Sales, Finance, Legal, Audit |
| Delivered | Actual + quality nội bộ | PM, Functional, Data |
| Reported | Actual Verified + client-visible | Account, Client, Portal |

Chênh Quoted↔Delivered material → Change Order hoặc waiver. Cấm xuất Reported từ actual Unverified.

### FR-SKPI-013 — War Room (nhịp tuần)

Màn `/crm/kpi-hub/service-kpi`: assumption mở, alert quá hạn, data stale (cấm report), DV lệch KPI+GM, quote draft score ≥ 70. Không phải dashboard thứ hai — là hàng đợi việc.

### FR-SKPI-014 — Industry Policy Pack

Pack BĐS / Spa / Education / Healthcare: cấm classification sai (SEO traffic không phải cam kết), từ cấm trên proposal (“cam kết doanh số”), reviewer bắt buộc. Gắn `industry` trên Quote/Project.

### FR-SKPI-015 — Client Assumption Confirmation

Assumption required: `Pending` / `Confirmed` / `Not met` + evidence. Client portal hoặc Account ghi nhận. `Not met` → `AT_RISK`; có thể block start project / client report.

### FR-SKPI-016 — Feedback loop đóng project

Project close ghi actual vs quoted theo classification vào benchmark band (DV × ngành × kênh × budget). Quote Builder lần sau hiện P50/P80 nội bộ. Win/loss tách “KPI quá aggressive” vs “giá”.

### AC-SKPI-06 — Contract Score + GM

- Given quote GM 22,4% dưới floor 25% và CPL target 50K (dưới benchmark 41%).
- When Account submit approval.
- Then block; yêu cầu phương án B hoặc waiver Finance + GDKD + Strategy.

### AC-SKPI-07 — Ba sổ

- Given actual CPL 07/10 = Pending Validation.
- When Account xuất client report tuần.
- Then block; chỉ cho xuất sau Verified hoặc waiver Data/BI.

### AC-SKPI-08 — Policy Pack BĐS

- Given industry = Real Estate và KPI booking = COMMITTED_DELIVERABLE.
- When publish proposal.
- Then block; ép BUSINESS_OUTCOME + attribution + Sales SLA khách + disclaimer.

---

## 19. Backlog triển khai

### Phase 1 — Foundation (4–6 tuần)

- DDL: `service_kpi_template*`, `kpi_instance`, `kpi_snapshot`
- API CRUD template + inherit vào Quote Builder
- UI: Service Templates list + builder (SKPI-01/02)
- Readiness validation cơ bản
- Menu KPI Hub + mockup review
- **v1.1 song song:** Policy Pack BĐS (rule + từ cấm) + Contract Score skeleton trên Quote submit

### Phase 2 — Operations (4–6 tuần)

- KPI Instances UI (SKPI-03/04)
- Measurement Plan + Actual Tracking (SKPI-05/06)
- Import actual, alert integration
- Project inheritance
- **v1.1:** War Room, 3 sổ Reconcile, Assumption Confirmation, cổng duyệt GM+Score

### Phase 3 — Enterprise

- Connector mở rộng (TikTok, Zalo Ads, GSC)
- Benchmark library nội bộ (P50/P80) + win/loss KPI
- Industry policy pack Spa / Education / Healthcare
- Forecast engine (không LLM Wave 1)

---

## 20. Definition of Done

- SRS + mockup HTML được PO/UX sign-off.
- Menu KPI Hub có nhóm SERVICE KPI, route RBAC.
- API + DDL migration có rollback plan.
- Unit test: readiness, inheritance, snapshot immutability.
- E2E: tạo template → quote inherit → publish proposal (client-visible filter).
- Security test: public proposal không leak internal KPI.

---

**Kết thúc tài liệu.**
