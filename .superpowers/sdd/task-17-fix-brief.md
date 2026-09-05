# Task 17-FIX — Handover accept atomicity

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Reviewer Important: accept is not atomic. Handover `accepted` → ext `onboarding` → case INSERT → audit are separate queries. UPDATE has no `AND status IN ('pending_am','needs_info')`.

## Required

1. Wrap `accept` writes in `this.db.withTransaction` (same pattern as `AmAccountsService.transfer` / create).
2. UPDATE handover with `AND status IN ('pending_am','needs_info')`. If `rowCount === 0` → 409 `already_processed` (or `conflict`) — no further writes.
3. Keep existing 400 `checklist_required` before the transaction.
4. Jest: add test that concurrent/already-accepted UPDATE (`rowCount 0`) returns 409 and does not INSERT case / audit.

Do not add GET uniqueness or Sales-send validation (follow-up).

Commit: `fix(am): make handover accept transactional`

Report: `.superpowers/sdd/task-17-fix-report.md`
DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
