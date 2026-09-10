# Creative OS Phase D — Batch matrix, playbook clone, CAL-04

**Branch:** `feat/cp-integrated-phase-a`  
**Date:** 2026-09-10

## Scope

1. **VID-06** — batch variant matrix ratio × locale × channel × CTA (max 50 rows after expansion)
2. **Playbook self-serve clone** — agency copies published playbook template → draft
3. **CAL-04** — distribution monitor: `native:` / `export:` post refs, deliver audit, history

---

## D-BATCH — VID-06 matrix

- [x] `cp-batch-matrix.util.ts` — `expandBatchMatrix`, `matrixExpansionCount`
- [x] `CpBatchesService.create` — matrix expansion + `batch_matrix_too_large` guard
- [x] `renderItem` — writes `ratio`, `locale`, `channel`, `variant_key` into draft config
- [x] `CpBatchFactory` — chip multi-select + expansion preview
- [x] Tests: `cp-batch-matrix.util.spec.ts`, matrix create in `cp-batches.service.spec.ts`

## D-PB — Playbook clone

- [x] `POST /playbooks/:id/clone-template` → draft template with `self_serve: true`
- [x] `CpPlaybookPicker` — **Sao chép mẫu** + link to templates
- [x] Tests: `cp-playbooks.service.spec.ts`

## D-CAL — Native publish monitor

- [x] `resolvePublishPostRef` — `export:{id}` default; `native:{channel}:{id}` when `publish_native`
- [x] `deliver` writes `publish.deliver` audit row
- [x] `distributionPostLabel` — labels `native:` refs (no fake TikTok URL)
- [x] Tests: `cp-publish.service.spec.ts`, `cp-calendar.util.spec.ts`

## Manual smoke

1. Batch → step 3 chọn 2 ratio × 2 locale → preview ≤ 50 → validate/run
2. Video list → playbook → **Sao chép mẫu** → mở draft template
3. Calendar → Phân phối → Xuất file → history có `publish.deliver`
4. Bật `publish_native` → deliver → post_ref `native:tiktok:…` (không URL giả)
