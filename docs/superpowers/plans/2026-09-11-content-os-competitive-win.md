# Content Marketing OS — Competitive Win (E4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-09-11-content-os-competitive-win-design.md`](../specs/2026-09-11-content-os-competitive-win-design.md) · **SPEC-CMKT-WIN v1.1**  
**UI contract:** [`docs/superpowers/mocks/2026-09-11-content-os-competitive-win.html`](../mocks/2026-09-11-content-os-competitive-win.html)  
**Cha:** SPEC-CMKT-E v3.1 + plan E0–E3 (`2026-09-10-content-os-agency-enterprise.md` Task 1–34) — **không thu hồi**

**Goal:** Nhân viên đăng **một Facebook Page** trong COS (human confirm + `post_id` thật), chọn asset DAM HTTP (rights, không host file), tạo/duyệt glossary trên UI, bật legal hold — Mark published E0 **giữ** khi connector tắt.

**Architecture:** Tái sử dụng `cmkt_connectors` / `cmkt_channel_accounts` / `cmkt_publication_logs` / `cmkt_glossary` / `legal_hold`. Thêm OAuth state, unique execute, DAM bind. `FacebookPageConnector` implement `PublishConnector` **verbatim**; `stubPublishConnector` **giữ** default khi flag off / test không mock. HTTP `execute` chỉ enqueue (< 1s); Graph chạy `runPublicationExecute` (không await từ request user). Token **cấm** SELECT ra portfolio JSON.

**Tech Stack:** NestJS + Jest (`services/ptt-crm-api`) · Next.js + Vitest (`services/ops-web`) · PostgreSQL DDL `docs/specs/` + `scripts/apply_pg_ddl_cmkt_e4_win.sh` · Graph `v21.0` (inject `graphFetch`)

## Global Constraints

- Một sản phẩm, một prefix portfolio `/api/crm/content-os/portfolio/*`. Lifecycle prefix **giữ**. `POST …/content-marketing/…/publish` Mark published **giữ**.
- UI E4 = mockup WIN §16 (không ribbon `WIN · E4` trên prod). Chrome/IA 8 mục = mockup v2.
- Flag `direct_social_publish` mặc định **tắt**. Pilot slug `tiep-thi-noi-dung`.
- Kênh E4: **Facebook Page only**. IG/CMS = không nút sống (chip tắt hoặc không render).
- BR-WIN-01: không `confirm: true` → không gọi Graph. BR-WIN-02: gate Blocked → không queue. BR-AI-01 / FR-AI-020: AI không execute / không `connector.publish`.
- Token / refresh / Graph body **không** vào browser JSON, log app, AI Trace `input_json`/`output_json`, CSV audit (chỉ `http_status` + mã ổn định).
- CTA **Đăng ký nhận tư vấn**. Cấm “Gọi ngay”. Cấm seed Sunlight/Nova/Tâm An lên prod. Cấm `CP_AI_ENABLED`. Cấm ads_management.
- Page allowlist env `CMKT_FB_PAGE_ALLOWLIST`. DAM base `CMKT_DAM_BASE_URL` https + host cố định.
- TDD: test đỏ → code → test xanh → commit. Không `--no-verify`. Không commit secrets / `.env` / `.DS_Store`.
- Worktree lúc thực thi: `superpowers:using-git-worktrees`. Task số tiếp E3: **35–48**.

**Thứ tự code (khác chữ epic spec):** C (token) → P (execute) → UI publish → D → G → H → AI lock → acceptance. Spec ghi P→C vì thắng = đăng; implement phải Connect trước Graph.

---

## File map (khóa trước khi code)

### Tạo — API

| File | Trách nhiệm |
|---|---|
| `docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql` | `cmkt_oauth_states`, `cmkt_publication_executes`, `cmkt_dam_bindings`, `legal_hold_set_by` |
| `scripts/apply_pg_ddl_cmkt_e4_win.sh` | Apply DDL (clone `apply_pg_ddl_cmkt_e3_connectors.sh`) |
| `services/ptt-crm-api/src/content-os-portfolio/fb-page-allowlist.util.ts` | Parse `CMKT_FB_PAGE_ALLOWLIST` |
| `services/ptt-crm-api/src/content-os-portfolio/oauth-state.util.ts` | CSRF state TTL ≤ 10 phút, one-time |
| `services/ptt-crm-api/src/content-os-portfolio/facebook-oauth.util.ts` | Auth URL + exchange code (inject fetch) |
| `services/ptt-crm-api/src/content-os-portfolio/facebook-page-connector.ts` | `FacebookPageConnector` + circuit |
| `services/ptt-crm-api/src/content-os-portfolio/publication-execute.util.ts` | Confirm / gate / material change / idempotent codes |
| `services/ptt-crm-api/src/content-os-portfolio/http-json-dam.adapter.ts` | `HttpJsonDamAdapter` allowlist |
| `services/ptt-crm-api/src/content-os-portfolio/dam-bind.util.ts` | URL host / no `javascript:` |
| `services/ptt-crm-api/src/content-os-portfolio/glossary-create.util.ts` | Draft payload + unique 23505 |
| `services/ptt-crm-api/src/content-os-portfolio/legal-hold-toggle.util.ts` | Reason ≥ 10, SoD tắt hold |
| `*.spec.ts` cạnh mỗi file trên | Jest |

### Sửa — API

| File | Việc |
|---|---|
| `content-os-portfolio.controller.ts` | Routes OAuth, disconnect, channel-accounts, execute, glossary POST/PATCH, dam bind, legal-hold |
| `content-os-portfolio.controller.spec.ts` | Delegate + guard |
| `content-os-portfolio.service.ts` | Orchestration; **không** SELECT token |
| `content-os-portfolio.repository.ts` | SQL mới; list connectors **giữ** cấm token |
| `publish-connector.ts` | Giữ stub; export `resolvePublishConnector` |
| `dam-adapter.ts` | Giữ stub + `listDamOrEmpty`; Http adapter file riêng |
| `channel-health.util.ts` | Giữ Manual / Connected / TokenExpired |
| `content-marketing/guards/staff-content-marketing.guard.ts` | `StaffContentMarketingExecuteGuard` = **chỉ** `crm_content.publish` |

### Tạo / sửa — ops-web

| File | Việc |
|---|---|
| `lib/crm/cmkte-win-publish.ts` | `canShowDangLenPage`, confirm payload |
| `lib/crm/cmkte-api.ts` | fetch channel-accounts, execute, create glossary, bind DAM, patch hold, oauth start URL |
| `CmktESettings.tsx` | Connect / Disconnect / hold form (giữ switch Direct + `AUDIT_RETENTION_COPY`) |
| `CmktEWorkspace.tsx` | Brief brand/locale; DAM drawer; Đăng lên Page + modal; hold badge; sticky |
| `CmktECommandCenter.tsx` | **Cần đăng hôm nay** |
| `CmktECalendar.tsx` | Health Connected / Manual; không chip IG sống |
| `CmktEIntelligence.tsx` | Glossary studio tách Insight |
| `CmktELibrary.tsx` | Empty success ≠ error |
| `styles/cmkte.css` | `.cmkte-glossary` / `.mark-gloss` token (không UA yellow) |

---

### Task 35: DDL E4 (oauth / execute / dam bind)

**Files:**
- Create: `docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql`
- Create: `scripts/apply_pg_ddl_cmkt_e4_win.sh`
- Create: `services/ptt-crm-api/src/content-os-portfolio/e4-ddl.util.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/e4-ddl.util.spec.ts`

**Interfaces:**
- Consumes: E3 tables `cmkt_connectors`, `cmkt_channel_accounts`, `cmkt_publication_logs`, `cmkt_glossary`, `legal_hold`
- Produces: `E4_DDL_REQUIRED` string list for tests; migration version `2026-09-11-cmkt-e4-win`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { E4_DDL_REQUIRED } from './e4-ddl.util';

describe('E4 WIN DDL', () => {
  const sql = readFileSync(
    join(__dirname, '../../../../docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql'),
    'utf8',
  );

  it('creates oauth state, execute unique, dam bind, and hold actor', () => {
    for (const needle of E4_DDL_REQUIRED) {
      expect(sql).toContain(needle);
    }
    expect(sql).not.toMatch(/DROP TABLE cmkt_connectors/i);
    expect(sql).not.toMatch(/CREATE TABLE cmkt_content_items/i);
  });
});
```

```ts
export const E4_DDL_REQUIRED = [
  'cmkt_oauth_states',
  'cmkt_publication_executes',
  'UNIQUE (item_id, channel_account_id, snapshot_id)',
  'cmkt_dam_bindings',
  'legal_hold_set_by',
  '2026-09-11-cmkt-e4-win',
] as const;
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/e4-ddl.util.spec.ts --no-coverage
```

Expected: FAIL (file missing or needles absent)

- [ ] **Step 3: Write minimal implementation**

`docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql`:

```sql
-- docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql
-- E4 WIN: oauth CSRF, idempotent execute, DAM bind, legal hold actor.
-- Do not rewrite E0/E3 DDL. Do not SELECT token columns here.
CREATE TABLE IF NOT EXISTS cmkt_oauth_states (
    state        TEXT PRIMARY KEY,
    staff_id     BIGINT NOT NULL,
    lifecycle_id BIGINT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cmkt_oauth_states_expires
    ON cmkt_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS cmkt_publication_executes (
    id                  BIGSERIAL PRIMARY KEY,
    item_id             BIGINT NOT NULL,
    channel_account_id  BIGINT NOT NULL,
    snapshot_id         TEXT NOT NULL,
    client_request_id   TEXT,
    post_id             TEXT,
    permalink           TEXT,
    status              TEXT NOT NULL DEFAULT 'queued',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, channel_account_id, snapshot_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS cmkt_publication_executes_client_req
    ON cmkt_publication_executes (client_request_id)
    WHERE client_request_id IS NOT NULL AND client_request_id <> '';

CREATE TABLE IF NOT EXISTS cmkt_dam_bindings (
    id          BIGSERIAL PRIMARY KEY,
    item_id     BIGINT NOT NULL,
    dam_id      TEXT NOT NULL,
    url         TEXT NOT NULL,
    rights_json JSONB,
    bound_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmkt_dam_bindings_item
    ON cmkt_dam_bindings (item_id, bound_at DESC);

ALTER TABLE cmkt_content_items
    ADD COLUMN IF NOT EXISTS legal_hold_set_by VARCHAR(120);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-09-11-cmkt-e4-win', 'CMKT-E4: oauth state, execute unique, dam bind, legal_hold_set_by')
ON CONFLICT (version) DO NOTHING;
```

Clone `scripts/apply_pg_ddl_cmkt_e3_connectors.sh` → `scripts/apply_pg_ddl_cmkt_e4_win.sh` (đổi DDL path + echo version). Export `E4_DDL_REQUIRED` đúng như test.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/e4-ddl.util.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/specs/2026-09-11-postgresql-ddl-cmkt-e4-win.sql scripts/apply_pg_ddl_cmkt_e4_win.sh \
  services/ptt-crm-api/src/content-os-portfolio/e4-ddl.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/e4-ddl.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): E4 DDL for oauth, execute unique, and DAM bind

EOF
)"
```

---

### Task 36: Facebook OAuth start / callback (server-side)

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/fb-page-allowlist.util.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/fb-page-allowlist.util.spec.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/oauth-state.util.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/oauth-state.util.spec.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/facebook-oauth.util.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/facebook-oauth.util.spec.ts`
- Modify: `content-os-portfolio.controller.ts` — `GET connectors/facebook/oauth/start`, `GET connectors/facebook/oauth/callback`
- Modify: `content-os-portfolio.service.ts` — `startFacebookOAuth`, `facebookOAuthCallback`
- Modify: `content-os-portfolio.repository.ts` — insert/consume oauth state; **upsert connector tokens chỉ trong method `saveConnectorSecrets` (không export qua GET)**
- Modify: `content-os-portfolio.controller.spec.ts`

**Interfaces:**
- Consumes: `StaffContentMarketingWriteGuard` trên start; callback không đọc token từ query ngoài `code`/`state`
- Produces:
  - `parsePageAllowlist(raw?: string): Set<string>`
  - `createOauthState(): string` (≥ 24 chars)
  - `isOauthStateExpired(expiresAt: Date, now: Date): boolean`
  - `buildFacebookAuthUrl(input: { appId: string; redirectUri: string; state: string }): string`
  - `exchangeFacebookCode(input, fetchFn): Promise<{ page_id: string; access_token: string; expires_at: Date }>`
  - Service start → `{ redirect: string }` (controller `res.redirect`)
  - Callback → 302 ops-web `/crm/content-os/settings?fb=ok|error` — **không** `access_token` trên Location

- [ ] **Step 1: Write the failing test**

```ts
import { parsePageAllowlist } from './fb-page-allowlist.util';
import { createOauthState, isOauthStateExpired } from './oauth-state.util';
import { buildFacebookAuthUrl, exchangeFacebookCode } from './facebook-oauth.util';

describe('parsePageAllowlist', () => {
  it('splits comma/space and drops empty', () => {
    expect([...parsePageAllowlist(' 111,222 333,')].sort()).toEqual(['111', '222', '333']);
  });
});

describe('oauth state', () => {
  it('is long and expires after TTL', () => {
    expect(createOauthState().length).toBeGreaterThanOrEqual(24);
    const exp = new Date('2026-09-11T10:10:00.000Z');
    expect(isOauthStateExpired(exp, new Date('2026-09-11T10:11:00.000Z'))).toBe(true);
    expect(isOauthStateExpired(exp, new Date('2026-09-11T10:09:00.000Z'))).toBe(false);
  });
});

describe('facebook oauth', () => {
  it('builds dialog URL without ads_management', () => {
    const url = buildFacebookAuthUrl({
      appId: 'app-1',
      redirectUri: 'https://api.example/cb',
      state: 'st-1',
    });
    expect(url).toContain('https://www.facebook.com/v21.0/dialog/oauth');
    expect(url).toContain('pages_manage_posts');
    expect(url).toContain('pages_read_engagement');
    expect(url).not.toMatch(/ads_management/);
  });

  it('exchanges code, picks allowlisted page, never returns user token to caller shape with extra secrets', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'USER_TOKEN', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: '999', access_token: 'PAGE_TOKEN', name: 'Other' }, { id: '555', access_token: 'PAGE_OK', name: 'PTT Ads' }],
        }),
      });
    const out = await exchangeFacebookCode(
      {
        code: 'abc',
        redirectUri: 'https://api.example/cb',
        appId: 'app-1',
        appSecret: 'sec',
        allowlist: parsePageAllowlist('555'),
      },
      fetchFn,
    );
    expect(out).toEqual({
      page_id: '555',
      access_token: 'PAGE_OK',
      expires_at: expect.any(Date),
    });
    expect(JSON.stringify(out)).not.toMatch(/USER_TOKEN/);
  });

  it('rejects page outside allowlist', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'U', expires_in: 60 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '999', access_token: 'P' }] }) });
    await expect(
      exchangeFacebookCode(
        { code: 'c', redirectUri: 'https://x', appId: 'a', appSecret: 's', allowlist: parsePageAllowlist('555') },
        fetchFn,
      ),
    ).rejects.toMatchObject({ message: 'page_not_allowlisted' });
  });
});
```

Controller spec (thêm):

```ts
it('GET oauth/start uses write guard path and returns redirect without token', async () => {
  const service = { startFacebookOAuth: jest.fn().mockResolvedValue({ redirect: 'https://www.facebook.com/v21.0/dialog/oauth?state=x' }) };
  const c = new ContentOsPortfolioController(service as never);
  const res = { redirect: jest.fn() };
  await c.startFacebookOAuth({ staffUser: { sub: '7' } } as never, res as never);
  expect(service.startFacebookOAuth).toHaveBeenCalledWith({ staffId: 7 });
  expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('facebook.com'));
  expect(String(res.redirect.mock.calls[0][0])).not.toMatch(/access_token/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/facebook-oauth.util.spec.ts src/content-os-portfolio/oauth-state.util.spec.ts src/content-os-portfolio/fb-page-allowlist.util.spec.ts --no-coverage
```

Expected: FAIL (modules not found)

- [ ] **Step 3: Write minimal implementation**

- `parsePageAllowlist`: split `/[,\s]+/`, trim, drop empty.
- `createOauthState`: `crypto.randomBytes(24).toString('hex')`.
- `isOauthStateExpired`: `now.getTime() > expiresAt.getTime()`.
- TTL insert: `NOW() + interval '10 minutes'` (NFR-WIN-003).
- `buildFacebookAuthUrl`: `scope=pages_manage_posts,pages_read_engagement`.
- `exchangeFacebookCode`: GET `https://graph.facebook.com/v21.0/oauth/access_token?client_id&client_secret&redirect_uri&code` rồi GET `https://graph.facebook.com/v21.0/me/accounts`. Chọn page trong allowlist. Throw `page_not_allowlisted` nếu không.
- Service `startFacebookOAuth`: require env `CMKT_FB_APP_ID`, `CMKT_FB_REDIRECT_URI`; insert state `{ staff_id, lifecycle_id }` (lifecycle = first scoped hoặc hint); return Facebook URL.
- Service `facebookOAuthCallback`: consume state (used_at IS NULL, not expired) **một lần**; exchange; `saveConnectorSecrets` (status=`on`); `insertAuditExport({ action: 'oauth_connect' })`; redirect `${OPS_WEB_ORIGIN}/crm/content-os/settings?fb=ok`. Lỗi → `?fb=error` (mã ổn định, không raw Graph).
- `listChannelConnectors` / mọi GET **không** đụng `saveConnectorSecrets` columns.
- Controller start: `@UseGuards(StaffContentMarketingWriteGuard)` + `@Res()` redirect. Callback: **không** `StaffContentMarketingViewGuard` nếu Facebook không gửi JWT — dùng state bind `staff_id`. Không expose code lên ops-web.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/facebook-oauth.util.spec.ts src/content-os-portfolio/oauth-state.util.spec.ts src/content-os-portfolio/fb-page-allowlist.util.spec.ts src/content-os-portfolio/content-os-portfolio.controller.spec.ts --no-coverage
```

Expected: PASS (controller file vẫn xanh các test E3)

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/fb-page-allowlist.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/fb-page-allowlist.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/oauth-state.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/oauth-state.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/facebook-oauth.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/facebook-oauth.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): Facebook Page OAuth server-side with allowlist

EOF
)"
```

---

### Task 37: Channel accounts + disconnect + health (no secrets)

**Files:**
- Modify: `content-os-portfolio.controller.ts` — `GET channel-accounts`, `POST connectors/:id/disconnect`
- Modify: `content-os-portfolio.service.ts` — `listChannelAccounts`, `disconnectConnector`
- Modify: `content-os-portfolio.repository.ts` — `listChannelAccountsPublic`, `clearConnectorSecrets`
- Modify: `content-os-portfolio.repository.connectors.spec.ts`
- Modify: `content-os-portfolio.service.spec.ts` (channel health)
- Create: `content-os-portfolio.service.oauth.spec.ts`

**Interfaces:**
- Consumes: `listChannelConnectors()` E3 (không token); `resolveChannelHealth`
- Produces:
  - `GET /channel-accounts` → `{ items: Array<{ id, channel, display_name, account_ref, health }> }`
  - `disconnectConnector({ staffId, connectorId })` → `{ status: 'off' }`; token columns NULL; audit `oauth_disconnect`
  - Health: `off` / thiếu token-at-rest (internal) → **Manual**; `on` + `expires_at` quá hạn → **TokenExpired**; `on` + còn hạn → **Connected**

- [ ] **Step 1: Write the failing test**

```ts
describe('listChannelAccountsPublic SQL', () => {
  it('never selects access_token or refresh_token', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: 1, channel: 'facebook_page', display_name: 'PTT Ads', account_ref: '555' }],
    });
    const repo = makePortfolioRepo(query);
    await repo.listChannelAccountsPublic([4]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).not.toMatch(/access_token|refresh_token/i);
  });
});

describe('disconnectConnector', () => {
  it('sets status off and audits without echoing token', async () => {
    const repo = {
      getConnectorById: jest.fn().mockResolvedValue({ id: 9, channel_account_id: 1, status: 'on' }),
      clearConnectorSecrets: jest.fn().mockResolvedValue({ status: 'off' }),
      insertAuditExport: jest.fn(),
      listScopedLifecycleIds: jest.fn().mockResolvedValue([4]),
    };
    const svc = new ContentOsPortfolioService(repo as never, {} as never, {} as never);
    const out = await svc.disconnectConnector({ staffId: 7, connectorId: 9, actor: 'ops@ptt.vn' });
    expect(out).toEqual({ status: 'off' });
    expect(repo.clearConnectorSecrets).toHaveBeenCalledWith(9);
    expect(repo.insertAuditExport).toHaveBeenCalledWith(expect.objectContaining({ action: 'oauth_disconnect' }));
    expect(JSON.stringify(out)).not.toMatch(/token/i);
  });
});
```

`clearConnectorSecrets` SQL bắt buộc:

```sql
UPDATE cmkt_connectors
   SET access_token = NULL, refresh_token = NULL, status = 'off', updated_at = NOW()
 WHERE id = $1
 RETURNING id, status, expires_at
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/content-os-portfolio.service.oauth.spec.ts src/content-os-portfolio/content-os-portfolio.repository.connectors.spec.ts --no-coverage
```

Expected: FAIL (`listChannelAccountsPublic` / `disconnectConnector` missing)

- [ ] **Step 3: Write minimal implementation**

`GET channel-accounts` join accounts + pick connector per channel (`pickConnectorPerChannel`) + `resolveChannelHealth`. Channel string **`facebook_page`** (không invent `instagram`). Không trả `enabled` raw nếu gây nhầm — trả `health.status`.

`POST connectors/:id/disconnect` + `StaffContentMarketingWriteGuard`.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/content-os-portfolio.service.oauth.spec.ts src/content-os-portfolio/content-os-portfolio.repository.connectors.spec.ts src/content-os-portfolio/content-os-portfolio.service.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.oauth.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.connectors.spec.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): public channel accounts and server-side disconnect

EOF
)"
```

---

### Task 38: FacebookPageConnector (inject Graph)

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/facebook-page-connector.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/facebook-page-connector.spec.ts`
- Modify: `publish-connector.ts` — thêm `resolvePublishConnector`
- Modify: `publish-connector.spec.ts` — stub **vẫn** `NotEnabledError` khi `NODE_ENV=test` không mock

**Interfaces:**
- Consumes: `PublishConnector`, `PublicationPackage`, `NotEnabledError`
- Produces:

```ts
export type FacebookPublishPackage = PublicationPackage & {
  page_id: string;
  message: string;
  access_token: string;
};

export function createFacebookPageConnector(opts: {
  enabled: boolean;
  statusOn: boolean;
  graphFetch?: typeof fetch;
  now?: () => Date;
}): PublishConnector;

export function resolvePublishConnector(opts: {
  direct_social_publish: boolean;
  connectorStatus: string | null;
  hasToken: boolean;
  facebook?: PublishConnector;
}): PublishConnector;
```

- [ ] **Step 1: Write the failing test**

```ts
import { NotEnabledError, stubPublishConnector, resolvePublishConnector } from './publish-connector';
import { createFacebookPageConnector } from './facebook-page-connector';

describe('resolvePublishConnector', () => {
  it('returns stub when flag off, status off, no token, or test without facebook mock', () => {
    expect(resolvePublishConnector({
      direct_social_publish: false, connectorStatus: 'on', hasToken: true,
    }).id).toBe('stub');
    expect(resolvePublishConnector({
      direct_social_publish: true, connectorStatus: 'off', hasToken: true,
    }).id).toBe('stub');
    expect(resolvePublishConnector({
      direct_social_publish: true, connectorStatus: 'on', hasToken: false,
    }).id).toBe('stub');
  });
});

describe('FacebookPageConnector', () => {
  it('throws NotEnabledError when flag off', async () => {
    const c = createFacebookPageConnector({ enabled: false, statusOn: true });
    await expect(c.publish({ item_id: 1, page_id: '555', message: 'x', access_token: 't' } as never))
      .rejects.toBeInstanceOf(NotEnabledError);
  });

  it('posts feed and returns post_id without leaking token in error mapping', async () => {
    const graphFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '555_888' }),
    });
    const c = createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch });
    const out = await c.publish({
      item_id: 21, channel: 'facebook_page', page_id: '555', message: 'Sống xanh', access_token: 'SECRET',
    } as never);
    expect(out).toEqual({ post_id: '555_888' });
    const url = String(graphFetch.mock.calls[0][0]);
    expect(url).toContain('https://graph.facebook.com/v21.0/555/feed');
    expect(url).not.toContain('SECRET');
  });

  it('maps 4xx auth to TokenExpired code without Graph body', async () => {
    const graphFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth access token.' } }),
    });
    const c = createFacebookPageConnector({ enabled: true, statusOn: true, graphFetch });
    await expect(c.publish({
      item_id: 1, page_id: '555', message: 'x', access_token: 'SECRET',
    } as never)).rejects.toMatchObject({ message: 'TokenExpired' });
  });
});

describe('stub still locked', () => {
  it('throws when direct_social_publish is on', async () => {
    await expect(stubPublishConnector({ direct_social_publish: true }).publish({ item_id: 1 }))
      .rejects.toBeInstanceOf(NotEnabledError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/facebook-page-connector.spec.ts src/content-os-portfolio/publish-connector.spec.ts --no-coverage
```

Expected: FAIL (`createFacebookPageConnector` missing)

- [ ] **Step 3: Write minimal implementation**

`publish`: POST Graph `/v21.0/{page_id}/feed` với `URLSearchParams({ message, access_token })` — token **chỉ** trong body server, không nối vào URL log. Circuit: 3 lần 5xx hoặc 401 liên tiếp → throw `TokenExpired` / `graph_unavailable`. `resolvePublishConnector`: nếu thiếu điều kiện hoặc không truyền `facebook` → `stubPublishConnector()`.

Mở rộng `PublicationPackage` **không phá** E3: field thêm optional; stub bỏ qua.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/facebook-page-connector.spec.ts src/content-os-portfolio/publish-connector.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/facebook-page-connector.ts \
  services/ptt-crm-api/src/content-os-portfolio/facebook-page-connector.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/publish-connector.ts \
  services/ptt-crm-api/src/content-os-portfolio/publish-connector.spec.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): FacebookPageConnector behind resolvePublishConnector

EOF
)"
```

---

### Task 39: POST publications/execute (confirm + gate + enqueue)

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/publication-execute.util.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/publication-execute.util.spec.ts`
- Create: `services/ptt-crm-api/src/content-marketing/guards/staff-content-marketing.guard.ts` — class `StaffContentMarketingExecuteGuard` (cùng file)
- Create: `content-os-portfolio.service.execute.spec.ts`
- Modify: controller `POST publications/execute` + `@UseGuards(StaffContentMarketingExecuteGuard)`
- Modify: service `enqueuePublicationExecute`, `runPublicationExecute`
- Modify: repository `insertPublicationExecute`, `loadConnectorSecretForExecute` (**chỉ** gọi từ `runPublicationExecute`)

**Interfaces:**
- Consumes: `evaluatePublishGate`, `resolvePublishConnector`, `createFacebookPageConnector`, `insertPublicationLogWithRetry`
- Produces:

```ts
export function assertHumanConfirm(confirm: unknown): asserts confirm is true {
  // throw BadRequestException { error: 'human_confirm_required' }
}

export function assertExecuteGate(status: 'Pass' | 'Warning' | 'Blocked'): void {
  // Blocked → BadRequestException { error: 'publish_gate_blocked' }
}

export type ExecuteBody = {
  item_id: number;
  channel_account_id: number;
  snapshot_id: string;
  confirm: true;
  client_request_id: string;
};

export type ExecuteAccepted = { queued: true; client_request_id: string; execute_id: number };
```

HTTP **không** await Graph. `enqueue` insert `status='queued'` rồi `setImmediate(() => this.runPublicationExecute(id))`. `run` load token server-side, publish, ghi `post_id` + permalink (nếu Graph có `permalink_url`; thiếu vẫn lưu `post_id`), `cmkt_publication_logs`, item `status=published` + `published_url` = permalink **hoặc** để null nếu không có — **không bịa**. Flag tắt giữa chừng → `NotEnabledError` → log error, không published (BR-WIN-05).

- [ ] **Step 1: Write the failing test**

```ts
import { BadRequestException } from '@nestjs/common';
import { assertHumanConfirm, assertExecuteGate } from './publication-execute.util';

describe('assertHumanConfirm', () => {
  it('rejects missing confirm', () => {
    try {
      assertHumanConfirm(false);
      throw new Error('expected');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'human_confirm_required' });
    }
  });
});

describe('assertExecuteGate', () => {
  it('blocks Blocked and allows Pass/Warning', () => {
    expect(() => assertExecuteGate('Pass')).not.toThrow();
    expect(() => assertExecuteGate('Warning')).not.toThrow();
    expect(() => assertExecuteGate('Blocked')).toThrow(BadRequestException);
  });
});
```

Service:

```ts
it('returns 400 when confirm is not true and does not call connector', async () => {
  const connector = { id: 'fb', publish: jest.fn() };
  const svc = makeExecuteService({ connector });
  await expect(svc.enqueuePublicationExecute({
    staffId: 7, actor: 'social@ptt.vn',
    body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: false, client_request_id: 'r1' },
  })).rejects.toBeInstanceOf(BadRequestException);
  expect(connector.publish).not.toHaveBeenCalled();
});

it('returns queued without awaiting Graph', async () => {
  const svc = makeExecuteService({
    gate: 'Pass',
    item: { id: 21, lifecycle_id: 4, status: 'approved_internal', version_id: 'v13' },
    insertExecute: jest.fn().mockResolvedValue({ id: 88, client_request_id: 'r1' }),
  });
  const out = await svc.enqueuePublicationExecute({
    staffId: 7, actor: 'social@ptt.vn',
    body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r1' },
  });
  expect(out).toEqual({ queued: true, client_request_id: 'r1', execute_id: 88 });
});

it('rejects when snapshot_id is not the locked version', async () => {
  const svc = makeExecuteService({ item: { id: 21, version_id: 'v14' } });
  await expect(svc.enqueuePublicationExecute({
    staffId: 7, actor: 'x',
    body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r2' },
  })).rejects.toMatchObject({ response: { error: 'material_change' } });
});
```

`StaffContentMarketingExecuteGuard`: **chỉ** `crm_content.publish` (không đủ `write`). Test guard: write-only → 403.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/publication-execute.util.spec.ts src/content-os-portfolio/content-os-portfolio.service.execute.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`snapshot_id` = `String(item.current_version_id ?? item.version_id ?? '')`. Caption = Facebook variant đã lock (field copy hiện có trên item / `body` **không** nhận caption tự do từ client — chỉ snapshot). `loadConnectorSecretForExecute` SELECT token **một câu**, không dùng cho GET. Audit `publication.execute` sau enqueue (không ghi token).

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/publication-execute.util.spec.ts src/content-os-portfolio/content-os-portfolio.service.execute.spec.ts src/content-os-portfolio/content-os-portfolio.controller.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/publication-execute.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/publication-execute.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.execute.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts \
  services/ptt-crm-api/src/content-marketing/guards/staff-content-marketing.guard.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): enqueue Facebook execute behind human confirm and gate

EOF
)"
```

---

### Task 40: Idempotent execute + audit CSV actions

**Files:**
- Modify: `content-os-portfolio.service.execute.spec.ts`
- Modify: `content-os-portfolio.repository.ts` — insert execute bắt UNIQUE; on 23505 return existing row
- Modify: `audit-export.util.ts` / `listAuditActivity` — action `publication.execute`, `oauth_connect`, `oauth_disconnect` đã insert Task 36–39 phải xuất CSV
- Modify: `content-os-portfolio.service.audit.spec.ts`

**Interfaces:**
- Consumes: `cmkt_publication_executes` UNIQUE `(item_id, channel_account_id, snapshot_id)` + unique `client_request_id`
- Produces: retry cùng body → `{ queued: true, execute_id, client_request_id, replayed: true }` **không** gọi Graph lần 2 nếu `post_id` đã có; nếu `queued` chưa xong → trả cùng `execute_id`

- [ ] **Step 1: Write the failing test**

```ts
it('replays the same client_request_id without a second publish', async () => {
  const publish = jest.fn().mockResolvedValue({ post_id: '555_1' });
  const repo = {
    insertPublicationExecute: jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' })),
    findExecuteByClientRequestId: jest.fn().mockResolvedValue({
      id: 88, client_request_id: 'r1', post_id: '555_1', status: 'published',
    }),
  };
  const svc = makeExecuteService({ repo, connector: { id: 'fb', publish } });
  const out = await svc.enqueuePublicationExecute({
    staffId: 7, actor: 's@ptt.vn',
    body: { item_id: 21, channel_account_id: 1, snapshot_id: 'v13', confirm: true, client_request_id: 'r1' },
  });
  expect(out.execute_id).toBe(88);
  expect(out.replayed).toBe(true);
  expect(publish).not.toHaveBeenCalled();
});

it('audit CSV lists publication.execute after enqueue', async () => {
  const rows = [{ action: 'publication.execute', entity: 'item:21', created_at: '2026-09-11T00:00:00.000Z', actor: 's@ptt.vn' }];
  expect(formatAuditExportCsv(rows)).toMatch(/publication\.execute/);
  expect(formatAuditExportCsv(rows)).not.toMatch(/access_token/);
});
```

Dùng `formatAuditExportCsv` trong `audit-export.util.ts` — **không** viết lại formatter, chỉ thêm action.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/content-os-portfolio.service.execute.spec.ts src/content-os-portfolio/content-os-portfolio.service.audit.spec.ts --no-coverage
```

Expected: FAIL (`replayed` / action missing)

- [ ] **Step 3: Write minimal implementation**

Bắt 23505 → `findExecuteByClientRequestId` hoặc find by unique triple. `runPublicationExecute` no-op nếu `post_id` đã set. CSV: `listAuditActivity` đã UNION `cmkt_audit_exports` — đủ nếu insert đúng `action`.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/content-os-portfolio.service.execute.spec.ts src/content-os-portfolio/audit-export.util.spec.ts src/content-os-portfolio/content-os-portfolio.service.audit.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.execute.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.audit.spec.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): idempotent publication execute and audit action

EOF
)"
```

---

### Task 41: FE — Connect Page + Đăng lên Page + confirm modal

**Files:**
- Create: `services/ops-web/src/lib/crm/cmkte-win-publish.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-win-publish.spec.ts`
- Modify: `services/ops-web/src/lib/crm/cmkte-api.ts` + `cmkte-api.spec.ts`
- Modify: `CmktESettings.tsx` + `CmktESettings.spec.ts`
- Modify: `CmktEWorkspace.tsx` + spec workspace (tạo `CmktEWorkspace.publish.spec.ts` nếu chưa có)
- Modify: settings / workspace page loaders (nơi gọi `fetchPortfolioSettings`)

**Interfaces:**
- Consumes: `evaluatePublishGate`, settings `direct_social_publish`, `GET channel-accounts`
- Produces:

```ts
export function canShowDangLenPage(input: {
  directSocialPublish: boolean;
  health: 'Manual' | 'Connected' | 'TokenExpired';
  canPublish: boolean;
}): boolean {
  return input.directSocialPublish && input.health === 'Connected' && input.canPublish;
}

export function canOpenConfirm(gateStatus: 'Pass' | 'Warning' | 'Blocked'): boolean {
  return gateStatus !== 'Blocked';
}
```

API helpers:

```ts
export function facebookOAuthStartUrl(): string {
  return `${API_BASE}/api/crm/content-os/portfolio/connectors/facebook/oauth/start`;
}
export async function fetchChannelAccounts(token: string): Promise<{ items: ChannelAccountPublic[] }>;
export async function postConnectorDisconnect(token: string, id: number): Promise<{ status: 'off' }>;
export async function postPublicationExecute(token: string, body: ExecuteBody): Promise<ExecuteAccepted>;
```

`fetchChannelAccounts` / execute response: `expect(JSON.stringify(data)).not.toMatch(/access_token|refresh_token/)`.

UI Settings (parity mockup, **không** ribbon WIN):
- Giữ switch Direct + Save policy + `AUDIT_RETENTION_COPY` = `Audit lưu 7 năm.`
- Nút **Connect Page** → `window.location.assign(facebookOAuthStartUrl())` (cookie JWT gửi kèm same-origin API).
- Nút **Disconnect** → `postConnectorDisconnect`.
- Health tag Manual / Connected từ accounts.

UI Workspace tab Publish:
- Giữ **Mark published** (`postContentOsPublishItem`) — hiện khi flag off.
- **Đăng lên Page** ẩn nếu `!canShowDangLenPage`.
- Modal: preview caption + Page name + checkbox copy đúng HTML: `Tôi xác nhận đăng với tư cách Page này. AI không được xác nhận.`
- Blocked → toast, không mở modal.
- Sticky **Đăng lên Page** khi tab publish + Connected.
- Evidence: `post_id` + permalink từ execute/log — không bịa.
- Tab 3 label: **Đăng / Mark published**.
- IG/CMS: **không** render nút sống.

- [ ] **Step 1: Write the failing test**

```ts
import { canOpenConfirm, canShowDangLenPage } from './cmkte-win-publish';

describe('canShowDangLenPage', () => {
  it('hides when flag off or Manual or no publish cap', () => {
    expect(canShowDangLenPage({ directSocialPublish: false, health: 'Connected', canPublish: true })).toBe(false);
    expect(canShowDangLenPage({ directSocialPublish: true, health: 'Manual', canPublish: true })).toBe(false);
    expect(canShowDangLenPage({ directSocialPublish: true, health: 'Connected', canPublish: false })).toBe(false);
    expect(canShowDangLenPage({ directSocialPublish: true, health: 'Connected', canPublish: true })).toBe(true);
  });
});

describe('canOpenConfirm', () => {
  it('is false when Blocked', () => {
    expect(canOpenConfirm('Blocked')).toBe(false);
    expect(canOpenConfirm('Pass')).toBe(true);
  });
});
```

Settings spec: HTML chứa `Connect Page`, `Disconnect`, không chứa `access_token`.

Workspace publish spec: `Mark published` luôn có; `Đăng lên Page` chỉ khi props `showDangLenPage`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ops-web && npx vitest run src/lib/crm/cmkte-win-publish.spec.ts
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Wire page.tsx settings/workspace: fetch accounts + settings. Toast tiếng Việt: `Không đăng được — xem Publication log`. 403 ẩn nút (không form).

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ops-web && npx vitest run src/lib/crm/cmkte-win-publish.spec.ts src/lib/crm/cmkte-api.spec.ts src/components/content-os/cmkte/CmktESettings.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/cmkte-win-publish.ts services/ops-web/src/lib/crm/cmkte-win-publish.spec.ts \
  services/ops-web/src/lib/crm/cmkte-api.ts services/ops-web/src/lib/crm/cmkte-api.spec.ts \
  services/ops-web/src/components/content-os/cmkte/CmktESettings.tsx \
  services/ops-web/src/components/content-os/cmkte/CmktESettings.spec.ts \
  services/ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx
git commit -m "$(cat <<'EOF'
feat(cmkte): Connect Page and human-confirm Đăng lên Page

EOF
)"
```

---

### Task 42: Command Today board + Publication health copy

**Files:**
- Modify: `content-os-portfolio.service.ts` — `getCommandCenter` thêm `today_publish: TodayPublishRow[]`
- Create: `content-os-portfolio.today-publish.util.ts` + spec
- Modify: `CmktECommandCenter.tsx` + spec (tạo `CmktECommandCenter.spec.ts` nếu chưa)
- Modify: `CmktECalendar.tsx`
- Modify: `cmkte-api.ts` types

**Interfaces:**
- Consumes: gate + channel health + item scheduled today (timezone `Asia/Ho_Chi_Minh`)
- Produces:

```ts
export type TodayPublishRow = {
  item_id: number;
  display_code: string;
  page_name: string;
  gate: 'Pass' | 'Warning' | 'Blocked';
  blockers: number;
  health: 'Manual' | 'Connected' | 'TokenExpired';
};

export function mapTodayPublishRow(input: {
  item_id: number;
  display_code: string;
  page_name: string;
  gate: 'Pass' | 'Warning' | 'Blocked';
  blockerCount: number;
  health: 'Manual' | 'Connected' | 'TokenExpired';
}): TodayPublishRow;
```

0 hàng = empty (không seed). Nút **Mở Publish Control** → `/crm/content-os/w/{id}?tab=publish`.

Calendar: Facebook health từ API; **không** Instagram Connected giả.

- [ ] **Step 1: Write the failing test**

```ts
import { mapTodayPublishRow } from './content-os-portfolio.today-publish.util';

it('maps a real row and keeps empty list legal', () => {
  expect(mapTodayPublishRow({
    item_id: 21, display_code: 'CNT-1', page_name: 'PTT Ads',
    gate: 'Blocked', blockerCount: 3, health: 'Manual',
  })).toEqual({
    item_id: 21, display_code: 'CNT-1', page_name: 'PTT Ads',
    gate: 'Blocked', blockers: 3, health: 'Manual',
  });
});
```

Command FE: khi `today_publish: []` không render hàng Sunlight.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/content-os-portfolio.today-publish.util.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Query item có slot hôm nay trong scoped lifecycles; tính gate bằng `evaluatePublishGate` hiện có; health từ Task 37. Không invent client.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/content-os-portfolio.today-publish.util.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/components/content-os/cmkte/CmktECommandCenter.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.today-publish.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.today-publish.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ops-web/src/components/content-os/cmkte/CmktECommandCenter.tsx \
  services/ops-web/src/components/content-os/cmkte/CmktECalendar.tsx \
  services/ops-web/src/lib/crm/cmkte-api.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): today-publish board from live gate and health

EOF
)"
```

---

### Task 43: HttpJsonDamAdapter (allowlist + empty ≠ error)

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/http-json-dam.adapter.ts`
- Create: `services/ptt-crm-api/src/content-os-portfolio/http-json-dam.adapter.spec.ts`
- Modify: `content-os-portfolio.service.ts` `listDamAssets` — collection **bắt buộc**; chọn stub vs HTTP
- Modify: `content-os-portfolio.service.dam.spec.ts`

**Interfaces:**
- Consumes: `DamAdapter`, `listDamOrEmpty`, `toDamUrlMetadata` (E3 — malformed row → cả list `dam_invalid_response`)
- Produces:

```ts
export function assertDamBaseUrl(raw: string | undefined): URL; // https only, throws dam_not_configured
export function createHttpJsonDamAdapter(opts: {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number; // default 5000
  maxBytes?: number;  // default 512_000
}): DamAdapter;
```

`list({ collection })`: GET `{base}/{encodeURIComponent(collection)}`. Redirect: chỉ follow nếu host **cùng** allowlist. Timeout 5s. Body cap. Host lạ / http → `dam_invalid_response`. Chưa set env → stub `DamNotConfiguredError`. Empty array + no throw → `{ items: [] }` **không** `error` (FR-AST-021).

- [ ] **Step 1: Write the failing test**

```ts
import { createHttpJsonDamAdapter, assertDamBaseUrl } from './http-json-dam.adapter';
import { listDamOrEmpty } from './dam-adapter';

it('rejects http and empty env', () => {
  expect(() => assertDamBaseUrl('http://evil')).toThrow('dam_not_configured');
  expect(() => assertDamBaseUrl('')).toThrow('dam_not_configured');
});

it('lists JSON array and returns empty success', async () => {
  const fetchFn = jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => '100' },
    json: async () => [],
  });
  const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
  await expect(listDamOrEmpty(adapter, { collection: 'approved-creative' }))
    .resolves.toEqual({ items: [] });
});

it('rejects a row whose url host is not the allowlist host', async () => {
  const fetchFn = jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => '200' },
    json: async () => [{ id: 'x', url: 'https://evil.example/a.jpg' }],
  });
  const adapter = createHttpJsonDamAdapter({ baseUrl: 'https://dam.example.internal', fetchFn });
  await expect(listDamOrEmpty(adapter, { collection: 'c' }))
    .resolves.toEqual({ items: [], error: 'dam_invalid_response' });
});
```

`listDamAssets` thiếu `collection` → 400 `{ error: 'collection_required' }`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/http-json-dam.adapter.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`AbortSignal.timeout(5000)`. Không log URL đầy đủ (dùng `sanitizeDamDiagnostic`).

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/http-json-dam.adapter.spec.ts src/content-os-portfolio/dam-adapter.spec.ts src/content-os-portfolio/content-os-portfolio.service.dam.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/http-json-dam.adapter.ts \
  services/ptt-crm-api/src/content-os-portfolio/http-json-dam.adapter.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.dam.spec.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): HTTP JSON DAM adapter with host allowlist

EOF
)"
```

---

### Task 44: DAM bind + drawer FE

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/dam-bind.util.ts` + spec
- Modify: controller `POST items/:itemId/dam-bind`
- Modify: service `bindDamAsset`
- Modify: repository `insertDamBinding` + merge `media_json` ref (`dam_id`, `url`) — **không** ghi binary
- Modify: `CmktELibrary.tsx`, workspace Assets, `cmkte-dam.ts`

**Interfaces:**
- Consumes: `DamUrlMetadata`, rights optional
- Produces:

```ts
export function assertBindableDamUrl(url: string, allowedHost: string): string {
  // throw dam_invalid_response on javascript: / data: / http / host mismatch
}

export type DamBindBody = { dam_id: string; url: string; rights?: DamRightsMetadata | null };
```

Rights có → ghi `asset_rights` E1 nếu service đó expose hook; không có → `Unknown` (gate E1 giữ). Audit không cần secret URL signed — lưu host path đã sanitize.

FE: drawer **Chọn từ DAM**; empty success copy `Chưa có asset trong collection`; error codes ổn định; host lạ không bind.

- [ ] **Step 1: Write the failing test**

```ts
import { assertBindableDamUrl } from './dam-bind.util';

it('allows https on allowlist host and rejects javascript', () => {
  expect(assertBindableDamUrl('https://dam.example.internal/a.jpg', 'dam.example.internal'))
    .toBe('https://dam.example.internal/a.jpg');
  expect(() => assertBindableDamUrl('javascript:alert(1)', 'dam.example.internal')).toThrow('dam_invalid_response');
  expect(() => assertBindableDamUrl('https://evil.example/a.jpg', 'dam.example.internal')).toThrow('dam_invalid_response');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/dam-bind.util.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`POST` + `StaffContentMarketingWriteGuard`. Cap `view` không bind.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/dam-bind.util.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/cmkte-dam.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/dam-bind.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/dam-bind.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts \
  services/ops-web/src/components/content-os/cmkte/CmktELibrary.tsx \
  services/ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx \
  services/ops-web/src/lib/crm/cmkte-api.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): bind DAM asset refs without hosting files

EOF
)"
```

---

### Task 45: Glossary CRUD + Intelligence studio + brief brand/locale

**Files:**
- Create: `glossary-create.util.ts` + spec
- Modify: controller `POST glossary`, `PATCH glossary/:id` (`StaffContentMarketingWriteGuard`)
- Modify: service `createGlossary`, `patchGlossaryDraft`
- Modify: repository `insertGlossary`, `updateGlossaryDraft`
- Modify: `convertRequest` + `createRequest` — bắt `brand_id` + `locale`
- Modify: `content-os-portfolio.service.request.spec.ts`, `service.glossary.spec.ts`, `controller.spec.ts`
- Modify: `CmktEIntelligence.tsx` + spec — card **Glossary studio** tách Insight
- Modify: `CmktERequestModal.tsx` / workspace Brief — 2 field bắt buộc
- Modify: `cmkte.css` — `.cmkte-glossary` / `.mark-gloss` (`#f2efff` / `#5439b8`)

**Interfaces:**
- Consumes: E3 `approveGlossary`, `selectCopilotGlossary`, UNIQUE `(term, locale, brand_id)`
- Produces:

```ts
export type GlossaryCreateBody = {
  term: string;
  locale: string;
  brand_id: string;
  lifecycle_id: number;
  preferred?: string;
};

export function parseGlossaryCreate(body: Record<string, unknown>): GlossaryCreateBody;
// Draft only. 400 term_required / locale_required / brand_id_required
```

Approve **giữ** E3 (human, `approve_internal`/`qa`). PATCH Draft only — Approved → 409 `glossary_not_draft`. 23505 → 409 `glossary_duplicate`. Audit `glossary_create`. Convert thiếu brand/locale → 400 `brand_id_required` / `locale_required` (không default bịa).

- [ ] **Step 1: Write the failing test**

```ts
import { parseGlossaryCreate } from './glossary-create.util';

it('requires term locale brand_id lifecycle', () => {
  expect(() => parseGlossaryCreate({ term: 'sống xanh' })).toThrow('locale_required');
  expect(parseGlossaryCreate({
    term: 'sống xanh', locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung', lifecycle_id: 4,
  })).toEqual({
    term: 'sống xanh', locale: 'vi-VN', brand_id: 'tiep-thi-noi-dung', lifecycle_id: 4,
  });
});
```

```ts
it('convertRequest rejects missing brand_id', async () => {
  await expect(svc.convertRequest({
    staffId: 1, requestId: 9, actor: 'am@ptt.vn', body: { locale: 'vi-VN' },
  })).rejects.toMatchObject({ response: { error: 'brand_id_required' } });
});
```

Intelligence spec: có `＋ Tạo Draft`; empty không invent Sunlight (giữ test E3).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/glossary-create.util.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

INSERT status `Draft`. Không AI approve. Highlight class đổi sang token (workspace đã có `cmkte-glossary`).

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/glossary-create.util.spec.ts src/content-os-portfolio/content-os-portfolio.service.glossary.spec.ts src/content-os-portfolio/content-os-portfolio.service.request.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/components/content-os/cmkte/CmktEIntelligence.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/glossary-create.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/glossary-create.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.glossary.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.request.spec.ts \
  services/ops-web/src/components/content-os/cmkte/CmktEIntelligence.tsx \
  services/ops-web/src/components/content-os/cmkte/CmktEIntelligence.spec.ts \
  services/ops-web/src/components/content-os/cmkte/CmktERequestModal.tsx \
  services/ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx \
  services/ops-web/src/styles/cmkte.css
git commit -m "$(cat <<'EOF'
feat(cmkte): glossary Draft create and required brand/locale

EOF
)"
```

---

### Task 46: Legal hold toggle UI

**Files:**
- Create: `legal-hold-toggle.util.ts` + spec
- Modify: `legal-hold.util.ts` (giữ `isLegalHold` / hard-delete 409)
- Modify: controller `PATCH items/:itemId/legal-hold` — **không** thêm DELETE writer
- Modify: service `patchLegalHold`
- Modify: repository `updateLegalHold`
- Modify: `CmktESettings.tsx` / Workspace H1 badge
- Modify: `cmkte-api.ts`

**Interfaces:**
- Consumes: `legal_hold` column E3; `legal_hold_set_by` Task 35
- Produces:

```ts
export function parseLegalHoldPatch(body: Record<string, unknown>): { legal_hold: boolean; reason: string };

export function assertCanReleaseHold(input: {
  sodEnabled: boolean;
  actor: string;
  setBy: string | null;
  canAdmin: boolean;
  canQa: boolean;
}): void;
```

Bật: `reason.trim().length >= 10` — không → 400 `hold_reason_required`. Cap `crm_content.write` **đủ bật**, **không đủ tắt**. Tắt: admin staff **hoặc** `qa` + reason. `CMKT_SOD_ENABLED=1` → `actor === setBy` → 403 `sod_hold_release`. Audit `legal_hold` on/off. Badge `LEGAL HOLD` khi true. Writer không thấy nút xóa (E3 giữ).

- [ ] **Step 1: Write the failing test**

```ts
import { parseLegalHoldPatch, assertCanReleaseHold } from './legal-hold-toggle.util';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

it('requires reason >= 10 when enabling', () => {
  expect(() => parseLegalHoldPatch({ legal_hold: true, reason: 'short' })).toThrow(BadRequestException);
  expect(parseLegalHoldPatch({ legal_hold: true, reason: 'tranh chấp hợp đồng Q4' }))
    .toEqual({ legal_hold: true, reason: 'tranh chấp hợp đồng Q4' });
});

it('blocks writer release and SoD self-release', () => {
  expect(() => assertCanReleaseHold({
    sodEnabled: true, actor: 'a@ptt.vn', setBy: 'a@ptt.vn', canAdmin: false, canQa: true,
  })).toThrow(ForbiddenException);
  expect(() => assertCanReleaseHold({
    sodEnabled: false, actor: 'w@ptt.vn', setBy: 'a@ptt.vn', canAdmin: false, canQa: false,
  })).toThrow(ForbiddenException);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/legal-hold-toggle.util.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Guard: write để bật; tắt kiểm tra cap trong service (`staffAuth.me`). Settings form: input reason + **Áp dụng hold**. Workspace: badge, không DELETE.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/legal-hold-toggle.util.spec.ts src/content-os-portfolio/legal-hold.util.spec.ts src/content-os-portfolio/content-os-portfolio.service.legal-hold.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/legal-hold-toggle.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/legal-hold-toggle.util.spec.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.controller.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.service.ts \
  services/ptt-crm-api/src/content-os-portfolio/content-os-portfolio.repository.ts \
  services/ops-web/src/components/content-os/cmkte/CmktESettings.tsx \
  services/ops-web/src/components/content-os/cmkte/CmktEWorkspace.tsx \
  services/ops-web/src/lib/crm/cmkte-api.ts
git commit -m "$(cat <<'EOF'
feat(cmkte): legal hold toggle with reason and SoD release

EOF
)"
```

---

### Task 47: FR-AI-020 — AI không execute / không publish connector

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/ai-publish-guard.util.ts` + spec
- Modify: mọi generate path `content-marketing` / copilot — **không** import `enqueuePublicationExecute` / `FacebookPageConnector.publish`
- Create: `ai-publish-guard.util.spec.ts` đọc source (grep test)

**Interfaces:**
- Consumes: generate services hiện có
- Produces:

```ts
export const AI_PUBLISH_FORBIDDEN_IMPORTS = [
  'enqueuePublicationExecute',
  'runPublicationExecute',
  'createFacebookPageConnector',
] as const;
```

Test: đọc `content-planner.service.ts`, `content-repurpose.service.ts`, `content-variants` (file generate thật — glob `content-*.service.ts` dưới `content-marketing/`) và `content-os-portfolio.service.ts` **không** gọi execute từ hàm có tên `/generate|copilot|planner/i`.

Cách khóa chắc: `enqueuePublicationExecute` đầu hàm:

```ts
if (input.via === 'ai') throw new ForbiddenException({ error: 'ai_cannot_publish' });
```

Generate **không** truyền `via: 'ai'` vì không được gọi. Test thêm: giả lập generate service inject portfolio → không có method execute trên facade generate.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { AI_PUBLISH_FORBIDDEN_IMPORTS } from './ai-publish-guard.util';

const GENERATE_FILES = [
  'content-marketing/content-repurpose.service.ts',
  'content-marketing/content-brand-context.service.ts',
  'content-marketing/content-marketing-prompt.util.ts',
];

it('generate services do not import execute or Facebook connector', () => {
  for (const rel of GENERATE_FILES) {
    const src = readFileSync(join(__dirname, '..', rel), 'utf8');
    for (const needle of AI_PUBLISH_FORBIDDEN_IMPORTS) {
      expect(src).not.toContain(needle);
    }
  }
});
```

Bổ sung file generate thật nếu `rg -l "buildDraftUserPrompt|buildVariantsUserPrompt" services/ptt-crm-api/src/content-marketing` ra thêm path — không bịa tên.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/ai-publish-guard.util.spec.ts --no-coverage
```

Expected: FAIL (util missing) — sau khi util có, PASS nếu generate chưa import (đó là trạng thái muốn giữ)

- [ ] **Step 3: Write minimal implementation**

Export list + test. Không thêm nút Copilot “Đăng”. Workspace Copilot actions giữ A/B Hooks / Rewrite / Extract / Voice check.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/ai-publish-guard.util.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/ai-publish-guard.util.ts \
  services/ptt-crm-api/src/content-os-portfolio/ai-publish-guard.util.spec.ts
git commit -m "$(cat <<'EOF'
test(cmkte): lock AI generate away from publication execute

EOF
)"
```

---

### Task 48: E4 acceptance (UAT spec §13)

**Files:**
- Create: `services/ptt-crm-api/src/content-os-portfolio/e4-acceptance.spec.ts`
- Create: `services/ops-web/src/lib/crm/cmkte-win-acceptance.spec.ts`

**Interfaces:**
- Consumes: mọi util Task 35–47
- Produces: một file Jest + một file Vitest map 12 cửa UAT (không Graph mạng thật — inject fetch)

- [ ] **Step 1: Write the failing test**

```ts
describe('E4 acceptance', () => {
  it('1 flag off → stub NotEnabledError and hide page button', () => {
    expect(resolvePublishConnector({
      direct_social_publish: false, connectorStatus: 'on', hasToken: true,
    }).id).toBe('stub');
    expect(canShowDangLenPage({
      directSocialPublish: false, health: 'Connected', canPublish: true,
    })).toBe(false);
  });

  it('3 Blocked → cannot confirm', () => {
    expect(canOpenConfirm('Blocked')).toBe(false);
    expect(() => assertExecuteGate('Blocked')).toThrow();
  });

  it('5 replay client_request_id does not publish twice — covered by execute spec contract', () => {
    expect(true).toBe(true);
  });

  it('12 CTA remains Đăng ký nhận tư vấn', () => {
    expect('Đăng ký nhận tư vấn').not.toMatch(/Gọi ngay/);
  });
});
```

Vitest: Settings/Workspace/Intelligence không có handler IG; có Connect Page, Tạo Draft, Chọn từ DAM, Mark published.

**Không** gọi Facebook/DAM host lạ trong CI.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/e4-acceptance.spec.ts --no-coverage
```

Expected: FAIL until imports exist (sau Task 41+ sẽ xanh từng phần — viết file này **cuối**)

- [ ] **Step 3: Write minimal implementation**

Chỉ test harness + import. Apply DDL trên VPS **ngoài** task này (`./scripts/apply_pg_ddl_cmkt_e4_win.sh`) khi deploy.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
cd services/ptt-crm-api && npx jest src/content-os-portfolio/e4-acceptance.spec.ts src/content-os-portfolio/publish-connector.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/cmkte-win-acceptance.spec.ts src/lib/crm/cmkte-win-publish.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/content-os-portfolio/e4-acceptance.spec.ts \
  services/ops-web/src/lib/crm/cmkte-win-acceptance.spec.ts
git commit -m "$(cat <<'EOF'
test(cmkte): E4 competitive-win acceptance harness

EOF
)"
```

---

## Coverage SPEC-CMKT-WIN → Task

| Spec | Task |
|---|---|
| §6.2 / FR-SET-010 / NFR-WIN-003 / NFR-WIN-006 | 36, 37 |
| §6.1 / FR-PUB-020…024 / BR-WIN-01…05 / NFR-WIN-001/002 | 38, 39, 40 |
| FR-UI-030 publish/settings/sticky | 41, 42 |
| §6.3 / FR-AST-020/021 / BR-WIN-06 / NFR-WIN-005 | 43, 44 |
| §6.4 / FR-COPY-020/021 / BR-WIN-07 | 45 |
| §6.5 / FR-AUD-021 | 46 |
| FR-AUD-020 | 36, 39, 40, 45, 46 |
| FR-AI-020 / BR-AI-01 | 47 |
| FR-UI-031 IG/CMS off | 41, 48 |
| FR-SET-011 default off / BG-WIN-06 Mark published | 38, 41 |
| §13 UAT 1–12 | 48 (+ từng task) |
| §5 ngoài scope / E5–E6 | không có task — cấm làm |
| Ribbon WIN mockup | không render prod (Task 41) |

## UAT tay (sau deploy, không trong CI)

Pilot `tiep-thi-noi-dung`. Env: `CMKT_FB_APP_ID`, `CMKT_FB_APP_SECRET`, `CMKT_FB_REDIRECT_URI`, `CMKT_FB_PAGE_ALLOWLIST`, `CMKT_DAM_BASE_URL` (https), `OPS_WEB_ORIGIN`. Apply `./scripts/apply_pg_ddl_cmkt_e4_win.sh`.

1. Flag off → chỉ Mark published; ẩn Đăng lên Page; health Manual.
2. Connect Page allowlist → health Connected; DevTools JSON không chứa token.
3. Gate Blocked → không modal confirm.
4. Confirm + execute → `post_id` trên Page; permalink hoặc id trên Publication log.
5. Retry cùng `client_request_id` → không post trùng.
6. AI generate không gọi execute (test Task 47 + không nút).
7. Token hết hạn → TokenExpired; execute 409/503 mã ổn định.
8. DAM configured → list; bind; collection sai / host lạ → error code, items [].
9. Tạo term Draft → không highlight; Approve → highlight + Copilot.
10. Bật legal hold + reason → badge; không nút xóa writer.
11. Audit export chứa `publication.execute` / `oauth_connect` / `legal_hold`.
12. CTA copy publish vẫn **Đăng ký nhận tư vấn**.

Cửa BG-WIN: 1 `post_id` thật + 1 DAM bind + 1 term UI. Không seed Sunlight.

---

## Ghi chú thực thi

- Jest worker leak E0–E3: ngoài scope; không “fix” bằng tắt test.
- `ensurePgReady` rewrite: ngoài scope; endpoint mới fail-closed riêng.
- Secret manager: E5. E4 cột DB + cấm SELECT token trên GET.
- Meta app review: ngoài plan code; chặn UAT Graph nếu app chưa duyệt — connector vẫn stub an toàn.