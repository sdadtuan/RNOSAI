import { deriveHubStatus, type HubDirection, type HubPerfStatus } from '../kpi-hub-status';
import {
  applyDataIssuePrecedence,
  deltaPct,
  pickBottleneck,
  tileCodesFor,
  weightedPipeline,
  type CommandPersona,
} from './command-center.util';

export const EXEC_FUNNEL = ['MKT_001', 'MKT_002', 'MKT_007', 'SAL_001', 'SAL_003', 'SAL_WON'] as const;
export const MKT_FUNNEL = ['MKT_IMP', 'MKT_CLK', 'MKT_001', 'MKT_002', 'MKT_007'] as const;
export const SALES_FUNNEL = ['MKT_007', 'SAL_001', 'SAL_003', 'SAL_PROP', 'SAL_NEG', 'SAL_WON'] as const;

const DEFAULT_TILE_NAMES: Record<string, string> = {
  SAL_008: 'Doanh thu kỳ mới',
  SAL_005: 'Pipeline đang mở',
  SAL_005W: 'Pipeline có trọng số',
  MKT_002: 'Valid Leads',
  MKT_006: 'CPL Valid Lead',
  MKT_008: 'MQL Rate',
  SAL_007: 'Win Rate',
  MKT_004: 'Tổng chi tiêu',
  MKT_001: 'Raw Leads',
  MKT_009: 'ROAS',
  SAL_001: 'SQL',
  SAL_003: 'Cuộc hẹn hoàn thành',
};

const FUNNEL_STAGE_NAMES: Record<string, string> = {
  MKT_001: 'Raw Leads',
  MKT_002: 'Valid Leads',
  MKT_007: 'MQL',
  MKT_IMP: 'Impressions',
  MKT_CLK: 'Clicks',
  SAL_001: 'SQL',
  SAL_003: 'Cuộc hẹn',
  SAL_PROP: 'Proposal',
  SAL_NEG: 'Negotiation',
  SAL_WON: 'Deal Won',
};

export type CommandTile = {
  code: string;
  name: string;
  actual: number | null;
  formatted: string;
  target: number | null;
  status: string;
  delta_pct: number | null;
  sparkline: number[];
  freshness: string;
};

export type CommandCenterResponse = {
  persona: CommandPersona;
  period: { from: string; to: string; timezone: 'Asia/Ho_Chi_Minh'; compare: boolean };
  tiles: CommandTile[];
  series: {
    actual: Array<{ date: string; value: number | null }>;
    target: Array<{ date: string; value: number | null }>;
    forecast: null;
  };
  at_risk: Array<{
    id: string;
    severity: string;
    kpi_code: string;
    name: string;
    scope: string;
    actual: number | null;
    target: number | null;
    owner: string | null;
    sla_hours: number | null;
  }>;
  funnel: {
    stages: Array<{
      code: string;
      name: string;
      value: number | null;
      conversion_from_prev: number | null;
    }>;
    bottleneck: { code: string; label: string };
  };
  trust: { score: number | null; sources: Array<{ system: string; status: string; last_success_at: string | null }> };
  approvals: {
    kpi_count: number;
    target_count: number;
    mapping_count: number;
    recent: Array<{ id: string; kind: string; label: string }>;
  };
  exceptions: Array<{
    id: string;
    priority: string;
    object: string;
    issue: string;
    impact: string;
    owner: string | null;
    sla: string | null;
    status: string;
  }>;
  marketing?: {
    spend_series: Array<{ date: string; spend: number | null; valid_leads: number | null; cpl_target: number | null }>;
    channels: Array<{ channel: string; pct: number | null; spend: number | null; cpl: number | null }>;
    campaigns: Array<Record<string, unknown>>;
    creatives: Array<Record<string, unknown>>;
    insight: string | null;
    grain: { adset: boolean; creative: boolean; landing: boolean };
  };
  sales?: {
    pipeline_stacks: Array<{ stage: string; amount: number | null }>;
    sla: {
      actual_minutes: number | null;
      target_minutes: number;
      buckets: Record<string, number>;
      overdue_count: number;
    };
    team_rows: Array<Record<string, unknown>>;
    deals_at_risk: Array<{ id: string; name: string; amount: number | null; flags: string[]; href: string }>;
    weighted_badge: 'weighted' | 'unweighted';
  };
};

type TargetMeta = {
  target: number | null;
  warning: number | null;
  critical: number | null;
  direction: string;
  name: string;
};

export function funnelCodesFor(persona: CommandPersona): readonly string[] {
  switch (persona) {
    case 'executive':
      return EXEC_FUNNEL;
    case 'marketing':
      return MKT_FUNNEL;
    case 'sales':
      return SALES_FUNNEL;
  }
}

export function buildCommandTiles(input: {
  persona: CommandPersona;
  facts: Map<string, number | null>;
  prevFacts: Map<string, number | null>;
  targets: Map<string, TargetMeta>;
  freshnessByCode: Map<string, string>;
  dqCritical: boolean;
  sparklines: Map<string, number[]>;
  format: (code: string, v: number | null) => string;
}): CommandTile[] {
  const tiles: CommandTile[] = [];

  for (const code of tileCodesFor(input.persona)) {
    if (code === 'SAL_005W') {
      const amount = input.facts.get('SAL_005') ?? null;
      const probability = input.facts.get('SAL_005_P') ?? null;
      const { value, weighted } = weightedPipeline(amount, probability);
      const targetMeta = input.targets.get('SAL_005');
      const direction = (targetMeta?.direction ?? 'HIGHER_IS_BETTER') as HubDirection;
      const rawStatus = deriveHubStatus({
        direction,
        actual: value,
        target: targetMeta?.target ?? null,
        warning: targetMeta?.warning ?? null,
        critical: targetMeta?.critical ?? null,
      });
      const freshness = input.freshnessByCode.get('SAL_005') ?? 'UNKNOWN';
      const status = applyDataIssuePrecedence(rawStatus, freshness, input.dqCritical);
      const sparkRaw = input.sparklines.get('SAL_005') ?? [];
      const sparkline = sparkRaw.length >= 2 ? sparkRaw : [];

      tiles.push({
        code: 'SAL_005W',
        name: targetMeta?.name ?? DEFAULT_TILE_NAMES.SAL_005W,
        actual: value,
        formatted: input.format('SAL_005W', value),
        target: targetMeta?.target ?? null,
        status,
        delta_pct: deltaPct(value, input.prevFacts.get('SAL_005') ?? null),
        sparkline,
        freshness,
        ...(weighted ? {} : {}),
      });
      continue;
    }

    const actual = input.facts.get(code) ?? null;
    const targetMeta = input.targets.get(code);
    const direction = (targetMeta?.direction ?? 'HIGHER_IS_BETTER') as HubDirection;
    const rawStatus: HubPerfStatus = deriveHubStatus({
      direction,
      actual,
      target: targetMeta?.target ?? null,
      warning: targetMeta?.warning ?? null,
      critical: targetMeta?.critical ?? null,
    });
    const freshness = input.freshnessByCode.get(code) ?? 'UNKNOWN';
    const status = applyDataIssuePrecedence(rawStatus, freshness, input.dqCritical);
    const sparkRaw = input.sparklines.get(code) ?? [];
    const sparkline = sparkRaw.length >= 2 ? sparkRaw : [];

    tiles.push({
      code,
      name: targetMeta?.name ?? DEFAULT_TILE_NAMES[code] ?? code,
      actual,
      formatted: input.format(code, actual),
      target: targetMeta?.target ?? null,
      status,
      delta_pct: deltaPct(actual, input.prevFacts.get(code) ?? null),
      sparkline,
      freshness,
    });
  }

  return tiles;
}

export function buildCommandFunnel(
  persona: CommandPersona,
  facts: Map<string, number | null>,
): CommandCenterResponse['funnel'] {
  const codes = funnelCodesFor(persona);
  const stages = codes.map((code, idx) => {
    const value = facts.has(code) ? (facts.get(code) ?? null) : null;
    const prev = idx > 0 ? (facts.get(codes[idx - 1]) ?? null) : null;
    const conversion_from_prev =
      prev != null && prev > 0 && value != null ? Math.round((value / prev) * 1000) / 1000 : null;
    return {
      code,
      name: FUNNEL_STAGE_NAMES[code] ?? code,
      value,
      conversion_from_prev,
    };
  });

  const bottleneckStages = stages.map((s, idx) => ({
    code: s.code,
    name: s.name,
    conversion: s.conversion_from_prev,
    targetConversion: idx === 2 ? 0.35 : null,
    kpiStatus: s.code === 'MKT_008' ? 'CRITICAL' : undefined,
  }));

  const bottleneck = pickBottleneck(bottleneckStages);

  return { stages, bottleneck };
}

export function formatKpiValue(code: string, value: number | null): string {
  if (value == null) return '—';
  if (code.startsWith('MKT_00') && (code === 'MKT_008' || code.endsWith('007'))) {
    return `${value}%`;
  }
  if (code === 'SAL_007') return `${value}%`;
  if (code === 'MKT_009') return `${value}x`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} tỷ đ`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} tr đ`;
  if (value >= 1_000) return value.toLocaleString('vi-VN');
  return String(value);
}
