# B2B project staff pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a lead-ingest project, a manager can add, level, pause, and remove staff in that project's assign pool, by name.

**Architecture:** Keep `PUT /api/v1/b2b-projects/:id/staff`, which deletes and reinserts the whole pool. The UI edits a local draft and saves the full list. Extend `GET .../staff` so each row includes the person's name, `active`, and `can_receive_leads`. Mount the panel on the delivery-project **Tổng quan** tab, only when the project has lead ingest. Do not put it on the **Nhận lead** tab. Do not change the Facebook form "Nhận lead" column.

**Tech Stack:** NestJS `ptt-crm-api` (Jest), Next.js `ops-web` (Vitest), existing `Form*` controls, `crm_b2b_projects.manage`.

## Global Constraints

- A lead is assigned only inside the project that owns its form. This screen edits membership of one project.
- Auto-assign already requires `crm_b2b_project_staff.assign_enabled`, `crm_staff.active`, and `crm_staff.can_receive_leads`. This screen does not change that SQL.
- `PUT` staff replaces the whole pool. A save that omits a current member removes them from this project.
- Sitting in the project pool is not enough to receive a lead. A person receives leads only when all three are true: they are in this project's pool with `assign_enabled`, `crm_staff.active` is true, and `crm_staff.can_receive_leads` is true.
- **Thêm vào dự án** refuses the add unless the person is active and has «Cho phép nhận lead» on. The check runs in the draft helper before the row is appended, then again on save against a fresh eligible-staff list.
- People already on the project stay visible if they later become inactive or lose the flag. Their note says they will not be auto-assigned. Turning their project checkbox on is refused until both flags are true.
- The API still returns `staff_not_lead_eligible` for a new id that fails the same check. Show that error if the UI check and the server disagree.
- New rows do not silently default their project seat. **Thêm vào dự án** requires a **Vai trò** and a **Vị trí**.
- Vai trò is the existing project role only: `sales` (Kinh doanh) or `project_manager` (Quản lý dự án). Quản lý dự án sees every lead of that project. Kinh doanh sees only leads assigned to them. Do not add other roles.
- Vị trí is the existing `sales_level` on that membership: `s`, `a`, `b`, or `c`. Hot leads prefer S/A, warm leads prefer A/B, cold leads prefer B/C. It is per project, not the person's HR title.
- Chức danh (`crm_staff.job_title`) is shown read-only from the staff profile. This screen does not edit it.
- Viewers without `crm_b2b_projects.manage` see the table and cannot add, change, or remove.
- Copy is Vietnamese. Do not add a new route.

---

### Task 1: Staff list returns a name

**Files:**
- Modify: `services/ptt-crm-api/src/b2b-projects/b2b-projects.repository.ts` (`listProjectStaff`, around line 523)
- Modify: `services/ops-web/src/lib/b2b-projects-api.ts` (`B2bProjectStaffRow`)

**Interfaces:**
- Consumes: `crm_b2b_project_staff`, `crm_staff`
- Produces: each staff row `{ staff_id, name, job_title, assign_enabled, sales_level, role, active, can_receive_leads }`

- [ ] **Step 1: Change the staff query**

In `listProjectStaff`, replace the SELECT with:

```sql
SELECT ps.staff_id,
       COALESCE(s.name, '') AS name,
       COALESCE(s.job_title, '') AS job_title,
       ps.assign_enabled,
       ps.sales_level,
       COALESCE(ps.role, 'sales') AS role,
       COALESCE(s.active, FALSE) AS active,
       COALESCE(s.can_receive_leads, FALSE) AS can_receive_leads
FROM crm_b2b_project_staff ps
LEFT JOIN crm_staff s ON s.id = ps.staff_id
WHERE ps.project_id = $1::uuid
ORDER BY lower(COALESCE(s.name, '')), ps.staff_id
```

- [ ] **Step 2: Widen the ops-web row type**

```ts
export interface B2bProjectStaffRow {
  staff_id: number;
  name?: string;
  job_title?: string | null;
  assign_enabled: boolean;
  sales_level: string;
  role?: string;
  active?: boolean;
  can_receive_leads?: boolean;
}
```

- [ ] **Step 3: Confirm the API shape**

`GET /api/v1/b2b-projects/:id/staff` is `listStaff` → `listProjectStaff` and returns the rows directly (not wrapped in `{ staff }`). `fetchB2bProjectStaff` already accepts either an array or `{ staff }`. Leave that parser.

---

### Task 2: Draft edits that keep the rest of the pool

**Files:**
- Create: `services/ops-web/src/lib/b2b-project-staff-draft.ts`
- Test: `services/ops-web/src/lib/b2b-project-staff-draft.spec.ts`

**Interfaces:**
- Consumes: `B2bProjectStaffRow`
- Produces:
  - `type B2bStaffDraft = { staff_id: number; name: string; job_title: string; assign_enabled: boolean; sales_level: 's' | 'a' | 'b' | 'c'; role: 'sales' | 'project_manager'; active: boolean; can_receive_leads: boolean }`
  - `staffRowsToDraft(rows: B2bProjectStaffRow[]): B2bStaffDraft[]`
  - `addStaffDraft(draft: B2bStaffDraft[], person: { id: number; name: string; job_title?: string | null; active: boolean; can_receive_leads: boolean; role: 'sales' | 'project_manager'; sales_level: 's' | 'a' | 'b' | 'c' }): B2bStaffDraft[]`
  - `patchStaffDraft(draft: B2bStaffDraft[], staffId: number, patch: Partial<Pick<B2bStaffDraft, 'assign_enabled' | 'sales_level' | 'role'>>): B2bStaffDraft[]`
  - `removeStaffDraft(draft: B2bStaffDraft[], staffId: number): B2bStaffDraft[]`
  - `staffDraftPayload(draft: B2bStaffDraft[]): Array<{ staff_id: number; assign_enabled: boolean; sales_level: string; role: string }>`
  - `leadReceiveBlock(person: { active: boolean; can_receive_leads: boolean }): null | 'inactive' | 'cannot_receive_leads'` — `null` means both flags pass. If both fail, return `'inactive'` (the message covers the receive-lead flag too).

- [ ] **Step 1: Write the failing test**

```ts
import {
  addStaffDraft,
  leadReceiveBlock,
  patchStaffDraft,
  removeStaffDraft,
  staffDraftPayload,
  staffRowsToDraft,
} from './b2b-project-staff-draft';

describe('b2b project staff draft', () => {
  const current = staffRowsToDraft([
    {
      staff_id: 4,
      name: 'Đặng Công Quốc',
      assign_enabled: true,
      sales_level: 'b',
      role: 'sales',
      active: false,
      can_receive_leads: false,
    },
    {
      staff_id: 7,
      name: 'Mỹ Ngọc',
      assign_enabled: true,
      sales_level: 'b',
      role: 'project_manager',
      active: true,
      can_receive_leads: true,
    },
  ]);

  it('adds a person with the chosen role and position, without dropping current members', () => {
    const next = addStaffDraft(current, {
      id: 10,
      name: 'Thảo Vi',
      job_title: 'AE',
      active: true,
      can_receive_leads: true,
      role: 'sales',
      sales_level: 'a',
    });
    expect(next.map((row) => row.staff_id)).toEqual([4, 7, 10]);
    expect(next[2]).toMatchObject({
      assign_enabled: true,
      sales_level: 'a',
      role: 'sales',
      active: true,
      can_receive_leads: true,
    });
    expect(staffDraftPayload(next)[2]).toEqual({
      staff_id: 10,
      assign_enabled: true,
      sales_level: 'a',
      role: 'sales',
    });
  });

  it('ignores a duplicate add', () => {
    expect(
      addStaffDraft(current, {
        id: 7,
        name: 'Mỹ Ngọc',
        active: true,
        can_receive_leads: true,
        role: 'sales',
        sales_level: 'b',
      }),
    ).toHaveLength(2);
  });

  it('patches one row and keeps the project manager role in the save payload', () => {
    const next = patchStaffDraft(current, 7, { assign_enabled: false, sales_level: 'a' });
    expect(staffDraftPayload(next)).toEqual([
      { staff_id: 4, assign_enabled: true, sales_level: 'b', role: 'sales' },
      { staff_id: 7, assign_enabled: false, sales_level: 'a', role: 'project_manager' },
    ]);
  });

  it('removes only the chosen person', () => {
    expect(removeStaffDraft(current, 4).map((row) => row.staff_id)).toEqual([7]);
  });

  it('rejects a sales level outside s/a/b/c', () => {
    expect(() => patchStaffDraft(current, 7, { sales_level: 'x' as 'b' })).toThrow('invalid_sales_level');
  });

  it('blocks add when the person is inactive or cannot receive leads', () => {
    expect(leadReceiveBlock({ active: true, can_receive_leads: true })).toBeNull();
    expect(leadReceiveBlock({ active: false, can_receive_leads: true })).toBe('inactive');
    expect(leadReceiveBlock({ active: true, can_receive_leads: false })).toBe('cannot_receive_leads');
    expect(leadReceiveBlock({ active: false, can_receive_leads: false })).toBe('inactive');
    expect(() =>
      addStaffDraft(current, {
        id: 21,
        name: 'Mới',
        active: false,
        can_receive_leads: true,
        role: 'sales',
        sales_level: 'b',
      }),
    ).toThrow('inactive');
    expect(() =>
      addStaffDraft(current, {
        id: 22,
        name: 'Mới',
        active: true,
        can_receive_leads: false,
        role: 'sales',
        sales_level: 'b',
      }),
    ).toThrow('cannot_receive_leads');
  });

  it('rejects a role outside sales and project_manager', () => {
    expect(() =>
      addStaffDraft(current, {
        id: 23,
        name: 'Mới',
        active: true,
        can_receive_leads: true,
        role: 'director' as 'sales',
        sales_level: 'b',
      }),
    ).toThrow('invalid_role');
  });

  it('refuses to turn project assign on when the person fails either flag', () => {
    expect(() => patchStaffDraft(current, 4, { assign_enabled: true })).toThrow('inactive');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd services/ops-web && npx vitest run src/lib/b2b-project-staff-draft.spec.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the draft helpers**

`staffRowsToDraft` normalizes stored data: unknown `sales_level` becomes `b`, and any role other than `project_manager` becomes `sales`. `addStaffDraft` returns the same array when `staff_id` is already present, before validation. `patchStaffDraft` throws `Error('invalid_sales_level')` for any level other than `s | a | b | c`, and `Error('invalid_role')` for any role other than `sales` or `project_manager`.

`addStaffDraft` calls `leadReceiveBlock` first. It throws `Error('inactive')` or `Error('cannot_receive_leads')` and does not append the row. Then it checks `role` is `sales` or `project_manager` and `sales_level` is `s`, `a`, `b`, or `c`. Otherwise it throws `Error('invalid_role')` or `Error('invalid_sales_level')`. The chosen role and vị trí are stored on the new row. A duplicate `staff_id` returns the same array before those checks.

`patchStaffDraft` allows changing `role` and `sales_level` with the same validation. It calls `leadReceiveBlock` when the patch sets `assign_enabled: true` and the existing row is not already both active and allowed to receive leads. Turning the box off stays allowed.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd services/ops-web && npx vitest run src/lib/b2b-project-staff-draft.spec.ts`

Expected: PASS, 8 tests.

---

### Task 3: Staff pool panel

**Files:**
- Create: `services/ops-web/src/components/b2b/B2bProjectStaffPanel.tsx`
- Modify: `services/ops-web/src/components/delivery/DeliveryDetailTabs.tsx` (overview branch, new optional `overviewPanel`)
- Modify: `services/ops-web/src/app/crm/delivery-projects/[id]/page.tsx` (pass the panel only when the project has `lead_ingest` and a `b2b_project_id`)

**Interfaces:**
- Consumes: `fetchB2bProjectStaff`, `fetchB2bLeadEligibleStaff`, `replaceB2bProjectStaff`, `b2bStaffPickerOptions`, draft helpers from Task 2
- Produces: panel props `{ projectId: string; canManage: boolean; onMessage: (msg: string) => void; onError: (msg: string) => void }`

- [ ] **Step 1: Build the panel**

Load staff and eligible people when `projectId` changes. The add `<select>` lists only people from `fetchB2bLeadEligibleStaff` who are not already in the draft. That endpoint is already `active` and `can_receive_leads`. Still pass both flags into `addStaffDraft`. If it throws, do not change the draft. Show:

- `inactive`: `Nhân viên này đang ngưng. Bật lại tài khoản rồi mới thêm vào pool.`
- `cannot_receive_leads`: `Nhân viên này chưa bật «Cho phép nhận lead». Bật tại Nhân sự → Nhân viên rồi mới thêm vào pool.`

Before **Lưu pool**, refetch eligible staff. Any draft row whose `staff_id` was not in the original server list must still be in the fresh eligible list. If not, block the save with the same message and do not call PUT.

The add row is three controls, then **Thêm vào dự án**: the person `<select>`, **Vai trò** (`Kinh doanh` = `sales`, `Quản lý dự án` = `project_manager`), and **Vị trí** (`S`, `A`, `B`, `C`). Both selects start empty. The button stays disabled until a person, a vai trò, and a vị trí are chosen. Pass the chosen `role` and `sales_level` into `addStaffDraft`.

Table columns: Tên, Chức danh (read-only `job_title`), Vai trò, Vị trí, Nhận lead của dự án (checkbox bound to `assign_enabled`), Ghi chú, and Gỡ when `canManage`. Vai trò and Vị trí are selects on each row when `canManage` is true.

Short note under the title: `Thuộc pool của dự án này. Vai trò và vị trí gắn với dự án. Muốn nhận lead tự động, nhân viên phải đang hoạt động và đã bật «Cho phép nhận lead».`

Ghi chú text:
- `active` and `can_receive_leads`: `Đủ điều kiện nhận lead tự động`
- inactive: `Chưa nhận lead tự động — tài khoản đang ngưng`
- active but `can_receive_leads` is false: `Chưa nhận lead tự động — chưa bật «Cho phép nhận lead»`

The project checkbox does not by itself make them receive leads. The note stays on the row until both staff flags are true.

When `canManage` is false, hide Thêm, Lưu, the vai trò select, the vị trí select, the checkbox, and Gỡ. Still show the table.

Empty draft: one row `Chưa có nhân viên trong pool dự án này.`

On `ApiError` whose body `error` is `staff_not_lead_eligible`, show the `cannot_receive_leads` message above.

- [ ] **Step 2: Mount it on the Overview tab**

Add `overviewPanel?: React.ReactNode` to `DeliveryDetailTabs`. Render it under the existing «Thông tin dự án» card when `tab === 'overview'`.

In `services/ops-web/src/app/crm/delivery-projects/[id]/page.tsx`, pass `overviewPanel` only when `hasCapability(..., 'lead_ingest')` and `project.b2b_project_id` is set. Pass `canManage={canManageB2b}`.

Section title: **Nhân viên nhận lead**. The note from Step 1 is the only helper text. Do not repeat a second sentence about the Facebook form on this tab.

- [ ] **Step 3: Unit-test the picker filter used by the add box**

The add `<select>` options are `b2bStaffPickerOptions(eligible, []).filter((opt) => !draftIds.has(opt.value))`. Add this expectation to `services/ops-web/src/lib/b2b-staff-picker.util.spec.ts` only if a tiny exported helper is cleaner. Prefer keeping the filter inline in the panel and covering the "do not drop members" rule in Task 2. No extra test file is required for the component; this repo's component tests are not set up with Testing Library.

---

### Task 4: Check the screen against ptt-hcm

- [ ] **Step 1: Run the unit tests**

```bash
cd services/ops-web && npx vitest run src/lib/b2b-project-staff-draft.spec.ts src/lib/b2b-staff-picker.util.spec.ts
cd services/ptt-crm-api && npx jest src/b2b-projects/b2b-projects.service.spec.ts --no-coverage
```

Expected: all pass. The existing replaceStaff tests stay green because this plan does not change eligibility rules.

- [ ] **Step 2: Open the project in the browser**

Path: `/crm/delivery-projects?capability=lead_ingest` → open `ptt-hcm` → tab **Tổng quan**. The staff pool is under «Thông tin dự án», not on **Nhận lead**.

Confirm:
- Mỹ Ngọc, Thảo Vi, Đình Tâm, and Nhã Phương show `Đủ điều kiện nhận lead tự động`.
- Đặng Công Quốc stays listed with the inactive / receive-lead note. The add box does not offer him. Turning his project checkbox on shows the inactive message and does not save that change.
- The add box lists only other active staff who have «Cho phép nhận lead», and does not list the five people already in the table.
- Saving without edits does not remove anyone (the payload still contains all five ids).
- Adding a test person and then removing them before leaving the page does not require a production membership change. If a save is used, remove that person again and save, and confirm the original five remain.

Do not offboard anyone. Do not turn off `assign_enabled` for the four people who should keep receiving leads.
