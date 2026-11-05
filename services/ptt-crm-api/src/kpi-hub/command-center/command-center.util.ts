export type CommandPersona = 'executive' | 'marketing' | 'sales';

export const EXEC_TILE_CODES = ['SAL_008', 'SAL_005', 'MKT_002', 'MKT_006', 'MKT_008', 'SAL_007'] as const;
export const MKT_TILE_CODES = ['MKT_004', 'MKT_001', 'MKT_002', 'MKT_006', 'MKT_008', 'MKT_009'] as const;
export const SALES_TILE_CODES = ['SAL_005', 'SAL_005W', 'SAL_001', 'SAL_003', 'SAL_007', 'SAL_008'] as const;

const VALID_PERSONAS: CommandPersona[] = ['executive', 'marketing', 'sales'];

export function isCommandPersona(value: string): value is CommandPersona {
  return (VALID_PERSONAS as string[]).includes(value);
}

export function tileCodesFor(persona: CommandPersona): readonly string[] {
  switch (persona) {
    case 'executive':
      return EXEC_TILE_CODES;
    case 'marketing':
      return MKT_TILE_CODES;
    case 'sales':
      return SALES_TILE_CODES;
  }
}

export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function applyDataIssuePrecedence(status: string, freshness: string, dqCritical: boolean): string {
  if (freshness === 'FAILED' || dqCritical) return 'DATA_ISSUE';
  return status;
}

export function pickBottleneck(
  stages: Array<{
    code: string;
    name: string;
    conversion: number | null;
    targetConversion: number | null;
    kpiStatus?: string;
  }>,
): { code: string; label: string } {
  if (stages.length === 0) return { code: '', label: '' };

  const critical = stages.find((s) => s.kpiStatus === 'CRITICAL');
  if (critical) return { code: critical.code, label: `Điểm nghẽn: ${critical.name}` };

  let worst: (typeof stages)[number] | null = null;
  let worstGap = -Infinity;
  for (const stage of stages) {
    if (stage.conversion == null || stage.targetConversion == null) continue;
    if (stage.conversion < stage.targetConversion) {
      const gap = stage.targetConversion - stage.conversion;
      if (gap > worstGap) {
        worstGap = gap;
        worst = stage;
      }
    }
  }
  if (worst) return { code: worst.code, label: `Điểm nghẽn: ${worst.name}` };

  const last = stages[stages.length - 1];
  return { code: last.code, label: `Điểm nghẽn: ${last.name}` };
}

export function weightedPipeline(
  amount: number | null,
  probability: number | null,
): { value: number | null; weighted: boolean } {
  if (amount == null) return { value: null, weighted: false };
  if (probability == null) return { value: amount, weighted: false };
  return { value: amount * probability, weighted: true };
}

export type DealRiskFlag =
  | 'no_activity'
  | 'overdue_close'
  | 'stage_aging'
  | 'missing_quote'
  | 'missing_next_step';

export function classifyDealRisk(input: {
  lastActivityAt: string | null;
  closeDate: string | null;
  todayIso: string;
  hasQuote: boolean;
  hasNextStep: boolean;
  stageAgeDays: number;
  noActivityDaysThreshold: number;
}): DealRiskFlag[] {
  const flags: DealRiskFlag[] = [];
  const today = new Date(input.todayIso);

  if (input.lastActivityAt) {
    const last = new Date(input.lastActivityAt);
    const daysSince = Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince > input.noActivityDaysThreshold) flags.push('no_activity');
  } else {
    flags.push('no_activity');
  }

  if (input.closeDate && new Date(input.closeDate) < today) {
    flags.push('overdue_close');
  }

  if (input.stageAgeDays > 21) flags.push('stage_aging');
  if (!input.hasQuote) flags.push('missing_quote');
  if (!input.hasNextStep) flags.push('missing_next_step');

  return flags;
}

export function ruleBasedInsight(input: {
  spendDeltaPct: number | null;
  validDeltaPct: number | null;
}): string | null {
  const { spendDeltaPct, validDeltaPct } = input;
  if (spendDeltaPct == null || validDeltaPct == null) return null;

  const spendDir = spendDeltaPct >= 0 ? '↑' : '↓';
  const validDir = validDeltaPct >= 0 ? '↑' : '↓';
  const spendAbs = Math.abs(spendDeltaPct);
  const validAbs = Math.abs(validDeltaPct);

  return `Chi tiêu ${spendDir} ${spendAbs}% trong khi Valid Leads ${validDir} ${validAbs}%.`;
}
