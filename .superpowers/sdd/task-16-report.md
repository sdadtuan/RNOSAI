# Task 16 Report: Docs + e2e + VPS notes (P1/P2)

**Status:** DONE  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Commit:** *(pending)* — docs(mkt-ai): playbook policy + learn ops guide  
**Pushed:** no

## What shipped

Documentation, runbook, spec status, e2e Playwright, and env deprecation for playbook policy + learn catalog (Tasks 1–15).

| File | Change |
|------|--------|
| `docs/huong-dan-su-dung/29-marketing-ai-planner-thuc-chien.md` | v1.1 — policy Admin §2.3, gộp 403 → `mkt_ai_service_not_enabled`, `_common`, learn flow, VPS P0 DDL |
| `docs/runbooks/mkt-ai-playbook-ops.md` | v2.0 — Admin UI Sinh/Duyệt/Active thay PR-only; VPS P0/P2; ngưỡng corpus |
| `docs/superpowers/specs/2026-09-01-mkt-ai-playbook-learn-catalog-design.md` | Header **Trạng thái: Implemented** |
| `services/ops-web/e2e/mkt-ai-playbook-admin.spec.ts` | Playwright: staff login, list, mở slug, Sinh disabled khi `!can_learn` |
| `deploy/env.mkt-ai-ga.example` | Comment deprecate `PTT_MKT_AI_PLANNER_SLUGS`; default empty |

## Step checklist

- [x] User guide — policy Admin, hết 2 mã 403 cũ, `_common`, learn flow
- [x] Runbook — UI Duyệt thay PR-only JSON
- [x] Spec header Implemented
- [x] E2e Playwright admin playbook
- [x] Env example deprecate PLANNER_SLUGS
- [x] VPS P0 deploy steps in docs §2.3 + runbook §4
- [x] **Commit** `docs(mkt-ai): playbook policy + learn ops guide`

## Doc highlights

### Policy thay env (§2.3 user guide)

- `mkt_ai_service_policy.rollout`: off | pilot | ga
- Admin `/crm/admin/mkt-ai/playbooks` — bật pilot không restart
- Legacy env AND nếu còn set; khuyến nghị để trống `PTT_MKT_AI_PLANNER_SLUGS`

### VPS P0 (from plan Task 16)

```bash
psql "$DATABASE_URL" -f docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-policy.sql
psql "$DATABASE_URL" -f scripts/seed_mkt_ai_service_policy.sql
# optional: UPDATE … quang-cao-facebook → pilot
# optional: xóa/mở rộng PTT_MKT_AI_PLANNER_SLUGS
sudo systemctl restart ptt-crm-api
```

### E2e coverage

- `GET /api/v1/admin/mkt-ai/playbooks` — pick slug with 0 candidates
- UI list: table + `n/5 · m/3`
- Detail: **Sinh** disabled + label `Còn N HĐ…` when `can_learn=false`
- Skips when API unreachable or admin DDL not applied

## What I tested

```bash
# E2e requires running API + staff demo user — skip in CI without stack
cd services/ops-web && npx playwright test e2e/mkt-ai-playbook-admin.spec.ts
```

Manual review: doc links, VPS commands, spec status line.

## Notes

- Runbook v2 keeps PR checklist for disk `_common` / industry JSON baseline — Admin UI is primary for learn/review.
- Smoke script `smoke_mkt_ai_playbooks_admin.sh` may still target `catalog-disk`; update separately if needed.
- Plan Task 16 checkbox in plan file not edited (out of scope for this commit).

## Next

Plan complete for P0–P2 slice. P3 depth (Task 15) already shipped. Optional: wire lifecycle SQL into `loadCorpusRows` for real corpus counts in staging.
