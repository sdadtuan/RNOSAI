# Raw Lead Phase 7 (Learning Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rule-based learning from dial/feedback → adjust quality_score + priority_tier.

**Architecture:** Pure `computeLearningAdjustment` util; DDL columns; apply on PATCH + batch POST; ops-web button + score delta badge.

**Tech Stack:** Nest ptt-crm-api · Jest · ops-web · Phase 5 `computePriorityTier`.

**Spec:** [`../specs/2026-09-19-raw-lead-learning-loop-design.md`](../specs/2026-09-19-raw-lead-learning-loop-design.md)

## Global Constraints

- Deterministic deltas only; clamp score 0–100.
- Idempotent via `learning_delta` base restore.
- Vietnamese AM-facing copy where shown.

## File map

| File | Responsibility |
|---|---|
| `quality/learning-loop.util.ts` (+ spec) | delta + next score/priority |
| repository | DDL, update learning fields, list for apply |
| service / controller / types | apply on patch + batch |
| priority-cluster (reuse) | tier after score change |
| ops-web API + panel | button, delta badge |
| battlecard.util | optional reasons line |

---

### Tasks

- [x] TDD learning util
- [x] Repo + API (patch + batch)
- [x] UI
- [x] Jest pass
