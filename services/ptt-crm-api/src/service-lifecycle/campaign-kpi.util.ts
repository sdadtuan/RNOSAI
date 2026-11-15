import { isAccountManagerPosition, isMarketingLeaderPosition } from '../b2b-projects/b2b-director.util';
import { isCeoPosition } from '../leads-funnel/quote-case.util';
import { isGdkdPosition } from '../ae-team/ae-performance.util';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';

export const CAMPAIGN_KPI_METRIC_KEYS = ['like_page', 'impression', 'reach', 'click', 'ctr', 'lead'] as const;
export type CampaignKpiMetricKey = (typeof CAMPAIGN_KPI_METRIC_KEYS)[number];

export const CAMPAIGN_KPI_METRIC_LABELS: Record<CampaignKpiMetricKey, string> = {
  like_page: 'Like Page',
  impression: 'Impression',
  reach: 'Reach',
  click: 'Click',
  ctr: 'CTR',
  lead: 'Lead',
};

export type CampaignKpiMetrics = Record<CampaignKpiMetricKey, number | null>;

export type CampaignKpiTargets = CampaignKpiMetrics & {
  goal: string;
  comms_period: string;
  budget_vnd: number | null;
};

export type CampaignKpiActuals = CampaignKpiMetrics & {
  updated_at: string | null;
  updated_by_staff_id: number | null;
  updated_by_name: string;
};

export type CampaignKpiActualsLogEntry = CampaignKpiMetrics & {
  at: string;
  by_staff_id: number | null;
  by_name: string;
};

export type CampaignKpiRetention = {
  retro_note: string;
  upsell_note: string;
};

export type CampaignKpiState = {
  targets: CampaignKpiTargets;
  actuals: CampaignKpiActuals;
  actuals_log: CampaignKpiActualsLogEntry[];
  ads_media_cost_vnd: number | null;
  retention: CampaignKpiRetention;
};

export type CampaignKpiAttainmentItem = {
  key: CampaignKpiMetricKey;
  label: string;
  target: number | null;
  actual: number | null;
  pct: number | null;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function parseNullableNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/%/g, '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function emptyMetrics(): CampaignKpiMetrics {
  return {
    like_page: null,
    impression: null,
    reach: null,
    click: null,
    ctr: null,
    lead: null,
  };
}

function parseMetrics(raw: unknown): CampaignKpiMetrics {
  const rec = asRecord(raw);
  const out = emptyMetrics();
  for (const key of CAMPAIGN_KPI_METRIC_KEYS) {
    out[key] = parseNullableNumber(rec[key] ?? rec[key.replace('_', '')]);
  }
  return out;
}

function parseTargets(raw: unknown): CampaignKpiTargets {
  const rec = asRecord(raw);
  return {
    goal: String(rec.goal ?? rec.muc_tieu ?? '').trim(),
    comms_period: String(rec.comms_period ?? rec.thoi_gian_truyen_thong ?? '').trim(),
    budget_vnd: parseNullableNumber(rec.budget_vnd ?? rec.ngan_sach),
    ...parseMetrics(rec),
  };
}

function parseActuals(raw: unknown): CampaignKpiActuals {
  const rec = asRecord(raw);
  return {
    ...parseMetrics(rec),
    updated_at: rec.updated_at ? String(rec.updated_at) : null,
    updated_by_staff_id: rec.updated_by_staff_id != null ? Number(rec.updated_by_staff_id) : null,
    updated_by_name: String(rec.updated_by_name ?? '').trim(),
  };
}

function parseActualsLog(raw: unknown): CampaignKpiActualsLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CampaignKpiActualsLogEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    out.push({
      ...parseMetrics(rec),
      at: String(rec.at ?? ''),
      by_staff_id: rec.by_staff_id != null ? Number(rec.by_staff_id) : null,
      by_name: String(rec.by_name ?? '').trim(),
    });
  }
  return out;
}

export function parseCampaignKpi(raw: unknown): CampaignKpiState {
  const rec = asRecord(raw);
  return {
    targets: parseTargets(rec.targets ?? rec),
    actuals: parseActuals(rec.actuals ?? {}),
    actuals_log: parseActualsLog(rec.actuals_log),
    ads_media_cost_vnd: parseNullableNumber(rec.ads_media_cost_vnd),
    retention: {
      retro_note: String(asRecord(rec.retention).retro_note ?? rec.retro_note ?? '').trim(),
      upsell_note: String(asRecord(rec.retention).upsell_note ?? rec.upsell_note ?? '').trim(),
    },
  };
}

export function serializeCampaignKpi(state: CampaignKpiState): Record<string, unknown> {
  return {
    targets: state.targets,
    actuals: state.actuals,
    actuals_log: state.actuals_log,
    ads_media_cost_vnd: state.ads_media_cost_vnd,
    retention: state.retention,
  };
}

export function campaignTargetsFilled(targets: CampaignKpiTargets): boolean {
  if (!targets.goal.trim() || !targets.comms_period.trim()) return false;
  if (targets.budget_vnd == null) return false;
  return CAMPAIGN_KPI_METRIC_KEYS.every((key) => targets[key] != null);
}

export function campaignKpiGate(targets: CampaignKpiTargets): { ok: boolean; messages: string[] } {
  if (campaignTargetsFilled(targets)) return { ok: true, messages: [] };
  return {
    ok: false,
    messages: [
      'Cần nhập KPI chiến dịch (mục tiêu, thời gian truyền thông, ngân sách và các chỉ số) trước khi chuyển Triển khai.',
    ],
  };
}

export function metricAttainmentPct(actual: number | null, target: number | null): number | null {
  if (target == null || !Number.isFinite(target) || target === 0) return null;
  if (actual == null || !Number.isFinite(actual)) return null;
  return Math.round((actual / target) * 1000) / 10;
}

export function campaignAttainment(state: CampaignKpiState): {
  items: CampaignKpiAttainmentItem[];
  overall_pct: number | null;
} {
  const items: CampaignKpiAttainmentItem[] = CAMPAIGN_KPI_METRIC_KEYS.map((key) => ({
    key,
    label: CAMPAIGN_KPI_METRIC_LABELS[key],
    target: state.targets[key],
    actual: state.actuals[key],
    pct: metricAttainmentPct(state.actuals[key], state.targets[key]),
  }));
  const scored = items.filter((item) => item.pct != null);
  const overall_pct =
    scored.length > 0
      ? Math.round((scored.reduce((sum, item) => sum + (item.pct as number), 0) / scored.length) * 10) / 10
      : null;
  return { items, overall_pct };
}

export function mergeCampaignTargets(current: CampaignKpiTargets, patch: unknown): CampaignKpiTargets {
  const rec = asRecord(patch);
  const next: CampaignKpiTargets = { ...current };
  if (rec.goal != null) next.goal = String(rec.goal).trim();
  if (rec.comms_period != null || rec.thoi_gian_truyen_thong != null) {
    next.comms_period = String(rec.comms_period ?? rec.thoi_gian_truyen_thong ?? '').trim();
  }
  if (rec.budget_vnd !== undefined || rec.ngan_sach !== undefined) {
    next.budget_vnd = parseNullableNumber(rec.budget_vnd ?? rec.ngan_sach);
  }
  for (const key of CAMPAIGN_KPI_METRIC_KEYS) {
    if (rec[key] !== undefined) next[key] = parseNullableNumber(rec[key]);
  }
  return next;
}

export function mergeCampaignActuals(
  current: CampaignKpiActuals,
  patch: unknown,
  actor: { staffId: number | null; name: string },
  at: Date,
): { actuals: CampaignKpiActuals; logEntry: CampaignKpiActualsLogEntry } {
  const rec = asRecord(patch);
  const metrics = { ...emptyMetrics(), ...current };
  for (const key of CAMPAIGN_KPI_METRIC_KEYS) {
    if (rec[key] !== undefined) metrics[key] = parseNullableNumber(rec[key]);
  }
  const actuals: CampaignKpiActuals = {
    ...metrics,
    updated_at: at.toISOString(),
    updated_by_staff_id: actor.staffId,
    updated_by_name: actor.name,
  };
  return {
    actuals,
    logEntry: {
      ...metrics,
      at: at.toISOString(),
      by_staff_id: actor.staffId,
      by_name: actor.name,
    },
  };
}

export function computeLaborCost(hours: number, hourlyVnd: number): number {
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(hourlyVnd) || hourlyVnd <= 0) return 0;
  return Math.round(hours * hourlyVnd);
}

export function computeCaseMargin(input: {
  amount_vnd: number;
  staff_cost_vnd: number;
  ads_media_cost_vnd: number | null;
}): {
  amount_vnd: number;
  staff_cost_vnd: number;
  ads_media_cost_vnd: number;
  margin_vnd: number;
  margin_pct: number | null;
} {
  const amount = Number.isFinite(input.amount_vnd) ? Math.round(input.amount_vnd) : 0;
  const staffCost = Number.isFinite(input.staff_cost_vnd) ? Math.round(input.staff_cost_vnd) : 0;
  const ads = input.ads_media_cost_vnd != null && Number.isFinite(input.ads_media_cost_vnd) ? Math.round(input.ads_media_cost_vnd) : 0;
  const margin = amount - staffCost - ads;
  return {
    amount_vnd: amount,
    staff_cost_vnd: staffCost,
    ads_media_cost_vnd: ads,
    margin_vnd: margin,
    margin_pct: amount > 0 ? Math.round((margin / amount) * 1000) / 10 : null,
  };
}

export function firstApprovalRate(decidedGates: Array<{ revision_count: number; status: string }>): number | null {
  const decided = decidedGates.filter((g) => g.status === 'approved' || g.status === 'revision_requested' || g.revision_count > 0);
  const approved = decidedGates.filter((g) => g.status === 'approved');
  if (approved.length === 0 && decided.length === 0) return null;
  const first = approved.filter((g) => (g.revision_count ?? 0) === 0).length;
  const denom = Math.max(approved.length, decided.length);
  if (denom <= 0) return null;
  return Math.round((first / denom) * 1000) / 10;
}

export function caseRevisionCount(gateRevisionSum: number, taskReworkSum: number): number {
  return Math.max(0, (Number(gateRevisionSum) || 0) + (Number(taskReworkSum) || 0));
}

export function canEditCampaignKpi(positionCode: string | null | undefined, isAssignedAm: boolean): boolean {
  return isSuperAdminPositionCode(positionCode) || isAccountManagerPosition(positionCode) || isAssignedAm;
}

export function canViewMargin(positionCode: string | null | undefined, isAssignedAm: boolean): boolean {
  return (
    canEditCampaignKpi(positionCode, isAssignedAm) ||
    isMarketingLeaderPosition(positionCode) ||
    isGdkdPosition(positionCode) ||
    isCeoPosition(positionCode)
  );
}

