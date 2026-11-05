# System Brand Logo + Login Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một `logo_url` do admin thay ở `/admin/brand`; login cột trái = hero + logo; mọi `BrandLogo` / favicon đổi theo.

**Architecture:** Nest module `brand` lưu file dưới `data/brand/` + 2 bảng PG. Public GET không auth. Ops-web chỉ render logo qua `BrandLogo`. Hero chỉ cột trái `/login`.

**Tech Stack:** NestJS, PostgreSQL, multer memory, Next.js ops-web, Jest (API), Vitest (ops-web).

**Spec:** [`docs/superpowers/specs/2026-08-25-system-brand-logo-design.md`](../specs/2026-08-25-system-brand-logo-design.md)

## Global Constraints

- Login cột trái: hero cover + logo đè; bỏ slogan / lead / `#17692f`.
- Logo seed từ `docs/brand/ptt-logo.png` (copy một lần từ `https://pttads.vn/static/images/ptt-logo.png`). Runtime **không** gọi pttads.vn.
- Một `logo_url`. Cấm ô chữ “PTT” xanh, cấm `public/icons/icon.svg` chữ PTT CRM, cấm URL pttads.vn trong JSX.
- Hero không đổi sidebar/favicon.
- Quyền: `crm_data_config` `view` / `configure`.
- Copy “PTT CRM” / “PTT Ops” trên form/title giữ chữ.
- Không đổi form login, CTA `#17692f`, icon nét sidebar, DAM/CDN.
- Commit chỉ khi user yêu cầu. Không `next build` trên VPS.

---

## File map

```
Create:
  docs/brand/ptt-logo.png
  docs/brand/login-hero.jpg
  docs/specs/postgresql-ddl-brand.sql
  scripts/apply_pg_ddl_brand.sh
  services/ptt-crm-api/src/brand/brand.types.ts
  services/ptt-crm-api/src/brand/brand.urls.ts
  services/ptt-crm-api/src/brand/brand.urls.spec.ts
  services/ptt-crm-api/src/brand/brand.service.ts
  services/ptt-crm-api/src/brand/brand.service.spec.ts
  services/ptt-crm-api/src/brand/brand-public.controller.ts
  services/ptt-crm-api/src/brand/brand-admin.controller.ts
  services/ptt-crm-api/src/brand/brand.module.ts
  services/ops-web/src/lib/brand.ts
  services/ops-web/src/lib/brand.spec.ts
  services/ops-web/src/components/brand/BrandLogo.tsx
  services/ops-web/src/app/admin/brand/page.tsx

Modify:
  .gitignore                          (+ /data/brand/)
  services/ptt-crm-api/src/app.module.ts
  services/ops-web/src/lib/api.ts
  services/ops-web/src/components/login/LoginBrandPanel.tsx
  services/ops-web/src/app/bitrix-theme.css
  services/ops-web/src/components/OpsNav.tsx
  services/ops-web/src/app/layout.tsx
  services/ops-web/src/app/providers.tsx   (BrandProvider)
  services/ops-web/src/lib/admin/admin-nav.ts
  services/ops-web/src/lib/admin/admin-nav.spec.ts
```

---

### Task 1: Seed logo + hero + gitignore

**Files:**
- Create: `docs/brand/ptt-logo.png`
- Create: `docs/brand/login-hero.jpg`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: none
- Produces: seed files later copied to `data/brand/` by Task 3 service

- [ ] **Step 1: Download official logo**

```bash
mkdir -p docs/brand
curl -fsSL -o docs/brand/ptt-logo.png https://pttads.vn/static/images/ptt-logo.png
file docs/brand/ptt-logo.png
```

Expected: `PNG image data` ~1024×1024

- [ ] **Step 2: Create cream/sage hero JPEG**

```bash
python3 - <<'PY'
from pathlib import Path
try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pillow', '-q'])
    from PIL import Image, ImageDraw
img = Image.new('RGB', (1600, 2000), (243, 239, 230))
d = ImageDraw.Draw(img)
d.ellipse((-200, -300, 900, 800), fill=(201, 220, 196))
d.ellipse((700, 900, 1900, 2300), fill=(233, 239, 230))
Path('docs/brand/login-hero.jpg').parent.mkdir(parents=True, exist_ok=True)
img.save('docs/brand/login-hero.jpg', quality=88)
print('wrote', Path('docs/brand/login-hero.jpg').stat().st_size)
PY
```

Expected: file > 10_000 bytes

- [ ] **Step 3: Gitignore uploads**

Append to `.gitignore` if missing:

```
/data/brand/
```

Do not gitignore `docs/brand/`.

- [ ] **Step 4: Verify files exist**

```bash
test -s docs/brand/ptt-logo.png && test -s docs/brand/login-hero.jpg && echo SEED_OK
```

Expected: `SEED_OK`

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add docs/brand/ptt-logo.png docs/brand/login-hero.jpg .gitignore
git commit -m "$(cat <<'EOF'
chore(brand): seed official PTT logo and login hero

EOF
)"
```

---

### Task 2: DDL brand tables

**Files:**
- Create: `docs/specs/postgresql-ddl-brand.sql`
- Create: `scripts/apply_pg_ddl_brand.sh`

**Interfaces:**
- Consumes: none
- Produces: tables `crm_brand_settings` (`id=1`), `crm_brand_heroes`

- [ ] **Step 1: Write DDL**

```sql
CREATE TABLE IF NOT EXISTS crm_brand_heroes (
  id text PRIMARY KEY,
  filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_brand_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  logo_asset_id text NOT NULL,
  active_hero_id text NOT NULL REFERENCES crm_brand_heroes(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write apply script** (copy pattern `scripts/apply_pg_ddl_vd_sop_s1.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi
URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then echo "Set DATABASE_URL in .env" >&2; exit 1; fi
psql "$URL" -v ON_ERROR_STOP=1 -f "$ROOT/docs/specs/postgresql-ddl-brand.sql"
echo "OK  brand DDL applied"
```

`chmod +x scripts/apply_pg_ddl_brand.sh`

- [ ] **Step 3: Apply if DATABASE_URL exists**

```bash
./scripts/apply_pg_ddl_brand.sh
```

Expected: `OK  brand DDL applied` — nếu thiếu DATABASE_URL, ghi vào report và tiếp (service seed sẽ INSERT khi boot).

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu

```bash
git add docs/specs/postgresql-ddl-brand.sql scripts/apply_pg_ddl_brand.sh
git commit -m "$(cat <<'EOF'
feat(db): add crm_brand_settings and crm_brand_heroes

EOF
)"
```

---

### Task 3: Brand URL + service (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/brand/brand.types.ts`
- Create: `services/ptt-crm-api/src/brand/brand.urls.ts`
- Create: `services/ptt-crm-api/src/brand/brand.urls.spec.ts`
- Create: `services/ptt-crm-api/src/brand/brand.service.ts`
- Create: `services/ptt-crm-api/src/brand/brand.service.spec.ts`

**Interfaces:**
- Consumes: seed paths `docs/brand/ptt-logo.png`, `docs/brand/login-hero.jpg`; env `BRAND_DATA_DIR` default `<repo>/data/brand`
- Produces:

```ts
export type PublicBrandDto = {
  logo_url: string;
  hero_url: string;
  updated_at: string;
};

export function brandFileUrl(
  publicBase: string,
  kind: 'logo' | 'hero',
  filename: string,
  updatedAt: string,
): string {
  const base = publicBase.replace(/\/$/, '');
  return `${base}/api/v1/public/brand/files/${kind}/${encodeURIComponent(filename)}?v=${encodeURIComponent(updatedAt)}`;
}

export function assertImageUpload(file: { mimetype: string; size: number }, maxBytes: number): void
export function assertCanDeleteHero(activeHeroId: string, targetId: string): void
```

`BrandService` methods later tasks call:

```ts
getPublic(publicBase: string): Promise<PublicBrandDto>
readFile(kind: 'logo' | 'hero', filename: string): Promise<{ buffer: Buffer; contentType: string }>
replaceLogo(file: { buffer: Buffer; mimetype: string; size: number; originalname: string }): Promise<PublicBrandDto>
addHero(file: { buffer: Buffer; mimetype: string; size: number; originalname: string }): Promise<{ id: string }>
activateHero(id: string): Promise<PublicBrandDto>
deleteHero(id: string): Promise<void>
listHeroes(): Promise<Array<{ id: string; filename: string; url: string; active: boolean }>>
ensureSeeded(): Promise<void>
```

- [ ] **Step 1: Write failing URL tests**

```ts
import { brandFileUrl, assertCanDeleteHero, assertImageUpload } from './brand.urls';

describe('brand.urls', () => {
  it('builds cache-busted public file url', () => {
    expect(brandFileUrl('https://rs.pttads.vn', 'logo', 'logo.png', '2026-08-25T00:00:00.000Z')).toBe(
      'https://rs.pttads.vn/api/v1/public/brand/files/logo/logo.png?v=2026-08-25T00%3A00%3A00.000Z',
    );
  });

  it('rejects deleting the active hero', () => {
    expect(() => assertCanDeleteHero('h1', 'h1')).toThrow('hero_in_use');
    expect(() => assertCanDeleteHero('h1', 'h2')).not.toThrow();
  });

  it('rejects non-image or oversized files', () => {
    expect(() => assertImageUpload({ mimetype: 'application/pdf', size: 10 }, 100)).toThrow('invalid_image');
    expect(() => assertImageUpload({ mimetype: 'image/png', size: 200 }, 100)).toThrow('file_too_large');
    expect(() => assertImageUpload({ mimetype: 'image/png', size: 50 }, 100)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `cd services/ptt-crm-api && npx jest src/brand/brand.urls.spec.ts --no-coverage`

Expected: FAIL — module missing

- [ ] **Step 3: Implement urls**

```ts
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export function brandFileUrl(publicBase: string, kind: 'logo' | 'hero', filename: string, updatedAt: string): string {
  const base = publicBase.replace(/\/$/, '');
  return `${base}/api/v1/public/brand/files/${kind}/${encodeURIComponent(filename)}?v=${encodeURIComponent(updatedAt)}`;
}

export function assertImageUpload(file: { mimetype: string; size: number }, maxBytes: number): void {
  if (!ALLOWED.has(file.mimetype)) {
    const err = new Error('invalid_image');
    throw err;
  }
  if (file.size > maxBytes) {
    throw new Error('file_too_large');
  }
}

export function assertCanDeleteHero(activeHeroId: string, targetId: string): void {
  if (activeHeroId === targetId) throw new Error('hero_in_use');
}
```

- [ ] **Step 4: Run URL tests**

Expected: PASS

- [ ] **Step 5: Service tests then implementation**

Service dùng `fs` + pool/`pg` nếu có `DATABASE_URL`; trong unit test inject `store` in-memory:

```ts
export type BrandStore = {
  settings: { logo_asset_id: string; active_hero_id: string; updated_at: string };
  heroes: Map<string, { filename: string }>;
};
```

Test `assertCanDeleteHero` via `deleteHero`:

```ts
it('refuses to delete the active hero', async () => {
  const svc = BrandService.createForTest();
  await expect(svc.deleteHero(svc.snapshot().settings.active_hero_id)).rejects.toThrow('hero_in_use');
});
```

`ensureSeeded` copies seed files into `BRAND_DATA_DIR` and inserts hero `seed` + settings `id=1` if empty.

Logo max 2_000_000; hero max 8_000_000.

- [ ] **Step 6: Run service tests**

Run: `cd services/ptt-crm-api && npx jest src/brand --no-coverage`

Expected: PASS

- [ ] **Step 7: Commit** — chỉ khi user yêu cầu

```bash
git add services/ptt-crm-api/src/brand
git commit -m "$(cat <<'EOF'
feat(api): brand url helpers and in-memory service tests

EOF
)"
```

---

### Task 4: Nest controllers + module

**Files:**
- Create: `services/ptt-crm-api/src/brand/brand-public.controller.ts`
- Create: `services/ptt-crm-api/src/brand/brand-admin.controller.ts`
- Create: `services/ptt-crm-api/src/brand/brand.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` (import `BrandModule`)

**Interfaces:**
- Consumes: `BrandService` from Task 3; `StaffOrInternalKeyGuard`; `StaffCrmConfigViewGuard` / `StaffCrmConfigConfigureGuard` từ `../crm-config/guards/staff-crm-config.guard`
- Produces: routes đúng spec §4

Public:

```ts
@Controller('api/v1/public/brand')
export class BrandPublicController {
  @Get() getPublic(@Req() req: Request): Promise<PublicBrandDto>
  @Get('files/:kind/:name') streamFile(@Param() ..., @Res() res: Response)
}
```

`publicBase` = `process.env.PUBLIC_API_BASE_URL` hoặc `https://${req.get('host')}` hoặc `http://127.0.0.1:3000`.

Admin (`@UseGuards(StaffOrInternalKeyGuard)`):

```ts
@Controller('api/v1/admin/brand')
export class BrandAdminController {
  @Get() @UseGuards(StaffCrmConfigViewGuard) get()
  @Post('logo') @UseGuards(StaffCrmConfigConfigureGuard) @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2_000_000 } }))
  @Post('heroes') ... fileSize 8_000_000
  @Patch('heroes/:id') body { active: true }
  @Delete('heroes/:id')
}
```

Map `Error` codes: `hero_in_use` → 409, `invalid_image` / `file_too_large` / `file_required` → 400.

- [ ] **Step 1: Wire module + controllers** (code as above)
- [ ] **Step 2: Import BrandModule in AppModule**
- [ ] **Step 3: Run brand jest**

Run: `cd services/ptt-crm-api && npx jest src/brand --no-coverage`

Expected: PASS

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu

```bash
git add services/ptt-crm-api/src/brand services/ptt-crm-api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): public and admin brand HTTP endpoints

EOF
)"
```

---

### Task 5: Ops-web `fetchPublicBrand` + `BrandLogo` + provider

**Files:**
- Create: `services/ops-web/src/lib/brand.ts`
- Create: `services/ops-web/src/lib/brand.spec.ts`
- Create: `services/ops-web/src/components/brand/BrandLogo.tsx`
- Create: `services/ops-web/src/components/brand/BrandProvider.tsx`
- Modify: `services/ops-web/src/app/providers.tsx` (wrap `BrandProvider`)
- Modify: `services/ops-web/src/lib/api.ts` (add `fetchPublicBrand`)

**Interfaces:**
- Consumes: `GET /api/v1/public/brand` (no token)
- Produces:

```ts
export type PublicBrand = { logo_url: string; hero_url: string; updated_at: string };

export async function fetchPublicBrand(): Promise<PublicBrand>

export function BrandLogo(props: { className?: string; size?: number }): JSX.Element
export function useBrand(): PublicBrand | null
```

`BrandLogo` renders `<img src={logo_url} alt="PTT" />`. Nếu chưa load: không fallback chữ “PTT” — placeholder rỗng cùng size.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest';
import { publicBrandFromJson } from './brand';

it('parses public brand dto', () => {
  const dto = publicBrandFromJson({
    logo_url: 'https://rs.pttads.vn/api/v1/public/brand/files/logo/logo.png?v=1',
    hero_url: 'https://rs.pttads.vn/api/v1/public/brand/files/hero/h.jpg?v=1',
    updated_at: '1',
  });
  expect(dto.logo_url).toContain('/api/v1/public/brand/files/logo/');
});
```

- [ ] **Step 2: Run fail** — `cd services/ops-web && npx vitest run src/lib/brand.spec.ts`
- [ ] **Step 3: Implement parse + fetch + BrandLogo + BrandProvider**
- [ ] **Step 4: Tests pass**
- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/lib/brand.ts services/ops-web/src/lib/brand.spec.ts \
  services/ops-web/src/components/brand services/ops-web/src/app/providers.tsx services/ops-web/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(ops-web): BrandLogo reads one public logo_url

EOF
)"
```

---

### Task 6: Login hero + logo overlay

**Files:**
- Modify: `services/ops-web/src/components/login/LoginBrandPanel.tsx`
- Modify: `services/ops-web/src/app/bitrix-theme.css` (`.login-brand`)

**Interfaces:**
- Consumes: `useBrand()`, `BrandLogo`
- Produces: panel không còn slogan / lead / hex

```tsx
export function LoginBrandPanel() {
  const brand = useBrand();
  return (
    <aside
      className="login-brand"
      style={brand?.hero_url ? { backgroundImage: `url(${brand.hero_url})` } : undefined}
    >
      <div className="login-brand__veil" />
      <BrandLogo className="login-brand__logo" size={160} />
    </aside>
  );
}
```

CSS:

```css
html.ops-shell-bitrix .login-brand {
  position: relative;
  background-size: cover;
  background-position: center;
  display: grid;
  place-items: center;
  min-height: 100%;
}
html.ops-shell-bitrix .login-brand__veil {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.18);
}
html.ops-shell-bitrix .login-brand__logo {
  position: relative; z-index: 1;
  width: min(160px, 46%);
  height: auto;
}
@media (max-width: 900px) {
  html.ops-shell-bitrix .login-brand { min-height: 36vh; }
}
```

Xóa `.login-brand__mark` / `__title` / `__lead` / `__foot` rules không còn dùng.

- [ ] **Step 1: Confirm old copy present**

Run: `rg "Vào việc|17692f" services/ops-web/src/components/login/LoginBrandPanel.tsx`

Expected: matches (xóa ở bước 2)

- [ ] **Step 2: Replace panel + CSS**
- [ ] **Step 3: Confirm copy gone**

Run: `rg "Vào việc|#17692f|Tổ chức theo việc" services/ops-web/src/components/login/LoginBrandPanel.tsx`

Expected: no match

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/components/login/LoginBrandPanel.tsx services/ops-web/src/app/bitrix-theme.css
git commit -m "$(cat <<'EOF'
feat(ops-web): login brand panel is hero plus shared logo

EOF
)"
```

---

### Task 7: Sidebar + favicon dùng cùng logo

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx` (`.ops-sidebar-brand-mark`)
- Modify: `services/ops-web/src/app/bitrix-theme.css` (mark → img)
- Modify: `services/ops-web/src/app/layout.tsx` **hoặc** client `BrandFavicon` trong `BrandProvider`

**Interfaces:**
- Consumes: `BrandLogo`, `useBrand().logo_url`
- Produces: không còn `<span className="ops-sidebar-brand-mark">PTT</span>`

Sidebar:

```tsx
<span className="ops-sidebar-brand-mark">
  <BrandLogo size={32} />
</span>
```

Favicon: trong `BrandProvider`, `useEffect` set:

```ts
function setIcon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
  const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (apple) apple.href = href;
}
```

Xóa hoặc thôi dùng `/icons/icon.svg` khi đã có `logo_url`.

- [ ] **Step 1: Confirm hardcoded mark**

Run: `rg "ops-sidebar-brand-mark\">PTT" services/ops-web/src/components/OpsNav.tsx`

- [ ] **Step 2: Replace + favicon effect**
- [ ] **Step 3: Confirm no PTT square text**

Run: `rg "brand-mark\">PTT" services/ops-web/src`

Expected: no match

- [ ] **Step 4: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/components/OpsNav.tsx services/ops-web/src/app/bitrix-theme.css \
  services/ops-web/src/components/brand/BrandProvider.tsx
git commit -m "$(cat <<'EOF'
feat(ops-web): sidebar and favicon follow BrandLogo

EOF
)"
```

---

### Task 8: Admin `/admin/brand` + nav

**Files:**
- Create: `services/ops-web/src/app/admin/brand/page.tsx`
- Modify: `services/ops-web/src/lib/admin/admin-nav.ts` (`buildDataLinks` thêm `{ href: '/admin/brand', label: 'Hình ảnh & logo' }`)
- Modify: `services/ops-web/src/lib/admin/admin-nav.spec.ts`
- Modify: `services/ops-web/src/lib/api.ts` — `fetchAdminBrand`, `uploadBrandLogo`, `uploadBrandHero`, `activateBrandHero`, `deleteBrandHero`

**Interfaces:**
- Consumes: admin endpoints Task 4; `hasCap(..., 'crm_data_config', 'view'|'configure')`
- Produces: page `data-testid="admin-brand"`

API helpers dùng `crmFetch` + `FormData` (`file` field).

Page pattern: copy auth bootstrap từ `admin/crm/custom-fields/page.tsx` (`AdminPageShell`, `section="crm-config"`).

UI copy:

- Logo: “Thay logo ở đây sẽ đổi mọi logo trong hệ thống.”
- Heroes: “Dùng làm ảnh login” / xóa disabled khi `active`

- [ ] **Step 1: Failing nav test**

Trong `admin-nav.spec.ts`:

```ts
it('data group includes brand page', () => {
  const groups = buildAdminNavGroups(adminUser());
  const data = groups.find((g) => g.id === 'data');
  expect(data?.links.some((l) => l.href === '/admin/brand' && l.label === 'Hình ảnh & logo')).toBe(true);
});
```

- [ ] **Step 2: Run fail** — `cd services/ops-web && npx vitest run src/lib/admin/admin-nav.spec.ts`
- [ ] **Step 3: Add link + page + api helpers**
- [ ] **Step 4: Run pass** — cùng file + `src/lib/brand.spec.ts`
- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/app/admin/brand/page.tsx \
  services/ops-web/src/lib/admin/admin-nav.ts \
  services/ops-web/src/lib/admin/admin-nav.spec.ts \
  services/ops-web/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(ops-web): admin brand page for shared logo and login hero

EOF
)"
```

---

### Task 9: Verify

**Files:** none

- [ ] **Step 1: API tests**

```bash
cd services/ptt-crm-api && npx jest src/brand --no-coverage
```

Expected: PASS

- [ ] **Step 2: Ops-web tests**

```bash
cd services/ops-web && npx vitest run src/lib/brand.spec.ts src/lib/admin/admin-nav.spec.ts
```

Expected: PASS

- [ ] **Step 3: Overlay / copy check**

```bash
rg -n "Vào việc trong một hơi thở|#17692f|Tổ chức theo việc" services/ops-web/src/components/login
rg -n "pttads.vn/static/images/ptt-logo" services/ops-web/src services/ptt-crm-api/src
```

Expected: no runtime hotlink; login copy gone

- [ ] **Step 4: Browser** — `/login` hero+logo; sidebar cùng logo; `/admin/brand` (cần quyền). Deploy chỉ khi user bảo.

- [ ] **Step 5: Commit** — không trừ khi còn file sót

---

## Self-review

| Spec | Task |
|---|---|
| Cách 2 login | 6 |
| Seed logo, không hotlink | 1, 3 `ensureSeeded` |
| Một logo_url toàn hệ | 5–8 |
| Admin + quyền | 4, 8 |
| Không xóa hero active | 3 `assertCanDeleteHero` |
| Favicon / sidebar | 7 |
| Portal/email nếu chưa có `<img>` brand | ngoài phạm vi đúng spec Q6 |

Không TBD. Tên `PublicBrandDto` / `logo_url` / `BrandLogo` nhất quán.
