# Raw Lead Phase 8 (Cross-project Accounts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Soft `global_account_key` + cross-project mates on Battlecard.

**Architecture:** Extend priority-cluster util with `buildGlobalAccountKey`; DDL + recompute writes key; repo mates query JOIN projects; battlecard + GET endpoint; ops-web battlecard section.

**Tech Stack:** Nest · Jest · ops-web · existing harvest guards.

**Spec:** [`../specs/2026-09-19-raw-lead-cross-project-accounts-design.md`](../specs/2026-09-19-raw-lead-cross-project-accounts-design.md)

## File map

| File | Responsibility |
|---|---|
| `priority-cluster.util.ts` (+ spec) | `buildGlobalAccountKey` |
| repository | DDL, update key, listCrossProjectMates |
| service / controller | wire recompute + GET + battlecard |
| types | mapLead fields |
| battlecard.util | include cross_project mates |
| ops-web modal + types | render section |

### Tasks

- [x] TDD global key
- [x] Repo + recompute + API
- [x] Battlecard + UI
- [x] Jest pass
