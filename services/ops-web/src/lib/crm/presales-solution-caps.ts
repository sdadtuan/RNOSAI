import { canGenerateMktAiPlanner, hasCap, type StoredStaffUser } from '@/lib/auth';
import { isAccountManager, isMarketingLeader } from '@/lib/crm/lead-ae-visibility';

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
  /** MKL uses implementation queue after Triển khai — not Solution/Quote claim. */
  isMklImplementationDesk?: boolean;
}

/** Lead detail + funnel reads (same rule as Solution queue). */
export function canViewCrmLeadDetail(user: StoredStaffUser | null): boolean {
  return resolvePresalesSolutionCaps(user).canView;
}

export function resolvePresalesSolutionCaps(user: StoredStaffUser | null): PresalesSolutionCaps {
  const isGdkd = Boolean(
    user &&
      (hasCap(user, 'crm_gdkd', 'view_all_leads') ||
        hasCap(user, 'crm_gdkd', 'assign') ||
        hasCap(user, 'crm_gdkd', 'override')),
  );
  const amDesk = Boolean(user && isAccountManager(user));
  const flagged = Boolean(user?.can_receive_solution);
  const mklDesk = Boolean(user && isMarketingLeader(user));
  const canClaim = Boolean(
    user && (isGdkd || flagged || (amDesk && hasCap(user, 'crm_presales_solution', 'claim')) || hasCap(user, 'crm_presales_solution', 'claim')),
  );
  const canRelease = Boolean(
    user && (isGdkd || flagged || hasCap(user, 'crm_presales_solution', 'release')),
  );
  const canEditConsult = Boolean(
    user && (isGdkd || flagged || hasCap(user, 'crm_presales_solution', 'edit')),
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
    isMklImplementationDesk: mklDesk && !amDesk,
  };
}

/** AI viết kế hoạch on Tư vấn. Solution edit covers Account Manager without the production board. */
export function canDraftConsultPlan(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  if (canGenerateMktAiPlanner(user)) return true;
  return hasCap(user, 'crm_presales_solution', 'edit') && hasCap(user, 'crm_mkt_ai', 'generate');
}

export function isConsultWorkspaceReadOnly(
  funnel: { presales?: { handoff?: { status?: string } } | null } | null,
  caps: PresalesSolutionCaps,
): boolean {
  const status = String(funnel?.presales?.handoff?.status ?? '');
  if (status !== 'pending' && status !== 'with_solution') return false;
  return !caps.canEditConsult;
}
