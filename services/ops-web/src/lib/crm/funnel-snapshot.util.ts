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
