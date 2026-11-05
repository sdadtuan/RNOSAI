import type { RenderGateInput } from './cp.types';

export function renderBlockReasons(input: RenderGateInput): string[] {
  const reasons: string[] = [];
  if (!input.aiEnabled) reasons.push('ai_disabled');
  if (!input.hasRenderCap) reasons.push('missing_render_cap');
  if (input.assetState && input.assetState !== 'ready') reasons.push('asset_not_ready');
  if (input.rightsExpired) reasons.push('rights_expired');
  if (input.creditBlocked) reasons.push('credit_blocked');
  if (input.moderationBlocked) reasons.push('moderation_blocked');
  if (input.qcStatus === 'blocked' || input.qcStatus === 'failed') reasons.push('qc_blocked');
  if (input.brandRuleEnforcement === 'block_render') reasons.push('brand_rule_block');
  return reasons;
}
