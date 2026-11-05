export const CEO_ACTION_IDS = [
  'ack_ops_alert',
  'assign_pipeline_risk',
  'log_pipeline_activity',
  'assign_lead',
  'remind_staff',
  'sla_remind_lead',
  'remind_contract_approval',
  'prioritize_solution_queue',
] as const;

export type CeoActionId = (typeof CEO_ACTION_IDS)[number];

const FORBIDDEN_PATTERNS: Array<{ re: RegExp; href: string; label: string }> = [
  { re: /duyet luong|payroll|bao hiem/i, href: '/crm/hr', label: 'HR' },
  { re: /xoa lead|xoa hop dong|xoa invoice/i, href: '/crm/leads', label: 'CRM' },
  { re: /cap quyen|tao user|rbac/i, href: '/admin', label: 'Admin' },
  { re: /ngan sach ads|pause campaign/i, href: '/meta/facebook-ads', label: 'Ads' },
  { re: /gui zalo|gui email khach/i, href: '/crm/leads', label: 'CRM' },
  { re: /spawn week|ghi kpi ops/i, href: '/crm/ops/dashboard', label: 'Ops' },
  { re: /duyet hop dong|approve contract/i, href: '/crm/hub', label: 'Hub' },
];

function stripDiacritics(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function parseForbiddenRequest(message: string): { href: string; label: string } | null {
  const norm = stripDiacritics(message);
  for (const row of FORBIDDEN_PATTERNS) {
    if (row.re.test(norm)) return { href: row.href, label: row.label };
  }
  return null;
}

export function forbiddenReply(link: { href: string; label: string }): string {
  return `Việc này không làm từ ChatBox — mở ${link.label} (${link.href}).`;
}

export function validateActionParams(
  actionId: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  switch (actionId) {
    case 'ack_ops_alert': {
      const alert_id = Number(params.alert_id);
      if (!Number.isFinite(alert_id) || alert_id <= 0) {
        throw new Error('missing_alert_id');
      }
      return { alert_id };
    }
    case 'assign_pipeline_risk': {
      const recommendation_id = String(params.recommendation_id ?? '').trim();
      const staff_id = Number(params.staff_id);
      if (!recommendation_id) throw new Error('missing_recommendation_id');
      if (!Number.isFinite(staff_id) || staff_id <= 0) throw new Error('missing_staff_id');
      return { recommendation_id, staff_id };
    }
    case 'log_pipeline_activity': {
      const recommendation_id = String(params.recommendation_id ?? '').trim();
      const note = String(params.note ?? '').trim().slice(0, 500);
      if (!recommendation_id) throw new Error('missing_recommendation_id');
      if (!note) throw new Error('missing_note');
      return { recommendation_id, note };
    }
    case 'assign_lead': {
      const lead_id = Number(params.lead_id);
      const owner_staff_id = Number(params.owner_staff_id);
      if (!Number.isFinite(lead_id) || lead_id <= 0) throw new Error('missing_lead_id');
      if (!Number.isFinite(owner_staff_id) || owner_staff_id <= 0) {
        throw new Error('missing_owner_staff_id');
      }
      return { lead_id, owner_staff_id };
    }
    case 'remind_staff': {
      const staff_id = Number(params.staff_id ?? params.staff_user_id);
      const title = String(params.title ?? '').trim().slice(0, 120);
      const body = String(params.body ?? '').trim().slice(0, 500);
      const link_href = params.link_href ? String(params.link_href).trim().slice(0, 200) : undefined;
      if (!Number.isFinite(staff_id) || staff_id <= 0) throw new Error('missing_staff_id');
      if (!title || !body) throw new Error('missing_title_or_body');
      return { staff_id, title, body, link_href };
    }
    case 'sla_remind_lead': {
      const lead_id = Number(params.lead_id);
      const tier = String(params.tier ?? '').trim();
      const suggested_action = String(params.suggested_action ?? '').trim();
      if (!Number.isFinite(lead_id) || lead_id <= 0) throw new Error('missing_lead_id');
      if (!tier || !suggested_action) throw new Error('missing_sla_fields');
      return { lead_id, tier, suggested_action };
    }
    case 'remind_contract_approval': {
      const lead_id = Number(params.lead_id);
      const contract_id = params.contract_id != null ? Number(params.contract_id) : undefined;
      if (!Number.isFinite(lead_id) || lead_id <= 0) throw new Error('missing_lead_id');
      return contract_id != null && Number.isFinite(contract_id) && contract_id > 0
        ? { lead_id, contract_id }
        : { lead_id };
    }
    case 'prioritize_solution_queue': {
      const lead_id = Number(params.lead_id);
      const note = String(params.note ?? '').trim().slice(0, 200);
      if (!Number.isFinite(lead_id) || lead_id <= 0) throw new Error('missing_lead_id');
      return note ? { lead_id, note } : { lead_id };
    }
    default:
      throw new Error('unknown_action');
  }
}

export function requiredCapsForAction(actionId: string): Array<{ section: string; action: string }> {
  switch (actionId) {
    case 'ack_ops_alert':
      return [{ section: 'crm_board', action: 'edit' }];
    case 'assign_pipeline_risk':
    case 'log_pipeline_activity':
      return [{ section: 'crm_sales_funnel', action: 'view' }];
    case 'assign_lead':
      return [{ section: 'crm_leads', action: 'assign' }];
    case 'remind_staff':
    case 'remind_contract_approval':
    case 'prioritize_solution_queue':
      return [{ section: 'ceo_command', action: 'act' }];
    case 'sla_remind_lead':
      return [{ section: 'crm_leads', action: 'edit' }];
    default:
      return [];
  }
}

export function previewVi(actionId: string, params: Record<string, unknown>, staffName?: string): string {
  switch (actionId) {
    case 'ack_ops_alert':
      return `Ack alert #${params.alert_id}?`;
    case 'assign_pipeline_risk':
      return `Giao follow-up ${params.recommendation_id} cho ${staffName ?? `#${params.staff_id}`}?`;
    case 'log_pipeline_activity':
      return `Ghi hoạt động trên ${params.recommendation_id}?`;
    case 'assign_lead':
      return `Phân lead #${params.lead_id} cho ${staffName ?? `#${params.owner_staff_id}`}?`;
    case 'remind_staff':
      return `Nhắc nội bộ: ${params.title}?`;
    case 'sla_remind_lead':
      return `Nhắc SLA lead #${params.lead_id} (${params.tier})?`;
    case 'remind_contract_approval':
      return `Nhắc GDKD duyệt HĐ lead #${params.lead_id}?`;
    case 'prioritize_solution_queue':
      return `Ưu tiên queue Solution lead #${params.lead_id}?`;
    default:
      return 'Xác nhận hành động?';
  }
}
