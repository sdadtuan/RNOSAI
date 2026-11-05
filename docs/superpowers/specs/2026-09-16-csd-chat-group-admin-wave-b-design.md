# Design — CSD Chat Group Admin Wave B (Zalo-like)

**Date:** 2026-09-16  
**Status:** Approved in chat  
**Depends on:** Wave A (`2026-09-16-csd-chat-group-admin-wave-a-design.md`)  
**Scope:** Group conversations only — join approval (opt-in), send lock, single pin, transfer ownership

## 1. Goals

1. **Join approval (opt-in):** Default invite still adds member immediately (Wave A). Owner/admin can enable “Cần duyệt khi mời”; then invites create **pending** requests until Approve/Reject.
2. **Send lock:** Toggle “Chỉ Chủ/Phó được gửi”. When on, only `owner`/`admin` may send; members/viewers get blocked composer + API `403`.
3. **Pin:** Exactly **one** pinned message per group; pin replaces previous; owner/admin pin/unpin. Banner at top of thread (Zalo-like).
4. **Transfer owner:** Owner picks a member → confirm → immediate: target becomes `owner`, previous owner becomes `member`.

## 2. Non-goals

- Public invite links / QR  
- Multi-pin or author-self-pin  
- Transfer requiring Accept  
- Announcement / project / DM parity  

## 3. Permissions

| Action | owner | admin | member/viewer |
|--------|-------|-------|---------------|
| Toggle join approval / send lock | ✅ | ✅ | ❌ |
| Invite (flag off → member; flag on → pending) | ✅ | ✅ | ❌ |
| Approve / reject join request | ✅ | ✅ | ❌ |
| Send when `members_can_send=false` | ✅ | ✅ | ❌ |
| Pin / unpin | ✅ | ✅ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |

Platform `csd` manage/admin caps still bypass as superuser (same as Wave A).

## 4. Data model

### `csd_conversations` (additive)

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| `join_approval_required` | BOOLEAN NOT NULL | `false` | Opt-in approve |
| `members_can_send` | BOOLEAN NOT NULL | `true` | `false` = only owner/admin send |
| `pinned_message_id` | UUID NULL | NULL | FK → `csd_messages(id)` ON DELETE SET NULL |

### `csd_group_join_requests` (new)

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `tenant_id` | VARCHAR |
| `conversation_id` | UUID FK conversations |
| `requester_staff_id` | INTEGER NOT NULL |
| `invited_by_staff_id` | INTEGER NOT NULL |
| `status` | `pending` \| `approved` \| `rejected` \| `cancelled` |
| `created_at` / `resolved_at` | TIMESTAMPTZ |
| `resolved_by_staff_id` | INTEGER NULL |

Unique: one **pending** row per `(conversation_id, requester_staff_id)`.

## 5. API

| Method | Path | Notes |
|--------|------|--------|
| PATCH | `/api/crm/csd/conversations/:id` | Extend body: `join_approval_required?`, `members_can_send?` (group only; manage-info) |
| POST | `…/members` | If join approval on → create pending request (not member); else Wave A insert |
| GET | `…/join-requests` | List pending (+ optional resolved recent) |
| POST | `…/join-requests/:reqId/approve` | Insert member + mark approved |
| POST | `…/join-requests/:reqId/reject` | Mark rejected |
| POST | `…/messages/:messageId/pin` | Set conversation pin |
| DELETE | `…/conversations/:id/pin` | Clear pin |
| POST | `…/transfer-owner` | Body `{ new_owner_staff_id }` |

Conversation list/detail already returns row fields; include new booleans + `pinned_message_id`. Messages list may include `pinned_message` summary when set.

`sendMessage`: if group and `!members_can_send` and actor role not owner/admin → `403 { error: 'members_cannot_send' }`.

## 6. UI (Zalo-like)

Sidebar `kind=group` (extend Wave A):

1. **Thông tin nhóm** — existing name/desc/avatar + two toggles (duyệt mời / chỉ Chủ·Phó gửi).  
2. **Yêu cầu vào nhóm** — pending list with Approve / Reject (chỉ hiện khi có pending hoặc flag on).  
3. **Vai trò / Thành viên** — + “Chuyển quyền chủ” (owner only, confirm dialog).  

Thread:

- Pin banner under toolbar when `pinned_message_id` set (snippet + “Bỏ ghim” if permitted).  
- Message menu: “Ghim” / “Bỏ ghim” for owner/admin.  
- Composer disabled + short hint when locked out.

Visual: reuse existing CSD chat CSS (no purple/card clutter); compact rows like Zalo (toggle rows, badge Chủ/Phó, soft buttons).

## 7. Success criteria

1. Flag off invite → member immediate; flag on → pending until approve.  
2. Send lock blocks member send (API + UI).  
3. Pin one message; second pin replaces; banner visible.  
4. Transfer updates `owner_staff_id` + roles atomically.  
5. Unit tests for matrix + join/send/pin/transfer.

## 8. Approach

Additive columns + one join-request table (Approach A from design chat). No `settings_json`.
