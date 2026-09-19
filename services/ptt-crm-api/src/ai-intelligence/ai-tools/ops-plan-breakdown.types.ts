import type { PlanBreakdownRoleKey } from './ops-plan-breakdown.templates';

export type OpsPlanBreakdownMeta = {
  actor: string;
  approvedAt: string;
};

export type OpsPlanBreakdownKpi = {
  name: string;
  target: number | string | boolean | null;
  unit: string;
};

export type OpsPlanBreakdownMatrixLine = {
  role_key: PlanBreakdownRoleKey;
  role_label: string;
  kpis: OpsPlanBreakdownKpi[];
  deliverables: string[];
  task_title: string;
  acceptance_criteria: string;
  owner_id: string | null;
  due: string | null;
};

export type OpsPlanBreakdownResult = {
  ok: true;
  wired: true;
  phase: 'P5';
  plan_id: number;
  plan_status: string;
  persist_tasks: boolean;
  matrix: OpsPlanBreakdownMatrixLine[];
  task_ids: number[];
  known: string[];
  assumed: string[];
  unknown: string[];
  links: string[];
};
