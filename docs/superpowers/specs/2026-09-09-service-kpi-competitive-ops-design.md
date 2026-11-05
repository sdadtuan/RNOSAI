# Design — Service KPI Competitive Operations (v1.1)

**Sản phẩm:** RNOSAI / PTT Agency OS  
**Phân hệ:** KPI Hub → Service KPI  
**Ngày:** 2026-09-09  
**Trạng thái:** Draft for PO review  
**Quyết định khóa:** Không cạnh tranh dashboard với AgencyAnalytics. Thắng bằng **KPI Contract OS** khép vòng Quote → rủi ro thương mại → giao hàng → đối soát → báo giá lần sau.

**Tài liệu liên quan**

| Tài liệu | Vai trò |
|---|---|
| [SRS Service KPI v1.0](../../specs/2026-09-09-service-kpi-module-srs.md) | Catalog, template, instance, measurement |
| [KPI Hub Enterprise](./2026-09-04-kpi-hub-enterprise-rnosai-srs.md) | Semantic layer, Command Center |
| Quote OS BLD-04 | KPI 3 lớp + margin floor trên báo giá |

---

## 1. Chẩn đoán v1.0

SRS/mockup hiện tại đủ để **bắt kịp** governance (Dictionary → Template → Instance → Actual). Đó là mặt bằng Agency OS / BI, không phải lợi thế.

| Lớp | v1.0 đã có | Vì sao chưa thắng |
|---|---|---|
| Catalog | Template theo 21 DV | Productive / Function Point cũng có service catalog |
| Dashboard | Target vs Actual, at-risk | AgencyAnalytics / Whatagraph / Funnel mạnh hơn connector |
| Governance | Classification, disclaimer, approval | HubSpot/Salesforce có approval; thiếu vòng bán hàng agency |
| Tracking | Measurement plan, import actual | Looker/Power BI + Ads Manager làm tốt hơn nếu chỉ là số |

Đối thủ lớn **không** sở hữu cùng lúc: Portfolio 21 DV + Quote OS 3 lớp KPI + GM floor + snapshot proposal + CRM lead + Delivery. Đó là chỗ RNOSAI phải đánh.

---

## 2. Ba hướng (đã chọn C)

| | A. Dashboard-first | B. Catalog-first (v1.0) | C. KPI Contract OS |
|---|---|---|---|
| Mục tiêu | White-label report khách | Chuẩn hóa template | Bán đúng, giao đúng, đối soát được |
| Đối thủ so | AgencyAnalytics | Productive | Không ai khép đủ vòng |
| Rủi ro | Thua connector/UX | Bị coi là “admin KPI” | Scope lớn hơn v1.0 |
| **Chọn** | Không | Nền tảng, không đủ | **Có** |

C = v1.0 + 6 năng lực vận hành dưới đây. Không thay Dictionary/Hub hiện có.

---

## 3. Sáu năng lực thắng

### 3.1. KPI Contract Score (điểm rủi ro hợp đồng KPI)

Mỗi Quote Version có một điểm 0–100: mức độ “lời bán” so với khả năng đo, benchmark, assumption, GM.

Công thức tham chiếu (internal, không xuống proposal):

```text
Risk = w1*ClassificationRisk + w2*TargetAggressiveness + w3*AssumptionOpen
     + w4*DataReadinessGap + w5*MarginPressure
```

| Tín hiệu | Ví dụ | Hành vi |
|---|---|---|
| Forecast client-facing thiếu disclaimer | “1.200 lead” không gắn “dự kiến” | Block publish |
| Target dưới benchmark floor > 25% | CPL 50K vs floor 85K | Strategy + Functional + Finance |
| GM < floor **và** KPI aggressive | GM 22,4% + CPL 50K | Block submit; bắt buộc phương án B |
| SEO traffic = COMMITTED_DELIVERABLE | Organic +30% cam kết | Block; ép PROJECTED_RESULT |
| Business outcome không có owner khách | Booking không có Sales SLA | Block client-visible |

**Khác đối thủ:** AgencyAnalytics không biết GM. Productive biết utilization, không biết “CPL có phải cam kết không”. Quote OS đã có GM 22,4% dưới floor — Service KPI phải **cộng** điểm KPI vào cùng cổng phê duyệt.

### 3.2. Quoted vs Delivered vs Reported (3 sổ)

| Sổ | Nguồn | Ai xem |
|---|---|---|
| **Quoted** | KPI Snapshot lúc publish/accept | Sales, Finance, Legal, Audit |
| **Delivered** | Actual + quality status nội bộ | PM, Functional, Data |
| **Reported** | Bản đã QA, client-visible | Account, Client, Proposal/Portal |

Quy tắc: không được xuất client report từ Delivered nếu quality ≠ Verified. Chênh Quoted↔Delivered tạo **Change Order** hoặc **waiver** có approval — không sửa thầm snapshot.

Đây là moat pháp lý + vận hành. Dashboard SaaS chỉ có sổ Reported.

### 3.3. Weekly Operating Rhythm (War Room)

Không thêm một dashboard nữa. Một **nhịp tuần** bắt buộc:

1. Assumption nào chưa confirmed (khách / sales / LP / budget)?
2. KPI nào at-risk + action quá hạn?
3. Data nào stale → cấm dùng trong báo cáo khách?
4. Line DV nào vừa lệch KPI vừa lệch GM?
5. Quote đang soạn nào có Contract Score ≥ 70?

Owner mặc định: Performance Lead (Ads), PM (deliverable), Account (client confirm). Escalation 2h / 24h / 48h giữ như Target & Cảnh báo.

### 3.4. Industry Policy Pack (BĐS, Spa, Education, Healthcare)

Pack = rule + wording cấm + reviewer. Ví dụ BĐS:

- Cấm `COMMITTED_DELIVERABLE` cho booking/deposit/GMV.
- `BUSINESS_OUTCOME` bắt buộc attribution + Sales SLA khách.
- Forecast lead bắt buộc budget + LP live + creative cadence.
- Từ cấm trên proposal: “cam kết doanh số”, “đảm bảo X lead”.

Pack gắn `industry` trên Quote/Project. Functional Lead không override bằng tay nếu pack = regulated.

### 3.5. Client Assumption Confirmation

Assumption required (budget, LP, tracking, creative SLA, sales response) phải có trạng thái: `Pending` / `Confirmed` / `Not met` + evidence.

- Client Collaborator xác nhận trên portal **hoặc** Account ghi nhận kèm file.
- `Not met` → instance `AT_RISK`; policy có thể block start project / block client report.
- Đây là lá chắn khi khách đổ lỗi “agency không đạt CPL” trong khi sales trả lời 27 phút.

### 3.6. Feedback loop vào báo giá lần sau

Sau project close:

- Actual vs Quoted theo classification (deliverable completion ≠ forecast miss).
- Ghi vào **internal benchmark** theo DV × ngành × kênh × ngân sách band.
- Quote Builder lần sau hiện “P50/P80 historical CPL BĐS Meta HCM, budget 80–150tr”.
- Win/loss: quote thua vì KPI quá aggressive vs vì giá.

Compounding data: 12 tháng PTT có benchmark nội bộ mà AgencyAnalytics generic không có.

---

## 4. Màn hình mới (mockup)

| ID | Màn | Route đề xuất | Mục đích |
|---|---|---|---|
| SKPI-00 | War Room | `/crm/kpi-hub/service-kpi` | Nhịp vận hành tuần |
| SKPI-09 | KPI Contract & Risk | `/crm/kpi-hub/kpi-contracts` | Điểm rủi ro + cổng duyệt cùng GM |
| SKPI-10 | Quoted vs Actual | `/crm/kpi-hub/reconcile` | 3 sổ; change order |
| SKPI-11 | Policy Pack | `/crm/kpi-hub/policy-packs` | Rule ngành + từ cấm |
| SKPI-12 | Assumption Confirm | overlay / portal | Xác nhận điều kiện đo |

Template / Instance / Measurement / Tracking (SKPI-01–06) giữ nguyên — chúng là nhà máy. War Room + Contract + Reconcile là **phòng điều hành**.

---

## 5. Ranh giới

**Làm:** policy, score, snapshot, 3 sổ, assumption state, benchmark nội bộ, wording firewall (rule-based, không LLM Wave 1).

**Không làm Wave 1:** AI tối ưu ads, white-label BI thay AgencyAnalytics, attribution data-driven, Power BI embed, capacity phút (đã Wave sau ở Hub Enterprise).

---

## 6. Chỉ số thành công (thắng đối thủ)

| Chỉ số | Mục tiêu 6 tháng |
|---|---|
| Quote publish bị block vì Contract Score | ≥ 15% draft bị chặn đúng (giảm dispute sau) |
| Client report dùng actual Unverified | 0 |
| Forecast client-facing thiếu disclaimer | 0 |
| Quote line kế thừa template | ≥ 80% (giữ v1.0) |
| Project close ghi benchmark band | ≥ 90% project Ads/SEO |
| Thời gian xử lý critical alert | P50 ≤ 4 giờ (War Room) |

---

## 7. Definition of Done (nâng cấp)

- SRS v1.1 + mockup có War Room, Contract Score, 3 sổ, Policy Pack.
- Quote submit đọc cùng `kpi_contract_score` và `gm_floor`.
- Public proposal API không trả score/margin/internal ledger.
- Policy Pack BĐS chặn “cam kết booking”.
- Reconcile tạo change order khi Quoted material-change.
