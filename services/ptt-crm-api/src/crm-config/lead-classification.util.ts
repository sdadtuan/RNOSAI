import { DEFAULT_LEAD_CLASSIFICATION_CONFIG, DEFAULT_LEVEL_TIERS } from './lead-classification.defaults';
import type {
  LeadClassificationConfig,
  LeadFlowClassificationProfile,
  LeadLevelTier,
  LeadRoutingRule,
} from './lead-classification.types';
import type { LeadFlowKind } from '../leads-funnel/lead-flow-kind.util';

function norm(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function clampScore(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function normalizeTier(raw: Partial<LeadLevelTier>, index: number): LeadLevelTier {
  const fallback = DEFAULT_LEVEL_TIERS[index] ?? DEFAULT_LEVEL_TIERS[DEFAULT_LEVEL_TIERS.length - 1];
  const min = clampScore(raw.min_score, fallback.min_score);
  const max = clampScore(raw.max_score, fallback.max_score);
  return {
    id: String(raw.id ?? fallback.id).trim() || fallback.id,
    label: String(raw.label ?? fallback.label).trim() || fallback.label,
    emoji: String(raw.emoji ?? fallback.emoji).trim() || fallback.emoji,
    description: String(raw.description ?? fallback.description).trim(),
    sla_label: String(raw.sla_label ?? fallback.sla_label).trim(),
    min_score: Math.min(min, max),
    max_score: Math.max(min, max),
    enabled: raw.enabled !== false,
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : index + 1,
  };
}

function normalizeFlowProfile(
  raw: Partial<LeadFlowClassificationProfile> | undefined,
): LeadFlowClassificationProfile {
  const tiersRaw = Array.isArray(raw?.level_tiers) ? raw!.level_tiers : [];
  const tiers =
    tiersRaw.length > 0
      ? tiersRaw.map((tier, index) => normalizeTier(tier as Partial<LeadLevelTier>, index))
      : DEFAULT_LEVEL_TIERS.map((t) => ({ ...t }));
  tiers.sort((a, b) => a.sort_order - b.sort_order);
  return {
    level_tiers: tiers,
    default_inbound_score: clampScore(raw?.default_inbound_score, 75),
  };
}

function normalizeRoutingRule(raw: Partial<LeadRoutingRule>, index: number): LeadRoutingRule {
  const flowKind = raw.flow_kind === 'spa_operational' ? 'spa_operational' : 'b2b_prospect';
  const requiresClient =
    raw.requires_client === true ? true : raw.requires_client === false ? false : null;
  return {
    id: String(raw.id ?? `rule_${index + 1}`).trim() || `rule_${index + 1}`,
    label: String(raw.label ?? '').trim(),
    channel: norm(raw.channel) || '*',
    source: norm(raw.source) || '*',
    requires_client: requiresClient,
    flow_kind: flowKind,
    priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 50 - index,
    enabled: raw.enabled !== false,
  };
}

export function mergeLeadClassificationConfig(raw: unknown): LeadClassificationConfig {
  const base = DEFAULT_LEAD_CLASSIFICATION_CONFIG;
  if (!raw || typeof raw !== 'object') return structuredClone(base);
  const input = raw as Partial<LeadClassificationConfig>;
  const defaultFlow =
    input.default_flow_kind === 'spa_operational' ? 'spa_operational' : 'b2b_prospect';
  const flowsInput = (input.flows ?? {}) as Partial<
    Record<LeadFlowKind, Partial<LeadFlowClassificationProfile>>
  >;
  const routingRaw = Array.isArray(input.routing_rules) ? input.routing_rules : base.routing_rules;
  return {
    default_flow_kind: defaultFlow,
    flows: {
      b2b_prospect: normalizeFlowProfile(flowsInput.b2b_prospect ?? base.flows.b2b_prospect),
      spa_operational: normalizeFlowProfile(flowsInput.spa_operational ?? base.flows.spa_operational),
    },
    routing_rules: routingRaw.map((rule, index) => normalizeRoutingRule(rule as Partial<LeadRoutingRule>, index)),
  };
}

function wildcardMatch(ruleValue: string, actual: string): boolean {
  if (!ruleValue || ruleValue === '*') return true;
  return ruleValue === actual;
}

export function matchLeadRoutingRule(input: {
  channel?: string | null;
  source?: string | null;
  clientId?: string | null;
  rules: LeadRoutingRule[];
}): LeadRoutingRule | null {
  const channel = norm(input.channel);
  const source = norm(input.source);
  const hasClient = Boolean(norm(input.clientId));
  const active = input.rules.filter((rule) => rule.enabled);
  const sorted = [...active].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (!wildcardMatch(rule.channel, channel)) continue;
    if (!wildcardMatch(rule.source, source)) continue;
    if (rule.requires_client === true && !hasClient) continue;
    if (rule.requires_client === false && hasClient) continue;
    return rule;
  }
  return null;
}

export function resolveFlowKindFromRoutingRules(input: {
  channel?: string | null;
  source?: string | null;
  clientId?: string | null;
  config: LeadClassificationConfig;
}): LeadFlowKind {
  const matched = matchLeadRoutingRule({
    channel: input.channel,
    source: input.source,
    clientId: input.clientId,
    rules: input.config.routing_rules,
  });
  return matched?.flow_kind ?? input.config.default_flow_kind;
}
