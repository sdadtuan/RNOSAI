# Task 20-FIX — Lost lessons vs recoverable tag

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Reviewer Important:

1. **Lost can skip lessons when `recoverable` is sent.** `applyRecoverable('', true)` becomes `[recoverable]`, then the lost check treats that as lessons.
   - Validate trimmed **user** lessons (body or stored, **before** the recoverable prefix) for `status=lost`. Empty → 400 `lost_fields_required`.
   - Jest: PATCH lost with reason + date + `recoverable: true` and **no** lessons → 400, no UPDATE.

2. **Ordinary PATCH/Lưu strips the recoverable prefix.** `applyRecoverable(current, undefined)` peels the tag and writes stripped lessons.
   - If `recoverable` is omitted, persist `current.lessons` unchanged.
   - Jest: existing lessons `[recoverable] budget cut` + PATCH forecast only → UPDATE lessons still contain `[recoverable]`.

Do not add DDL. Do not change other gate codes.

Commit: `fix(am): require real lessons on lost renewals`

Report: `.superpowers/sdd/task-20-fix-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
