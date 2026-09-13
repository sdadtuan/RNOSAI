# Software Requirements Specification

# PTT ImageOS — Enterprise Image SOP trên RNOSAI (Creative OS)

| Thuộc tính | Giá trị |
|---|---|
| Tên chiến lược | **PTT ImageOS** — AI Content Supply Chain cho ảnh tĩnh |
| Tên module RNOSAI | **Ảnh SOP** · Image SOP Studio |
| Mã tài liệu | SPEC-CP-IMAGE-SOP-2026-09-13 |
| Phiên bản | **2.2.0** — Winning Recipe + kế hoạch triển khai khóa (SRS §14) |
| Nguồn tham chiếu | `SRS_Enterprise_Image_SOP_AI_PTT_v2.md` · mockup `ptt-imageos-enterprise-srs-mockup.html` |
| Mockup SoT UI | [`docs/design/rnosai-cp-os-image-sop-mockup.html`](../../design/rnosai-cp-os-image-sop-mockup.html) |
| Cha | [Creative Production OS SRS v2.0](./2026-09-07-creative-production-os-srs.md) · [SPEC-CP-ACO-WIN v1.1](./2026-09-13-cp-ai-ops-provider-integration-srs.md) |
| Anh em | [Video SOP M7](./2026-08-20-video-sop-module-7-design.md) · [Magnific Flows B+](./2026-09-13-cp-magnific-flows-srs.md) · [Weave WIN](./2026-09-13-figma-weave-cp-integration-srs.md) |
| Prod | `https://rs.pttads.vn` · tenant **`PTT`** · UI tiếng Việt · empty **`—`** |
| Trạng thái | **Draft v2.2 — spec + plan triển khai; chưa code** |
| Flag mặc định | `CP_IMAGE_SOP_ENABLED=0` |

**Tuyên bố:** ImageOS **không** tạo platform thứ hai. Control plane nằm trong **`/crm/creative-os/image*`** + API **`/api/crm/cp/image/*`**. SoR = bảng `crm_cp_*` / `img_*`. Provider = Wave A–C (Weave, Magnific REST/MCP, Comfy) + adapter slot Video SOP (Flux/Leonardo) khi Admin bật. **Không** hard-code KPI — thiếu dữ liệu = `—`.

**Tuyên bố thắng chất lượng:** PTT **không** đua “một model đẹp nhất”. PTT thắng đối thủ (Midjourney + Drive/Zalo) bằng **đúng capability cho đúng ý định**, pipeline hoàn thiện (explore → chọn → refine → upscale → format pack), **khoá sản phẩm/logo thật**, QC thương mại tiếng Việt, và đo **First-Pass Approval + Cost per Approved Asset**.

---

## 0. Executive summary

### 0.1 North-star

> Mọi ảnh AI phải đúng brand, có chủ sở hữu, provenance, cost, trạng thái phê duyệt và khả năng tái tạo có kiểm soát.

### 0.2 Vòng lặp ImageOS trên RNOSAI

```text
Brief (crm_cp_briefs / img_projects.brief_json)
  → Brand snapshot (crm_cp_brand_kits)
  → Image SOP + recipe chọn (img_sop_versions)
  → Policy & cost guard (crm_cp_credit_ledger + GT-I*)
  → Provider route (Magnific / Comfy / Weave WO)
  → Quality (crm_cp_qc_* + img_quality_results)
  → Review / Hub (/crm/creatives)
  → Asset DAM (crm_cp_assets)
  → Handoff I2V / Video SOP / Calendar
```

### 0.3 Lợi thế so với tool rời

| Công cụ AI thông thường | PTT ImageOS trên RNOSAI |
|---|---|
| Generate + tải file | Job async + ingest bytes + ledger |
| Prompt text box | Prompt Package versioned (`crm_cp_prompt_packages`) |
| Brand preset | Brand Kit snapshot + rules (`crm_cp_brand_kits`) |
| 1 provider | Router Magnific REST/MCP · Comfy · Weavy WO |
| Gallery provider | `crm_cp_assets` + provenance |
| Không audit | `crm_cp_audit` + gate logs |
| 1 prompt → 1 ảnh | Recipe 6 stage: Explore → Select → Refine → Upscale → Pack → QC |
| Model vẽ logo/CTA | Composite lockup chính thức (GT-I09) |
| 1 tỉ lệ | Format pack 1:1 · 4:5 · 9:16 · 16:9 từ 1 master |

### 0.4 Ba hướng — chốt **C (Recipe Pipeline)**

| | A — Một model “best” | B — Multi-provider generate rồi tải | **C — Intent→Recipe (chốt)** |
|---|---|---|---|
| Làm | Khoá Magnific/Flux cho mọi job | Cho user chọn tool | SOP compile capability theo **intent** + 6 stage |
| Thắng ai | Không — đối thủ cũng có Midjourney | Không — vẫn Drive | Agency Midjourney+Zalo; studio Comfy trần; chat Magnific |
| Rủi ro | Text/logo sai; 1 tỉ lệ | Không provenance | Phức tạp hơn 1 nút Generate |
| Phù hợp PTT | Thua chất lượng bàn giao | Thua vận hành | Thắng **ảnh duyệt được** |

**Chốt C.** Model chỉ là worker. SOP sở hữu recipe.

### 0.5 Winning pipeline (SoT vận hành — bắt buộc trên IMG-03 / modal)

```text
Brief + refs (sản phẩm · style · pose · lockup logo)
  → Prompt Package 7 lớp (FR-003)
  → EXPLORE     2–4 variants · images_generate | Weave
  → SELECT      Art Director chọn winner (crm_img.gate1)
  → REFINE      edit / product lock / logo overlay
  → UPSCALE     Magnific images_upscale (allowlist thật)
  → FORMAT PACK 1:1 · 4:5 · 9:16 · 16:9 + safe-zone
                images_crop / images_resize | local sharp
  → QC profile  7 chiều → G2 / G3 → DAM → Hub / I2V
```

Cấm skip `SELECT` trước `REFINE` (GT-I11). Cấm G3 khi chưa có format pack (GT-I10) trừ waiver Legal.

### 0.6 Intent taxonomy → capability RNOSAI **thật**

| Intent | Khi nào | Capability / adapter **đã có** | Fallback vận hành |
|---|---|---|---|
| `hero_lifestyle` | KV, lifestyle, mood | Magnific `images_generate` | Weave Work Order |
| `product_lock` | Packshot, SKU, nhãn | ComfyUI packshot (khi GPU) | Generate + Weave refine |
| `text_cta` | Chữ / CTA / logo trên ảnh | **Không** tin model vẽ brand | Overlay lockup `crm_cp_brand_kits` |
| `upscale_print` | Master in / 4K–8K | Magnific `images_upscale` | Block nếu REST off |
| `bg_cutout` | PNG trong suốt | Magnific `images_remove_background` | Comfy / Weave |
| `format_pack` | Multi-ratio ads | Magnific `images_crop` + `images_resize` | Sharp nội bộ |
| `human_art` | Art direction, food, luxury | Weave WO | — |
| `i2v_handoff` | Keyframe → clip | Magnific Flow / Weave I2V | Sau G2 |

**Adapter slot (không fake live trên UI):** Flux Replicate + Leonardo (Video SOP M7), OpenAI/Flux (CMKT). Chỉ hiện khi `crm_cp_provider_connections` + flag on. UI ghi `—` / “Chưa kết nối”.

---

## 1. Tích hợp hệ thống (khóa)

### 1.1 Vị trí trong RNOSAI

| Lớp | RNOSAI thực tế | ImageOS dùng |
|---|---|---|
| CRM khách | `agency_client` / `clients` | `agency_client_id` bắt buộc |
| Campaign | `service_lifecycle` | `service_lifecycle_id` |
| CP Project | `crm_cp_projects` | `cp_project_id` nullable |
| Brief | `crm_cp_briefs` | copy one-way → `img_projects` |
| Task | `crm_cp_tasks` | link optional |
| DAM | `crm_cp_assets` | output master |
| Job render | `crm_cp_render_jobs` | execution qua adapter CP |
| Provider run | `crm_cp_provider_runs` | `tool_or_workflow` = `image_sop:{code}@v{n}` |
| Credit | `crm_cp_credit_ledger` | reserve/charge/release |
| Duyệt khách | Creative Hub | `POST /creatives` — không portal ImageOS riêng |
| Video người | `/crm/video` | handoff keyframe only |
| I2V | AI Ops Magnific/Weave | handoff sau G2 |

### 1.2 UI & route (Q1 CP OS)

| Hạng mục | Giá trị |
|---|---|
| Hub | `/crm/creative-os/image` → **IMG-01** |
| Sub-routes | `/crm/creative-os/image/{section}` — xem §6 |
| Tab project | `/crm/creative-os/projects/[id]?tab=image-sop` |
| Nav CP OS | Mục **#9 Ảnh SOP** (CP OS v2.1) |
| Class CSS | `cp-img-*` trong `cp.css` |
| Theme | Navy `#0F2747` · accent `#2563EB` · Be Vietnam Pro — **cùng CP OS**, không dark theme riêng |

### 1.3 API prefix

**SoT:** `/api/crm/cp/image/*` (Nest `CpImageSopModule` trong `ptt-crm-api`).

Không dùng `/api/v1` generic — giữ prefix CRM CP như Wave A–C.

### 1.4 Flag & env

```
CP_IMAGE_SOP_ENABLED=0          # ẩn hub + API 404 image_sop_disabled
CP_IMAGE_SOP_ROUTER=manual      # manual | recommended (v2: auto)
CP_IMAGE_SOP_BATCH_MAX=30
CP_IMAGE_SOP_VARIANT_MAX=4
IMG_JOB_WAIT_MS=120000
IMG_JOB_POLL_MS=4000
# Kế thừa provider:
PTT_WEAVE=0
MAGNIFIC_REST_API_ENABLED=0
MAGNIFIC_MCP_ENABLED=0
MAGNIFIC_FLOWS_ENABLED=0
COMFYUI_WORKER_ENABLED=0
PTT_SECRET_ENCRYPT_KEY=          # bắt buộc lưu Magnific REST
```

### 1.5 RBAC — section `crm_img`

| Cap | Việc |
|---|---|
| `crm_img.view` | Hub, catalog, read-only |
| `crm_img.edit` | Task, brief, frame |
| `crm_img.sop` | SOP composer, publish staging |
| `crm_img.render` | Draft/submit job |
| `crm_img.render_high_cost` | Vượt ngưỡng credit |
| `crm_img.gate1` / `gate2` / `gate3` | Approve cổng |
| `crm_img.finance` | FinOps dashboard |
| `crm_img.manage` | Provider policy, audit export |
| `crm_img.admin` | SOP production publish |

Map từ `crm_cp.*`: **không** tự động — Admin gán explicit.

---

## 2. Ranh giới module

### 2.1 In scope v2 (theo mockup 11 màn)

| # | Capability | Màn mockup |
|---|---|---|
| 1 | Executive dashboard KPI | IMG-01 |
| 2 | Creative Operations board | IMG-02 |
| 3 | Image Job orchestrator | IMG-03 |
| 4 | Asset Intelligence (DAM + provenance) | IMG-04 |
| 5 | Review & Approval Studio | IMG-05 |
| 6 | Enterprise SOP Registry | IMG-06 |
| 7 | SOP Composer (12 bước → wizard 6 step v1) | IMG-07 |
| 8 | Brand Knowledge Graph v1 | IMG-08 |
| 9 | Multi-provider Router v1 | IMG-09 |
| 10 | AI FinOps (ledger + margin) | IMG-10 |
| 11 | Governance & Audit | IMG-11 |
| 12 | Winning pipeline + Intent→capability (panel, không thêm nav) | IMG-01 · 03 · 07 · 09 · modal |

### 2.2 Out of scope v2 baseline

| Hạng mục | Lý do |
|---|---|
| Marketplace SOP public | Phase E |
| Browser automation Weave | Q-W2 |
| Full ABAC engine | v2.1 — v2 dùng RBAC + policy JSON |
| Performance attribution causal | Chỉ correlation + disclaimer |
| Stock Magnific 250M browse | Magnific web |
| Vector RAG brand | Wave D |
| App/portal ImageOS tách | Q1 CP OS |

### 2.3 Ma trận không trùng module khác

| | **ImageOS** | **Video SOP** | **Magnific pane** | **CMKT image_generate** |
|---|---|---|---|---|
| Đơn vị | `img_projects` | `vd_projects` | `crm_cp_render_jobs` | content item |
| Output | Still | Keyframe + clip | 1 job ad-hoc | 1 post asset |
| Gates | G1–G3 image | G1–G4 cinematic | 0 | 0 |
| UI | `/crm/creative-os/image` | `/crm/video` | `?tab=ai-ops&pane=magnific` | Content Board |

---

## 3. Quy tắc dữ liệu thực (bắt buộc)

| Quy tắc | Áp dụng |
|---|---|
| **D-01** | UI **cấm** hard-code KPI (86 video, 1284 assets…). Query API hoặc `—`. |
| **D-02** | Mockup HTML ghi chú **SoT query** / endpoint cho từng tile. |
| **D-03** | Pilot client **Nova** · lifecycle **mid-autumn-2026** — tên từ runbook Magnific/Weave, không fictitious brand. |
| **D-04** | Provider health = `GET /api/crm/cp/provider-health` + env flags thật. |
| **D-05** | Credit = `SUM(crm_cp_credit_ledger)` filter `source LIKE 'image_sop%'`. |
| **D-06** | Asset card = row `crm_cp_assets` + join provenance. |
| **D-07** | SOP card = `img_sop_versions` / map `crm_cp_provider_template_map` `execution_kind=image_sop`. |
| **D-08** | Router preview chỉ liệt kê capability trong allowlist Magnific / flag Comfy / Weave — **cấm** hiện “Flux Healthy” khi chưa có connection. |
| **D-09** | QC score = `img_quality_results.scores_json` hoặc `—`. Cấm hard-code 96/89. |
| **D-10** | Winner / format pack = `img_frames.winner_asset_id` + `format_pack_json` join `crm_cp_assets`. |

---

## 4. Entity & DDL

### 4.1 Bảng mới (prefix `img_` — sibling `vd_`)

```sql
-- Registry SOP-as-Code
CREATE TABLE IF NOT EXISTS img_sop_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  risk_tier TEXT NOT NULL DEFAULT 'MEDIUM',
  data_class TEXT NOT NULL DEFAULT 'INTERNAL',
  owner_staff_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS img_sop_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES img_sop_registry(id),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_package_id UUID REFERENCES crm_cp_prompt_packages(id),
  quality_profile_key TEXT,
  routing_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  UNIQUE (sop_id, version)
);

-- Creative task / project
CREATE TABLE IF NOT EXISTS img_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  cp_project_id UUID REFERENCES crm_cp_projects(id),
  agency_client_id INT NOT NULL,
  service_lifecycle_id UUID,
  sop_version_id UUID REFERENCES img_sop_versions(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  brand_kit_id UUID,
  brand_kit_version INT,
  g1_at TIMESTAMPTZ, g2_at TIMESTAMPTZ, g3_at TIMESTAMPTZ,
  created_by_staff_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES img_projects(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  variant_target INT NOT NULL DEFAULT 2,
  intent TEXT NOT NULL DEFAULT 'hero_lifestyle',
  creative_genome_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  master_asset_id UUID REFERENCES crm_cp_assets(id),
  winner_asset_id UUID REFERENCES crm_cp_assets(id),
  format_pack_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES img_projects(id),
  frame_id UUID REFERENCES img_frames(id),
  cp_render_job_id UUID REFERENCES crm_cp_render_jobs(id),
  provider TEXT NOT NULL,
  route_decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL DEFAULT 'DRAFT',
  estimate_credits INT,
  output_asset_id UUID REFERENCES crm_cp_assets(id),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_job_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES img_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  -- explore | select | refine | upscale | pack | qc
  sort_order INT NOT NULL DEFAULT 0,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING',
  input_asset_ids UUID[] NOT NULL DEFAULT '{}',
  output_asset_id UUID REFERENCES crm_cp_assets(id),
  cp_render_job_id UUID REFERENCES crm_cp_render_jobs(id),
  estimate_credits INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_gate_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES img_projects(id),
  gate_num INT NOT NULL CHECK (gate_num BETWEEN 1 AND 3),
  action TEXT NOT NULL,
  actor_staff_id INT NOT NULL,
  checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_quality_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES crm_cp_assets(id),
  profile_key TEXT NOT NULL,
  scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS img_brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id UUID NOT NULL,
  rule_key TEXT NOT NULL,
  enforcement TEXT NOT NULL,
  rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

### 4.2 Kế thừa không duplicate

| Bảng CP | ImageOS dùng |
|---|---|
| `crm_cp_assets` | Master output |
| `crm_cp_render_jobs` | Provider execution |
| `crm_cp_provider_runs` | External run id |
| `crm_cp_provider_connections` | Magnific OAuth/REST |
| `crm_cp_credit_ledger` | FinOps |
| `crm_cp_prompt_packages` | Prompt Intelligence |
| `crm_cp_brand_kits` | Brand Graph v1 |
| `crm_cp_weave_work_orders` | Weavy human flow |
| `crm_cp_audit` | Governance feed |

---

## 5. Catalog màn hình (map mockup → IMG)

| Mockup ID | Tên mockup | Route RNOSAI | Screen ID |
|---|---|---|---|
| `home` | Executive Dashboard | `/crm/creative-os/image` | **IMG-01** |
| `tasks` | Creative Operations | `/crm/creative-os/image/operations` | **IMG-02** |
| `jobs` | Image Job Orchestrator | `/crm/creative-os/image/jobs` | **IMG-03** |
| `assets` | Asset Intelligence | `/crm/creative-os/image/assets` | **IMG-04** |
| `review` | Review & Approval | `/crm/creative-os/image/review/[assetId]` | **IMG-05** |
| `sops` | SOP Registry | `/crm/creative-os/image/sops` | **IMG-06** |
| `composer` | SOP Composer | `/crm/creative-os/image/sops/new` | **IMG-07** |
| `brand` | Brand Knowledge Graph | `/crm/creative-os/image/brand/[kitId]` | **IMG-08** |
| `providers` | Provider Router | `/crm/creative-os/image/providers` | **IMG-09** |
| `finops` | AI FinOps | `/crm/creative-os/image/finops` | **IMG-10** |
| `governance` | Governance & Audit | `/crm/creative-os/image/governance` | **IMG-11** |

Modal **Create Image Job** → component `CpImageJobComposerModal` — gọi `POST /api/crm/cp/image/jobs/draft`.

Mọi màn **giữ đủ 11** như mockup gốc. v2.1 **bổ sung panel** (không thêm nav):

| Panel | Nằm trên | Việc thắng đối thủ |
|---|---|---|
| Winning Pipeline strip | IMG-01, IMG-03, modal | 6 stage + SoT capability |
| Intent router matrix | IMG-09 | Intent → allowlist thật |
| Creative Genome | IMG-07 bước 3 | composition · light · color · subject · CTA zone |
| Format pack grid | IMG-04, IMG-05 | 4 tỉ lệ từ 1 winner |
| QC 7 chiều | IMG-05 | + Text/CTA VN + Delivery |

---

## 6. API (REST) — tóm tắt

| Method | Path | Màn |
|---|---|---|
| GET | `/image/dashboard/kpis` | IMG-01 |
| GET | `/image/operations/board` | IMG-02 |
| GET/POST | `/image/jobs` | IMG-03 |
| POST | `/image/jobs/draft` | Modal |
| POST | `/image/jobs/:id/submit` | GT-I04 confirm |
| GET | `/image/assets` | IMG-04 |
| GET | `/image/assets/:id/provenance` | IMG-04 timeline |
| GET/POST | `/image/review/:assetId` | IMG-05 |
| GET/POST | `/image/sops` | IMG-06 |
| POST | `/image/sops/:id/versions` | IMG-07 |
| GET | `/image/brand/:kitId/graph` | IMG-08 |
| GET | `/image/providers/router/preview` | IMG-09 |
| GET | `/image/finops/summary` | IMG-10 |
| GET | `/image/governance/audit` | IMG-11 |
| GET | `/image/intents` | Taxonomy §0.6 + health capability |
| GET | `/image/recipes/preview` | Compile stage từ SOP + intent + flags |
| POST | `/image/jobs/:id/explore` | Stage EXPLORE |
| POST | `/image/jobs/:id/select` | Body `{ winner_asset_id }` · GT-I11 |
| POST | `/image/jobs/:id/refine` | Product lock / Weave / overlay |
| POST | `/image/jobs/:id/upscale` | `images_upscale` |
| POST | `/image/jobs/:id/pack` | crop/resize pack · GT-I10 |

Tất cả route yêu cầu `CP_IMAGE_SOP_ENABLED=1` + cap `crm_img.view` (hoặc cụ thể hơn). Stage tốn credit = `crm_img.render` + GT-I04.

---

## 7. Provider routing v2.1 — Intent trước, provider sau

Hard constraints (server-side, **trước** scoring):

```text
RESTRICTED → ComfyUI private only (COMFYUI_WORKER_ENABLED=1)
Thiếu magnific_rest connection → không route Magnific REST
MAGNIFIC_MCP_ENABLED=0 → không route MCP
PTT_WEAVE=0 → không tạo Work Order
Budget ≥ threshold → block hoặc finance override
Intent text_cta → cấm images_generate làm nguồn logo/CTA (GT-I09)
Capability không nằm MAGNIFIC_PILOT_CAPABILITIES → 409 mcp_tool_unavailable
```

Scoring (sau khi pass hard): **quality-fit intent > first-pass lịch sử SOP > cost > SLA > capacity**. AUTO-route tốn tiền = Wave D; v2.1 = `RECOMMENDED` + confirm.

Allowlist Magnific **đã ship** (`cp-magnific-policy.util.ts`):

`account_balance` · `images_generate` · `images_upscale` · `images_remove_background` · `images_crop` · `images_resize` · `video_generate` · status/wait/get.

### 7.1 Flagship SOP (seed — recipe 6 stage)

| code | Intent chính | Recipe (capability thật) |
|---|---|---|
| `PTT-IMG-KV-45` | `hero_lifestyle` | generate → select → refine(Weave optional) → upscale → pack 4:5/9:16 → QC `brand_kv_v1` |
| `PTT-IMG-SOCIAL-916` | `hero_lifestyle` + pack | generate 9:16 → select → upscale → pack 4:5/1:1 → QC `social_cta_vn_v1` |
| `PTT-IMG-PACKSHOT-11` | `product_lock` | Comfy packshot **hoặc** generate+Weave refine → bg_cutout → pack 1:1 → QC `product_fidelity_v2` |
| `PTT-IMG-FOOD-WEAVE` | `human_art` | Weave WO → ingest → upscale → pack → QC brand |
| `PTT-IMG-MASTER-UPSCALE` | `upscale_print` | Chỉ `images_upscale` từ master đã G2 |

`manifest_json.recipe_stages[]` = `{ stage, capability, provider, required, estimate_credits }`.

### 7.2 Prompt Intelligence — 7 lớp (compile trước EXPLORE)

```text
L1 Safety/system     — cấm NSFW / PII / competitor
L2 Org creative      — PTT commercial still policy
L3 Brand             — snapshot crm_cp_brand_kits + img_brand_rules
L4 Campaign          — lifecycle mid-autumn-2026 direction
L5 SOP task          — intent + output contract
L6 User / brief      — biến số Art Director
L7 Provider syntax   — chỉ adapter (không lộ lên client)
```

**Creative Genome** (`img_frames.creative_genome_json`): `composition` · `light` · `color` · `subject` · `style` · `cta_zone` · `motion_hint` (handoff I2V). Genome khoá tại G1.

### 7.3 Quality Intelligence — 7 chiều (IMG-05)

| Chiều | Kiểm | Fail → |
|---|---|---|
| Technical | checksum, ratio, res min, artifact | QUALITY_REJECTED |
| Product fidelity | nhãn, số lượng SKU, hình khối vs ref | Refine / Comfy |
| Brand fit | palette, cấm, style genome | Block G2 |
| Creative fit | hierarchy, subject, whitespace CTA | Revision |
| **Text / CTA VN** | OCR chữ; logo = lockup official | GT-I09 overlay |
| Compliance | claim, mặt người, trademark | Legal G3 |
| Delivery | tên file convention CP, metadata, tỉ lệ kênh | GT-I10 pack |

Quyết định: `PASS` · `WARN` · `FAIL` · `ESCALATE`. Điểm tổng = báo cáo, **không** là cổng (khóa ACO-WIN).

---

## 8. Gates & job state machine

### 8.1 Ba cổng (v2)

| Gate | Ai | Block |
|---|---|---|
| G1 Prompt + Genome + SOP lock | Art Director · `crm_img.gate1` | Explore / submit render |
| G2 Visual master | Brand · `crm_img.gate2` | Enhance / handoff |
| G3 Legal + rights | Legal/Producer · `crm_img.gate3` | Hub submit |

### 8.2 Job states (rút gọn enterprise)

```text
DRAFT → POLICY_EVAL → PENDING_CONFIRM → COST_RESERVED → ROUTING →
EXPLORE → SELECT → REFINE → UPSCALE → PACK →
QUEUED/PROCESSING per stage → INGEST → QUALITY →
INTERNAL_REVIEW → CLIENT_REVIEW → APPROVED → DELIVERED
```

Mỗi stage = 1 hàng `img_job_stages` + optional `crm_cp_render_jobs`. Exception: `POLICY_BLOCKED`, `BUDGET_EXCEEDED`, `PROVIDER_FAILED`, `QUALITY_REJECTED`, `STAGE_SKIP_FORBIDDEN`.

---

## 9. Governance targets (GT)

| GT | Mô tả |
|---|---|
| GT-I01 | Flag off → 404 |
| GT-I02 | G1 chưa pass → render blocked |
| GT-I03 | G2 locked → no new generate |
| GT-I04 | Submit without confirm → 400 |
| GT-I05 | Insufficient credit → 402 |
| GT-I06 | Hub before G3 → 422 |
| GT-I07 | Zero API key in browser Network |
| GT-I08 | RESTRICTED → external provider blocked |
| GT-I09 | Logo/CTA từ model generate → 422 trừ waiver Brand Admin; bắt overlay lockup |
| GT-I10 | G3 / Hub khi `format_pack_json` thiếu tỉ lệ hợp đồng → 422 |
| GT-I11 | REFINE/UPSCALE khi chưa SELECT winner → 409 |

---

## 10. Wave triển khai (RNOSAI)

| Wave | Tuần | Deliverable | Exit |
|---|---|---|---|
| **I0** | 1–2 | DDL + flag + hub shell IMG-01 (KPI `—` OK) | Gate DDL |
| **I1** | 3–4 | IMG-03 jobs + Magnific REST ingest + **explore/select** | 1 job E2E Nova + winner |
| **I2** | 5–6 | IMG-02 board + G1–G3 + IMG-05 review | UAT 3 gate |
| **I3** | 7–8 | IMG-06/07 SOP registry + composer draft | 1 SOP staging |
| **I4** | 9–10 | IMG-08 brand rules + IMG-09 router preview | Policy block test |
| **I5** | 11–12 | IMG-04 provenance + IMG-10 finops + IMG-11 audit | FinOps từ ledger |
| **I6** | 13+ | Weave WO + Comfy batch + upscale/pack + I2V | Pilot mid-autumn |

**Phụ thuộc hiện tại VPS (2026-09-13):** code Wave B+ deployed; `MAGNIFIC_FLOWS_ENABLED=0`; `crm_cp_provider_connections` empty — ImageOS I1 cần REST key + seed SOP.

---

## 11. UAT 15 phút (staging)

| # | Việc |
|---|---|
| 1 | `CP_IMAGE_SOP_ENABLED=0` → menu ẩn |
| 2 | Bật flag + tạo img_project Nova |
| 3 | G1 → draft job → submit không confirm → 400 |
| 4 | Confirm explore → chọn winner → refine/upscale/pack |
| 5 | GT-I09: job `text_cta` không overlay → 422 |
| 6 | G2 master → G3 thiếu pack → 422; đủ pack → Hub |
| 7 | FinOps 1 dòng ledger / stage |
| 8 | Audit event gate pass |
| 9 | Network 0 secret |

---

## 12. Liên kết tài liệu

| Tài liệu | Việc |
|---|---|
| [Mockup HTML](../../design/rnosai-cp-os-image-sop-mockup.html) | SoT UI — 11 màn + modal + pipeline |
| [Plan TDD](../plans/2026-09-13-cp-image-sop.md) | Task checkbox · subagent-driven |
| [cp-magnific-flows runbook](../../runbooks/cp-magnific-flows.md) | Handoff I2V |
| [cp-ai-ops-vps-uat](../../runbooks/cp-ai-ops-vps-uat.md) | Provider flags |
| SOP user | `docs/huong-dan-su-dung/40-image-sop-studio.md` *(Task 18)* |

---

## 13. Cổng duyệt spec v2.2

| # | Tiêu chí | Trạng thái |
|---|---|---|
| 1 | 11 màn mockup + panel pipeline/intent/QC | ✅ |
| 2 | Tích hợp CP OS Q1–Q19 | ✅ |
| 3 | Quy tắc dữ liệu thực D-01…D-10 | ✅ |
| 4 | DDL + API + RBAC + GT-I09…I11 | ✅ |
| 5 | Capability = allowlist Magnific + Weave + Comfy — không provider ảo | ✅ |
| 6 | Kế hoạch triển khai §14 khóa file/task/UAT | ✅ |
| 7 | PO sign-off | ☐ |

**Cổng code:** PO duyệt §13 → thực hiện [plan TDD](../plans/2026-09-13-cp-image-sop.md) task-by-task → `CP_IMAGE_SOP_ENABLED=0` trên prod đến UAT §11 pass.

---

## 14. Kế hoạch triển khai (khóa — ứng dụng thực tế)

> SoT kỹ thuật từng bước checkbox: [2026-09-13-cp-image-sop.md](../plans/2026-09-13-cp-image-sop.md). Mục này khóa **file, UI, SQL, API, dữ liệu, UAT, VPS**. Không triển khai ngoài map này.

### 14.1 Ràng buộc toàn cục

| # | Khóa |
|---|---|
| G1 | Prefix API `/api/crm/cp/image/*` trong `CpController` hoặc `CpImageController` `@Controller('api/crm/cp/image')`. Cấm `/api/v1`. |
| G2 | Flag `CP_IMAGE_SOP_ENABLED=0` mặc định. Off → API `{ error: 'image_sop_disabled' }` **404** (GT-I01). Nav ẩn. |
| G3 | UI = mockup [`rnosai-cp-os-image-sop-mockup.html`](../../design/rnosai-cp-os-image-sop-mockup.html): 11 màn + modal + pipeline + intent + QC 7 chiều. Class `cp-img-*`. Theme CP OS (`cp.css` navy `#0F2747` · accent `#2563EB` · Be Vietnam Pro). |
| G4 | Empty = `dash()` → `—`. Cấm hard-code KPI / “Healthy 99%” / USD. D-01…D-10. |
| G5 | Tenant `PTT`. Pilot tên **nova** + lifecycle **mid-autumn-2026** (runbook Weave). Seed SOP không invent brand Lumi/Maison. |
| G6 | Reuse `CpJobsService` + Magnific adapter cho stage tốn provider. Không clone render worker. |
| G7 | Capability ngoài `MAGNIFIC_PILOT_CAPABILITIES` → 409. Flux/Leonardo **không** hiện khi chưa có `crm_cp_provider_connections`. |
| G8 | Secret không xuống browser. Credit = `crm_cp_credit_ledger` `source LIKE 'image_sop%'`. |
| G9 | Prod `rs.pttads.vn` giữ flag 0 đến UAT staging pass. |
| G10 | TDD: test đỏ → code → xanh → commit. Mỗi task tự test được. |

### 14.2 File map

| File | Task | Việc |
|---|---|---|
| `docs/specs/2026-09-13-postgresql-ddl-cp-image-sop.sql` | 1 | DDL `img_*` + index + seed SOP |
| `scripts/apply_pg_ddl_cp_image_sop.sh` | 1 | `psql -v ON_ERROR_STOP=1` |
| `scripts/seed_cp_image_sop_nova.sh` | 1 | Bind SOP → `agency_client` Nova nếu tồn tại; không thì skip + log |
| `services/ptt-crm-api/src/cp/cp-image-sop.flags.ts` | 2 | `readImageSopFlags` |
| `services/ptt-crm-api/src/cp/cp-image-sop.types.ts` | 2 | Intent, stage, DTO |
| `services/ptt-crm-api/src/cp/cp-image-sop-intents.util.ts` | 2 | Taxonomy §0.6 |
| `services/ptt-crm-api/src/cp/cp-image-sop-recipe.util.ts` | 2 | `compileRecipe` |
| `services/ptt-crm-api/src/cp/cp-image-sop-gates.util.ts` | 2 | GT-I09…I11 |
| `services/ptt-crm-api/src/cp/guards/staff-img.guard.ts` | 3 | `crm_img.*` |
| `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` | 3 | Section catalog |
| `services/ptt-crm-api/src/cp/cp-image-sop.repository.ts` | 4 | SQL img_* |
| `services/ptt-crm-api/src/cp/cp-image-sop.service.ts` | 5–10 | Dashboard, board, jobs, SOP, brand, finops |
| `services/ptt-crm-api/src/cp/cp-image.controller.ts` | 11 | Routes |
| `services/ptt-crm-api/src/cp/cp.module.ts` | 11 | Register |
| `services/ops-web/src/lib/crm/cp-image-sop.flags.ts` | 12 | Client flag |
| `services/ops-web/src/lib/crm/cp-image-sop-nav.util.ts` | 12 | Subnav 11 mục + route |
| `services/ops-web/src/lib/crm/cp-image-sop-api.ts` | 12 | `cpFetch` `/image/*` |
| `services/ops-web/src/lib/crm/cp-nav.util.ts` | 12 | Thêm **Ảnh SOP** sau Video AI |
| `services/ops-web/src/lib/crm/cp-project-tabs.util.ts` | 12 | Tab `image-sop` |
| `services/ops-web/src/lib/rbac-routes.ts` | 12 | `/crm/creative-os/image` + `crm_img.view` |
| `services/ops-web/src/components/crm/cp/CpImageShell.tsx` | 13 | Subsidebar mockup |
| `services/ops-web/src/components/crm/cp/CpImageHome.tsx` | 13 | IMG-01 |
| `services/ops-web/src/components/crm/cp/CpImageOperations.tsx` | 14 | IMG-02 |
| `services/ops-web/src/components/crm/cp/CpImageJobs.tsx` | 14 | IMG-03 |
| `services/ops-web/src/components/crm/cp/CpImageJobModal.tsx` | 14 | Modal recipe |
| `services/ops-web/src/components/crm/cp/CpImageAssets.tsx` | 15 | IMG-04 |
| `services/ops-web/src/components/crm/cp/CpImageReview.tsx` | 15 | IMG-05 |
| `services/ops-web/src/components/crm/cp/CpImageSops.tsx` | 16 | IMG-06 |
| `services/ops-web/src/components/crm/cp/CpImageComposer.tsx` | 16 | IMG-07 |
| `services/ops-web/src/components/crm/cp/CpImageBrand.tsx` | 17 | IMG-08 |
| `services/ops-web/src/components/crm/cp/CpImageProviders.tsx` | 17 | IMG-09 |
| `services/ops-web/src/components/crm/cp/CpImageFinops.tsx` | 17 | IMG-10 |
| `services/ops-web/src/components/crm/cp/CpImageGovernance.tsx` | 17 | IMG-11 |
| `services/ops-web/src/app/crm/creative-os/image/**/page.tsx` | 13–17 | Next routes |
| `services/ops-web/src/app/crm/creative-os/cp.css` | 13 | `cp-img-*` |
| `services/ops-web/e2e/cp-image-sop.spec.ts` | 18 | Playwright flag/nav/empty |
| `docs/huong-dan-su-dung/40-image-sop-studio.md` | 18 | User guide |

### 14.3 Hợp đồng UI (mockup = SoT)

Nav CP OS **chèn sau Video AI** (đúng mockup, không đợi “mục #9” trừu tượng):

`Tổng quan → Dự án → Video AI → Ảnh SOP → Thư viện → Brand Kit → Lịch → Báo cáo → Cấu hình`

Subnav trái (11 nút, id giữ nguyên mockup):

| `data-page` | Route | Component | API bắt buộc |
|---|---|---|---|
| home | `/crm/creative-os/image` | `CpImageHome` | `GET /image/dashboard/kpis` · `GET /image/intents` |
| tasks | `.../image/operations` | `CpImageOperations` | `GET /image/operations/board` |
| jobs | `.../image/jobs` | `CpImageJobs` + modal | `GET /image/jobs` · draft/explore/select… |
| assets | `.../image/assets` | `CpImageAssets` | `GET /image/assets` · provenance |
| review | `.../image/review/[assetId]` | `CpImageReview` | `GET/POST /image/review/:assetId` |
| sops | `.../image/sops` | `CpImageSops` | `GET /image/sops` |
| composer | `.../image/sops/new` | `CpImageComposer` | `POST /image/sops` |
| brand | `.../image/brand/[kitId]` | `CpImageBrand` | `GET /image/brand/:kitId/graph` |
| providers | `.../image/providers` | `CpImageProviders` | `GET /image/providers/router/preview` |
| finops | `.../image/finops` | `CpImageFinops` | `GET /image/finops/summary` |
| governance | `.../image/governance` | `CpImageGovernance` | `GET /image/governance/audit` |

Panel bắt buộc trên đúng màn (không thêm nav):

| Panel class | Màn | Dữ liệu |
|---|---|---|
| `.cp-img-win` | IMG-01 | Copy winning — không số ảo |
| `.cp-img-pipe` | IMG-01, IMG-03, modal | 6 stage từ `GET /image/recipes/preview` |
| `.cp-img-intents` | IMG-09 | `GET /image/intents` + health thật |
| `.cp-img-genome` | IMG-07 | `creative_genome_json` |
| `.cp-img-pack` | IMG-04, IMG-05 | `format_pack_json` hoặc `—` |
| `.cp-img-qc` | IMG-05 | 7 chiều `scores_json` hoặc `—` |

Tab project: `/crm/creative-os/projects/[id]?tab=image-sop` mount `CpImageOperations` lọc `cp_project_id`.

### 14.4 Hợp đồng dữ liệu thực

| UI | SoT | Khi trống |
|---|---|---|
| KPI approved / cycle / cost / first-pass | `GET /image/dashboard/kpis` SQL §3 | `—` |
| Credit footer | `GET /api/crm/cp` credit hiện có | `—` / `used/limit` |
| Provider health | `GET /api/crm/cp/provider-health` + `readAiOpsFlags` + `COUNT crm_cp_provider_connections` | “No key” / “Off” — **không** Healthy giả |
| Intent matrix | flags + allowlist + connections | Flux hàng ẩn |
| Job / stage | `img_jobs` + `img_job_stages` | empty row “—” |
| Asset card | `crm_cp_assets` `provenance LIKE 'image_sop%'` | 1 card DAM live + empty |
| SOP card | `img_sop_registry` seed | 4 SOP PTT-IMG-* DRAFT/STAGING |
| Review comment | CP comments hoặc thread mới | “Chưa có comment” |
| FinOps | `SUM(crm_cp_credit_ledger) WHERE source LIKE 'image_sop%'` | `—` |
| Audit | `crm_cp_audit` `entity_type=image_sop` | event spec/deploy thật, không fake client approve |

**Seed SOP (không bịa client):** `PTT-IMG-KV-45`, `PTT-IMG-SOCIAL-916`, `PTT-IMG-PACKSHOT-11`, `PTT-IMG-FOOD-WEAVE`, `PTT-IMG-MASTER-UPSCALE`. Script Nova: `SELECT id FROM agency_client WHERE lower(name) LIKE '%nova%'` — 0 row → không gán `agency_client_id`, SOP vẫn DRAFT.

### 14.5 API + status

Mọi route `StaffImgGuard`. Flag off → 404 trước guard body.

| Method | Path | Cap | Status nghiệp vụ |
|---|---|---|---|
| GET | `/flags` | `crm_img.view` hoặc public-to-cp.view | `{ enabled, router }` |
| GET | `/dashboard/kpis` | view | 200 + nulls |
| GET | `/operations/board` | view | columns brief/prod/internal/client |
| GET/POST | `/projects` | view / edit | 201 |
| GET | `/jobs` | view | |
| POST | `/jobs/draft` | render | 201 |
| POST | `/jobs/:id/submit` | render | GT-I04 `confirm===true` |
| POST | `/jobs/:id/explore` | render | tạo stage + `CpJobsService.draft` |
| POST | `/jobs/:id/select` | gate1 | GT-I11 |
| POST | `/jobs/:id/refine` | render | GT-I11 |
| POST | `/jobs/:id/upscale` | render | `images_upscale` |
| POST | `/jobs/:id/pack` | render | crop/resize hoặc sharp |
| GET | `/assets` | view | |
| GET | `/assets/:id/provenance` | view | |
| GET/POST | `/review/:assetId` | gate2 | |
| GET/POST | `/sops` | view / sop | |
| POST | `/sops/:id/versions` | sop | |
| GET | `/brand/:kitId/graph` | view | |
| GET | `/intents` | view | |
| GET | `/recipes/preview` | view | |
| GET | `/providers/router/preview` | view | |
| GET | `/finops/summary` | finance | |
| GET | `/governance/audit` | manage hoặc view_audit | |
| POST | `/gates/:projectId/:n` | gate1/2/3 | |

Lỗi khóa: `400 human_confirm_required` · `402` credit · `409` flag/stage/capability · `422` GT-I06/I09/I10.

### 14.6 Wave → task

| Wave | Task | Exit thực tế |
|---|---|---|
| **I0** | 1–3 | DDL apply local; flag 0; cap catalog; util test xanh |
| **I1** | 4–6 | 1 job Nova explore→select trên staging khi có REST key; không key → 409 đúng |
| **I2** | 7 | G1–G3 + QC 7 chiều + review UI |
| **I3** | 8 | 5 SOP seed hiện IMG-06; composer lưu draft |
| **I4** | 9 | Router preview khớp health VPS; GT-I09 |
| **I5** | 10–11 | Provenance + FinOps ledger + audit |
| **I6** | 12–18 | 11 route UI = mockup; e2e; guide #40; VPS flag 0 |

Cấm đảo I0↔I1. Cấm bật flag prod trước e2e. Cấm UI xong trước API (trừ shell 404).

### 14.7 Task tóm tắt (chi tiết checkbox ở plan)

1. **DDL + seed** — SQL §4 + `img_job_stages` + apply script.
2. **Flags / types / recipe / gates** — Jest unit, không DB.
3. **RBAC** — catalog + `StaffImgGuard` + test missing_cap.
4. **Repository** — list/insert img_* với query mock.
5. **Jobs + explore/select** — wrap `CpJobsService`; GT-I04/I11.
6. **Refine / upscale / pack** — Magnific allowlist + sharp fallback; GT-I09/I10.
7. **Quality + 3 cổng** — `img_quality_results` + `img_gate_logs`.
8. **SOP registry/composer** — CRUD version + genome.
9. **Brand + router/intents** — D-08 ẩn Flux.
10. **Assets / finops / governance** — join ledger/audit thật.
11. **Controller + module** — 404 flag off.
12. **Nav + API client + routes Next** — ẩn khi flag 0.
13. **IMG-01 + shell** — KPI `—`; pipeline; win copy.
14. **IMG-02/03 + modal** — kanban + jobs table + recipe preview.
15. **IMG-04/05** — pack + QC 7 chiều.
16. **IMG-06/07** — SOP cards + composer 6 bước.
17. **IMG-08…11** — brand / providers / finops / governance.
18. **E2E + guide + VPS** — Playwright; `40-image-sop-studio.md`; env flag 0.

### 14.8 VPS / staging (thực)

```
# 1. Apply DDL (deploy user + DATABASE_URL)
bash scripts/apply_pg_ddl_cp_image_sop.sh

# 2. Seed SOP (không fail nếu thiếu Nova)
bash scripts/seed_cp_image_sop_nova.sh

# 3. Env — mặc định tắt
# CP_IMAGE_SOP_ENABLED=0
# CP_IMAGE_SOP_ROUTER=manual

# 4. UAT staging bật tạm
# CP_IMAGE_SOP_ENABLED=1
# + MAGNIFIC_REST_API_ENABLED=1 + REST key trong Integrations
# + crm_img.* caps cho staff UAT

# 5. Prod rs.pttads.vn giữ 0 đến §11 pass
```

Phụ thuộc Magnific: `crm_cp_provider_connections` hiện **0 rows** (2026-09-13). I1 explore **phải** trả 409 `magnific` disconnected — đó là hành vi đúng, không mock generate.

### 14.9 Definition of Done (một wave)

- Test unit/spec task xanh (`pnpm test` đúng file).
- UI màn đó khớp mockup (layout + empty `—` + SoT line).
- Không secret trong Network.
- Không số bịa.
- Flag 0: route image ẩn, API 404.
- Commit theo task (khi user yêu cầu commit).

### 14.10 Lệnh verify chuẩn

```bash
# API
cd services/ptt-crm-api
pnpm exec jest src/cp/cp-image-sop.flags.spec.ts src/cp/cp-image-sop-recipe.util.spec.ts src/cp/cp-image-sop-gates.util.spec.ts --runInBand

# Web
cd services/ops-web
pnpm exec vitest run src/lib/crm/cp-image-sop-nav.util.spec.ts src/lib/crm/cp-nav.util.spec.ts

# E2E (flag 0)
pnpm exec playwright test e2e/cp-image-sop.spec.ts
```

Expected: PASS. Flag 0 → không thấy link “Ảnh SOP”. Flag 1 + cap → 11 route 200, tile `—` khi DB trống.
