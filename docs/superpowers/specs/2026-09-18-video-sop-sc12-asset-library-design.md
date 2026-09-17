# Design: Video SOP SC-12 Asset Library (FR-7.9)

**Ngày:** 2026-09-18  
**Document ID:** RNOSAI-VD-SC12-LIBRARY-20260918  
**Trạng thái:** Approved for plan  
**Parent:** [`2026-08-20-video-sop-module-7-design.md`](./2026-08-20-video-sop-module-7-design.md) §10 Library `/assets/search`, §11 SC-12  
**Shell:** [`2026-09-18-video-sop-shell-command-center-design.md`](./2026-09-18-video-sop-shell-command-center-design.md) (stub → real)

---

## 1. Goal

Thay stub `/crm/video/[id]/library` bằng **Asset Library thật**: search `vd_assets` theo **lifecycle** (mọi project cùng chiến dịch), lọc tuỳ chọn theo project / kind / text — API `GET /api/v1/vd/assets/search` (FR-7.9).

---

## 2. Scope

### In

| ID | Requirement |
|----|-------------|
| VD-LIB-01 | Nest `GET /api/v1/vd/assets/search` với query bên dưới |
| VD-LIB-02 | Join `vd_assets` ↔ `vd_projects` trên `lifecycle_id` |
| VD-LIB-03 | Cap: `crm_vd.project` view **hoặc** `crm_content` view (giống hub) |
| VD-LIB-04 | UI SC-12 trong `VideoSopPageChrome`: filters + bảng kết quả |
| VD-LIB-05 | Resolve `lifecycle_id` từ `?lifecycle_id=` hoặc từ project đang mở |
| VD-LIB-06 | Persist `VD_SOP_LAST_PROJECT_KEY` khi vào library (giữ hành vi shell) |

### Out (wave này)

- Lineage graph / upload / delete / rename asset  
- CDN signed URL mới (dùng `url` hiện có; empty → placeholder text)  
- Global search không có `lifecycle_id`  
- Portal / SC-14 redesign  

---

## 3. API

### `GET /api/v1/vd/assets/search`

**Auth:** `StaffOrInternalKeyGuard` + view guard Video SOP.

| Query | Required | Notes |
|-------|----------|-------|
| `lifecycle_id` | **yes** | positive int |
| `project_id` | no | nếu set → chỉ assets của project đó (vẫn phải thuộc lifecycle) |
| `kind` | no | `keyframe` \| `take` \| `master` \| `proxy` \| `package` |
| `q` | no | trim; match `CAST(id AS text)`, `sha256` ILIKE prefix, `storage_key` ILIKE `%q%` |
| `limit` | no | default 50, max 100 |

**400** nếu thiếu / invalid `lifecycle_id`.  
**403** nếu không đủ cap.  
**200** body:

```json
{
  "items": [
    {
      "id": 12,
      "project_id": 3,
      "project_title": "Campaign A — Hero",
      "job_id": 44,
      "kind": "keyframe",
      "storage_key": "",
      "url": "",
      "sha256": "abc…",
      "width": 1080,
      "height": 1920,
      "duration_ms": null,
      "created_at": "2026-09-18T00:00:00.000Z"
    }
  ]
}
```

**SQL shape (PG):**

```sql
SELECT a.*, p.title AS project_title
FROM vd_assets a
JOIN vd_projects p ON p.id = a.project_id
WHERE p.lifecycle_id = $lifecycle
  AND ($project IS NULL OR a.project_id = $project)
  AND ($kind IS NULL OR a.kind = $kind)
  AND ($q IS NULL OR a.id::text = $q OR a.sha256 ILIKE $q||'%' OR a.storage_key ILIKE '%'||$q||'%')
ORDER BY a.created_at DESC
LIMIT $limit
```

Memory fallback (no PG table): filter in-repo memory assets + project list cùng lifecycle (pattern repository hiện tại).

---

## 4. UI — SC-12

Route giữ: `/crm/video/[id]/library` (+ `?lifecycle_id=`).

1. Load project (để lấy `lifecycle_id` nếu query thiếu).  
2. Controls:
   - Scope: **Project này** | **Cả lifecycle** (default: Project này khi mở từ workspace; user có thể chuyển lifecycle).  
   - Kind: All + enum.  
   - Search `q` (debounce ~300ms hoặc Submit).  
3. Table columns: TITLE/project · KIND · ASSET # · SHA8 · WxH · UPDATED · Preview (`url` link hoặc “—”).  
4. Empty: *Chưa có asset khớp bộ lọc.*  
5. Link ← workspace `/crm/video/[id]`.

CSS: class `vd-*` (shell hiện có: `vd-table`, `vd-card`, `vd-search-input`, `vd-btn`).

---

## 5. Client API

`services/ops-web/src/lib/video-sop-api.ts`:

- `vdAssetsSearchPath(qs)` → `/api/v1/vd/assets/search?...`  
- `searchAssets(token, opts)` → `{ items: VdLibraryAssetRow[] }`  
- Type `VdLibraryAssetRow` = asset fields + `project_title`

---

## 6. Acceptance

| ID | Expect |
|----|--------|
| AC-LIB-1 | Có asset project A lifecycle 4 → search `lifecycle_id=4` trả về |
| AC-LIB-2 | `project_id=A` loại asset project B cùng lifecycle |
| AC-LIB-3 | `kind=keyframe` chỉ keyframe |
| AC-LIB-4 | `q` khớp id hoặc sha prefix |
| AC-LIB-5 | UI library không còn copy stub backlog |
| AC-LIB-6 | Thiếu lifecycle (project invalid) → lỗi rõ, không 500 |

---

## 7. Files

**Create**

- `services/ptt-crm-api/src/video-sop/assets/vd-asset-search.service.ts` (+ spec)  
- `services/ptt-crm-api/src/video-sop/assets/vd-asset.controller.ts`  
- `services/ops-web/src/components/video-sop/VideoSopAssetLibrary.tsx` (+ util/spec nếu cần)

**Modify**

- `vd-asset.repository.ts` — `search(...)`  
- `video-sop.module.ts` — register controller/service  
- `video-sop-api.ts` — client  
- `app/crm/video/[id]/library/page.tsx` — thay stub  
- `docs/huong-dan-su-dung/19-video-sop.md` — bỏ “stub SC-12”

---

## 8. Spec self-review

- Không TBD/TODO trong requirements.  
- Không claim lineage/upload.  
- Query key lifecycle = `lifecycle_id` (Video SOP convention).  
- Khớp Module 7 table: Library → `/assets/search` FR-7.9; UI route SC-12.
