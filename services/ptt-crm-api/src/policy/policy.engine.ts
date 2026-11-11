import {
  POLICY_BUNDLE_VERSION,
  PolicyContext,
  PolicyEvaluateResult,
  PolicyId,
} from './policy.types';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';

const AM_POSITION_CODES = new Set(['acm', 'kd-01', 'kd01']);
const AM_SET_PATTERN = /acm|account.?manager|kd-01|kd01/i;

function normPositionCode(code: string | null | undefined): string {
  return String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function isAccountManagerDesk(code: string | null | undefined): boolean {
  const norm = normPositionCode(code);
  return AM_POSITION_CODES.has(norm);
}

function hasAmPermissionSet(permissionSets: string[] | undefined): boolean {
  return (permissionSets ?? []).some((code) => AM_SET_PATTERN.test(String(code).trim()));
}

function evaluateRelease(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'presales.no_release_without_handoff';
  const allow =
    ctx.handoff_status === 'with_solution' &&
    ctx.has_handoff_activity === true &&
    ctx.consult_complete === true &&
    ctx.preliminary_plan_ok === true;
  return {
    allow,
    policy_id: policyId,
    reason: allow
      ? undefined
      : 'Solution release requires handoff activity, completed Consult tasks, and valid preliminary MKT plan.',
    bundle_version: POLICY_BUNDLE_VERSION,
  };
}

function evaluateClaim(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'presales.no_claim_without_mkt_set';
  const allow =
    isSuperAdminPositionCode(ctx.position_code) ||
    ctx.gdkd_assign === true ||
    isAccountManagerDesk(ctx.position_code) ||
    hasAmPermissionSet(ctx.permission_sets) ||
    ctx.can_receive_solution === true;
  return {
    allow,
    policy_id: policyId,
    reason: allow
      ? undefined
      : 'Solution claim requires Account Manager (ACM/KD-01), AM permission set, or Nhận Solution.',
    bundle_version: POLICY_BUNDLE_VERSION,
  };
}

function evaluateBreakGlass(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'rbac.break_glass_not_expired';
  const deny = ctx.break_glass_active === true && ctx.break_glass_expired === true;
  return {
    allow: !deny,
    policy_id: policyId,
    reason: deny ? 'Break-glass grant expired (TTL 24h).' : undefined,
    bundle_version: POLICY_BUNDLE_VERSION,
  };
}

export function evaluatePolicy(policyId: PolicyId, ctx: PolicyContext): PolicyEvaluateResult {
  switch (policyId) {
    case 'presales.no_release_without_handoff':
      return evaluateRelease(ctx);
    case 'presales.no_claim_without_mkt_set':
      return evaluateClaim(ctx);
    case 'rbac.break_glass_not_expired':
      return evaluateBreakGlass(ctx);
    default:
      return {
        allow: false,
        policy_id: policyId,
        reason: 'unknown_policy',
        bundle_version: POLICY_BUNDLE_VERSION,
      };
  }
}

export function evaluateByAction(ctx: PolicyContext): PolicyEvaluateResult {
  if (ctx.action === 'release') {
    return evaluateRelease(ctx);
  }
  if (ctx.action === 'claim') {
    return evaluateClaim(ctx);
  }
  return evaluateBreakGlass(ctx);
}
