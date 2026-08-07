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
