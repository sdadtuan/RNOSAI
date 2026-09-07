# SRS — Creative Production OS trên RNOSAI (Enterprise)

**Sản phẩm:** RNOSAI / ops-web + ptt-crm-api  
**Tên module:** Creative Production OS (CP OS)  
**Tên tiếng Việt:** Hệ điều hành sản xuất sáng tạo  
**Document ID:** CP-20260907  
**Phiên bản:** 2.0  
**Ngày:** 2026-09-07  
**Trạng thái:** SoT vận hành enterprise — đặc tả đủ nghiệp vụ file mẫu Nova, map SoR RNOSAI  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn` · tenant `PTT`

**Changelog**

| Ver | Thay đổi |
|---|---|
| **2.0** | Viết lại toàn bộ. SoT = mockup HTML đủ màn Nova. Port hết FR-OVR/PRJ/VID/MED/BRK/CAL/RPT/SET + 3 engine + event + NFR. Wave = thứ tự code, **không** cắt nghiệp vụ khỏi spec. v1.0 **hết hiệu lực**. |
| 1.0 | Bản rút gọn — thiếu màn, field, batch, collections, SET, QC checklist, API. Không dùng để triển khai. |

**SoT UI (thứ tự thắng):**

1. [Mockup master](../../design/rnosai-cp-os-srs-mockup.html) — đủ screen ID, control, sample  
2. Mockup theo module `docs/design/rnosai-cp-os-*-mockup.html`  
3. Tài liệu này — quy tắc, SoR, field, API, AC  
4. [SRS Nova 2.0](./sources/nova-ai/SRS_NOVA_AI_Enterprise_Creative_Production_OS.md) — capability gốc  
5. Mockup Nova `docs/superpowers/specs/sources/nova-ai/` — tham chiếu; **không** theme tím / logo NOVA / workspace switcher / portal riêng

**Quy tắc số liệu:** Mockup được phép sample (The Peak, 86 video, 3.840 credit). Runtime **cấm** hard-code; thiếu = `null` / `—`.

---

## 0. Gap v1.0 (đã đóng trong v2.0)

| Thiếu ở v1.0 | File mẫu có | v2.0 |
|---|---|---|
| 6 KPI tự bịa, thiếu OVR-03/04 | 8 KPI Nova + Production Monitor + Activity | 8 KPI + 4 màn OVR |
| Project chỉ 7 FR tóm | PRJ-01…05, 8 field tạo, budget 50/80/100, member, milestone | Đủ |
| Video cắt còn 13 FR; batch “W3 thôi” | FR-VID-001…033, 8 màn, QC 9 check, approval 7 state | Đủ trong spec + mockup |
| DAM 7 FR; không Collections/Quality | MED-01…06, 10 FR, pipeline ingest | Đủ |
| Brand 7 FR; thiếu motion/audio/legal | BRK-01…05 + rule condition/action | Đủ |
| Calendar 6 FR; thiếu bulk + channel profile | CAL-01…04 + CAL-05 bulk + profile bảng | Đủ |
| Report thu gọn; ẩn ROI | RPT-01…05 đủ tab; ROI `—` + nguồn | Đủ |
| SET gần như bỏ | SET-01…08 map platform vs CP | Đủ |
| Không engine / event / cột DDL | §13–17 Nova | §14–18 |
| Mockup ~100 dòng/module, tab giả | Nova đủ tab + modal + JS | Master + 8 file |

---

## 1. Sản phẩm và nguyên tắc

CP OS quản lý vòng đời **brief → asset → brand → video AI → QC → duyệt → xuất bản → chi phí → báo cáo** cho PTT, đa khách / đa brand / đa kênh.

Không phải tool text-to-video rời. Không phải app Nova.

### 1.1. Mục tiêu nghiệp vụ (từ Nova, giữ nguyên)

1. Rút ngắn brief → bản video review được.  
2. Chuẩn hóa creative / AM / brand / legal / khách.  
3. Đúng nhận diện, đúng quyền asset, đúng policy trước xuất bản.  
4. Sản xuất hàng loạt theo template + dữ liệu khách/lifecycle + locale.  
5. Chargeback credit theo khách / lifecycle / project / cost center / output.  
6. Mở adapter: AI provider, storage, Ads Hub, social (không tự viết IdP).

### 1.2. Nguyên tắc

| Nguyên tắc | Áp dụng RNOSAI |
|---|---|
| Governed by default | Policy mặc định chặn render/publish |
| Snapshot immutable | Render khóa draft + asset version + Brand Kit version + model + pricing |
| Human-in-the-loop | AI không tự publish / không tự ghi SoR khác |
| Isolation | Tenant PTT + `agency_client` + scope Của tôi/Team/Toàn PTT |
| Traceable output | Mọi version truy vết brief, prompt, asset, model, reviewer, ledger |
| Scale by automation | Template, batch, mapping, QC, approval rule là first-class |

### 1.3. Hướng tích hợp (khóa)

**A — `/crm/creative-os*` trong ops-web + `CreativeProductionModule`.** Cấm app tách. Cấm nuốt Content OS.

---

## 2. Quyết định khóa

| # | Chọn |
|---|---|
| Q1 | Không app tách. `/crm/creative-os*`. |
| Q2 | `CpShell`. Cấm `<main>` lồng. Class `cp-*`. |
| Q3 | Khách = `agency_client`. Bắt buộc trên project/asset/video. |
| Q4 | Campaign = `service_lifecycle` + Planner snapshot. Không Campaign master 2. |
| Q5 | Copy/lịch chữ = Content OS. PublishItem video = CP; caption được `content_item_id`. |
| Q6 | Video người = Video SOP. CP không INSERT take/bible. |
| Q7 | Duyệt khách = Creative Hub + portal `/creatives`. **PRJ-05 không** mint portal. |
| Q8 | Launch ads = Campaign Write. CP bàn giao version + UTM + file. |
| Q9 | Workspace Nova = tenant PTT. Không switcher. |
| Q10 | Token navy `#0F2747` / accent `#2563EB` / bg `#F4F6F8` / Be Vietnam Pro. |
| Q11 | AI: `CP_AI_ENABLED` unset mặc định. Bật mới dispatch provider. |
| Q12 | Nav **8 mục SoT mockup:** Tổng quan · Dự án · Video AI · Thư viện · Brand Kit · Lịch · Báo cáo · **Cấu hình**. (v1 nói 7 — **sửa**: Cấu hình là SET đã map, không phải SSO. Quản trị IdP vẫn ở Admin.) |
| Q13 | KPI Tổng quan **đúng 8 thẻ** (Nova FR-OVR-002): Video tạo · Video duyệt · Render success % · Thời lượng render TB · Credit đã dùng · Credit còn lại · Asset sắp hết quyền · Việc quá hạn. |
| Q14 | Credit ledger nội bộ. Không bán gói SaaS. Ads spend ≠ credit. |
| Q15 | Scope Của tôi / Team / Toàn PTT. |
| Q16 | Script không grant RBAC. |
| Q17 | Empty `—`. Không “mở ở Wave” trên UI. |
| Q18 | Native social API = phase triển khai sau file-export; **spec vẫn mô tả** CAL-04 connector. |
| Q19 | Batch/template **có trong SoT**. Code theo wave, UI không giấu nghiệp vụ. |

---

## 3. Personas, RBAC, ABAC

### 3.1. Map role

| Role Nova | RNOSAI | Được | Không |
|---|---|---|---|
| Platform Super Admin | Admin | Provider, policy, observability | — |
| Workspace Owner | GDKD / Admin PTT | Credit allocate, default kit, `view_all` | Sửa HĐ/AM SoR |
| Workspace Admin | Producer lead | Project, member project, asset, workflow | SSO |
| Account Manager | AM | Xem book, gửi Hub, deadline | Sửa asset gốc / Brand rule nếu không cap |
| Creative Producer | SP Content | Brief, task, deliverable, template | Publish external nếu thiếu cap |
| Creator / AI Operator | Creator | Draft, batch trong quota | `render.high_cost` |
| Video Editor | Video | Timeline, audio, caption | Mutate completed version |
| Brand Lead | Brand | Kit, rule, preview, approve visual | Ledger grant |
| Legal | Legal | Claim, disclaimer, rights | Render |
| Client Reviewer | Portal | Approve/reject creative được share | Ops-web CP |
| Finance | Finance | Ledger, forecast, export cost | Sửa Brand Kit |
| Viewer | Viewer | Xem được share | Mọi mutation |

### 3.2. Cap catalog

`crm_cp.view` · `edit` · `render` · `render_high_cost` · `export_final` · `publish` · `brand` · `manage_brand_rule` · `approve_legal` · `finance` · `manage` · `view_audit`

ABAC thêm: `agency_client_id` ∈ scope, `classification`, `project.status`, `asset.rights_status`, `estimate >= high_cost_threshold`, `region`.

Mọi check ở **server**.

---

## 4. IA, route, screen catalog

OpsNav nhóm Vận hành: **Sản xuất sáng tạo**.

| Screen | Route | Tab/query | Nguồn |
|---|---|---|---|
| OVR-01 Dashboard | `/crm/creative-os` | | Nova OVR-01 |
| OVR-02 Action Center | `/crm/creative-os?panel=actions` | drawer/modal | OVR-02 |
| OVR-03 Production Monitor | `/crm/creative-os/ops` | | OVR-03 + VID-04 |
| OVR-04 Activity | `/crm/creative-os/activity` | | OVR-04 |
| PRJ-01 Portfolio | `/crm/creative-os/projects` | grid/list | PRJ-01 |
| PRJ-02 Create | `/crm/creative-os/projects/new` | modal hoặc page | PRJ-02 |
| PRJ-03 Workspace | `/crm/creative-os/projects/[id]` | `tab=` 8 giá trị | PRJ-03 |
| PRJ-04 Timeline | `?tab=timeline` | | PRJ-04 |
| PRJ-05 Client review | **không route CP** | submit `/crm/creatives` | PRJ-05 map |
| VID-01 Studio | `/crm/creative-os/video/[id]` | `tab=studio` | VID-01 |
| VID-02 Storyboard | `tab=storyboard` | | VID-02 |
| VID-03 Timeline | `tab=timeline` | | VID-03 |
| VID-04 Ops | `/crm/creative-os/video/ops` hoặc `tab=ops` | | VID-04 |
| VID-05 Review | `tab=review` | | VID-05 |
| VID-06 Batch | `/crm/creative-os/video/batch` | 4 bước | VID-06 |
| VID-07 Templates | `/crm/creative-os/video/templates` | | VID-07 |
| VID-08 Version | `/crm/creative-os/video/versions/[id]` | | VID-08 |
| MED-01 Library | `/crm/creative-os/media` | | MED-01 |
| MED-02 Detail | `/crm/creative-os/media/[id]` | | MED-02 |
| MED-03 Ingest | `?tab=ingest` | | MED-03 |
| MED-04 Collections | `?tab=collections` | | MED-04 |
| MED-05 Rights | `?tab=rights` | | MED-05 |
| MED-06 Quality | `?tab=quality` | | MED-06 |
| BRK-01…05 | `/crm/creative-os/brand-kits` + `[id]` | tab portfolio/editor/rules/preview/history | BRK |
| CAL-01…04 + bulk | `/crm/creative-os/calendar` | tab calendar/composer/gate/monitor/bulk | CAL |
| RPT-01…05 | `/crm/creative-os/reports` | tab executive/production/credit/performance/governance | RPT |
| SET-01…08 map | `/crm/creative-os/settings` | tab profile/members/credit/models/integrations/security/policy | SET |

Deep-link: AM 360 · `service-delivery/[lifecycle]?tab=content-os` · `/crm/video/[id]` · `/crm/creatives?focus=` · Campaign Write.

### 4.1. UX state bắt buộc mọi màn

Loading/skeleton · Empty + CTA · Error có bước xử lý · 403 · Offline/reconnect (SSE) · Search/filter/sort/pagination · Toast ≠ error · Activity trên object dài đời.

---

## 5. MOD-OVR — Tổng quan

**Mục tiêu:** Command center sản lượng, deadline, render, duyệt, credit, asset risk, việc.

### 5.1. OVR-01 Executive Dashboard

**Widget:** 8 KPI · trend 7/30 ngày (created / approved / published) · bảng project đang chạy · milestone 7 ngày · production health 3 hàng (model, ingest, provider) · alert bar.

**KPI (FR-OVR-002) — đúng 8, không cắt:**

| Thẻ | Metric | Công thức | Drill-down |
|---|---|---|---|
| Video đã tạo | count draft+version kỳ | `created_at` ∈ range, scope | `/video?created=` |
| Video đã duyệt | Final Approved | `approval_status` | `/video?approval=final` |
| Render thành công | completed / (completed+failed final) | job kỳ | `/ops?result=` |
| Thời lượng render TB | avg duration completed | | `/ops` |
| Credit đã dùng | charged + reserved | ledger | reports `tab=credit` |
| Credit còn lại | allocated − charged − reserved | theo scope | project budget |
| Asset sắp hết quyền | expiry ≤ 14 ngày, rights not archived | | media `tab=rights` |
| Việc quá hạn | task `due_at < now` AND status ≠ done | | project tasks / AM link |

Filter: kỳ (7/30/tháng/quý) · khách · lifecycle · owner. Đổi filter → mọi widget + URL (`from`,`to`,`client`,`lifecycle`,`owner`,`scope`).

**FR-OVR-001…006** giữ nguyên Nova, workspace = PTT.

**AC:** `last_updated` ISO · URL share được · alert critical có severity, resource, owner, CTA, ghi activity.

### 5.2. OVR-02 Action Center

Gom (FR-OVR-003): review pending (nội bộ + Hub) · render failed · rights expiring · budget 50/80/100 · publish failed · mention comment.

Mỗi hàng: icon severity · title · context · SLA/deadline · CTA (Review / Retry / Kiểm tra / Xem budget).

Modal chi tiết: impact deadline/cost/rights/publish · escalate rule (vd. client review +24h).

### 5.3. OVR-03 Production Monitor

Bảng job: id, video, stage, %, provider, priority, action (cancel/retry/fallback).  
Job trace stage: Validation+reserve → Moderation+rights → Script/scene → TTS → Mix → Composite → Encode → QC → CDN.  
Provider health 60 phút: success %, p95, queue, timeout.  
Capacity: concurrent slot workspace.

### 5.4. OVR-04 Activity

Feed filter actor / project / module / action / time. Mỗi event: actor, action, resource, snapshot ref (pricing, kit, job). Export = `view_audit`.

---

## 6. MOD-PRJ — Dự án

Cấu trúc: **`agency_client` 1—N lifecycle 1—N `crm_cp_projects` 1—N deliverable**.

### 6.1. PRJ-01 Portfolio

Grid/list. Filter: status, owner, khách, lifecycle, health/budget band, search. KPI hàng: số project, deliverable xong, credit at-risk. Cột: tên, khách, tiến độ %, hạn, status, owner.

### 6.2. PRJ-02 Create — field bắt buộc

| Field | Bắt buộc | SoR |
|---|---|---|
| name | có | |
| agency_client_id | có | clients |
| lifecycle_id | không | service_lifecycle |
| industry | không | copy từ client |
| objective | không | text |
| start_at, due_at | due có | |
| owner_staff_id | có | crm_staff |
| member_staff_ids[] | không | |
| credit_budget | không | |
| cost_center | không | |
| tags[] | không | |

### 6.3. State

`draft → active → at_risk → in_review → completed → archived`  
At risk khi: quá hạn deliverable HOẶC credit ≥80% HOẶC approval SLA vỡ.

### 6.4. PRJ-03 Workspace — 8 tab (đủ control mockup Nova)

**Tổng quan:** mục tiêu, tag, member avatars, metric (deliverable xong, video final, ngày còn), progress theo loại deliverable, milestone, activity 24h, donut credit.

**Brief:** document version N · sections Bối cảnh / Mục tiêu / Thông điệp+CTA / Ràng buộc · review cards Brand/Client · nút sửa = revision N+1 · gửi duyệt.

**Deliverables:** card cover + play · type ai_video/motion/social/landing · status (queued/rendering/qc_warning/client_review/final) · CTA tạo. Type human_video → link Video SOP.

**Công việc:** bảng title, assignee, due, priority (normal/high/critical), status. Có dependency. Attachment. **Hoặc** `am_task_id` / `csd_ticket_id` — không clone CSD.

**Media:** lưới asset project + mở DAM + upload (gán `project_id`). Badge rights warning.

**Phê duyệt:** Brand / Client (Hub) / Legal. SLA còn lại. QC block hiện trên bước Legal.

**Ngân sách:** dòng Video production / Batch / Voice · cột Budget, Charged, Reserved, Còn · banner 80%. Xuất CSV `finance`.

**Hoạt động:** audit project (batch, kit publish, comment, reserve).

### 6.5. PRJ-04 Timeline

Milestone: date, title, owner, status, dependency. Cảnh báo chồng hạn.

### 6.6. PRJ-05 / FR-PRJ-007

Nút “Chia sẻ review” = `POST` Creative Hub (whitelist version). Không đoán URL. Portal không nằm CP.

### 6.7. Đóng project (FR-PRJ-008)

Pending deliverable → hoàn thành hoặc archive có lý do. Job queued phải cancel.

### 6.8. Budget (FR-PRJ-005)

Allocation credit (và optional VND ghi chú). Cảnh báo **50 / 80 / 100%**. 100% = hard block render nếu policy hard. Soft = chỉ cảnh báo ở 50/80.

---

## 7. MOD-VID — AI tạo video

### 7.1. VID-01 Studio

Cột trái: Prompt / Kịch bản / URL (confirm extract) · char count / max cấu hình · chip gợi ý · switch tự tạo kịch bản · upload + DAM picker · asset strip version.  
Giữa: preview 16:9, playhead, storyboard 4+ scene, mini timeline, CTA mở VID-03.  
Phải: ratio 9:16/16:9/1:1/4:5 · duration 15/30/60 · style · locale · voice · music · model · Brand Kit swatch · estimate + pricing version · nút Tạo video.  
Dưới: queue bảng.

**FR-VID-001…010** giữ đủ. URL W2 nếu legal chưa xong — **màn và field vẫn có**, disable + copy lý do.

Autosave debounce 2s. Moderation trước dispatch khi AI bật.

Config object: `aspect_ratio, duration_sec, resolution, style, language, voice_id, subtitle, music, model_id, brand_kit_version_id, watermark_draft`.

Submit: snapshot draft + pricing + `Idempotency-Key` + RenderJob. Block: thiếu cap, asset ≠ Ready, rights block, credit thiếu, moderation block, AI tắt.

### 7.2. VID-02 Storyboard (FR-VID-004, 005, 011, 012)

Scene card: index, title, duration, thumb, asset count, lock, QC.  
Editor: visual direction, VO, text overlay (max 42 ký tự mặc định, cấu hình được), regenerate scene.  
Reorder / duplicate / delete / split / merge. Lock không bị regenerate.  
Panel rule: Brand Kit, asset policy, approval claim, lock list.

### 7.3. VID-03 Timeline (FR-VID-013…016)

4 track: Video/Scene · VO · Music · Caption.  
Undo/redo (20) · trim · volume · ducking · zoom · snap.  
Mọi edit = draft revision. Completed version immutable.  
Missing/revoked asset → banner block render.

### 7.4. VID-04 Render Ops (FR-VID-017…022)

State: `draft, queued, preparing, rendering, processing, qc, review, completed, failed, cancelled, expired`.  
Priority: `critical, high, standard, low`. Concurrent quota.  
Retry auto backoff; manual retry / fallback = **child job** + cùng pricing snapshot.  
Cancel chỉ stage cho phép; release/refund theo policy.  
Realtime SSE; poll 5–10s fallback.  
Export log `view_audit`.

### 7.5. VID-05 Review (FR-VID-023…028)

Player + timecode comment (Open / In Progress / Resolved) · mention · attachment · notify.  
QC checklist **đủ 9+:** technical (res/duration/audio) · safe area · caption overflow · logo presence · CTA bắt buộc · disclaimer · missing audio · loudness · black/frozen · moderation.  
QC: Passed / Warning / Blocked. Blocked ⇒ không export/publish.  
Approval: `internal_review, client_review, changes_requested, brand_approved, legal_approved, final_approved, rejected`.  
Matrix rule: client, lifecycle, category, channel, risk, cost threshold, `has_claim`.  
Compare vN↔vN-1: metadata, script, kit, asset, cost, preview.

Client decision **ghi từ Hub/portal**, CP chỉ đọc.

### 7.6. VID-06 Batch (FR-VID-029…033)

Stepper: 1 Template · 2 Mapping · 3 Variants · 4 Review & Run.  
Variable: `{{project_name}} {{price_from}} {{location}} {{cta}} {{hotline}}` + custom.  
Source: CSV/XLSX · lifecycle/CRM allowlist · API (W3). Validate per cell.  
Matrix: ratio × language × voice × persona × CTA × channel.  
Estimate: count valid, credits, duration, capacity, invalid rows, sample.  
Partial success · retry theo hàng · export error CSV · reconcile ledger.

### 7.7. VID-07 Template

Version, variables, brand lock, approval rule, output profile. Lifecycle draft→published. Dùng template = tạo draft.

### 7.8. VID-08 Version detail

Snapshot: prompt/script, asset versions, kit version, model, pricing, QC, approvals, output URI, download history (signed URL + audit).

---

## 8. MOD-MED — DAM

MIME allowlist W1: `image/jpeg, image/png, image/webp, video/mp4, video/quicktime, video/webm, audio/mpeg, audio/wav, audio/mp4, application/pdf`. Size theo Settings.

**State:** `uploading, processing, ready, quarantined, failed, archived, deleted`.

**Pipeline (FR-MED-002):** MIME+size → malware scan → transcode/proxy → thumb → waveform (audio/video) → OCR/transcript (type) → AI tags (nếu AI bật) → Ready hoặc Quarantine.

**Metadata (FR-MED-004):** filename, type, codec, resolution, duration, bytes, creator, owner, source, project_id, tags, taxonomy, ai_labels, language, rights_status, hash.

**Rights (FR-MED-005):** license_type, owner, effective, expiry, territory[], channels[], restriction, model_release, talent_release, proof_asset_id.

Expired/restricted: warn hoặc **block** generate/render/publish (policy).

Usage graph: draft, version, project, template, publish item.

Version: replace = version mới. Restore = version mới từ old blob, không mutate lịch sử.

Search: filename, tag, project, owner; OCR/transcript/semantic khi bật.

**Collections:** manual + **smart** (saved filter, permission-aware).

**Quality:** baseline count, missing metadata, duplicate candidates (hash + perceptual). Không auto-delete. Quarantine tay.

---

## 9. MOD-BRK — Brand Kit

**Nội dung kit (FR-BRK-001):** logo variants (primary/light/mark/icon) · palette · typography · motion preset · intro/outro · sound logo · caption style · watermark · CTA template · disclaimer.

**Scope:** PTT default / `agency_client` / project override (controlled).

Mọi sửa = version. Render lưu `brand_kit_version_id`.

**Rule:** condition (output type, channel, ratio, has_claim, scope) + enforcement (block render / warning) + actions (logo, palette lock, CTA outro, disclaimer, watermark, safe-area %, QC visibility).

**Preview Lab:** 9:16 / 16:9 / 1:1 / 4:5 · contrast · clipping · safe area · logo visibility · overflow · compliance label.

Publish version/rule: Brand Lead nếu policy. Restore = version mới.

**Impact:** số project, số final snapshot cũ (không đổi), số draft/template bị ảnh hưởng.

---

## 10. MOD-CAL — Lịch xuất bản

**CAL-01:** month/week/list · filter channel, khách, project, approval · TZ mặc định `Asia/Ho_Chi_Minh` · override campaign/channel.

**CAL-02 Composer field (FR-CAL-002):** video_version_id (eligible) · channel · social_profile · scheduled_at · tz · copy · hashtag · thumbnail_asset_id · cta · utm_* · audience · compliance_label.

**Channel profile:** max/min ratio, duration, file size, codec, caption length. Fail → không schedule.

**Khóa publish nếu:** chưa `final_approved` · QC Blocked · rights expired · thiếu disclaimer bắt buộc.

**Status:** `draft, scheduled, publishing, published, failed, cancelled`.

**CAL-03 Gate bảng:** QC, Brand, Client, Legal, scheduled, lock reason.

**CAL-04 Monitor:** delivery, post URL, error, retry, history.

**CAL-05 Bulk:** nguồn batch/version list · calendar rule (n post/ngày/khung giờ) · exclude hàng lỗi · tạo N PublishItem + audit.

Reschedule / clone / cancel / retry + audit (FR-CAL-006).

W1 delivery: file export + Campaign Write. Connector native mô tả đủ; flag `CP_PUBLISH_NATIVE`.

---

## 11. MOD-RPT — Báo cáo

Filter (FR-RPT-001): khách, lifecycle, project, channel, range, model, template, creator.

**RPT-01 Executive:** 4 KPI kỳ · trend · funnel (views→landing→form→lead) **chỉ khi có ingest** · top creative · project health · insights (disclaimer không nhân quả).

**RPT-02 Production:** success, queue p95, render p95, approval cycle · heatmap model×ngày · failure class + retry success + recommendation · provider health.

**RPT-03 Credit:** donut used · charged/reserved/released · by pipeline (gen/batch/tts/export) · chargeback table allocated/charged/reserved/forecast/threshold · adjustment/invoice kind.

**RPT-04 Performance:** channel bars + source + freshness. Thiếu → `—` + “Thiếu nguồn”. Bảng template/format/style. Không bịa CTR.

**RPT-05 Governance:** brand pass · QC warning · rights 14 ngày · audit rows · policy outcome Allow/Review/Block · action list.

Export CSV/XLSX/PDF theo cap + audit (FR-RPT-005). Forecast ghi assumption (FR-RPT-006). Lưu report config (view).

---

## 12. MOD-SET — Cấu hình (map platform)

| Screen Nova | CP làm | Platform giữ |
|---|---|---|
| SET-01 Profile | locale UI module, TZ, default kit, quota display, retention ngày | Tên/logo tenant |
| SET-02 Members | **Project member** invite expiry + role CP | Staff invite / job function |
| SET-03 SSO | Link “Mở Admin SSO” | SAML/OIDC/SCIM |
| SET-04 Credit | Grant/allocate/alert 50/80/100, ledger | Không invoice SaaS |
| SET-05 Models | allowlist, max res/duration, cap, region, fallback | Secret vault |
| SET-06 Integrations | webhook CP, Campaign Write, Content OS, Hub | API key platform |
| SET-07 Security | retention, legal hold flag, signed URL TTL, audit query | IP allowlist / MFA |
| SET-08 Policy | moderation Block/Review/Allow, watermark, escalate | Không lộ rule nhạy ra client |

**FR-SET-001…010** giữ nghĩa; 003/004 identity = platform.

Credit kinds: `grant, reserve, charge, release, refund, adjustment, expiry`. Immutable. Idempotent.

---

## 13. Engine dùng chung

### 13.1. Approval

Condition → steps (sequential / parallel / quorum) → assign user/group → decision immutable → escalate theo SLA → unlock hoặc return changes.  
Sửa draft/version → invalidate nếu policy. Revoke cần lý do + cap.

### 13.2. Notification

In-app (+ email nếu platform bật). Slack/Teams = integration flag.  
Event tối thiểu: assign · mention · render done/fail · QC blocked · approval required/overdue · rights expiry · budget threshold · publish ok/fail.

### 13.3. Credit

`Estimate → pre-check budget → Reserve → Charge final → Release/refund → Ledger`.  
Mọi mutation idempotent. Chargeback client/project/cost center. Soft/hard. `render_high_cost` khi vượt ngưỡng.

---

## 14. Data model (cột)

```text
crm_cp_projects
  id, agency_client_id, lifecycle_id, owner_staff_id,
  name, industry, objective, start_at, due_at, status,
  credit_budget, cost_center, tags[], created_at, updated_at

crm_cp_project_members (project_id, staff_id, role)

crm_cp_briefs (id, project_id, version, body_json, approval_status, created_by)

crm_cp_deliverables
  id, project_id, type, status, owner_staff_id, due_at, priority,
  video_draft_id, video_version_id, vd_project_id, content_item_id

crm_cp_tasks
  id, project_id, title, assignee_id, due_at, priority, status,
  depends_on_id, am_task_id, csd_ticket_id

crm_cp_milestones (id, project_id, title, due_at, owner_id, status, depends_on_id)

crm_cp_video_drafts
  id, project_id, deliverable_id, name, input_mode, prompt, script_json,
  config_json, brand_kit_version_id, revision, autosaved_at

crm_cp_video_versions
  id, draft_id, version_n, snapshot_json, qc_status, qc_json,
  approval_status, immutable, output_uri, pricing_version

crm_cp_scenes (draft_id, idx, title, t_start, t_end, visual, vo, overlay, locked, qc)

crm_cp_render_jobs
  id, draft_id, parent_job_id, batch_item_id, state, stage, progress,
  provider, model, priority, idempotency_key UNIQUE, correlation_id,
  stage_log_json, error_class, attempt

crm_cp_templates (id, name, version, variables_json, rules_json, status)
crm_cp_batch_jobs / crm_cp_batch_items (row_json, mapping, status, error)

crm_cp_assets / crm_cp_asset_versions / crm_cp_asset_rights
crm_cp_asset_usages (asset_version_id, object_type, object_id)
crm_cp_collections / crm_cp_collection_items (smart_filter_json null)

crm_cp_brand_kits (scope_type, agency_client_id, project_id, status)
crm_cp_brand_kit_versions (kit_id, n, payload_json, approved_by, approved_at)
crm_cp_brand_rules (kit_version_id, condition_json, action_json, enforcement)

crm_cp_approvals (object_type, object_id, step, actor_id, decision, reason, at)
crm_cp_comments (object_type, object_id, timecode_ms, body, status, mention_ids[])

crm_cp_channel_profiles (channel, rules_json)
crm_cp_publish_items
  id, video_version_id, channel, profile_id, scheduled_at, tz,
  copy, hashtags, utm_json, status, post_ref, last_error

crm_cp_credit_ledger
  id, kind, amount, agency_client_id, project_id, job_id,
  cost_center, idempotency_key UNIQUE, created_at

crm_cp_activity (actor_id, action, resource_type, resource_id, payload_json, ip)
crm_cp_saved_views (staff_id, page, name, query_json, shared)
```

Completed version: `immutable=true` → API UPDATE 409.

---

## 15. API

Base `/api/crm/cp`. Auth staff. Cap + ABAC.

Idempotency bắt buộc: render, batch, publish, ledger. Cursor pagination. Correlation-id job.

| Method | Path | Màn |
|---|---|---|
| GET | `/overview/kpis` | OVR-01 |
| GET | `/overview/actions` | OVR-02 |
| GET | `/overview/health` | OVR-03 |
| GET | `/activity` | OVR-04 |
| GET/POST | `/projects` | PRJ-01/02 |
| GET/PATCH | `/projects/:id` | PRJ-03 |
| POST | `/projects/:id/close` | PRJ-08 |
| GET/POST | `/projects/:id/briefs` | Brief |
| GET/POST | `/projects/:id/deliverables` | |
| GET/POST | `/projects/:id/tasks` | |
| POST | `/projects/:id/submit-creative` | → Hub |
| GET/POST | `/videos` `/videos/:id` | VID |
| POST | `/videos/:id/render` | + Idempotency-Key |
| POST | `/videos/:id/scenes/:n/regenerate` | |
| PATCH | `/videos/:id/timeline` | revision |
| GET | `/renders` `/renders/:id` | VID-04 |
| POST | `/renders/:id/retry` `/cancel` | child job |
| GET/POST | `/videos/:id/comments` | |
| POST | `/videos/:id/approve` | |
| GET | `/videos/:id/compare?other=` | |
| GET/POST | `/templates` `/batches` | VID-06/07 |
| GET | `/versions/:id` | VID-08 |
| GET/POST | `/assets` | MED |
| GET | `/assets/:id` `/assets/:id/usage` | |
| POST | `/assets/:id/rights` | |
| GET/POST | `/collections` | |
| GET | `/assets/quality` | |
| GET/POST | `/brand-kits` `/brand-kits/:id/versions` `/rules` | |
| POST | `/brand-kits/:id/preview` | |
| GET/POST | `/publish-items` | CAL |
| POST | `/publish-items/:id/retry` | |
| POST | `/publish-items/bulk` | |
| GET | `/reports/:slug` | RPT |
| POST | `/reports/export` | audit |
| GET/PATCH | `/settings` | SET |
| POST | `/credits/grant` `/ledger` | finance |

Realtime: `GET /renders/:id/events` SSE.

### 15.1. Events

```
cp.video.draft.updated
cp.video.render.queued | progressed | completed | failed
cp.video.qc.completed
cp.video.approval.requested | decided
cp.asset.processing.completed
cp.asset.right.expiring
cp.brandkit.version.published
cp.batch.completed
cp.publish.scheduled | completed | failed
cp.credit.balance.changed
cp.budget.threshold.exceeded
```

---

## 16. Bảo mật, NFR, render

TLS + encryption at rest. IDOR. Signed URL TTL + download policy. MIME + scan + quarantine.  
Classification Public/Internal/Confidential/Restricted. Retention + legal hold.  
Consent voice/likeness — thiếu thì block. Moderation in + QC out, log an toàn.  
Không lộ moderation internals.

```
API → Video Orchestrator → Queue → workers
  ingest | script | scene | tts | compose | encode | qc | export
→ provider adapters → object storage → event/notify → metrics
```

DLQ, circuit breaker, fallback provider, at-least-once + idempotent consumer.  
p95 đọc theo SLO CRM. Render SLA công bố theo model — không cam kết phút tuyệt đối.  
Dashboard ops: queue depth, worker util, provider error, p50/p95, failed stage, ledger anomaly.  
Một systemd unit / loại worker.

---

## 17. Acceptance enterprise

1. Project → brief → draft → render → QC → review → Hub (nếu client) → PublishItem; lineage đủ snapshot.  
2. Rights hết / QC Blocked không export/publish.  
3. Sửa draft sau approve → invalidate.  
4. Completed version không đổi khi kit/asset sửa.  
5. Batch: validate, partial retry, error CSV, không charge trùng hàng.  
6. Queue priority/quota; duplicate idempotency không double charge.  
7. Report/dashboard theo scope.  
8. Đổi URL id không vượt scope.  
9. Download private cần auth/signed URL.  
10. Mutation nhạy có AuditLog.  
11. UI: 8 KPI, 8 nav, 1 `<main>`, `—` khi thiếu.  
12. Không portal CP mới.

---

## 18. Wave triển khai (thứ tự code — spec đủ hết)

| Wave | Ship |
|---|---|
| W1 | Shell, OVR-01/02, PRJ-01…04, DAM-01/03/05 cơ bản, BRK-01/02, VID-01/04 stub, ledger, activity, SET-04/05 |
| W2 | VID-02/03/05, QC, matrix, Hub submit, CAL-01…03, MED-02/version, BRK-03/04, Content OS ủy quyền generate |
| W3 | VID-06/07, MED-04/06, CAL-04/05 native flag, RPT-01…05 ingest, OVR-03 ops scale |
| W4 | A/B, routing, localization, agent gợi ý (vẫn human confirm) |

Prod: `CP_AI_ENABLED` unset đến UAT stub xanh.

---

## 19. Mockup SoT

| File | Screen |
|---|---|
| [rnosai-cp-os-srs-mockup.html](../../design/rnosai-cp-os-srs-mockup.html) | **Master** — nhảy đủ screen ID |
| [overview](../../design/rnosai-cp-os-overview-mockup.html) | OVR-01…04 |
| [projects](../../design/rnosai-cp-os-project-workspace-mockup.html) | PRJ-01…04 |
| [video](../../design/rnosai-cp-os-video-studio-mockup.html) | VID-01…08 |
| [media](../../design/rnosai-cp-os-media-dam-mockup.html) | MED-01…06 |
| [brand](../../design/rnosai-cp-os-brand-kit-mockup.html) | BRK-01…05 |
| [calendar](../../design/rnosai-cp-os-calendar-mockup.html) | CAL-01…05 |
| [reports](../../design/rnosai-cp-os-reports-mockup.html) | RPT-01…05 |
| [settings](../../design/rnosai-cp-os-settings-mockup.html) | SET map |

CSS: [rnosai-cp-os-mockup.css](../../design/rnosai-cp-os-mockup.css).

---

## 20. Traceability Nova → CP

Mọi `FR-OVR-*` … `FR-SET-*` và `FR-VID-001…033` **còn hiệu lực**, prefix triển khai `FR-CP-*` cùng số. Khác duy nhất: Workspace=PTT, Account=`agency_client`, Campaign=lifecycle, PRJ-05=Hub, SET-03=Admin.

---

## 21. Quyết định PO (từ Nova §20 — không chặn SoT)

| # | Câu hỏi | Khuyến nghị W1 |
|---|---|---|
| P1 | Throughput / concurrent | 5 slot, batch ≤50 hàng |
| P2 | Data residency | VN / object storage hiện có |
| P3 | AI provider | Stub đến khi PO chốt; multi-adapter |
| P4 | Soft vs hard cap | Soft 50/80, hard 100% |
| P5 | Ai duyệt | Brand → Client Hub → Legal nếu claim/giá |
| P6 | Retention | 365 ngày + legal hold |
| P7 | Publish native | File + Campaign Write; TikTok/Meta flag |
| P8 | CRM mapping batch | Lifecycle fields allowlist, không query builder tự do |

---

## 22. Self-review v2.0

- Không TBD trong FR Wave. Wave = lịch code.  
- v1 “7 nav / 6 KPI / cắt batch” đã sửa (8 nav / 8 KPI / batch SoT).  
- Mockup master: **45 screen** OVR×4 PRJ×4 VID×8 MED×6 BRK×5 CAL×5 RPT×5 SET×8. PRJ-05 = nút Hub, không portal.  
- Runtime cấm số sample.  
- Nova FR-OVR…SET + VID-001…033 + 3 engine + event + NFR đã port.

---

## 23. Plan triển khai

SoT code: [2026-09-07-creative-production-os.md](../plans/2026-09-07-creative-production-os.md) — 36 task, W1–W4, map 45 màn mockup.

Không bắt đầu Wave *n* khi UAT Wave *n−1* chưa xanh. `CP_AI_ENABLED` unset đến hết UAT W1 stub.
