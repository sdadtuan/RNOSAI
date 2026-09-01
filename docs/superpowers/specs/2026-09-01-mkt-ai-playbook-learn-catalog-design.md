# Marketing AI — Catalog dịch vụ, playbook `_common`, và huấn luyện playbook từ thực chiến

> **Document ID:** MKTP-PB-LEARN-20260901  
> **Phiên bản:** 1.1 · **Ngày:** 2026-09-01  
> **Trạng thái:** Implemented — [`2026-09-01-mkt-ai-playbook-learn-catalog.md`](../plans/2026-09-01-mkt-ai-playbook-learn-catalog.md)  
> **1.1:** Bổ sung §7.0 — cụ thể hoá tầng 3 (map tab/artifact), RACI bộ phận vs AI, hai vòng giải pain, ví dụ tuần 0–4  
> **Module:** MOD-MKTP (Marketing AI Planner)  
> **Route UI:** `/crm/admin/mkt-ai/playbooks` (mới) · tab AI Planner giữ `AiPlaybookSelector`  
> **Quyết định đã chốt:** Hệ thống **chọn mẫu thắng** → AI **sinh nháp** playbook → SP/MKT Lead **Duyệt / Active**. Không fine-tune model. Không auto-active.  
> **Parent:** [10-MKT-AI-PLANNER.md](../../use-cases/10-MKT-AI-PLANNER.md) · [playbook ops](../../runbooks/mkt-ai-playbook-ops.md) · [thực chiến](../../huong-dan-su-dung/29-marketing-ai-planner-thuc-chien.md)  
> **Hiện trạng code:** 3 JSON tĩnh (`meta-lead-gen`, `bds-lead-gen`, `seo-retainer`); admin catalog **read-only**; 2 lớp env whitelist chồng nhau.

---

## 1. Tóm tắt

Playbook là **khung kế hoạch mẫu theo một `service_slug`**: brief mặc định, gợi ý strategy, KPI, mix kênh, cổng quality. Khi SP áp dụng playbook, AI sinh TMMT **bám nghề** (SEO ≠ Meta Lead Gen) thay vì plan generic.

Hôm nay playbook = file JSON + PR + 2 list env (`PTT_MKT_AI_PLANNER_SLUGS` và `PTT_MKT_AI_PILOT_*`). Thêm dịch vụ mới = sửa env, restart, đôi khi viết JSON. Lỗi `mkt_ai_planner_slug_not_pilot` chặn HĐ thật (ví dụ `quang-cao-facebook`) dù DV đã có trong list pilot mặc định.

Spec này thay bằng:

1. **Một catalog policy** trên từng slug (off / pilot / ga) — không còn hai env chồng.  
2. Playbook **`_common`** — slug mới soạn được ngay, không chờ JSON riêng.  
3. **Huấn luyện playbook:** học từ HĐ PTT đã Apply + đã triển khai + KPI đạt → AI nháp → người duyệt → Active.  
4. Màn **Sinh / Duyệt / Active** cho MKT Lead.

**Pitch 1 câu:** Mỗi dịch vụ có một công thức nội bộ; hệ thống học từ HĐ thắng, AI viết nháp, người chốt — HĐ sau lên TMMT đúng nghề trong ~30 phút.

---

## 2. Mục tiêu & phạm vi

### 2.1. Mục tiêu

| # | Mục tiêu | Đo thành công |
|---|----------|----------------|
| G1 | Thêm DV không sửa `.env` / không restart | Slug mới `off` mặc định; MKT Lead bật `pilot` trên Admin → HĐ đó sinh AI được trong phiên hiện tại |
| G2 | Mọi slug `pilot`/`ga` luôn có playbook | Không khớp file riêng → dùng `_common` (giống Intake fallback) |
| G3 | Playbook sâu = học HĐ thật | Nút Sinh chỉ bật khi đủ ngưỡng §6; output đúng schema §8 |
| G4 | Human-in-the-loop | AI không `active` được; chỉ `draft` / `pending_review` |
| G5 | Một 403 tiếng Việt | Thay `mkt_ai_planner_slug_not_pilot` + `mkt_ai_pilot_slug_required` bằng một mã + message + link Admin |
| G6 | Không fine-tune LLM | Không gọi fine-tune API; không lưu weight; prompt + RAG trên corpus HĐ đã lọc |
| G7 | Rollback 5 phút | `PTT_MKT_AI_PLANNER_ENABLED=0` vẫn tắt cả module (giữ như SOP hiện tại) |

### 2.2. In scope

- Bảng policy slug + version playbook (PG).  
- Seed `_common` + import 3 JSON hiện có thành version `active` (file disk giữ làm fallback deploy).  
- Job `playbook_learn` (sinh nháp từ corpus).  
- Admin UI: danh sách DV, Sinh / preview / Duyệt / Active / Rollback version.  
- Planner: resolve playbook = active của slug → `_common` → (tương thích) file disk.  
- Gộp 2 lớp env thành kill-switch + (tùy chọn) override khẩn.  
- Unit + API smoke: ngưỡng mẫu, schema, không auto-active.

### 2.3. Out of scope (cố ý)

- Fine-tune / LoRA / model riêng theo khách.  
- Auto-active playbook, auto-Apply TMMT, auto-email khách, auto-sửa campaign ads.  
- Playbook theo **từng khách** (chỉ theo `service_slug`; Brand KB vẫn per-lifecycle).  
- Viết lại wizard 5 bước AI Planner.  
- Mở GA toàn hệ trong spec này (PO vẫn quyết định `rollout=ga` từng slug).  
- Học từ HĐ agency ngoài PTT / tài liệu internet không gắn lifecycle.

---

## 3. Playbook nghĩa là gì (nghiệp vụ)

Playbook **không** phải khóa học AI, không phải SOP dài, không phải model đã train.

Đó là **công thức nội bộ theo loại dịch vụ đang bán**. SP bấm **Áp dụng playbook** trên Brief → hệ điền ô trống + nhồi hint vào job Strategy/Campaign/Content.

| Thành phần schema (giữ nguyên) | Việc giúp khi lên TMMT thật |
|--------------------------------|-----------------------------|
| `brief_defaults` | Pain / mục tiêu / USP **kiểu DV** — SP chỉ sửa số HĐ này |
| `strategy_prompt_hints` | AI không viết SEO bằng KPI CPL Meta |
| `campaign_kpi_templates` | Card campaign có số đo đúng nghề |
| `channel_mix_pct` | Gợi ý chia budget (Conservative/Balanced lấy làm neo) |
| `quality_gate` | ≥70 + ≥2 campaign trước Launch QA (mặc định) |
| `governance_notes_vi` | Banner: không auto-publish, không auto-mail |

**Không làm:** Apply TMMT, lên ads, mail khách, thay tư duy SP.

Sai playbook (bán SEO chọn Meta) → KPI lạc. Resolve mặc định theo `service_slug`; SP vẫn đổi thủ công trước Apply.

---

## 4. Hiện trạng & nợ

### 4.1. Hai lớp whitelist

| Lớp | Env | VPS `rs.pttads.vn` (2026-08-31) | Fail |
|-----|-----|----------------------------------|------|
| A. Planner | `PTT_MKT_AI_PLANNER_SLUGS` | `meta-lead-gen,bds-lead-gen,seo-retainer` | `mkt_ai_planner_slug_not_pilot` |
| B. Pilot DV | `PTT_MKT_AI_PILOT_ONLY=1` + default 13 slug trong code | Chưa set `PILOT_SLUGS` | `mkt_ai_pilot_slug_required` |

Lead `quang-cao-facebook` pass lớp B, **fail lớp A**.

### 4.2. Playbook tĩnh

- Disk: `services/ptt-crm-api/src/marketing-ai-planner/playbooks/*.json`  
- Runtime allowlist code: `MKT_AI_PLAYBOOK_SLUGS` (3 phần tử)  
- Admin: `GET /api/v1/admin/mkt-ai/playbooks` chỉ đọc file  

Thêm DV = PR JSON + sửa constant + sửa env.

---

## 5. Kiến trúc sau nâng cấp

```text
Route-map DV (slug nguồn)
        ↓
mkt_ai_service_policy     enabled + rollout off|pilot|ga + playbook_id
        ↓
mkt_ai_playbook_versions  _common | imported JSON | learned drafts
        ↓
Planner resolve: active(slug) → _common → disk fallback
        ↓
Job strategy/campaign/content (nhồi hints)
        ↓
SP Apply TMMT  →  corpus học sau này
```

### 5.1. Ba vai trò khi học playbook

| Vai trò | Được | Cấm |
|---------|------|-----|
| **Hệ thống** | Lọc corpus, đếm ngưỡng, lưu version, bật/tắt slug | `status=active` |
| **AI** | Sinh JSON đúng schema từ corpus đã lọc | Fine-tune; ghi TMMT |
| **Người** | Sửa KPI/hint, Duyệt, Active, Rollback | Bỏ review vì “AI đã học” |

### 5.2. Env sau migrate

| Env | Việc |
|-----|------|
| `PTT_MKT_AI_PLANNER_ENABLED` | Kill-switch module (bắt buộc giữ) |
| `NEXT_PUBLIC_MKT_AI_PLANNER` | Tab FE |
| `PTT_MKT_AI_PLAYBOOKS_ENABLED` | Tắt feature playbook (về disk-only) |
| `PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED` | Tắt nút Sinh (mặc định `1` khi ship P2) |
| `PTT_MKT_AI_PLANNER_SLUGS` | **Deprecated.** Nếu còn set: AND với policy (khẩn). Rỗng = chỉ policy |
| `PTT_MKT_AI_PILOT_ONLY` / `PTT_MKT_AI_PILOT_SLUGS` | **Deprecated.** Một release đọc song song rồi bỏ |

`PTT_MKT_AI_AUTO_CUSTOMER_EMAIL=0` không đổi (BR-AI-01).

### 5.3. Policy trên slug

Mỗi `service_slug` có đúng một hàng policy.

| `rollout` | AI Planner | Playbook mặc định |
|-----------|------------|-------------------|
| `off` | 403 `mkt_ai_service_not_enabled` | — |
| `pilot` | Cho phép; Quality Apply khuyến nghị ≥70 (cứng nếu `strict_pilot_quality=true`, mặc định true) | `active` hoặc `_common` |
| `ga` | Cho phép; gate như Planner hiện tại (≥60 apply, ≥70 export full) | `active` hoặc `_common` |

Slug **mới** (có trên route-map / HĐ, chưa có hàng): insert `rollout=off`, `playbook=_common`. Không tự `ga`.

### 5.4. Resolve playbook khi sinh TMMT

Thứ tự:

1. `brief._playbook_slug` nếu version đó `active` hoặc `approved` (SP chọn tay).  
2. Policy `active_version_id` của `service_slug`.  
3. Playbook slug `_common` `active`.  
4. File disk (3 JSON cũ) — chỉ khi P1 chưa import xong.

Không còn “không có playbook thì 403”. 403 chỉ khi `rollout=off` hoặc module tắt.

---

## 6. Ngưỡng mẫu (cứng)

Mọi số dưới đây là **gate máy**. Không “linh hoạt theo cảm tính” trên API. PO đổi số = migration / env có tên, không hard-code rải rác.

### 6.1. Túi mẫu (corpus)

Một lifecycle được vào **túi ứng viên** của slug S khi **tất cả** đúng:

| # | Điều kiện | Bảng / field |
|---|-----------|----------------|
| C1 | `service_slug = S` | lifecycle / presales |
| C2 | Đã **Apply** AI Planner thành công (hoặc TMMT official có `source` apply) | `mkt_ai_jobs` type apply succeeded **hoặc** `mkt_ai_plan_versions` đã apply |
| C3 | `quality_score >= 70` trên draft/version đã apply | `mkt_ai_drafts.quality_score_json` |
| C4 | Draft đã có **người sửa** sau job AI (không lấy 100% raw AI) | `updated_at` draft > `completed_at` job generate gần nhất **hoặc** `write_source` human patch |
| C5 | Không tag seed UAT (`mkt-ai-smoke-seed`, `mkt-ai-seed-bds`, `mkt-ai-seed-seo`) | lifecycle tags / lead id ≥ 900000901 loại trừ |

Một lifecycle vào **túi thắng** khi thêm **một** trong hai:

| # | Điều kiện |
|---|-----------|
| W1 | Stage ≥ `deliver` **và** có ≥ 1 tuần closed-loop: metric chính của playbook đang dùng (CPL *lower_better* đạt hoặc lệch ≤ 15%; ROAS/leads *higher_better* đạt hoặc ≥ 85% target) |
| W2 | Stage ≥ `deliver` **và** chưa có số closed-loop, nhưng AM/SP đánh dấu `delivery_outcome=met` trên policy-learn opt-in (checkbox lúc học — mặc định **tắt**; không dùng W2 cho GA playbook) |

Học **ưu tiên túi thắng**. Nếu thắng &lt; 3: vẫn sinh được khi túi ứng viên đủ §6.2, nhưng version gắn cờ `depth=shallow` (banner vàng trên UI Duyệt).

### 6.2. Nút **Sinh playbook**

| Gate | Số | Hành vi nếu thiếu |
|------|----|-------------------|
| Tối thiểu túi ứng viên | **5** lifecycle | Nút disabled; text `Còn N HĐ Apply chất lượng ≥70` |
| Khuyến nghị túi thắng | **3** | Nút vẫn bật nếu ứng viên ≥5; nhãn `Sinh bản nông (chưa đủ KPI thật)` |
| Tối thiểu túi thắng để gắn `depth=deep` | **3** | `depth=deep` chỉ khi thắng ≥3 |
| Tối đa lifecycle đưa vào prompt | **15** (mới nhất theo `applied_at`) | Còn lại chỉ vào thống kê mix/KPI (số, không full text) |
| Cooldown cùng slug | **7 ngày** giữa 2 job `playbook_learn` succeeded | 409 `playbook_learn_cooldown` |
| Concurrent | 1 job `running` / slug | 409 `playbook_learn_in_progress` |

Presales-only (chưa lifecycle Apply): **không** đủ C2. Không học từ chỉ L1.

### 6.3. Active

| Gate | Quy tắc |
|------|---------|
| Active lần đầu trên slug | Version `approved` + reviewer ≠ `created_by` của version **hoặc** cùng người nhưng tick `self_approve` + ghi chú ≥ 20 ký tự (MKT Lead kiêm SP) |
| Active bản `depth=shallow` | Bắt buộc tick “Chấp nhận bản nông — sẽ học lại khi đủ KPI” |
| Active đè bản đang dùng | Diff bắt buộc; confirm |
| Rollback | Chọn version `approved` hoặc `active` cũ → `active`; bản vừa hạ = `retired` |

AI **không** gọi Active.

---

## 7. Nguồn dữ liệu từng tầng

Corpus **chỉ** lifecycle pass §6.1. Không scrape web, không PDF ngoài Brand KB đã index của **các lifecycle trong túi**.

### Tầng 1 — Catalog nghề (luôn có)

| Nguồn | Dùng để | Bắt buộc? |
|-------|---------|-----------|
| `ops-dv01-dv21-route-map.json` + `VALID_SLUGS` | Danh sách slug, nhãn DV, KPI mặc định ngành | Có — seed policy |
| `_common` + 3 JSON ship | Khung tối thiểu / bootstrap | Có |
| SPC / gói CB-TC-CS nếu có cùng slug | Gợi ý ngân sách band | Không |

→ Biết đây là SEO hay QC Facebook. **Chưa** biết PTT làm DV đó cho khách thật thế nào.

### Tầng 2 — Nhu cầu khách (đầu phễu)

| Nguồn | Field lấy | Cách đưa vào AI |
|-------|-----------|-----------------|
| Consult brief | pain, mục tiêu, ngân sách, geo | Gom + **ẩn danh**: bỏ `brand_name`, SĐT, tên người |
| Presales L1 | strategy framework, kênh | Tóm tắt, không full PII |
| `mkt_ai_briefs` sau Apply | objective, challenges, usp, geo, competitors (generic) | Trung vị / tần suất |
| Win checklist / BANT (nếu có trên lead) | nhóm pain lặp | Chỉ key + điểm, không free-text tên DN |

→ Pain, band ngân sách, geo, USP **kiểu khách PTT đã chốt**.  
AI **cấm** copy `brand_name` / tên 1 khách vào `brief_defaults` (validator §8.2).

### Tầng 3 — Cách triển khai (độ sâu thực chiến)

| Nguồn | Học được | Bắt buộc cho `depth=deep` |
|-------|----------|---------------------------|
| TMMT official sau Apply | Cấu trúc section, positioning | Có (nằm trong C2) |
| Campaign cards đã apply | Số campaign, kênh, KPI text | Có |
| Content calendar đã apply / item Content OS `approved_internal` | Format, nhịp | Không — nếu có ≥3 HĐ có calendar thì nhồi hint content |
| Launch QA pass/fail | Cổng trước chạy ads | Không |
| Ops DV task tuần 1–4 (cùng lifecycle) | Việc team làm thật | Không — nếu ≥3 HĐ có task deliver thì thêm `governance_notes_vi` kiểu “tuần 1: …” |
| Brand KB chunks (lifecycle trong túi) | Thuật ngữ ngành | Không — cite `doc_id`, không paste bí mật 1 khách |

Không có tầng 3 phong phú → vẫn sinh được (`shallow`) từ tầng 2.

### 7.0. Tầng 3 — Cụ thể hoá bước, RACI, hai vòng giải pain

**Quyết định:** Tầng 3 **không** phải quy trình mới do AI nghĩ ra, cũng không phải AI triển khai hộ khách. Đó là **nhật ký việc đội PTT đã làm trên HĐ thật** (tab đã ship). Bộ phận chuyên môn làm việc; hệ thống ghi artifact; **sau khi đủ ngưỡng §6** MKT Lead bấm Sinh — AI **chỉ đọc** HĐ đã lọc để viết gợi ý playbook. Playbook giúp HĐ **sau** khỏi bắt đầu từ zero. HĐ **đang chạy** vẫn do người giải pain.

#### 7.0.1. Cụ thể hoá = map tab + người + artifact

Mỗi dòng tầng 3 phải truy được **màn hình + owner + bản ghi máy đọc**. Không invent SOP song song. Chỉ học việc **Done / Apply / approved / pass** — không học ý định trên slide hay draft AI chưa duyệt.

| Nguồn §7 Tầng 3 | Route / tab | Owner trên HĐ đang chạy | Artifact đưa vào corpus học |
|-----------------|-------------|-------------------------|-----------------------------|
| TMMT official | `/crm/service-delivery/[id]` tab **TMMT** + Apply Planner | **SP** soạn, **AM** xác nhận gate | Plan đã Apply: positioning, kênh, KPI |
| Campaign cards | Planner bước Campaign → Apply | **SP** đề xuất, **Media Buyer** chỉnh số chạy | ≥2 campaign, % budget, KPI text |
| Content | Tab **Content OS** / calendar 30 ngày | **SP Content + QA** (`approved_internal`) | Format, nhịp, kênh đã duyệt — không raw AI |
| Launch QA | Tab **Launch QA** | **Buyer + Tracking** | Pass/fail + mục hay fail (pixel, UTM, form) |
| Ops tuần 1–4 | Tab **Ops Hub** checklist tuần · `/crm/ops/my-tasks` | **Specialist** Done/Skip, **AM** theo dõi | Tên task tuần 1–4 đã Done (template DV) |
| Brand KB | Planner sub-tab Brand KB | **SP / AM** upload | Chunk indexed — thuật ngữ ngành; cite `doc_id`; cấm tên khách |

**Rule học:** task `Skipped` không đưa vào “tuần 1 luôn làm X”. Task `Pending` không học. Content chưa `approved_internal` không học.

#### 7.0.2. Ví dụ tuần 0–4 — slug `quang-cao-facebook`

Việc **người** làm trên hệ (không phải AI). Cột phải = pain khách. Cột cuối = *sau này* playbook được phép nhắc (generic).

| Tuần | Việc trên hệ | Pain khách thường gặp | Playbook học (nếu HĐ vào túi thắng) |
|------|----------------|------------------------|-------------------------------------|
| 0 | SP Apply TMMT; Tracking setup pixel/CAPI | “Không biết lead từ đâu” | Hint: UTM + CAPI trước khi scale |
| 1 | Buyer Launch QA; Specialist spawn checklist “campaign / form” | Form dài, CPL ảo | `governance_notes`: tuần 1 QA + form ngắn |
| 2 | Content duyệt 8–12 posts; Buyer tối ưu ads | Message lệch USP | Nhịp content + góc pain đã thắng |
| 3–4 | AM nhập KPI tháng Ops Hub; closed-loop Planner | CPL cao | Chỉ HĐ **đạt** (tầng 4 / W1) vào túi thắng |

HĐ **này** hết pain khi task **Done** và KPI tháng **Đạt**. Playbook **không** bấm Launch QA, không tạo campaign ads, không tick Ops hộ.

#### 7.0.3. Hai vòng giải quyết vấn đề khách

**Vòng A — HĐ đang chạy (tầng 3 “sống”)**  
Consult / BANT / L1 nói pain (tầng 2). AM điều phối; SP / Buyer / Tracking / Content / Specialist làm trên tab §7.0.1. Pain được giải khi việc hoàn thành + số liệu tháng đạt. **AI Planner và job `playbook_learn` không thay vòng A.**

**Vòng B — HĐ sau (playbook)**  
Đủ 5 ứng viên + (muốn `deep`) 3 thắng. MKT Lead **Sinh**. AI gom pain lặp (tầng 2) + việc lặp đã Done (tầng 3) + số thắng (tầng 4) → `strategy_prompt_hints` / `governance_notes_vi` kiểu: *“Tuần 1: pixel + form ngắn trước scale; cổng KPI dùng CPL, không dùng organic.”*  
HĐ mới: SP ~30 phút áp dụng playbook — plan **nhắc việc hay quên**; team **lặp lại vòng A**.

Không có tầng 3 (chưa Deliver, chưa tick Ops/QA/Content) → chỉ `depth=shallow` (tầng 2). Máy **cấm** bịa “tuần 1 làm X” khi chưa có ≥3 HĐ cùng slug có task Done tương ứng (§7 bảng “Không — nếu ≥3 HĐ…”).

#### 7.0.4. RACI — bộ phận triển khai tầng 3 vs AI

| Việc | Responsible | Accountable | AI được phép |
|------|-------------|-------------|--------------|
| Soạn / Apply TMMT | SP | AM (gate) / MKT Lead nếu approval | Nháp strategy/campaign/content — **không** Apply |
| Chạy ads, bid, form | Media Buyer | AM | Không |
| Pixel, CAPI, UTM | Tracking | AM | Không |
| Bài, lịch, duyệt xuất bản | SP Content | QA / Lead Content | Nháp calendar — chỉ học bản đã duyệt |
| Checklist tuần, KPI tháng | Specialist | AM | Không tick task, không nhập KPI hộ |
| Quan hệ khách, chuyển Deliver/Retain | AM | GDKD | Không |
| Bấm **Sinh playbook** | MKT Lead (`crm_mkt_ai.generate`) | MKT Lead | Đọc corpus đã lọc → JSON `draft` |
| **Duyệt / Active / Rollback** | MKT Lead hoặc GDKD (`crm_mkt_ai.approve`) | Cùng | **Cấm** Active |
| Kill-switch module | DevOps | PO | — |

```text
HĐ 1…n:   AM điều phối · SP · Buyer · Tracking · Content · Specialist
                ↓ làm trên tab đã có (vòng A)
           Hệ thống lưu TMMT Apply, task Done, QA pass, content duyệt, KPI tháng
                ↓ đủ ngưỡng §6
MKT Lead:  [Sinh playbook]
                ↓
           AI: tóm tắt việc lặp + KPI thắng → nháp JSON (vòng B, chưa active)
                ↓
MKT Lead:  sửa câu / số → Duyệt → Active
                ↓
HĐ n+1:    SP áp dụng playbook → team lại vòng A
```

**AI không triển khai tầng 3.** Tầng 3 = giao vận hành. AI = thư ký học việc **sau**, khi đã có bằng chứng thắng.

Specialist **không** có việc “bảo AI viết SOP tuần”. Họ tick Ops. MKT Lead mới quyết định học.

#### 7.0.5. Điều kiện tầng 3 được tính là “có nghĩa”

`depth=deep` chỉ khi **đồng thời**:

1. Đủ túi thắng W1 (§6.1) — không dùng W2 (`delivery_outcome=met` tay) cho bản gắn `deep`.  
2. Trong túi thắng, ≥ **3** lifecycle có **ít nhất một** artifact tầng 3 ngoài TMMT+campaign: Ops task Done tuần 1–4 **hoặc** Launch QA pass **hoặc** Content `approved_internal`.  
3. Team thật sự dùng Ops Hub / Launch QA / Content trên HĐ đó — không chỉ Apply TMMT rồi bỏ.

Thiếu (2) → job vẫn chạy nếu đủ 5 ứng viên, nhưng `depth=shallow` + banner vàng §6.3 / §9.3. Hint `governance_notes` **không** được chứa câu “Tuần N: …” trừ khi ≥3 HĐ có task Done cùng nhóm tuần (normalize tên task theo template DV).

### Tầng 4 — Kết quả (lọc thắng)

| Nguồn | Việc |
|-------|------|
| `GET` closed-loop đã có (CPL/ROAS/leads/spend vs target) | W1 |
| Trend 6 tuần dashboard | Ưu tiên HĐ ổn định ≥ 4 tuần hơn spike 1 tuần |
| Job optimize / weekly memo | Không đưa raw vào prompt (nhiễu); chỉ flag `had_optimize=true` trên metadata |

HĐ fail KPI nặng (CPL lệch &gt; 40% *worse* hoặc ROAS &lt; 50% target) → **loại khỏi túi thắng**; vẫn có thể nằm túi ứng viên nếu C1–C5 (để thống kê “đừng học cái này”). Prompt nhận `negative_lessons` tối đa 3 bullet đã **generic hóa** (không tên khách).

### 7.1. Payload job học (tóm tắt, không full dump)

```text
{
  service_slug,
  depth: "shallow" | "deep",
  candidate_count, winner_count,
  brief_frequency: { objective, geo, challenge_themes[] },
  kpi_stats: { cpl_p50, roas_p50, channel_mix_p50 },
  winner_excerpts: [ { lifecycle_id_hash, strategy_bullets[5], campaigns[2] } ],  // max 15
  negative_lessons: [ string ],  // max 3
  current_playbook: { ...schema hoặc _common },
  schema_instructions
}
```

`lifecycle_id_hash` = HMAC nội bộ — UI Duyệt hiện **mã HĐ thật** cho reviewer (cùng quyền `crm_mkt_ai.approve`), không nhét tên khách vào JSON playbook.

---

## 8. Schema playbook & validator học

Giữ schema `MktAiIndustryPlaybook` hiện tại. Thêm field (optional, backward compatible):

| Field | Kiểu | Ý nghĩa |
|-------|------|---------|
| `learned_from` | `{ candidate_count, winner_count, depth, generated_at }` | Audit |
| `anonymized` | `true` (bắt buộc với bản learned) | Validator |

### 8.1. AI phải điền

`slug` (mặc định = `service_slug`), `label_vi`, `service_slugs` (đúng 1 slug đang học), `brief_defaults`, `strategy_prompt_hints` (≥3, ≤8), `campaign_kpi_templates` (≥2, ≤8), `quality_gate` (min 70 / campaigns 2 trừ khi corpus median campaign ≥3 thì cho 3), `governance_notes_vi` (≥1).

`channel_mix_pct`: tổng 100 ± 2; nếu không suy được → copy `_common` và đánh `mix_inferred=false`.

### 8.2. Validator từ chối (job `failed` hoặc version `rejected_auto`)

- `brief_defaults.brand_name` không rỗng.  
- `brief_defaults` / hints chứa SĐT, email, MST, hoặc tên khớp `client_name` của lifecycle trong túi.  
- `service_slugs` ≠ đúng slug đang học.  
- Schema fail `validateMktAiPlaybookDocument`.  

Người vẫn sửa tay trên bản `draft` rồi gửi duyệt.

---

## 9. Màn Sinh / Duyệt / Active

**Route:** `/crm/admin/mkt-ai/playbooks`  
**Cap:** xem `crm_mkt_ai.view` + `ai_admin.view` **hoặc** `crm_mkt_ai.approve`. Sinh + gửi duyệt: `crm_mkt_ai.generate`. Active / rollout slug: `crm_mkt_ai.approve`.

### 9.1. Danh sách dịch vụ

Bảng mọi slug từ route-map ∪ policy ∪ HĐ 90 ngày:

| Cột | Nội dung |
|-----|----------|
| Dịch vụ | `label_vi` + slug |
| Rollout | chip `off` / `pilot` / `ga` — toggle (approve) |
| Playbook active | tên version + `deep`/`shallow`/`shipped` |
| Mẫu | `ứng viên / 5` · `thắng / 3` |
| HĐ Apply 30 ngày | số |
| Job fail 7 ngày | % (link ops report) |
| CTA | `Mở` |

`off` → HĐ slug đó 403 tiếng Việt: *“Dịch vụ này chưa mở AI Planner. Nhờ MKT Lead bật pilot tại Admin → Playbooks.”*

### 9.2. Chi tiết slug — 3 cột

**Trái — Corpus**

- Thanh: ứng viên `n/5`, thắng `m/3`.  
- Danh sách HĐ trong túi (id, client ẩn một phần, score, stage, CPL/ROAS nếu có).  
- Checkbox loại 1 HĐ khỏi lần Sinh này (không xóa khỏi DB).  

**Giữa — Playbook**

- Version active (JSON đọc được, không raw dump một khối — form theo field schema).  
- Dropdown version lịch sử.  
- Diff version A vs B (field-level).  

**Phải — Hành động**

| Nút | Hiện khi | Kết quả |
|-----|----------|---------|
| **Sinh playbook từ HĐ thực chiến** | Ứng viên ≥5, không job running, hết cooldown | Job `playbook_learn` → version `draft` |
| **Sinh bản nông** | Ứng viên ≥5, thắng &lt;3 | Cùng job, `depth=shallow` |
| Disabled + lý do | Ứng viên &lt;5 | `Còn N HĐ…` |
| **Gửi duyệt** | Version `draft` do mình hoặc generate | `pending_review` |
| **Duyệt** | `pending_review` + cap approve | `approved` |
| **Yêu cầu sửa** | cùng | `draft` + note ≥10 ký tự |
| **Active** | `approved` + gate §6.3 | `active`; bản cũ `retired` |
| **Rollback** | Có version approved/active cũ | §6.3 |
| **Bật pilot / GA** | Cap approve | Update policy; **không** restart |

Job panel: queued / running / succeeded / failed + **Thử lại** (không xóa draft tay).

### 9.3. Preview trước Active

- So sánh field với `_common` và với bản `active` hiện tại.  
- Cảnh báo `depth=shallow`.  
- Cảnh báo nếu `channel_mix` không khớp median corpus ±20 điểm % một kênh.  
- Nút **Dùng thử trên lifecycle** (optional P2): mở Planner HĐ `pilot` với `brief._playbook_slug` = version này **chưa** active — không ghi policy.

### 9.4. Planner (không đổi stepper)

`AiPlaybookSelector`: list = `_common` + playbook `active` khớp slug + 3 shipped nếu còn. Áp dụng = merge brief như hôm nay (`mergeBriefWithPlaybook`).

---

## 10. Data model

### 10.1. `mkt_ai_service_policy`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `service_slug` | PK text | |
| `rollout` | `off` \| `pilot` \| `ga` | default `off` |
| `enabled` | bool | default true; false = ẩn khỏi Planner dù ga |
| `active_version_id` | FK nullable | playbook version |
| `strict_pilot_quality` | bool | default true |
| `updated_at` / `updated_by` | | audit |

### 10.2. `mkt_ai_playbook_versions`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | bigserial | |
| `service_slug` | text | `_common` dùng slug `_common` |
| `version_no` | int | unique (slug, version_no) |
| `status` | `draft` \| `pending_review` \| `approved` \| `active` \| `retired` \| `rejected_auto` | một `active` / slug |
| `depth` | `shipped` \| `shallow` \| `deep` | shipped = import JSON / `_common` |
| `document_json` | jsonb | schema playbook |
| `source` | `disk` \| `common` \| `learn` \| `manual` | |
| `learn_job_id` | FK nullable | |
| `corpus_json` | jsonb | đếm + hash lifecycle, không PII |
| `created_by` / `reviewed_by` / `reviewed_at` / `review_note` | | |
| `created_at` | | |

### 10.3. Job

Thêm `playbook_learn` vào `mkt_ai_jobs.job_type` (lifecycle_id **nullable** — job theo slug; cột `lifecycle_id` hiện NOT NULL → dùng `lifecycle_id=0` sentinel **hoặc** job table riêng `mkt_ai_playbook_learn_jobs`).

**Chọn:** bảng `mkt_ai_playbook_learn_jobs` (`id`, `service_slug`, `status`, `actor`, `error`, `output_version_id`, timestamps) để không phá CHECK `mkt_ai_jobs` theo lifecycle.

Audit: ghi `ai_agent_runs` như job Planner khác (BR-MKTP-03).

---

## 11. API

Base admin: `/api/v1/admin/mkt-ai/playbooks` (mở rộng read-only hiện tại).

| Method | Path | Cap | Việc |
|--------|------|-----|------|
| GET | `/` | view | Catalog + policy + corpus counts |
| GET | `/:slug` | view | Policy, versions, corpus list |
| PATCH | `/:slug/policy` | approve | `rollout`, `enabled` |
| POST | `/:slug/learn` | generate | Enqueue học; 409 nếu gate |
| GET | `/:slug/learn/:jobId` | view | Status |
| PATCH | `/versions/:id` | generate | Sửa `document_json` khi `draft` |
| POST | `/versions/:id/submit` | generate | → pending_review |
| POST | `/versions/:id/decide` | approve | approve \| request_changes |
| POST | `/versions/:id/activate` | approve | Active + retire old |
| POST | `/versions/:id/rollback` | approve | Active bản cũ |

Planner `GET/POST .../playbooks` không đổi contract FE trừ thêm item `_common`.

403 module:

```json
{
  "error": "mkt_ai_service_not_enabled",
  "service_slug": "quang-cao-facebook",
  "message": "Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.",
  "admin_path": "/crm/admin/mkt-ai/playbooks?slug=quang-cao-facebook"
}
```

Xóa dần 2 mã cũ sau 1 release (map alias để FE cũ không trắng).

---

## 12. Pha triển khai

| Phase | Việc | Xong khi |
|-------|------|----------|
| **P0 — dọn nợ** | Một hàm `assertPlannerAllowed(slug)` đọc policy **hoặc** (nếu chưa migrate) gộp 2 env; 403 VI; seed policy từ 13 slug default + 3 planner slugs = `pilot` | Hết nhầm 2 mã lỗi; `quang-cao-facebook` bật được bằng 1 hàng policy / hoặc tạm thêm env một lần |
| **P1 — `_common` + import** | JSON `_common`; import 3 file → version `active` `depth=shipped`; resolve §5.4 | Mọi slug `pilot` sinh TMMT được |
| **P2 — Học + màn Sinh/Duyệt/Active** | DDL §10, job học, Admin UI §9, validator §8 | 1 slug đủ 5 HĐ sinh draft → duyệt → active trên staging |
| **P3 — Deep** | Tầng 3–4 + §7.0 (Ops/QA/Content artifact, cấm bịa “Tuần N”); cờ `depth`; thử trên lifecycle | Bản `deep` chỉ khi W1 ≥3 **và** §7.0.5 |

P0 có thể ship độc lập (hotfix whitelist). P2 là giá trị “huấn luyện”. Không gộp P0+P2 một PR.

**Migrate VPS:** P0 seed `pilot` cho đúng 3 slug đang env + các slug PO chỉ định (khuyến nghị thêm `quang-cao-facebook` nếu đang bán). Còn lại `off`.

---

## 13. Lỗi & vận hành

| Triệu chứng | Xử lý |
|-------------|--------|
| Nút Sinh tắt | Hiện đủ C1–C5 fail nào (số HĐ thiếu) |
| Job học fail validator §8.2 | Version `rejected_auto` + danh sách lỗi; không Active |
| Job LLM fail | Retry; draft tay không xóa |
| Active nhầm | Rollback version |
| Playbook lộ tên khách | Validator chặn; nếu lọt: Lead hạ Active, file incident |
| Fail rate job Planner &gt;5%/slug/7ngày | Ops report; Lead hạ `pilot` → `off` |
| Rollback module | `PTT_MKT_AI_PLANNER_ENABLED=0` — bảng giữ nguyên |

Học lại: cooldown 7 ngày; version mới; Active thủ công. Không ghi đè im lặng.

---

## 14. Kiểm thử

| Loại | Case |
|------|------|
| Unit | Corpus filter C1–C5, W1; ẩn danh brand; mix tổng 100; validator PII |
| Unit | Resolve: active → `_common` → disk |
| API | Learn 4 HĐ → 409; 5 HĐ → 202; Active từ AI token → 403 |
| API | `off` → 403 `mkt_ai_service_not_enabled` |
| E2e | Admin: đủ mẫu → Sinh → sửa KPI → Duyệt → Active → Planner dropdown hiện bản mới |
| E2e | Regression: 3 playbook shipped vẫn apply trên slug meta/bds/seo |
| E2e | Seed UAT không vào corpus |

---

## 15. RBAC & governance

| Hành động | Cap |
|-----------|-----|
| Xem catalog / corpus count | `crm_mkt_ai.view` |
| Sinh / sửa draft / gửi duyệt | `crm_mkt_ai.generate` |
| Duyệt / Active / Rollback / đổi rollout | `crm_mkt_ai.approve` |
| Kill-switch env | DevOps |

Giữ BR-MKTP-01 (Apply TMMT thủ công), BR-MKTP-03 (audit job), BR-AI-01 (không auto-email).

---

## 16. Liên kết

| Tài liệu | Path |
|----------|------|
| Use case Planner | `docs/use-cases/10-MKT-AI-PLANNER.md` (UC-020 playbook) |
| Playbook ops hiện tại | `docs/runbooks/mkt-ai-playbook-ops.md` |
| SOP thực chiến | `docs/huong-dan-su-dung/29-marketing-ai-planner-thuc-chien.md` |
| DDL Planner | `docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner.sql` |
| Route-map DV | `docs/specs/ops-dv01-dv21-route-map.json` |

---

## 17. Self-review

- Không TBD: ngưỡng 5 / 3 / 15 / 7 ngày / quality 70 đã chốt.  
- Không mâu thuẫn: AI không Active; `_common` không thay active riêng; env cũ chỉ AND khẩn.  
- §7.0: AI không triển khai tầng 3; `deep` cần W1 + ≥3 HĐ có artifact Ops/QA/Content; không bịa “Tuần N” khi thiếu task Done.  
- Một spec — implement tách P0 / P1 / P2 / P3 (plan sau khi PO duyệt).  
- “Huấn luyện” = học playbook JSON, không fine-tune.

---

*Spec v1.1 — tổng hợp thảo luận 2026-09-01 + cụ thể hoá tầng 3 / RACI / hai vòng pain.*
