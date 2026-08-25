# Design: Brand logo chung + login hero

**Ngày:** 2026-08-25  
**Trạng thái:** Chờ duyệt  
**Module:** ops-web + ptt-crm-api (public brand)  
**Quyết định sản phẩm:** Một logo PTT do admin thay ở `/admin/brand`. **Mọi logo trong hệ thống đổi theo** — không còn mark chữ “PTT” cứng, không file logo thứ hai.

---

## 1. Vấn đề

Cột trái `/login` đang trống: ô chữ “PTT”, slogan, đoạn lead, dòng `#17692f`. Sidebar và favicon cũng dùng mark cứng (`ops-sidebar-brand-mark`, `public/icons/icon.svg`), không phải logo chính thức `https://pttads.vn/static/images/ptt-logo.png`.

Đổi nhận diện phải sửa nhiều chỗ. Admin không có chỗ upload logo / ảnh login.

---

## 2. Quyết định đã khóa

| # | Quyết định | Chọn |
|---|------------|------|
| Q1 | Login cột trái | **Cách 2** — ảnh hero cover + logo đè; bỏ hết slogan / lead / hex |
| Q2 | Logo | File chính thức pttads.vn, seed một lần vào server; **không hotlink** sau seed |
| Q3 | Phạm vi logo | **Toàn hệ thống** — một `logo_url`; thay ở admin thì mọi `<img>` brand đổi |
| Q4 | Admin | `/admin/brand` — logo (1 file) + thư viện ảnh chọn 1 hero login |
| Q5 | Quyền | Xem/sửa: `crm_data_config` `view` / `configure` |
| Q6 | Portal / email / PDF | Cùng `logo_url` public nếu bề mặt đó có **logo hình**. Không đổi copy chữ “PTT” |

---

## 3. Luật một logo

1. **Một nguồn.** Bảng brand giữ đúng một `logo_asset_id` đang dùng. Public API trả một `logo_url`.
2. **Một component.** Ops-web chỉ render logo qua `BrandLogo` (đọc `logo_url`). Cấm ô chữ “PTT” xanh, cấm SVG `icon.svg` chữ PTT CRM, cấm URL pttads.vn cứng trong JSX.
3. **Thay một lần, hiện mọi nơi.** Upload logo mới → cập nhật `logo_asset_id` → mọi `BrandLogo`, favicon/apple-touch, và portal (nếu có `<img>` brand) dùng URL mới (cache-bust `?v=` theo `updated_at`).
4. **Hero không phải logo.** Ảnh login chỉ cột trái `/login`. Đổi hero không đổi sidebar/favicon.

### Bề mặt bắt buộc dùng `logo_url`

| Bề mặt | File hiện tại | Hành vi mới |
|---|---|---|
| Login overlay | `LoginBrandPanel.tsx` ô chữ PTT | Hero + `BrandLogo` giữa |
| Sidebar expanded + rail | `OpsNav.tsx` `.ops-sidebar-brand-mark` | `BrandLogo` |
| Favicon / apple-touch | `layout.tsx` → `/icons/icon.svg` | Cùng `logo_url` (link động hoặc rewrite) |
| Admin preview | `/admin/brand` | Cùng `BrandLogo` |

Mọi chỗ logo hình **mới** sau này phải dùng `BrandLogo` / `logo_url`. Copy “PTT CRM”, “PTT Ops” trên form/title **không** là logo — giữ chữ.

---

## 4. Kiến trúc

```
Admin /admin/brand
  POST /api/v1/admin/brand/logo          (multipart, configure)
  POST /api/v1/admin/brand/heroes        (multipart, configure)
  PATCH /api/v1/admin/brand/heroes/:id   { active: true }
  DELETE /api/v1/admin/brand/heroes/:id  (không xóa hero đang active)

Public (không auth)
  GET /api/v1/public/brand
    { logo_url, hero_url, updated_at }

Files
  data/brand/logo.<ext>
  data/brand/heroes/<id>.<ext>
  Serve: GET /api/v1/public/brand/files/:kind/:name
```

Seed lúc migrate/boot nếu chưa có logo: copy `docs/brand/ptt-logo.png` (file lấy từ `https://pttads.vn/static/images/ptt-logo.png`, 1024×1024, commit vào repo một lần). Hero seed: một ảnh cream/sage trong `docs/brand/login-hero.jpg`.

Không phụ thuộc pttads.vn lúc runtime.

---

## 5. Login (cách 2)

`LoginBrandPanel`:

- Nền: `hero_url` `background-size: cover; center`
- Overlay tối nhẹ (rgba 0,0,0,0.18) để logo đọc được
- `BrandLogo` giữa, max-width ~160px, `alt="PTT"`
- Không slogan, không lead, không `#17692f`
- Form phải: không đổi (badge “PTT CRM”, email/mật khẩu, CTA `#17692f`)
- Mobile: hero + logo phía trên form, chiều cao ~36vh

---

## 6. Admin `/admin/brand`

Nhãn menu: **Hình ảnh & logo**. Nhóm Quản trị, cạnh cấu hình CRM.

Hai khối:

1. **Logo hệ thống** — preview `BrandLogo`, upload PNG/SVG/WebP/JPEG, tối đa 2MB. Ghi chú: “Thay logo ở đây sẽ đổi mọi logo trong hệ thống.”
2. **Ảnh đăng nhập** — lưới thumbnail, nút “Dùng làm ảnh login”, xóa (disabled nếu đang active), upload nhiều.

Preview nhỏ (tỷ lệ cột login) dưới cùng.

---

## 7. Lưu trữ & API

Bảng `crm_brand_settings` (một dòng `id = 1`):

- `logo_asset_id` text not null  
- `active_hero_id` text not null  
- `updated_at` timestamptz  

Bảng `crm_brand_heroes`: `id`, `filename`, `created_at`.

File trên disk dưới `data/brand/` (gitignore nội dung upload; seed files trong `docs/brand/`).

Giới hạn: image/*, 2MB logo, 8MB hero.

---

## 8. Kiểm thử

- Public brand trả `logo_url` + `hero_url` không auth  
- Upload logo → GET public `updated_at` tăng, `logo_url` đổi  
- Sidebar + login overlay + favicon cùng path logo  
- Không xóa được hero đang active  
- Không `configure` → 403  
- Login không còn text slogan / hex  

---

## 9. Ngoài phạm vi

- Không đổi form login, không đổi màu CTA `#17692f`  
- Không DAM / CDN  
- Không đổi icon nét sidebar  
- Không vẽ lại PDF/email HTML trừ khi đã có `<img>` brand (thì trỏ `logo_url`)  

---

## 10. Tiêu chí xong

1. `/login` cột trái = hero + logo, không chữ kỹ thuật  
2. Sidebar / favicon dùng cùng `logo_url`  
3. Admin thay logo → refresh mọi bề mặt trên thấy logo mới  
4. Runtime không gọi pttads.vn  
