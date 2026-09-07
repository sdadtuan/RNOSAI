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
