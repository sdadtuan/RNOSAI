# Staff Account Self-Service (Gói C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang `/account` + menu avatar (UI A): hồ sơ xem, avatar, đổi mật khẩu Nest/Keycloak, MFA link, từng phiên, nhật ký — mọi staff đã login, không cap mới.

**Architecture:** Pure utils trước (UA label, magic-byte ảnh, audit VI, crop box). JWT thêm `sid`. PG `staff_sessions` + cột `staff_users.avatar_*`. Login/OIDC tạo phiên; refresh giữ sid; guard từ chối sid đã revoke. Account API dưới `/api/v1/staff/auth/account/*`. Ops-web: dropdown avatar → `/account`; GET avatar bằng Bearer → blob.

**Tech Stack:** NestJS `ptt-crm-api` (Jest unit + `test:e2e`), PostgreSQL, multer memoryStorage, ops-web Next.js 14 (Vitest). Không `sharp` cho avatar. Không Keycloak Admin API.

**Spec:** [`docs/superpowers/specs/2026-09-01-staff-account-self-service-design.md`](../specs/2026-09-01-staff-account-self-service-design.md) v1.1 · UI **A** (menu avatar → trang, không dialog).

## Global Constraints

- Audience: staff ops-web only. Không portal `/settings`.
- Không cap mới. `/account` không nằm `PUBLIC_PATHS` (`/login`, `/403`).
- Không sửa email / `display_name` / chức vụ / team.
- Không Keycloak Admin API. Password SSO = `{issuer}/account` do server ghép.
- Không sync mật khẩu Nest ↔ Keycloak.
- JWT cũ không `sid` vẫn sống; refresh gắn sid mới. Stub/`staff-001` (sub không UUID) **không** insert `staff_sessions` — e2e stub hiện tại phải xanh.
- Avatar: jpeg/png/webp ≤ 1 MB; magic-byte; không SVG/GIF/public URL.
- Copy UI tiếng Việt theo spec §10. Không log plaintext password.
- Offboard giữ `auth_token_version + 1`. Revoke-all cũng `tv++`.
- Password Nest min 8, `hashPortalPassword` / `verifyPortalPassword`.
- CEO post-login `/crm/ceo` không đổi.
- Apply DDL **trước** khi ship `assertSession` lên VPS.
- Branch gợi ý: `feat/staff-account-self-service` from `main`.

## File map

| File | Role | Task |
|------|------|------|
| Create `services/ptt-crm-api/src/staff-auth/staff-device-label.util.ts` | UA → `device_label` | 1 |
| Create `services/ptt-crm-api/src/staff-auth/staff-device-label.util.spec.ts` | Jest UA | 1 |
| Create `services/ptt-crm-api/src/staff-auth/staff-avatar-image.util.ts` | MIME + magic + size | 1 |
| Create `services/ptt-crm-api/src/staff-auth/staff-avatar-image.util.spec.ts` | Jest ảnh | 1 |
| Create `services/ptt-crm-api/src/staff-auth/staff-account-audit.util.ts` | `event_type` → `summary_vi` | 1 |
| Create `services/ptt-crm-api/src/staff-auth/staff-account-audit.util.spec.ts` | Jest copy | 1 |
| Create `services/ptt-crm-api/src/staff-auth/staff-account.types.ts` | DTO account | 1 |
| Create `services/ptt-crm-api/src/staff-auth/staff-account-rate.util.ts` | Rate password/avatar | 1 |
| Modify `services/ptt-crm-api/src/staff-auth/staff-jwt.util.ts` | Claim `sid?` | 2 |
| Create `services/ptt-crm-api/src/staff-auth/staff-jwt.util.spec.ts` | Round-trip sid | 2 |
| Modify `services/ptt-crm-api/src/staff-auth/staff-auth-audit.repository.ts` | Event types mới | 2 |
| Create `docs/specs/2026-09-01-postgresql-ddl-staff-sessions.sql` | sessions + avatar cols | 3 |
| Create `scripts/apply_pg_ddl_staff_sessions.sh` | psql apply | 3 |
| Create `services/ptt-crm-api/src/staff-auth/staff-sessions.repository.ts` | CRUD phiên | 4 |
| Create `services/ptt-crm-api/src/staff-auth/staff-sessions.repository.spec.ts` | Jest repo (mock query) | 4 |
| Modify `staff-auth.service.ts` | issueTokens + assertSession | 5 |
| Modify `staff-auth.controller.ts` | `@Req()` ip/ua login+refresh | 5 |
| Modify `test/staff-auth.e2e-spec.ts` | stub login vẫn 200 | 5 |
| Create `staff-account.service.ts` + `.spec.ts` | password, me extras, bundle | 6 |
| Create `staff-avatar.storage.ts` + `.spec.ts` | disk + path escape | 7 |
| Modify `staff-auth.controller.ts` | account + avatar routes | 8 |
| Modify `staff-auth.module.ts` | providers mới | 8 |
| Create `services/ops-web/src/lib/account/account-error.util.ts` + spec | error → VI | 9 |
| Create `services/ops-web/src/lib/account/crop-avatar.util.ts` + spec | `centerSquareCropBox` | 9 |
| Modify `services/ops-web/src/lib/api.ts` | fetch account/avatar | 9 |
| Modify `services/ops-web/src/lib/auth.ts` | `has_avatar`, `avatar_updated_at` | 9 |
| Create `services/ops-web/src/app/account/page.tsx` | 5 khối | 10 |
| Create `services/ops-web/src/components/account/*.tsx` | form, sessions, avatar | 10 |
| Modify `OpsNav.tsx` | UI A menu + blob avatar | 11 |

## Out of scope (reject nếu task thêm)

- Portal change-password, quên mật khẩu, admin session của user khác, Keycloak Admin, S3/CDN, sharp resize, avatar trên `/crm/staff/[id]`, theme/locale, đổi email.

---

### Task 1: Pure utils (label, ảnh, audit VI, rate)

**Files:**
- Create: `services/ptt-crm-api/src/staff-auth/staff-device-label.util.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-device-label.util.spec.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-avatar-image.util.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-avatar-image.util.spec.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-account-audit.util.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-account-audit.util.spec.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-account-rate.util.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-account-rate.util.spec.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-account.types.ts`

**Interfaces:**
- Consumes: UA string; `{ buffer: Buffer; mimetype: string; size: number }`; audit `event_type`; rate key
- Produces:
  - `deviceLabelFromUa(ua: string): string`
  - `assertStaffAvatarUpload(file): void` throws `invalid_image` \| `file_too_large` \| `file_required`
  - `staffAuditSummaryVi(eventType: string): string`
  - `StaffAccountRateLimiter.hit(bucket, userId): boolean` (`false` = limited)
  - types in `staff-account.types.ts` (copy spec §6)

- [ ] **Step 1: Write failing tests**

```ts
// staff-device-label.util.spec.ts
import { deviceLabelFromUa } from './staff-device-label.util';

describe('deviceLabelFromUa', () => {
  it('parses Chrome macOS', () => {
    expect(
      deviceLabelFromUa(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome · macOS');
  });
  it('parses Safari iPhone', () => {
    expect(
      deviceLabelFromUa(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iPhone');
  });
  it('unknown empty', () => {
    expect(deviceLabelFromUa('')).toBe('Không rõ');
  });
});
```

```ts
// staff-avatar-image.util.spec.ts
import { assertStaffAvatarUpload } from './staff-avatar-image.util';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe('assertStaffAvatarUpload', () => {
  it('accepts small png', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: PNG, mimetype: 'image/png', size: PNG.length }),
    ).not.toThrow();
  });
  it('rejects svg', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: SVG, mimetype: 'image/svg+xml', size: SVG.length }),
    ).toThrow('invalid_image');
  });
  it('rejects png mime with svg bytes', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: SVG, mimetype: 'image/png', size: SVG.length }),
    ).toThrow('invalid_image');
  });
  it('rejects over 1MB', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: PNG, mimetype: 'image/png', size: 1_000_001 }),
    ).toThrow('file_too_large');
  });
  it('rejects empty', () => {
    expect(() =>
      assertStaffAvatarUpload({ buffer: Buffer.alloc(0), mimetype: 'image/png', size: 0 }),
    ).toThrow('file_required');
  });
});
```

```ts
// staff-account-audit.util.spec.ts
import { staffAuditSummaryVi } from './staff-account-audit.util';

describe('staffAuditSummaryVi', () => {
  it('maps known events', () => {
    expect(staffAuditSummaryVi('sso_login')).toBe('Đăng nhập SSO');
    expect(staffAuditSummaryVi('password_changed')).toBe('Đổi mật khẩu Nest');
    expect(staffAuditSummaryVi('avatar_updated')).toBe('Cập nhật ảnh đại diện');
  });
  it('unknown is generic', () => {
    expect(staffAuditSummaryVi('nope')).toBe('Sự kiện tài khoản');
  });
});
```

```ts
// staff-account-rate.util.spec.ts
import { StaffAccountRateLimiter } from './staff-account-rate.util';

describe('StaffAccountRateLimiter', () => {
  it('allows 5 password hits then blocks', () => {
    const lim = new StaffAccountRateLimiter();
    for (let i = 0; i < 5; i++) expect(lim.hit('password', 'u1', 15 * 60_000, 5)).toBe(true);
    expect(lim.hit('password', 'u1', 15 * 60_000, 5)).toBe(false);
    expect(lim.hit('password', 'u2', 15 * 60_000, 5)).toBe(true);
  });
  it('allows 10 avatar hits', () => {
    const lim = new StaffAccountRateLimiter();
    for (let i = 0; i < 10; i++) expect(lim.hit('avatar', 'u1', 15 * 60_000, 10)).toBe(true);
    expect(lim.hit('avatar', 'u1', 15 * 60_000, 10)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd services/ptt-crm-api && npx jest src/staff-auth/staff-device-label.util.spec.ts src/staff-auth/staff-avatar-image.util.spec.ts src/staff-auth/staff-account-audit.util.spec.ts src/staff-auth/staff-account-rate.util.spec.ts --no-coverage
```

- [ ] **Step 3: Implement utils + types**

`deviceLabelFromUa`: detect Chrome/Firefox/Safari/Edge + macOS/Windows/Linux/iPhone/Android; else `Không rõ`.

`assertStaffAvatarUpload`: empty → `file_required`; size > 1_000_000 → `file_too_large`; mime ∈ `image/jpeg|image/jpg|image/png|image/webp`; magic: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`. Throw `Error` with those codes (service map → HTTP).

`staffAuditSummaryVi`: map đúng bảng spec §6.6.

`StaffAccountRateLimiter`: in-memory `Map<string, number[]>` timestamps; prune older than window.

`staff-account.types.ts` — export:

```ts
export type StaffLoginMethod = 'nest_password' | 'sso';

export interface StaffSessionListItem {
  id: string;
  current: boolean;
  login_method: StaffLoginMethod;
  device_label: string;
  ip: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface StaffAccountAuditItem {
  id: string;
  event_type: string;
  created_at: string;
  summary_vi: string;
}

export interface StaffAccountTeam {
  id: number;
  name: string;
}
```

(Các field `me` extras khai báo khi extend `StaffMeResponse` ở Task 6.)

- [ ] **Step 4: Re-run Jest — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/staff-auth/staff-device-label.util.ts \
  services/ptt-crm-api/src/staff-auth/staff-device-label.util.spec.ts \
  services/ptt-crm-api/src/staff-auth/staff-avatar-image.util.ts \
  services/ptt-crm-api/src/staff-auth/staff-avatar-image.util.spec.ts \
  services/ptt-crm-api/src/staff-auth/staff-account-audit.util.ts \
  services/ptt-crm-api/src/staff-auth/staff-account-audit.util.spec.ts \
  services/ptt-crm-api/src/staff-auth/staff-account-rate.util.ts \
  services/ptt-crm-api/src/staff-auth/staff-account-rate.util.spec.ts \
  services/ptt-crm-api/src/staff-auth/staff-account.types.ts
git commit -m "$(cat <<'EOF'
feat(staff-auth): add account util helpers for sessions and avatar

EOF
)"
```

---

### Task 2: JWT `sid` + audit event union

**Files:**
- Modify: `services/ptt-crm-api/src/staff-auth/staff-jwt.util.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-jwt.util.spec.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth-audit.repository.ts`

**Interfaces:**
- Consumes: existing `signStaffJwt` / `verifyStaffJwt`
- Produces: `StaffJwtPayload.sid?: string` round-trip; `StaffAuthAuditEvent` thêm `password_changed | session_revoked | sessions_revoked_others | sessions_revoked_all | avatar_updated | avatar_removed`

- [ ] **Step 1: Failing test**

```ts
import { signStaffJwt, verifyStaffJwt } from './staff-jwt.util';

const secret = 'test-staff-secret-phase0-min-len-32';

describe('staff jwt sid', () => {
  it('round-trips sid on access token', () => {
    const token = signStaffJwt(
      {
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'a@pttads.vn',
        display_name: 'A',
        position_id: 1,
        token_type: 'access',
        sid: '22222222-2222-4222-8222-222222222222',
        tv: 0,
      },
      secret,
      3600,
    );
    const payload = verifyStaffJwt(token, secret);
    expect(payload?.sid).toBe('22222222-2222-4222-8222-222222222222');
    expect(payload?.token_type).toBe('access');
  });
  it('tokens without sid still verify', () => {
    const token = signStaffJwt(
      {
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'a@pttads.vn',
        display_name: 'A',
        position_id: 1,
        token_type: 'refresh',
        tv: 0,
      },
      secret,
      3600,
    );
    expect(verifyStaffJwt(token, secret)?.sid).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — FAIL until `sid` on payload type**

```bash
cd services/ptt-crm-api && npx jest src/staff-auth/staff-jwt.util.spec.ts --no-coverage
```

- [ ] **Step 3: Add `sid?: string` to `StaffJwtPayload`. `signStaffJwt` already spreads claims — no extra logic. Extend `StaffAuthAuditEvent` union exactly as spec §5.3.**

- [ ] **Step 4: Jest PASS**

- [ ] **Step 5: Commit** `feat(staff-auth): carry optional session sid on staff JWT`

---

### Task 3: DDL sessions + avatar columns

**Files:**
- Create: `docs/specs/2026-09-01-postgresql-ddl-staff-sessions.sql`
- Create: `scripts/apply_pg_ddl_staff_sessions.sh`

**Interfaces:**
- Consumes: existing `staff_users(id UUID)`
- Produces: `staff_sessions` + `staff_users.avatar_storage_key` / `avatar_updated_at`

- [ ] **Step 1: Write SQL** — copy spec §5.1 + §5.4 verbatim (`CREATE TABLE IF NOT EXISTS`, indexes, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

- [ ] **Step 2: Write apply script** — clone `scripts/apply_pg_ddl_staff_sso_r4.sh`, point `DDL` at the new file, echo `==> Apply staff sessions + avatar DDL`.

- [ ] **Step 3: Apply local (skip nếu không có PG)**

```bash
bash scripts/apply_pg_ddl_staff_sessions.sh
```

Expected: `OK  staff sessions + avatar DDL applied` hoặc psql connection error (ghi chú, không block unit).

- [ ] **Step 4: Commit** `feat(db): add staff_sessions and staff avatar columns`

---

### Task 4: `StaffSessionsRepository`

**Files:**
- Create: `services/ptt-crm-api/src/staff-auth/staff-sessions.repository.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-sessions.repository.spec.ts`

**Interfaces:**
- Consumes: `Pool.query`; `isUuidStaffUserId(id: string): boolean` (regex UUID)
- Produces:
```ts
insert(row: {
  id: string;
  userId: string;
  loginMethod: 'nest_password' | 'sso';
  userAgent: string;
  ip: string | null;
  expiresAt: Date;
}): Promise<void>
touch(id: string, expiresAt: Date): Promise<void>
findById(id: string): Promise<StaffSessionDbRow | null>
listForUser(userId: string, now: Date): Promise<StaffSessionDbRow[]>
revoke(id: string, userId: string, reason: string, now: Date): Promise<'revoked' | 'already_revoked' | 'not_found'>
revokeOthers(userId: string, keepId: string, reason: string, now: Date): Promise<number>
revokeAll(userId: string, reason: string, now: Date): Promise<number>
```
`StaffSessionDbRow`: id, user_id, login_method, user_agent, ip (text|null), created_at, last_seen_at, expires_at, revoked_at, revoke_reason.

`listForUser`: `WHERE user_id = $1 AND (revoked_at IS NULL OR revoked_at > now() - interval '7 days') ORDER BY last_seen_at DESC LIMIT 20`.

- [ ] **Step 1: Failing test với mock pool**

```ts
import { StaffSessionsRepository } from './staff-sessions.repository';

function mockRepo(queryImpl: (...args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>) {
  const repo = new StaffSessionsRepository({
    query: queryImpl,
  } as never);
  return repo;
}

describe('StaffSessionsRepository.revoke', () => {
  it('returns not_found when 0 rows', async () => {
    const repo = mockRepo(async () => ({ rows: [], rowCount: 0 }));
    await expect(
      repo.revoke('sid', 'user', 'user_revoke', new Date()),
    ).resolves.toBe('not_found');
  });
});
```

Constructor: nhận `Pool` **hoặc** inject `query` qua `(private readonly db: Pick<Pool, 'query'>)` — implementer: add optional constructor for tests **or** set `pool` after construct. Preferred: `constructor(private readonly db: { query: Pool['query'] })` và production `StaffAuthService` / module provides `Pool` từ `AppConfigService.databaseUrl` giống `StaffAuthAuditRepository` (tự tạo Pool). Để test được, extract `createStaffSessionsRepository(db)`.

Simplest for this codebase: class creates Pool like audit repo; **unit-test `isUuidStaffUserId` + `toListItem` mapping** in the same file as exported functions, and test `revoke` SQL via injecting `query` on a subclass.

Export:

```ts
export function isUuidStaffUserId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function sessionToListItem(
  row: StaffSessionDbRow,
  currentSid: string | null,
): StaffSessionListItem
```

`sessionToListItem` dùng `deviceLabelFromUa(row.user_agent)`, ISO dates, `current: row.id === currentSid`. **Không** đưa raw UA vào item.

Tests bắt buộc:

```ts
expect(isUuidStaffUserId('staff-001')).toBe(false);
expect(isUuidStaffUserId('19d722af-0000-4000-8000-000000000001')).toBe(true);
```

```ts
const item = sessionToListItem({
  id: 's1',
  user_id: 'u1',
  login_method: 'sso',
  user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  ip: '1.2.3.4',
  created_at: new Date('2026-09-01T00:00:00Z'),
  last_seen_at: new Date('2026-09-01T01:00:00Z'),
  expires_at: new Date('2026-09-02T00:00:00Z'),
  revoked_at: null,
  revoke_reason: null,
}, 's1');
expect(item.current).toBe(true);
expect(item.device_label).toBe('Chrome · macOS');
expect(item.login_method).toBe('sso');
expect((item as { user_agent?: string }).user_agent).toBeUndefined();
```

- [ ] **Step 2: Jest FAIL**

```bash
cd services/ptt-crm-api && npx jest src/staff-auth/staff-sessions.repository.spec.ts --no-coverage
```

- [ ] **Step 3: Implement repository (Pool like audit repo). `insert` no-op / skip caller-side when `!isUuidStaffUserId`. SQL parameterized only.**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** `feat(staff-auth): add staff_sessions repository`

---

### Task 5: Bind sessions on login / refresh / guard

**Files:**
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.service.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.controller.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.module.ts` (provide sessions repo)
- Modify: `services/ptt-crm-api/test/staff-auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `StaffSessionsRepository`; `isUuidStaffUserId`; request meta `{ ip, userAgent, loginMethod }`
- Produces: JWT access+refresh cùng `sid` khi user UUID; `verifyAccessToken` gọi `assertSession` nếu `payload.sid`; refresh 401 `{ error: 'session_revoked' }` khi sid revoked/expired/missing row

Helper (cùng file service hoặc `staff-request-meta.util.ts`):

```ts
export function staffClientIp(req: { ip?: string; headers: IncomingHttpHeaders }): string | null {
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  if (xff) return xff.slice(0, 64);
  return req.ip ? String(req.ip).slice(0, 64) : null;
}
export function staffUserAgent(req: { headers: IncomingHttpHeaders }): string {
  return String(req.headers['user-agent'] ?? '').slice(0, 512);
}
```

`issueTokens(user, ctx?: { sid?: string; createSession?: { loginMethod; ip; userAgent } })`:
1. Nếu `ctx.createSession` và `isUuidStaffUserId(user.id)`: `sid = randomUUID()`, insert, `expiresAt = now + staffRefreshTtlSec`.
2. Nếu `ctx.sid`: reuse.
3. Sign access+refresh với `sid` nếu có.

`login` / `exchangeOidc`: pass `createSession` (`nest_password` | `sso`). Controller must pass `@Req()`.

`refresh`:
- verify refresh JWT
- `assertTokenVersion`
- nếu `payload.sid`: `findById`; nếu null/revoked/`expires_at < now` → 401 `session_revoked`; else `touch` + `issueTokens` với cùng sid (không đổi `login_method`)
- nếu không sid: `createSession` với `loginMethod` từ payload không có → dùng `nest_password` **chỉ khi** UUID (legacy bind). Spec: “tạo session mới”. Method: `nest_password` nếu không biết; nếu muốn chính xác hơn store method trên JWT — **không**. Dùng `sso` khi `staffAuthMode !== 'nest'` else `nest_password`.

`assertSession` trong `verifyAccessToken` sau `assertTokenVersion`:
- không sid → return
- stub / `!isUuidStaffUserId` → return
- row missing/revoked/expired → 401 `session_revoked`

Insert failure (table missing): **log + tiếp tục không sid** trên non-production; production (`NODE_ENV=production`) throw 503 `sessions_not_ready` — tránh lock-out local, fail-closed prod. Document in commit.

Controller:

```ts
@Post('login')
async login(@Req() req: Request, @Body() body: StaffLoginBody) {
  return this.auth.login(body.email ?? '', body.password ?? '', {
    ip: staffClientIp(req),
    userAgent: staffUserAgent(req),
  });
}
```

Cùng pattern `oidc/exchange` và `refresh`.

- [ ] **Step 1: Extend e2e** — existing 3 tests must still pass. Add:

```ts
it('login JWT may omit sid for stub users', async () => {
  if (!app) return;
  const res = await request(app.getHttpServer())
    .post('/api/v1/staff/auth/login')
    .send({ email: 'staff@test.local', password: 'pass123' })
    .expect(200);
  const parts = String(res.body.access_token).split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  expect(payload.sub).toBeTruthy();
  // stub sub is not UUID — sid absent is OK
});
```

- [ ] **Step 2: Run e2e**

```bash
cd services/ptt-crm-api && npm run test:e2e -- --testPathPattern=staff-auth
```

Expected: PASS (pg skip nếu `pgReplicaReady` false).

- [ ] **Step 3: Implement bind + unit-test `staffClientIp` nếu tách util** (`X-Forwarded-For: a, b` → `a`).

- [ ] **Step 4: Re-run e2e + `npx jest src/staff-auth --no-coverage`**

- [ ] **Step 5: Commit** `feat(staff-auth): bind staff JWT to staff_sessions sid`

---

### Task 6: Password change + extended `me`

**Files:**
- Create: `services/ptt-crm-api/src/staff-auth/staff-account.service.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-account.service.spec.ts`
- Modify: `staff-auth.types.ts` (`StaffMeResponse` extras optional)
- Modify: `staff-auth.service.ts` `me()` load extras (hoặc account service `buildProfile(payload)`)

**Interfaces:**
- Consumes: `hashPortalPassword`, `verifyPortalPassword`, sessions repo, audit, `StaffAccountRateLimiter`, `AppConfigService`
- Produces:
```ts
changePassword(user: StaffJwtPayload, current: string, next: string): Promise<{ ok: true; message: 'password_updated' }>
buildProfile(user: StaffJwtPayload): Promise<StaffMeResponse /* + extras */>
```

Errors (Nest exceptions):
- `staffNestLoginAllowed() === false` → 400 `password_change_sso_only`
- stub / `!isUuidStaffUserId` / no hash → 400 `password_change_not_available`
- rate false → 429 `rate_limited`
- bad current → 401 `invalid_current_password`
- next.trim().length < 8 → 400 `password_too_short` + `min_length: 8`
- current === next → 400 `password_unchanged`

Success path: update hash; `revokeOthers(user.sub, user.sid ?? '', 'password_changed', now)` (nếu không sid, skip others); audit `password_changed`; **không** `tv++`.

`buildProfile` extras: `account_kind`, `last_login_at`, `oidc_linked`, `password_login_enabled` (nest allowed AND hash exists AND uuid), `sso_enabled`, `mfa_required_for_position`, `keycloak_account_url` = issuer ? `${issuer.replace(/\/$/, '')}/account` : null, `teams` query:

```sql
SELECT t.id, t.name
FROM staff_user_teams sut
JOIN crm_teams t ON t.id = sut.team_id
WHERE sut.user_id = $1::uuid
```

(Nếu bảng khác tên — đọc `staff-org-users.repository.ts` join hiện tại và **dùng đúng tên bảng đó**.) `has_avatar`, `avatar_updated_at`.

- [ ] **Step 1: Service spec với mock deps**

```ts
describe('StaffAccountService.changePassword', () => {
  it('rejects keycloak-only mode', async () => {
    const svc = makeSvc({ nestAllowed: false });
    await expect(
      svc.changePassword(jwtUser, 'old', 'newpassword1'),
    ).rejects.toMatchObject({ response: { error: 'password_change_sso_only' } });
  });
  it('rejects short password', async () => {
    const svc = makeSvc({ nestAllowed: true, hash: 'scrypt:x' });
    await expect(
      svc.changePassword(jwtUser, 'oldpass12', 'short'),
    ).rejects.toMatchObject({ response: { error: 'password_too_short' } });
  });
});
```

`makeSvc` mock `verifyPortalPassword` via injecting a `passwordPort` **or** mock repo `findHash` + jest.mock on portal util.

- [ ] **Step 2: Jest FAIL**

```bash
cd services/ptt-crm-api && npx jest src/staff-auth/staff-account.service.spec.ts --no-coverage
```

- [ ] **Step 3: Implement. `me()` gọi `buildProfile` để một nguồn field.**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** `feat(staff-auth): add Nest password change and account profile fields`

---

### Task 7: Avatar storage + account avatar methods

**Files:**
- Create: `services/ptt-crm-api/src/staff-auth/staff-avatar.storage.ts`
- Create: `services/ptt-crm-api/src/staff-auth/staff-avatar.storage.spec.ts`
- Modify: `staff-account.service.ts` — `uploadAvatar`, `deleteAvatar`, `readAvatar`

**Interfaces:**
- Consumes: `assertStaffAvatarUpload`; `PTT_STAFF_AVATAR_STORAGE_ROOT` default `path.resolve(process.cwd(), 'data/staff-avatars')`
- Produces:
```ts
class StaffAvatarStorage {
  rootDir: string
  save(userId: string, buffer: Buffer, ext: 'jpg' | 'png' | 'webp'): { storageKey: string }
  read(storageKey: string): Buffer | null
  remove(storageKey: string): void
  resolvePath(storageKey: string): string // throws invalid_storage_key if escape
}
```

`storageKey` = `${userId}/${uuid}.${ext}`. `resolvePath` must `filePath.startsWith(rootDir)` (copy HR wallet).

`uploadAvatar`: stub → 400 `avatar_not_available`; rate 10/15m; assert image; save; UPDATE avatar cols; remove old key; audit `avatar_updated`; return `{ ok: true, has_avatar: true, avatar_updated_at }`.

`deleteAvatar`: no key → `{ ok: true, has_avatar: false, already_removed: true }`; else remove + null cols + `avatar_removed`.

`readAvatar`: no key / missing file → null (controller 404 `avatar_not_found`).

- [ ] **Step 1: Storage spec dùng `os.tmpdir()`**

```ts
it('rejects path escape', () => {
  const s = new StaffAvatarStorage(tmp);
  expect(() => s.resolvePath('../etc/passwd')).toThrow('invalid_storage_key');
});
it('round-trips bytes', () => {
  const s = new StaffAvatarStorage(tmp);
  const { storageKey } = s.save('11111111-1111-4111-8111-111111111111', Buffer.from('abc'), 'png');
  expect(s.read(storageKey)?.equals(Buffer.from('abc'))).toBe(true);
  s.remove(storageKey);
  expect(s.read(storageKey)).toBeNull();
});
```

- [ ] **Step 2: FAIL then implement**

```bash
cd services/ptt-crm-api && npx jest src/staff-auth/staff-avatar.storage.spec.ts --no-coverage
```

- [ ] **Step 3: Wire service methods + tests reject SVG via `assertStaffAvatarUpload`**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** `feat(staff-auth): store private staff avatars on disk`

---

### Task 8: HTTP routes `/api/v1/staff/auth/account/*`

**Files:**
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.controller.ts`
- Modify: `services/ptt-crm-api/src/staff-auth/staff-auth.module.ts`
- Create: `services/ptt-crm-api/test/staff-account.e2e-spec.ts` (optional nếu PG; bắt buộc unit controller không cần)

**Interfaces:**
- All `@UseGuards(StaffJwtGuard)` except existing public login/sso.
- Routes đúng spec §6.2–§6.7. Field multipart `file`, `memoryStorage`, `limits.fileSize: 1_000_000`.

```ts
@Get('account')
bundle(@StaffUser() user: StaffJwtPayload) {
  return this.account.getBundle(user);
}

@Post('account/password')
changePassword(@StaffUser() user: StaffJwtPayload, @Body() body: { current_password?: string; new_password?: string }) {
  return this.account.changePassword(user, body.current_password ?? '', body.new_password ?? '');
}

@Get('account/sessions')
sessions(@StaffUser() user: StaffJwtPayload) { return this.account.listSessions(user); }

@Post('account/sessions/revoke-others')
revokeOthers(@StaffUser() user: StaffJwtPayload) { return this.account.revokeOthers(user); }

@Post('account/sessions/revoke-all')
revokeAll(@StaffUser() user: StaffJwtPayload) { return this.account.revokeAll(user); }

@Post('account/sessions/:id/revoke')
revokeOne(@StaffUser() user: StaffJwtPayload, @Param('id') id: string) {
  return this.account.revokeOne(user, id);
}

@Get('account/audit')
audit(@StaffUser() user: StaffJwtPayload, @Query('limit') limit?: string) {
  return this.account.listAudit(user, Number(limit) || 20);
}

@Post('account/avatar')
@UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 1_000_000 } }))
uploadAvatar(@StaffUser() user: StaffJwtPayload, @UploadedFile() file?: Express.Multer.File) {
  return this.account.uploadAvatar(user, file);
}

@Delete('account/avatar')
deleteAvatar(@StaffUser() user: StaffJwtPayload) { return this.account.deleteAvatar(user); }

@Get('account/avatar')
async getAvatar(@StaffUser() user: StaffJwtPayload, @Res() res: Response) {
  const out = await this.account.readAvatar(user);
  if (!out) throw new NotFoundException({ error: 'avatar_not_found' });
  res.setHeader('Content-Type', out.contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(out.buffer);
}
```

`getBundle`: `{ profile, sessions: { current_sid, items }, audit: { items } }`.

`revokeOne`: 404 `session_not_found`; idempotent already; `current_revoked: id === user.sid`.

`revokeOthers`: no sid → 400 `session_binding_required`.

`revokeAll`: revoke rows `user_revoke_all`; `UPDATE staff_users SET auth_token_version = auth_token_version + 1`; audit `sessions_revoked_all` + `token_revoked`.

`listAudit`: `SELECT id, event_type, created_at FROM staff_auth_audit WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2` (limit clamp 1..50). Map `summary_vi`. **Không** select `detail_json`.

Register providers: `StaffAccountService`, `StaffSessionsRepository`, `StaffAvatarStorage`.

- [ ] **Step 1: Add `staff-account.service.spec.ts` cases** revoke-others without sid; audit mapper không leak detail.

- [ ] **Step 2: Run** `npx jest src/staff-auth --no-coverage` + e2e `staff-auth`

- [ ] **Step 3: Implement controller + leftover service methods**

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** `feat(staff-auth): expose staff account session password and avatar APIs`

---

### Task 9: Ops-web API client + VI errors + crop box

**Files:**
- Create: `services/ops-web/src/lib/account/account-error.util.ts`
- Create: `services/ops-web/src/lib/account/account-error.util.spec.ts`
- Create: `services/ops-web/src/lib/account/crop-avatar.util.ts`
- Create: `services/ops-web/src/lib/account/crop-avatar.util.spec.ts`
- Modify: `services/ops-web/src/lib/auth.ts` — `StoredStaffUser` thêm `has_avatar?: boolean; avatar_updated_at?: string | null`
- Modify: `services/ops-web/src/lib/api.ts` — functions dưới đây

**Interfaces:**

```ts
staffAccountErrorVi(error: string): string
centerSquareCropBox(width: number, height: number): { sx: number; sy: number; size: number }
cropAvatarFileToJpeg(file: File): Promise<Blob> // uses canvas; thin, untested in node

fetchStaffAccount(token: string): Promise<StaffAccountBundle>
staffChangePassword(token, current, next): Promise<{ ok: boolean }>
fetchStaffSessions(token)
revokeStaffSession(token, id)
revokeStaffSessionsOthers(token)
revokeStaffSessionsAll(token)
fetchStaffAccountAudit(token)
uploadStaffAvatar(token, blob: Blob): Promise<{ ok: boolean; has_avatar: boolean; avatar_updated_at: string }>
deleteStaffAvatar(token)
fetchStaffAvatarBlob(token): Promise<Blob | null> // 404 → null
```

`staffAccountErrorVi` map **đúng** spec §10 (mọi key). Unknown → `Không thực hiện được. Thử lại.`

`centerSquareCropBox(800, 400)` → `{ sx: 200, sy: 0, size: 400 }`.

`uploadStaffAvatar`: `FormData` field `file`. `fetchStaffAvatarBlob`: `Authorization` header, `res.blob()`.

- [ ] **Step 1: Vitest FAIL**

```ts
import { staffAccountErrorVi } from './account-error.util';
import { centerSquareCropBox } from './crop-avatar.util';

it('maps invalid_current_password', () => {
  expect(staffAccountErrorVi('invalid_current_password')).toBe('Mật khẩu hiện tại không đúng.');
});
it('center crop landscape', () => {
  expect(centerSquareCropBox(800, 400)).toEqual({ sx: 200, sy: 0, size: 400 });
});
```

```bash
cd services/ops-web && npx vitest run src/lib/account/account-error.util.spec.ts src/lib/account/crop-avatar.util.spec.ts
```

- [ ] **Step 2: Implement + api.ts helpers (reuse `ApiError` / `authHeaders`)**

- [ ] **Step 3: Vitest PASS**

- [ ] **Step 4: Commit** `feat(ops-web): add staff account API client and avatar crop helper`

---

### Task 10: Page `/account` (5 khối)

**Files:**
- Create: `services/ops-web/src/app/account/page.tsx`
- Create: `services/ops-web/src/components/account/AccountProfileCard.tsx`
- Create: `services/ops-web/src/components/account/AccountPasswordCard.tsx`
- Create: `services/ops-web/src/components/account/AccountMfaCard.tsx`
- Create: `services/ops-web/src/components/account/AccountSessionsCard.tsx`
- Create: `services/ops-web/src/components/account/AccountAuditCard.tsx`
- Create: `services/ops-web/src/lib/account/password-form.util.ts`
- Create: `services/ops-web/src/lib/account/password-form.util.spec.ts`

**Interfaces:**
- Page: `StaffPageShell` + breadcrumb `[{ label: 'Tài khoản' }]`; auth giống `/crm/payroll/me` (`staffMe` / refresh / logout).
- `validatePasswordForm({ current, next, confirm })`: `{ ok: true } | { ok: false; error: string }` — confirm mismatch → `Mật khẩu xác nhận không khớp.`; next < 8 → `Mật khẩu mới tối thiểu 8 ký tự.` **Không gọi API** nếu fail.

UI A: **không** dialog. Năm khối stacked.

Password card:
- `password_login_enabled` → 3 inputs + submit.
- `sso_enabled` && `keycloak_account_url` → `<a target="_blank" rel="noreferrer">Đổi mật khẩu trên Keycloak</a>`.
- cả hai → thêm câu spec dual.
- chỉ SSO → không form Nest.

MFA: “Chức vụ này bắt buộc OTP: Có/Không” từ `mfa_required_for_position`; link cùng `keycloak_account_url` “Quản lý OTP trên Keycloak”.

Sessions: table + Thu hồi; confirm `window.confirm('Hành động này đá phiên khác. Tiếp tục?')` cho others/all. `current_revoked` hoặc revoke-all → `clearSession` + `/login`.

Avatar: 96px circle; hidden file `accept="image/jpeg,image/png,image/webp"`; crop then upload; Xóa nếu `has_avatar`.

- [ ] **Step 1: Vitest password form**

```ts
import { validatePasswordForm } from './password-form.util';
expect(validatePasswordForm({ current: 'a', next: 'newpass12', confirm: 'other' }).ok).toBe(false);
expect(validatePasswordForm({ current: 'a', next: 'short', confirm: 'short' }).ok).toBe(false);
expect(validatePasswordForm({ current: 'a', next: 'newpass12', confirm: 'newpass12' }).ok).toBe(true);
```

- [ ] **Step 2: Implement page + cards. Reuse existing `card` / `field` / `btn` / `error` classes (portal settings / login). Không invent design system.**

- [ ] **Step 3: `npx vitest run src/lib/account`**

- [ ] **Step 4: Commit** `feat(ops-web): add /account self-service page`

---

### Task 11: Topbar UI A (menu avatar, bỏ nút Đăng xuất riêng)

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx`
- Create: `services/ops-web/src/components/account/StaffAvatarMenu.tsx`
- Create: `services/ops-web/src/components/account/useStaffAvatarBlob.ts` (optional hook)
- Modify: `PAGE_TITLES` thêm `'/account': 'Tài khoản'`

**Interfaces:**
- Click **avatar hoặc tên** → menu:
  - `Link href="/account"` “Tài khoản”
  - button “Đăng xuất” → `onLogout`
- Xóa `<button className="btn-topbar-logout">Đăng xuất</button>`.
- Escape / click outside đóng menu.
- `has_avatar`: `fetchStaffAvatarBlob(getAccessToken())` → object URL; revoke khi unmount hoặc `avatar_updated_at` đổi; fallback `userInitials`.
- Không fetch khi `!user` / `!token`.

- [ ] **Step 1: Implement menu. `aria-haspopup="menu"` + `aria-expanded`.**

- [ ] **Step 2: Visual check local** — `/account` title “Tài khoản”; sidebar CRM không thêm item.

- [ ] **Step 3: Commit** `feat(ops-web): open account menu from topbar avatar`

---

### Task 12: Spec pointer + VPS apply notes (no prod deploy unless asked)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-01-staff-account-self-service-design.md` — status **Plan ready**, link plan này, §14 UI = **A**
- Modify: `docs/superpowers/plans/2026-09-01-staff-account-self-service.md` — tick không (executor ticks)

VPS (khi user yêu cầu deploy, **không** làm trong task này trừ khi được hỏi):

```bash
# 1) DDL
ssh deploy@rs.pttads.vn 'cd /var/www/rnosai && bash scripts/apply_pg_ddl_staff_sessions.sh'
# 2) mkdir avatars (user service)
ssh deploy@rs.pttads.vn 'sudo mkdir -p /var/www/rnosai/services/ptt-crm-api/data/staff-avatars && sudo chown deploy:deploy /var/www/rnosai/services/ptt-crm-api/data/staff-avatars'
# 3) deploy api then ops-web + restart
```

- [ ] **Step 1: Update spec header** `Plan ready` + link `../plans/2026-09-01-staff-account-self-service.md`. §14 row: `UI entry | A — menu avatar → /account, không dialog`.

- [ ] **Step 2: Commit** `docs(staff-account): point spec at implementation plan`

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| G1 `/account` + menu A | 10, 11 |
| G2 password Nest/SSO/dual | 6, 8, 10 |
| G3 MFA link | 6, 10 |
| G4–G5 sessions + revoke-all tv++ | 3–5, 8, 10 |
| G6 audit own only | 1, 8, 10 |
| G7 offboard tv | 5 (không đụng offboard HR) |
| G8 avatar | 1, 3, 7, 8, 9, 10, 11 |
| JWT sid + legacy | 2, 5 |
| Rate password/avatar | 1, 6, 7 |
| Copy VI §10 | 1, 9 |
| Deploy DDL first | 3, 12 |
| Không cap / không public / CEO path | 10, 11, constraints |

## Verify locally (trước khi claim xong)

```bash
cd services/ptt-crm-api && npx jest src/staff-auth --no-coverage && npm run test:e2e -- --testPathPattern=staff-auth
cd services/ops-web && npx vitest run src/lib/account src/lib/auth/post-login-path.util.spec.ts
```
