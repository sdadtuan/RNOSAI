# RNOSAI — Hướng dẫn hệ thống cho người mới

> Dành cho người chưa biết hệ thống này là gì.  
> Mô tả **bản đang chạy**, không phải bản Flask cũ.  
> Staff console: https://rs.pttads.vn  
> Cổng khách: https://portal.pttads.vn  
> Code trên VPS: `/var/www/rnosai` · repo: https://github.com/sdadtuan/RNOSAI

Đọc từ trên xuống. Phần 1–4 đủ để hiểu công ty đang dùng phần mềm này để làm gì. Phần 5 trở đi dành cho người sẽ sửa code hoặc vận hành máy chủ.

---

## 1. Hệ thống này là gì

PTT là agency quảng cáo. Công việc hằng ngày là: có người để lại số điện thoại, nhân viên gọi, tư vấn, báo giá, ký hợp đồng, rồi chạy quảng cáo, SEO, email và chăm khách.

**RNOSAI** (Revenue Operating System + AI) là phần mềm nội bộ để làm chuỗi việc đó trên một chỗ. Tên thư mục code là `RNOSAI`. Tên thư mục trên máy chủ là `/var/www/rnosai`. Nhân viên không gõ những tên này. Nhân viên mở https://rs.pttads.vn và đăng nhập.

Ba việc hệ thống phải làm đúng:

1. Không để lead (khách tiềm năng) nằm im mà không có người gọi.
2. Mỗi người chỉ thấy dữ liệu đúng quyền của mình.
3. Khi đã chốt, công việc chuyển sang triển khai dịch vụ, quảng cáo, SEO, email, KPI và báo cáo.

---

## 2. Ba cửa vào

| Cửa | Địa chỉ | Ai dùng | Chương trình phía sau |
| --- | --- | --- | --- |
| Nhân viên | https://rs.pttads.vn | Sale, CSKH, marketing, kế toán, HR, admin | Giao diện `ops-web` cổng nội bộ `3200` |
| Khách hàng | https://portal.pttads.vn | Khách của PTT xem số liệu, duyệt nội dung | Giao diện `portal-web` cổng nội bộ `3100` |
| Địa chỉ cũ | https://ops.pttads.vn | Bookmark cũ của nhân viên | Nginx chuyển sang `rs.pttads.vn` |

Người ngoài internet chỉ thấy cổng **80** và **443** (Nginx). Các cổng `3000`, `3100`, `3200`, `5433` không mở ra internet. Muốn gọi API thì đi qua `https://rs.pttads.vn/api/...`.

Một lần bấm trên màn hình đi như sau:

```text
Trình duyệt
    → Nginx (HTTPS)
        → trang nhân viên: ops-web :3200
        → dữ liệu /api/ : Nest API :3000
            → PostgreSQL :5433, database rnosaidb
```

Webhook từ Facebook, Zalo, Google, email cũng vào cùng API:

```text
POST https://rs.pttads.vn/api/v1/webhooks/{meta|zalo|google|email}
```

Kiểm tra API còn sống:

```bash
curl -sf https://rs.pttads.vn/health
```

Kết quả đúng có `"ok": true` và `"service": "ptt-crm-api"`.

---

## 3. Các chương trình đang chạy

Tất cả nằm trên một VPS Ubuntu, thư mục `/var/www/rnosai`. File thuộc user `deploy`, nhóm `www-data`.

### Luôn chạy (systemd)

| Tên dịch vụ | Cổng | Việc nó làm |
| --- | --- | --- |
| `ptt-crm-api` | 3000 | API. Đăng nhập, lead, quyền, webhook, gần như mọi dữ liệu |
| `ptt-ops-web` | 3200 | Màn hình nhân viên. Next.js, thư mục làm việc `/var/www/rnosai/current/ops-web` |
| `ptt-portal-web` | 3100 | Màn hình khách hàng |
| `ptt-worker` | không có cổng | Hàng đợi việc nền: nhận lead, job email |
| `ptt-fb-autosync` | không có cổng | Đồng bộ lead Facebook |
| `ptt-temporal-worker` | không có cổng | Workflow dài (Temporal) |

`ptt.service` (Flask, cổng 8002) **đã tắt**. Đừng bật lại. Tài liệu nào còn nói Flask, SQLite, cổng 5050 hoặc 8002 là tài liệu cũ.

### Trong Docker

| Thành phần | Cổng trên máy | Việc |
| --- | --- | --- |
| PostgreSQL 15 | 127.0.0.1:5433 | Database chính, tên `rnosaidb`, user `ptt` |
| Redis 7 | nội bộ | Cache, hàng đợi ngắn |
| RabbitMQ | nội bộ | Hàng đợi |
| Temporal | 127.0.0.1:7233 | Workflow. Giao diện admin chỉ mở bằng SSH tunnel, không public |
| ClickHouse | 127.0.0.1:8123 | Kho số liệu cho báo cáo. Không phải database nghiệp vụ |

Database nghiệp vụ là PostgreSQL. File `ptt.db` (SQLite) là dấu vết cũ, không còn là nguồn sự thật.

---

## 4. Một lead đi qua hệ thống như thế nào

Đây là luồng người mới cần thuộc trước khi đụng module khác.

**Lead** là một người hoặc một công ty chưa phải khách. Bản ghi nằm ở bảng `crm_leads`. Lead vào từ quảng cáo Facebook, Zalo, form web, API, hoặc nhân viên nhập tay.

### Ai nhận lead

Nếu bật chia tự động, hệ thống gán một người phụ trách:

1. Ưu tiên người được chỉ định, nếu người đó đang làm việc, đang bật **Nhận lead**, và chưa bấm **Tạm dừng** trên sổ đội.
2. Không có người chỉ định thì chia vòng những nhân viên đang hoạt động, đúng ngành/dịch vụ, đang bật Nhận lead, chưa tạm dừng.
3. Hết người thì lead vào **Phải tra soát**, người phụ trách để trống.

Công tắc **Nhận lead** nằm trên hồ sơ nhân viên. Công tắc **Tạm dừng** nằm trên sổ đội (`/crm/b2b/team`). Tạm dừng chỉ ngăn lead mới. Lead đang cầm không tự rút đi.

### Hai bảng trạng thái

| Luồng | Khi nào | Các cột chính |
| --- | --- | --- |
| Bán hàng | Lead chưa gắn khách đang chạy dịch vụ | Mới → Đã liên hệ → Đang tư vấn → Báo giá → Đàm phán → Proposal → Chốt, hoặc Thất bại / Chăm sóc lại |
| Chăm sóc vận hành | Lead gắn khách đang chạy dịch vụ | Mới → Đã liên hệ → Đang tư vấn → Hẹn gặp → Chốt, hoặc Thất bại / Chờ dọn |

Kéo thẻ sang **Chốt** bị khóa cho đến khi xong bước B2 và đã có hoạt động liên hệ (gọi, tin nhắn, thư hoặc họp).

### B2 là gì

B2 là **Liên hệ lần đầu**. Xong khi đủ cả ba:

1. Có báo cáo chăm sóc kết quả **Liên hệ OK**.
2. Có ghi chú hoàn thành bước, ít nhất 3 ký tự.
3. Lead không nằm trong hàng **Phải tra soát**.

Gọi nhỡ, máy bận, hẹn gọi lại **không** phải Liên hệ OK. B2 vẫn mở.

Xong B2 thì hệ thống mở tư vấn trước bán. Dịch vụ mặc định nếu người dùng không chọn là SEO tổng thể. Sau đó mới tới báo giá, hợp đồng, bàn giao triển khai.

### Bốn đồng hồ chạy cùng lúc

Một lead chưa xong B2 bị bốn đồng hồ nhìn cùng lúc. Chúng không thay nhau.

| Đồng hồ | Hạn | Quá hạn thì sao |
| --- | --- | --- |
| Thẻ trên bảng | 15 phút, khung 08:00–21:00, cả tuần | Thẻ nổi trễ. Sổ đội đếm lead trễ |
| Cuộc gọi đầu | 2 giờ, giờ hành chính thứ Hai–thứ Sáu | Ghi đã trễ. Gọi không nghe máy vẫn tính là đã gọi |
| B2, Liên hệ OK | 24 giờ kể từ lúc gán cho người đang giữ | Gỡ người phụ trách, đưa vào Phải tra soát |
| Sự cố phản hồi đầu | Thêm 10 phút sau hạn, chưa Liên hệ OK, chưa ghi Đã nói chuyện | Worker chuyển cho nhân viên khác đang nhận lead. Hết người thì vào Phải tra soát |

Giờ làm việc dùng cho chuỗi giữ lead: thứ Hai–thứ Sáu, 09:00–18:00. Hai lần gọi cách nhau ít nhất 2 giờ làm việc.

Giám đốc kinh doanh gán lại lead trong hàng Phải tra soát (`/crm/leads/review-queue`) cho người đang bật Nhận lead và chưa Tạm dừng.

Chi tiết từng kết quả cuộc gọi: [`docs/crm/chu-trinh-quan-ly-lead.md`](crm/chu-trinh-quan-ly-lead.md).

### Sau khi có người nói chuyện được

```text
Lead
  → B2 xong (Liên hệ OK)
    → Tư vấn trước bán
      → Báo giá
        → Hợp đồng (Hub hợp đồng)
          → Dự án / triển khai dịch vụ
            → Quảng cáo, SEO, email, KPI, báo cáo cho khách
```

**Solution** là hàng đợi bàn giao từ sale sang đội làm giải pháp (`/crm/solution/queue`). Sale có quyền hẹp thì chỉ thấy mục **Theo dõi Solution**.

---

## 5. Menu nhân viên thấy gì

Menu bên trái không cố định. Mỗi mục chỉ hiện khi tài khoản có quyền (capability) tương ứng. Hai người đăng nhập cùng địa chỉ có thể thấy hai menu khác nhau.

Nhóm menu, theo thứ tự trong code `services/ops-web/src/components/ops-nav-tree.ts`:

| Nhóm | Việc của nhóm | Màn hình đáng nhớ |
| --- | --- | --- |
| Tổng quan | Trang đầu sau đăng nhập | `/` |
| Bán hàng | Lead mới, đội sale, báo giá, hợp đồng | Lead B2B `/crm/b2b/leads`, Đội AE `/crm/b2b/team`, Hiệu suất AE `/crm/b2b/team/hieu-suat`, Báo giá `/crm/proposals`, Hub hợp đồng `/crm/hub` |
| CRM | Chăm khách đã có, hàng tra soát, toàn bộ lead | Tất cả leads `/crm/leads`, Phải tra soát `/crm/leads/review-queue`, Khách hàng `/crm/customers`, Bảng CSKH `/crm` |
| Service Desk | Ticket và chat nội bộ | `/crm/csd` |
| Account Management | Chăm khách sau khi đã ký | `/crm/account-management` |
| Agency | Việc vận hành agency, ingest, KPI định nghĩa | `/agency` |
| Quảng cáo | Meta, Google, Zalo | `/meta/facebook-ads`, `/google/google-ads`, `/zalo/zalo-ads` |
| SEO / AEO | Nghiên cứu, nội dung, technical, báo cáo SEO | `/seo/hub` |
| Email Marketing | Chiến dịch, liên hệ, hành trình thư | `/email/hub` |
| Sản xuất | Làm nội dung, creative, SOP, bàn giao dịch vụ | `/crm/service-delivery`, `/crm/sop` |
| Kế hoạch | Nghiên cứu thị trường, kế hoạch marketing | `/crm/research`, `/crm/marketing-plan` |
| KPI Hub | Chỉ số điều hành, marketing, sales | `/crm/kpi-hub` |
| Nhân sự | Nhân viên, chấm công, lương, KPI cá nhân | `/crm/hr`, `/crm/staff`, `/crm/payroll` |
| Tài chính | Dashboard, forecast, hóa đơn | `/crm/business-dashboard`, `/crm/invoices` |
| CEO | Bảng chỉ huy | `/crm/ceo` |
| Báo cáo nội bộ | Báo cáo công việc trong công ty | `/crm/internal-reports` |
| Tự động hóa | Workflow, playbook | `/crm/automation`, `/crm/playbooks` |
| Admin | Cấu hình, quyền, AI | Chỉ admin |

Cổng khách (`portal.pttads.vn`) là một ứng dụng khác. Khách đăng nhập để xem hiệu quả, duyệt creative, đọc SEO hoặc email ở chế độ chỉ xem. Khách không vào được menu nhân viên.

---

## 6. Quyền hạn

Đăng nhập nhân viên không chỉ là “có tài khoản”. Mỗi tài khoản có một tập **capability**, dạng `tên_module` + `hành động`.

Ví dụ:

- `crm_leads` + `view` → thấy danh sách lead.
- `crm_leads` + `edit` → sửa lead, thấy nút tạo lead.
- `crm_leads` + `assign` → gán người phụ trách, thấy hàng Phải tra soát.
- `crm_gdkd` + `view_all_leads` → giám đốc kinh doanh thấy lead ngoài phạm vi của mình.

Không có quyền thì mục menu biến mất. API cũng kiểm tra lại. Giấu nút trên giao diện không đủ, vì người ta vẫn gọi được URL.

Chế độ đăng nhập đang chạy trên production là `staff_auth_mode: dual`: vừa tài khoản nội bộ, vừa SSO (Keycloak) khi đã cấu hình. Policy OPA đang bật (`staff_policy_opa: true`). Đổi quyền mà màn hình không đổi thì kiểm tra cả capability trên user lẫn bundle policy.

Tài liệu gán quyền: [`docs/PHAN_QUYEN_HUONG_DAN.md`](PHAN_QUYEN_HUONG_DAN.md).

---

## 7. Bản đồ thư mục code

Chỉ cần thuộc những thư mục này. Phần còn lại là script deploy theo từng đợt, tài liệu cũ, hoặc bản build.

```text
/var/www/rnosai
  services/ptt-crm-api     API NestJS (TypeScript). Não của hệ thống
  services/ops-web         Màn hình nhân viên (Next.js)
  services/portal-web      Màn hình khách (Next.js)
  services/mobile-shell    Vỏ app điện thoại (Capacitor), không phải trang web chính
  current/ops-web          Bản ops-web đang được systemd chạy (symlink tới releases/)
  releases/ops-web-*       Các bản build ops-web đã phát hành. Giữ vài bản để lùi
  deploy/                  Mẫu nginx, systemd, file env mẫu. Không chứa mật khẩu thật
  scripts/                 Lệnh cài, migrate, deploy
  docs/                    Tài liệu. Đọc file này trước
  .env                     Mật khẩu và cấu hình thật. chmod 600. Không commit
  .venv                    Python cho worker
```

API khởi động bằng `node dist/main.js` trong `services/ptt-crm-api`. Sửa file `.ts` mà không `npm run build` thì máy chủ vẫn chạy bản cũ trong `dist/`.

ops-web không chạy thẳng từ source. Quy trình là: build ra `.next/standalone`, copy thành một thư mục trong `releases/`, trỏ `current/ops-web` vào đó, rồi restart `ptt-ops-web`.

Worker Python nằm rải ở các thư mục `ptt_worker`, `ptt_jobs`, `ptt_meta`, `ptt_email`, `ptt_seo`. Chúng đọc cùng database, không vẽ màn hình.

---

## 8. Dữ liệu

| Thứ | Ở đâu | Ghi chú |
| --- | --- | --- |
| Lead, khách, nhân viên, quyền, hóa đơn | PostgreSQL `rnosaidb` trên `127.0.0.1:5433` | Nguồn sự thật |
| File khách upload (báo giá, ảnh, PDF) | `services/ptt-crm-api/data/` | Không nằm trong git. Đừng xóa khi deploy |
| Cấu hình bí mật | `/var/www/rnosai/.env` | Database URL, token quảng cáo, khóa JWT |
| Bản build giao diện đang chạy | `/var/www/rnosai/current/ops-web` | Symlink |
| Backup database | `/var/backups/rnosai/` | File `rnosaidb-*.dump` |

Đổi code không được đụng `.env`, thư mục `data/`, và database, trừ khi đợt phát hành có file SQL mới trong `deploy/sql/` hoặc `scripts/apply_pg_ddl_*.sh`. DDL chỉ chạy tới, không có nút undo. Muốn lùi dữ liệu thì restore file dump.

---

## 9. Máy chủ và cách phát hành một bản mới

Production là một VPS. Code đã có sẵn tại `/var/www/rnosai`, nhánh `main`.

Một lần cập nhật bình thường:

1. Backup database (`scripts/backup_ptt_data.sh`, cần `DATABASE_URL` trong `.env`).
2. `git pull --ff-only origin main` bằng user `deploy`.
3. Trong `services/ptt-crm-api`: `npm run build`, rồi `systemctl restart ptt-crm-api`.
4. Trong `services/ops-web`: `npm run build` với `NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn`, phát hành vào `releases/`, trỏ `current/ops-web`, rồi `systemctl restart ptt-ops-web`.
5. Chỉ build `portal-web` khi commit đợt đó sửa cổng khách.

Máy hiện tại khoảng **3,3 GB RAM**. Build Next.js dễ bị hệ điều hành ngắt nếu không có swap. Đã có thêm file swap `/swapfile-build` (4 GB) bên cạnh swap gốc. Build xong mới restart giao diện. API có thể restart trước, vì trang cũ vẫn gọi được API mới.

Kiểm tra sau khi phát hành:

```bash
systemctl is-active ptt-crm-api ptt-ops-web ptt-portal-web
curl -sf http://127.0.0.1:3000/health
curl -sk -o /dev/null -w "%{http_code}\n" https://rs.pttads.vn/login
```

`/login` phải là `200`. Trang chủ `/` trả `307` là đúng: chưa đăng nhập thì bị chuyển sang trang login.

Runbook đầy đủ, gồm nginx và timer: [`docs/runbooks/rnosai-vps-operations-guide.md`](runbooks/rnosai-vps-operations-guide.md).

---

## 10. Tuần đầu của người mới

Làm theo thứ tự này. Chưa xong bước trước thì chưa mở module SEO hay KPI.

1. Đăng nhập https://rs.pttads.vn/login bằng tài khoản được cấp. Nhìn menu của chính mình. Menu thiếu mục không có nghĩa là hệ thống hỏng. Đó là do quyền.
2. Mở **Lead B2B** (`/crm/b2b/leads`). Bấm một thẻ. Đọc trạng thái, người phụ trách, lịch sử cuộc gọi.
3. Đọc mục 4 của file này, rồi đối chiếu một lead thật với bốn đồng hồ.
4. Mở **Đội AE** nếu tài khoản là trưởng nhóm. Xem ai đang bật Nhận lead, ai đang Tạm dừng.
5. Mở **Phải tra soát** nếu là giám đốc kinh doanh. Đó là lead bị gỡ người giữ vì quá 24 giờ chưa Liên hệ OK.
6. Mở một khách đã chốt trong **Khách hàng**, rồi xem dự án hoặc hợp đồng liên quan nếu có quyền.
7. Với người làm kỹ thuật: SSH vào VPS, `cd /var/www/rnosai`, xem `git log -1`, `systemctl is-active ptt-crm-api ptt-ops-web`, và `curl` health. Chưa sửa `.env`.

---

## 11. Việc không được làm khi chưa hỏi

- Bật lại `ptt.service` (Flask).
- Xóa `services/ptt-crm-api/data/` hoặc database.
- Commit file `.env`.
- `git reset --hard` trên VPS. Thư mục làm việc có file build và file khách. Lệnh này xóa nhầm dữ liệu đang chạy.
- Mở cổng 3000, 3100, 3200, 5433 ra internet.
- Sửa quyền production để “test cho nhanh” trên tài khoản nhân viên thật.

---

## 12. Tài liệu đọc tiếp

Đọc khi đã thuộc mục 1–4. Nhiều file trong `docs/` mô tả đợt làm việc cũ hoặc Flask. Ưu tiên các file dưới đây.

| Khi cần | File |
| --- | --- |
| Chu trình lead, B2, đồng hồ | [`docs/crm/chu-trinh-quan-ly-lead.md`](crm/chu-trinh-quan-ly-lead.md) |
| Danh sách màn hình và use case | [`docs/specs/RNOSAI-BA-Master-Spec.md`](specs/RNOSAI-BA-Master-Spec.md) |
| Vận hành VPS, backup, nginx, timer | [`docs/runbooks/rnosai-vps-operations-guide.md`](runbooks/rnosai-vps-operations-guide.md) |
| Cài máy mới từ đầu | [`docs/runbooks/vps-full-system-deploy.md`](runbooks/vps-full-system-deploy.md) |
| Gán quyền | [`docs/PHAN_QUYEN_HUONG_DAN.md`](PHAN_QUYEN_HUONG_DAN.md) |
| Hướng dẫn dùng từng màn (bản nghiệp vụ) | [`docs/HUONG_DAN_SU_DUNG_PTT.md`](HUONG_DAN_SU_DUNG_PTT.md) |

[`docs/HE_THONG_PTT.md`](HE_THONG_PTT.md) và phần đầu [`README.md`](../README.md) vẫn mô tả Flask. Đừng dùng hai file đó để hình dung máy chủ hiện tại.

---

## 13. Thuật ngữ

| Từ | Nghĩa |
| --- | --- |
| Lead | Khách tiềm năng, chưa ký |
| AE | Nhân viên kinh doanh nhận lead |
| GDKD | Giám đốc kinh doanh |
| AM | Account manager, người giữ khách sau khi ký |
| B2 | Bước liên hệ lần đầu. Xong khi có Liên hệ OK |
| Liên hệ OK | Đã nói chuyện được với khách, ghi trong báo cáo chăm sóc |
| Phải tra soát | Hàng lead bị gỡ người phụ trách vì quá hạn hoặc không còn ai nhận |
| Solution | Hàng đợi bàn giao từ sale sang đội làm giải pháp |
| Capability | Một quyền cụ thể, ví dụ xem lead hoặc gán lead |
| ops-web | Ứng dụng Next.js cho nhân viên |
| portal-web | Ứng dụng Next.js cho khách |
| ptt-crm-api | API NestJS, cổng 3000 |
| rnosaidb | Database PostgreSQL chính |
| Release | Một bản build ops-web đã copy ra `releases/` và đang được symlink trỏ tới |
