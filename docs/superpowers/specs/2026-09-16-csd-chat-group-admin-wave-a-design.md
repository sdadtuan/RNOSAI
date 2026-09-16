# Design — CSD Chat Group Admin Wave A (Zalo-like sidebar)

**Date:** 2026-09-16  
**Status:** Approved in chat  
**Scope:** Group conversations only — roles (owner/admin/member), members invite/remove, group info (name/description/avatar)

## 1. Problem

Group chat today only has `owner | member | viewer`, basic add/remove by staff id, and weak group-info UX. AM expects Zalo-like: deputy admins, invite flow, edit name/avatar/description in the right sidebar.

## 2. Goals (Wave A)

1. **Roles:** Appoint / remove **phó nhóm** (`admin`). Owner remains unique.  
2. **Members:** Invite friends into group; remove members when permitted.  
3. **Group info:** Edit `name_vi`, `description`, group avatar.  
4. Sidebar sections in `CsdChatContext` for `kind === 'group'`.

## 3. Non-goals (later waves)

- Join approval / request-to-join  
- Send-message permission locks  
- Pin messages, transfer ownership  
- Announcement/project conversation parity  

## 4. Roles & permissions

| Action | owner | admin (phó) | member/viewer |
|--------|-------|-------------|---------------|
| Appoint / remove `admin` | ✅ | ❌ | ❌ |
| Add member | ✅ | ✅ | ❌ |
| Remove `member`/`viewer` | ✅ | ✅ | ❌ |
| Remove `admin` | ✅ | ❌ | ❌ |
| Remove `owner` | ❌ | ❌ | ❌ |
| Edit name / description / avatar | ✅ | ✅ | ❌ |

Member role values: `'owner' | 'admin' | 'member' | 'viewer'`.  
Only one `owner` (existing `owner_staff_id`). Multiple `admin` allowed.

## 5. Data model

- Extend member `role` check / app validation to include `admin`.  
- Conversation: ensure `description` editable; add `avatar_storage_key` + `avatar_updated_at` (or reuse existing avatar fields if already on `csd_conversations` — prefer additive `ALTER`).  
- No new tables in A.

## 6. API

| Method | Path | Body / notes |
|--------|------|----------------|
| PATCH | `/api/crm/csd/chat/conversations/:id` | `{ name_vi?, description?, clear_avatar? }` + multipart avatar optional **or** separate `POST …/avatar` |
| PATCH | `/api/crm/csd/chat/conversations/:id/members/:staffId` | `{ role: 'admin' \| 'member' }` |
| POST | members | existing; allow `role: member` only from invite UI |
| DELETE | members | existing; enforce matrix above |

List members response includes `role` + `display_name_vi` (already).

## 7. UI

`CsdChatContext` when `active.kind === 'group'`:

1. **Thông tin nhóm** — avatar (upload), name, description; Save.  
2. **Vai trò** — list admins + owners; owner can promote/demote.  
3. **Thành viên** — list all; invite picker (friends); remove button per permission.

DM / client / project keep current sidebar (no Wave A sections required).

## 8. Success criteria

1. Owner promotes member → `admin`; demotes → `member`.  
2. Admin can invite friend and remove a member; cannot demote owner or other admin.  
3. Owner/admin can rename group and set description + avatar; members see updates after refresh/poll.  
4. Unit tests for permission matrix; FE shows badges Chủ / Phó.

## 9. Related fix (same delivery if uncommitted)

Friend requests list must show peer **display name**, not `Staff #id` (API enrich + `CsdChatContacts`).
