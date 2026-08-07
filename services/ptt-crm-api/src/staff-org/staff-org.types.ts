export type StaffOrgUserSummary = {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  job_functions: string[];
};

export type PutStaffUserJobFunctionsBody = {
  functions?: string[];
};

export type StaffUserJobFunctionsResponse = {
  user_id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  functions: string[];
};

export type StaffUserEffectiveCapsResponse = {
  user_id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  job_functions: string[];
  caps: Array<{ section: string; action: string }>;
};

export type StaffDepartmentRow = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  active: boolean;
};

export type StaffTeamRow = {
  id: number;
  code: string;
  name: string;
  department_id: number | null;
  department_code?: string;
  department_name?: string;
  active: boolean;
};

export type StaffOrgPositionRow = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  department_code?: string;
  active: boolean;
};

export type CreateStaffDepartmentBody = {
  code: string;
  name: string;
  parent_id?: number | null;
};

export type PatchStaffDepartmentBody = {
  code?: string;
  name?: string;
  parent_id?: number | null;
  active?: boolean;
};

export type CreateStaffTeamBody = {
  code: string;
  name: string;
  department_id?: number | null;
};

export type PatchStaffTeamBody = {
  code?: string;
  name?: string;
  department_id?: number | null;
  active?: boolean;
};

export type PatchStaffOrgPositionBody = {
  name?: string;
  parent_id?: number | null;
  department_id?: number | null;
  active?: boolean;
};

export type StaffOrgAuditInput = {
  actor_email: string;
  entity_type: string;
  entity_id: string;
  action: string;
  diff_json?: Record<string, unknown>;
};
