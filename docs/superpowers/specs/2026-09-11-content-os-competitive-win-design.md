# Software Requirements Specification

# Content Marketing OS — Competitive Win (CMKT-WIN)

| Thuộc tính | Giá trị |
|---|---|
| Tên | PTT Content Marketing OS — thắng đối thủ trên thao tác thật |
| Mã tài liệu | SPEC-CMKT-WIN-2026-09-11 |
| Phiên bản | **1.1 — mockup WIN + UI thắng đủ** |
| Cha | [`2026-09-10-content-os-agency-enterprise-design.md`](./2026-09-10-content-os-agency-enterprise-design.md) · **SPEC-CMKT-E v3.1** (không thu hồi) |
| UI vận hành | [`../mocks/2026-09-11-content-os-competitive-win.html`](../mocks/2026-09-11-content-os-competitive-win.html) — **contract E4+**; chrome/IA 8 mục kế thừa mockup v2 |
| UI kế thừa | [`../mocks/2026-09-10-content-os-agency-enterprise.html`](../mocks/2026-09-10-content-os-agency-enterprise.html) — token, sidebar, 8 tab, Request/Approval (không thu hồi) |
| Pilot | `tiep-thi-noi-dung` → một Facebook Page thật, một collection DAM thật |
| Persist HTML | `localStorage` key `cmkte-ops-v4-win` (tách `cmkte-ops-v3`) |
| Trạng thái | Draft — **plan E4** [`../plans/2026-09-11-content-os-competitive-win.md`](../plans/2026-09-11-content-os-competitive-win.md) · **chưa code** |

**Tuyên bố kế thừa:** Mọi khóa v3.1 vẫn đúng. Tài liệu này **không** mở pixel editor, payroll, mua ads, listening đầy đủ, Video AI (`CP_AI_ENABLED`), DAM/CMS thay khách, seed Sunlight/Nova/Tâm An, CTA “Gọi ngay”.

---

## 1. Vì sao phải viết tiếp

E0–E3 đã ship **hệ điều hành**: Request, 8-tab workspace, Publish Gate, rights, approval, capacity/SLA, insight/glossary **Approved** → Copilot, AI Trace, audit export, connector **framework tắt**.

Nhân viên làm việc thật được. **Chưa thắng** công cụ đối thủ trên hai việc họ làm mỗi ngày sau khi copy xong:

1. **Đưa bài lên kênh** — Meta Business Suite / Hootsuite / Sprout đăng được; CMKT chỉ **Mark published** (ghi URL sau khi người đăng ngoài).
2. **Lấy đúng file + quyền** — Drive/Bynder/Brandfolder có kho; CMKT “Chọn từ DAM” là stub `dam_not_configured`.
3. **Giữ ngôn ngữ brand** — glossary E3 không có màn tạo term; Copilot/highlight chết nếu không SQL.

Thắng = nhân viên **không rời COS** để đăng Page + chọn asset có rights, vẫn bị **cổng người** (BR-CMKT-01, BR-AI-01).

Không thắng = nhiều nút lịch, nhiều MXH, listening, bidding. Đó là sân của đối thủ media, không phải sân agency PTT.

---

## 2. Ba hướng — chọn một

| | A — Agency-native close (khuyến nghị) | B — Clone scheduler | C — DAM-first |
|---|---|---|---|
| Làm | 1 kênh Facebook Page + human confirm; 1 DAM adapter HTTP; glossary CRUD; legal hold UI | N lịch / N MXH / inbox comment | Kho file PTT, version, CDN |
| Thắng ai | Agency dùng Drive+chat+Meta thủ công; SoW “có cổng + audit” | Hootsuite/Sprout trên số kênh | Bynder trên dung lượng |
| Rủi ro | Graph token + app review | Phá BR-CMKT-01, scope nổ, secrets | Làm DAM = sản phẩm khác |
| Thời gian | 1 wave (E4) | 3+ wave, lệch mục tiêu | 2+ wave, lệch v3.1 |

**Chốt v1.0: hướng A.** E5/E6 mới thêm kênh / adapter thứ hai. IG, TikTok, Zalo OA, CMS WordPress, SCIM **không** vào E4.

---

## 3. Hiện trạng E3 (số thật — không bịa)

| Bề mặt | Prod `a3a26688` | Đối thủ làm gì |
|---|---|---|
| `PublishConnector.publish` | Luôn `NotEnabledError` | Gọi Graph / IG / LinkedIn |
| `direct_social_publish` | Persist, mặc định **false** | Thường bật sau OAuth |
| `cmkt_connectors` | Có cột token, **không** OAuth, `status` default `off` | OAuth + refresh |
| Channel health | `Manual` trừ row `status=on` | Token live / expiry |
| `GET …/dam` | Stub empty + mã lỗi | List collection |
| Glossary | List + approve; **không** POST create | Term memory trong editor |
| `legal_hold` | Cột + chặn DELETE nội bộ; **không** route xóa cho writer; **không** toggle UI | Hold trên asset/item |
| Mark published | Đường publish **duy nhất** sống | Song song scheduler |
| Command Center | Số query | Thường seed demo |

---

## 4. Mục tiêu thắng (business)

| ID | Mục tiêu | Chỉ số cửa E4 | Không đo |
|---|---|---|---|
| BG-WIN-01 | Copywriter/Social đăng Page **trong COS** | ≥ 1 publication `post_id` thật trên Page pilot, sau human confirm | Số page không phải pilot |
| BG-WIN-02 | Không rời tab Assets để lấy file approved | ≥ 1 item gắn asset từ DAM list (ref URL + rights snapshot) | Số file host trên PTT |
| BG-WIN-03 | Glossary do Lead tạo, Copilot dùng | ≥ 1 term tạo trên UI, Approved, xuất hiện highlight + prompt | Số locale |
| BG-WIN-04 | Zero AI-publish | 0 job AI gọi `connector.publish` | — |
| BG-WIN-05 | Zero token trên browser | 0 field `access_token` / `refresh_token` trong JSON portfolio | — |
| BG-WIN-06 | Mark published **vẫn** chạy khi connector off | UAT tắt flag → đăng tay + URL như E0 | Bắt buộc bật connector |

BG-01…08 của v3.1 **giữ**.

---

## 5. Ngoài phạm vi (cố định — E4 và mọi wave WIN)

- Pixel editor; payroll creator; **mua ads / bidding**; social listening đầy đủ.
- Auto-post khi **chưa** human confirm; auto-post khi gate **Blocked**.
- Tự host DAM đầy đủ; thay CMS khách; sync hai chiều xóa file khách.
- Instagram, TikTok, YouTube, Zalo, LinkedIn, Threads trong E4.
- IdP / SCIM mới (giữ hook E3).
- Bật `CP_AI_ENABLED`; đổi `QC_CHECK_KEYS`; Video AI trong COS.
- Invent client AM 360 / CPL; seed Sunlight / Nova / Tâm An lên prod.
- CTA **Gọi ngay**. CTA vận hành: **Đăng ký / Tìm hiểu thêm / Đăng ký nhận tư vấn**.
- Hard-delete item cho `crm_content.write` (đã cấm ở E3 review). Super Admin delete = E5+.
- `ensurePgReady` rewrite toàn cục (ngoài scope; endpoint mới fail-closed riêng).

---

## 6. Wave E4 — Battlefield (một sản phẩm, bốn epic)

Thứ tự bắt buộc: **P → C → D → G → H** (token/account trước DAM; glossary/hold không chặn publish).

### 6.1. Epic E4-P — Facebook Page publish + human confirm

**Đối tượng:** một `cmkt_channel_accounts` `channel='facebook_page'` gắn lifecycle pilot + một `cmkt_connectors` `status='on'` sau OAuth.

**Luồng**

1. Admin bật `direct_social_publish` (Settings — đã có PATCH).
2. Admin **Connect Page** (Settings hoặc Publication): redirect OAuth **server-side**; callback chỉ nhận `code`; đổi token trên server; ghi `access_token` / `refresh_token` / `expires_at` vào `cmkt_connectors`; **không** trả token về FE.
3. Social mở Publication / workspace sticky → **Đăng lên Page** (nút mới, ẩn nếu flag off **hoặc** không cap `publish` **hoặc** không connector `on`).
4. Modal confirm (bắt buộc, không skip):
   - Tên Page, `account_ref` (page id), caption (variant đã lock), `schedule_at` hoặc “đăng ngay”.
   - Gate snapshot: Pass hoặc Warning + override đúng role; **Blocked → không hiện nút xác nhận**.
   - Checkbox: «Tôi xác nhận đăng với tư cách Page này. AI không được xác nhận.»
5. `POST /api/crm/content-os/portfolio/publications/execute` `{ item_id, channel_account_id, snapshot_id, confirm: true, client_request_id }`.
6. Worker (job hiện có, **không** sync HTTP Graph từ request user nếu > 2s): gọi `FacebookPageConnector.publish(pkg)` → `{ post_id }`.
7. Ghi `cmkt_publication_logs` (`post_id`, `http_status`, `error`, `retry_n`) — bảng E2 giữ.
8. Item: `status=published`, `published_url` = permalink Graph (không bịa URL).
9. Channel health: `Connected` / `TokenExpired` từ `expires_at` thật; `off` / thiếu token → `Manual`.

**Quy tắc**

- `FacebookPageConnector` implement `PublishConnector` **verbatim** (E3). Stub `NotEnabledError` **giữ** làm default export khi flag off, token thiếu, `status≠on`, hoặc `NODE_ENV=test` không mock.
- Human confirm `confirm !== true` → 400 `human_confirm_required`.
- AI / worker generate **cấm** gọi execute (BR-AI-01). Guard: chỉ staff JWT + `StaffContentMarketingPublishGuard`.
- Idempotent: UNIQUE `(item_id, channel_account_id, snapshot_id)` hoặc `client_request_id`. Retry cùng key không tạo post thứ hai.
- Graph lỗi: log `error` + `http_status`; không đổi item sang published; Social thấy retry (E2 policy).
- App Facebook: một app PTT, permission tối thiểu `pages_manage_posts` + `pages_read_engagement` (chỉ đủ đăng + đọc permalink). **Không** `ads_management`.
- Token refresh: job SLA-like, server-only; fail → `TokenExpired`, không publish.

**FE**

- Nút **Mark published** giữ nguyên (BG-WIN-06).
- Nút **Đăng lên Page** chỉ khi đủ điều kiện trên; copy tiếng Việt.
- 403 ẩn nút; lỗi khác: «Không đăng được — xem Publication log».

### 6.2. Epic E4-C — Channel account + secret boundary

**Settings / Publication**

- List accounts: `id`, `channel`, `display_name`, `account_ref` (page id), health — **không** token.
- Connect / Disconnect / Rotate (disconnect xóa token server-side, `status=off`).
- `GET` connectors: SELECT như E3 (`id, channel, status, expires_at`) — **cấm** `access_token`, `refresh_token`.
- Secret at-rest: E4 cho phép cột hiện có; E5 chuyển secret manager. E4 **cấm** log token, cấm đưa vào AI Trace `sources` / `input_json` raw.

**OAuth**

- Start: `GET /api/crm/content-os/portfolio/connectors/facebook/oauth/start` → 302 lên Facebook (state CSRF, TTL ngắn).
- Callback: route API, không trang Next công khai chứa code.
- State bind `staff_id` + `lifecycle_id` trong board scope.

### 6.3. Epic E4-D — DAM pull một adapter

**Adapter**

```ts
export type DamListQuery = { collection: string };
export type DamAsset = {
  id: string;
  url: string;
  title?: string;
  rights?: { license?: string; expires_at?: string; territory?: string; paid_ok?: boolean };
};
export type DamAdapter = { list(q: DamListQuery): Promise<DamAsset[]> };
```

E3 stub giữ: chưa cấu hình → `{ items: [], error: 'dam_not_configured' }`.

E4 thêm `HttpJsonDamAdapter`:

- Base URL **allowlist** (env `CMKT_DAM_BASE_URL`, chỉ https, host cố định).
- `GET {base}/{collection}` → JSON array; mọi row malformed → cả list `dam_invalid_response` (đã khóa E3).
- Timeout, size cap, không follow redirect ra khỏi host.
- Rights optional: có thì ghi `asset_rights` khi user **Chọn**; không thì rights `Unknown` → gate block nếu policy yêu cầu Valid (E1 giữ).

**Library / tab Assets**

- «Chọn từ DAM» gọi `GET …/dam?collection=`.
- Chọn 1+ asset → bind `media_json` ref (`dam_id`, `url`, `checksum` nếu có) — **không** copy binary vào disk PTT trừ khi upload tay như cũ.
- Fail: empty + mã ổn định trên UI (đã có). Success rỗng: «Chưa có asset trong collection» — **không** gộp với error (sửa bug E3 inverted empty).

Không invent asset. Không seed Sunlight.

### 6.4. Epic E4-G — Glossary vận hành

- `POST /portfolio/glossary` `{ term, locale, brand_id, lifecycle_id }` cap `write`; status `Draft`.
- `PATCH /portfolio/glossary/:id` Draft only (term/locale/brand).
- Approve giữ E3 (`approve_internal` / `qa`). Không AI approve.
- Uniqueness E3 `(term, locale, brand_id)` giữ.
- Fail-closed brand+locale giữ; ingest `brand_id`/`locale` từ brief đã có E3 — E4 **bắt** convert request / brief form có 2 field này (không default bịa).
- UI: Intelligence card **riêng** «Glossary» (tách khỏi Insight draft); Copy tab highlight + class CSS token (không UA yellow).
- Copilot mọi path generate copy đã wire E3 — không thêm endpoint generate.

### 6.5. Epic E4-H — Legal hold trên UI

- PATCH item `{ legal_hold: boolean, reason }` — `reason` ≥ 10 ký tự khi bật.
- Cap: `crm_content.write` **không đủ** để **tắt** hold. Tắt hold: admin staff hoặc cap `qa` + reason (SoD: người bật không tự tắt nếu `CMKT_SOD_ENABLED=1`).
- Bật hold: audit row. Không mở HTTP DELETE cho writer.
- Settings giữ copy **«Audit lưu 7 năm.»**
- Workspace / Command Center: badge «Legal hold» khi true.

---

## 7. Functional requirements (mới / nâng)

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-PUB-020 | New | Mode connector **Facebook Page** khi flag + `status=on` + human confirm. E0 Mark published không mất. |
| FR-PUB-021 | New | Publication Package bất biến (`snapshot_id`) trước `execute`. Đổi copy/asset sau lock → Material Change, không execute. |
| FR-PUB-022 | New | `post_id` + permalink thật; không bịa. Thiếu permalink vẫn lưu `post_id`. |
| FR-PUB-023 | New | Idempotent execute theo `client_request_id` hoặc `(item, account, snapshot)`. |
| FR-PUB-024 | Upgrade | Channel health từ token thật; `off` = Manual. |
| FR-SET-010 | New | Connect / Disconnect Page; OAuth server-side. |
| FR-SET-011 | Keep | `direct_social_publish` mặc định **tắt**. |
| FR-AST-020 | Upgrade | `HttpJsonDamAdapter` + allowlist; chọn → bind ref + rights optional. |
| FR-AST-021 | New | Empty success ≠ error copy. |
| FR-COPY-020 | Upgrade | CRUD glossary Draft; approve giữ E3. |
| FR-COPY-021 | New | Brief/request **bắt** `brand_id` + `locale` trước convert (không invent). |
| FR-AUD-020 | New | Audit: oauth_connect, oauth_disconnect, publication.execute, legal_hold on/off, glossary create. Export CSV E3 gồm các action này. |
| FR-AUD-021 | New | Legal hold toggle UI + reason. |
| FR-AI-020 | New | Cấm mọi generate/worker path gọi `publications/execute` hoặc `PublishConnector.publish`. Test khóa. |
| FR-UI-030 | New | Parity mockup WIN §16: Today board, DAM drawer, confirm modal, glossary studio, hold badge, Connect Page, hai nút publish. |
| FR-UI-031 | New | IG / CMS chỉ chip tắt hoặc không render — không handler sống E4. |

FR-PUB-001…012, FR-AST-001…011, FR-COPY-012, FR-SET-003, FR-AUD-004, BR-020 / BR-AI-01, BR-CMKT-01 **giữ**.

---

## 8. Business rules (bổ sung)

- **BR-WIN-01:** Không `confirm: true` thì không gọi Graph.
- **BR-WIN-02:** Gate Blocked → không queue connector (BR-055/056 giữ).
- **BR-WIN-03:** Token / refresh / Graph error body **không** vào `output_json` AI, không vào CSV audit (chỉ `http_status` + mã ổn định).
- **BR-WIN-04:** Một item + một snapshot + một Page: tối đa một `post_id` thành công (idempotent).
- **BR-WIN-05:** Tắt `direct_social_publish` giữa chừng: execute mới → `NotEnabledError`; log cũ giữ.
- **BR-WIN-06:** DAM URL phải cùng host allowlist hoặc https đã bind; không `javascript:` / data URI.
- **BR-WIN-07:** Glossary Draft không vào Copilot / highlight (E3).

---

## 9. API (thêm — prefix portfolio)

| Method | Path | Cap | Ghi chú |
|---|---|---|---|
| GET | `/connectors/facebook/oauth/start` | `write` hoặc admin | 302; state CSRF |
| GET | `/connectors/facebook/oauth/callback` | (server) | Không dùng browser token |
| POST | `/connectors/:id/disconnect` | `write` | Xóa token, `status=off` |
| GET | `/channel-accounts` | `view` | Không secret |
| POST | `/publications/execute` | `publish` | Human confirm + gate |
| GET | `/dam` | `view` | Giữ; collection bắt buộc |
| POST | `/glossary` | `write` | Draft |
| PATCH | `/glossary/:id` | `write` | Draft only |
| PATCH | `/items/:itemId/legal-hold` | xem §6.5 | reason ≥ 10 |

Lifecycle prefix **giữ**. `POST …/publish` Mark published **giữ**.

---

## 10. Dữ liệu

- Tái sử dụng: `cmkt_channel_accounts`, `cmkt_connectors`, `cmkt_settings`, `cmkt_publication_logs`, `cmkt_glossary`, `cmkt_audit_exports`, `legal_hold`, `asset_rights`.
- E4 DDL tối thiểu: unique execute; `oauth_state` (TTL); `cmkt_dam_bindings` (`item_id`, `dam_id`, `url`, `rights_json`, `bound_at`) nếu `media_json` không đủ audit.
- Không rewrite E0 DDL.
- Cấm SELECT token trong mọi query portfolio.

---

## 11. NFR / bảo mật (E4)

| ID | Yêu cầu |
|---|---|
| NFR-WIN-001 | Execute Graph P95 < 8s worker; HTTP user < 1s (enqueue). |
| NFR-WIN-002 | Circuit breaker khi Graph 4xx auth hoặc 5xx liên tiếp. |
| NFR-WIN-003 | OAuth state một lần dùng; TTL ≤ 10 phút. |
| NFR-WIN-004 | Secret không vào browser, log app, AI Trace raw, CSV. |
| NFR-WIN-005 | DAM fetch: timeout ≤ 5s, body cap, allowlist host. |
| NFR-WIN-006 | Pilot: allowlist Page id trong env `CMKT_FB_PAGE_ALLOWLIST` — ngoài list → 403. |

NFR-SEC-003 SCIM **không** mở lại. SSO = hook E3.

---

## 12. Wave sau (không làm trong E4)

| Wave | Ship | Exit |
|---|---|---|
| **E4** (spec này) | FB Page + confirm; DAM HTTP; glossary CRUD; legal hold UI | 1 `post_id` thật + 1 DAM bind + 1 term UI trên `tiep-thi-noi-dung` |
| **E5** | Instagram (cùng app, human confirm); adapter DAM thứ 2; Super Admin hard-delete + copy activity trước xóa; audit search | IG `post_id` + delete không xóa trail |
| **E6** | CMS schedule (1 host allowlist); webhook notify publish; import metric Publication (không listening) | 1 URL web + 1 metric import |

Mỗi wave = spec con + plan riêng nếu E4 lệch. Không gộp E5 vào PR E4.

---

## 13. Acceptance / UAT E4

Pilot `tiep-thi-noi-dung`, **không** seed mockup Sunlight.

1. Flag off → chỉ Mark published; nút Đăng lên Page ẩn; health Manual.
2. Connect Page allowlist → health Connected; JSON không chứa token (DevTools + test).
3. Gate Blocked → không confirm.
4. Confirm + execute → `post_id` trên Page; permalink hoặc id hiện Publication log.
5. Retry cùng `client_request_id` → không post trùng.
6. AI generate không gọi execute (test + không nút).
7. Token hết hạn → TokenExpired; execute 409/503 mã ổn định.
8. DAM configured → list; chọn bind; collection sai / host lạ → error code, items [].
9. Tạo term Draft → không highlight; Approve → highlight + section Copilot.
10. Bật legal hold + reason → badge; không có nút xóa item cho writer.
11. Audit export chứa `publication.execute` / `oauth_connect` / `legal_hold` sau khi làm các bước trên.
12. CTA trên copy publish vẫn **Đăng ký nhận tư vấn**.

---

## 14. Quyết định đã chốt / còn mở

| Chủ đề | Chốt v1.0 |
|---|---|
| Hướng thắng | A — agency-native, không clone scheduler |
| Kênh E4 | **Facebook Page only** |
| Confirm | Checkbox + `confirm: true`; AI cấm |
| Mark published | Giữ song song |
| DAM | HTTP JSON allowlist, không host file |
| Glossary | CRUD Draft + approve E3 |
| Legal hold | Toggle + reason; không DELETE writer |
| Secret | Cột DB E4; manager E5 |
| Ads / IG / CMS / SCIM / Video AI | Ngoài E4 — mockup chip tắt |
| Mockup WIN | File 2026-09-11 — contract E4+; v2 giữ chrome |

Còn mở (không chặn E4): Meta app review timeline; secret manager vendor; tên collection DAM prod; Super Admin = cap nào ở E5.

---

## 15. Kết luận

CMKT-E v3.1 thắng **kỷ luật**. SPEC-CMKT-WIN thắng **thao tác sau khi duyệt**: đăng Page có người bấm, lấy asset có rights, giữ term brand — trong một sản phẩm, một UI mockup, một prefix API.

**Cổng:** spec + mockup WIN + plan E4 đã viết. Code chỉ sau khi chọn cách thực thi (SDD hoặc inline). Không implement Graph hay DAM host lạ ngoài task 36–44.

---

## 16. Hợp đồng UI WIN (v1.1) — vẽ lại để thắng đủ

Không đổi sidebar 8 mục, không đổi 8 tab workspace, không clone lịch N kênh. Thắng = **cùng IA**, thêm state thao tác thật. ops-web E4 phải parity HTML WIN (không chỉ v2).

### 16.1. Nâng cấp visual (contract E4 — phải có handler)

| Bề mặt HTML | State / nút | Hành vi prod |
|---|---|---|
| Ribbon `WIN · E4` | Chỉ mockup | Không render trên prod |
| Command **Cần đăng hôm nay** | 1 hàng item + Gate + Connector + **Mở Publish Control** | Query item gate PASS/Blocked + health thật; 0 hàng = empty, không seed |
| Brief | `Brand ID` + `Locale` readonly bắt buộc | Convert/Copilot fail-closed nếu thiếu (FR-COPY-021) |
| Copy Studio | Highlight `.mark-gloss` term Approved | Chỉ term Approved + đúng brand/locale |
| Copilot prompt | Section glossary Approved | Mọi path generate E3+ |
| Assets | **Chọn từ DAM** → drawer | GET `/dam`; empty success / `dam_not_configured` / `dam_invalid_response`; bind không host file |
| Workspace H1 | Badge **LEGAL HOLD** | Hiện khi `legal_hold`; writer không có DELETE |
| Publish tab 3 | Đổi nhãn **Đăng / Mark published** | Hai nút song song |
| **Mark published** | Input URL + nút | Giữ E0; hiện khi flag off |
| **Đăng lên Page** | Ẩn nếu flag off **hoặc** health ≠ Connected **hoặc** thiếu cap `publish` | Modal confirm; Blocked → không mở confirm |
| Modal confirm | Preview caption + Page + checkbox người | `confirm: true`; không skip |
| Publication evidence | `post_id` + permalink | Không bịa URL |
| Publication Control | Health Manual / Connected / TokenExpired; IG/CMS **chip tắt E5/E6** | Token không ra JSON |
| Settings | Switch Direct social (mặc định tắt); **Connect Page** / **Disconnect**; DAM host; legal hold + reason ≥ 10 | OAuth server-side |
| Intelligence | **Glossary studio**: tạo Draft, Approve | POST/PATCH glossary |
| Sticky workspace | **Đăng lên Page** khi đang tab Publish + Connected | Cùng modal confirm |

### 16.2. Tầm nhìn “hoàn toàn thắng” (chip tắt — không ship E4)

HTML **cố ý** hiện Instagram (E5) và Website CMS (E6) dạng chip `off` / dashed để stakeholder thấy roadmap trên cùng IA. Prod E4: **không** render nút IG/CMS sống, không OAuth IG, không schedule web.

Thắng đủ **không** = thêm 6 MXH. Thắng đủ = một ngày Social không mở Meta + Drive: brief có brand/locale → copy có glossary → asset từ DAM có rights → gate → người xác nhận → `post_id` trên Page → audit.

### 16.3. Inventory nút mới (mọi nút phải có handler)

`Cần đăng hôm nay` · `Chọn từ DAM` · bind row DAM · row host lạ (error) · `＋ Tạo Draft` · `Approve` (term) · `Connect Page` · `Disconnect` · `Áp dụng hold` · `Mark published` · `Đăng lên Page` · checkbox confirm · `Xác nhận và đăng` · `Hủy` confirm.

Nút v2 **giữ**: Tạo request, Save & validate, Send to approval, Approve insight, Audit export, Mark published (E0).

### 16.4. State HTML = hành vi prod

`cmkte-ops-v4-win`: `direct`, `connected`, `hold`, `holdReason`, `terms[]`, `damBound`, `published`. Toast, không `alert()`. Dataset Sunlight **chỉ** HTML — cấm seed prod.

### 16.5. Empty / error (WIN)

| Tình huống | UI |
|---|---|
| Flag off | Chỉ Mark published; health Manual; ẩn Đăng lên Page |
| Gate Blocked | Không modal confirm; Today board hiện số blocker |
| DAM chưa cấu hình | `dam_not_configured` + list rỗng |
| Collection trống, host đúng | Empty success, không mã lỗi |
| Host ngoài allowlist | `dam_invalid_response`, không bind |
| Token hết hạn | Health TokenExpired; execute mã ổn định |
| Legal hold | Badge; không nút xóa |
| Glossary Draft | Không highlight |
