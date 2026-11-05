import type { B2bProjectStaffRow } from './b2b-projects-api';

export type B2bStaffRole = 'sales' | 'project_manager';
export type B2bStaffLevel = 's' | 'a' | 'b' | 'c';

export type B2bStaffDraft = {
  staff_id: number;
  name: string;
  job_title: string;
  assign_enabled: boolean;
  sales_level: B2bStaffLevel;
  role: B2bStaffRole;
  active: boolean;
  can_receive_leads: boolean;
};

export type B2bStaffAdd = {
  id: number;
  name: string;
  job_title?: string | null;
  active: boolean;
  can_receive_leads: boolean;
  role: B2bStaffRole;
  sales_level: B2bStaffLevel;
};

const LEVELS: readonly B2bStaffLevel[] = ['s', 'a', 'b', 'c'];
const ROLES: readonly B2bStaffRole[] = ['sales', 'project_manager'];

export function leadReceiveBlock(person: {
  active: boolean;
  can_receive_leads: boolean;
}): null | 'inactive' | 'cannot_receive_leads' {
  if (!person.active) return 'inactive';
  if (!person.can_receive_leads) return 'cannot_receive_leads';
  return null;
}

function storedLevel(raw: string | undefined): B2bStaffLevel {
  const level = String(raw ?? '').trim().toLowerCase();
  return LEVELS.includes(level as B2bStaffLevel) ? (level as B2bStaffLevel) : 'b';
}

function storedRole(raw: string | undefined): B2bStaffRole {
  return String(raw ?? '').trim().toLowerCase() === 'project_manager' ? 'project_manager' : 'sales';
}

function assertLevel(raw: string): B2bStaffLevel {
  const level = String(raw ?? '').trim().toLowerCase();
  if (!LEVELS.includes(level as B2bStaffLevel)) throw new Error('invalid_sales_level');
  return level as B2bStaffLevel;
}

function assertRole(raw: string): B2bStaffRole {
  const role = String(raw ?? '').trim().toLowerCase();
  if (!ROLES.includes(role as B2bStaffRole)) throw new Error('invalid_role');
  return role as B2bStaffRole;
}

export function staffRowsToDraft(rows: B2bProjectStaffRow[]): B2bStaffDraft[] {
  return rows.map((row) => ({
    staff_id: Number(row.staff_id),
    name: String(row.name ?? ''),
    job_title: String(row.job_title ?? ''),
    assign_enabled: row.assign_enabled !== false,
    sales_level: storedLevel(row.sales_level),
    role: storedRole(row.role),
    active: Boolean(row.active),
    can_receive_leads: Boolean(row.can_receive_leads),
  }));
}

export function addStaffDraft(draft: B2bStaffDraft[], person: B2bStaffAdd): B2bStaffDraft[] {
  if (draft.some((row) => row.staff_id === person.id)) return draft;
  const block = leadReceiveBlock({
    active: Boolean(person.active),
    can_receive_leads: Boolean(person.can_receive_leads),
  });
  if (block) throw new Error(block);
  const role = assertRole(person.role);
  const salesLevel = assertLevel(person.sales_level);
  return [
    ...draft,
    {
      staff_id: person.id,
      name: person.name.trim() || `NV #${person.id}`,
      job_title: String(person.job_title ?? ''),
      assign_enabled: true,
      sales_level: salesLevel,
      role,
      active: true,
      can_receive_leads: true,
    },
  ];
}

export function patchStaffDraft(
  draft: B2bStaffDraft[],
  staffId: number,
  patch: Partial<Pick<B2bStaffDraft, 'assign_enabled' | 'sales_level' | 'role'>>,
): B2bStaffDraft[] {
  return draft.map((row) => {
    if (row.staff_id !== staffId) return row;
    const salesLevel = patch.sales_level !== undefined ? assertLevel(patch.sales_level) : row.sales_level;
    const role = patch.role !== undefined ? assertRole(patch.role) : row.role;
    if (patch.assign_enabled === true) {
      const block = leadReceiveBlock(row);
      if (block) throw new Error(block);
    }
    return {
      ...row,
      sales_level: salesLevel,
      role,
      assign_enabled: patch.assign_enabled !== undefined ? patch.assign_enabled : row.assign_enabled,
    };
  });
}

export function removeStaffDraft(draft: B2bStaffDraft[], staffId: number): B2bStaffDraft[] {
  return draft.filter((row) => row.staff_id !== staffId);
}

export function staffDraftPayload(
  draft: B2bStaffDraft[],
): Array<{ staff_id: number; assign_enabled: boolean; sales_level: string; role: string }> {
  return draft.map((row) => ({
    staff_id: row.staff_id,
    assign_enabled: row.assign_enabled,
    sales_level: row.sales_level,
    role: row.role,
  }));
}
