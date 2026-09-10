# Creative OS Phase C — Checklist

**Branch:** `feat/cp-integrated-phase-a`  
**Date:** 2026-09-10

## C-RENDER — Dual render worker (stub + Video SOP)

- [x] `CP_RENDER_MODE=stub|sop|auto` via `cp-render-mode.util.ts`
- [x] Stub path → `stub://renders/{jobId}`
- [x] SOP path → master/output_uri từ `vd_assets` hoặc draft config
- [x] Async `sop_wait` poller (10s) hoàn tất khi master xuất hiện
- [x] Unit tests: `cp-render.worker.spec.ts`, `cp-sop-output.util.spec.ts`

## C-ADS — Ads Ops launch gate

- [x] `CpLaunchGateService` — template `re_lead_default` yêu cầu CP version `qc_status=passed`
- [x] Creative link: `description=cp_version:{uuid}` khi submit Hub từ CP
- [x] Fallback match `asset_url` = `output_uri`
- [x] Meta Ads Ops `submitLaunch` gọi gate trước campaign write
- [x] Tests: `cp-launch-gate.service.spec.ts`

## C-RPT — Closed-loop CPL by `re_project_id`

- [x] Performance report `closed_loop[]` — join CP tag `re_project:{id}` + `daily_performance` + `crm_leads`
- [x] CPL = spend / valid_leads; null khi thiếu ingest
- [x] UI table trên tab **Hiệu quả nội dung**
- [x] Tests: `cp-reports-closed-loop.util.spec.ts`

## VPS env gợi ý

```bash
CP_RENDER_MODE=auto          # stub cho social, sop khi có vd_project_id / TVC
CP_AI_ENABLED=true           # bật khi chạy video_sop thật
```

## Manual smoke

1. RE handoff → CP project tag `re_project:N`
2. Submit creative Hub → description có `cp_version:…`
3. QC blocked → Ads Ops launch `re_lead_default` trả `qc_blocked`
4. RPT Performance → bảng closed-loop (spend/leads null nếu chưa sync Meta/CRM)
