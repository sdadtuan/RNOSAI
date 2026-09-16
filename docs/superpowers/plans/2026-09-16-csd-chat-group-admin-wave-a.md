# CSD Chat Group Admin Wave A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Zalo-like group sidebar: phó nhóm (`admin`), invite/remove members, edit group name/description/avatar.

**Architecture:** Extend member role + conversation avatar columns; enforce permission matrix in `CsdChatService`; enrich `CsdChatContext` UI for `kind=group`. Also ship pending friend-request display-name fix.

**Tech Stack:** NestJS csd-chat, PostgreSQL, ops-web React.

**Design:** `docs/superpowers/specs/2026-09-16-csd-chat-group-admin-wave-a-design.md`

## Global Constraints

- Only `kind === 'group'` for new admin UI  
- Roles: `owner | admin | member | viewer`  
- Owner unique; cannot remove owner  
- Commit when user asks  

## File map

| File | Change |
|------|--------|
| `csd.types.ts` | role includes `admin`; conversation avatar fields |
| `csd-chat.repository.ts` | DDL alter, update conversation, setMemberRole, list with names |
| `csd-chat.service.ts` | permission helpers + patch conversation / role |
| `csd-chat.controller.ts` | PATCH routes |
| `csd-chat.service.spec.ts` | permission matrix tests |
| `csd-api.ts` (ops-web) | client types + API helpers |
| `CsdChatContext.tsx` | group sections UI |
| `CsdChatWorkspace.tsx` | wire callbacks |
| Friend request files | already partially done — verify |

---

### Task 1: Types + permission helpers + failing tests

**Files:** types, `csd-chat.service.ts` (+ spec)

- [ ] Extend `role` union with `admin`
- [ ] Helpers: `isGroupOwner`, `canManageGroupInfo`, `canManageMembers`, `canSetAdminRole`
- [ ] Tests: owner can set admin; admin cannot set admin; admin can remove member; cannot remove owner

### Task 2: Repo DDL + patch conversation + setMemberRole

- [ ] `ALTER` conversation avatar columns if missing; allow update name/description/avatar
- [ ] `updateMemberRole(conversationId, staffId, role)`
- [ ] Wire service methods used by controller

### Task 3: Controller routes

- [ ] `PATCH conversations/:id`
- [ ] `PATCH conversations/:id/members/:staffId`
- [ ] Tighten add/removeMember with new matrix

### Task 4: Ops-web API + Context UI

- [ ] Client helpers
- [ ] Group sections: Thông tin nhóm, Vai trò, Thành viên (+ invite)
- [ ] Wire from Workspace

### Task 5: Friend-request names (if not committed)

- [ ] Verify API + UI show display names

### Task 6: Verify

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='csd-chat.service|csd-chat-friends' --no-coverage
```
