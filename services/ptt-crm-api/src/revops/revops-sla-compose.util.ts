export const REVOPS_SLA_COMPLIANCE_TARGET_PCT = 95;

export const REVOPS_SLA_DEFAULT_POLICIES = [
  {
    name: 'Lead first response 60m',
    entityType: 'lead_first_response',
    durationMinutes: 60,
    warningMinutes: 36,
  },
  {
    name: 'Handover accept 48h',
    entityType: 'handover_accept',
    durationMinutes: 2880,
    warningMinutes: 1440,
  },
  {
    name: 'Renewal prep 7d',
    entityType: 'renewal_prep',
    durationMinutes: 10080,
    warningMinutes: 7200,
  },
] as const;

export type RevopsSlaEntityType =
  | 'lead_first_response'
  | 'handover_accept'
  | 'renewal_prep';

export type ComposedSlaSourceRow = {
  entity_type: string;
  entity_id: string;
  owner_id: number | null;
  due_at: string;
  title?: string;
};

export function incidentStatusFromDue(
  dueAt: Date,
  warningMinutes: number,
  now: Date,
): 'open' | 'warning' | 'breached' {
  const dueMs = dueAt.getTime();
  const nowMs = now.getTime();
  if (nowMs >= dueMs) return 'breached';
  const warnMs = dueMs - warningMinutes * 60_000;
  if (nowMs >= warnMs) return 'warning';
  return 'open';
}

export function assignableLeadId(entityType: string, entityId: string): number | null {
  if (entityType !== 'lead_first_response') return null;
  const id = Number(entityId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function entityTypeLabel(entityType: string): string {
  if (entityType === 'lead_first_response') return 'Lead first response';
  if (entityType === 'handover_accept') return 'Handover accept';
  if (entityType === 'renewal_prep') return 'Renewal prep';
  return entityType;
}
