# Raw Lead Phase 6 (Battlecard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deterministic AM Battlecard for one raw lead (call sheet) from existing fields + cluster mates.

**Architecture:** Pure `buildRawLeadBattlecard` util + repo cluster mates + GET endpoint + ops-web modal. No new DB columns; compute on read.

**Tech Stack:** Nest `ptt-crm-api` · Jest · ops-web React · existing harvest auth guards.

**Spec:** [`../specs/2026-09-18-raw-lead-battlecard-design.md`](../specs/2026-09-18-raw-lead-battlecard-design.md)

## Global Constraints

- Deterministic only (no LLM).
- Vietnamese copy for AM-facing strings.
- Max 5 talking points, max 8 cluster mates.
- Follow existing harvest controller/guard patterns.

## File map

| File | Responsibility |
|---|---|
| `quality/battlecard.util.ts` (+ spec) | Build battlecard JSON from lead + mates |
| `raw-lead-harvest.repository.ts` | `listClusterMates` |
| `raw-lead-harvest.service.ts` | `getBattlecard` |
| `raw-lead-harvest.controller.ts` | GET `.../raw-leads/:leadId/battlecard` |
| `raw-lead-harvest.types.ts` | Response type |
| ops-web `market-research-api.ts` | Client fetch |
| ops-web `RawLeadBattlecardModal.tsx` | Modal UI |
| ops-web `RawLeadHarvestPanel.tsx` | Row button + open modal |
| `globals.css` | Minimal battlecard styles |

---

### Tasks

- [x] TDD battlecard util
- [x] Repo + API
- [x] UI
- [x] Jest pass
