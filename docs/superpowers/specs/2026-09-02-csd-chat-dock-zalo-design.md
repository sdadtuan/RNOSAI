# Spec — CSD Chat Dock (Zalo-style)

> **Document ID:** CSD-CHAT-DOCK-20260902  
> **Phiên bản:** 1.1 · **Ngày:** 2026-09-02  
> **Trạng thái:** Plan ready — [`2026-09-02-csd-chat-dock-zalo.md`](../plans/2026-09-02-csd-chat-dock-zalo.md)  
> **Parent:** [CSD](./2026-09-02-agency-communication-service-desk-design.md) · [UX Chat §5](./2026-09-02-agency-csd-ux-ui-design.md) · [Use case Chat](./2026-09-02-agency-csd-use-cases.md)  
> **Đã ship:** Chat MVP C-1…C-4 trên `/crm/csd/chat` (`415d687c`) — API gửi/đọc/file/ticket/notify/archive/unread  
> **Không phải:** widget Zalo OA, CEO Command ChatBox, portal khách tự đăng ký, omnichannel

---

## 0. Tóm tắt

Chat CSD hiện là **trang full 3 cột** (list / thread / context), tin xếp dọc kiểu form. Staff phải rời Lead / Ticket / Hub để trả lời.

**Chat Dock** đưa hội thoại native thành **hộp thoại nổi** trên mọi trang staff có `StaffPageShell`, UX gần Zalo PC/Web:

1. Nút tròn góc phải + badge chưa đọc.  
2. Panel: danh sách hội thoại ↔ một thread.  
3. Tin **bong bóng** (mình phải / người khác trái), avatar chữ cái, mốc ngày.  
4. Trang `/crm/csd/chat` giữ workspace đầy đủ (thêm cột context + AI) nhưng **cùng ngôn ngữ visual** để không lệch 2 UI.  
5. Admin cấp tài khoản; staff đăng nhập hệ thống; danh bạ + kết bạn trước khi nhắn tin 1-1.

**Tài khoản:** Chỉ Admin tạo/bật trong hệ thống. Nhân viên **đăng nhập `/login`** (email + mật khẩu staff). Không tự đăng ký. Chat 1-1 chỉ sau **kết bạn** được chấp nhận.

**Pitch 1 câu:** Chat CSD luôn trong tầm tay như Zalo; tài khoản do Admin cấp; kết bạn rồi mới nhắn tin riêng.

---

## 1. Quyết định đã chốt

| # | Mục | Chốt v1.1 | Lý do |
|---|-----|-----------|--------|
| Z1 | Kiểu | **Một dock, một thread** (không 3 cửa sổ Zalo PC) | YAGNI; VPS + mobile; tránh chồng modal |
| Z2 | Phạm vi trang | Mọi route dùng `StaffPageShell` **trừ** `/crm/csd/chat` và trang không có user | Tránh 2 composer; login/public không mount |
| Z3 | Quyền | Dock/full chat: `csd.view` **và** `csd_chat_accounts.enabled`. Gửi = `csd.write`. Admin tài khoản = `csd.admin` | Chat ≠ mọi staff CRM |
| Z4 | Kênh | **Native CSD only.** Không Zalo OA / Messenger / Slack | Spec CSD D8; đây là UI, không ingest |
| Z5 | Realtime | **Poll 15s** list + unread + thread đang mở + lời mời. Không WebSocket | P2 đã loại; VPS 3.3 GiB |
| Z6 | Persist | `sessionStorage` key `csd.chat.dock.v1`: `{ open, pane, conversationId }` | Mất khi đóng tab |
| Z7 | Visual | Restyle **cả dock lẫn full page** sang bong bóng Zalo | Một design system, không “dock đẹp / page cũ” |
| Z8 | Context / AI | Full page giữ cột phải. Dock: nút **i** mở sheet ngắn (thành viên + ticket liên kết) + **Mở rộng** | Dock hẹp ~380px không nhét 3 cột |
| Z9 | CEO ChatBox | **Không** dùng chung thread / mount | CSD D8 |
| Z10 | Âm thanh | **Tắt.** Badge + chấm unread đủ | Không spam khi poll |
| Z11 | Identity | Tài khoản chat = `staff_users` + hàng `csd_chat_accounts`. **Không** bảng user chat tách, không mật khẩu thứ hai | Một đăng nhập RNOSAI |
| Z12 | Provision | **Chỉ Admin tạo/bật.** Không trang đăng ký công khai, không invite link tự join | Yêu cầu user |
| Z13 | Đăng nhập | Cùng `/login` staff (email + mật khẩu / MFA nếu đã bật). Hết phiên → về `/login`. Dock không hiện khi chưa login | Tái dùng session `ptt_ops_access_token` |
| Z14 | Kết bạn | Bắt buộc trước **DM** (`kind=direct`). Group / Client / Project **không** cần bạn | Zalo 1-1; chat việc vẫn mở |
| Z15 | Khách hàng | Client Chat **không** cấp login cho khách (giữ CSD D4) | Portal khách = phase khác |
| Z16 | DM cũ | Hội thoại `direct` đã có trước wave bạn **vẫn xem/gửi**; **tạo DM mới** phải là bạn accepted | Không cắt lịch sử C-1 |

Đổi Z1–Z16 phải tăng phiên bản spec.

---

## 2. Mục tiêu & phạm vi

### 2.1. Mục tiêu

| # | Mục tiêu | Đo thành công |
|---|----------|----------------|
| G1 | Trả lời chat khi đang xem Lead/Ticket/Hub | Mở dock → chọn hội thoại → gửi ≤ 3 thao tác, không đổi route |
| G2 | Biết có tin mới mọi lúc | Badge launcher = `GET /chat/unread-count`; sidebar Chat vẫn hiện cùng số |
| G3 | Nhìn và thao tác như Zalo | Bong bóng trái/phải, avatar, ngày, hover ⋯, composer đáy panel |
| G4 | Không phá Chat MVP | C-1…C-4 (filter, mention, file, sửa 15p, xóa, ticket, archive, deep link `?c=`) giữ hành vi |
| G5 | Không phá chrome | Không che modal ticket / SLA toast destructive; z-index dưới dialog |
| G6 | Không tự mọc tài khoản | 0 endpoint đăng ký công khai; 100% `csd_chat_accounts` có `created_by_staff_id` Admin |
| G7 | DM có kiểm soát | Tạo `direct` mới khi chưa bạn → 409 `not_friends`; sau Accept thì mở/get-or-create DM |

### 2.2. In scope v1.1

- Launcher FAB + panel list/thread + minimize.  
- Restyle list + message bubbles trên **dock và** `/crm/csd/chat`.  
- Tái sử dụng API C-1…C-4 (gửi, reply, file, edit/delete, ticket, forward, archive, search, filter).  
- Deep link: **Mở rộng** → `/crm/csd/chat?c={id}`.  
- Mobile ≤960px: panel full-viewport bottom sheet (1 pane: list hoặc thread).  
- Image MIME (`image/*`): thumbnail trong bong bóng; file khác = chip như C-3.  
- Hover / long-press: Reply, Tạo ticket, Sửa, Xóa, Copy link, Forward gộp vào menu ⋯.  
- **Đăng nhập:** cổng `/login` hiện có; gate tài khoản chat; hết phiên về login.  
- **Admin cấp tài khoản chat** (`/admin/crm/csd/chat-accounts`).  
- **Danh bạ + kết bạn** (gửi / chấp nhận / từ chối / hủy / chặn).  
- Tab dock: Tin nhắn · Danh bạ · Lời mời.

### 2.3. Out of scope (cố ý — P2)

| Không làm | Lý do |
|-----------|--------|
| Nhiều cửa sổ chat chồng | Z1 |
| WebSocket, typing, online/last-seen | Không có presence; poll đủ |
| Reaction / sticker / GIF / voice | Chat MVP P2 |
| Đồng bộ Zalo OA / Messenger | D8 |
| Portal / login riêng cho khách | Z15 / CSD D4 |
| Tự đăng ký, OTP Zalo, quên mật khẩu chat riêng | Z12 — mật khẩu = staff |
| QR kết bạn, username công khai, tìm SĐT toàn hệ | Chỉ directory nội bộ đã cấp chat |
| Pin, translate, task engine | UC-CHAT P2 |
| Âm thanh / desktop Notification API | Z10 |
| Dark theme Zalo | ops-web light tokens |

---

## 3. Map Zalo → RNOSAI

| Zalo PC/Web | CSD Dock v1 | Ghi chú |
|-------------|-------------|---------|
| Nút Chat góc + badge | `.csd-chat-launcher` | Số = unread conversations (API hiện có) |
| Cột danh sách | Pane `list` | Avatar initials, preview 1 dòng, time, unread pill, chấm đỏ nếu `has_p1_or_complaint` |
| Cửa sổ chat | Pane `thread` | Header tên + back + i + mở rộng + thu nhỏ |
| Bong bóng xanh (mình) / trắng (người kia) | `.is-mine` / `.is-theirs` | Mình = `author_staff_id === me_staff_id`. Khách (null author) = theirs + nhãn “Khách” |
| Tên trên bong bóng nhóm | Hiện `author_staff_name` khi **không** phải mình | DM cũng hiện nếu khác mình |
| Avatar tròn | Initials 2 chữ từ tên; client = `KH`; không có URL ảnh staff | Màu hash từ `staff_id` hoặc `KH` |
| Mốc ngày | Chip “Hôm nay / Hôm qua / dd/MM/yyyy” khi đổi ngày VN | Timezone `Asia/Ho_Chi_Minh` |
| Composer đáy | Textarea + 📎 + Gửi | Enter gửi, Shift+Enter xuống dòng (giữ C-2) |
| Banner “gửi khách” | Giữ nguyên Client Chat | An toàn nội bộ ≠ khách |
| Menu tin (⋯) | Reply / Ticket / Sửa / Xóa / Copy / Forward | Không luôn hiện hàng nút |
| Thu nhỏ | Launcher lại hiện, nhớ `conversationId` | Click launcher mở lại đúng pane |
| Mở rộng cửa sổ | Link full page | Không phóng panel thành 3 cột trong dock |
| Ảnh trong chat | `<img>` thumbnail, click tải như C-3 | Không lightbox gallery v1 |
| Đã xem | Unread count = 0 sau `mark read` khi mở thread | Không tick ✓✓ xanh (không có receipt API) |
| Đăng nhập Zalo | `/login` RNOSAI | Không form login trong dock |
| Đăng ký Zalo | **Cấm.** Admin tạo NV + bật Chat | Không “Tạo tài khoản” public |
| Danh bạ / kết bạn | Tab Danh bạ + Lời mời | DM chỉ khi accepted |
| Tìm bạn | Search staff đã `enabled` | Không crawl cả org chưa cấp chat |

---

## 4. Kiến trúc UI

```text
StaffPageShell
├── OpsNav                    (badge Chat giữ nguyên, poll riêng)
├── SlaAlertToastHost
├── B2bHotAlarm
├── OpsPage                   (nội dung trang)
└── CsdChatDock               (mới; client-only)
    ├── CsdChatLauncher       FAB
    └── CsdChatPanel          khi open
        ├── tabs: messages | contacts | requests
        ├── CsdChatList       density=dock
        ├── CsdChatContacts   danh bạ + tìm + kết bạn
        ├── CsdChatThread     density=dock | page
        └── CsdChatContext    chỉ sheet ngắn trên dock; cột phải trên page

/admin/crm/csd/chat-accounts     (mới; cap csd.admin)
/login                           (giữ — cổng duy nhất)
```

**Tách state:** `useCsdChatSession(token, { canWrite })` — logic load/send/ticket hiện nằm trong `CsdChatWorkspace` (~650 dòng). Workspace full page và Dock **cùng hook**, không copy API.

| Đơn vị | Làm gì | Phụ thuộc |
|--------|--------|-----------|
| `useCsdChatSession` | conversations, messages, members, tickets, draft, poll, mutations | `csd-api.ts` |
| `CsdChatList` | list + filter + search + Mới | session + `density` |
| `CsdChatThread` | header + bubbles + composer + ⋯ | session + `density` |
| `CsdChatWorkspace` | grid 3 cột page | session + context + AI |
| `CsdChatDock` | launcher, panel, persist, hide-on-chat-route, ẩn nếu chưa `chat_enabled` | session + `usePathname` + `/chat/me` |
| `CsdChatContacts` | danh bạ, tìm người, gửi/hủy lời mời, mở DM | friends API |
| `CsdChatBubble` | một tin: avatar, quote, body, files, ticket pill | message + `isMine` |
| `CsdChatAccountsAdmin` | bật/tắt/tạo từ staff, xem bạn, gỡ bạn | `csd.admin` |

`CsdChatNewModal` và dialog trùng ticket / forward **dùng lại**; trên dock chúng là overlay trong panel (`position: absolute` trong panel, không full-viewport trừ mobile).

### 4.1. Mount & ẩn

- `StaffPageShell` render `<CsdChatDock user={user} />` khi `user` khác null (**đã đăng nhập**).  
- Token: `getAccessToken()` từ `@/lib/auth` (cùng `ptt_ops_access_token`). **Không** gọi `useCsdPageAuth` — hook đó `replace('/403')` nếu thiếu cap, sẽ đá staff khỏi Lead/Hub.  
- `GET /api/crm/csd/chat/me` → `{ enabled: true }` mới hiện launcher. `enabled: false` → không render (im lặng).  
- `usePathname()` === `/crm/csd/chat` → **không render** launcher/panel (trang Chat là nguồn sự thật).  
- Không cap `csd.view` → không render (im lặng, không toast, không 403).  
- `/login`, `/login/mfa`, `/login/callback` không dùng `StaffPageShell` → không có dock. Hết hạn 401 → `clearSession` + `/login` như shell hiện tại.

### 4.2. Poll

| Nguồn | Interval | Khi nào |
|-------|----------|---------|
| `GET /chat/unread-count` | 15s | Dock mounted, mọi pane |
| `GET /conversations` | 15s | Pane list **hoặc** panel open |
| `GET /conversations/:id/messages` | 15s | Pane thread + `conversationId` |
| `GET /chat/friends/requests` | 15s | Panel open (badge tab Lời mời) |

Tab ẩn (`document.visibilityState === 'hidden'`): dừng poll, resume khi hiện lại. Không poll khi panel đóng **ngoại trừ** unread-count (để badge sống).

OpsNav tiếp tục poll unread riêng — chấp nhận 2 request/15s. Không bắt OpsNav dùng context dock (tránh vòng import).

### 4.3. Persist

```json
{ "open": true, "tab": "messages", "pane": "thread", "conversationId": "uuid" }
```

- Thiếu / JSON lỗi → `{ open: false, pane: "list", conversationId: null }`.  
- Conversation bị 404 / không còn quyền → về pane list, xóa `conversationId`.  
- Không persist draft (tránh gửi nhầm sau nhiều giờ).

---

## 5. Layout & visual (ops-web tokens)

Không invent dark Zalo. Map token hiện có:

| Bề mặt | Token / giá trị |
|--------|-----------------|
| Panel nền | `#fff`, radius 12, shadow `0 12px 40px rgba(15,23,42,.18)` |
| Launcher | `--accent` `#2563eb`, tròn 56px |
| Badge | `#dc2626` trắng, 18px, góc launcher |
| Bong bóng mình | `#dbeafe` / chữ `#1e3a8a` |
| Bong bóng người | `#f1f5f9` / chữ `#0f172a` |
| Client banner | giữ `#fef3c7` (UX §0 Internal vs Client) |
| P1 list | border-left `#dc2626` (đã có `.is-risk`) |
| AI | không hiện trong dock; chỉ full page |

### 5.1. Desktop (≥961px)

```text
Viewport
┌──────────────────────────────────────────┐
│  Sidebar     │  Trang CRM đang mở        │
│              │                           │
│              │              ┌──────────┐ │
│              │              │ Panel    │ │
│              │              │ 380×560  │ │
│              │              └──────────┘ │
│              │                    (○ 12) │  ← launcher khi đóng
└──────────────────────────────────────────┘
```

- Panel: `position: fixed; right: 20px; bottom: 84px; width: 380px; height: min(560px, calc(100vh - 120px)); z-index: 40`.  
- Launcher: `right: 20px; bottom: 20px; z-index: 41`.  
- `SlaAlertToastHost` / `B2bHotAlarm` giữ z hiện tại; dock **không** đè modal `.page-card` dialog (ticket/forward dùng z-index ≥ 50 trong panel).  
- Không kéo-resize v1.

### 5.2. Mobile (≤960px)

- Launcher giữ góc phải.  
- Panel = full screen trừ an toàn notch (`inset: 0`, `z-index: 45`).  
- Một pane: list **hoặc** thread (reuse `mobilePane` C-4).  
- Nút X / back đóng về launcher, không để staff kẹt không thấy CRM.

### 5.3. List item (Zalo)

```text
[AB]  Tên hội thoại          14:32
      Preview một dòng…        (2)
```

- Avatar 36px.  
- Time: `HH:mm` nếu hôm nay, `Hôm qua`, còn lại `dd/MM`.  
- Unread pill chỉ khi `unread_count > 0`.  
- Active: nền `#eff6ff` như filter chip hiện tại.

### 5.4. Thread

Header: `←` (về list) · tên (1 dòng, ellipsis) · `i` · `⛶ Mở rộng` · `—` thu nhỏ.

Timeline: `flex-direction: column`, scroll trong vùng giữa, composer sticky đáy.

Bong bóng:

- `.is-mine`: `align-self: flex-end`, không hiện avatar (Zalo PC).  
- `.is-theirs`: `align-self: flex-start` + avatar 28px.  
- Max-width 78%.  
- Quote reply: bar trái trong bong bóng.  
- Đã xóa: italic “Đã xóa”, không bong bóng màu.  
- Menu ⋯: hiện khi hover (desktop) hoặc long-press (mobile). Dock hẹp: ⋯ luôn hiện icon, menu dropdown lên trên.

Composer: 1 hàng icon 📎 | textarea auto-grow max 5 dòng | nút Gửi (disabled khi empty + không file). Closed/archived: ẩn composer, CTA Mở lại (C-4).

### 5.5. Full page `/crm/csd/chat`

- Grid 3 cột **giữ**.  
- Cột giữa dùng cùng `CsdChatThread` `density=page` (bong bóng, ⋯, date chip).  
- Cột trái dùng cùng list (avatar).  
- `PageToolbar` đổi subtitle: “Hộp thoại — DM, nhóm, khách, dự án”.  
- Không hiện dock.

---

## 6. Luồng chính

### 6.1. Mở từ bất kỳ trang CRM

1. Staff có `csd.view` thấy launcher.  
2. Click → panel pane list (hoặc thread nếu persist còn `conversationId`).  
3. Chọn hội thoại → `mark read` + load messages + pane thread.  
4. Gửi tin → optimistic append **không bắt buộc** v1; chờ POST rồi reload thread + list (như C-1).  
5. **Mở rộng** → `router.push(/crm/csd/chat?c=id)` và `open=false`.

### 6.2. Deep link từ notify / copy link

- URL `/crm/csd/chat?c=` vẫn mở full page (C-4).  
- Không tự mở dock khi vào deep link (đang ở trang Chat → dock ẩn).

### 6.3. Tạo hội thoại / ticket từ dock

- **Mới** mở `CsdChatNewModal` trong panel.  
- Tạo ticket / trùng source / forward: cùng dialog C-4, scoped trong panel.  
- Sau tạo ticket: pill trên tin + có thể “Mở ticket” (cùng tab, dock vẫn open).

### 6.4. Client Chat

Giữ banner vàng + không đổi rule BR-AI-01. AI summary **không** có nút trên dock. **Không** tạo `csd_chat_accounts` cho khách.

### 6.5. Đăng nhập (Z13)

```text
Chưa có session     → /login (form staff hiện có)
Sai email/mật khẩu  → lỗi login hiện có; không lộ “chưa có chat”
Login OK, MFA       → /login/mfa như cũ
Login OK, chưa bật chat → vào CRM bình thường; không dock; /crm/csd/chat hiện
                        “Tài khoản chat chưa được Admin cấp — liên hệ quản trị.”
Login OK + enabled  → dock + full chat
Admin tắt chat      → dock biến mất lần poll /me tiếp theo; thread mở 403
```

- Không form “Đăng nhập Chat” trong dock.  
- Không “Ghi nhớ chat riêng”. Session = staff.  
- Admin tạo NV mới: wizard `/admin/crm/org/users/new` (email + mật khẩu tạm) **rồi** bật Chat ở `/admin/crm/csd/chat-accounts`. Có thể bật ngay trên cùng trang Admin Chat bằng cách chọn staff đã có.

### 6.6. Admin cấp tài khoản chat (Z12)

Route: `/admin/crm/csd/chat-accounts` — cap `csd.admin`.

| Việc | Hành vi |
|------|---------|
| Danh sách | Staff đã/chưa bật chat; tìm tên/email |
| Bật | Chọn `staff_id` chưa có hàng hoặc `enabled=false` → `enabled=true`, `created_by_staff_id` = admin |
| Tắt | `enabled=false`. Không xóa bạn, không xóa tin. User không gửi được; dock ẩn |
| Gỡ bạn | Admin xóa 1 friendship (cả hai phía) |
| Không có | Xóa cứng staff, self-serve “xin cấp chat”, tự đặt username |

Bật chat **không** tự cấp `csd.view` — Admin phải bảo đảm permission set CSD (hoặc wizard org đã gán). Nếu bật nhưng thiếu `csd.view` → dock vẫn ẩn (Z3 AND).

Audit: `csd_audit_logs` action `chat_account.enable` / `chat_account.disable` / `chat_friend.admin_remove`.

### 6.7. Kết bạn (Z14)

Trạng thái: `pending` | `accepted` | `blocked`.

```text
A tìm B (enabled) → Kết bạn
  → 1 hàng friendships (requester=A, addressee=B, pending)
  → B thấy tab Lời mời; notify kind=chat_friend_request
B Accept → accepted; A/B vào danh bạ; A hoặc B bấm → get-or-create DM
B Reject → xóa hàng pending (A có thể gửi lại sau 24h — chống spam)
A Hủy lời mời đang pending
A hoặc B Hủy kết bạn khi accepted → xóa friendship; DM cũ còn (Z16) nhưng không tạo DM mới
A Chặn B → blocked; B không tìm thấy A; không gửi lời mời; không tạo DM
```

- Không kết bạn với chính mình.  
- Một cặp staff tối đa một hàng (unique `least(a,b), greatest(a,b)`).  
- Group / Client / Project: thêm member **không** check bạn (chat việc).  
- `POST /conversations` `kind=direct`: nếu chưa `accepted` → **409** `{ error: "not_friends" }`. UI: “Hãy gửi kết bạn trước.”  
- Modal **Mới → DM**: chỉ list bạn accepted.

### 6.8. Tab dock

| Tab | Nội dung |
|-----|----------|
| Tin nhắn | List hội thoại như §5.3 |
| Danh bạ | Bạn accepted; click → DM; ô tìm người **chưa là bạn** + nút Kết bạn |
| Lời mời | Incoming pending: Chấp nhận / Từ chối; outgoing: Hủy. Badge số incoming |

Full page `/crm/csd/chat`: thêm cùng 3 tab phía trên list (không chỉ dock).

---

## 7. API & schema (v1.1)

### 7.1. DDL mới (idempotent, thêm vào `docs/specs/2026-09-02-postgresql-ddl-csd.sql` hoặc file patch `...-csd-chat-accounts.sql`)

```sql
CREATE TABLE IF NOT EXISTS csd_chat_accounts (
  staff_id              integer PRIMARY KEY,
  tenant_id             text NOT NULL DEFAULT 'PTT',
  enabled               boolean NOT NULL DEFAULT true,
  display_name_vi       text,
  created_by_staff_id   integer NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS csd_chat_friendships (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL DEFAULT 'PTT',
  staff_lo              integer NOT NULL,
  staff_hi              integer NOT NULL,
  requester_staff_id    integer NOT NULL,
  addressee_staff_id    integer NOT NULL,
  status                text NOT NULL CHECK (status IN ('pending','accepted','blocked')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (staff_lo < staff_hi),
  UNIQUE (tenant_id, staff_lo, staff_hi)
);

CREATE INDEX IF NOT EXISTS csd_chat_friendships_inbox_idx
  ON csd_chat_friendships (addressee_staff_id, status);
```

`staff_lo` / `staff_hi` = `LEAST/GREATEST` hai staff id. `blocked`: `requester` = người chặn; `addressee` = bị chặn.

Không cột mật khẩu. Không flag env mới. `PTT_CSD_LLM` vẫn tắt trên VPS.

### 7.2. API mới

Prefix `/api/crm/csd`. Auth staff JWT.

| Method | Path | Cap | Việc |
|--------|------|-----|------|
| GET | `/chat/me` | view | `{ enabled, display_name_vi, staff_id }` — `enabled=false` nếu không có hàng hoặc tắt |
| GET | `/chat/people?q=` | view + enabled | Directory staff `enabled`, q ≥ 2 ký tự, max 20; không trả người bị mình block / block mình |
| GET | `/chat/friends` | view + enabled | Bạn `accepted` |
| GET | `/chat/friends/requests` | view + enabled | `{ incoming, outgoing }` pending |
| POST | `/chat/friends` body `{ staff_id }` | write + enabled | Tạo pending; 409 nếu đã có; 404 nếu target chưa enabled |
| POST | `/chat/friends/:id/accept` | write + enabled | Chỉ addressee |
| POST | `/chat/friends/:id/reject` | write + enabled | Chỉ addressee; xóa pending |
| DELETE | `/chat/friends/:id` | write + enabled | Hủy pending (requester) hoặc unfriend (accepted, một trong hai) |
| POST | `/chat/friends/:id/block` | write + enabled | Đặt blocked |
| GET | `/admin/chat-accounts` | admin | List + filter |
| POST | `/admin/chat-accounts` `{ staff_id, enabled }` | admin | Upsert bật/tắt |
| DELETE | `/admin/chat-accounts/:staffId/friends/:friendshipId` | admin | Gỡ bạn |

### 7.3. API cũ — siết

| Việc | Endpoint | Đổi |
|------|----------|-----|
| Badge | `GET /chat/unread-count` | 404/empty nếu `!enabled` (UI coi = 0) |
| Tạo DM | `POST /conversations` kind=direct | **409 `not_friends`** nếu chưa accepted (Z16) |
| Gửi tin | `POST .../messages` | 403 nếu `!enabled` |
| Còn lại | list/messages/file/ticket/… | Giữ C-1…C-4; thành viên hội thoại cũ vẫn đọc |

### 7.4. Frontend helpers (không API)

- `initialsFromName(name)`  
- `avatarHue(seed)`  
- `formatChatListTime(iso)` / `formatDateChip(iso)` (VN)

---

## 8. Lỗi & biên

| Tình huống | Hành vi |
|------------|---------|
| 401 | Dock ẩn; không spam toast (session hết hạn = shell đã redirect `/login`) |
| 403 cap | Không mount |
| `enabled=false` | Dock ẩn; full page thông báo Admin cấp |
| 409 `not_friends` | Dialog “Hãy gửi kết bạn trước” + CTA Danh bạ |
| List/send lỗi | Banner đỏ trong panel, không crash trang CRM |
| Poll lỗi | Giữ data cũ; không xóa list |
| File > hạn C-3 | Giữ thông báo C-3 |
| Conversation archived | Composer khóa + Mở lại |
| Không có hội thoại | Empty: “Chưa có hội thoại” + Mới nếu write |
| z-index vs modal CRM khác | Dock z 40–41; nếu trang có modal full-screen, dock vẫn click được — chấp nhận v1 (staff thu nhỏ bằng —) |

Không queue offline (UX CSD §396 = P2).

---

## 9. A11y

- Launcher: `button` aria-label `Chat` + `aria-expanded` + badge `aria-label="{n} hội thoại chưa đọc"`.  
- Panel: `role="dialog"` `aria-label="Chat Service Desk"`.  
- Esc: pane thread → list; pane list → đóng dock.  
- Focus trap **không** bắt buộc (staff còn làm việc trên trang CRM). Esc đủ.  
- Contrast bong bóng chữ trên `#dbeafe` / `#f1f5f9` đạt AA.  
- Chip ngày và unread có chữ, không chỉ màu.

---

## 10. Kiểm thử

### 10.1. Jest

- Util: `formatChatListTime` / `initialsFromName` nếu tách.  
- `csd-chat-friends.service.spec.ts`: pending → accept → DM ok; chưa bạn → 409; block ẩn directory; không self-friend; unique pair.  
- `csd-chat-accounts.service.spec.ts`: chỉ admin upsert; disable chặn send; `/me` enabled false.

### 10.2. Playwright (`e2e/csd-chat.spec.ts`)

**C-5** dock (mock API như C-4):

1. `/crm/csd` + `chat/me.enabled` + cap view → `[data-testid=csd-chat-launcher]`.  
2. Click launcher → list; click hội thoại → `.is-mine` / `.is-theirs`.  
3. Gửi tin qua dock → POST messages.  
4. `/crm/csd/chat` → **không** có launcher.  
5. `?c=` không regress C-4.

**C-6** tài khoản + kết bạn (mock):

1. `chat/me.enabled=false` → không launcher.  
2. Tab Danh bạ → Kết bạn → POST `/chat/friends`.  
3. Tab Lời mời → Accept → mở được DM.  
4. Tạo DM khi chưa bạn → UI hiện `not_friends`.  
5. `/admin/crm/csd/chat-accounts` (mock admin) → bật staff.

### 10.3. UAT tay trên VPS

1. Chưa login → `/login`; login xong vào `/crm/leads`.  
2. Staff chưa bật chat: không launcher; `/crm/csd/chat` báo Admin cấp.  
3. Admin (`csd.admin`) bật 2 NV → cả hai login thấy dock.  
4. A kết bạn B; B chấp nhận; A mở DM gửi tin.  
5. A tạo DM C chưa bạn → bị chặn.  
6. Group/Client tạo bình thường không cần bạn.  
7. Admin tắt A → dock A biến mất; tin cũ còn trong DB.  
8. UAT dock hình thức: badge, F5 nhớ hội thoại, banner khách, mobile 390px.

---

## 11. Sóng triển khai (sau khi duyệt spec)

Một plan, năm task reviewable:

| Sóng | Việc | Xong khi |
|------|------|----------|
| **D-1** | Tách `useCsdChatSession` + restyle bubble/list trên `/crm/csd/chat` | Full page giống Zalo; C-1…C-4 e2e xanh |
| **D-2** | `CsdChatDock` + mount `StaffPageShell` + persist + ẩn trên chat route | UAT G1/G2 |
| **D-3** | Thumbnail ảnh, menu ⋯, date chip, sheet `i`, e2e C-5 | Dock visual đủ |
| **D-4** | DDL accounts + `/chat/me` + Admin `/admin/crm/csd/chat-accounts` + gate login/enabled | G6; không tự đăng ký |
| **D-5** | Friends API + tab Danh bạ/Lời mời + siết DM `not_friends` + e2e C-6 + guide 29 | G7 |

Không merge D-2 nếu D-1 làm vỡ ticket/mention/file. D-5 **sau** D-4 (DM gate cần `enabled`).

---

## 12. Acceptance

- [ ] Launcher chỉ hiện khi **đã login** + `csd.view` + `chat/me.enabled` và **không** ở `/crm/csd/chat`.  
- [ ] Chưa login → `/login`; không form đăng ký chat; không mật khẩu chat riêng.  
- [ ] Admin `csd.admin` bật/tắt tài khoản; tắt → dock ẩn, không xóa tin.  
- [ ] Kết bạn: pending → accept → DM; chưa bạn → 409 + UI; Group/Client không cần bạn.  
- [ ] Badge = unread-count; poll 15s; dừng khi tab ẩn.  
- [ ] Mở list → thread → gửi / reply / file / ticket / ⋯ như C-4 trong dock.  
- [ ] Bong bóng mình phải, người khác trái; avatar initials; mốc ngày.  
- [ ] Client Chat: banner “Bạn đang gửi cho khách hàng”; khách không có login chat.  
- [ ] Mở rộng → `/crm/csd/chat?c=`.  
- [ ] sessionStorage nhớ open/pane/id trong tab.  
- [ ] Mobile một pane, đóng được về trang CRM.  
- [ ] Không WS, không Zalo OA, không reaction, không multi-window, không portal khách.  
- [ ] Guide `29-csd-service-desk.md` thêm mục “Hộp thoại Chat”, “Tài khoản & kết bạn” + UAT 2f / 2g.

---

## 13. Tác động tài liệu

| File | Việc khi implement |
|------|--------------------|
| `29-csd-service-desk.md` | Dock + tài khoản Admin + kết bạn + UAT 2f / 2g |
| `2026-09-02-agency-csd-ux-ui-design.md` §5 | §5.8 Chat Dock + §5.9 Danh bạ |
| DDL CSD | Patch `csd_chat_accounts` / `csd_chat_friendships` |
| Plan CSD Chat MVP gap | Wave D-1…D-5 sau MVP |

---

## 14. Rủi ro

| Rủi ro | Giảm |
|--------|------|
| `CsdChatWorkspace` phình thêm | Bắt buộc extract hook ở D-1 trước dock |
| Poll kép OpsNav + Dock | 15s, pause hidden; không WS |
| Dock che CTA trang | Góc phải dưới; thu nhỏ một click |
| Staff nhầm dock = Zalo OA | Copy launcher: “Chat nội bộ”; Client banner giữ |
| z-index chiến | Dock 40–41; dialog nội bộ ≥ 50 |
| Hai identity (chat vs staff) | Z11 — một `/login`, một mật khẩu |
| Self-signup lọt API | Không route register; test 404/401 path giả |
| Admin quên cấp `csd.view` | Bật chat không đủ; dock ẩn; UI admin ghi chú cap |
