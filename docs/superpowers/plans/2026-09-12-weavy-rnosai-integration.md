# Weavy × RNOSAI Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp Weavy ([app.weavy.ai](https://app.weavy.ai/)) vào CRM RNOSAI: xác thực API key + access token qua `ptt-crm-api`, nhúng Web Components Chat/Files vào ops-web, và đồng bộ user CRM → Weavy để @mention / DM / quyền file nhất quán.

**Architecture:** [app.weavy.ai](https://app.weavy.ai/) là **console tài khoản** (tạo environment + API key). `{WEAVY_URL}` là **URL environment riêng** hiển thị trong console (thường `https://<tenant>.weavy.io`), **không** phải `https://app.weavy.ai`. CRM là nguồn sự thật (staff JWT, `crm_staff`). Browser không thấy API key. `ops-web` gọi `GET /api/crm/weavy/token` bằng Staff JWT; backend upsert user rồi `POST {WEAVY_URL}/api/users/{uid}/tokens`. UIKit nhận `access_token` qua `tokenFactory`. CSD Chat Zalo-style **giữ nguyên**; Weavy chạy sau flag `PTT_WEAVY=1`.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js `ops-web` · Weavy UIKit `@weavy/uikit-web` (hoặc ESM từ `{WEAVY_URL}`) · Weavy Users API · Jest · Playwright mock.

## Global Constraints

- Flag mặc định **tắt**: `PTT_WEAVY=0`. Không deploy Weavy lên VPS cho đến khi env + API key có sẵn.
- `WEAVY_API_KEY` chỉ sống trên server (`ptt-crm-api` / `.env` VPS). Cấm `NEXT_PUBLIC_*` cho API key.
- Weavy `uid` **không được chỉ toàn số** và không chứa khoảng trắng → dùng `staff:{crm_staff.id}`.
- Token Weavy TTL mặc định **3600s**; cache in-memory theo `uid`; `refresh=true` bắt buộc cấp token mới.
- CSD Chat (`/crm/csd/chat`, dock) **không bị thay** ở phase 1. Weavy là lớp cộng tác bổ sung (contextual chat + files).
- Theme Weavy khớp CSD: `--wy-theme-color: #c76f0a`.
- Tenant CRM = `PTT`. Directory Weavy = `ptt-staff`.
- Prefix API CRM: `/api/crm/weavy`. Guard: `StaffOrInternalKeyGuard` + cap `csd.view` (cùng cửa với CSD Chat).

---

## Design (đã khóa)

### 1) Mô hình xác thực (không trộn token)

```
ops-web (Staff JWT)
    │  GET /api/crm/weavy/token?refresh=
    ▼
ptt-crm-api
    │  1. verify Staff JWT → staffId
    │  2. assert chat/weavy enabled
    │  3. PUT  {WEAVY_URL}/api/users/{uid}     Bearer API_KEY
    │  4. POST {WEAVY_URL}/api/users/{uid}/tokens
    ▼
Weavy environment
    │  { access_token: "wyu_..." }
    ▼
UIKit tokenFactory → wy-chat / wy-files / wy-messenger
```

| Loại | Ai giữ | Dùng để |
|------|--------|---------|
| Staff JWT | Browser (đã có `getAccessToken()`) | Gọi CRM |
| Weavy API key | Chỉ `ptt-crm-api` | Server-to-server (sudo) |
| Weavy access token | Browser (ngắn hạn, do UIKit giữ) | User-to-Weavy |

**Không dùng `weavy.tokenUrl` thuần.** Fetch mặc định của UIKit không gắn Staff JWT. Bắt buộc `tokenFactory` gọi CRM với `Authorization: Bearer <staff jwt>`.

### 2) Ánh xạ user CRM → Weavy

| CRM | Weavy |
|-----|--------|
| `crm_staff.id` = `8` | `uid` = `staff:8` |
| `display_name` / `csd_chat_accounts.display_name_vi` | `name` |
| `email` | `email`, `username` |
| Avatar `GET /api/crm/csd/staff/{id}/avatar` (URL công khai nội bộ hoặc data URI) | `picture` |
| `csd_chat_accounts.enabled` | sync khi `true`; trash/disable khi `false` |
| Phòng ban / cap `csd` | `directories: ["ptt-staff"]`, `metadata.staff_id`, `metadata.position_id` |

### 3) App uid cho Web Components

| Component | `uid` | Dùng khi |
|-----------|-------|----------|
| `<wy-messenger>` | không cần uid app | Inbox DM/group Weavy |
| `<wy-chat>` | `lead:{leadId}` / `ticket:{ticketId}` / `csd-conv:{conversationId}` | Chat gắn ngữ cảnh CRM |
| `<wy-files>` | `files:lead:{leadId}` / `files:ticket:{ticketId}` | Kho file cộng tác theo entity |

---

## File map

| File | Responsibility |
|------|----------------|
| `services/ptt-crm-api/src/weavy/weavy.types.ts` | DTO token, upsert payload, uid |
| `services/ptt-crm-api/src/weavy/weavy-uid.util.ts` | `staffWeavyUid`, parse, app uid helpers |
| `services/ptt-crm-api/src/weavy/weavy.config.ts` | `WEAVY_URL`, `WEAVY_API_KEY`, flag, TTL |
| `services/ptt-crm-api/src/weavy/weavy.client.ts` | HTTP client Bearer API key |
| `services/ptt-crm-api/src/weavy/weavy-sync.service.ts` | Upsert / disable user |
| `services/ptt-crm-api/src/weavy/weavy-token.service.ts` | Issue + cache access token |
| `services/ptt-crm-api/src/weavy/weavy.controller.ts` | `GET /token`, `POST /users/sync` |
| `services/ptt-crm-api/src/weavy/weavy.module.ts` | Nest module |
| `services/ops-web/src/lib/crm/weavy-api.ts` | `fetchWeavyToken`, `weavyAppUid` |
| `services/ops-web/src/components/crm/weavy/WeavyProvider.tsx` | Singleton `new Weavy()` + tokenFactory |
| `services/ops-web/src/components/crm/weavy/WeavyMessengerPanel.tsx` | `<wy-messenger>` |
| `services/ops-web/src/components/crm/weavy/WeavyChatEmbed.tsx` | `<wy-chat uid>` |
| `services/ops-web/src/components/crm/weavy/WeavyFilesEmbed.tsx` | `<wy-files uid>` |
| `services/ops-web/src/app/crm/csd/weavy/page.tsx` | Trang pilot (messenger + files demo) |

---

### Task 1: Weavy uid + payload mapping (pure)

**Files:**
- Create: `services/ptt-crm-api/src/weavy/weavy.types.ts`
- Create: `services/ptt-crm-api/src/weavy/weavy-uid.util.ts`
- Test: `services/ptt-crm-api/src/weavy/weavy-uid.util.spec.ts`

**Interfaces:**
- Produces: `staffWeavyUid(staffId: number): string`, `parseStaffWeavyUid(uid: string): number | null`, `weavyAppUid(kind, id): string`, `toWeavyUserPayload(...)`

- [ ] **Step 1: Write the failing test**

```ts
import { parseStaffWeavyUid, staffWeavyUid, weavyAppUid } from './weavy-uid.util';

it('builds a non-digit-only Weavy uid from staff id', () => {
  expect(staffWeavyUid(8)).toBe('staff:8');
  expect(parseStaffWeavyUid('staff:8')).toBe(8);
  expect(parseStaffWeavyUid('8')).toBeNull();
});

it('builds contextual app uids', () => {
  expect(weavyAppUid('lead', 'abc')).toBe('lead:abc');
  expect(weavyAppUid('files-ticket', 't1')).toBe('files:ticket:t1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest --testPathPattern='weavy-uid.util.spec' --no-coverage`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
export function staffWeavyUid(staffId: number): string {
  if (!Number.isInteger(staffId) || staffId <= 0) throw new Error('invalid_staff_id');
  return `staff:${staffId}`;
}

export function parseStaffWeavyUid(uid: string): number | null {
  const m = /^staff:(\d+)$/.exec(uid.trim());
  return m ? Number(m[1]) : null;
}

export function weavyAppUid(
  kind: 'lead' | 'ticket' | 'csd-conv' | 'files-lead' | 'files-ticket',
  id: string,
): string {
  const safe = String(id).trim();
  if (!safe) throw new Error('invalid_app_id');
  if (kind === 'files-lead') return `files:lead:${safe}`;
  if (kind === 'files-ticket') return `files:ticket:${safe}`;
  return `${kind}:${safe}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern='weavy-uid.util.spec' --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/weavy/weavy-uid.util.ts \
  services/ptt-crm-api/src/weavy/weavy-uid.util.spec.ts \
  services/ptt-crm-api/src/weavy/weavy.types.ts
git commit -m "feat(weavy): map CRM staff ids to Weavy uids."
```

---

### Task 2: Server client + token endpoint

**Files:**
- Create: `services/ptt-crm-api/src/weavy/weavy.config.ts`
- Create: `services/ptt-crm-api/src/weavy/weavy.client.ts`
- Create: `services/ptt-crm-api/src/weavy/weavy-token.service.ts`
- Create: `services/ptt-crm-api/src/weavy/weavy-sync.service.ts`
- Create: `services/ptt-crm-api/src/weavy/weavy.controller.ts`
- Create: `services/ptt-crm-api/src/weavy/weavy.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` (import `WeavyModule`)
- Test: `services/ptt-crm-api/src/weavy/weavy-token.service.spec.ts`

**Interfaces:**
- Consumes: `staffWeavyUid`, Staff JWT via existing `StaffOrInternalKeyGuard`
- Produces: `GET /api/crm/weavy/token?refresh=` → `{ access_token: string; expires_in: number; uid: string }`
- Produces: `WeavyClient.upsertUser(uid, body)`, `WeavyClient.issueToken(uid, expiresIn)`

**Env (server only):**

```
PTT_WEAVY=0
WEAVY_URL=https://YOUR_ENV.weavy.io
WEAVY_API_KEY=wyk_***
WEAVY_TOKEN_TTL_SEC=3600
```

- [ ] **Step 1: Write the failing token service test**

```ts
it('issues a Weavy access token after upserting the CRM user', async () => {
  const client = {
    upsertUser: jest.fn().mockResolvedValue({ uid: 'staff:3' }),
    issueToken: jest.fn().mockResolvedValue({ access_token: 'wyu_test', expires_in: 3600 }),
  };
  const svc = new WeavyTokenService(client as never, {
    enabled: () => true,
    tokenTtlSec: () => 3600,
  } as never);
  const out = await svc.issueForStaff({
    staffId: 3,
    displayName: 'Lan',
    email: 'lan@ptt.vn',
    refresh: false,
  });
  expect(client.upsertUser).toHaveBeenCalledWith('staff:3', expect.objectContaining({
    name: 'Lan',
    email: 'lan@ptt.vn',
    directories: ['ptt-staff'],
  }));
  expect(out.access_token).toBe('wyu_test');
  expect(out.uid).toBe('staff:3');
});

it('reuses cached token until refresh=true', async () => {
  const client = {
    upsertUser: jest.fn().mockResolvedValue({}),
    issueToken: jest.fn().mockResolvedValue({ access_token: 'wyu_1', expires_in: 3600 }),
  };
  const svc = new WeavyTokenService(client as never, { enabled: () => true, tokenTtlSec: () => 3600 } as never);
  const actor = { staffId: 3, displayName: 'Lan', email: 'lan@ptt.vn', refresh: false };
  await svc.issueForStaff(actor);
  await svc.issueForStaff(actor);
  expect(client.issueToken).toHaveBeenCalledTimes(1);
  await svc.issueForStaff({ ...actor, refresh: true });
  expect(client.issueToken).toHaveBeenCalledTimes(2);
});

it('returns 503 when PTT_WEAVY is off', async () => {
  const svc = new WeavyTokenService({} as never, { enabled: () => false, tokenTtlSec: () => 3600 } as never);
  await expect(svc.issueForStaff({ staffId: 1, displayName: 'A', email: 'a@x', refresh: false }))
    .rejects.toMatchObject({ status: 503 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern='weavy-token.service.spec' --no-coverage`

Expected: FAIL

- [ ] **Step 3: Implement client + token + controller**

`weavy.client.ts` — chỉ gọi Weavy bằng API key:

```ts
async upsertUser(uid: string, body: WeavyUserUpsert): Promise<void> {
  const res = await fetch(`${this.baseUrl}/api/users/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${this.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new BadGatewayException({ error: 'weavy_upsert_failed', status: res.status });
}

async issueToken(uid: string, expiresIn: number): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(`${this.baseUrl}/api/users/${encodeURIComponent(uid)}/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expires_in: expiresIn }),
  });
  if (!res.ok) throw new BadGatewayException({ error: 'weavy_token_failed', status: res.status });
  return res.json();
}
```

Controller:

```ts
@Get('token')
@RequireCsdAction('view')
async token(@Req() req: AuthedReq, @Query('refresh') refresh?: string) {
  const actor = await this.actor(req); // reuse CSD actor pattern
  return this.tokens.issueForStaff({
    staffId: actor.staffId,
    displayName: actor.staffLabel,
    email: /* from staffAuth.me() */,
    refresh: refresh === 'true',
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest --testPathPattern='src/weavy' --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/weavy services/ptt-crm-api/src/app.module.ts
git commit -m "feat(weavy): issue access tokens from CRM staff JWT."
```

---

### Task 3: Đồng bộ user CRM → Weavy (nhất quán dữ liệu)

**Files:**
- Modify: `services/ptt-crm-api/src/weavy/weavy-sync.service.ts`
- Modify: `services/ptt-crm-api/src/weavy/weavy.controller.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-chat-accounts.service.ts` (hook enable/disable + profile)
- Modify: `services/ptt-crm-api/src/staff-auth/staff-account.service.ts` (hook đổi tên / avatar)
- Test: `services/ptt-crm-api/src/weavy/weavy-sync.service.spec.ts`

**Interfaces:**
- Produces: `syncStaff(staffId): Promise<void>`
- Produces: `POST /api/crm/weavy/users/sync` (admin/`csd.manage`) — sync 1 user hoặc batch enabled chat accounts
- Side effect: mỗi lần `issueForStaff` cũng upsert (lazy sync khi mở UI)

**Quy tắc đồng bộ (CRM là source of truth):**

1. **Lazy (bắt buộc):** mỗi lần lấy token → `PUT /api/users/staff:{id}` với name/email/picture/directories.
2. **Event:** khi admin bật/tắt tài khoản chat, đổi `display_name_vi`, hoặc staff đổi avatar → gọi `syncStaff` (nuốt lỗi Weavy, log `weavy_sync_failed`, không chặn CRM).
3. **Batch (tùy chọn, cron hoặc nút admin):** list `csd_chat_accounts.enabled=true` → upsert tuần tự, tối đa 50/lần.
4. **Disable:** `enabled=false` → `POST /api/users/{uid}/trash` (hoặc PATCH is_trashed) để user biến khỏi @mention.
5. **Không sync mật khẩu CSD Chat** sang Weavy. User Weavy không login password; chỉ access token.

Payload upsert:

```ts
{
  name: displayName,
  email,
  username: email,
  picture: avatarPublicUrl ?? undefined,
  directories: ['ptt-staff'],
  metadata: { staff_id: staffId, source: 'rnosai-crm' },
}
```

- [ ] **Step 1: Write failing sync tests** (upsert fields, skip when flag off, disable trash)
- [ ] **Step 2: Run to fail**
- [ ] **Step 3: Implement sync + hooks**
- [ ] **Step 4: Run `npx jest --testPathPattern='weavy-sync|csd-chat-accounts.service.spec'`**
- [ ] **Step 5: Commit** `feat(weavy): sync CRM staff profiles into Weavy.`

---

### Task 4: Embed Web Components vào ops-web

**Files:**
- Create: `services/ops-web/src/lib/crm/weavy-api.ts`
- Create: `services/ops-web/src/components/crm/weavy/WeavyProvider.tsx`
- Create: `services/ops-web/src/components/crm/weavy/WeavyMessengerPanel.tsx`
- Create: `services/ops-web/src/components/crm/weavy/WeavyChatEmbed.tsx`
- Create: `services/ops-web/src/components/crm/weavy/WeavyFilesEmbed.tsx`
- Create: `services/ops-web/src/app/crm/csd/weavy/page.tsx`
- Modify: `services/ops-web/src/app/globals.css` (theme `--wy-*`)
- Modify: `services/ops-web/src/components/OpsNav.tsx` (link **Cộng tác Weavy** khi flag public URL có)
- Test: `services/ops-web/src/lib/crm/weavy-api.spec.ts`
- E2E: `services/ops-web/e2e/weavy-embed.spec.ts` (mock `/api/crm/weavy/token`)

**Public env (không secret):**

```
NEXT_PUBLIC_WEAVY_URL=https://YOUR_ENV.weavy.io
```

UIKit load **ESM từ environment** để khớp version:

```ts
const { Weavy } = await import(`${process.env.NEXT_PUBLIC_WEAVY_URL}/uikit-web/weavy.esm.js`);
```

`tokenFactory` (bắt buộc):

```ts
weavy.tokenFactory = async (refresh: boolean) => {
  const token = getAccessToken();
  if (!token) return null;
  const out = await fetchWeavyToken(token, refresh);
  return out.access_token;
};
```

**Nhúng Chat (theo entity CRM):**

```tsx
export function WeavyChatEmbed({ entityKind, entityId, title }: Props) {
  const uid = weavyAppUid(entityKind, entityId);
  return <wy-chat uid={uid} name={title}></wy-chat>;
}
```

**Nhúng Files:**

```tsx
export function WeavyFilesEmbed({ entityKind, entityId, title }: Props) {
  const uid = weavyAppUid(entityKind === 'lead' ? 'files-lead' : 'files-ticket', entityId);
  return <wy-files uid={uid} name={title} view="grid"></wy-files>;
}
```

**Pilot page `/crm/csd/weavy`:**
- Cột trái: `<wy-messenger>` (inbox Weavy)
- Cột phải: `<wy-files uid="files:csd:vault">` (kho dùng thử)
- Chỉ render khi `NEXT_PUBLIC_WEAVY_URL` + user có `csd.view`
- Không tự thay `CsdChatDock`

**CSS:**

```css
:root {
  --wy-theme-color: #c76f0a;
  --wy-border-radius: 0.5rem;
}
```

Lưu ý custom element: **không self-close** (`</wy-chat>` bắt buộc). Khai báo JSX:

```ts
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'wy-chat': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { uid: string; name?: string };
      'wy-files': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { uid: string; name?: string; view?: string };
      'wy-messenger': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
```

- [ ] **Step 1: Test `weavyAppUid` + token fetch query `refresh`**
- [ ] **Step 2: Fail then implement provider + embeds + page**
- [ ] **Step 3: Playwright** — mock token 200, assert `wy-messenger` và `wy-files` trong DOM
- [ ] **Step 4: Commit** `feat(weavy): embed Chat and Files web components in CRM.`

---

### Task 5: Gắn Weavy vào màn CRM thật (lead / ticket)

**Files:**
- Modify: `services/ops-web/src/app/crm/leads/[id]/page.tsx` (tab **Cộng tác** khi flag on)
- Modify: ticket detail CSD (nếu có panel) — tab Files + Chat contextual
- Test: e2e tab hiện/ẩn theo `NEXT_PUBLIC_WEAVY_URL`

**uid ổn định (để reverse-lookup):**
- Lead chat: `lead:{lead.id}`
- Lead files: `files:lead:{lead.id}`
- Ticket chat: `ticket:{ticket.id}`
- Ticket files: `files:ticket:{ticket.id}`

Không migrate lịch sử `csd_messages` / `csd_attachments` sang Weavy ở phase 1.

- [ ] **Step 1: Feature-flag tab; empty when URL missing**
- [ ] **Step 2: Embed `WeavyChatEmbed` + `WeavyFilesEmbed`**
- [ ] **Step 3: E2E mock**
- [ ] **Step 4: Commit** `feat(weavy): attach contextual chat and files to lead and ticket.`

---

### Task 6: Vận hành — checklist thiết lập (không phải code)

Thực hiện tay trước khi bật flag prod:

1. Đăng nhập [https://app.weavy.ai/](https://app.weavy.ai/) (console Weavy).
2. Tạo **environment** RNOSAI/PTT → copy **Environment URL** vào `{WEAVY_URL}` (ví dụ `https://ptt.weavy.io`). **Không** dùng `https://app.weavy.ai` làm base API / UIKit.
3. Trong trang environment: tạo **API key**, đặt hạn dùng, lưu vault / VPS `.env` (`WEAVY_API_KEY`). Không paste key vào ops-web.
4. Cấu hình allowed origins / CORS trên environment: `https://rs.pttads.vn` (+ `http://localhost:3000` khi dev).
5. Tạo directory `ptt-staff` (hoặc để upsert tự gắn `directories`).
6. VPS / `.env`:
   - `PTT_WEAVY=1`
   - `WEAVY_URL=https://<tenant>.weavy.io`
   - `WEAVY_API_KEY=wyk_...`
   - `NEXT_PUBLIC_WEAVY_URL=https://<tenant>.weavy.io` (cùng Environment URL, **không** key, **không** `app.weavy.ai`)
7. Restart: `sudo systemctl restart ptt-crm-api ptt-ops-web`.
8. Smoke:
   - `GET /api/crm/weavy/token` với Staff JWT → `{ access_token, uid: "staff:N" }`
   - Mở `/crm/csd/weavy` → console có `@weavy/uikit-web@x.y.z` **một lần**
   - Gửi 1 tin messenger giữa 2 staff đã enable
   - Upload 1 file trên `<wy-files>`
9. Nếu spinner vô hạn: `WEAVY_URL` đang trỏ nhầm `app.weavy.ai`, token 401, CORS, hoặc version mismatch.

---

## Thứ tự triển khai

| Phase | Task | Kết quả kiểm được |
|-------|------|-------------------|
| A | 1–2 | Token CRM→Weavy, không UI |
| B | 3 | Profile staff xuất hiện trên Weavy (mention) |
| C | 4 | Trang pilot Chat + Files |
| D | 5 | Lead/ticket có tab cộng tác |
| E | 6 | Bật flag VPS |

## Ngoài scope (P2)

- Thay thế CSD Chat / dock Zalo bằng `wy-messenger`
- Migrate `csd_messages` / `csd_attachments` sang Weavy
- Webhook Weavy → `csd_notifications`
- Client/portal user (không phải staff) vào Weavy
- AI agents Weavy, meetings, Office

## Self-review

- Auth: Task 2 + checklist Task 6.
- Embed Chat/Files: Task 4–5.
- Sync user: Task 3 + upsert trong mỗi lần issue token (Task 2).
- Không placeholder API path / uid / env name.
- CSD Chat không bị xóa.
