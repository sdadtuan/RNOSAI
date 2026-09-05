import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeAmHealthStrip(user: StoredStaffUser | null | undefined): boolean {
  return hasCap(user ?? null, 'crm_am', 'view');
}

export function amCsHealthStripAvg(
  sparkline: Array<{ as_of: string; avg: number | null }> | null | undefined,
): number | null {
  if (!sparkline?.length) return null;
  for (let i = sparkline.length - 1; i >= 0; i -= 1) {
    const avg = sparkline[i]?.avg;
    if (avg != null && Number.isFinite(avg)) return avg;
  }
  return null;
}
