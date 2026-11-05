# Raw Lead Phase 9 (CRM Research Account Merge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Upsert `crm_research_accounts` from global keys and link raw leads.

**Architecture:** Pure merge util + repo upsert/link/refresh + batch POST + hook recompute/push + battlecard/UI.

**Tech Stack:** Nest · Jest · ops-web · Phase 8 global key.

**Spec:** [`../specs/2026-09-19-raw-lead-crm-account-merge-design.md`](../specs/2026-09-19-raw-lead-crm-account-merge-design.md)

## File map

| File | Responsibility |
|---|---|
| `quality/research-account-merge.util.ts` (+ spec) | parse key + best tier + display |
| repository | DDL, upsert account, link lead, refresh aggregates, get account |
| service / controller / types | mergeAccounts, getResearchAccount, hooks |
| battlecard.util | research_account block |
| ops-web | button + badge + modal section |

### Tasks

- [x] TDD merge util
- [x] Repo + API + hooks
- [x] UI
- [x] Jest pass
