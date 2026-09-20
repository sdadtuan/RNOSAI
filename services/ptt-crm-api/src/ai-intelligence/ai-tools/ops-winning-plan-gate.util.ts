/** P6/P8 — Winning-plan gate (TMMT ≥6/12 + 4 core quality + approved insight + geography). */

import { WINNING_PLAN_UI_COPY } from './ops-consult-ready.util';
import {
  resolveFieldStatus,
  statusSatisfiesGate,
  type FieldQualityMeta,
} from './ops-field-quality.util';

export type WinningPlanBlockerCode =
  | 'tmmt_gate'
  | 'core_unconfirmed'
  | 'no_approved_insight'
  | 'geography_missing'
  | 'kpi_targets_malformed';

export type WinningPlanBlocker = {
  code: WinningPlanBlockerCode;
  detail: string;
};

export type WinningPlanGateInput = {
  tmmt_gate_passed: boolean;
  tmmt_progress?: string;
  approved_insight_count: number;
  geography_resolved: boolean;
  geography_detail?: string;
  kpi_targets_malformed?: boolean;
  /** Soft mode — do not fail on malformed KPI (default true = check when provided). */
  strict_kpi?: boolean;
  /**
   * P8 — optional per-core quality. When provided, each core must be
   * validated|assumed_confirmed (assumed_draft alone fails).
   */
  core_fields?: Partial<
    Record<
      'market_context' | 'segmentation_icp' | 'personas_roles' | 'pains_desired_outcomes',
      FieldQualityMeta | { text?: string; meta?: unknown }
    >
  >;
};

export type WinningPlanGateResult = {
  pass: boolean;
  winning_plan_ready: boolean;
  blockers: WinningPlanBlocker[];
  links: string[];
  ui_copy: typeof WINNING_PLAN_UI_COPY;
};

export const WINNING_PLAN_CORE_KEYS = [
  'market_context',
  'segmentation_icp',
  'personas_roles',
  'pains_desired_outcomes',
] as const;

export function buildWinningPlanLinks(input: {
  lifecycle_id?: number | null;
  plan_id?: number | null;
}): string[] {
  const links: string[] = [];
  if (input.lifecycle_id != null && input.lifecycle_id > 0) {
    links.push(`/crm/service-delivery/${input.lifecycle_id}?tab=tmmt`);
  }
  if (input.plan_id != null && input.plan_id > 0) {
    links.push(`/crm/marketing-plan/${input.plan_id}`);
  }
  return links;
}

export function evaluateWinningPlanGate(
  input: WinningPlanGateInput,
  linkIds: { lifecycle_id?: number | null; plan_id?: number | null } = {},
): WinningPlanGateResult {
  const blockers: WinningPlanBlocker[] = [];

  if (!input.tmmt_gate_passed) {
    blockers.push({
      code: 'tmmt_gate',
      detail: String(input.tmmt_progress ?? '').trim() || 'TMMT gate not passed',
    });
  }

  if (input.core_fields) {
    const unconfirmed: string[] = [];
    for (const key of WINNING_PLAN_CORE_KEYS) {
      const raw = input.core_fields[key];
      if (!raw) {
        unconfirmed.push(`${key}=missing`);
        continue;
      }
      const meta =
        'status' in raw
          ? resolveFieldStatus({ text: (raw as FieldQualityMeta).text, meta: raw })
          : resolveFieldStatus(raw as { text?: string; meta?: unknown });
      if (!statusSatisfiesGate(meta)) {
        unconfirmed.push(`${key}=${meta.status}`);
      }
    }
    if (unconfirmed.length) {
      blockers.push({
        code: 'core_unconfirmed',
        detail: unconfirmed.join(', '),
      });
    }
  }

  if (Number(input.approved_insight_count) < 1) {
    blockers.push({
      code: 'no_approved_insight',
      detail: '',
    });
  }
  if (!input.geography_resolved) {
    blockers.push({
      code: 'geography_missing',
      detail: String(input.geography_detail ?? '').trim(),
    });
  }
  const strictKpi = input.strict_kpi !== false;
  if (strictKpi && input.kpi_targets_malformed === true) {
    blockers.push({
      code: 'kpi_targets_malformed',
      detail: 'KPI targets malformed or empty',
    });
  }

  const pass = blockers.length === 0;
  return {
    pass,
    winning_plan_ready: pass,
    blockers,
    links: buildWinningPlanLinks(linkIds),
    ui_copy: WINNING_PLAN_UI_COPY,
  };
}

export function winningPlanGateFailedBody(
  gate: WinningPlanGateResult,
): {
  ok: false;
  error: 'winning_plan_gate_failed';
  http: 409;
  blockers: WinningPlanBlocker[];
  links: string[];
} {
  return {
    ok: false,
    error: 'winning_plan_gate_failed',
    http: 409,
    blockers: gate.blockers,
    links: gate.links,
  };
}

/** Scale-ads / media spend style tasks are blocked when gate fails. */
export function isScaleAdsStyleTask(title: string, tags: string[] = []): boolean {
  const corpus = [title, ...tags].join(' ').toLowerCase();
  return (
    /scale\s*winning/.test(corpus) ||
    /launch\s*cpl/.test(corpus) ||
    /scale[_\s-]?ads/.test(corpus) ||
    /media\s*spend/.test(corpus) ||
    /boost\s*budget/.test(corpus)
  );
}

/** Research / TMMT / insight tasks remain allowed when gate fails. */
export function isResearchOrTmmtStyleTask(title: string, tags: string[] = []): boolean {
  const corpus = [title, ...tags].join(' ').toLowerCase();
  return (
    /\btmmt\b/.test(corpus) ||
    /\bresearch\b/.test(corpus) ||
    /\binsight\b/.test(corpus) ||
    /thuyết minh thị trường/.test(corpus) ||
    /discovery/.test(corpus) ||
    /consult\s*audit/.test(corpus)
  );
}
