# PTT Ops AI Tools P2 — Implementation Plan

> Spec: `docs/superpowers/specs/2026-09-19-ptt-ops-ai-tools-p2-crm-context-design.md`

## Task 1: Context builder (TDD)

- Types + repository + service
- Unit tests with mocked Pool / in-memory fixtures
- Commit

## Task 2: Wire read tools

- Inject `OpsCrmContextService` into `ToolRegistry` → `createOpsContextTools(svc)`
- Read handlers call `buildPack`
- Update specs
- Commit

## Task 3: Deploy + smoke

- Push, rebuild API on VPS
- Call `marketing_plan.read` with `plan_id=6` / `lifecycle_id=3`
- Verify `wired:true` and non-empty plan/stage
