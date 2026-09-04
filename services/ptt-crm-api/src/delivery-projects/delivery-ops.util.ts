export type MilestoneQualityInput = {
  status: string;
  due_date: string | null;
  completed_at: string | null;
};

export type DeliveryQualityInput = {
  milestones: MilestoneQualityInput[];
  changeRequestCount: number;
};

export type ApprovalPolicyStep = {
  role: string;
  label: string;
};

export function overlapAllocationPct(
  assignments: Array<{
    staff_id: number;
    pct: number;
    start: string;
    end: string;
    project_status: string;
  }>,
  staffId: number,
  range: { start: string; end: string },
): number {
  const rangeStart = new Date(range.start).getTime();
  const rangeEnd = new Date(range.end).getTime();
  let total = 0;
  for (const row of assignments) {
    if (row.staff_id !== staffId) continue;
    if (!['active', 'draft', 'pending_approval', 'approved'].includes(row.project_status)) continue;
    const start = new Date(row.start).getTime();
    const end = new Date(row.end).getTime();
    if (end < rangeStart || start > rangeEnd) continue;
    total += row.pct;
  }
  return Math.round(total * 100) / 100;
}

export function computeDeliveryQuality(input: DeliveryQualityInput): {
  ontime_milestone_pct: number | null;
  client_approval_sla: number | null;
  rework_pct: number | null;
  score: number | null;
} {
  const done = input.milestones.filter((m) => m.status === 'done' || m.status === 'completed');
  const totalMilestones = input.milestones.length;
  if (totalMilestones === 0) {
    return {
      ontime_milestone_pct: null,
      client_approval_sla: null,
      rework_pct: null,
      score: null,
    };
  }

  let ontime = 0;
  for (const m of done) {
    if (!m.due_date || !m.completed_at) continue;
    if (new Date(m.completed_at).getTime() <= new Date(m.due_date).getTime()) {
      ontime += 1;
    }
  }
  const ontime_milestone_pct = done.length > 0 ? Math.round((ontime / done.length) * 1000) / 10 : null;
  const rework_pct =
    totalMilestones > 0
      ? Math.round((input.changeRequestCount / totalMilestones) * 1000) / 10
      : null;
  const client_approval_sla = done.length > 0 ? ontime_milestone_pct : null;

  const parts = [ontime_milestone_pct, rework_pct != null ? Math.max(0, 100 - rework_pct) : null].filter(
    (v): v is number => v != null,
  );
  const score = parts.length > 0 ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10 : null;

  return { ontime_milestone_pct, client_approval_sla, rework_pct, score };
}

export function defaultApprovalPolicy(needsFinance: boolean): ApprovalPolicyStep[] {
  const chain: ApprovalPolicyStep[] = [
    { role: 'pm', label: 'PM' },
    { role: 'delivery_director', label: 'Delivery Director' },
  ];
  if (needsFinance) {
    chain.push({ role: 'finance', label: 'Finance' });
  }
  return chain;
}

export function parseApprovalPolicy(raw: unknown, needsFinance: boolean): ApprovalPolicyStep[] {
  if (!raw || typeof raw !== 'object') return defaultApprovalPolicy(needsFinance);
  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length === 0) return defaultApprovalPolicy(needsFinance);
  return steps
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const role = String((s as { role?: string }).role ?? '').trim();
      const label = String((s as { label?: string }).label ?? role).trim();
      if (!role) return null;
      return { role, label: label || role };
    })
    .filter((s): s is ApprovalPolicyStep => s != null);
}

export function isoWeekStart(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
