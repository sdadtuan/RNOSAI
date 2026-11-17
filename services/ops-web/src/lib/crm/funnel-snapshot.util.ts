import type { LeadFunnelSnapshot } from '@/lib/api';

/** Safe read — `funnel?.care_pipeline.all_complete` throws when care_pipeline is missing. */
export function funnelB2Complete(funnel: LeadFunnelSnapshot | null | undefined): boolean {
  return Boolean(funnel?.care_pipeline?.all_complete);
}

export function funnelPresalesStage(funnel: LeadFunnelSnapshot | null | undefined): string | null {
  const stage = funnel?.presales?.presales?.stage;
  return stage != null && String(stage).trim() ? String(stage) : null;
}

export function funnelServiceSlug(funnel: LeadFunnelSnapshot | null | undefined): string | null {
  const slug = funnel?.presales?.presales?.service_slug;
  return slug != null && String(slug).trim() ? String(slug) : null;
}

export function normalizeAgencyClientId(value: unknown): string | null {
  const id = String(value ?? '').trim();
  return id || null;
}

type PresalesOwnerFields = { assigned_am?: number | null };

/** Hide assigned_am when it is unset or still equal to the Sales owner. */
export function effectiveAssignedAmId(
  assignedAm: number | null | undefined,
  salesOwnerId?: number | null,
): number | null {
  const id = Number(assignedAm);
  if (!Number.isFinite(id) || id <= 0) return null;
  const sales = Number(salesOwnerId);
  if (Number.isFinite(sales) && sales > 0 && id === sales) return null;
  return id;
}

export function funnelAssignedAmId(
  funnel: LeadFunnelSnapshot | null | undefined,
  salesOwnerId?: number | null,
): number | null {
  const block = funnel?.presales as
    | (PresalesOwnerFields & { presales?: PresalesOwnerFields })
    | null
    | undefined;
  const raw = block?.presales?.assigned_am ?? block?.assigned_am;
  return effectiveAssignedAmId(
    Number.isFinite(Number(raw)) ? Number(raw) : null,
    salesOwnerId,
  );
}
