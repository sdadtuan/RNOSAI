# Design: Creative OS Video — Thắng Nova / In-house (BĐS · Lead · TVC)

**Ngày:** 2026-09-10  
**Trạng thái:** Đã duyệt (2026-09-10)  
**Document ID:** CP-VIDEO-AGENCY-WIN-20260910  
**Đối thủ:** Nova Enterprise Creative Production OS · agency in-house (Monday + DAM + ad hoc AI)  
**Use case 90 ngày:** (1) BĐS social ads · (2) Lead video social kênh · (3) Brand TVC ngắn  
**Khớp:** [Creative Production OS SRS](./2026-09-07-creative-production-os-srs.md) · [PTT FB Lead Video](./2026-09-10-ptt-fb-lead-video-design.md) · [Service KPI BĐS pack](../plans/2026-09-09-service-kpi.md) · Nova SoT `docs/superpowers/specs/sources/nova-ai/`

---

## 1. Câu thắng (một câu)

**PTT không bán “tool tạo video” — PTT bán vòng kín brief → creative đạt chuẩn ngành → chạy ads → lead vào CRM → đo CPL theo dự án/khách**, trong khi Nova chỉ dừng ở render + duyệt nội bộ.

---

## 2. Nova vs PTT — ma trận thắng

| Capability | Nova / In-house typical | PTT moat (đã có / cần ship) |
|---|---|---|
| Project + Brand Kit + render queue | ✅ Core Nova P1 | ✅ CP W1–W4 (render stub → **cần provider thật**) |
| Template + batch CSV | ✅ Nova | ✅ CP batch; **thiếu matrix BĐS × kênh** |
| QC checklist generic | ✅ 9+ checks | ✅ Engine có; **cần domain packs** (lead/BĐS/TVC) |
| CRM / lead attribution | ❌ Export manual | ✅ `crm_leads`, RE Projects, webhook FB |
| Meta Ads Ops + CPL | ❌ | ✅ Ads Ops template `re_lead_default` |
| Policy pack BĐS (cam kết, wording) | ❌ | ✅ Service KPI `real_estate` pack |
| Chargeback credit theo khách/dự án | ⚠️ Workspace-level | ✅ CP ledger + project budget 50/80/100 |
| Client review Hub | ⚠️ Portal riêng | ✅ Creative Hub `/crm/creatives` |
| Closed-loop báo cáo creative → deal | ❌ | ⚠️ RPT-02 + AM OS — **cần nối** |

**Kết luận:** Đừng cạnh tranh editor. Thắng bằng **Industry Playbook + Domain QC + CRM/Ads closed loop**.

---

## 3. Ba sản phẩm video (Product Lines)

### PL-1 — BĐS Social Ads Pack

**Ai dùng:** AM/SP chạy Meta/TikTok cho chủ đầu tư / phân phối BĐS.  
**Output:** 9:16 + 4:5 + 1:1, 15–30s, nhiều căn/dự án từ cùng template.

| Thành phần | Spec |
|---|---|
| **Nguồn dữ liệu** | RE Projects (`/crm/re-projects`) — tên dự án, giá từ, vị trí, hotline, inventory |
| **Template vars** | `{{project_name}}` `{{price_from}}` `{{location}}` `{{cta}}` `{{hotline}}` + ảnh căn từ DAM |
| **Batch** | CSV hoặc **pull CRM allowlist** từ RE inventory; max 50 row/lần |
| **Brand** | Brand Kit client BĐS — logo CĐT, palette, disclaimer BĐS (Service KPI banned phrases) |
| **QC pack `bds_social`** | Safe area Meta · logo CĐT · giá “từ X” không cam kết ROI · không ảnh stock sai dự án · CTA đúng form/landing |
| **Publish** | CAL → Meta Ads Ops; gắn `re_project_id` trên campaign |

**Thắng Nova khi demo:** “1 template → 20 căn → 20 ad creative QC pass → lead gắn đúng dự án → pool NV” — Nova không có RE webhook + auto-assign.

---

### PL-2 — Lead Video Social Pack (Performance)

**Ai dùng:** PTT MKT + khách B2B lead gen (không chỉ BĐS).  
**Output:** 9:16 15s (+ 30s scale), Instant Form, không brand-film.

| Thành phần | Spec |
|---|---|
| **SoT** | [PTT FB Lead Video design](./2026-09-10-ptt-fb-lead-video-design.md) — **đã khóa** |
| **QC pack `lead_social`** | `ptt-fb-lead-video-qc.util.ts` — face time, safe zone 280px, form CTA, no AI label on creative |
| **Ingest** | 4 file master vào DAM → CP version → QC gate → Ads Ops `re_lead_default` |
| **Khác Nova** | Launch brief **chặn** nếu QC blocked; proof UI `rs.pttads.vn`; webhook → `crm_leads` |

**Wave 1 (Phase A):** Ingest 4 hook PTT nội bộ + QC gate launch **và** playbook `lead_social` trong Studio — regenerate script→scene từ template beat (hook/UI/CTA), render vẫn stub/ingest đến Phase B.

---

### PL-3 — Brand TVC Ngắn (15–30s Hero)

**Ai dùng:** Brand team / creative producer — hero spot awareness, không performance lead.  
**Output:** 16:9 + 9:16 cut-down, 15–30s, cinematic hơn PL-1/2.

| Thành phần | Spec |
|---|---|
| **Pipeline** | **Video SOP** (Runway draft → Kling final) — chất lượng hình; **CP OS** — governance (kit, QC, approval, credit) |
| **Handoff** | SOP job complete → ingest MP4 vào CP version → QC pack `tvc_short` |
| **QC pack `tvc_short`** | Loudness · black/frozen · logo intro/outro · brand color · duration ±0.2s · no claim without legal |
| **Approval** | Matrix: Brand + Legal bắt buộc trước `export.final` |
| **Khác Nova** | Cùng governance, nhưng PTT có **Quote/Contract KPI snapshot** gắn deliverable |

---

## 4. Kiến trúc “Industry Playbook”

Một playbook = Template published + Brand Kit default + QC pack + channel profiles + (optional) RE/CRM mapping.

```
┌─────────────────────────────────────────────────────────────┐
│ Playbook Registry (SET-08 / Admin)                          │
│  bds_social_916 │ lead_social_916 │ tvc_short_169           │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 RE Project   CRM row    Brief manual
 (PL-1)       (PL-2 ext)  (PL-3)
    │           │           │
    └───────────┴───────────┘
                ▼
         CP Batch / Studio
                ▼
    Domain QC pack (auto facts)
                ▼
    Approval matrix → Publish → Lead/CPL
```

**API mới (mỏng):**

- `GET /api/crm/cp/playbooks` — list playbook metadata
- `POST /api/crm/cp/playbooks/:id/run` — validate source + estimate credits + enqueue batch
- `POST /api/crm/cp/videos/versions/:id/qc` — body `{ pack: 'bds_social' | 'lead_social' | 'tvc_short', facts? }`

**Reuse:** `cp-templates`, `cp-batches`, `cp-qc.service`, `cp-content-os-handoff`, `ptt-fb-lead-video-qc.util`.

---

## 5. Domain QC Packs (mở rộng engine hiện có)

| Pack | Checks bổ sung (ngoài 10 generic) | Auto facts source |
|---|---|---|
| `bds_social` | Giá “từ” wording · disclaimer BĐS · ảnh match project_id · CTA landing | Policy pack SKPI + metadata project |
| `lead_social` | Face sec · safe 280px · form CTA · no founder claim · UI shot | ffprobe + script metadata (đã có util) |
| `tvc_short` | Intro/outro brand · loudness −16 LUFS ±2 · no claim without `legal_approved` | ffmpeg + approval state |

**Rule:** Blocked ⇒ không export, không publish, không launch Ads Ops brief.

---

## 6. Convenience — “nhanh hơn Nova” cho 3 PL

| Flow | Steps PTT target | Nova typical |
|---|---|---|
| **BĐS 10 căn** | RE Project → Chọn playbook → Batch run → QC → Lịch publish | Export CSV → agency làm tay → email duyệt |
| **Lead pack launch** | Ingest 4 file → QC auto → Launch brief 1 click | Upload Drive → checklist Excel |
| **TVC hero** | SOP render → CP ingest → Legal gate → export | Tool riêng + approval email |

**UI bắt buộc (VID-01 polish):**

1. **Playbook picker** đầu studio — thay dropdown model trần  
2. **Channel profile chip** — Meta 9:16 / TikTok / Feed 1:1  
3. **Estimate + budget bar** — project 50/80/100% trước khi Render  
4. **Preview player** — không ship PL-3 without player

---

## 7. Lộ trình 90 ngày

### Phase A — Win demo (Tuần 1–4) · *không cần AI render mới*

| Tuần | Deliverable |
|---|---|
| 1 | Ship **PL-2 ingest + QC gate** (`ptt-fb-lead-video`) + Ads Ops launch block |
| 2 | **PL-1 playbook** template BĐS + batch từ RE project export CSV + QC pack `bds_social` (facts manual → auto metadata) |
| 3 | **RE → CP handoff** — nút “Tạo creative pack” trên RE Project → CP project + batch draft |
| 4 | UI: Playbook picker + OVR-01 polish; demo script 10 phút vs Nova checklist |

**Exit criteria A:** Tour live: RE Project → 5 creative BĐS → QC → (mock/stub render OK) → calendar slot.

---

### Phase B — Chất lượng output (Tuần 5–8)

| Tuần | Deliverable |
|---|---|
| 5–6 | **Bridge Video SOP → CP worker** — MP4 thật; stage pipeline ≥ encode → QC auto |
| 7 | **PL-3** — SOP hero 16:9 ingest + QC `tvc_short` + legal gate |
| 8 | **Channel profiles** — safe area presets; Brand Preview Lab trước render |

**Exit criteria B:** 1 TVC 30s + 1 BĐS 15s file thật QC passed end-to-end.

---

### Phase C — Scale thắng deal (Tuần 9–12)

| Tuần | Deliverable |
|---|---|
| 9 | Batch matrix ratio × locale × CTA (VID-06 full SRS) |
| 10 | RPT-02 nối Ads Ops — render success + CPL by `re_project_id` |
| 11 | Template self-serve cho khách agency (clone playbook) |
| 12 | Case study + win/loss metrics vs Nova (time-to-launch, QC block rate, CPL) |

**Exit criteria C:** 50 row batch BĐS partial success; báo cáo closed-loop 1 dự án.

---

## 8. Metric thắng (so với Nova / in-house)

| Metric | Target 90 ngày | Cách đo |
|---|---|---|
| Time brief → QC-passed creative | BĐS batch ≤ 4h (stub) / ≤ 24h (real render) | CP audit timestamps |
| QC block before waste spend | ≥ 1 blocked issue caught pre-launch | QC pack logs |
| Lead video launch | 4 hooks live, CPL baseline 7 ngày | Ads Ops + `crm_leads` |
| RE creative linkage | 100% lead gắn `re_project_id` when from BĐS ads | CRM query |
| Client approval cycle | ≤ 2 rounds via Hub | Approval state machine |

---

## 9. Out of scope (90 ngày)

- Native TikTok/Meta publish API (CAL-04 deferred)  
- Consumer mobile editor  
- Regenerate PL-2 trong CP Studio (wave 2)  
- Full timeline Premiere parity  
- Cam kết CPL/doanh thu trên creative (policy cấm)

---

## 10. Phụ thuộc & rủi ro

| Rủi ro | Mitigation |
|---|---|
| Render stub | Phase B bridge SOP; Phase A dùng ingest file có sẵn |
| RE data chất lượng | Validate row trước batch; error CSV |
| Legal URL extract | PL-1 dùng ảnh DAM, không URL scrape |
| Nova bắt kịp CRM | Tập trung **RE webhook + CPL + policy BĐS** — data moat PTT |

---

## 11. Quyết định đã duyệt

1. ✅ Đối thủ: Nova / in-house  
2. ✅ 3 PL: BĐS social · Lead social · TVC ngắn  
3. ✅ **Phase A trước** — ingest + playbook + RE handoff; không chờ AI render thật  
4. ✅ **Regenerate Studio** — PL-2/PL-1 tạo/regenerate draft + scene trong CP Video Studio (playbook-driven script→storyboard); ingest master vẫn giữ cho pack PTT nội bộ  
5. ✅ **PL-3 TVC** = dual module Video SOP + CP governance (Phase B)

---

## 12. Bước tiếp theo

1. ✅ Plan biz: `2026-09-10-cp-video-agency-win-phase-a.md` (BIZ-1…20)  
2. ✅ Plan UI: `2026-09-10-creative-os-ui-mockup.md` (UI-1…33)  
3. ✅ **Master gộp:** `2026-09-10-creative-os-integrated-phase-a.md` — thứ tự tuần 1–4  
4. Execute: **UI-1…5** (shell mockup) ∥ **BIZ-1…3** (playbook core) → tuần 2+ theo bảng integrated
