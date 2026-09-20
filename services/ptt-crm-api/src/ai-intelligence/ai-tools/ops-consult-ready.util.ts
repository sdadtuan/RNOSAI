/** P8 — Consult-ready gate (NO TMMT≥9). */

import { GO_THRESHOLDS } from '../../intake/intake-definitions.util';
import {
  type FieldQualityMeta,
  type FieldQualityStatus,
  statusSatisfiesGate,
} from './ops-field-quality.util';

export const CONSULT_READY_UI_COPY =
  'Đủ Tư vấn: BANT ≥ 24 + Pain (validated|assumed_confirmed) + Dịch vụ (selected|recommended_confirmed) + Go';

export const WINNING_PLAN_UI_COPY =
  'Winning gate: TMMT ≥ 6/12 + đủ 4 core + geo + Insight approved';

/** Banned / obsolete Consult formulas (must not appear in UI/API as Consult rule). */
export const OBSOLETE_CONSULT_FORMULAS = [
  '(BANT≥24)&(TMMT≥9)',
  '(BANT>=24)&(TMMT>=9)',
  'BANT≥24)&(TMMT≥9',
  'TMMT≥9',
  'TMMT>=9',
] as const;

export type ServiceStatus =
  | 'unknown'
  | 'recommended_draft'
  | 'recommended_confirmed'
  | 'selected';

export const CONSULT_SERVICE_OK: ReadonlySet<ServiceStatus> = new Set([
  'selected',
  'recommended_confirmed',
]);

export type ConsultReadyBlockerCode =
  | 'bant_below_24'
  | 'pain_unconfirmed'
  | 'service_unconfirmed'
  | 'qualify_not_go'
  | 'session_incomplete'
  | 'needs_am_rework';

export type ConsultReadyBlocker = {
  code: ConsultReadyBlockerCode;
  detail: string;
};

export type ConsultReadyInput = {
  bant_score: number;
  qualify_decision: string;
  session_completed: boolean;
  pain: FieldQualityMeta;
  /** ICP is tracked for draft UX; Consult gate does not require ICP confirmed (spec Gate A). */
  icp?: FieldQualityMeta;
  service_status: ServiceStatus;
  needs_am_rework?: boolean;
};

export type ConsultReadyResult = {
  consult_ready: boolean;
  blockers: ConsultReadyBlocker[];
  ui_copy: typeof CONSULT_READY_UI_COPY;
  pain_status: FieldQualityStatus;
  service_status: ServiceStatus;
};

export function parseServiceStatus(raw: unknown): ServiceStatus {
  const s = String(raw ?? '').trim();
  if (
    s === 'unknown' ||
    s === 'recommended_draft' ||
    s === 'recommended_confirmed' ||
    s === 'selected'
  ) {
    return s;
  }
  return 'unknown';
}

export function evaluateConsultReady(input: ConsultReadyInput): ConsultReadyResult {
  const blockers: ConsultReadyBlocker[] = [];
  const decision = String(input.qualify_decision ?? '').trim().toLowerCase();
  const bant = Number(input.bant_score) || 0;

  if (!input.session_completed) {
    blockers.push({
      code: 'session_incomplete',
      detail: 'Cần hoàn thành phiên Intake',
    });
  }
  if (decision !== 'go') {
    blockers.push({
      code: 'qualify_not_go',
      detail: `Qualify decision=${decision || '—'} (cần Go)`,
    });
  }
  if (bant < GO_THRESHOLDS.go) {
    blockers.push({
      code: 'bant_below_24',
      detail: `BANT ${bant}/30 < ${GO_THRESHOLDS.go}`,
    });
  }
  if (!statusSatisfiesGate(input.pain)) {
    blockers.push({
      code: 'pain_unconfirmed',
      detail: `pain_status=${input.pain.status}`,
    });
  }
  if (!CONSULT_SERVICE_OK.has(input.service_status)) {
    blockers.push({
      code: 'service_unconfirmed',
      detail: `service_status=${input.service_status}`,
    });
  }
  if (input.needs_am_rework) {
    blockers.push({
      code: 'needs_am_rework',
      detail: 'Lead flagged needs_am_rework',
    });
  }

  return {
    consult_ready: blockers.length === 0,
    blockers,
    ui_copy: CONSULT_READY_UI_COPY,
    pain_status: input.pain.status,
    service_status: input.service_status,
  };
}
