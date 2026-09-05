# Task 28-FIX — Override audit + risk_id bind

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

1. Jest: `manage + override_reason` allows care plan on Critical; `manage` without reason still 409; reason without manage still 409.
2. On successful override, audit `plan.care_override` with `{ agency_client_id, override_reason }`.
3. `createRecovery`: if `risk_id` set, require that risk exists for same `tenant_id` + `agency_client_id` else 404 `risk_not_found`.

Commit: `fix(am): audit Critical care override and bind recovery risk`

Report: `.superpowers/sdd/task-28-fix-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
