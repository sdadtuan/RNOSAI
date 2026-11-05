# SRS — Performance Operating System (KPI Hub)

**Sản phẩm:** RNOSAI / PTT Agency OS  
**Phân hệ:** KPI Hub → HIỆU SUẤT  
**Phiên bản:** 3.0 Competitive  
**Ngày:** 10/09/2026  
**Trạng thái:** Spec for product + engineering  
**UX:** `docs/design/rnosai-performance-management-mockup.html`  
**Route:** `https://rs.pttads.vn/crm/kpi-hub/performance`  
**Cặp chiến lược:** [Service KPI Contract OS](./2026-09-09-service-kpi-competitive-ops-design.md)

---

## 0. Quyết định khóa — không đánh trận dashboard

Không cạnh tranh Lattice / 15Five / Culture Amp trên **nhật ký nhân sự**.  
Không cạnh tranh AgencyAnalytics / Whatagraph / Looker trên **connector + biểu đồ**.  
Không cạnh tranh HubSpot Goals trên **OKR generic**.

RNOSAI thắng bằng **một số đo xuyên suốt bán → giao → người → kỳ chốt**:

```text
Dictionary (công thức chuẩn)
    → Service KPI Instance (cam kết trên quote / DV)
    → Performance Assignment / Scorecard (ai chịu trách nhiệm kỳ này)
    → Actual có quality (Tracking / CRM / Ads)
    → Check-in có evidence + blocker
    → Period Snapshot → benchmark báo giá lần sau
```

Đối thủ lớn **không** sở hữu cùng lúc: 21 DV + Quote 3 lớp KPI + GM floor + Valid Lead CRM + Measurement Plan + scorecard người/team + period snapshot bất biến.

---

## 1. Chẩn đoán v2.0 (vì sao chưa thắng)

| Lớp v2.0 | Đã có | Vì sao đối thủ vẫn hơn nếu chỉ nhìn UI |
|---|---|---|
| Dashboard 5 tile | On track / watch / miss | Lattice, 15Five, AgencyAnalytics đẹp hơn |
| Assignment table | Owner, target, actual | Mọi HRIS/OKR đều có |
| Scorecard weight 100% | Validate tổng | Standard OKR |
| Check-in | Note + action | Weekly journal, không gắn data quality |
| Marketing tiles | Spend / CPL / ROAS | AgencyAnalytics thắng connector |
| Settings | Threshold mặc định | Admin form, không có effective date |

v2.0 **bắt kịp** OKR. Chưa có moat.

---

## 2. Sáu năng lực thắng (Performance OS)

### 2.1. One Metric, Three Ledgers

Cùng `MKT_006 CPL Valid Lead` tồn tại 3 sổ — không được trộn:

| Sổ | Nguồn | Ai xem | Dùng để |
|---|---|---|---|
| **Quoted** | Snapshot lúc publish quote / activate scorecard | Sales, Finance, Audit | Cam kết đã bán |
| **Assigned** | Target trên Assignment / Scorecard Item | Owner, Lead, HR | Trách nhiệm kỳ này |
| **Verified Actual** | Tracking + quality=`valid` | PM, Data, Lead | Chấm điểm / close |

Quy tắc:

- Check-in **không** ghi đè Verified Actual từ connector.
- Period close **không** đọc actual `pending` / `stale`.
- Client report chỉ lấy ledger được đánh dấu `client_visible`.
- Lệch Quoted ↔ Assigned > policy → bắt buộc Change Order hoặc waiver (nối Service KPI Reconcile).

**Khác đối thủ:** Lattice chỉ có Assigned. AgencyAnalytics chỉ có Reported. Không ai giữ 3 sổ trên cùng definition.

### 2.2. Direction-correct scoring (agency thật)

Agency sống trên CPL/CPA (lower-is-better) và lead/ROAS (higher-is-better). Nhiều OKR tool tính `actual/target` cho mọi KPI → CPA 149K/160K bị hiểu là “93% thiếu”.

| Direction | Progress | Health override |
|---|---|---|
| Higher | `Actual / Target × 100` | Green ≥90 / Yellow 70–89 / Red <70 |
| Lower | `Target / Actual × 100` (actual=0 → 0) | Green nếu actual ≤ target; Yellow nếu overrun ≤10%; Red nếu >10% |
| Maintain / Range | 100% trong band | Decay ngoài band |
| Exact | 100 hoặc 0 | Deliverable / milestone |

Scorecard = Σ(Item Score × Weight) / 100. **Cấm** average raw đơn vị khác nhau.

### 2.3. Check-in = operating ritual, không nhật ký

Check-in bắt buộc khi cadence đến hạn. Payload tối thiểu:

- Actual (read-only nếu auto + verified)
- Forecast cuối kỳ
- Data quality stamp (source, last sync, stale?)
- Blocker **bắt buộc** nếu Red/Critical
- Evidence (dashboard URL, ticket, file)
- Next action hoặc lý do no-action
- Assumption client (budget / LP / Sales SLA) nếu KPI inherit Service Instance

Reviewer: approve / return (bắt buộc comment) / escalate.  
Overdue ảnh hưởng **update compliance**, không bịa actual.

### 2.4. Scorecard inherit Service Template + Quote

Khi tạo Scorecard `Marketing Lead Q4` hoặc `Campaign An Phát`:

1. Gợi ý item từ Service KPI Template của DV đang chạy.
2. Prefill target từ Quote snapshot nếu có `source_id`.
3. Cảnh báo nếu target lệch benchmark / template range → approval (cùng cổng Contract Score).
4. Activate sinh Assignment; mỗi item giữ `definition_version_id` + `formula_snapshot`.

Không tạo KPI “tự nghĩ tên” rồi map sau — đó là chỗ HubSpot Goals thua agency.

### 2.5. Quality cascade

CRM Valid Lead stale 29h:

- Mapping `Valid Lead` = Stale.
- Mọi KPI phụ thuộc (`CPL`, `MQL Rate`) → `Pending Validation`.
- Dashboard tile Data issues + War Room queue.
- Cấm dùng số đó trong client report / period close.

PII lead-level không bao giờ xuống Performance UI (chỉ aggregate).

### 2.6. Close → benchmark lần sau

Period close tạo **Performance Snapshot** bất biến: target, actual, score, weight, formula version, source quality, approval, assumption state.

Sau close:

- Ghi band nội bộ: DV × ngành × kênh × ngân sách (cùng Service KPI feedback loop).
- Quote Builder lần sau thấy “P50 CPL BĐS Meta HCM 80–150tr”.
- Reopen / adjustment bắt buộc lý do + audit. Không sửa thầm.

---

## 3. Ranh giới

```text
GOVERNANCE     Dictionary, Target, DQ, Approval
SERVICE KPI    Template, Instance, Tracking, Contract Score, 3 sổ quote
HIỆU SUẤT      Assignment, Scorecard, Check-in, Campaign/CRM roll-up, Period OS
PHÂN TÍCH      Report Hub, snapshot query, export audit
```

| Làm | Không làm |
|---|---|
| Giao / chấm / review KPI vận hành | Tự tính lương, thưởng, kỷ luật |
| Inherit metric + actual từ Hub | Thay HRIS / payroll |
| Chặn report khi actual unverified | Tự tối ưu Ads |
| Snapshot + reopen workflow | AI kết luận năng lực người không qua manager |
| Field-level Finance / HR / Client | Thay warehouse / Power BI |

---

## 4. Entity (chuẩn hóa)

| Entity | Key fields | Ghi chú |
|---|---|---|
| Objective | name, period, owner | Không chấm điểm trực tiếp |
| KpiDefinition | code, unit, formula, direction, classification | Từ Dictionary; versioned |
| KpiAssignment | definition_id, scope_type/id, owner, period, target band, direction, source, quality | 1 accountable owner |
| KpiScorecard | type (role/person/team/dept/project/client), cycle, cap, status | Weight = 100% khi Active |
| ScorecardItem | assignment_id, weight, order, formula_snapshot | Duplicate definition+scope+period bị cấm |
| Actual | value, quality, collection_method, period, superseded | Correction = record mới |
| CheckIn | actual_ref, forecast, blocker, evidence, review_state | Cadence-derived due |
| CorrectiveAction | owner, due, impact, evidence | Required khi Red |
| PerformanceSnapshot | frozen JSON + hash | Closed period only |
| Policy | score_cap, thresholds, reminder, stale, close | Effective date; không rewrite snapshot |

**Scope types:** individual, team, department, project, client, campaign, service.

---

## 5. Phân quyền (field + hierarchy)

Authorization đồng thời: tenant → org tree → scope → role trên KPI → classification → state.

| Role | Được | Không |
|---|---|---|
| Owner | Check-in, evidence, đề xuất action | Sửa Verified Actual; xem Finance/HR restricted |
| Team Lead | Review check-in, assign action | Đổi weight Active không qua revision |
| Dept Head | Roll-up, escalate, close (policy) | Xem HR cá nhân ngoài cây mình |
| Finance | Commercial KPI | Scorecard HR cá nhân mặc định |
| HR | Role/person scorecard | Margin / cost nội bộ |
| Account | Client/project client-visible | Internal risk note, reviewer comment |
| Data Owner | Mapping, verify actual | Đổi target đã close |
| Auditor | Read-only audit + snapshot | Ghi |
| Client Viewer | Snapshot client-visible | Mọi ledger khác |

---

## 6. Mapping 11 màn → Hub (giữ route)

| ID | Màn | Route | Moat trên màn |
|---|---|---|---|
| PM-01 | Operating Dashboard | `/crm/kpi-hub/performance` | Nhịp tuần + 3 sổ + queue DQ |
| PM-02 | Assignment Registry | `/crm/kpi-hub/performance/assignments` | Direction + quality + quoted Δ |
| PM-03 | Create Assignment | `…/assignments/new` | Prefill Dictionary + readiness gate |
| PM-04 | Scorecard Builder | `…/scorecards` | Inherit template; weight 100% |
| PM-05 | Scorecard Item | `…/scorecards/items` | Benchmark vs template range |
| PM-06 | Check-in Ritual | `…/check-ins` | Lock auto actual; blocker Red |
| PM-07 | Marketing OS | `…/marketing` | Source health; không tin ROAS thiếu attribution |
| PM-08 | Campaign Control | `…/campaigns` | Funnel + Quote/WO + fee ≠ media |
| PM-09 | CRM Source Map | `…/crm-source` | Rule versioned; cascade stale |
| PM-10 | Performance Report | `…/reports` | Closed = snapshot; export audit |
| PM-11 | Policy | `…/settings` | Effective date; impact analysis |

RBAC: `crm_kpi_hub.view`. Ghi Assignment/Check-in/Settings: `crm_kpi_dictionary.manage` hoặc cap Performance riêng Phase 2.

---

## 7. Đặc tả màn hình chi tiết

### PM-01 — Operating Dashboard

**Mục đích:** Nhịp điều hành, không “một dashboard nữa”.

Tiles (filter period + org scope):

1. KPI đúng tiến độ = Active/Tracking + health Green + quality ≠ stale.
2. Cần theo dõi = Yellow **hoặc** assumption open.
3. Không đạt = Red/Critical (lower-is-better dùng overrun rule).
4. Completion = mean Item Score (đã quy đổi), không raw.
5. Check-in đúng hạn = completed on/before due / expected count.
6. **Data blocked** (tile moat) = số KPI không được close/report vì quality.

Khu vực bắt buộc:

- **Nhịp tuần:** 5 câu như War Room — assumption, at-risk action, stale, lệch KPI+GM, scorecard pending.
- **3 sổ strip:** Quoted / Assigned / Verified — click drill Reconcile hoặc Assignment.
- Dept stacked health + commercial at-risk (An Phát CPL).
- Queue deep-link giữ filter context.
- Restricted actual không render.

FR-PM-DASH-001…006 (v2) giữ. Thêm:

- FR-PM-DASH-007: Tile Data blocked không đếm KPI quality=valid.
- FR-PM-DASH-008: Click “06 check-in quá hạn” → Check-in `overdue=1&period=current`.

### PM-02 — Assignment Registry

Cột bắt buộc: KPI (name+code), Owner, Scope, Cycle, Target (band + direction icon), Actual (+ quality chip), Progress (direction-aware), Quoted Δ, Trend, Status, Actions.

- Lower-is-better hiển thị `≤160K` và progress từ `target/actual`.
- Quality `stale` / `pending` phủ badge lên Actual, không giả Verified.
- Quoted Δ chỉ hiện khi có snapshot quote; material → link Change Order.
- AI Insight: bắt buộc `evidence_ids`; không tự đóng action.

### PM-03 — Create Assignment

4 bước + **Readiness rail** (giống Measurement Plan):

| Gate | Pass khi |
|---|---|
| Definition | Dictionary Active hoặc custom + approval |
| Owner | User active thuộc/được quyền scope |
| Target/direction | Min≤target≤stretch hợp direction |
| Source | Auto KPI có Measurement Plan |
| Visibility | Client-visible có disclaimer inherit |

Save Draft lỏng. Submit/Activate fail nếu gate đỏ. Override formula/source = audit.

### PM-04 / PM-05 — Scorecard + Item

- Add từ Dictionary / Service Template / existing Assignment / new.
- Weight realtime; submit block ≠100% (policy).
- Duplicate definition+scope+period → block.
- Target ngoài template range → warning + approval.
- Remove item sau Active chỉ qua revision; giữ history actual.
- Preview: simulated score tại Min/Target/Stretch + tổng weight sau add.

Ví dụ Marketing Lead Q4: MQL 30 / CPL 20 / MQL→SQL 20 / Influenced Rev 20 / On-time 10.

### PM-06 — Check-in Ritual

Header: target, actual, variance, quality, last sync.  
Timeline: owner check-in / lead review / escalation.  
Critical: bắt buộc blocker + action + notify Lead.  
Correction actual = record mới, không UPDATE phá.  
Forecast client-facing thiếu disclaimer → không publish.

### PM-07 — Marketing OS

Tiles: Spend (maintain vs plan), Valid Lead, CPL, MQL Rate, ROAS.  
ROAS = `N/A + lý do` nếu attribution/DQ thiếu.  
At-risk row click → Assignment/Check-in context client.  
Source rail: Meta/Google/CRM/GA4 health. Deep-link Command Center + Tracking.

### PM-08 — Campaign Control

Bảng: Campaign, Client, Quote/WO, Service, KPI, Target, Actual, Forecast, Media budget (tách agency fee), Pacing, Owner, Status.

Funnel Lead-gen:

```text
Impressions → Clicks → LP Views → Raw → Valid → MQL → SQL → Booking
```

Stage không có source/mapping → empty state, **không** bịa conversion.  
Inherit KPI Instance khi campaign gắn Quote/Template.  
Client report ẩn cost/margin/risk note.

### PM-09 — CRM Source Map

Raw / Valid / MQL / SQL / First Response / Show-up / Won.  
Mapping versioned: rule `is_valid AND deduplicated` gắn `rule_version` — report lịch sử dùng snapshot.  
Click mapping → Measurement Plan / DQ issue.  
Stale cascade theo §2.5.

### PM-10 — Report

Widget: completion, compliance, at-risk, overdue, scorecards active, trend, health by service/client, T vs A vs F, DQ, action SLA, close status.

Closed period **mặc định snapshot**. Export: field-level auth + audit event. Không mix 2 formula version không có chú thích.

### PM-11 — Policy

Nhóm A–D (scoring, check-in/escalation, close, integration/visibility) giữ v2 + **effective_date** + impact analysis (số scorecard/KPI/user bị ảnh hưởng). Không rewrite snapshot. Override theo legal entity nếu được phép.

---

## 8. Validation

| Tình huống | Hành vi |
|---|---|
| Weight ≠ 100% | Draft OK; Activate block |
| Target min > max / end ≤ start | Block |
| Owner inactive | Block activate |
| Definition retired | Không tạo mới; lịch sử giữ snapshot |
| Auto KPI thiếu source | Block activate |
| Manual overwrite verified | Block hoặc correction + permission |
| Source stale | Pending + alert; cấm close/report |
| Client forecast thiếu disclaimer | Block publish |
| Closed period edit | Adjustment/reopen only |

---

## 9. Notification

Assigned/activated → Owner.  
Due / overdue check-in → Owner + Lead.  
Yellow → Owner. Red → Owner + Lead + Account nếu gắn client.  
Stale → Data Owner + Owner + PM.  
Action due → Action owner.  
Scorecard pending / period close → Approver.  
Mọi event in-app; email cho High/Critical.

---

## 10. API

Prefix `/api/crm/kpi-hub/performance`

Giữ endpoint v2. Bổ sung:

| Method | Path | Mục đích |
|---|---|---|
| GET | `/assignments/:id` | Detail + ledgers + audit |
| POST | `/assignments/:id/activate` | Readiness + approval |
| POST | `/period-close` | Snapshot immutable |
| POST | `/period-reopen` | Authority + reason |
| GET | `/snapshots` | Closed period query |
| GET | `/audit-logs` | Sensitive actions |

Idempotency key cho create/activate/check-in/close. Optimistic lock. Field filtering theo role.

---

## 11. Acceptance (thắng đối thủ)

| ID | Given / When / Then |
|---|---|
| AC-PM-01 | Weight 30/20/20/20/10 submit OK; 10→15 → block 105% |
| AC-PM-02 | CPA 149K vs ≤160K lower → Green, không 149/160 “thiếu” |
| AC-PM-03 | P1 5,2h vs 4h → Red + bắt buộc blocker/action |
| AC-PM-04 | CRM stale 29h → CPL Pending; cấm close/report |
| AC-PM-05 | Client report An Phát chỉ target/actual/disclaimer |
| AC-PM-06 | Close Q4 → snapshot hash; sửa phải reopen |
| AC-PM-07 | Quoted CPL 100K vs Assigned 85K material → flag Change Order |
| AC-PM-08 | Auto Meta actual verified → owner không ghi đè |
| AC-PM-09 | ROAS thiếu attribution → `N/A` + explanation |
| AC-PM-10 | AI insight không có evidence_ids → không render |

---

## 12. Chỉ số thành công 6 tháng

| Chỉ số | Mục tiêu |
|---|---|
| Assignment inherit Dictionary/Template | ≥ 85% KPI mới |
| Client report dùng Unverified | 0 |
| Check-in Red thiếu blocker | 0 |
| Period close có snapshot | ≥ 95% scorecard Active |
| Lower-is-better tính sai (CPA/CPL) | 0 ticket |
| Quote lần sau đọc PM snapshot band | ≥ 70% Ads/SEO close |

---

## 13. Phase

**Phase 1 (đã ship UI+API seed):** 11 route Hub, scoring direction, weight, check-in blocker.  
**Phase 2:** Persist Postgres, inherit Instance/Tracking thật, 3 sổ, period close, reminder.  
**Phase 3:** Forecast, AI có evidence, calibration HR (không payroll), warehouse semantic.

---

## 14. Definition of Done

Màn hoàn thành khi có: loading/empty/denied/error/stale/draft/pending/closed; auth hierarchy + field class; validation; audit create/update/approve/check-in/correction/action/close/export; unit scoring/weight; integration DQ; E2E create → check-in → alert → close; optimistic lock; không rò Finance/HR/client-private.
