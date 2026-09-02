# CSD Chat Dock (Zalo-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa Chat CSD thành hộp thoại nổi kiểu Zalo trên CRM, cùng visual bong bóng trên `/crm/csd/chat`; tài khoản do Admin cấp; đăng nhập `/login`; kết bạn trước khi tạo DM mới.

**Architecture:** Tách `useCsdChatSession` từ `CsdChatWorkspace` để full page và `CsdChatDock` (mount `StaffPageShell`) dùng chung. Wave D-4/D-5 thêm `csd_chat_accounts` + `csd_chat_friendships`; `GET /chat/me` gate dock; `POST /conversations` kind=direct trả 409 `not_friends` nếu chưa accepted. Không WebSocket, không portal khách, không mật khẩu chat thứ hai.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · PostgreSQL `csd_*` · Jest · Playwright mock · sessionStorage `csd.chat.dock.v1`.

## Global Constraints

- Spec: [`docs/superpowers/specs/2026-09-02-csd-chat-dock-zalo-design.md`](../specs/2026-09-02-csd-chat-dock-zalo-design.md) v1.1 — Z1…Z16 bắt buộc.
- Prefix `/api/crm/csd`. Cấm ghi `crm_tickets` / `ceo_command_*`. Không route register/signup chat.
- Staff id = **INTEGER** `crm_staff.id` (JWT qua `resolveCrmStaffUserId`). `tenant_id='PTT'`.
- Đăng nhập **chỉ** `/login` staff. Dock **không** gọi `useCsdPageAuth` (hook đó `replace('/403')`).
- Client Chat: banner vàng; không cấp `csd_chat_accounts` cho khách (Z15).
- `PTT_CSD_LLM` giữ `0` trên VPS. Không flag env mới.
- Poll 15s; pause khi `document.visibilityState === 'hidden'`. Không âm thanh, không WS, không multi-window.
- Copy UI tiếng Việt. Không badge Stub. Factory MVP `A` only.
- Reject lời mời: **xóa hàng pending**, gửi lại được ngay (không làm cooldown 24h — YAGNI).
- D-2 tạm hiện dock với `csd.view`; D-4 siết thêm `chat/me.enabled`.
- P2 **không** làm: reaction, sticker, voice, Zalo OA, portal khách, QR, username public.

## Đã ship (không làm lại)

C-1…C-4 trên `/crm/csd/chat` (`415d687c`): DM/group/client/project, search, mention, file, edit/delete, notify, keyword P1, duplicate ticket, archive, forward, unread badge, deep link `?c=`.

## File map

| File | Responsibility |
|------|----------------|
| `docs/specs/2026-09-02-postgresql-ddl-csd.sql` | Append `csd_chat_accounts` + `csd_chat_friendships` (IF NOT EXISTS) |
| `services/ptt-crm-api/src/csd/csd.types.ts` | DTO account / friendship / people |
| `services/ptt-crm-api/src/csd/csd-chat-display.util.ts` | initials, hue, date chips (copy sang ops-web cùng logic) |
| `services/ops-web/src/lib/crm/csd-chat-display.ts` | Cùng hàm display (frontend) |
| `services/ptt-crm-api/src/csd/csd-chat-accounts.repository.ts` | CRUD accounts + people search |
| `services/ptt-crm-api/src/csd/csd-chat-accounts.service.ts` | `/chat/me`, admin upsert, `assertEnabled` |
| `services/ptt-crm-api/src/csd/csd-chat-accounts.controller.ts` | GET me + admin routes |
| `services/ptt-crm-api/src/csd/csd-chat-friends.repository.ts` | Friendship rows |
| `services/ptt-crm-api/src/csd/csd-chat-friends.service.ts` | Invite/accept/reject/block + `isAccepted` |
| `services/ptt-crm-api/src/csd/csd-chat-friends.controller.ts` | Friends HTTP |
| `services/ptt-crm-api/src/csd/csd-chat.service.ts` | `assertEnabled` trên send; `not_friends` trên DM mới |
| `services/ptt-crm-api/src/csd/csd.module.ts` | Register providers |
| `services/ops-web/src/lib/crm/csd-api.ts` | Fetch wrappers mới |
| `services/ops-web/src/components/crm/csd/useCsdChatSession.ts` | State + mutations chat |
| `services/ops-web/src/components/crm/csd/CsdChatBubble.tsx` | Một tin bong bóng |
| `services/ops-web/src/components/crm/csd/CsdChatWorkspace.tsx` | Thin 3-cột page |
| `services/ops-web/src/components/crm/csd/CsdChatList.tsx` | List + avatar + density |
| `services/ops-web/src/components/crm/csd/CsdChatThread.tsx` | Bubbles + ⋯ + composer |
| `services/ops-web/src/components/crm/csd/CsdChatDock.tsx` | Launcher + panel |
| `services/ops-web/src/components/crm/csd/CsdChatContacts.tsx` | Danh bạ + lời mời |
| `services/ops-web/src/components/layout/StaffPageShell.tsx` | Mount dock |
| `services/ops-web/src/app/admin/crm/csd/chat-accounts/page.tsx` | Admin cấp chat |
| `services/ops-web/src/app/globals.css` | Dock + bubble tokens |
| `services/ops-web/e2e/csd-chat.spec.ts` | C-5, C-6 |
| `docs/huong-dan-su-dung/29-csd-service-desk.md` | Hộp thoại + tài khoản + kết bạn |

## Slices

| Slice | Task | UAT xong khi |
|-------|------|----------------|
| **D-1** | 1–2 | Full page bong bóng; hook tách; C-1…C-4 không regress |
| **D-2** | 3 | Launcher trên `/crm/leads`; ẩn trên `/crm/csd/chat` |
| **D-3** | 4 | Ảnh thumbnail, ⋯, date chip, sheet `i`, e2e C-5 |
| **D-4** | 5–6 | Admin bật/tắt; `/chat/me`; chưa cấp → không dock |
| **D-5** | 7–8 | Kết bạn → DM; chưa bạn → 409; e2e C-6 + guide |

Mỗi task commit riêng. Deploy VPS sau Task 8 (hoặc sau mỗi slice nếu user yêu cầu).

---

### Task 1: Display utils (initials, hue, time)

**Files:**
- Create: `services/ops-web/src/lib/crm/csd-chat-display.ts`
- Create: `services/ops-web/src/lib/crm/csd-chat-display.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-display.util.ts` (re-export cùng logic nếu API cần — **không bắt buộc** dùng phía Nest; chỉ tạo file ops-web nếu không import chéo)

**Interfaces:**
- Consumes: none
- Produces:

```ts
export function initialsFromName(name: string | null | undefined, fallback = 'KH'): string;
export function avatarHue(seed: string | number | null | undefined): number; // 0–359
export function formatChatListTime(iso: string | null | undefined, now?: Date): string;
export function formatDateChip(iso: string | null | undefined, now?: Date): string | null;
export function shouldShowDateChip(prevIso: string | null | undefined, currIso: string): boolean;
```

Timezone cố định `Asia/Ho_Chi_Minh`. `formatChatListTime`: hôm nay → `HH:mm`; hôm qua → `Hôm qua`; khác → `dd/MM`. `formatDateChip`: `Hôm nay` / `Hôm qua` / `dd/MM/yyyy`.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  avatarHue,
  formatChatListTime,
  formatDateChip,
  initialsFromName,
  shouldShowDateChip,
} from './csd-chat-display';

describe('csd-chat-display', () => {
  it('initialsFromName takes two letters', () => {
    expect(initialsFromName('Nguyễn Văn An')).toBe('NA');
    expect(initialsFromName('')).toBe('KH');
    expect(initialsFromName(null)).toBe('KH');
  });

  it('avatarHue is stable 0-359', () => {
    expect(avatarHue(8)).toBe(avatarHue(8));
    expect(avatarHue(8)).toBeGreaterThanOrEqual(0);
    expect(avatarHue(8)).toBeLessThan(360);
  });

  it('formats list time and date chips in VN', () => {
    const now = new Date('2026-09-02T10:00:00+07:00');
    expect(formatChatListTime('2026-09-02T08:05:00+07:00', now)).toMatch(/08:05/);
    expect(formatChatListTime('2026-09-01T08:05:00+07:00', now)).toBe('Hôm qua');
    expect(formatDateChip('2026-09-02T08:05:00+07:00', now)).toBe('Hôm nay');
    expect(shouldShowDateChip('2026-09-01T23:00:00+07:00', '2026-09-02T01:00:00+07:00')).toBe(true);
    expect(shouldShowDateChip('2026-09-02T01:00:00+07:00', '2026-09-02T08:00:00+07:00')).toBe(false);
  });
});
```

ops-web unit = Vitest (`npm run test:unit`). Import `vitest` như trên.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-display.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
const TZ = 'Asia/Ho_Chi_Minh';

function vnParts(d: Date): { y: number; m: number; day: number; hh: string; mm: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: Number(map.year), m: Number(map.month), day: Number(map.day), hh: map.hour, mm: map.minute };
}

function dayKey(d: Date): string {
  const p = vnParts(d);
  return `${p.y}-${p.m}-${p.day}`;
}

export function initialsFromName(name: string | null | undefined, fallback = 'KH'): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarHue(seed: string | number | null | undefined): number {
  const s = String(seed ?? 'KH');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function formatChatListTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const a = vnParts(d);
  const b = vnParts(now);
  const today = `${b.y}-${b.m}-${b.day}`;
  const that = `${a.y}-${a.m}-${a.day}`;
  if (that === today) return `${a.hh}:${a.mm}`;
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (that === dayKey(yest)) return 'Hôm qua';
  return `${String(a.day).padStart(2, '0')}/${String(a.m).padStart(2, '0')}`;
}

export function formatDateChip(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const a = vnParts(d);
  const list = formatChatListTime(iso, now);
  if (list === 'Hôm qua') return 'Hôm qua';
  if (list.includes(':')) return 'Hôm nay';
  return `${String(a.day).padStart(2, '0')}/${String(a.m).padStart(2, '0')}/${a.y}`;
}

export function shouldShowDateChip(prevIso: string | null | undefined, currIso: string): boolean {
  if (!prevIso) return true;
  const a = new Date(prevIso);
  const b = new Date(currIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return true;
  return dayKey(a) !== dayKey(b);
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-display.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/csd-chat-display.ts services/ops-web/src/lib/crm/csd-chat-display.spec.ts
git commit -m "$(cat <<'EOF'
feat(csd): add Zalo-style chat display time and initials helpers.
EOF
)"
```

---

### Task 2: Extract session hook + bubble restyle on full page (D-1)

**Files:**
- Create: `services/ops-web/src/components/crm/csd/useCsdChatSession.ts`
- Create: `services/ops-web/src/components/crm/csd/CsdChatBubble.tsx`
- Modify: `services/ops-web/src/components/crm/csd/CsdChatWorkspace.tsx` — chỉ layout 3 cột + bind hook
- Modify: `services/ops-web/src/components/crm/csd/CsdChatThread.tsx` — render `CsdChatBubble`, class `.is-mine` / `.is-theirs`
- Modify: `services/ops-web/src/components/crm/csd/CsdChatList.tsx` — avatar initials + `formatChatListTime`
- Modify: `services/ops-web/src/app/globals.css` — bubble + list avatar (cuối khối `.csd-chat-*`)
- Modify: `services/ops-web/src/app/crm/csd/chat/page.tsx` — subtitle «Hộp thoại — DM, nhóm, khách, dự án»

**Interfaces:**
- Consumes: Task 1 display helpers; mọi fetch trong `csd-api.ts` mà workspace đang gọi
- Produces: `useCsdChatSession(opts: { token: string; canWrite: boolean; initialConversationId?: string | null }): CsdChatSession`

`CsdChatSession` **phải** expose đúng tên sau (Task 3/4 bind dock, không đổi tên):

```ts
export type CsdChatSession = {
  conversations: CsdConversationRow[];
  filter: CsdConversationListFilter;
  search: string;
  setSearch: (q: string) => void;
  setFilter: (f: CsdConversationListFilter) => void;
  showNewModal: boolean;
  setShowNewModal: (v: boolean) => void;
  activeId: string | null;
  active: CsdConversationRow | null;
  messages: CsdMessageRow[];
  meStaffId: number | null;
  pendingFiles: CsdAttachmentRow[];
  members: CsdConversationMemberRow[];
  relatedTickets: CsdTicketRow[];
  draft: string;
  setDraft: (v: string) => void;
  replyTo: CsdMessageRow | null;
  setReplyTo: (m: CsdMessageRow | null) => void;
  memberStaffId: string;
  setMemberStaffId: (v: string) => void;
  aiPeriod: '24h' | '7d' | 'all';
  setAiPeriod: (v: '24h' | '7d' | 'all') => void;
  aiSummary: { summary: string; decisions: string[]; actions: string[]; risks: string[]; ai_interaction_id?: string } | null;
  error: string;
  busy: boolean;
  ticketModal: CsdMessageRow | null;
  setTicketModal: (m: CsdMessageRow | null) => void;
  ticketForm: { title: string; ticket_type: string; priority: CsdPriority };
  setTicketForm: React.Dispatch<React.SetStateAction<{ title: string; ticket_type: string; priority: CsdPriority }>>;
  priorityHint: 'P1' | 'P2' | null;
  setPriorityHint: (v: 'P1' | 'P2' | null) => void;
  duplicateTicket: CsdTicketRow | null;
  setDuplicateTicket: (t: CsdTicketRow | null) => void;
  forwardMessage: CsdMessageRow | null;
  setForwardMessage: (m: CsdMessageRow | null) => void;
  forwardTargetId: string;
  setForwardTargetId: (v: string) => void;
  mobilePane: 'list' | 'thread' | 'context';
  setMobilePane: (p: 'list' | 'thread' | 'context') => void;
  isMobile: boolean;
  handleSelectConversation: (id: string) => Promise<void>;
  handleCreateConversation: (payload: CreateCsdConversationInput) => Promise<void>;
  handleSend: (e?: React.FormEvent) => Promise<void>;
  handleCreateTicket: (e: React.FormEvent) => Promise<void>;
  handleAddMember: () => Promise<void>;
  handleRemoveMember: (staffId: number) => Promise<void>;
  handleClose: () => Promise<void>;
  handleReopen: () => Promise<void>;
  handleArchive: () => Promise<void>;
  handlePickFile: (file: File) => Promise<void>;
  handleRemovePending: (fileId: string) => void;
  handleEditMessage: (message: CsdMessageRow, bodyText: string) => Promise<void>;
  handleDeleteMessage: (message: CsdMessageRow) => Promise<void>;
  handleForward: () => Promise<void>;
  handleCreateAiActionTicket: (actionIndex: number, title: string) => Promise<void>;
  handleSummarize: () => Promise<void>;
  handleCopyLink: (message: CsdMessageRow) => void;
};
```

`CsdChatBubble` props:

```ts
export type CsdChatBubbleProps = {
  token: string;
  message: CsdMessageRow;
  isMine: boolean;
  quoted: CsdMessageRow | null;
  ticketPill: string | null;
  ticketHref: string | null;
  closed: boolean;
  canWrite: boolean;
  busy: boolean;
  density: 'page' | 'dock';
  showName: boolean;
  onReply: (m: CsdMessageRow) => void;
  onCreateTicket: (m: CsdMessageRow) => void;
  onEdit: (m: CsdMessageRow, body: string) => void;
  onDelete: (m: CsdMessageRow) => void;
  onCopyLink: (m: CsdMessageRow) => void;
  onForward: (m: CsdMessageRow) => void;
};
```

- [ ] **Step 1: Write the failing e2e assertion (bubble class)**

Trong `services/ops-web/e2e/csd-chat.spec.ts`, thêm vào test C-1 hoặc test mới ngắn:

```ts
test('D-1: message bubbles use mine/theirs', async ({ page }) => {
  await mockCsdChatApis(page);
  await loginAsStaff(page);
  await page.goto('/crm/csd/chat');
  await page.getByTestId('csd-chat-list').locator('button').first().click();
  await expect(page.locator('.csd-chat-message.is-theirs, .csd-chat-message.is-mine')).toHaveCount(1);
});
```

`MESSAGE.author_staff_id` hiện = 3; mock `me_staff_id` nếu khác 3 → `.is-theirs`. Nếu `me_staff_id === 3` thì expect `.is-mine`. Khớp response `listMessages` hiện tại (`me_staff_id` trong `csd-chat.spec.ts` — đọc mock messages fulfill; nếu chưa trả `me_staff_id`, thêm `"me_staff_id": 99` để tin author 3 là theirs).

- [ ] **Step 2: Run e2e to verify it fails**

```bash
cd services/ops-web && npx playwright test e2e/csd-chat.spec.ts -g "D-1"
```

Expected: FAIL — class `.is-mine` / `.is-theirs` chưa có.

- [ ] **Step 3: Extract hook + bubble + CSS**

1. Cắt toàn bộ `useState` / `useEffect` / `handle*` từ `CsdChatWorkspace.tsx` sang `useCsdChatSession.ts`. Workspace còn:

```tsx
export function CsdChatWorkspace(props: {
  token: string;
  canWrite: boolean;
  initialConversationId?: string | null;
}) {
  const s = useCsdChatSession(props);
  return (
    <div className={`csd-chat-workspace${s.isMobile ? ` is-mobile is-${s.mobilePane}` : ''}`}>
      {/* bind CsdChatList / CsdChatThread / CsdChatContext + modals như hiện tại, dùng s.* */}
    </div>
  );
}
```

2. `CsdChatBubble`: `article.csd-chat-message.is-mine|is-theirs` + avatar initials nếu `!isMine`. Body / deleted / files / ticket pill / actions tạm **vẫn hiện hàng nút** (Task 4 mới gộp ⋯).

3. `CsdChatThread` map messages:

```tsx
const isMine = meStaffId != null && m.author_staff_id === meStaffId;
```

Khách `author_staff_id == null` → theirs + `showName` với «Khách».

4. CSS tối thiểu (append `globals.css`):

```css
.csd-chat-message {
  display: flex;
  flex-direction: column;
  max-width: 78%;
}
.csd-chat-message.is-mine { align-self: flex-end; }
.csd-chat-message.is-theirs { align-self: flex-start; }
.csd-chat-bubble {
  padding: 0.45rem 0.7rem;
  border-radius: 1rem;
  word-break: break-word;
}
.csd-chat-message.is-mine .csd-chat-bubble { background: #dbeafe; color: #1e3a8a; }
.csd-chat-message.is-theirs .csd-chat-bubble { background: #f1f5f9; color: #0f172a; }
.csd-chat-avatar {
  width: 28px; height: 28px; border-radius: 999px;
  display: grid; place-items: center;
  color: #fff; font-size: 0.7rem; font-weight: 600;
}
.csd-chat-list__item { grid-template-columns: 36px 1fr; align-items: center; gap: 0.5rem; }
```

List item: cột trái avatar (`initialsFromName(name_vi)` + `hsl(avatarHue(id) 55% 42%)`).

Không đổi poll 5s trên full page (đã ship). Dock (Task 3) dùng 15s.

- [ ] **Step 4: Run tests**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='src/csd' --no-coverage
cd services/ops-web && npx playwright test e2e/csd-chat.spec.ts
```

Expected: Jest 82+ pass; Playwright C-1…C-4 + D-1 pass.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/crm/csd services/ops-web/src/app/globals.css services/ops-web/src/app/crm/csd/chat/page.tsx services/ops-web/e2e/csd-chat.spec.ts
git commit -m "$(cat <<'EOF'
feat(csd): extract chat session hook and Zalo message bubbles.
EOF
)"
```

---

### Task 3: Chat Dock on StaffPageShell (D-2)

**Files:**
- Create: `services/ops-web/src/components/crm/csd/CsdChatDock.tsx`
- Create: `services/ops-web/src/lib/crm/csd-chat-dock-persist.ts`
- Modify: `services/ops-web/src/components/layout/StaffPageShell.tsx`
- Modify: `services/ops-web/src/app/globals.css`
- Modify: `services/ops-web/src/lib/crm/csd-api.ts` — reuse `fetchCsdChatUnreadCount`

**Interfaces:**
- Consumes: `useCsdChatSession`, `CsdChatList`, `CsdChatThread`, `CsdChatNewModal`, `hasCap` + `getAccessToken` từ `@/lib/auth`, `usePathname` từ `next/navigation`
- Produces: `<CsdChatDock user={StoredStaffUser | null} />`

Persist:

```ts
export type CsdDockPersist = {
  open: boolean;
  tab: 'messages' | 'contacts' | 'requests';
  pane: 'list' | 'thread';
  conversationId: string | null;
};
export const CSD_DOCK_STORAGE_KEY = 'csd.chat.dock.v1';
export function readCsdDockPersist(): CsdDockPersist;
export function writeCsdDockPersist(next: CsdDockPersist): void;
```

Default khi JSON lỗi: `{ open: false, tab: 'messages', pane: 'list', conversationId: null }`. Task 3 chỉ dùng `tab: 'messages'` (tab contacts/requests Task 8).

- [ ] **Step 1: Write failing persist unit + e2e launcher**

`services/ops-web/src/lib/crm/csd-chat-dock-persist.spec.ts`:

```ts
import { readCsdDockPersist, writeCsdDockPersist, CSD_DOCK_STORAGE_KEY } from './csd-chat-dock-persist';

it('returns default on bad json', () => {
  sessionStorage.setItem(CSD_DOCK_STORAGE_KEY, '{');
  expect(readCsdDockPersist().open).toBe(false);
});

it('roundtrips', () => {
  writeCsdDockPersist({ open: true, tab: 'messages', pane: 'thread', conversationId: 'c1' });
  expect(readCsdDockPersist().conversationId).toBe('c1');
});
```

E2E trong `csd-chat.spec.ts` (dùng lại `mockCsdChatApis` + login):

```ts
test('D-2: dock on hub, hidden on chat page', async ({ page }) => {
  await mockCsdChatApis(page);
  await loginAsStaff(page);
  await page.goto('/crm/csd');
  await expect(page.getByTestId('csd-chat-launcher')).toBeVisible();
  await page.getByTestId('csd-chat-launcher').click();
  await expect(page.getByTestId('csd-chat-dock')).toBeVisible();
  await page.goto('/crm/csd/chat');
  await expect(page.getByTestId('csd-chat-launcher')).toHaveCount(0);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-dock-persist.spec.ts
npx playwright test e2e/csd-chat.spec.ts -g "D-2"
```

- [ ] **Step 3: Implement persist + dock + mount**

`csd-chat-dock-persist.ts`: try/catch `JSON.parse(sessionStorage.getItem(...))`; validate `open` boolean, `conversationId` string|null.

`CsdChatDock.tsx` (rút gọn bắt buộc):

```tsx
'use client';
export function CsdChatDock({ user }: { user: StoredStaffUser | null }) {
  const pathname = usePathname();
  const token = getAccessToken() ?? '';
  const canWrite = hasCap(user, 'csd', 'write');
  const persist = readCsdDockPersist();
  const [open, setOpen] = useState(persist.open);
  const session = useCsdChatSession({
    token,
    canWrite,
    initialConversationId: persist.conversationId,
  });
  // poll unread 15s → badge; visibility hidden pause
  if (!user || !hasCap(user, 'csd', 'view')) return null;
  if (pathname === '/crm/csd/chat') return null;
  if (!token) return null;
  return (
    <>
      <button type="button" className="csd-chat-launcher" data-testid="csd-chat-launcher"
        aria-label="Chat" aria-expanded={open} onClick={() => { setOpen(true); writeCsdDockPersist({ ...persist, open: true }); }}>
        Chat
        {unread > 0 ? <span className="csd-chat-launcher__badge" aria-label={`${unread} hội thoại chưa đọc`}>{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="csd-chat-dock" role="dialog" aria-label="Chat Service Desk" data-testid="csd-chat-dock">
          {/* header: Chat nội bộ | — thu nhỏ */}
          {/* list hoặc thread: reuse CsdChatList / CsdChatThread density="dock" */}
          {/* Mở rộng: router.push(`/crm/csd/chat?c=${id}`) + setOpen(false) */}
        </div>
      ) : null}
    </>
  );
}
```

Esc: thread → list; list → đóng dock.

`StaffPageShell`: sau `OpsPage`, `{user ? <CsdChatDock user={user} /> : null}`.

CSS dock (spec §5.1):

```css
.csd-chat-launcher {
  position: fixed; right: 20px; bottom: 20px; z-index: 41;
  width: 56px; height: 56px; border-radius: 999px;
  background: var(--accent, #2563eb); color: #fff; border: 0; cursor: pointer;
}
.csd-chat-launcher__badge {
  position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px;
  border-radius: 999px; background: #dc2626; font-size: 0.7rem;
}
.csd-chat-dock {
  position: fixed; right: 20px; bottom: 84px; z-index: 40;
  width: 380px; height: min(560px, calc(100vh - 120px));
  background: #fff; border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  display: flex; flex-direction: column; overflow: hidden;
}
@media (max-width: 960px) {
  .csd-chat-dock { inset: 0; width: auto; height: auto; border-radius: 0; z-index: 45; }
}
```

Modals ticket/forward trong dock: wrapper `position:absolute; inset:0; z-index:50`.

`useCsdChatSession` trên dock: đổi interval poll messages/list **15s** khi `density` — thêm option `pollMs?: number` default `5000` (page), dock truyền `15000`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-dock-persist.spec.ts
npx playwright test e2e/csd-chat.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/crm/csd/CsdChatDock.tsx services/ops-web/src/lib/crm/csd-chat-dock-persist.ts services/ops-web/src/lib/crm/csd-chat-dock-persist.spec.ts services/ops-web/src/components/layout/StaffPageShell.tsx services/ops-web/src/app/globals.css services/ops-web/src/components/crm/csd/useCsdChatSession.ts services/ops-web/e2e/csd-chat.spec.ts
git commit -m "$(cat <<'EOF'
feat(csd): add floating Chat dock on staff CRM pages.
EOF
)"
```

---

### Task 4: Polish — thumbnail, menu ⋯, date chip, sheet i, e2e C-5 (D-3)

**Files:**
- Modify: `CsdChatBubble.tsx` — image thumb, menu ⋯
- Modify: `CsdChatThread.tsx` — date chips giữa tin; header `i` + Mở rộng (page: ẩn Mở rộng)
- Modify: `CsdChatContext.tsx` — nhận `variant: 'column' | 'sheet'`
- Modify: `CsdChatDock.tsx` — sheet `i` overlay
- Modify: `globals.css`
- Modify: `e2e/csd-chat.spec.ts` — đổi test D-2 thành **C-5** đầy đủ

**Interfaces:**
- Consumes: `downloadCsdFile`, `shouldShowDateChip`, `formatDateChip`
- Produces: `data-testid="csd-chat-msg-menu"`, `data-testid="csd-chat-date-chip"`, `data-testid="csd-chat-image"`

Image: `mime_type.startsWith('image/')` → `<img class="csd-chat-thumb" alt={file_name} />` click gọi `downloadCsdFile` (không lightbox). File khác: chip C-3.

Menu ⋯: desktop `hover` hiện; dock luôn hiện icon. Items: Trả lời, Tạo ticket (nếu chưa có ticket và kind ≠ announcement), Sửa (15p), Xóa, Copy link, Forward. Không hàng nút luôn hiện.

Sheet `i` dock: members + related tickets (reuse `CsdChatContext` `variant="sheet"`). Không AI summarize trên dock.

- [ ] **Step 1: Extend C-5 e2e**

```ts
test('C-5: dock bubbles, send, hide on chat page', async ({ page }) => {
  await mockCsdChatApis(page);
  await loginAsStaff(page);
  await page.goto('/crm/csd');
  await page.getByTestId('csd-chat-launcher').click();
  await page.getByTestId('csd-chat-dock').getByTestId('csd-chat-list').locator('button').first().click();
  await expect(page.locator('#csd-chat-dock .csd-chat-message.is-theirs, [data-testid=csd-chat-dock] .csd-chat-message')).toHaveCount(1);
  await page.getByTestId('csd-chat-dock').getByTestId('csd-chat-draft').fill('Xin chào');
  await page.getByTestId('csd-chat-dock').getByRole('button', { name: 'Gửi' }).click();
  await page.goto('/crm/csd/chat');
  await expect(page.getByTestId('csd-chat-launcher')).toHaveCount(0);
  await expect(page.locator('.csd-chat-message.is-mine, .csd-chat-message.is-theirs')).toHaveCount(1);
});
```

Gán `id="csd-chat-dock"` hoặc chỉ dùng `data-testid`. Composer dock phải có `data-testid="csd-chat-draft"` (thread page đã có — giữ nguyên).

- [ ] **Step 2: Run C-5 — may fail on menu/draft testid**

```bash
cd services/ops-web && npx playwright test e2e/csd-chat.spec.ts -g "C-5"
```

- [ ] **Step 3: Implement polish**

CSS thumb: `max-width: 180px; border-radius: 8px;`. Date chip: `align-self: center; font-size: 0.75rem; color: #64748b;`.

Header thread dock: `←` · tên · `i` · `Mở rộng` · `—`.

- [ ] **Step 4: Run full chat e2e + jest csd**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='src/csd' --no-coverage
cd services/ops-web && npx playwright test e2e/csd-chat.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(csd): polish dock bubbles with media menu and date chips.
EOF
)"
```

---

### Task 5: Chat accounts DDL + service (D-4 backend)

**Files:**
- Modify: `docs/specs/2026-09-02-postgresql-ddl-csd.sql` — append cuối file (deploy script đã `psql -f` file này)
- Modify: `services/ptt-crm-api/src/csd/csd.types.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-accounts.repository.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-accounts.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-accounts.service.spec.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-accounts.controller.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-chat.service.ts` — `assertEnabled` trước `sendMessage` / `createConversation`
- Modify: `services/ptt-crm-api/src/csd/csd-chat.service.spec.ts`
- Modify: `services/ptt-crm-api/src/csd/csd.module.ts`

**Interfaces:**

```ts
export type CsdChatAccountRow = {
  staff_id: number;
  tenant_id: string;
  enabled: boolean;
  display_name_vi: string | null;
  created_by_staff_id: number;
  created_at: string;
  updated_at: string;
};

export type CsdChatMe = {
  staff_id: number;
  enabled: boolean;
  display_name_vi: string | null;
};
```

Service:

```ts
class CsdChatAccountsService {
  getMe(actor: CsdActor): Promise<CsdChatMe>; // enabled=false nếu không hàng / disabled
  assertEnabled(actor: CsdActor): Promise<void>; // ForbiddenException { error: 'chat_disabled' }
  listAdmin(q?: string): Promise<{ items: Array<CsdChatAccountRow & { staff_name: string; staff_email: string }> }>;
  upsert(admin: CsdActor, input: { staff_id: number; enabled: boolean; display_name_vi?: string }): Promise<CsdChatAccountRow>;
}
```

`assertEnabled`: không hàng hoặc `enabled=false` → `ForbiddenException({ error: 'chat_disabled' })`.

Admin `upsert`: `hasCsdCap(admin, 'admin')` nếu không → Forbidden. `created_by_staff_id` = admin.staffId. Audit `chat_account.enable` / `chat_account.disable`.

DDL (append, idempotent) — copy nguyên spec §7.1 (`csd_chat_accounts` **và** `csd_chat_friendships` luôn trong Task 5 để Task 7 không đụng DDL lần hai).

People search SQL (dùng Task 7, viết sẵn repo method):

```sql
SELECT a.staff_id,
       COALESCE(NULLIF(a.display_name_vi, ''), s.name) AS display_name_vi
  FROM csd_chat_accounts a
  JOIN crm_staff s ON s.id = a.staff_id
 WHERE a.tenant_id = $1 AND a.enabled IS TRUE
   AND a.staff_id <> $2
   AND (s.name ILIKE $3 OR COALESCE(s.email,'') ILIKE $3)
 LIMIT 20
```

Controller:

| Method | Path | Decorator |
|--------|------|-----------|
| GET | `chat/me` | `@RequireCsdAction('view')` |
| GET | `admin/chat-accounts` | `@RequireCsdAction('admin')` |
| POST | `admin/chat-accounts` | `@RequireCsdAction('admin')` body `{ staff_id, enabled, display_name_vi? }` |

`CsdChatService` constructor thêm `accounts: CsdChatAccountsService`. Đầu `sendMessage` và `createConversation`: `await this.accounts.assertEnabled(actor)`.

- [ ] **Step 1: Write failing Jest**

```ts
const actor = { staffId: 3, staffLabel: 'am', caps: [{ section: 'csd', action: 'write' }] };
const admin = { staffId: 1, staffLabel: 'adm', caps: [{ section: 'csd', action: 'admin' }] };

it('getMe disabled when no row', async () => {
  repo.findByStaffId.mockResolvedValue(null);
  await expect(svc().getMe(actor)).resolves.toEqual({ staff_id: 3, enabled: false, display_name_vi: null });
});

it('admin upsert writes created_by', async () => {
  repo.upsert.mockResolvedValue({ staff_id: 8, enabled: true, created_by_staff_id: 1 });
  await svc().upsert(admin, { staff_id: 8, enabled: true });
  expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ created_by_staff_id: 1, enabled: true }));
  expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'chat_account.enable' }));
});

it('non-admin cannot upsert', async () => {
  await expect(svc().upsert(actor, { staff_id: 8, enabled: true })).rejects.toMatchObject({
    status: 403,
  });
});
```

Chat service spec thêm: mock `accounts.assertEnabled` resolve; test `assertEnabled` reject → send không gọi repo.

- [ ] **Step 2: Run — FAIL**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='csd-chat-accounts' --no-coverage
```

- [ ] **Step 3: Implement repo/service/controller + wire module + assertEnabled**

Repo: Pool `pg` giống `CsdNotificationsRepository`. `upsert` = `INSERT ... ON CONFLICT (staff_id) DO UPDATE SET enabled=$…, updated_at=NOW()`.

Không endpoint `POST /chat/register`.

- [ ] **Step 4: Run CSD jest**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='src/csd' --no-coverage && npm run build
```

Expected: PASS + build OK.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(csd): add admin-provisioned chat accounts and /chat/me.
EOF
)"
```

---

### Task 6: Gate UI + Admin page (D-4 frontend)

**Files:**
- Modify: `services/ops-web/src/lib/crm/csd-api.ts`
- Modify: `services/ops-web/src/components/crm/csd/CsdChatDock.tsx`
- Modify: `services/ops-web/src/app/crm/csd/chat/page.tsx` + workspace empty state
- Create: `services/ops-web/src/app/admin/crm/csd/chat-accounts/page.tsx`
- Modify: `services/ops-web/src/lib/rbac-routes.ts`
- Modify: `services/ops-web/src/components/OpsNav.tsx` — link Admin Chat nếu `hasCap(user, 'csd', 'admin')`
- Modify: `e2e/csd-chat.spec.ts` — mock `GET /api/crm/csd/chat/me` `{ enabled: true }` trong `mockCsdChatApis`; case enabled=false

**Interfaces:**

```ts
export async function fetchCsdChatMe(token: string): Promise<{ staff_id: number; enabled: boolean; display_name_vi: string | null }>;
export async function fetchCsdChatAccountsAdmin(token: string, q?: string): Promise<{ items: CsdChatAccountAdminRow[] }>;
export async function upsertCsdChatAccount(token: string, body: { staff_id: number; enabled: boolean; display_name_vi?: string }): Promise<CsdChatAccountAdminRow>;
```

- [ ] **Step 1: E2E failing — disabled hides launcher**

```ts
test('D-4: launcher hidden when chat account disabled', async ({ page }) => {
  await mockCsdChatApis(page);
  await page.route('**/api/crm/csd/chat/me**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ staff_id: 3, enabled: false, display_name_vi: null }) }),
  );
  await loginAsStaff(page);
  await page.goto('/crm/csd');
  await expect(page.getByTestId('csd-chat-launcher')).toHaveCount(0);
});
```

`mockCsdChatApis` mặc định fulfill `/chat/me` `{ enabled: true }` để C-5 không vỡ.

- [ ] **Step 2: Run — FAIL (dock còn hiện vì chỉ check view)**

- [ ] **Step 3: Implement**

Dock: `useEffect` fetch `fetchCsdChatMe`; `enabled !== true` → `return null` (im lặng).

`/crm/csd/chat`: nếu `enabled === false` (sau fetch), render `page-card`: «Tài khoản chat chưa được Admin cấp — liên hệ quản trị.» Không 403, không redirect.

Admin page: `AdminPageShell` + `useAdminCrmAuth` với predicate `hasCap(user, 'csd', 'admin')`. Table: staff_id, tên, email, enabled, nút Bật/Tắt. Ô staff_id + Bật cho NV chưa có hàng.

`rbac-routes.ts` thêm **trước** prefix `/admin/crm` generic (nếu có):

```ts
{
  prefix: '/admin/crm/csd',
  anyOf: [{ section: 'csd', action: 'admin' }],
},
```

OpsNav: `{ href: '/admin/crm/csd/chat-accounts', label: 'Tài khoản Chat' }` trong nhóm admin khi `hasCap(..., 'csd', 'admin')`.

Không thêm form login trong dock.

- [ ] **Step 4: Run e2e C-5 + D-4**

```bash
cd services/ops-web && npx playwright test e2e/csd-chat.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(csd): gate Chat dock on admin-enabled accounts.
EOF
)"
```

---

### Task 7: Friends API + DM 409 (D-5 backend)

**Files:**
- Modify: `csd.types.ts` — `CsdChatFriendshipRow`, `CsdChatPersonRow`
- Create: `csd-chat-friends.repository.ts`
- Create: `csd-chat-friends.service.ts`
- Create: `csd-chat-friends.service.spec.ts`
- Create: `csd-chat-friends.controller.ts`
- Modify: `csd-notifications.repository.ts` — thêm `insert` (copy SQL `CsdTicketsRepository.insertNotification`)
- Modify: `csd-chat.service.ts` — `createConversation` kind=direct
- Modify: `csd-chat.service.spec.ts`
- Modify: `csd.module.ts`

**Interfaces:**

```ts
export type CsdChatFriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type CsdChatFriendshipRow = {
  id: string;
  staff_lo: number;
  staff_hi: number;
  requester_staff_id: number;
  addressee_staff_id: number;
  status: CsdChatFriendshipStatus;
  created_at: string;
  updated_at: string;
};
export type CsdChatPersonRow = { staff_id: number; display_name_vi: string };

class CsdChatFriendsService {
  listFriends(actor: CsdActor): Promise<{ items: CsdChatPersonRow[] }>;
  listRequests(actor: CsdActor): Promise<{ incoming: CsdChatFriendshipRow[]; outgoing: CsdChatFriendshipRow[] }>;
  searchPeople(actor: CsdActor, q: string): Promise<{ items: CsdChatPersonRow[] }>; // q trim length < 2 → []
  request(actor: CsdActor, staffId: number): Promise<CsdChatFriendshipRow>;
  accept(actor: CsdActor, id: string): Promise<CsdChatFriendshipRow>;
  reject(actor: CsdActor, id: string): Promise<{ deleted: true }>;
  remove(actor: CsdActor, id: string): Promise<{ deleted: true }>;
  block(actor: CsdActor, id: string): Promise<CsdChatFriendshipRow>;
  isAccepted(a: number, b: number): Promise<boolean>;
  adminRemove(admin: CsdActor, friendshipId: string): Promise<{ deleted: true }>;
}
```

Pair: `staff_lo = Math.min(a,b)`, `staff_hi = Math.max(a,b)`. Self → `BadRequestException({ error: 'cannot_friend_self' })`. Target `!enabled` → `NotFoundException({ error: 'chat_account_not_found' })`. Existing row → `ConflictException({ error: 'friendship_exists' })`.

Accept: chỉ `addressee_staff_id === actor.staffId` và `pending`. Notify `event_key='chat_friend_request'` khi request: title «Lời mời kết bạn», body tên requester, `entity_type='chat_friendship'`.

`searchPeople`: loại chính mình, loại pair `blocked` (một trong hai chiều), loại đã accepted (họ vào tab bạn). Pending vẫn hiện? **Không** — ẩn hoặc đánh dấu; chốt: **ẩn** khỏi directory nếu đã có hàng friendship.

`createConversation` direct **mới** (không có `findDirectPair`):

```ts
const ok = await this.friends.isAccepted(actor.staffId, peer);
if (!ok) throw new ConflictException({ error: 'not_friends' });
```

Nếu `findDirectPair` tìm thấy hội thoại cũ → **return existing** (Z16), không check bạn.

Group/client/project: không gọi `isAccepted`.

`assertEnabled` vẫn chạy trước (Task 5).

HTTP (controller riêng, cùng prefix `api/crm/csd`):

| Method | Path |
|--------|------|
| GET | `chat/people?q=` |
| GET | `chat/friends` |
| GET | `chat/friends/requests` |
| POST | `chat/friends` `{ staff_id }` |
| POST | `chat/friends/:id/accept` |
| POST | `chat/friends/:id/reject` |
| DELETE | `chat/friends/:id` |
| POST | `chat/friends/:id/block` |
| DELETE | `admin/chat-accounts/:staffId/friends/:friendshipId` |

Write endpoints: `@RequireCsdAction('write')` + `assertEnabled` trong service. Admin delete: `admin`.

- [ ] **Step 1: Failing Jest**

```ts
it('request then accept then isAccepted', async () => {
  accounts.isEnabled.mockImplementation(async (id: number) => id === 3 || id === 8);
  repo.findPair.mockResolvedValueOnce(null).mockResolvedValue({ id: 'f1', status: 'pending', requester_staff_id: 3, addressee_staff_id: 8 });
  repo.insertPending.mockResolvedValue({ id: 'f1', status: 'pending', requester_staff_id: 3, addressee_staff_id: 8 });
  await svc().request(actor, 8);
  repo.findById.mockResolvedValue({ id: 'f1', status: 'pending', requester_staff_id: 3, addressee_staff_id: 8 });
  repo.setStatus.mockResolvedValue({ id: 'f1', status: 'accepted' });
  await svc().accept({ staffId: 8, staffLabel: 'b', caps: actor.caps }, 'f1');
  repo.findPair.mockResolvedValue({ status: 'accepted' });
  await expect(svc().isAccepted(3, 8)).resolves.toBe(true);
});

it('rejects self friend', async () => {
  await expect(svc().request(actor, 3)).rejects.toMatchObject({ status: 400, response: { error: 'cannot_friend_self' } });
});

it('createConversation direct without friend is 409', async () => {
  accounts.assertEnabled.mockResolvedValue(undefined);
  friends.isAccepted.mockResolvedValue(false);
  repo.findDirectPair.mockResolvedValue(null);
  await expect(
    chatSvc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] }),
  ).rejects.toMatchObject({ status: 409, response: { error: 'not_friends' } });
});

it('existing direct pair skips friend check', async () => {
  repo.findDirectPair.mockResolvedValue({ id: 'd1', kind: 'direct' });
  const row = await chatSvc().createConversation(actor, { kind: 'direct', name_vi: '', member_staff_ids: [8] });
  expect(row.id).toBe('d1');
  expect(friends.isAccepted).not.toHaveBeenCalled();
});
```

Cập nhật test C-1 «creates direct…» : mock `friends.isAccepted` → `true`.

- [ ] **Step 2: Run — FAIL**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='csd-chat-friends|csd-chat.service' --no-coverage
```

- [ ] **Step 3: Implement**

`block`: set `status='blocked'`, `requester_staff_id` = người chặn, `addressee` = bị chặn (cập nhật hai cột + status). Search loại mọi pair blocked.

`remove`: pending + requester → delete; accepted + (requester hoặc addressee) → delete. Không xóa conversation.

- [ ] **Step 4: Jest + build**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='src/csd' --no-coverage && npm run build
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(csd): require accepted friendship before new DM.
EOF
)"
```

---

### Task 8: Contacts UI + tabs + e2e C-6 + guide (D-5 frontend)

**Files:**
- Modify: `csd-api.ts` — friends wrappers
- Create: `CsdChatContacts.tsx`
- Modify: `CsdChatDock.tsx` — 3 tab
- Modify: `CsdChatList.tsx` / `CsdChatWorkspace.tsx` — tab trên list full page
- Modify: `CsdChatNewModal.tsx` — kind=direct chỉ list `fetchCsdChatFriends`
- Modify: `useCsdChatSession.ts` — bắt 409 `not_friends` → `setFriendRequired(true)`
- Modify: `CsdChatWorkspace.tsx` + dock — dialog «Hãy gửi kết bạn trước» + CTA tab Danh bạ
- Modify: `e2e/csd-chat.spec.ts` — C-6
- Modify: `docs/huong-dan-su-dung/29-csd-service-desk.md`
- Modify: `docs/superpowers/specs/2026-09-02-agency-csd-ux-ui-design.md` — §5.8 / §5.9 (đoạn ngắn + link spec dock)

**Interfaces:**

```ts
export async function fetchCsdChatPeople(token: string, q: string): Promise<{ items: { staff_id: number; display_name_vi: string }[] }>;
export async function fetchCsdChatFriends(token: string): Promise<{ items: { staff_id: number; display_name_vi: string }[] }>;
export async function fetchCsdChatFriendRequests(token: string): Promise<{ incoming: CsdChatFriendshipRow[]; outgoing: CsdChatFriendshipRow[] }>;
export async function requestCsdChatFriend(token: string, staffId: number): Promise<CsdChatFriendshipRow>;
export async function acceptCsdChatFriend(token: string, id: string): Promise<CsdChatFriendshipRow>;
export async function rejectCsdChatFriend(token: string, id: string): Promise<{ deleted: true }>;
export async function deleteCsdChatFriend(token: string, id: string): Promise<{ deleted: true }>;
export async function blockCsdChatFriend(token: string, id: string): Promise<CsdChatFriendshipRow>;
```

Click bạn accepted → `handleCreateConversation({ kind: 'direct', name_vi: '', member_staff_ids: [staff_id] })` (get-or-create).

409: `err instanceof ApiError && err.message === 'not_friends'`.

Poll requests 15s khi panel/page open (badge tab Lời mời = `incoming.length`).

- [ ] **Step 1: E2E C-6 (mock)**

```ts
test('C-6: friend request, accept, not_friends dialog', async ({ page }) => {
  let friends: Array<{ staff_id: number; display_name_vi: string }> = [];
  let incoming: Array<Record<string, unknown>> = [];
  await mockCsdChatApis(page);
  await page.route('**/api/crm/csd/chat/people**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ staff_id: 8, display_name_vi: 'Bạn B' }] }),
    }),
  );
  await page.route('**/api/crm/csd/chat/friends/requests**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ incoming, outgoing: [] }) }),
  );
  await page.route('**/api/crm/csd/chat/friends**', async (route) => {
    if (route.request().method() === 'POST' && !route.request().url().includes('/accept')) {
      incoming = [{ id: 'f1', requester_staff_id: 3, addressee_staff_id: 8, status: 'pending' }];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(incoming[0]) });
      return;
    }
    if (route.request().url().includes('/accept')) {
      friends = [{ staff_id: 8, display_name_vi: 'Bạn B' }];
      incoming = [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'f1', status: 'accepted' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: friends }) });
  });
  await loginAsStaff(page);
  await page.goto('/crm/csd');
  await page.getByTestId('csd-chat-launcher').click();
  await page.getByTestId('csd-chat-tab-contacts').click();
  await page.getByTestId('csd-chat-people-q').fill('Bạn');
  await page.getByTestId('csd-chat-friend-request').click();
  await page.getByTestId('csd-chat-tab-requests').click();
  await expect(page.getByTestId('csd-chat-friend-incoming')).toBeVisible();
});
```

Thêm case mock `POST /conversations` 409 → `data-testid="csd-chat-not-friends"`.

- [ ] **Step 2: Run C-6 — FAIL**

```bash
cd services/ops-web && npx playwright test e2e/csd-chat.spec.ts -g "C-6"
```

- [ ] **Step 3: Implement tabs + contacts + dialog + guide**

Guide `29-csd-service-desk.md` thêm:

```markdown
## 3b. Hộp thoại Chat (dock)

- Góc phải CRM: nút Chat + badge. Không hiện trên `/crm/csd/chat`.
- Đăng nhập `/login`. Chỉ NV được Admin bật tại `/admin/crm/csd/chat-accounts`.
- Tab Tin nhắn / Danh bạ / Lời mời. DM mới cần kết bạn.
- Nhóm / chat khách / dự án không cần kết bạn.
- Mở rộng → `/crm/csd/chat?c=`.

UAT 2f: dock trên `/crm/leads`, gửi tin, ẩn trên trang Chat.
UAT 2g: Admin bật 2 NV; A mời B; B chấp nhận; DM gửi được; DM C chưa bạn bị chặn.
```

UX spec §5.8 / §5.9: 4–6 dòng + link dock spec.

- [ ] **Step 4: Full verification**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='src/csd' --no-coverage && npm run build
cd services/ops-web && npx playwright test e2e/csd-chat.spec.ts
```

Expected: Jest xanh; Playwright C-1…C-6 xanh.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(csd): add chat contacts, friend requests, and dock tabs.
EOF
)"
```

---

## Deploy (sau Task 8, khi user yêu cầu)

```bash
APPLY=1 ./scripts/deploy_csd_vps.sh
# DDL apply nằm trong script (csd_chat_accounts / friendships IF NOT EXISTS)
# Nếu sudo systemctl skip: HUP ptt-crm-api + ptt-ops-web
```

Smoke: `/login` 200; `/crm/csd/chat` 307; `GET /api/crm/csd/chat/me` 401; `GET /api/crm/csd/admin/chat-accounts` 401.

UAT VPS: đúng spec §10.3.

---

## Self-review (spec → task)

| Spec | Task |
|------|------|
| G1–G5 dock + bubbles + không phá C-1…C-4 | 2, 3, 4 |
| G6 Admin-only accounts, no register | 5, 6 |
| G7 not_friends | 7, 8 |
| Z11–Z13 login `/login` | 6 (không form mới) |
| Z14–Z16 friends + DM cũ | 7 |
| Z15 no client login | constraints + 6 |
| Thumbnail / ⋯ / date / i | 4 |
| Tabs + guide 2f/2g | 8 |
| Poll 15s dock | 3, 8 |
| Persist sessionStorage | 3 |
| C-5 / C-6 e2e | 4, 8 |

Không làm: WS, Zalo OA, reaction, multi-window, portal, signup, 24h reject cooldown.
