import { describe, expect, it } from '@jest/globals';
import {
  matchLeadRoutingRule,
  mergeLeadClassificationConfig,
  resolveFlowKindFromRoutingRules,
} from './lead-classification.util';

describe('lead-classification.util', () => {
  it('merges defaults when config missing', () => {
    const cfg = mergeLeadClassificationConfig(null);
    expect(cfg.flows.b2b_prospect.level_tiers.length).toBeGreaterThan(0);
    expect(cfg.routing_rules.length).toBeGreaterThan(0);
  });

  it('matches meta without client to B2B rule', () => {
    const cfg = mergeLeadClassificationConfig(null);
    const matched = matchLeadRoutingRule({
      channel: 'meta',
      source: 'facebook',
      clientId: null,
      rules: cfg.routing_rules,
    });
    expect(matched?.flow_kind).toBe('b2b_prospect');
  });

  it('resolves spa when client is present', () => {
    const cfg = mergeLeadClassificationConfig(null);
    expect(
      resolveFlowKindFromRoutingRules({
        channel: 'website',
        source: 'referral',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        config: cfg,
      }),
    ).toBe('spa_operational');
  });
});
