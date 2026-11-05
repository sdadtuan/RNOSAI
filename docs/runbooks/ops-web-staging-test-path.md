# Staging CRM UI — `https://rs.pttads.vn/test`

Môi trường chỉnh sửa **ops-web** tách khỏi production (`/`). User prod vẫn dùng CRM bình thường.

## URL

- Staging: **https://rs.pttads.vn/test/crm/leads**
- Production: **https://rs.pttads.vn/crm/leads**

## Kiến trúc

| Thành phần | Production | Staging `/test` |
|------------|------------|-----------------|
| ops-web | `:3200` → `current/ops-web` | `:3201` → `current/ops-web-staging` |
| Nest API | `:3000` (chung) | **Cùng API prod** — dữ liệu thật, cẩn thận khi ghi |
| nginx | `location /` | `location /test` → `:3201` |

Build staging bật `NEXT_PUBLIC_BASE_PATH=/test` (Next `basePath`).

## Deploy staging (VPS)

```bash
cd /var/www/rnosai
git pull   # hoặc scp source
./scripts/deploy_ops_web_staging.sh --all   # build + restart ptt-ops-web-staging only
sudo ./scripts/apply_nginx_rs_vps_ssl.sh    # nếu vừa cập nhật deploy/nginx-rs-flask-retired.conf
```

## Deploy staging (Windows → VPS)

```powershell
.\scripts\deploy_ops_web_from_windows.ps1 -Staging
```

## Promote lên production

Sau khi test xong trên `/test`:

```bash
# VPS: build prod (không set BASE_PATH)
./scripts/deploy_ops_web.sh --all
```

Hoặc Windows (không `-Staging`):

```powershell
.\scripts\deploy_ops_web_from_windows.ps1
```

**Không** đổi symlink `current/ops-web` khi chỉ deploy staging.
