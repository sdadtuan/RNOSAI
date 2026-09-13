# Image SOP Studio (ImageOS) — Hướng dẫn vận hành

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-09-13  
> **Đối tượng:** Art Director, AI Artist, Brand Admin, AM, Creative Producer  
> **Workplace:** `https://rs.pttads.vn/crm/creative-os/image`  
> **SoT:** [SPEC-CP-IMAGE-SOP v2.2](../superpowers/specs/2026-09-13-cp-image-sop-srs.md) · [Mockup](../design/rnosai-cp-os-image-sop-mockup.html)

ImageOS nằm **trong Creative Production OS** — không phải app tách. Module ẩn mặc định (`CP_IMAGE_SOP_ENABLED=0`). KPI và số liệu chưa có trả **`—`**, không hard-code.

---

## 1. Điều kiện bật (IT / Admin)

| Bước | Việc |
|---|---|
| 1 | VPS/env: `CP_IMAGE_SOP_ENABLED=1` (chỉ sau UAT staging) |
| 2 | Apply DDL: `bash scripts/apply_pg_ddl_cp_image_sop.sh` |
| 3 | Gán cap staff: `crm_img.view` (tối thiểu), `crm_img.render`, `crm_img.gate1`… tuỳ vai |
| 4 | Magnific REST: lưu key qua **Cấu hình CP → Integrations** (`PTT_SECRET_ENCRYPT_KEY` bắt buộc) |
| 5 | Pilot: bind client **Nova** / lifecycle **mid-autumn-2026** — không invent brand trên UI live |

**Lưu ý:** `crm_cp.view` **không** tự kế thừa `crm_img.view`. Staff cần **cả hai** cap để vào CP OS và mở Ảnh SOP.

---

## 2. 11 màn + modal (map mockup)

| Màn | Route | Việc chính |
|---|---|---|
| IMG-01 Tổng quan | `/crm/creative-os/image` | KPI, supply chain, provider health, audit |
| IMG-02 Vận hành | `/image/operations` | Kanban theo stage recipe |
| IMG-03 Jobs | `/image/jobs` | Bảng job + modal **Tạo Image Job** |
| IMG-04 Assets | `/image/assets` | DAM image_sop, provenance, format pack |
| IMG-05 Review | `/image/review/[assetId]` | QC 7 chiều, watermark, GT-I09 |
| IMG-06 SOP Registry | `/image/sops` | Catalog PTT-IMG-* |
| IMG-07 Composer | `/image/sops/new` | Wizard 6 bước, genome, recipe graph |
| IMG-08 Brand Graph | `/image/brand/[kitId]` | Rules từ Brand Kit + img_brand_rules |
| IMG-09 Provider Router | `/image/providers` | Intent chips → capability thật |
| IMG-10 FinOps | `/image/finops` | Ledger image_sop |
| IMG-11 Governance | `/image/governance` | Audit + policy GT-I09…I11 |

Tab project: `/crm/creative-os/projects/[id]?tab=image-sop` → board IMG-02 lọc theo project.

---

## 3. Winning pipeline (6 stage)

```text
EXPLORE → SELECT → REFINE → UPSCALE → PACK → QC → Hub / I2V
```

| Gate | Quy tắc |
|---|---|
| GT-I09 | Logo/CTA **không** tin model — overlay lockup Brand Kit |
| GT-I10 | G3/Hub cần format pack đủ tỉ lệ hợp đồng |
| GT-I11 | Cấm refine/upscale trước khi chọn winner |
| GT-I04 | Submit job tốn credit cần `confirm: true` |

Modal **Tạo Image Job**: `POST /api/crm/cp/image/jobs/draft` → preview recipe → explore khi provider sẵn sàng.

---

## 4. Intent → capability (tóm tắt)

| Intent | Capability chính |
|---|---|
| hero_lifestyle | Magnific `images_generate` · fallback Weave WO |
| product_lock | Comfy packshot · fallback generate + Weave refine |
| text_cta | Overlay lockup — **không** generate logo |
| upscale_print | `images_upscale` |
| format_pack | `images_crop` + `images_resize` · Sharp local fallback |
| human_art | Weave Work Order |

Flux/Leonardo **ẩn** trên UI cho đến khi có connection + flag (D-08).

---

## 5. UAT nhanh 15 phút

1. Flag off → sidebar CP **không** có link Ảnh SOP.
2. Bật flag + `crm_img.view` → vào `/crm/creative-os/image`, thấy 11 subnav.
3. KPI tiles hiển thị `—` khi DB chưa có run.
4. Jobs empty → một hàng `— · Empty state`.
5. Tạo draft (staging có DDL + REST key) → recipe 6 stage trong modal.
6. Review asset → 7 chiều QC đều `—` khi chưa evaluate.
7. Governance → bảng policy có GT-I09, I10, I11.

Playwright: `pnpm exec playwright test e2e/cp-image-sop.spec.ts` (ops-web).

---

## 6. Không làm

- Không bật `CP_IMAGE_SOP_ENABLED=1` trên prod trước UAT §11.
- Không paste Magnific credential / Comfy `:8188` vào browser CRM.
- Không gửi Hub/G3 khi thiếu format pack hoặc chưa chọn winner.
- Không dùng URL Magnific làm SoR — ingest `crm_cp_assets`.
