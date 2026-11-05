import { dash } from './cp-format';
import { formatCreditPct } from './cp-portfolio.util';

export type BriefSections = {
  context: string;
  objective: string;
  message_cta: string;
  constraints: string;
};

export type WorkspaceMember = {
  staff_id?: number;
  name?: string | null;
  role?: string | null;
};

export type BudgetCenter = { charged?: number; reserved?: number };

export const BUDGET_LINE_LABELS = [
  { id: 'video', label: 'Video production' },
  { id: 'batch', label: 'Batch factory' },
  { id: 'voice', label: 'TTS / voice' },
] as const;

export function daysRemaining(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dueAt) return null;
  const due = calendarDay(dueAt);
  const today = calendarDay(now);
  if (!due || !today) return null;
  return Math.round((Date.parse(`${due}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000);
}

export function formatDaysRemaining(days: number | null | undefined): string {
  return days == null || !Number.isFinite(days) ? dash(null) : String(days);
}

export function formatCreditLine(
  used: number | null | undefined,
  budget: number | null | undefined,
): string {
  const cap = Number(budget);
  if (!Number.isFinite(cap) || cap <= 0) return dash(null);
  return `${formatInt(Number(used ?? 0))} / ${formatInt(cap)}`;
}

export function creditPctNumber(
  used: number | null | undefined,
  budget: number | null | undefined,
): number | null {
  const text = formatCreditPct(used, budget);
  if (text === dash(null)) return null;
  return Number(text.replace('%', ''));
}

export function briefSections(body: unknown): BriefSections {
  if (body == null) {
    return { context: '', objective: '', message_cta: '', constraints: '' };
  }
  if (typeof body === 'string') {
    return { context: body, objective: '', message_cta: '', constraints: '' };
  }
  if (typeof body !== 'object') {
    return { context: '', objective: '', message_cta: '', constraints: '' };
  }
  const row = body as Record<string, unknown>;
  const context = textOf(row.context) || textOf(row.content);
  return {
    context,
    objective: textOf(row.objective),
    message_cta: textOf(row.message_cta) || textOf(row.message),
    constraints: textOf(row.constraints),
  };
}

export function overviewAlert(input: {
  creditPct: number | null | undefined;
  overdueDeliverables: number | null | undefined;
  clientReviewOverSla: boolean;
}): string | null {
  const parts: string[] = [];
  const pct = Number(input.creditPct);
  if (Number.isFinite(pct) && pct >= 50) parts.push(`Credit ${Math.round(pct)}%`);
  if (input.clientReviewOverSla) parts.push('Client review quá SLA');
  const overdue = Number(input.overdueDeliverables ?? 0);
  if (overdue > 0) parts.push(`${overdue} deliverable quá hạn`);
  return parts.length ? parts.join(' · ') : null;
}

export function taskSource(task: {
  am_task_id?: string | null;
  csd_ticket_id?: string | null;
  video_version_id?: string | null;
}): { label: string; href: string | null } {
  if (task.am_task_id) {
    return { label: 'link AM task', href: `/crm/account-management?task=${encodeURIComponent(task.am_task_id)}` };
  }
  if (task.csd_ticket_id) {
    return { label: 'link CSD', href: `/crm/csd/tickets/${encodeURIComponent(task.csd_ticket_id)}` };
  }
  if (task.video_version_id) {
    return {
      label: 'link Hub',
      href: `/crm/creative-os/video/versions/${encodeURIComponent(task.video_version_id)}`,
    };
  }
  return { label: 'crm_cp_tasks', href: null };
}

export function deliverableCta(item: {
  type?: string | null;
  vd_project_id?: string | null;
  video_version_id?: string | null;
  video_draft_id?: string | null;
  project_id?: string | null;
}): { label: string; href: string } {
  if (item.type === 'human_video' && item.vd_project_id) {
    return { label: 'Mở Video SOP', href: `/crm/video/${encodeURIComponent(item.vd_project_id)}` };
  }
  if (item.video_version_id) {
    return {
      label: 'Mở review',
      href: `/crm/creative-os/video/versions/${encodeURIComponent(item.video_version_id)}`,
    };
  }
  if (item.video_draft_id) {
    return { label: 'Studio', href: `/crm/creative-os/video/${encodeURIComponent(item.video_draft_id)}` };
  }
  const suffix = item.project_id ? `?project=${encodeURIComponent(item.project_id)}` : '';
  return { label: 'Studio', href: `/crm/creative-os/video${suffix}` };
}

export function budgetBanner(pct: number | null | undefined): { tone: 'warn' | 'danger'; text: string } | null {
  const value = Number(pct);
  if (!Number.isFinite(value)) return null;
  if (value >= 100) {
    return { tone: 'danger', text: '100% — hard block render (policy).' };
  }
  if (value >= 80) {
    return { tone: 'warn', text: '80% — cảnh báo. 100% = hard block render (policy).' };
  }
  if (value >= 50) {
    return { tone: 'warn', text: '50% — cảnh báo. 80% cảnh báo · 100% = hard block render (policy).' };
  }
  return null;
}

export function approvalSteps(input: {
  briefStatus?: string | null;
  clientStatus?: string | null;
  legalStatus?: string | null;
  qcStatus?: string | null;
}): Array<{ step: string; rule: string; actor: string; sla: string; status: string }> {
  const legal =
    input.qcStatus === 'blocked'
      ? 'Chờ QC'
      : input.legalStatus?.trim() || dash(null);
  return [
    {
      step: 'Brand',
      rule: 'kit + safe-area',
      actor: dash(null),
      sla: dash(null),
      status: input.briefStatus?.trim() || dash(null),
    },
    {
      step: 'Client',
      rule: 'portal Hub',
      actor: dash(null),
      sla: dash(null),
      status: input.clientStatus?.trim() || dash(null),
    },
    {
      step: 'Legal',
      rule: 'has_claim / giá',
      actor: dash(null),
      sla: dash(null),
      status: legal,
    },
  ];
}

export function formatMemberLine(members: WorkspaceMember[] | null | undefined): string {
  const parts = (members ?? [])
    .map((member) => {
      const name = String(member.name ?? '').trim();
      if (!name) return '';
      const role = String(member.role ?? '').trim();
      return role ? `${name} (${role})` : name;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : dash(null);
}

export function formatAiOpsCount(value: number | null | undefined): string {
  return value == null || value === 0 ? dash(null) : String(value);
}

export function formatAiOpsChipLabel(
  value: number | null | undefined,
  kind: 'weave' | 'magnific' | 'comfy',
): string {
  const count = formatAiOpsCount(value);
  if (count === dash(null)) return count;
  if (kind === 'weave') return `${count} WO mở`;
  if (kind === 'magnific') return `${count} job Magnific`;
  return `${count} job Comfy`;
}

export function videoFinalCount(
  items: Array<{ type?: string | null; status?: string | null }>,
): number {
  return items.filter(
    (item) =>
      (item.type === 'ai_video' || item.type === 'human_video') &&
      ['completed', 'final', 'published', 'approved'].includes(String(item.status)),
  ).length;
}

export function budgetLines(input: {
  budget?: number | null;
  charged?: number | null;
  reserved?: number | null;
  byCostCenter?: Record<string, BudgetCenter>;
}): Array<{ label: string; budget: string; charged: string; reserved: string; remaining: string }> {
  return BUDGET_LINE_LABELS.map((line) => {
    const center = input.byCostCenter?.[line.id];
    const charged = center?.charged;
    const reserved = center?.reserved;
    return {
      label: line.label,
      budget: dash(null),
      charged: Number.isFinite(Number(charged)) && charged != null ? String(charged) : dash(null),
      reserved: Number.isFinite(Number(reserved)) && reserved != null ? String(reserved) : dash(null),
      remaining: dash(null),
    };
  });
}

export function projectAssets<T extends { project_id?: string | null }>(
  items: T[],
  projectId: string,
): T[] {
  return items.filter((item) => String(item.project_id ?? '') === projectId);
}

export function rightsBadge(asset: {
  rights_status?: string | null;
  expiry_on?: string | null;
}): string | null {
  if (asset.rights_status === 'block') return '⚠ hết quyền';
  if (asset.rights_status === 'warn') return '⚠ sắp hết quyền';
  return null;
}

export function priorityPillClass(priority: string | null | undefined): string {
  if (priority === 'critical') return 'cp-pill cp-pill--danger';
  if (priority === 'high') return 'cp-pill cp-pill--warning';
  return 'cp-pill';
}

export function deliverableThumb(type: string | null | undefined): string {
  if (type === 'human_video') return 'SOP';
  if (type === 'ai_video') return '▶';
  if (type === 'motion') return '▶';
  return '▣';
}

function formatInt(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function textOf(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function calendarDay(value: string | Date): string | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return null;
  return calendarDay(parsed);
}
