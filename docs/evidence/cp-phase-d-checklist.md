# Creative OS Phase D — Checklist

**Branch:** `feat/cp-integrated-phase-a`  
**Date:** 2026-09-10

## D-BATCH — VID-06 matrix

- [x] Backend matrix expansion (ratio × locale × channel × CTA)
- [x] Max 50 rows after expansion
- [x] UI step 3 variant matrix + expansion preview
- [x] Review table shows `variant_key`

## D-PB — Playbook clone

- [x] `cloneToTemplate` API
- [x] UI **Sao chép mẫu** on playbook picker

## D-CAL — Distribution monitor

- [x] `resolvePublishPostRef` (`export:` / `native:`)
- [x] Deliver audit `publish.deliver`
- [x] Distribution labels for native refs
- [x] No fake TikTok success URLs

## Verify

```bash
cd services/ptt-crm-api && npm test -- --testPathPattern='src/cp'
cd services/ops-web && npm test -- --run src/lib/crm/cp-calendar.util.spec.ts
```
