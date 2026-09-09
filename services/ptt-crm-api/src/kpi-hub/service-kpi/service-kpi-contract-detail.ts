import {
  aggressivenessFromTarget,
  type ContractScoreResult,
} from './service-kpi-contract-score';

export type ContractInstanceInput = {
  dictionary_id: string;
  dv_code?: string | null;
  classification: string;
  target_min: number | null;
  target_max: number | null;
  assumption_state: string;
  assumption_text: string | null;
  disclaimer_text: string | null;
  client_visible: boolean;
};

export type ContractGateRow = {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'critical' | 'default';
};

export type ContractKpiSummary = {
  dictionary_id: string;
  classification: string;
  target_min: number | null;
  target_max: number | null;
  assumption_state: string;
  assumption_text: string | null;
  disclaimer_text: string | null;
  client_visible: boolean;
  aggressiveness_pct: number | null;
};

export type ContractDetailPayload = {
  score: number;
  parts: ContractScoreResult['parts'];
  blockSubmit: boolean;
  requiredReviewers: ContractScoreResult['requiredReviewers'];
  gm_bps: number | null;
  gm_floor_bps: number;
  classification_risk: number;
  target_aggressiveness: number;
  assumption_open: number;
  data_readiness_gap: number;
  margin_pressure: number;
  industry: string | null;
  trigger_summary: string;
  trigger_policy: string;
  classification_hint: string;
  gate_rows: ContractGateRow[];
  kpis: ContractKpiSummary[];
};

function formatVnd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

function formatRange(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${formatVnd(min)}–${formatVnd(max)}`;
  if (max != null) return formatVnd(max);
  if (min != null) return formatVnd(min);
  return '—';
}

function assumptionLabel(text: string | null, state: string): string {
  if (state === 'confirmed') return 'Confirmed';
  if (state === 'not_met') return 'Not met';
  if (state === 'pending') return 'Pending client';
  return state || '—';
}

function assumptionTone(state: string): ContractGateRow['tone'] {
  if (state === 'confirmed') return 'ok';
  if (state === 'not_met') return 'critical';
  if (state === 'pending') return 'warn';
  return 'default';
}

export function buildContractDetail(input: {
  score: ContractScoreResult;
  gmBps: number | null;
  gmFloorBps: number;
  industry: string | null;
  instances: ContractInstanceInput[];
  classificationRisk: number;
  targetAggressiveness: number;
  assumptionOpen: number;
  dataReadinessGap: number;
  marginPressure: number;
}): ContractDetailPayload {
  const kpis: ContractKpiSummary[] = input.instances.map((inst) => {
    const proposed = inst.target_min ?? inst.target_max ?? 0;
    const floor = inst.target_max ?? inst.target_min ?? (proposed || 1);
    return {
      dictionary_id: inst.dictionary_id,
      classification: inst.classification,
      target_min: inst.target_min,
      target_max: inst.target_max,
      assumption_state: inst.assumption_state,
      assumption_text: inst.assumption_text,
      disclaimer_text: inst.disclaimer_text,
      client_visible: inst.client_visible,
      aggressiveness_pct: aggressivenessFromTarget(proposed, floor || proposed || 1, true),
    };
  });

  const topAggressive = [...kpis].sort((a, b) => (b.aggressiveness_pct ?? 0) - (a.aggressiveness_pct ?? 0))[0];
  const forecastVisible = kpis.filter((k) => k.client_visible && k.classification.includes('PROJECTED'));
  const pendingAssumptions = kpis.filter(
    (k) => k.assumption_state === 'pending' || k.assumption_state === 'not_met',
  );
  const missingDisclaimer = kpis.filter((k) => k.client_visible && !k.disclaimer_text?.trim());

  const gmPct = input.gmBps != null ? input.gmBps / 100 : null;
  const gmFloorPct = input.gmFloorBps / 100;
  const gmLow = input.gmBps != null && input.gmBps < input.gmFloorBps;

  const gateRows: ContractGateRow[] = [
    {
      label: `GM floor ${gmFloorPct}%`,
      value: gmPct != null ? `${gmPct.toFixed(1)}%` : '—',
      tone: gmLow ? 'critical' : gmPct != null ? 'ok' : 'default',
    },
  ];

  if (topAggressive) {
    gateRows.push({
      label: `${topAggressive.dictionary_id} template range`,
      value: formatRange(topAggressive.target_min, topAggressive.target_max),
      tone: 'default',
    });
    gateRows.push({
      label: `${topAggressive.dictionary_id} đề xuất`,
      value: formatVnd(topAggressive.target_min ?? topAggressive.target_max),
      tone: (topAggressive.aggressiveness_pct ?? 0) >= 25 ? 'critical' : 'default',
    });
  }

  for (const row of pendingAssumptions.slice(0, 3)) {
    const label = row.assumption_text?.trim()
      ? `Assumption · ${row.assumption_text.trim().slice(0, 48)}`
      : `Assumption · ${row.dictionary_id}`;
    gateRows.push({
      label,
      value: assumptionLabel(row.assumption_text, row.assumption_state),
      tone: assumptionTone(row.assumption_state),
    });
  }

  const hasDisclaimer = kpis.some((k) => k.client_visible && Boolean(k.disclaimer_text?.trim()));
  gateRows.push({
    label: 'Disclaimer forecast',
    value: hasDisclaimer ? 'Có' : missingDisclaimer.length ? 'Thiếu' : '—',
    tone: hasDisclaimer ? 'ok' : missingDisclaimer.length ? 'critical' : 'default',
  });

  let triggerSummary = 'Không block submit — score và GM trong ngưỡng.';
  if (input.score.blockSubmit) {
    const parts: string[] = [];
    if (gmLow) parts.push(`Gross margin dưới floor ${gmFloorPct}%`);
    if ((topAggressive?.aggressiveness_pct ?? 0) >= 25) {
      parts.push(
        `${topAggressive?.dictionary_id ?? 'KPI'} target aggressive ${topAggressive?.aggressiveness_pct ?? 0}%`,
      );
    }
    if (input.score.score >= 70) parts.push(`Contract Score ${input.score.score} ≥ 70`);
    triggerSummary = parts.length ? parts.join(' · ') : 'Block submit theo policy KPI Contract';
  }

  const industryHint = input.industry ? ` · ${input.industry}` : '';
  const classificationHint =
    forecastVisible.length > 0 ? `Forecast client-facing${industryHint}` : `Client-facing KPI${industryHint}`;

  return {
    score: input.score.score,
    parts: input.score.parts,
    blockSubmit: input.score.blockSubmit,
    requiredReviewers: input.score.requiredReviewers,
    gm_bps: input.gmBps,
    gm_floor_bps: input.gmFloorBps,
    classification_risk: Math.round(input.classificationRisk),
    target_aggressiveness: Math.round(input.targetAggressiveness),
    assumption_open: Math.round(input.assumptionOpen),
    data_readiness_gap: Math.round(input.dataReadinessGap),
    margin_pressure: Math.round(input.marginPressure),
    industry: input.industry,
    trigger_summary: triggerSummary,
    trigger_policy: input.score.blockSubmit
      ? 'Finance + GDKD + Strategy — Account không được publish bằng cách ẩn disclaimer.'
      : 'Theo dõi — submit quote qua Quote OS.',
    gate_rows: gateRows,
    kpis,
    classification_hint: classificationHint,
  };
}
