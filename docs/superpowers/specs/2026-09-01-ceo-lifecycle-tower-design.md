# CEO Lifecycle Tower — Tháp chu trình Lead → TMMT → CSKH

> **Document ID:** CEO-TOWER-20260901  
> **Phiên bản:** 1.0 · **Ngày:** 2026-09-01  
> **Trạng thái:** Draft — chờ PO / CEO review trước implementation plan  
> **Route:** `/crm/ceo` (cùng trang ChatBox — **panel trên**, chat **dưới**)  
> **Sibling:** [CEO Command ChatBox SRS](./2026-08-30-ceo-command-oss-chatbox-srs.md) · [Lifecycle UI](../../huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md) · [Owner Weekly K1–K4](../../huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md) · [Playbook learn](./2026-09-01-mkt-ai-playbook-learn-catalog-design.md)  
> **Quyết định đã chốt:** Một **cột sống 6 cột** + **hàng chờ sót** (chỉ vàng/đỏ). CEO quan sát ngoại lệ, không inventory. Không trộn Factory A (agency) và Factory B (CSKH spa) trên cùng hàng.

---

## 1. Tóm tắt

RNOSAI đã có đủ công đoạn Lead → HĐ → TMMT → Deliver → Retain và CSKH spa, nhưng **rải nhiều màn**. CEO không thể mở 14 tab mỗi sáng mà vẫn sót.

**Tháp chu trình** là lớp đọc + hàng chờ trên `/crm/ceo`:

- Sáu cột = ống dẫn đã gộp.  
- Mỗi entity (lead A, lifecycle A, hoặc lead B) thuộc **đúng một cột “việc hiện tại”**. Quá SLA → bắt buộc vào hàng chờ.  
- Mười cảm biến (§6) = bộ câu “không sót”. Thẻ Chat **Hôm nay** dùng **cùng** cảm biến — không invent KPI.  
- Bấm dòng → màn chuyên môn đã ship. Can thiệp ghi hệ = catalog C hiện có (confirm 2 bước). **Không** Apply TMMT / tick BANT / gửi khách từ tháp.

**Pitch 1 câu:** CEO mở `/crm/ceo` thấy ống dẫn và việc sót; số từ milestone đã có; bấm để vào đúng cửa; không soạn plan hộ team.

---

## 2. Mục tiêu & phạm vi

### 2.1. Mục tiêu

| # | Mục tiêu | Đo thành công |
|---|----------|----------------|
| G1 | Một trang thấy cả chu trình A + B | 6 cột + K1–K4 + count sót; load ≤ 3s khi cache nóng (cùng SLA briefing) |
| G2 | Không sót = không “treo không cột” | Mọi entity in-scope 90 ngày có `tower_column` + `severity`; test invariant §14 |
| G3 | CEO chỉ làm việc đỏ/vàng | Hàng chờ mặc định **ẩn xanh**; sort đỏ → quá hạn → giá trị HĐ giảm dần |
| G4 | Drill đúng nhà máy | A không mở CSKH board; B không mở TMMT |
| G5 | Cùng cap / cùng action C | Không API mutate mới ngoài catalog CEO-3; duyệt HĐ = mở Hub |
| G6 | Không phá ChatBox | Panel tháp **trên** thread; chip Hôm nay vẫn chạy; nguồn fail → cột `degraded`, không 500 cả trang |

### 2.2. In scope

- Panel `CeoLifecycleTower` trên `/crm/ceo`.  
- API đọc `GET /api/crm/ceo/tower` (facts + exceptions).  
- Bộ cảm biến S1–S10, SLA cột, severity.  
- Filter: `factory=A|B|both` (mặc định `both`), cửa sổ `7d` (exception) / K-strip dùng cửa sổ Owner Weekly 90 ngày đến cuối tuần.  
- Drill `href` + `suggest_action` (chip C, không auto-commit).  
- Loại seed UAT (`mkt-ai-smoke-seed`, lead id ≥ 900000901).

### 2.3. Out of scope (cố ý)

- Kanban kéo thả đổi stage.  
- Approve HĐ / Apply TMMT / Complete Intake / spawn week / ghi KPI Ops / pause ads từ tháp.  
- Auto-email / Zalo khách (BR-AI-01).  
- Thay `/crm/owner-weekly`, `/crm/cskh-board`, `/crm/hub`, service-delivery.  
- Gộp HR/lương vào tháp v1 (cùng CEO-A).  
- Chat đa người; cron ping CEO mỗi phút.

### 2.4. Không phá

- Catalog C 6 action, confirm, idempotency.  
- `NL_QUERY_CATALOG` / number gate.  
- K1–K4 công thức Owner Weekly (reuse query, không tính KPI thứ hai).  
- Journey NBA trên lead detail.

---

## 3. Hai nhà máy (bắt buộc tách hàng)

| Factory | Entity trên tháp | `factory` | Không hiện |
|---------|------------------|-----------|------------|
| **A — Agency B2B** | Lead `b2b_prospect` (pre-won) **hoặc** lifecycle gắn lead đó (post-won) | `A` | CSKH board, K4 trên hàng này |
| **B — CSKH spa** | Lead `spa_operational` (có `client_id`) | `B` | Cột Tư vấn/HĐ/TMMT agency |

**Một hàng = một entity.** Pre-won A: `lead_id`. Post-won A (đã promote / có lifecycle): **gộp thành một hàng lifecycle** (không nhân đôi lead + LC). B: luôn `lead_id`.

Toggle **A / B / Cả hai**:  
- `A`: ẩn cột **CSKH/Retain** phần B; cột 6 chỉ **Retain agency**.  
- `B`: chỉ cột **Lead/B2** (nếu dùng B2 spa) + **CSKH** (SLA 15p/4h/24h). Cột Intake/Tư vấn/HĐ/TMMT **trống + nhãn “Không dùng Factory B”**.  
- `both` (mặc định): 6 cột; hàng A và B **không trộn** (badge `A`/`B` trên mỗi dòng).

---

## 4. Sáu cột

| `column_id` | Nhãn UI | Công đoạn | Entity điển hình |
|-------------|---------|-----------|------------------|
| `lead_b2` | Lead / B2 | A1–A2 · B mới vào | Lead chưa `b2_done` (A) hoặc chưa first-call (B — khi filter B) |
| `intake` | Intake | A3–A4 | A: `b2_done`, chưa `intake_go` |
| `consult` | Tư vấn / Báo giá | A5–A6 | A: Go, chưa HĐ draft-active / chưa gửi GDKD |
| `contract` | HĐ | A7 | A: HĐ draft/pending duyệt, chưa `won`+lifecycle |
| `tmmt_deliver` | TMMT / QA / Deliver | A8–A12 | A: lifecycle onboard…deliver, chưa `client_active` **hoặc** đang deliver KPI/QA/Ops đỏ |
| `care` | CSKH / Retain | A13 + B1 | A: `client_active` / retain · B: trên CSKH board |

**Invariant — đúng một cột:**

```
A pre-won:
  !b2_done                    → lead_b2
  b2_done && !intake_go       → intake
  intake_go && !contract_pending_or_active → consult
  contract pending/draft      → contract
A post-won:
  lifecycle && !client_active → tmmt_deliver
  client_active || retain     → care
B:
  luôn care nếu đã vào board; nếu chưa first_call và chưa breach khác → lead_b2 khi filter B, else care
```

Nếu lead A `won` nhưng **chưa** có lifecycle (lỗi promote): cột `contract`, severity **red**, cảm biến S4 — không để rơi ngoài tháp.

---

## 5. SLA & severity từng cột

Mốc thời gian = `now - clock_start`. `clock_start` ghi dưới. **Amber** = cảnh báo. **Red** = sót / CEO phải thấy trên hàng chờ. Xanh = đạt, **không** vào queue mặc định.

Target K1–K4 **đọc từ Owner Weekly** (DB/env `PTT_OWNER_WEEKLY_*`). Không hard-code lệch K-strip. Số dưới đây = default khi chưa configure.

### 5.1. Bảng SLA

| Cột | Đồng hồ bắt đầu | Amber | Red | Metric tuần (strip) |
|-----|-----------------|-------|-----|---------------------|
| `lead_b2` A | `leads.created_at` (hoặc `received_at`) | Không owner **2h** hoặc chưa B2 **4h** | Không owner **4h** hoặc chưa B2 **8h** (480 phút = K1) | K1 median ≤ 480 phút |
| `lead_b2` B | Lead vào board | — | First call 15p **breach** (tier `first_call_15m`) | K4 ≥ 85% (cột `care` cũng đếm) |
| `intake` | `b2_done.at` | Chưa Go **3 ngày** | Chưa Go **5 ngày** (K2) | K2 median ≤ 5 ngày |
| `consult` | `intake_go.at` | Chưa HĐ draft **5 ngày** | **10 ngày** hoặc queue SP SLA vượt (nếu service queue có due) | — |
| `contract` | HĐ `submitted_at` (gửi GDKD) hoặc `created_at` draft | Pending **24h** | Pending **48h** · hoặc `won` không lifecycle **24h** | — |
| `tmmt_deliver` | `contract_active.at` (promote) | Onboard không TMMT gate xanh **5 ngày** | **7 ngày** chưa TMMT xanh; **hoặc** Launch QA fail mà stage deliver; **hoặc** Ops task overdue; **hoặc** ngày tới `client_active` > K3 (14n) | K3 median ≤ 14 ngày |
| `care` A | `client_active.at` | KPI tháng Ops **Cần chú ý** | KPI **Không đạt** hoặc HĐ hết hạn **≤ 30 ngày** chưa việc giữ chân | — |
| `care` B | Clock SLA board | Warning tier (sắp vỡ) | Breach `first_call_15m` / `b2_complete_4h` / `close_24h` | K4 ≥ 85% |

**Cột đếm:** `amber_count` / `red_count` / `ok_count` (ok không hiện list). Header cột: `red` nếu `red_count>0`, else `amber` nếu `amber_count>0`, else `ok`.

### 5.2. Quality gates trong `tmmt_deliver` (không phải đồng hồ)

| Điều kiện | Severity | Ghi chú |
|-----------|----------|---------|
| Lifecycle onboard/deliver, không TMMT official **hoặc** gate TMMT đỏ | red nếu ≥7 ngày từ promote; amber 5–7 ngày | S5 |
| Quality score Apply &lt; 60 mà AM đã chuyển deliver | red | S5 |
| Launch QA bắt buộc (flag) mà **fail** + stage ≥ deliver | red | S6 |
| Ops alert `open` hoặc task tuần `overdue` | red nếu overdue; amber nếu due hôm nay | S7 |
| Closed-loop CPL lệch &gt; 40% worse (nếu có số) | amber (CEO không pause ads) | S7 — chỉ quan sát |

---

## 6. Mười cảm biến (S1–S10)

Mỗi cảm biến = query đọc. **Fail → ≥1 hàng** trên queue (trừ khi entity ngoài cửa sổ hoặc seed). Thiếu dữ liệu module (flag off) → `degraded`, **không** giả fail.

| ID | Câu CEO | Factory | Cột | Fail khi | `suggest_action` |
|----|---------|---------|-----|----------|------------------|
| **S1** | Lead A mới > 4h chưa owner? | A | `lead_b2` | `owner_id` null và tuổi ≥ 4h | `assign_lead` |
| **S2** | B2 / Intake chậm K1 K2? | A | `lead_b2` / `intake` | Đồng hồ ≥ red §5.1 | `remind_staff` (AM) |
| **S3** | Go rồi chưa vào queue Solution? | A | `consult` | `intake_go` và không có handoff/consult session và tuổi ≥ 24h | `remind_staff` (SP) |
| **S4** | HĐ chờ duyệt > 48h? (hoặc won không LC > 24h) | A | `contract` | §5.1 red | *null* — drill Hub (không có C approve) |
| **S5** | Won > 7 ngày chưa TMMT xanh? | A | `tmmt_deliver` | Promote ≥7 ngày, gate TMMT không pass | `remind_staff` (SP) |
| **S6** | Deliver khi Launch QA đỏ? | A | `tmmt_deliver` | Stage ≥ deliver + QA fail | `remind_staff` (AM) |
| **S7** | Ops overdue / KPI tháng đỏ? | A | `tmmt_deliver` hoặc `care` | Alert open overdue hoặc KPI Không đạt | `ack_ops_alert` nếu có `alert_id` |
| **S8** | K3 — active chậm > 14 ngày? | A | `tmmt_deliver` | `contract_active` ≥ 14 ngày, chưa `client_active` | `remind_staff` (AM Agency) |
| **S9** | Factory B vỡ 15p/4h/24h? | B | `care` (hoặc `lead_b2` nếu 15p) | Tier breach | `sla_remind_lead` |
| **S10** | Retain: HĐ ≤30 ngày hết hạn hoặc KPI retain đỏ? | A | `care` | `end_date` ≤ 30 ngày hoặc KPI đỏ | `remind_staff` |

**Strip K trên header tháp:** 4 ô K1–K4 (màu RAG Owner Weekly). Click K → `/crm/owner-weekly` + filter metric. K đỏ **không** thay thế S1–S10 (K = median tuần; S = từng entity).

Cửa sổ **exception list:** mặc định entity có activity hoặc đồng hồ còn chạy trong **7 ngày**; **cộng** mọi hàng đang red/amber dù cũ hơn (HĐ pending 10 ngày vẫn hiện). Không cắt red vì ngoài 7 ngày.

---

## 7. Hàng chờ sót

`exceptions[]` tối đa **40** hàng / request (phan trang `cursor`). Mặc định filter `severity in (red, amber)`.

| Field | Ý nghĩa |
|-------|---------|
| `factory` | `A` \| `B` |
| `column_id` | Một trong 6 |
| `sensor_ids` | S1–S10 khớp |
| `severity` | `red` \| `amber` |
| `title_vi` | VD. “HĐ #42 chờ duyệt 36h” |
| `entity_type` | `lead` \| `lifecycle` |
| `entity_id` | số |
| `owner_name` | AM/SP hiện tại |
| `age_label` | “36h” / “9 ngày” |
| `value_vnd` | HĐ/pipeline nếu có — sort |
| `href` | Drill §8 |
| `suggest_action` | id C hoặc null |
| `suggest_params` | id đích đã validate |

**Sort:** `severity` red trước → `age` giảm dần → `value_vnd` giảm dần.

**Cấm:** “Xác nhận tất cả”. Mỗi hành động C một confirm (CEO-3).

---

## 8. Drill

Mọi `href` là route ops-web đã tồn tại. Tháp **không** embed form soạn.

| Cột / cảm biến | `href` |
|----------------|--------|
| `lead_b2`, `intake`, S1–S3 | `/crm/leads/{id}` (+ hash `#funnel-b2` / intake nếu có) |
| Queue Solution S3 | `/crm/solution/queue` nếu không có `lead_id` đơn |
| `contract`, S4 | `/crm/hub` hoặc `/crm/leads/{id}#lead-contract` |
| `tmmt_deliver`, S5–S8 | `/crm/service-delivery/{lifecycleId}` — S5 `?tab=ai-planner` · S6 `?tab=launch-qa` · S7 `?tab=ops-hub` |
| Agency activate S8 | `/agency/clients/{uuid}` nếu đã có client |
| `care` B, S9 | `/crm/cskh-board?lead_id=` hoặc `?sla=first_call_15m` |
| `care` A, S10 | `/crm/service-delivery/{id}?tab=ops-hub` hoặc agency client |
| K1–K4 strip | `/crm/owner-weekly` |
| Cột header click | Cùng trang: filter `column_id` + `severity=red,amber` (không điều hướng) |

Factory A **cấm** `href` `/crm/cskh-board`. Factory B **cấm** `?tab=ai-planner`.

---

## 9. Cap & quyền

### 9.1. Xem tháp

Cùng cửa ChatBox: `ceo_command.view` **hoặc** `ai_analytics.query` **hoặc** `crm_business_dashboard.view` **hoặc** `ai_admin.view` **hoặc** `crm_owner_weekly_dashboard.view`.

Thiếu `ceo_command.view` nhưng có Owner Weekly: **vẫn** xem tháp (đọc). Nút C ẩn nếu thiếu `ceo_command.act`.

### 9.2. Từng nguồn — thiếu cap thì degraded, không 403 cả tháp

| Nguồn cột | Cap tối thiểu để **điền** cột | Thiếu thì |
|-----------|------------------------------|-----------|
| Lead / B2 / Intake / Consult | `crm_leads.view` | Cột 1–3 `degraded` |
| HĐ / Hub | cap contract view hiện có trên Hub (`crm_leads.view` + contract) | Cột `contract` degraded |
| TMMT / lifecycle | `crm_board.view` | Cột `tmmt_deliver` degraded |
| Ops alert / KPI | `StaffOpsView` / ops view | S7 degraded |
| Launch QA | cùng board view | S6 bỏ qua nếu module tắt |
| CSKH / K4 | view CSKH board | Cột `care` B + K4 degraded |
| K-strip | `crm_owner_weekly_dashboard.view` | Ẩn 4 ô K; exception S vẫn chạy nếu có cap lead/board |

CEO **không** thấy lead ngoài visibility B2B/CSKH của chính họ — reuse guard list lead/lifecycle hiện tại (không bypass như CEO Command cấm `staffId≤0`).

### 9.3. Hành động

| Việc | Cap |
|------|-----|
| Chip C trên dòng | `ceo_command.act` **và** cap gốc action (CEO-3 §9.2) |
| Duyệt HĐ | **Không** từ tháp — `href` Hub + cap duyệt HĐ trên Hub |
| Gán lead | `assign_lead` + `crm_leads.assign` |
| Nhắc AM/SP | `remind_staff` + `ceo_command.act` |
| Nhắc SLA B | `sla_remind_lead` + `crm_leads.edit` |
| Ack Ops | `ack_ops_alert` + ops write |

Giữ danh sách cấm CEO-3 §9.4 (lương, RBAC, xóa, ads, mail khách, spawn week, complete Intake).

---

## 10. API

`GET /api/crm/ceo/tower`

Query:

| Param | Default | Ghi chú |
|-------|---------|---------|
| `factory` | `both` | `A` \| `B` \| `both` |
| `column_id` | — | Filter một cột |
| `severity` | `red,amber` | `red` \| `amber` \| `ok` (ok chỉ khi debug + `ceo_command.configure`) |
| `limit` | 40 | max 80 |
| `cursor` | — | Phân trang exception |

Response (rút gọn):

```ts
{
  ok: true;
  generated_at: string;
  window_exception_days: 7;
  k_strip: Array<{ key: 'k1'|'k2'|'k3'|'k4'; value: number|null; status: 'green'|'amber'|'red'|'neutral'; href: string }>;
  columns: Array<{
    column_id: string;
    red_count: number;
    amber_count: number;
    ok_count: number;
    header_severity: 'red'|'amber'|'ok';
    degraded?: { reason: string };
  }>;
  exceptions: Array</* §7 */>;
  next_cursor: string | null;
  degraded: Array<{ source: string; reason: string }>;
  sensors_ok: Record<'S1'|'S2'|…|'S10', 'ok'|'fail'|'degraded'>;
}
```

Timeout từng nguồn **2.5s** (cùng briefing). Cache 60s per `(staffId, factory)`.

**Không** POST mutate trên `/tower`. Commit vẫn `POST /api/crm/ceo/actions/commit`.

Chat briefing A: `BriefingComposer` **gọi lại** cùng hàm cảm biến (shared `CeoTowerSensorService`) để thẻ Hôm nay khớp tháp — không hai công thức.

---

## 11. UI `/crm/ceo`

```
[ Tháp chu trình ]  A | B | Cả hai     28 sót · 6 đỏ
[ K1 ] [ K2 ] [ K3 ] [ K4 ]
[ Lead/B2 ][ Intake ][ Tư vấn ][ HĐ ][ TMMT/QA ][ CSKH ]
     3v        2đ        1v       4đ       2đ         5đ
[ Hàng chờ sót ………………………………… sort ]
[ ─── ChatBox hiện tại (A/B/C) ─── ]
```

- Cột: số đỏ/vàng; click = filter list.  
- Hàng: badge A/B, title, tuổi, owner, nút **Mở** (`href`), nút **Gợi ý** nếu `suggest_action` (mở confirm C).  
- `degraded`: chip xám “Ops tắt / thiếu quyền” — không để cột giả 0 sót.  
- Mobile: K-strip + list sót trước; 6 cột thành horizontal scroll.  
- Học `/crm/ceo/learn` không đổi.

VQ: không JSON thô; không dump 200 lead xanh; empty state “Không sót trong cửa sổ — kiểm tra degraded”.

---

## 12. Pha

| Phase | Việc | Xong khi |
|-------|------|----------|
| **T0** | `CeoTowerSensorService` S1–S10 + unit invariant một cột | 10 test cảm biến + 0 entity “no column” trên fixture |
| **T1** | `GET /tower` + panel 6 cột + queue trên `/crm/ceo` | CEO view: đếm khớp fixture; drill 6 href |
| **T2** | Gắn `suggest_action` → confirm C hiện có | Assign / remind / SLA / ack từ hàng chờ |
| **T3** | Briefing Hôm nay dùng chung sensor | Thẻ A ⊆ union exception red (không KPI lạ) |

T0–T1 ship được không đợi LLM. T3 sau CEO-1 nếu briefing đã live.

---

## 13. Kiểm thử

| Loại | Case |
|------|------|
| Unit | Mọi combo milestone → đúng `column_id` (§4) |
| Unit | SLA amber/red đúng phút/ngày (§5) |
| Unit | Seed / id ≥ 900000901 loại |
| Unit | A không sinh href CSKH; B không sinh ai-planner |
| API | Thiếu ops cap → S7 degraded, S1 vẫn chạy |
| API | `severity=ok` 403 nếu không configure |
| E2e | Mở `/crm/ceo` — thấy 6 cột; click HĐ → Hub; click TMMT → service-delivery |
| E2e | Không commit C khi chỉ xem |
| Invariant nightly (staging) | `COUNT(*) WHERE tower_column IS NULL` trên in-scope = 0 |

---

## 14. Liên kết

| Tài liệu | Path |
|----------|------|
| CEO Command A/B/C | `docs/superpowers/specs/2026-08-30-ceo-command-oss-chatbox-srs.md` |
| Lifecycle UI / K1–K4 | `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` |
| CEO Chat hướng dẫn | `docs/huong-dan-su-dung/28-ceo-command-chatbox.md` |
| Playbook / TMMT (cột 5) | `docs/superpowers/specs/2026-09-01-mkt-ai-playbook-learn-catalog-design.md` |

---

## 15. Self-review

- Không TBD: SLA 2h/4h/8h, 3/5 ngày, 24/48h, 5/7 ngày TMMT, K3 14 ngày, HĐ 30 ngày, 15p/4h/24h, queue 40.  
- K1–K4 reuse Owner Weekly — không KPI song song.  
- Duyệt HĐ không lách catalog C (drill Hub).  
- Một cột / một entity; hai factory không trộn hàng.  
- AI/Chat không soạn TMMT từ tháp.

---

*Spec v1.0 — tháp quan sát chu trình cho CEO trên `/crm/ceo`.*
