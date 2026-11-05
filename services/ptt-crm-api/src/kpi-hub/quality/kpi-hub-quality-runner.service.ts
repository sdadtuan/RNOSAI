import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { freshnessStatus } from '../kpi-hub-status';
import { kpiHubMemory } from '../kpi-hub.memory-store';
import type { HubQualityIssue, HubQualityRule, HubQualityRun } from '../kpi-hub.types';
import { KPI_HUB_QUALITY_RULE_WEIGHTS, seedKpiHubQualityRules } from './kpi-hub-quality-rules.seed';

export type QualityRuleResult = {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  pass_rate: number;
  affected_count: number;
  severity: HubQualityRule['severity'];
  weight: number;
};

@Injectable()
export class KpiHubQualityRunnerService {
  ensureSeedRules(): HubQualityRule[] {
    if (kpiHubMemory.qualityRules.length < 14) {
      kpiHubMemory.qualityRules = seedKpiHubQualityRules();
    }
    return kpiHubMemory.qualityRules;
  }

  runAll(triggeredBy: number): HubQualityRun & { results: QualityRuleResult[]; issues: HubQualityIssue[] } {
    const startedAt = new Date();
    const rules = this.ensureSeedRules().filter((r) => r.enabled);
    const results: QualityRuleResult[] = [];
    const issues: HubQualityIssue[] = [];
    const now = startedAt;

    for (const rule of rules) {
      const result = this.evaluateRule(rule, now);
      results.push(result);

      const ruleIdx = kpiHubMemory.qualityRules.findIndex((r) => r.id === rule.id);
      if (ruleIdx >= 0) {
        kpiHubMemory.qualityRules[ruleIdx] = {
          ...kpiHubMemory.qualityRules[ruleIdx],
          last_run_at: now.toISOString(),
          pass_rate: result.pass_rate,
          affected_count: result.affected_count,
        };
      }

      if (!result.passed) {
        const issue = this.createIssue(rule, result, now);
        issues.push(issue);
        kpiHubMemory.qualityIssues.unshift(issue);
      }
    }

    const score = this.weightedScore(results);
    const finishedAt = new Date();
    const run: HubQualityRun = {
      id: randomUUID(),
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      score,
      rules_passed: results.filter((r) => r.passed).length,
      rules_total: results.length,
      issues_created: issues.length,
      triggered_by: triggeredBy,
    };
    kpiHubMemory.qualityRuns.unshift(run);

    return { ...run, results, issues };
  }

  private evaluateRule(rule: HubQualityRule, now: Date): QualityRuleResult {
    if (rule.check_type === 'FRESHNESS') {
      return this.evaluateFreshness(rule, now);
    }

    const fixtureRates: Record<string, { pass_rate: number; affected: number }> = {
      'qr-p2-001': { pass_rate: 99.8, affected: 3 },
      'qr-p2-002': { pass_rate: 99.2, affected: 12 },
      'qr-p2-003': { pass_rate: 97.5, affected: 37 },
      'qr-p2-004': { pass_rate: 96.0, affected: 12 },
      'qr-p2-005': { pass_rate: 100, affected: 0 },
      'qr-p2-009': { pass_rate: 94.5, affected: 86 },
      'qr-p2-010': { pass_rate: 98.1, affected: 28 },
      'qr-p2-011': { pass_rate: 100, affected: 0 },
      'qr-p2-012': { pass_rate: 99.5, affected: 2 },
      'qr-p2-013': { pass_rate: 100, affected: 0 },
    };

    const fixture = fixtureRates[rule.id] ?? { pass_rate: 100, affected: 0 };
    const passed = fixture.pass_rate >= 95 && fixture.affected === 0 ? true : fixture.pass_rate >= 90;
    const weight = KPI_HUB_QUALITY_RULE_WEIGHTS[rule.check_type] ?? 5;

    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      pass_rate: fixture.pass_rate,
      affected_count: fixture.affected,
      severity: rule.severity,
      weight,
    };
  }

  private evaluateFreshness(rule: HubQualityRule, now: Date): QualityRuleResult {
    const source = kpiHubMemory.sources.find((s) => s.id === rule.connection_id);
    const slaMinutes = source?.sla_minutes ?? 60;
    const lastSuccess = source?.last_success_at ? new Date(source.last_success_at) : null;
    const failed = source?.status === 'FAILED';
    const status = freshnessStatus(lastSuccess, slaMinutes, failed, now);
    const passed = status === 'FRESH';
    const pass_rate = passed ? 100 : status === 'DELAYED' ? 85 : 0;
    const affected = passed ? 0 : 1;

    return {
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      pass_rate,
      affected_count: affected,
      severity: status === 'FAILED' ? 'CRITICAL' : rule.severity,
      weight: KPI_HUB_QUALITY_RULE_WEIGHTS.FRESHNESS,
    };
  }

  private weightedScore(results: QualityRuleResult[]): number {
    let totalWeight = 0;
    let earned = 0;
    for (const r of results) {
      totalWeight += r.weight;
      earned += r.passed ? r.weight : r.pass_rate >= 90 ? r.weight * 0.7 : 0;
    }
    if (totalWeight === 0) return 100;
    return Math.round((earned / totalWeight) * 100);
  }

  private createIssue(rule: HubQualityRule, result: QualityRuleResult, now: Date): HubQualityIssue {
    return {
      id: randomUUID(),
      rule_id: rule.id,
      rule_name: rule.name,
      run_id: undefined,
      status: 'OPEN',
      severity: result.severity,
      title: `${rule.name} — ${result.affected_count} bản ghi bị ảnh hưởng`,
      description: `Rule ${rule.check_type} failed with pass rate ${result.pass_rate}%`,
      affected_count: result.affected_count,
      assignee: null,
      sla_due: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      ticket_ref: null,
      sample_rows: [{ lead_id: 'L-0001', field: 'phone', value: null }],
      created_at: now.toISOString(),
    };
  }
}
