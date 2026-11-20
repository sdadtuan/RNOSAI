import {
  POLICY_BUNDLE_VERSION,
  PolicyContext,
  PolicyEvaluateResult,
  PolicyId,
} from './policy.types';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';

function evaluateRelease(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'presales.no_release_without_handoff';
  const withSolution = ctx.handoff_status === 'with_solution';
  const discoveryAllow =
    withSolution && ctx.discovery_handoff_flow === true && ctx.has_solution_file === true;
  const legacyAllow =
    withSolution &&
    ctx.has_handoff_activity === true &&
    ctx.consult_complete === true &&
    ctx.preliminary_plan_ok === true;
  const allow = discoveryAllow || legacyAllow;
  let reason: string | undefined;
  if (!allow) {
    if (withSolution && ctx.discovery_handoff_flow === true && ctx.has_solution_file !== true) {
      reason = 'Solution release requires an uploaded Solution file.';
    } else {
      reason =
        'Solution release requires handoff activity, completed Consult tasks, and valid preliminary MKT plan.';
    }
  }
  return {
    allow,
    policy_id: policyId,
    reason,
    bundle_version: POLICY_BUNDLE_VERSION,
  };
}

function evaluateClaim(ctx: PolicyContext): PolicyEvaluateResult {
  const policyId: PolicyId = 'presales.no_claim_without_mkt_set';
  const allow =
    isSuperAdminPositionCode(ctx.position_code) ||
    ctx.gdkd_assign === true ||
    ctx.can_receive_solution === true;
  return {
    allow,
    policy_id: policyId,
    reason: allow
      ? undefined
      : 'Solution claim requires Nhận Solution (crm_staff.can_receive_solution) or GDKD desk override.',
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
