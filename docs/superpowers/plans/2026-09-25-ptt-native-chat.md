# PTT native chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an iOS and Android app named PTT that opens Chat and signs in with only the chat username and password.

**Architecture:** A new public API issues a staff access JWT with `scope: 'chat'` for the CRM staff row linked to that chat account. The existing chat UI loads inside a Capacitor shell at `https://rs.pttads.vn/crm/csd/chat?shell=native`. That token cannot call CRM routes outside chat. Web CRM login stays email plus password, then the existing chat login.

**Tech Stack:** NestJS `ptt-crm-api`, Next.js ops-web, Capacitor 6, Vitest, Jest.

**Spec:** `docs/superpowers/specs/2026-09-25-csd-chat-native-store-srs.md` version 1.1

## Global Constraints

- Display name **PTT**. Bundle id `vn.pttads.ptt`. Not `vn.pttads.portal`.
- One login form: chat username and chat password. No CRM email field. No CRM password field. No sign-up.
- Web CRM still uses staff login before chat. Do not remove `POST /api/crm/csd/chat/login`.
- Wrong username, wrong password, and disabled chat account all return the same error. UI text is exactly `Sai tên đăng nhập hoặc mật khẩu chat`.
- Do not log the password. Do not put the token in a URL.
- Chat scope cannot open `/admin/crm/csd/chat-accounts` or non-chat CRM APIs.
- Do not rewrite chat screens in Swift or Kotlin. Do not add WebSocket.
- Voice and video stay DM-only. Group call button stays disabled with title `Chỉ hỗ trợ hội thoại DM`.
- iOS 16+. Android 8+ (`minSdkVersion` 26). Portrait only.
- HTTPS only to `rs.pttads.vn`.
- Do not invent messages, tickets, or KPI numbers in screenshots or tests.
- N1 does not claim background push. N2 adds APNs and FCM.

## File map

| File | Job |
|------|-----|
| `services/ptt-crm-api/src/staff-auth/staff-jwt.util.ts` | Optional `scope: 'chat'` |
| `services/ptt-crm-api/src/csd/csd-chat-scope.util.ts` | Which paths a chat token may call |
| `services/ptt-crm-api/src/csd/csd-chat-session.service.ts` | Login by username, sign access token, no refresh token |
| `services/ptt-crm-api/src/csd/csd-chat-session.controller.ts` | `POST /api/crm/csd/chat/session` with no staff guard |
| `services/ptt-crm-api/src/staff-auth/staff-or-internal-key.guard.ts` | Reject chat scope off the allowlist |
| `services/ops-web/src/lib/crm/csd-chat-shell.ts` | `shell=native` |
| `services/ops-web/src/components/crm/csd/CsdChatOnlyLoginForm.tsx` | Username + password only |
| `services/ops-web/src/app/crm/csd/chat/page.tsx` | Native shell skips CRM login |
| `services/ptt-app/` | Capacitor iOS + Android shell |

---

### Task 1: Chat-scoped JWT

**Files:**
- Modify: `services/ptt-crm-api/src/staff-auth/staff-jwt.util.ts`
- Test: `services/ptt-crm-api/src/staff-auth/staff-jwt.util.spec.ts`

**Interfaces:**
- Produces: `StaffJwtPayload.scope?: 'chat'`

- [ ] **Step 1: Write the failing test**

Add to `staff-jwt.util.spec.ts`:

```ts
it('keeps an optional chat scope on a signed access token', () => {
  const token = signStaffJwt(
    {
      sub: '42',
      email: 'a@pttads.vn',
      display_name: 'A',
      position_id: 1,
      token_type: 'access',
      scope: 'chat',
    },
    'secret',
    3600,
  );
  const payload = verifyStaffJwt(token, 'secret');
  expect(payload?.scope).toBe('chat');
  expect(payload?.token_type).toBe('access');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-auth/staff-jwt.util.spec.ts --no-coverage`

Expected: FAIL, `scope` is not a known claim or is stripped.

- [ ] **Step 3: Add the claim**

On `StaffJwtPayload`:

```ts
scope?: 'chat';
```

`signStaffJwt` already spreads claims, so no other change. `verifyStaffJwt` returns the parsed payload, so `scope` survives.

- [ ] **Step 4: Run test to verify it passes**

Run the same jest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/staff-auth/staff-jwt.util.ts services/ptt-crm-api/src/staff-auth/staff-jwt.util.spec.ts
git commit -m "feat(crm): allow a chat-scoped staff access token"
```

---

### Task 2: Allowlist for that token

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-chat-scope.util.ts`
- Test: `services/ptt-crm-api/src/csd/csd-chat-scope.util.spec.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-or-internal-key.guard.ts`

**Interfaces:**
- Consumes: `payload.scope === 'chat'`
- Produces: `isChatScopedPath(path: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { isChatScopedPath } from './csd-chat-scope.util';

describe('isChatScopedPath', () => {
  it('allows chat conversation and summary routes', () => {
    expect(isChatScopedPath('/api/crm/csd/chat/session')).toBe(true);
    expect(isChatScopedPath('/api/crm/csd/conversations/abc/messages')).toBe(true);
    expect(isChatScopedPath('/api/crm/csd/ai/conversations/abc/summarize')).toBe(true);
    expect(isChatScopedPath('/api/crm/csd/files/abc')).toBe(true);
  });

  it('blocks admin, email, and the rest of CRM', () => {
    expect(isChatScopedPath('/api/crm/csd/admin/chat-accounts')).toBe(false);
    expect(isChatScopedPath('/api/crm/csd/emails/send')).toBe(false);
    expect(isChatScopedPath('/api/crm/leads')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/csd/csd-chat-scope.util.spec.ts --no-coverage`

Expected: FAIL, module missing.

- [ ] **Step 3: Implement the allowlist and the guard check**

```ts
const PREFIXES = [
  '/api/crm/csd/chat',
  '/api/crm/csd/conversations',
  '/api/crm/csd/messages',
  '/api/crm/csd/files',
  '/api/crm/csd/calls',
  '/api/crm/csd/staff',
  '/api/crm/csd/ai/conversations',
  '/api/crm/csd/ai/interactions',
];

export function isChatScopedPath(path: string): boolean {
  const clean = path.split('?')[0];
  return PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}
```

`/api/crm/csd/chat` matches `/api/crm/csd/chat/session`. It does not match `/api/crm/csd/chat-evil`. `/api/crm/csd/staff/1/avatar` matches the staff prefix.

In `StaffOrInternalKeyGuard`, after `req.staffUser = payload`:

```ts
if (payload.scope === 'chat' && !isChatScopedPath(req.path)) {
  throw new ForbiddenException({ error: 'chat_scope_forbidden' });
}
```

Import `ForbiddenException` from `@nestjs/common` and `isChatScopedPath` from `../csd/csd-chat-scope.util`.

A token with no `scope` stays a full CRM token.

- [ ] **Step 4: Run test to verify it passes**

Same jest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/csd/csd-chat-scope.util.ts services/ptt-crm-api/src/csd/csd-chat-scope.util.spec.ts services/ptt-crm-api/src/staff-auth/staff-or-internal-key.guard.ts
git commit -m "feat(crm): keep chat tokens off CRM admin routes"
```

---

### Task 3: Login with chat username only

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-chat-session.service.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-session.controller.ts`
- Test: `services/ptt-crm-api/src/csd/csd-chat-session.service.spec.ts`
- Modify: `services/ptt-crm-api/src/csd/csd.module.ts`

**Interfaces:**
- Consumes: `CsdChatAccountsRepository.findByUsername`, `findCrmStaff`, `verifyPortalPassword`, `signStaffJwt`
- Produces: `POST /api/crm/csd/chat/session` body `{ username, password }` → `{ access_token, token_type: 'Bearer', expires_in, staff_id, username }` or 401 `{ error: 'invalid_chat_credentials' }`

The controller must not use `StaffOrInternalKeyGuard`. Register it on `CsdModule` next to the other controllers.

- [ ] **Step 1: Write the failing test**

```ts
it('rejects a disabled account with the same error as a bad password', async () => {
  repo.findByUsername.mockResolvedValue({
    enabled: false,
    username: 'lan',
    password_hash: 'hash',
    staff_id: 7,
  });
  await expect(svc.openSession({ username: 'lan', password: 'secret' })).rejects.toMatchObject({
    response: { error: 'invalid_chat_credentials' },
  });
});

it('signs a chat-scoped access token and does not return a refresh token', async () => {
  repo.findByUsername.mockResolvedValue({
    enabled: true,
    username: 'lan',
    password_hash: 'hash',
    staff_id: 7,
    display_name_vi: 'Lan',
  });
  repo.findCrmStaff.mockResolvedValue({
    staff_id: 7,
    staff_name: 'Lan',
    staff_email: 'lan@pttads.vn',
    position_id: 3,
  });
  verifyPortalPassword.mockReturnValue(true);
  const out = await svc.openSession({ username: 'Lan', password: 'secret' });
  expect(out.refresh_token).toBeUndefined();
  expect(out.staff_id).toBe(7);
  const payload = verifyStaffJwt(out.access_token, 'secret');
  expect(payload?.scope).toBe('chat');
  expect(payload?.sub).toBe('7');
  expect(payload?.token_type).toBe('access');
});
```

Wire the spec the same way as `csd-chat-accounts.service.spec.ts`: mock the repository, mock `verifyPortalPassword`, pass a fake JWT secret into the service constructor.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && ./node_modules/.bin/jest src/csd/csd-chat-session.service.spec.ts --no-coverage`

Expected: FAIL, service missing.

- [ ] **Step 3: Implement session open**

```ts
async openSession(input: { username?: string; password?: string }) {
  const username = (input.username ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  const row = username ? await this.repo.findByUsername(username) : null;
  const staff = row ? await this.repo.findCrmStaff(row.staff_id) : null;
  const ok =
    Boolean(row?.enabled && row.username && row.password_hash && staff) &&
    verifyPortalPassword(password, row!.password_hash);
  if (!ok || !row || !staff) {
    throw new UnauthorizedException({ error: 'invalid_chat_credentials' });
  }
  const access_token = signStaffJwt(
    {
      sub: String(row.staff_id),
      email: staff.staff_email.trim() || `staff-${row.staff_id}@chat.pttads.vn`,
      display_name: row.display_name_vi || staff.staff_name || row.username,
      position_id: staff.position_id ?? 0,
      token_type: 'access',
      scope: 'chat',
    },
    this.config.staffJwtSecret,
    this.config.staffJwtTtlSec,
  );
  return {
    access_token,
    token_type: 'Bearer' as const,
    expires_in: this.config.staffJwtTtlSec,
    staff_id: row.staff_id,
    username: row.username,
  };
}
```

Do not write the password or the token to the logger.

Controller:

```ts
@Controller('api/crm/csd/chat')
export class CsdChatSessionController {
  constructor(private readonly sessions: CsdChatSessionService) {}

  @Post('session')
  open(@Body() body: { username?: string; password?: string }) {
    return this.sessions.openSession(body ?? {});
  }
}
```

Add the controller and provider to `csd.module.ts`. Leave `CsdChatAccountsController.login` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Same jest command. Expected: PASS. Also run `csd-chat-accounts.service.spec.ts` and expect PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/csd/csd-chat-session.service.ts services/ptt-crm-api/src/csd/csd-chat-session.controller.ts services/ptt-crm-api/src/csd/csd-chat-session.service.spec.ts services/ptt-crm-api/src/csd/csd.module.ts
git commit -m "feat(crm): sign in to chat with the chat password only"
```

---

### Task 4: Native shell on the chat page

**Files:**
- Modify: `services/ops-web/src/lib/crm/csd-chat-shell.ts`
- Modify: `services/ops-web/src/lib/crm/csd-chat-shell.spec.ts`
- Create: `services/ops-web/src/components/crm/csd/CsdChatOnlyLoginForm.tsx`
- Modify: `services/ops-web/src/app/crm/csd/chat/page.tsx`
- Modify: `services/ops-web/src/lib/crm/csd-api.ts` (add `openCsdChatSession`)

**Interfaces:**
- Consumes: `POST /api/crm/csd/chat/session`
- Produces: `detectCsdChatShell` returns `'native'` when `shell=native`

- [ ] **Step 1: Extend the shell test**

```ts
it('treats shell=native as the store app', () => {
  expect(detectCsdChatShell({ search: '?shell=native' })).toBe('native');
  expect(detectCsdChatShell({ search: '?shell=native', displayMode: 'standalone' })).toBe('native');
});
```

Update the union: `'crm' | 'pwa' | 'desktop' | 'native'`. Check `shell === 'native'` before the standalone branch.

- [ ] **Step 2: Run vitest to verify it fails, then make it pass**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts`

- [ ] **Step 3: Add the form and the API call**

`openCsdChatSession` posts JSON to `/api/crm/csd/chat/session` with no Authorization header. On `invalid_chat_credentials`, throw `Error('invalid_chat_credentials')`.

`CsdChatOnlyLoginForm` has two fields, labels `Tên đăng nhập chat` and `Mật khẩu chat`, button `Đăng nhập`. No email input. No link to `/login`. No đăng ký.

On `page.tsx`, when `readCsdChatShell() === 'native'`:

- Do not mount the CRM email flow and do not call `router.replace('/login')`.
- `chrome="chat"` so `OpsNav` stays off (already implemented for non-crm shells).
- If `sessionStorage` key `ptt.chat.access` is empty, render `CsdChatOnlyLoginForm`.
- On success, `sessionStorage.setItem('ptt.chat.access', access_token)` and `updateAccessToken(access_token)` so existing `csd-api` sends `Authorization: Bearer`.
- Logout clears that key and `clearSession()`, then shows the chat form again.
- Map `invalid_chat_credentials` to `Sai tên đăng nhập hoặc mật khẩu chat`.

`useCsdPageAuth` redirects to CRM login when the access token is missing. For this page in native shell, skip that hook. Read the token from `ptt.chat.access` first and pass it into `CsdChatWorkspace`.

Ticket links already open a new tab when the shell is not `crm`. Keep that for `native`.

- [ ] **Step 4: Run vitest**

Run: `cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/csd-chat-shell.ts services/ops-web/src/lib/crm/csd-chat-shell.spec.ts services/ops-web/src/components/crm/csd/CsdChatOnlyLoginForm.tsx services/ops-web/src/app/crm/csd/chat/page.tsx services/ops-web/src/lib/crm/csd-api.ts
git commit -m "feat(crm): show only the chat login inside the PTT app"
```

---

### Task 5: Capacitor app PTT

**Files:**
- Create: `services/ptt-app/package.json`
- Create: `services/ptt-app/capacitor.config.ts`
- Create: `services/ptt-app/www/index.html`
- Create: `services/ptt-app/README.md`

**Interfaces:**
- Consumes: `https://rs.pttads.vn/crm/csd/chat?shell=native`
- Produces: `npx cap sync` projects `ios/` and `android/` with app id `vn.pttads.ptt` and name `PTT`

- [ ] **Step 1: package.json**

```json
{
  "name": "ptt-app",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "cap:sync": "cap sync",
    "cap:open:ios": "cap open ios",
    "cap:open:android": "cap open android"
  },
  "dependencies": {
    "@capacitor/android": "6.2.0",
    "@capacitor/core": "6.2.0",
    "@capacitor/ios": "6.2.0"
  },
  "devDependencies": {
    "@capacitor/cli": "6.2.0",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2: capacitor.config.ts**

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.pttads.ptt',
  appName: 'PTT',
  webDir: 'www',
  server: {
    url: 'https://rs.pttads.vn/crm/csd/chat?shell=native',
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['rs.pttads.vn'],
  },
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false },
};

export default config;
```

- [ ] **Step 3: Offline page**

`www/index.html` is only the fallback if the remote URL cannot load. Body text: `Không tải được PTT. Kiểm tra mạng rồi mở lại app.` No CRM links.

After `npm install` and `npx cap add ios` and `npx cap add android` (macOS for iOS):

- iOS deployment target 16.0.
- Android `minSdkVersion` 26.
- `AndroidManifest.xml` `android:screenOrientation="portrait"`.
- iOS `Info.plist` `UISupportedInterfaceOrientations` = portrait only.

README: `cd services/ptt-app && npm install && npx cap add ios && npx cap add android && npm run cap:sync`. Do not commit `node_modules`. Do not commit signing keys.

- [ ] **Step 4: Commit**

```bash
git add services/ptt-app/package.json services/ptt-app/capacitor.config.ts services/ptt-app/www/index.html services/ptt-app/README.md
git commit -m "feat(crm): add the PTT iOS and Android shell"
```

Generated `ios/` and `android/` after `cap add` are committed in a follow-up once the orientation and SDK lines above are set. Do not commit the portal `services/mobile-shell` changes.

---

### Task 6: Push when the phone is locked (N2)

Do this only after Task 3 is deployed. N1 TestFlight builds must not claim this works.

**Files:**
- Create: `services/ptt-crm-api/src/csd/csd-chat-devices.repository.ts`
- Create: `services/ptt-crm-api/src/csd/csd-chat-push.service.ts`
- Modify: `services/ptt-crm-api/src/csd/csd-chat.service.ts` (after a message is stored)
- Modify: `services/ptt-app/package.json` (add `@capacitor/push-notifications`)

**Interfaces:**
- `POST /api/crm/csd/chat/devices` with the chat token, body `{ platform: 'ios' | 'android', token: string }`
- Table `csd_chat_devices (staff_id, platform, token, updated_at)`, unique `(platform, token)`

- [ ] **Step 1: Test that a saved message calls push with the conversation id and no message body in the logs**

The push payload is `{ title, conversation_id }`. `title` is the sender display name. Body is the preview already stored on the message, truncated to 120 characters. Do not include the raw password or the access token.

- [ ] **Step 2: Send**

iOS uses APNs. Android uses FCM. Keys stay in server env `PTT_APNS_*` and `PTT_FCM_SERVER_KEY`, never in git. If the env vars are empty, skip send and do not fail the message save.

- [ ] **Step 3: App**

After chat login, request permission once. Register the device token with `POST /api/crm/csd/chat/devices`. On notification tap, open `https://rs.pttads.vn/crm/csd/chat?shell=native&c={conversation_id}`.

Badge uses `GET /api/crm/csd/chat/unread-count` with the chat token.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(crm): notify the PTT app when a chat message arrives"
```

---

### Task 7: Files and calls (N3)

**Files:**
- Modify: `services/ptt-app/ios/App/App/Info.plist`
- Modify: `services/ptt-app/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Usage strings, Vietnamese, one sentence each**

iOS:

- `NSMicrophoneUsageDescription`: `PTT dùng micro để gọi thoại trong hội thoại riêng.`
- `NSCameraUsageDescription`: `PTT dùng camera để gọi video trong hội thoại riêng.`
- `NSPhotoLibraryUsageDescription`: `PTT mở ảnh bạn chọn để gửi trong chat.`

Android permissions: `RECORD_AUDIO`, `CAMERA`, `POST_NOTIFICATIONS`.

- [ ] **Step 2: File open**

A non-image attachment uses the OS viewer. Images stay in the thread. If the user denies the microphone or camera, show `Cần quyền micro để gọi` or `Cần quyền camera để gọi video` and do not crash. Group and client threads keep the call buttons disabled.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(crm): open chat files and request call permissions in PTT"
```

---

### Task 8: Store listing (N4)

No application code. Do not submit until Tasks 1–5 pass on a device. Task 6 is required before the public listing promises lock-screen alerts. Task 7 is required before the listing shows calls.

- [ ] Apple Developer account and App Store Connect app **PTT**, bundle `vn.pttads.ptt`.
- [ ] Play Console app **PTT**, application id `vn.pttads.ptt`.
- [ ] Description states this is internal chat, not a public social network, and not PTT Portal.
- [ ] Screenshots from a real enabled chat account. No invented numbers.
- [ ] Public privacy policy URL. The app does not sell chat data.
- [ ] Demo account for App Review: chat username and chat password only. Not a production SUPER-ADMIN if policy forbids that.
- [ ] TestFlight internal, then Play internal, then production.

## Verification before TestFlight

Use an enabled chat account. Do not create fake messages.

1. `POST /api/crm/csd/chat/session` with the chat username succeeds and the JWT `scope` is `chat`.
2. The same call with a CRM email and CRM password returns 401 `invalid_chat_credentials`.
3. A disabled account returns that same error.
4. That token gets 403 `chat_scope_forbidden` on `GET /api/crm/csd/admin/chat-accounts`.
5. The app screen has no email field.
6. `https://rs.pttads.vn/crm/csd/chat` without `shell=native` still shows CRM login first.
7. Group send-lock, single pin, and DM-only calls behave as on the web.

Run:

```bash
cd services/ptt-crm-api && ./node_modules/.bin/jest src/staff-auth/staff-jwt.util.spec.ts src/csd/csd-chat-scope.util.spec.ts src/csd/csd-chat-session.service.spec.ts src/csd/csd-chat-accounts.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/csd-chat-shell.spec.ts
```

Expected: PASS.
