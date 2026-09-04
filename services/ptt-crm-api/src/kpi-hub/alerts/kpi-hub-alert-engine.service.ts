import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { deriveHubStatus } from '../kpi-hub-status';
import { kpiHubMemory } from '../kpi-hub.memory-store';
import type { AlertLevel, HubPerfStatus } from '../kpi-hub.types';
import { scopeHashFromChain } from '../targets/kpi-hub-target-resolver';

export type AlertCondition = 'ENTER_WARNING' | 'ENTER_CRITICAL' | 'BACK_TO_ACHIEVED';

export type AlertRuleConfig = {
  id: string;
  dictionary_id: string;
  condition: AlertCondition;
  dedup_minutes: number;
  enabled: boolean;
};

export type AlertEvalContext = {
  rule: AlertRuleConfig;
  dictionary_id: string;
  dictionary_code: string;
  scope_hash: string;
  scope_label: string;
  period: string;
  previous_status: HubPerfStatus;
  current_status: HubPerfStatus;
  actual: number | null;
  threshold: number | null;
  now?: Date;
};

export type AlertEvalResult = {
  fired: boolean;
  deduped: boolean;
  event_id?: string;
  level?: AlertLevel;
  title?: string;
};

const SEVERITY_ORDER: Record<AlertLevel, number> = {
  INFO: 1,
  SUCCESS: 1,
  WARNING: 2,
  CRITICAL: 3,
};

const CONDITION_LEVEL: Record<AlertCondition, AlertLevel> = {
  ENTER_WARNING: 'WARNING',
  ENTER_CRITICAL: 'CRITICAL',
  BACK_TO_ACHIEVED: 'SUCCESS',
};

type DedupKey = string;

@Injectable()
export class KpiHubAlertEngineService {
  private readonly logger = new Logger(KpiHubAlertEngineService.name);
  private recentEvents = new Map<DedupKey, { level: AlertLevel; at: number }>();

  evaluateRule(ctx: AlertEvalContext): AlertEvalResult {
    if (!ctx.rule.enabled) return { fired: false, deduped: false };

    const shouldFire = this.shouldFireCondition(ctx);
    if (!shouldFire) return { fired: false, deduped: false };

    const level = CONDITION_LEVEL[ctx.rule.condition];
    const dedupKey = this.dedupKey(ctx);
    const now = ctx.now ?? new Date();
    const prior = this.recentEvents.get(dedupKey);

    if (prior) {
      const windowMs = ctx.rule.dedup_minutes * 60 * 1000;
      const withinWindow = now.getTime() - prior.at < windowMs;
      const severityUpgrade = SEVERITY_ORDER[level] > SEVERITY_ORDER[prior.level];
      if (withinWindow && !severityUpgrade) {
        return { fired: false, deduped: true };
      }
    }

    const title = this.buildTitle(ctx);
    const eventId = randomUUID();
    this.recentEvents.set(dedupKey, { level, at: now.getTime() });

    kpiHubMemory.alerts.unshift({
      id: eventId,
      rule_id: ctx.rule.id,
      dictionary_id: ctx.dictionary_id,
      dictionary_code: ctx.dictionary_code,
      level,
      title,
      scope: ctx.scope_label,
      actual: ctx.actual,
      threshold: ctx.threshold,
      status: 'OPEN',
      age: '0m',
      created_at: now.toISOString(),
      acknowledged_at: null,
      acknowledged_by: null,
    });

    return { fired: true, deduped: false, event_id: eventId, level, title };
  }

  evaluateRules(input: {
    dictionary_id: string;
    dictionary_code: string;
    period: string;
    scope_chain: { campaign?: string; team?: string; department?: string };
    scope_label: string;
    previous_status: HubPerfStatus;
    current_status: HubPerfStatus;
    actual: number | null;
    target: number | null;
    warning: number | null;
    critical: number | null;
    rules?: AlertRuleConfig[];
  }): AlertEvalResult[] {
    const scope_hash = scopeHashFromChain(input.scope_chain);
    const rules = input.rules ?? this.defaultRules(input.dictionary_id).filter((r) => r.enabled);

    return rules.flatMap((rule) => {
      const threshold = this.thresholdForCondition(rule.condition, input);
      const result = this.evaluateRule({
        rule,
        dictionary_id: input.dictionary_id,
        dictionary_code: input.dictionary_code,
        scope_hash,
        scope_label: input.scope_label,
        period: input.period,
        previous_status: input.previous_status,
        current_status: input.current_status,
        actual: input.actual,
        threshold,
      });
      return result.fired || result.deduped ? [result] : [];
    });
  }

  defaultRules(dictionaryId: string): AlertRuleConfig[] {
    return [
      {
        id: `ar-warn-${dictionaryId}`,
        dictionary_id: dictionaryId,
        condition: 'ENTER_WARNING',
        dedup_minutes: 240,
        enabled: true,
      },
      {
        id: `ar-crit-${dictionaryId}`,
        dictionary_id: dictionaryId,
        condition: 'ENTER_CRITICAL',
        dedup_minutes: 240,
        enabled: true,
      },
      {
        id: `ar-ach-${dictionaryId}`,
        dictionary_id: dictionaryId,
        condition: 'BACK_TO_ACHIEVED',
        dedup_minutes: 240,
        enabled: true,
      },
    ];
  }

  afterFactCompute(input: {
    dictionary_id: string;
    dictionary_code: string;
    period: string;
    scope_chain: { campaign?: string; team?: string; department?: string };
    scope_label: string;
    direction: string;
    actual: number | null;
    target: number | null;
    warning: number | null;
    critical: number | null;
    previous_status?: HubPerfStatus;
  }): AlertEvalResult[] {
    const current_status = deriveHubStatus({
      direction: input.direction as 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'RANGE' | 'NEUTRAL',
      actual: input.actual,
      target: input.target,
      warning: input.warning,
      critical: input.critical,
    });
    return this.evaluateRules({
      ...input,
      previous_status: input.previous_status ?? 'NO_DATA',
      current_status,
    });
  }

  clearDedupCache(): void {
    this.recentEvents.clear();
  }

  private shouldFireCondition(ctx: AlertEvalContext): boolean {
    const { previous_status, current_status, rule } = ctx;
    switch (rule.condition) {
      case 'ENTER_WARNING':
        return previous_status !== 'WARNING' && current_status === 'WARNING';
      case 'ENTER_CRITICAL':
        return previous_status !== 'CRITICAL' && current_status === 'CRITICAL';
      case 'BACK_TO_ACHIEVED':
        return previous_status !== 'ACHIEVED' && current_status === 'ACHIEVED';
      default:
        return false;
    }
  }

  private dedupKey(ctx: AlertEvalContext): DedupKey {
    return [ctx.rule.id, ctx.dictionary_id, ctx.scope_hash, ctx.period, ctx.rule.condition].join('|');
  }

  private thresholdForCondition(
    condition: AlertCondition,
    input: { target: number | null; warning: number | null; critical: number | null },
  ): number | null {
    if (condition === 'ENTER_CRITICAL') return input.critical;
    if (condition === 'ENTER_WARNING') return input.warning;
    return input.target;
  }

  private buildTitle(ctx: AlertEvalContext): string {
    const code = ctx.dictionary_code;
    switch (ctx.rule.condition) {
      case 'ENTER_WARNING':
        return `${code} vào vùng Warning`;
      case 'ENTER_CRITICAL':
        return `${code} vượt ngưỡng Critical`;
      case 'BACK_TO_ACHIEVED':
        return `${code} quay lại trạng thái Đạt`;
      default:
        return `${code} alert`;
    }
  }
}
