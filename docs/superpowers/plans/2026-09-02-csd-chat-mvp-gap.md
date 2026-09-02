# CSD Chat MVP Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng toàn bộ Chat MVP còn thiếu trên `/crm/csd/chat`: nội bộ (DM/group), project, filter/search, mention, file, sửa/xóa, notify, gợi ý P1, dialog trùng ticket, AI action items, badge unread — không omnichannel.

**Architecture:** Mở rộng `CsdChatService` trên `csd_conversations` / `csd_conversation_members` / `csd_messages` / `csd_attachments` / `csd_notifications` đã có. Không bảng mới. Poll 5s giữ; không WebSocket. ops-web tách `CsdChatWorkspace` thành list + thread + context để file không phình.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL `csd_*` · disk upload dưới `data/csd-files` (không MinIO bắt buộc) · Jest · Playwright mock.

## Global Constraints

- Prefix `/api/crm/csd`. Cấm ghi `crm_tickets` / `ceo_command_turns`.
- Staff id = **INTEGER** JWT `staffId`. Client contact = `member_contact_id` (email), không portal login.
- Client Chat: `visibility` luôn `client`. Internal/DM/group: mặc định `internal`.
- Copy UI tiếng Việt (UX §5). Không badge Stub. Không auto-scroll panel khác.
- `PTT_CSD_LLM` giữ `0` trên VPS. AI chỉ stub + log `csd_ai_interactions`.
- Factory MVP `A` only. `tenant_id='PTT'`.
- P2 **không** làm trong plan này: pin/bookmark, task engine, translate, campaign chat, Zalo/Messenger/Slack, voice/GIF, WebSocket, virus scan thật, DM với client login.

## Đã có (không làm lại)

P1 + P1.5: tạo/gửi client chat, ticket từ tin (unique source), members staff-id, close/reopen 409, reply, banner khách, AI summarize stub, poll 5s.

## Slices (ship độc lập)

| Slice | Tên | UAT xong khi |
|-------|-----|----------------|
| **C-1** | Nội bộ + project + tạo hội thoại | Tạo DM/group/client/project từ dialog; filter chips |
| **C-2** | Search + mention + `#` ticket + related | Tìm + `@` + gợi ý ticket; panel Tickets |
| **C-3** | File + sửa/xóa + delivery | Upload ≤100MB; edit 15p; soft-delete |
| **C-4** | Notify + keyword + UX còn lại | `csd_notifications`; dialog trùng mã; AI actions; badge; archive; mobile 2 cột |

Mỗi slice commit riêng, có thể deploy VPS trước slice sau.

---

## File map

| File | Responsibility |
|------|----------------|
| `services/ptt-crm-api/src/csd/csd.types.ts` | Kind/input/search/mention/attachment DTO |
| `services/ptt-crm-api/src/csd/csd-chat.repository.ts` | Query list/filter/search, unread, last_read, files |
| `services/ptt-crm-api/src/csd/csd-chat.service.ts` | Rules C-1…C-4 |
| `services/ptt-crm-api/src/csd/csd-chat.service.spec.ts` | Jest |
| `services/ptt-crm-api/src/csd/csd-chat-keyword.util.ts` | BR-CHAT-10 keywords |
| `services/ptt-crm-api/src/csd/csd-chat.controller.ts` | HTTP mới |
| `services/ptt-crm-api/src/csd/csd-chat-files.controller.ts` | Upload/download attachment |
| `services/ops-web/src/lib/crm/csd-api.ts` | Fetch wrappers |
| `services/ops-web/src/components/crm/csd/CsdChatNewModal.tsx` | Dialog tạo hội thoại |
| `services/ops-web/src/components/crm/csd/CsdChatList.tsx` | Cột trái + filter |
| `services/ops-web/src/components/crm/csd/CsdChatThread.tsx` | Timeline + composer |
| `services/ops-web/src/components/crm/csd/CsdChatContext.tsx` | Panel phải |
| `services/ops-web/src/components/crm/csd/CsdChatWorkspace.tsx` | Compose 3 cột |
| `services/ops-web/e2e/csd-chat.spec.ts` | E2e từng slice |
| `docs/huong-dan-su-dung/29-csd-service-desk.md` | Cập nhật Chat |

---

# Slice C-1 — Nội bộ + project + tạo hội thoại

### Task 1: Create/list rules for `direct` / `group` / `project`

**Files:**
- Modify: `services/ptt-crm-api/src/csd/csd.types.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-chat.service.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-chat.service.spec.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-chat.repository.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-chat.controller.ts`

**Interfaces:**

```ts
export type CreateCsdConversationInput = {
  kind: CsdConversationKind;
  name_vi: string;
  client_account_id?: string;
  project_ref_kind?: string;
  project_ref_id?: string;
  member_staff_ids?: number[];
};

export type CsdConversationListQuery = {
  filter?: 'all' | 'unread' | 'clients' | 'projects' | 'internal' | 'mentions';
  kind?: CsdConversationKind;
  client_account_id?: string;
  q?: string;
  limit?: number;
};

export type CsdConversationListItem = CsdConversationRow & {
  preview: string | null;
  unread_count: number;
  has_p1_or_complaint: boolean;
};
```

Rules:
- `direct`: đúng **2** staff (owner + 1 `member_staff_ids[0]`); `name_vi` có thể để trống → `"DM · {peer}"`. Trùng cặp (cùng 2 staff, chưa closed) → trả conversation cũ.
- `group`: `name_vi` bắt buộc; `member_staff_ids` ≥ 1 ngoài owner.
- `client`: `client_account_id` bắt buộc (đã có). `member_staff_ids` optional.
- `project`: `project_ref_kind` + `project_ref_id` bắt buộc (đã có).
- `announcement`: chỉ owner gửi; member = viewer; không ticket-from-message.
- `ticket` / `campaign` / `ai_assist`: `400 kind_not_mvp` trong C-1 (ticket thread = P2 của slice này).
- List: chỉ conversation actor là member. `filter=internal` → `kind IN ('direct','group')`. `filter=clients` → `kind=client`. `filter=projects` → `kind=project`. `filter=unread` → `unread_count>0`.
- `unread_count`: messages `created_at > COALESCE(last_read_at, created_at conv)` trừ tin của chính mình.

- [x] **Step 1: Failing tests**

```ts
it('creates direct with exactly two staff and reuses pair', async () => {
  repo.findDirectPair.mockResolvedValue(null);
  repo.insertConversation.mockResolvedValue({ id: 'd1', kind: 'direct' });
  await svc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] });
  expect(repo.insertConversation).toHaveBeenCalled();
  repo.findDirectPair.mockResolvedValue({ id: 'd1', kind: 'direct' });
  const again = await svc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] });
  expect(again.id).toBe('d1');
});

it('rejects direct without peer', async () => {
  await expect(svc().createConversation(actor, { kind: 'direct', name_vi: 'x' })).rejects.toMatchObject({
    status: 400,
  });
});

it('lists only memberships and applies internal filter', async () => {
  repo.listConversationsForMember.mockResolvedValue([{ id: 'g1', kind: 'group', unread_count: 0 }]);
  const out = await svc().listConversations(actor, { filter: 'internal' });
  expect(repo.listConversationsForMember).toHaveBeenCalledWith(
    expect.objectContaining({ staffId: 3, filter: 'internal' }),
  );
  expect(out.items[0].kind).toBe('group');
});
```

- [x] **Step 2: Repo** — `findDirectPair(a,b)`, `listConversationsForMember`, `markRead(conversationId, staffId)`, `addMembers(ids)` trong create transaction.
- [x] **Step 3: `GET /conversations?filter=&q=`** + `POST /conversations/:id/read`.
- [x] **Step 4: Jest PASS** `npx jest src/csd/csd-chat.service.spec.ts --no-coverage`
- [ ] **Step 5: Commit** `feat(csd): add internal and project conversation create/list filters`

---

### Task 2: New-conversation modal + list chips

**Files:**
- Create: `services/ops-web/src/components/crm/csd/CsdChatNewModal.tsx`
- Create: `services/ops-web/src/components/crm/csd/CsdChatList.tsx`
- Modify: `CsdChatWorkspace.tsx` — bỏ hardcode `demo-client`
- Modify: `csd-api.ts` — `kind` đầy đủ; `fetchCsdConversations(token, { filter })`; `markCsdConversationRead`
- Modify: `globals.css`
- Modify: `e2e/csd-chat.spec.ts`
- Modify: `29-csd-service-desk.md`

**UI:**
- Nút Mới → modal: loại `Khách / Nội bộ nhóm / DM / Dự án`.
- Khách: input `client_account_id` (text MVP, placeholder mã KH).
- DM: input staff id peer.
- Nhóm: tên + danh sách staff id (comma).
- Dự án: `project_ref_kind` + `project_ref_id`.
- Chips: Tất cả · Chưa đọc · Khách · Dự án · Nội bộ.
- Item: tên, preview, time, badge unread, class `is-risk` nếu `has_p1_or_complaint`.
- Mở thread → `POST .../read`.
- Banner khách chỉ `kind=client`. Nội bộ: không banner vàng.

- [x] **Step 1: E2e** — mở modal, tạo DM mock, chip Nội bộ chỉ hiện DM/group.
- [x] **Step 2: Implement UI**
- [ ] **Step 3: Playwright** `npx playwright test e2e/csd-chat.spec.ts` — local EMFILE / Chromium; chưa chạy được trên máy này
- [ ] **Step 4: Commit** `feat(csd): add chat create modal and list filter chips`

**UAT C-1:** Tạo DM hai staff → 1 thread khi tạo lại. Tạo group. Tạo client không còn `demo-client` im lặng. Filter Nội bộ ẩn hội thoại khách.

---

# Slice C-2 — Search, mention, related tickets

### Task 3: Search + mention persist + ticket suggest

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-chat-search.util.ts` (parse `@123` / `#PTT-2026-000001`)
- Create: `services/ptt-crm-api/src/csd/csd-chat-search.util.spec.ts`
- Modify: chat service/repo/controller
- Modify: `csd-ai.service.ts` — `extractChatActions` (nếu chưa tách; C-4 cũng dùng)

**Interfaces:**

```ts
export function parseMentions(body: string): number[]; // @<staffId>
export function parseTicketCodes(body: string): string[]; // #PTT-YYYY-NNNNNN

GET /api/crm/csd/conversations?q=
GET /api/crm/csd/conversations/:id/messages?q=
GET /api/crm/csd/tickets?q=&limit=8   // đã có list; thêm q ILIKE code|title
GET /api/crm/csd/conversations/:id/related-tickets
```

Rules:
- Search `q` ≥ 2 ký tự, ILIKE `name_vi` / `body_text`, chỉ conversation actor là member.
- `filter=mentions`: conversation có message body chứa `@<actor.staffId>`.
- Send: persist mentions vào `csd_notifications` event `chat_mention` (insert ở Task 6 nếu C-4 chưa merge — C-2 được phép insert notify hàng).
- `#` code: không tạo ticket; UI chỉ gợi ý / link.
- Related tickets: `csd_messages.ticket_id` của conversation + ticket `client_account_id` trùng.

- [ ] **Step 1: Util Jest**

```ts
expect(parseMentions('cc @8 và @12')).toEqual([8, 12]);
expect(parseTicketCodes('xem #PTT-2026-000099')).toEqual(['PTT-2026-000099']);
```

- [ ] **Step 2: Service + HTTP**
- [ ] **Step 3: Jest PASS**
- [ ] **Step 4: Commit** `feat(csd): add chat search mentions and related tickets`

---

### Task 4: Composer `@` / `#` + context tickets

**Files:**
- Create: `CsdChatThread.tsx` (tách từ workspace)
- Create: `CsdChatContext.tsx`
- Modify: workspace, css, e2e

**UI:**
- Ô tìm trên list (debounce 300ms, `q`).
- Composer: gõ `@` → dropdown staff id đã là member (và roster numeric). Gõ `#` → gợi ý ticket `q`.
- Panel phải mục **Ticket liên quan** — link cùng tab.
- Ticket pill: `{code} · {priority} · {status}` nếu list related/get ticket trả về.

- [ ] **Step 1: E2e** search + related list mock
- [ ] **Step 2: UI**
- [ ] **Step 3: Commit** `feat(csd): add chat search and mention composer UI`

**UAT C-2:** Tìm theo nội dung tin. `@8` hiện trong tin. Panel phải list ticket đã tạo từ thread.

---

# Slice C-3 — File, edit, delete, delivery

### Task 5: Attachments + edit/delete message

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-chat-files.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-files.service.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-files.controller.ts`
- Modify: chat service `sendMessage` nhận `attachment_ids`; `editMessage`; `deleteMessage`
- Modify: repo insert/update message `edited_at`, `is_deleted`, `delivery_status`

**Interfaces:**

```ts
POST   /api/crm/csd/conversations/:id/files     // multipart, max 100MB
GET    /api/crm/csd/files/:id                   // stream; 403 nếu visibility=internal && conv.kind=client viewer-as-client
PATCH  /api/crm/csd/messages/:id                // { body_text } chỉ author, created_at ≥ now-15m
DELETE /api/crm/csd/messages/:id                // soft-delete; audit giữ body trong csd_audit_logs
```

Rules:
- Upload: `entity_type='csd_message'` sau khi có message, **hoặc** `entity_type='csd_draft'` rồi gắn lúc send. Chọn: upload gắn `conversation_id` tạm `entity_type='csd_conversation'`, send copy ids.
- Client conversation: file `visibility=client`. Internal/DM/group: `internal`.
- `createTicketFromMessage`: chỉ copy attachment `visibility=client`; internal → warning field `skipped_internal_files`.
- Edit > 15 phút → `409 edit_window_closed`.
- Delete: UI “Đã xóa”; `body_text` không trả về client (repo trả `body_text=''` khi `is_deleted`).
- `delivery_status='sent'` ngay khi insert (poll MVP; `failed` nếu insert rollback).

- [ ] **Step 1: Tests**

```ts
it('rejects edit after 15 minutes', async () => {
  repo.getMessage.mockResolvedValue({
    id: 'm1', author_staff_id: 3, created_at: new Date(Date.now() - 16 * 60_000).toISOString(),
  });
  await expect(svc().editMessage(actor, 'm1', { body_text: 'x' })).rejects.toMatchObject({ status: 409 });
});

it('skips internal files when creating ticket from message', async () => {
  files.list.mockResolvedValue([{ id: 'a1', visibility: 'internal' }]);
  const out = await svc().createTicketFromMessage(actor, 'm1', {});
  expect(out.skipped_internal_files).toEqual(['a1']);
});
```

- [ ] **Step 2: Implement + disk path `PTT_CSD_FILE_DIR` default `data/csd-files`**
- [ ] **Step 3: UI** paperclip, chip file, Sửa/Xóa trên tin của mình
- [ ] **Step 4: Commit** `feat(csd): add chat attachments and message edit/delete`

**UAT C-3:** Gửi tin + file trên group. Client chat không đính được file đánh internal. Sửa trong 15p. Xóa hiện “Đã xóa”. Tạo ticket từ tin không mang file internal.

---

# Slice C-4 — Notify, keyword, UX còn lại

### Task 6: Notifications + keyword suggest + duplicate dialog

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-chat-keyword.util.ts` + `.spec.ts`
- Modify: chat service send + createTicketFromMessage
- Create: `services/ptt-crm-api/src/csd/csd-notifications.service.ts` (insert + list unread count)
- HTTP: `GET /api/crm/csd/notifications?unread=1`, `POST /api/crm/csd/notifications/:id/read`
- UI: toast/banner gợi ý P1; dialog trùng source; sidebar badge (OpsNav unread chat)

**Interfaces:**

```ts
export function suggestPriorityFromText(text: string): 'P1' | 'P2' | null;
// P1: gấp, sự cố, ngưng chạy, sập, mất lead
// P2: lỗi, không chạy, spend
```

Rules:
- Keyword **không** tự tạo ticket. Trả `priority_suggestion` trên `sendMessage` response; UI chip “Gợi ý tạo ticket P1”.
- Client message (author sẽ là staff thay khách ở MVP): notify `owner_staff_id` event `client_chat_message` (BR-CHAT-04) — khi chưa có client author, notify members trừ sender.
- Mention → `chat_mention`, không gộp P1.
- `createTicketFromMessage` khi source trùng: HTTP **200** + `{ ...ticket, already_exists: true }` (đã return existing). UI dialog “Đã có {code} [Mở]”. Nút “Tạo ticket con” **ẩn** (UC-TKT-24 = P2).
- Unread badge: `GET /conversations?filter=unread` count; OpsNav Chat label `Chat (n)` nếu n>0.

- [ ] **Step 1: Keyword Jest**

```ts
expect(suggestPriorityFromText('Ads ngưng chạy')).toBe('P1');
expect(suggestPriorityFromText('Sửa banner')).toBe(null);
```

- [ ] **Step 2: Notify insert trên send**
- [ ] **Step 3: UI dialog + gợi ý + badge**
- [ ] **Step 4: Commit** `feat(csd): add chat notify keyword hint and duplicate ticket dialog`

---

### Task 7: AI action items + archive + mobile + copy/forward lite

**Files:**
- Modify: `csd-ai.service.ts` — `extractChatActions` reuse summarize `actions[]`
- HTTP đã có summarize; UI checkbox từng action + `Tạo ticket` từng dòng (gọi create ticket `source_type='ai_draft'`, `source_id=ai_interaction_id+index`) — **không** hàng loạt.
- `POST /conversations/:id/archive` → `status=archived` (khác closed: composer ẩn, không 409 send nếu reopen từ archive → `reopened`).
- Copy link: clipboard `/crm/csd/chat?c={id}&m={mid}`.
- Forward: modal chọn conversation đích, send body quote (không file). React: **không làm** (P2 UX).
- Mobile ≤960px: list **hoặc** thread (back “Hội thoại”); context = nút `i` mở sheet. Long-press: Trả lời / Tạo ticket / Copy.
- Deep link `?c=` chọn conversation.

- [ ] **Step 1: E2e** AI action một ticket; archive ẩn composer; `?c=` mở đúng thread
- [ ] **Step 2: Implement**
- [ ] **Step 3: Guide 29** cập nhật đủ loại chat + filter + file + AI action
- [ ] **Step 4: Commit** `feat(csd): add chat AI actions archive mobile and deep links`

**UAT C-4:** Tin “ngưng chạy” hiện gợi ý P1, không tự sinh mã. Tạo ticket 2 lần → dialog mã cũ. Mention staff → hàng `csd_notifications`. Archive. Mobile chỉ một cột.

---

## Self-review (spec coverage)

| Spec A (MVP thiếu) | Task |
|--------------------|------|
| DM / group / project / announcement | T1–T2 |
| Filter chips + unread + risk dot | T1–T2, T6 |
| Tìm hội thoại/tin | T3–T4 |
| `@` mention + `#` ticket | T3–T4 |
| Related tickets panel | T3–T4 |
| Attach + visibility | T5 |
| Edit 15p / soft-delete | T5 |
| Delivery sent (poll) | T5 |
| Notify AM/mention | T6 |
| Keyword gợi ý P1/P2 | T6 |
| Dialog trùng source | T6 |
| Ticket pill đủ field | T4 |
| File internal không vào ticket | T5 |
| AI extract + apply từng item | T7 |
| Archive | T7 |
| Copy link / forward lite | T7 |
| Mobile 2 màn | T7 |
| Sidebar unread badge | T6 |
| Client invite portal | **Không** — D4 không portal; contact email P2 |
| React / pin / WS / Zalo | P2 — ngoài plan |

Không còn TBD cho Chat MVP trong list A, trừ portal khách (spec D4 = phase 2).

---

## Thứ tự deploy VPS

1. C-1 → UAT nội bộ/filter  
2. C-2 → UAT search/mention  
3. C-3 → UAT file (disk)  
4. C-4 → UAT notify/keyword/mobile  

Mỗi lần: commit + `APPLY=1 ./scripts/deploy_csd_vps.sh` + HUP `ptt-crm-api` / `ptt-ops-web`. Không bật `PTT_CSD_LLM`.
