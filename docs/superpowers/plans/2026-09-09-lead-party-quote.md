# Lead Party trên Báo giá Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New-business quotes can be drafted from a Lead without an AM 360 client; company/contact/logo live on the Lead (`lead_party`) and are snapshotted on send.

**Architecture:** Columns on `crm_leads` are the draft SoT. NEW-01 and Lead detail PATCH the same fields. Publish/share validate `company_name` + (phone or email), then copy into `crm_quote_versions.party_json`. PDF/portal read the snapshot.

**Tech Stack:** NestJS `ptt-crm-api`, Next.js `ops-web`, PostgreSQL, Jest, Vitest.

## Global Constraints

- Do not POST `createAmAccount` or redirect to `/crm/account-management/clients/new` from NEW-01.
- Do not auto-map `full_name` → `company_name`.
- Draft create: Lead source needs `lead_id` + `title` only. Send gate is separate.
- Vietnamese error copy for send gate.
- `agency_client_id` stays nullable on Lead-sourced quotes.

---

## Task 1: Pure lead-party util (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/leads/lead-party.util.ts`
- Create: `services/ptt-crm-api/src/leads/lead-party.util.spec.ts`
- Create: `services/ops-web/src/lib/crm/lead-party.util.ts`
- Create: `services/ops-web/src/lib/crm/lead-party.util.spec.ts`

- [x] Write failing tests for prefill order, send gate, snapshot, logo MIME
- [x] Implement shared util functions
- [x] Run Jest + Vitest

---

## Task 2: DDL + GET/PATCH + logo

**Files:**
- Create: `docs/specs/2026-09-09-postgresql-ddl-lead-party.sql`
- Create: `scripts/apply_pg_ddl_lead_party.sh`
- Modify: lead types, mapper, PG repos, write service, leads controller

- [x] DDL columns + backfill `company_name`
- [x] Expose fields on GET list/detail and PATCH
- [x] POST/DELETE `/api/v1/leads/:id/party-logo`

---

## Task 3: Quote create + send snapshot

**Files:**
- Modify: `quote-create.service.ts` (+ spec)
- Modify: `quote-studio.service.ts`, `quote-share.service.ts`, `quote-public.service.ts` (+ specs)

- [x] Lead source create without `agency_client_id` (AC-LP-01)
- [x] Optional `lead_party` write in the same create transaction
- [x] Publish/share validate §4.2 and persist `party_json`
- [x] Public DTO includes snapshotted `party`

---

## Task 4: NEW-01 + Lead detail UI

**Files:**
- Modify: `QtCreateForm.tsx` (+ spec)
- Create: `LeadPartyCard.tsx` (+ spec)
- Modify: Lead detail page, `api.ts`, `qt-api.ts`

- [x] Optional AM 360 select; card Thông tin khách
- [x] Lead detail block + PATCH
- [x] SRS delta §6.2
