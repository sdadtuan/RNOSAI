import type { ServiceLifecycleRow } from '@/lib/api';
import {
  contentMarketingPilotSlugs,
  isContentOsLifecycleEligible,
} from '@/lib/content-marketing-flags';

export const CONTENT_OS_HUB = '/crm/content-os';

export function contentOsBoardHref(lifecycleId: number | string): string {
  return `/crm/service-delivery/${encodeURIComponent(String(lifecycleId))}?tab=content-os`;
}

export function filterContentOsLifecycles(
  rows: ServiceLifecycleRow[],
  allowlist: string[] = contentMarketingPilotSlugs(),
): ServiceLifecycleRow[] {
  return rows.filter((row) => isContentOsLifecycleEligible(row.service_slug, allowlist));
}
