# CSD Chat Group Admin Wave B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Zalo-like Wave B — opt-in join approval, send lock (owner+admin only), single pin, transfer ownership.

**Architecture:** Additive conversation flags + `csd_group_join_requests`; enforce in `CsdChatService`; FE sidebar toggles + pending list + pin banner + transfer confirm.

**Tech Stack:** NestJS csd-chat, PostgreSQL, ops-web React.

**Design:** `docs/superpowers/specs/2026-09-16-csd-chat-group-admin-wave-b-design.md`

## Global Constraints

- Only `kind === 'group'`  
- UI feel: Zalo-like (compact toggles, pin banner, confirm transfer)  
- Commit/deploy when user asks  

## File map

| File | Change |
|------|--------|
| `docs/specs/2026-09-02-postgresql-ddl-csd.sql` | ALTER columns + create join_requests |
| `csd.types.ts` | New fields + join request type |
| `csd-chat-group-admin.util.ts` | Helpers: canSendInGroup, canPin, canTransfer, canResolveJoin |
| `csd-chat.repository.ts` | Schema ensure, CRUD join requests, pin, transfer txn |
| `csd-chat.service.ts` + spec | Business rules |
| `csd-chat.controller.ts` | New routes |
| `csd-api.ts` | Client helpers |
| `CsdChatContext.tsx` | Toggles, pending, transfer |
| `CsdChatThread.tsx` / session | Pin banner, composer lock, pin action |
| `globals.css` | Minimal Zalo-like rows |

---

### Task 1: Permission helpers + tests

- [ ] Extend util: `canToggleGroupModeration`, `canSendInLockedGroup`, `canPinGroupMessage`, `canTransferGroupOwner`, `canResolveJoinRequest`
- [ ] Unit tests for each

### Task 2: DDL + repository

- [ ] ALTER `join_approval_required`, `members_can_send`, `pinned_message_id`
- [ ] CREATE `csd_group_join_requests` + unique pending index
- [ ] Repo: list/create/resolve join requests; setPin; transferOwner (txn); map new conversation fields

### Task 3: Service + controller

- [ ] `addMember` branches on `join_approval_required`
- [ ] `sendMessage` checks send lock
- [ ] patchConversation accepts new flags
- [ ] approve/reject, pin/unpin, transferOwner
- [ ] Service specs covering happy + forbidden paths

### Task 4: Ops-web API + Zalo UI

- [ ] Client API helpers
- [ ] Context: toggles, pending requests, transfer
- [ ] Thread: pin banner + menu pin; composer lock hint
- [ ] Wire session handlers

### Task 5: Verify

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='csd-chat.service|csd-chat-group-admin' --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-display.spec.ts
```
