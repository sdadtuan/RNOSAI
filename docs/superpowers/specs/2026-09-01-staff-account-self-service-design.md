# Staff Account Self-Service — Gói C

> **Document ID:** STAFF-ACCOUNT-20260901  
> **Phiên bản:** 1.1 · **Ngày:** 2026-09-01  
> **Trạng thái:** Plan ready — [`2026-09-01-staff-account-self-service.md`](../plans/2026-09-01-staff-account-self-service.md)  
> **1.1:** Thêm **upload avatar** (§5.4, §6.7) — Gói C + ảnh đại diện.  
> **UI:** **A** — bấm avatar/tên → menu (Tài khoản / Đăng xuất) → trang `/account` (không dialog).  
> **Route:** `/account` (mọi staff đã login; không cap mới)  
> **Sibling:** [Keycloak staff auth](../../runbooks/keycloak-staff-auth.md) · [WIN-4 SSO](../../specs/2026-08-07-win-4-implementation-plan.md) · [Portal change-password](../../use-cases/actions/06-PORTAL-ACTIONS.md) · [Staff SSO DDL](../../specs/2026-08-07-postgresql-ddl-staff-sso-r4.sql)

---

## 1. Tóm tắt

Nhân viên ops-web **không có** trang tài khoản. Topbar chỉ tên + Đăng xuất. Portal khách đã có đổi mật khẩu; staff chưa.

Prod login **SSO Keycloak** (`STAFF_AUTH_MODE=dual|keycloak`). Mật khẩu Nest (`staff_users.password_hash`) vẫn dùng khi dual. JWT access/refresh hiện **stateless** — chỉ `auth_token_version` để hủy *mọi* token khi offboard. Không có danh sách phiên.

**Gói C** = trang `/account` sau login:

1. Hồ sơ — chỉ xem (trừ **avatar**: tải lên / xóa)  
2. Đổi mật khẩu (Nest và/hoặc Keycloak, tùy mode)  
3. MFA — chính sách + deep-link Keycloak  
4. Phiên / thiết bị — liệt kê, thu hồi từng phiên, thu hồi tất cả trừ máy này, đăng xuất mọi thiết bị  
5. Nhật ký đăng nhập — 20 sự kiện gần nhất của chính user

**Pitch 1 câu:** NV tự xem hồ sơ login, đổi ảnh đại diện, đổi mật khẩu đúng nơi lưu mật khẩu, bật OTP, đá phiên lạ — không ticket IT.

---

## 2. Mục tiêu & phạm vi

### 2.1. Mục tiêu

| # | Mục tiêu | Đo thành công |
|---|----------|----------------|
| G1 | Mọi staff vào được trang tài khoản | Topbar → Tài khoản → `/account`; không 403 vì thiếu cap |
| G2 | Đổi mật khẩu đúng nguồn | `nest`/`dual` + có hash → form Nest; SSO → link Keycloak Account; dual hiện cả hai |
| G3 | MFA tự phục vụ | Thấy “chức vụ có bắt OTP”; nút mở Keycloak Signing in |
| G4 | Phiên từng thiết bị | Login tạo 1 hàng `staff_sessions`; thu hồi 1 sid → chỉ sid đó 401 |
| G5 | Đăng xuất mọi thiết bị | Máy hiện tại về `/login`; token cũ (kể cả refresh) chết |
| G6 | Nhật ký | 20 event của `user_id` hiện tại từ `staff_auth_audit`; không thấy user khác |
| G7 | Không phá SSO / offboard | `auth_token_version` vẫn hủy toàn bộ khi HR khóa user |
| G8 | Avatar tự phục vụ | Upload JPEG/PNG/WebP ≤ 1 MB; topbar + `/account` hiện ảnh; xóa về initials |

### 2.2. In scope

- Route `/account` + dropdown topbar (Tài khoản / Đăng xuất).  
- API dưới `/api/v1/staff/auth/account/*` (cùng module `staff-auth`).  
- DDL `staff_sessions` + claim JWT `sid`.  
- Đổi mật khẩu Nest (scrypt, cùng util portal).  
- Link Keycloak Account (password + OTP).  
- List / revoke session; revoke-others; revoke-all.  
- Đọc audit của chính mình.  
- Mở rộng `GET /api/v1/staff/auth/me` (field hồ sơ, không phá client cũ).  
- Avatar: cột `staff_users.avatar_*`, file đĩa, POST/DELETE/GET authenticated.  
- Test unit + e2e staff-auth; copy VI trên UI.

### 2.3. Out of scope (cố ý)

- Đổi email, chức vụ, team, `display_name` (HR/Admin `/admin/crm/org/users`).  
- Hồ sơ HR (CCCD, ngân hàng) — `/crm/staff/[id]`, ví `/crm/hr/my-wallet`.  
- Quên mật khẩu / reset email (chưa login).  
- Admin xem/thu hồi phiên user khác.  
- Keycloak Admin API (list session IdP, đọc credential OTP).  
- Đồng bộ mật khẩu Nest ↔ Keycloak.  
- Theme, ngôn ngữ.  
- Avatar công khai không auth; SVG/GIF; crop server; CDN/S3 (v1 đĩa local như brand/HR wallet).  
- Avatar trên hồ sơ HR `/crm/staff/[id]` (header vẫn initials v1; có thể reuse GET sau).  
- Portal `/settings` (đã có).  
- Sandbox `demo_*` / stub user đổi mật khẩu hoặc avatar.

### 2.4. Không phá

- `STAFF_AUTH_MODE` nest / dual / keycloak.  
- Offboard: `auth_token_version + 1` vẫn revoke mọi JWT.  
- `staff_auth_audit` event cũ (`sso_login`, `sso_link`, `fallback_password`, `mfa_blocked`, `token_revoked`).  
- Cookie middleware `ptt_ops_auth` — `/account` **không** public.  
- CEO post-login `/crm/ceo` — không đổi.

---

## 3. Hướng đã chọn

Đã loại 2 hướng không đủ Gói C:

| Hướng | Ý | Lý do loại |
|-------|---|------------|
| A — Chỉ tăng `auth_token_version` | Đá hết thiết bị, không list phiên | Không đạt G4 |
| B — Keycloak Admin sessions | List session IdP | Không thấy login Nest; cần admin secret; không cover dual |

**Chọn C — sổ phiên Nest + `sid` trên JWT.**

- Mỗi login (Nest hoặc SSO exchange) tạo 1 hàng `staff_sessions`, nhét `sid` vào access + refresh.  
- Refresh **không** tạo phiên mới: cùng `sid`, cập nhật `last_seen_at`.  
- Thu hồi 1 phiên = `revoked_at`; JWT cùng `sid` bị từ chối (kể cả `tv` còn khớp).  
- Password / MFA của IdP = link Account Console, không gọi Admin API.

---

## 4. Kiến trúc

```
Ops-web /account
    │  GET  /staff/auth/me                    hồ sơ + flags
    │  GET  /staff/auth/account               bundle trang
    │  POST /staff/auth/account/password      Nest only
    │  POST /staff/auth/account/avatar        multipart file
    │  DELETE /staff/auth/account/avatar
    │  GET  /staff/auth/account/avatar        bytes + Bearer
    │  GET  /staff/auth/account/sessions
    │  POST /staff/auth/account/sessions/:id/revoke
    │  POST /staff/auth/account/sessions/revoke-others
    │  POST /staff/auth/account/sessions/revoke-all
    │  GET  /staff/auth/account/audit
    ▼
StaffAuthController + StaffAccountService
    │
    ├─ staff_users          hash, oidc_sub, last_login_at, tv, avatar_*
    ├─ staff_sessions       sid, ua, ip, method, revoked
    ├─ staff_auth_audit     nhật ký
    ├─ disk data/staff-avatars/{userId}/{uuid}.ext
    └─ Keycloak Account URL (issuer + /account)  — browser redirect, không server call
```

**Ranh giới**

| Đơn vị | Làm gì | Phụ thuộc |
|--------|--------|-----------|
| `staff-sessions.repository.ts` | CRUD phiên, revoke, list active+revoked gần đây | PG `staff_sessions` |
| `staff-account.service.ts` | Password, avatar, bundle account, audit read, revoke policy | sessions repo, avatar storage, password util, audit |
| `staff-avatar.storage.ts` | Ghi/đọc/xóa file, chống path escape | `PTT_STAFF_AVATAR_STORAGE_ROOT` |
| `staff-auth.service.ts` | `issueTokens` nhận `sid`; login/OIDC/refresh gắn phiên | sessions repo |
| `staff-jwt.util.ts` | Claim `sid?: string` | không DB |
| ops-web `/account` | 5 khối + picker avatar | API account + `staffMe` |
| `OpsNav` | Dropdown user + ảnh avatar | route `/account`, blob GET |

---

## 5. Dữ liệu

### 5.1. Bảng `staff_sessions`

File: `docs/specs/2026-09-01-postgresql-ddl-staff-sessions.sql`  
Apply: `scripts/apply_pg_ddl_staff_sessions.sh` (cùng pattern `apply_pg_ddl_staff_sso_r4.sh`).

```sql
CREATE TABLE IF NOT EXISTS staff_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  login_method VARCHAR(32) NOT NULL,  -- nest_password | sso
  user_agent TEXT NOT NULL DEFAULT '',
  ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_user_seen
  ON staff_sessions (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_user_active
  ON staff_sessions (user_id)
  WHERE revoked_at IS NULL;
```

`expires_at` = lúc issue = `now + staffRefreshTtlSec` (phiên sống theo refresh, không theo access TTL).

`login_method` lúc tạo: `nest_password` hoặc `sso`. Cột không đổi khi refresh.

`revoke_reason`: `user_revoke` | `user_revoke_others` | `user_revoke_all` | `password_changed` | `offboard`.

### 5.2. JWT

Thêm `sid?: string` (UUID) vào `StaffJwtPayload` — **cả** access và refresh cùng sid.

Token **cũ không có `sid`** (trước deploy):

- Vẫn verify bằng `tv` như hiện tại.  
- Không hiện trong list phiên.  
- `revoke-all` và offboard (`tv++`) vẫn giết chúng.  
- Refresh token không `sid`: cấp cặp token mới **kèm sid mới** (một lần, tạo hàng session) — tránh lock-out sau deploy.

### 5.3. Audit event mới

Mở `StaffAuthAuditEvent`:

| event_type | Khi nào |
|------------|---------|
| `password_changed` | Nest đổi hash thành công |
| `session_revoked` | Thu hồi 1 sid (`detail.sid`) |
| `sessions_revoked_others` | Đá các máy khác |
| `sessions_revoked_all` | Đá mọi máy |
| `avatar_updated` | Upload avatar thành công |
| `avatar_removed` | Xóa avatar |

Event login cũ giữ nguyên. Không invent `session_login` — list phiên lấy từ `staff_sessions`, nhật ký lấy audit.

### 5.4. Avatar trên `staff_users`

Cùng file DDL sessions (hoặc block `ALTER` trong file đó):

```sql
ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS avatar_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
```

- Một user tối đa **một** file. Upload mới xóa file cũ rồi ghi key mới.  
- Đường dẫn đĩa: `{root}/{staff_user_uuid}/{uuid}.{jpg|png|webp}`.  
- Root: `PTT_STAFF_AVATAR_STORAGE_ROOT` hoặc mặc định `data/staff-avatars` (cùng kiểu `PTT_HR_DOC_STORAGE_ROOT`).  
- **Không** public URL. **Không** nhét bytes vào JWT / `me` JSON.  
- `has_avatar` = `avatar_storage_key IS NOT NULL`.

---

## 6. API

Mọi route trừ ghi chú: `StaffJwtGuard`, user = `sub` của token. **Cấm** truyền `user_id` khác trên path/body.

### 6.1. `GET /api/v1/staff/auth/me` (mở rộng)

Field cũ giữ nguyên. Thêm optional:

| Field | Ý nghĩa |
|-------|---------|
| `account_kind` | `staff` \| `guest` \| `contractor` |
| `last_login_at` | ISO hoặc null |
| `oidc_linked` | `boolean` — `oidc_sub` khác null |
| `password_login_enabled` | Nest login được phép **và** user có `password_hash` (không stub) |
| `sso_enabled` | `staffAuthMode !== 'nest'` và có issuer |
| `mfa_required_for_position` | `position_code` nằm trong `staffMfaRequiredPositionCodes` |
| `keycloak_account_url` | `{issuer}/account` hoặc null |
| `teams` | `[{ id, name }]` — join org, rỗng nếu không có |
| `has_avatar` | `boolean` |
| `avatar_updated_at` | ISO hoặc null — client dùng bust cache blob |

Client cũ bỏ qua field mới.

### 6.2. `GET /api/v1/staff/auth/account`

Một payload cho trang (tránh 4 round-trip lúc mount):

```json
{
  "profile": { "...me fields..." },
  "sessions": { "current_sid": "...", "items": [ ] },
  "audit": { "items": [ ] }
}
```

`profile` = cùng shape `me` đã mở rộng. `sessions` / `audit` = §6.4 / §6.6.

### 6.3. `POST /api/v1/staff/auth/account/password`

Body: `{ "current_password": "", "new_password": "" }`.

| Điều kiện | HTTP | `error` |
|-----------|------|---------|
| `STAFF_AUTH_MODE=keycloak` hoặc `!staffNestLoginAllowed()` | 400 | `password_change_sso_only` |
| Stub / không có hash | 400 | `password_change_not_available` |
| Sai mật khẩu hiện tại | 401 | `invalid_current_password` |
| `new` &lt; 8 ký tự | 400 | `password_too_short` (`min_length: 8`) |
| `new === current` | 400 | `password_unchanged` |

Thành công:

1. `password_hash = hashPortalPassword(new)` (scrypt).  
2. Revoke mọi session **khác** `sid` hiện tại, `revoke_reason=password_changed`.  
3. Audit `password_changed`.  
4. `{ "ok": true, "message": "password_updated" }`.  
5. **Không** tăng `auth_token_version`. Máy hiện tại giữ token.

UI bắt confirm khớp trước khi gọi API. API không nhận `confirm_password`.

### 6.4. `GET /api/v1/staff/auth/account/sessions`

Trả tối đa 20 phiên của user, sort `last_seen_at DESC`. Bao gồm đã revoke trong 7 ngày (badge “Đã thu hồi”).

Item:

| Field | |
|-------|--|
| `id` | UUID sid |
| `current` | `id === jwt.sid` |
| `login_method` | `nest_password` \| `sso` |
| `device_label` | parse UA ngắn: `Chrome · macOS` / `Safari · iPhone` / `Không rõ` |
| `ip` | text hoặc null |
| `created_at` | ISO |
| `last_seen_at` | ISO |
| `expires_at` | ISO |
| `revoked_at` | ISO hoặc null |

Không trả raw `user_agent` đầy đủ trên list (chỉ `device_label`). Log server được giữ UA đầy đủ.

### 6.5. Thu hồi

`POST /api/v1/staff/auth/account/sessions/:id/revoke`

- `:id` phải thuộc user. Sai → 404 `session_not_found`.  
- Đã revoke → 200 idempotent `{ ok: true, already_revoked: true }`.  
- Nếu `:id === jwt.sid` → revoke + client phải `clearSession` và về `/login` (`current_revoked: true`).

`POST /api/v1/staff/auth/account/sessions/revoke-others`

- Revoke mọi session active trừ `jwt.sid`.  
- Token không `sid` → 400 `session_binding_required` (user refresh/re-login một lần).

`POST /api/v1/staff/auth/account/sessions/revoke-all`

- Revoke mọi session active (`revoke_reason=user_revoke_all`).  
- `auth_token_version = auth_token_version + 1` — giết cả JWT pre-sid.  
- Audit `sessions_revoked_all` + `token_revoked`.  
- Client luôn logout.

### 6.6. `GET /api/v1/staff/auth/account/audit`

Query: `limit` mặc định 20, max 50.

Item: `{ id, event_type, created_at, summary_vi }`.

`summary_vi` map cố định trên server (không lộ `detail_json` thô — tránh groups/oidc_sub trên UI).

| event_type | summary_vi |
|------------|------------|
| `sso_login` | Đăng nhập SSO |
| `sso_link` | Liên kết tài khoản SSO lần đầu |
| `fallback_password` | Đăng nhập mật khẩu Nest |
| `mfa_blocked` | Bị chặn vì chưa OTP |
| `token_revoked` | Token bị hủy |
| `password_changed` | Đổi mật khẩu Nest |
| `session_revoked` | Thu hồi một phiên |
| `sessions_revoked_others` | Đăng xuất các thiết bị khác |
| `sessions_revoked_all` | Đăng xuất mọi thiết bị |
| `avatar_updated` | Cập nhật ảnh đại diện |
| `avatar_removed` | Xóa ảnh đại diện |

User A không đọc được audit user B (filter `user_id = jwt.sub`).

### 6.7. Avatar

Multipart field name: `file` (cùng brand / HR wallet). Multer `memoryStorage`, `limits.fileSize = 1_000_000`.

`POST /api/v1/staff/auth/account/avatar` — chỉ chính `jwt.sub`.

| Điều kiện | HTTP | `error` |
|-----------|------|---------|
| Không file / buffer rỗng | 400 | `file_required` |
| MIME không thuộc jpeg / png / webp | 400 | `invalid_image` |
| Magic bytes không khớp MIME | 400 | `invalid_image` |
| Size > 1 MB (trước hoặc sau crop client) | 400 | `file_too_large` |
| Stub user | 400 | `avatar_not_available` |

SVG, GIF, HEIC, PDF: `invalid_image`. Không tin `Content-Type` nếu magic sai.

Thành công: ghi file, cập nhật `avatar_storage_key` + `avatar_updated_at`, xóa file cũ, audit `avatar_updated`, trả `{ ok: true, has_avatar: true, avatar_updated_at }`.

`DELETE /api/v1/staff/auth/account/avatar`

- Không có avatar → 200 `{ ok: true, has_avatar: false, already_removed: true }`.  
- Có → xóa file + null cột, audit `avatar_removed`.

`GET /api/v1/staff/auth/account/avatar`

- Bearer bắt buộc. 404 `avatar_not_found` nếu chưa có.  
- `Content-Type` đúng mime file; `Cache-Control: private, max-age=300`; body = bytes.  
- **Không** route public. `<img src>` không gửi Bearer → ops-web `fetch` blob → `URL.createObjectURL`.  
- Không GET avatar user khác ở v1 (topbar chỉ cần ảnh mình).

**Crop:** client canvas center-crop vuông, xuất JPEG 256×256 quality ~0.85, rồi POST. Server **không** thêm dependency resize (không `sharp`). Server vẫn enforce mime + 1 MB nếu client bỏ crop.

---

## 7. Gắn phiên lúc login / refresh

Sửa `issueTokens` trong `staff-auth.service.ts`:

1. **Login Nest / OIDC exchange:** tạo UUID `sid`, insert session (`ip`, `user_agent` từ request), sign JWT có `sid`.  
2. **Refresh:**  
   - Có `sid` + hàng active + chưa hết hạn → `last_seen_at = now()`, gia hạn `expires_at`, giữ sid.  
   - Có `sid` nhưng revoked / hết hạn / không hàng → 401 `session_revoked`.  
   - Không `sid` (token cũ) → tạo session mới, token mới có sid.  
3. **Offboard** (đã có): `tv++`. Guard: `tv` lệch **hoặc** session revoked → 401. V1 không bắt buộc stamp `revoked_at` trên từng hàng khi offboard — `tv` đủ giết JWT.

IP: lấy `X-Forwarded-For` first hop nếu tin proxy (VPS nginx), không thì `req.ip`. UA: header `User-Agent` cắt 512 ký tự.

`StaffJwtGuard` / `assertTokenVersion`: thêm `assertSession(payload)` khi `payload.sid` có mặt.

---

## 8. UI `/account`

`services/ops-web/src/app/account/page.tsx` — `StaffPageShell`, breadcrumb `Tài khoản`.

Năm khối trên cùng trang, không tab:

1. **Hồ sơ** — **avatar** (ảnh tròn 96px): preview, nút “Đổi ảnh”, “Xóa ảnh” (ẩn nếu chưa có). Email, tên, chức vụ (`position_code`), team, loại TK, lần login cuối, badge `SSO đã liên kết` / `Chưa liên kết SSO`, badge `Mật khẩu Nest`. Ghi chú: “Sửa họ tên / chức vụ: liên hệ HR.” Không form edit field chữ. Picker `accept="image/jpeg,image/png,image/webp"`; client crop vuông 256px rồi upload. Preview local trước khi lưu.  
2. **Mật khẩu**  
   - Nest available → form 3 ô (hiện tại / mới / xác nhận), min 8, copy VI giống portal.  
   - SSO → nút “Đổi mật khẩu trên Keycloak” → `keycloak_account_url` tab mới.  
   - Dual → form + nút Keycloak + câu: “SSO và mật khẩu Nest là hai nguồn riêng; đổi một bên không đổi bên kia.”  
   - `password_change_sso_only` → chỉ nút Keycloak.  
3. **Bảo mật (MFA)** — “Chức vụ này bắt buộc OTP: Có/Không.” Nút “Quản lý OTP trên Keycloak” (cùng account URL). Không claim “đã bật OTP” trừ khi có bằng chứng từ claim lần SSO (không gọi Admin API → **không** hiện trạng thái enrolled).  
4. **Phiên đăng nhập** — bảng: Thiết bị này (badge), device_label, method, IP, last_seen, expires; nút Thu hồi. Hai nút khối: “Đăng xuất thiết bị khác”, “Đăng xuất mọi thiết bị” (confirm VI).  
5. **Nhật ký** (cùng trang, dưới phiên) — thời gian + `summary_vi`.

Lỗi API → `error` tiếng Việt map từ `error` code (không show stack).

### 8.1. Topbar

`ops-topbar-user`: avatar + tên thành **button** mở menu:

- Tài khoản → `/account`  
- Đăng xuất → `onLogout` hiện tại  

Nút “Đăng xuất” riêng trên topbar **bỏ** (tránh 2 chỗ); logout chỉ trong menu. Mobile: cùng menu.

Topbar avatar: nếu `has_avatar` thì blob từ GET avatar (revoke object URL khi unmount / khi `avatar_updated_at` đổi); không thì initials như hiện tại. Không fetch avatar khi chưa login.

`pageTitleFor('/account')` = `Tài khoản`. Không thêm item sidebar CRM.

---

## 9. Bảo mật

| Rule | Chi tiết |
|------|----------|
| Isolation | Mọi query `user_id = jwt.sub`. Không admin-on-behalf. |
| Password | Không log plaintext. Hash scrypt. Timing-safe verify. |
| Rate | Password: tối đa 5 lần / user / 15 phút — 429 `rate_limited`. Session revoke không rate chặt. |
| Audit leak | UI không render `detail_json`. |
| CSRF | Cùng Bearer sessionStorage như API khác; không cookie-session mới. |
| SSO link | `keycloak_account_url` chỉ từ issuer config server, không nhận URL từ client. |
| Confirm | Revoke-all và revoke-others: dialog “Hành động này đá phiên khác. Tiếp tục?” |
| Avatar | Chỉ jpeg/png/webp; magic-byte; ≤ 1 MB; không SVG (XSS); GET + Bearer; path không escape `rootDir`; user A không đọc file user B |
| Avatar rate | 10 upload / user / 15 phút → 429 `rate_limited` |

---

## 10. Lỗi & copy UI

| `error` | VI |
|---------|-----|
| `invalid_current_password` | Mật khẩu hiện tại không đúng. |
| `password_too_short` | Mật khẩu mới tối thiểu 8 ký tự. |
| `password_unchanged` | Mật khẩu mới phải khác mật khẩu hiện tại. |
| `password_change_sso_only` | Tài khoản này đổi mật khẩu trên Keycloak. |
| `password_change_not_available` | Tài khoản này không dùng mật khẩu Nest. |
| `session_revoked` | Phiên đã hết hạn hoặc bị thu hồi. Đăng nhập lại. |
| `session_not_found` | Không tìm thấy phiên. |
| `session_binding_required` | Làm mới trang hoặc đăng nhập lại để quản lý phiên. |
| `rate_limited` | Thử lại sau vài phút. |
| `file_required` | Chọn một ảnh để tải lên. |
| `invalid_image` | Chỉ nhận JPEG, PNG hoặc WebP. |
| `file_too_large` | Ảnh tối đa 1 MB. |
| `avatar_not_available` | Tài khoản này không đổi được ảnh đại diện. |
| `avatar_not_found` | Chưa có ảnh đại diện. |

Đổi mật khẩu OK: “Đã đổi mật khẩu Nest. Các thiết bị khác đã đăng xuất.”  
Avatar OK: “Đã cập nhật ảnh đại diện.” / “Đã xóa ảnh đại diện.”

---

## 11. Kiểm thử

| Case | Kỳ vọng |
|------|---------|
| Login Nest → GET sessions | 1 item `current`, method `nest_password` |
| Login SSO → sessions | method `sso` |
| Revoke sid khác → refresh token sid đó | 401 `session_revoked` |
| Revoke sid hiện tại | 200 `current_revoked`; access tiếp theo 401 |
| Revoke-others | sid hiện tại refresh OK; sid khác 401 |
| Revoke-all | `tv` tăng; JWT cũ 401 kể cả không sid |
| Password sai current | 401; hash không đổi |
| Password short | 400 |
| Mode keycloak + POST password | 400 `password_change_sso_only` |
| User A GET audit / sessions của B (thử spoof) | không lộ (không có param user_id) |
| Token pre-sid refresh | cấp sid mới, có hàng session |
| Offboard `tv++` | session còn active vẫn 401 vì tv |
| POST avatar PNG hợp lệ | 200; GET trả bytes; `has_avatar` true |
| POST SVG / PDF | 400 `invalid_image` |
| POST > 1 MB | 400 `file_too_large` |
| User A GET avatar (bytes) của B | không có endpoint userId — 404/own only |
| DELETE khi chưa có ảnh | 200 `already_removed` |

UI: spec component form (confirm mismatch không gọi API). E2E trang `/account` optional nếu pipeline ops-web đã có pattern login.

---

## 12. Deploy

1. Apply DDL trên PG (local + VPS) **trước** ship API có `assertSession`.  
2. Tạo thư mục `data/staff-avatars` trên VPS (user chạy `ptt-crm-api` ghi được); set `PTT_STAFF_AVATAR_STORAGE_ROOT` nếu không dùng mặc định.  
3. Deploy `ptt-crm-api` rồi `ops-web`.  
4. User đang mở tab: token cũ không sid vẫn chạy đến hết TTL; refresh tự gắn sid.  
5. Hard-refresh ops-web để thấy menu Tài khoản + avatar.

Không seed cap. Không đổi Keycloak realm JSON (Account Client mặc định realm đã có).

---

## 13. Tiêu chí chấp nhận

- [ ] Staff bất kỳ login → menu → `/account` thấy 5 khối + đổi/xóa avatar.  
- [ ] Upload JPEG/PNG/WebP ≤ 1 MB → topbar hiện ảnh; xóa → initials.  
- [ ] SVG/PDF/file lớn bị từ chối.  
- [ ] Dual: form Nest đổi được; Keycloak mở tab Account.  
- [ ] Mode keycloak: không form Nest; chỉ link.  
- [ ] Hai trình duyệt cùng user: thu hồi một → chỉ trình duyệt đó mất session.  
- [ ] Đăng xuất mọi thiết bị → cả hai về login.  
- [ ] Đổi mật khẩu Nest → trình duyệt kia mất session, cái đang đổi vẫn vào được.  
- [ ] Nhật ký hiện login + revoke của chính mình, không của user khác.  
- [ ] CEO vẫn land `/crm/ceo` sau login.  
- [ ] HR offboard vẫn khóa hết token.

---

## 14. Quyết định đã chốt (không để mở)

| Chủ đề | Quyết định |
|--------|------------|
| Audience | Staff ops-web, không portal |
| Gói | C — hồ sơ + **avatar** + password + MFA link + từng phiên + audit |
| Route | `/account` |
| Cap | Không — mọi user đã login |
| Sửa hồ sơ | Không — trừ upload/xóa avatar |
| Avatar | Đĩa private + GET Bearer; jpeg/png/webp ≤ 1 MB; crop 256px phía client; không SVG/public URL |
| Session store | Bảng PG + JWT `sid` |
| Keycloak Admin API | Không v1 |
| Đồng bộ password Nest↔KC | Không |
| Token cũ không sid | Cho sống; refresh gắn sid |
| Password Nest min | 8, scrypt, cùng portal |
| Revoke-all | `tv++` + revoke rows + logout máy này |
| UI entry | **A** — menu avatar → `/account`, không dialog Gói C |
}