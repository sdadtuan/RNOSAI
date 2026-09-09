import { BadRequestException } from '@nestjs/common';
import { evaluatePolicyPack, type PolicyPack, type PolicyViolation } from './service-kpi-policy-pack';
import type { SkpiClassification } from './service-kpi-classification';
import type { ServiceKpiPolicyPackRow } from './service-kpi.types';

export function rowToPolicyPack(row: ServiceKpiPolicyPackRow): PolicyPack {
  return {
    industry: row.industry,
    regulated: row.regulated,
    banned_phrases: row.banned_phrases,
    rules: row.rules_json as PolicyPack['rules'],
  };
}

export function collectProposalText(input: {
  title?: string | null;
  objective?: string | null;
  clauses?: Array<{ body?: string | null }>;
  kpis?: Array<{ name?: string | null; assumption?: string | null; value_text?: string | null }>;
}): string {
  const parts: string[] = [];
  if (input.title?.trim()) parts.push(input.title.trim());
  if (input.objective?.trim()) parts.push(input.objective.trim());
  for (const clause of input.clauses ?? []) {
    if (clause.body?.trim()) parts.push(clause.body.trim());
  }
  for (const kpi of input.kpis ?? []) {
    if (kpi.name?.trim()) parts.push(kpi.name.trim());
    if (kpi.assumption?.trim()) parts.push(kpi.assumption.trim());
    if (kpi.value_text?.trim()) parts.push(kpi.value_text.trim());
  }
  return parts.join(' ');
}

export function findBannedPhraseViolations(pack: PolicyPack, proposalText: string): PolicyViolation[] {
  return evaluatePolicyPack({
    pack,
    classification: 'PROJECTED_RESULT' as SkpiClassification,
    proposalText,
  }).filter((v) => v.code === 'PACK_BANNED_PHRASE');
}

export function assertBannedPhrases(pack: PolicyPack, proposalText: string): void {
  const violations = findBannedPhraseViolations(pack, proposalText);
  if (!violations.length) return;
  throw new BadRequestException({
    error: 'kpi_policy_banned_phrase',
    message: violations[0]?.message,
    violations,
  });
}

export function resolveStudioIndustry(snapshot: Record<string, unknown>): string {
  const studio =
    snapshot.studio && typeof snapshot.studio === 'object' && !Array.isArray(snapshot.studio)
      ? (snapshot.studio as Record<string, unknown>)
      : {};
  return String(studio.industry ?? snapshot.industry ?? '').trim();
}
