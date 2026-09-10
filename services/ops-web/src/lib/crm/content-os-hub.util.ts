import type { ServiceLifecycleRow } from '@/lib/api';
import {
  contentMarketingPilotSlugs,
  isContentOsLifecycleEligible,
} from '@/lib/content-marketing-flags';
import { legacyContentOsRedirect } from '@/lib/crm/cmkte-routes';

export const CONTENT_OS_HUB = '/crm/content-os';

export function contentOsBoardHref(lifecycleId: number | string): string {
  const id = Number(lifecycleId);
  if (Number.isFinite(id)) return legacyContentOsRedirect(id);
  return `/crm/content-os?lifecycle=${encodeURIComponent(String(lifecycleId))}`;
}

export function filterContentOsLifecycles(
  rows: ServiceLifecycleRow[],
  allowlist: string[] = contentMarketingPilotSlugs(),
): ServiceLifecycleRow[] {
  return rows.filter((row) => isContentOsLifecycleEligible(row.service_slug, allowlist));
}
