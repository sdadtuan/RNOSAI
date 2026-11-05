import { evaluateRuleSet } from './cp-brand.service';
import { renderBlockReasons } from './cp-render-block.util';

it('blocks when AI off, asset not ready, rights expired, or QC blocked', () => {
  expect(renderBlockReasons({
    aiEnabled: false, hasRenderCap: true, assetState: 'ready',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: 'passed',
  })).toContain('ai_disabled');
  expect(renderBlockReasons({
    aiEnabled: true, hasRenderCap: true, assetState: 'processing',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: null,
  })).toContain('asset_not_ready');
});

it('lets prompt/script drafts render when no asset is attached', () => {
  expect(renderBlockReasons({
    aiEnabled: true, hasRenderCap: true, assetState: null,
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: null,
  })).not.toContain('asset_not_ready');
  expect(renderBlockReasons({
    aiEnabled: true, hasRenderCap: true, assetState: '',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: null,
  })).not.toContain('asset_not_ready');
});

it('adds brand_rule_block when evaluateRules says block_render', () => {
  expect(renderBlockReasons({
    aiEnabled: true, hasRenderCap: true, assetState: 'ready',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: 'passed',
    brandRuleEnforcement: 'block_render',
  })).toContain('brand_rule_block');
  expect(renderBlockReasons({
    aiEnabled: true, hasRenderCap: true, assetState: 'ready',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: 'passed',
    brandRuleEnforcement: 'warning',
  })).not.toContain('brand_rule_block');
});

it('blocks render when a scoped block_render rule matches without ctx.scope', () => {
  const brandRule = evaluateRuleSet([{
    enforcement: 'block_render',
    action_json: { watermark: true },
    condition_json: { scope: 'client' },
  }], { output_type: 'video' });

  expect(brandRule.enforcement).toBe('block_render');
  expect(renderBlockReasons({
    aiEnabled: true, hasRenderCap: true, assetState: 'ready',
    rightsExpired: false, creditBlocked: false, moderationBlocked: false, qcStatus: 'passed',
    brandRuleEnforcement: brandRule.enforcement,
  })).toContain('brand_rule_block');
});
