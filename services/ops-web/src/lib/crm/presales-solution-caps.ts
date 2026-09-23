import { hasCap, type StoredStaffUser } from '@/lib/auth';

export interface PresalesSolutionCaps {
  canView: boolean;
  canEditConsult: boolean;
  canClaim: boolean;
  canRelease: boolean;
  canHandoff: boolean;
  /** True GĐKD/CEO desk — not crm_leads.assign (AE also had assign historically). */
  isGdkd: boolean;
  /** AE / sales tracking: view queue of own leads only, no claim/release. */
  isAeTrackOnly: boolean;
}

export function resolvePresalesSolutionCaps(user: StoredStaffUser | null): PresalesSolutionCaps {
  const isGdkd = Boolean(
    user &&
      (hasCap(user, 'crm_gdkd', 'view_all_leads') ||
        hasCap(user, 'crm_gdkd', 'assign') ||
        hasCap(user, 'crm_gdkd', 'override')),
  );
  const canClaim = Boolean(user && (hasCap(user, 'crm_presales_solution', 'claim') || isGdkd));
  const canRelease = Boolean(user && (hasCap(user, 'crm_presales_solution', 'release') || isGdkd));
  const canEditConsult = Boolean(
    user && (hasCap(user, 'crm_presales_solution', 'edit') || isGdkd),
  );
  const canView = Boolean(
    user && (hasCap(user, 'crm_presales_solution', 'view') || hasCap(user, 'crm_leads', 'view')),
  );
  return {
    canView,
    canEditConsult,
    canClaim,
    canRelease,
    canHandoff: Boolean(user && hasCap(user, 'crm_leads', 'edit')),
    isGdkd,
    isAeTrackOnly: Boolean(canView && !canClaim && !canRelease && !canEditConsult),
  };
}

export function isConsultWorkspaceReadOnly(
  funnel: { presales?: { handoff?: { status?: string } } | null } | null,
  caps: PresalesSolutionCaps,
): boolean {
  const status = String(funnel?.presales?.handoff?.status ?? '');
  if (status !== 'pending' && status !== 'with_solution') return false;
  return !caps.canEditConsult;
}
