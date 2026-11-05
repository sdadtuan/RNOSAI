export type CrmContextPackInput = {
  client_id?: string;
  lifecycle_id?: number;
  plan_id?: number;
  project_id?: string;
};

export type CrmContextPack = {
  source: 'ptt-crm';
  as_of: string;
  tool: string;
  wired: true;
  phase: 'P2';
  ok: true;
  client: { id: string; name: string; lifecycle: string };
  marketing_plan: {
    id: string;
    status: string;
    period: string;
    milestones: Array<{ id: number; title: string; status: string; due_date: string }>;
  };
  service_delivery: {
    id: string;
    stage: string;
    open_tasks: Array<{ id: number; title: string; stage: string }>;
    health: string;
  };
  delivery_project?: {
    id: string;
    name: string;
    status: string;
    health: string;
  } | null;
  campaigns: Array<{
    id: string;
    name: string;
    kpi: string;
    status: string;
    quoted: number | string | null;
    actual: number | string | null;
  }>;
  known: string[];
  assumed: string[];
  unknown: string[];
  links: string[];
};

export const STAGE_LABEL_VI: Record<string, string> = {
  lead: 'Lead',
  consult: 'Tư vấn',
  quote: 'Báo giá',
  onboard: 'Onboard',
  deliver: 'Triển khai',
  handover: 'Bàn giao',
  retain: 'Giữ chân',
};

export function stageLabelVi(stage: string): string {
  const key = String(stage ?? '').trim().toLowerCase();
  return STAGE_LABEL_VI[key] ?? (stage?.trim() || '—');
}

export function healthLabelVi(raw: string | null | undefined): string {
  switch (String(raw ?? '').trim().toLowerCase()) {
    case 'stable':
      return 'On track';
    case 'needs_attention':
      return 'Watch';
    case 'at_risk':
    case 'overdue':
      return 'Risk';
    case 'no_data':
      return 'No data';
    default:
      return raw?.trim() || '—';
  }
}
