import { sessionHasCompleteDiscovery } from '../intake/sales-discovery.util';

export interface IntakeSessionGateRow {
  status?: string | null;
  mode?: string | null;
  decision?: string | null;
  bant_total?: number | null;
  answers_json?: Record<string, unknown>;
}

export interface ConsultAdvanceGateInput {
  leadTaskDone: boolean;
  sessions: IntakeSessionGateRow[];
  overrideReason?: string;
  allowOverride?: boolean;
  confirm?: boolean;
}

export interface ConsultAdvanceGateResult {
  ok: boolean;
  level: 'block' | 'warn' | 'ok';
  messages: string[];
  decision?: string;
  bant_total?: number;
  requires_confirm: boolean;
  requires_override: boolean;
}

/**
 * Submit-to-AM gate: discovery required fields (or a legacy completed BANT session)
 * plus lead-stage tasks. BANT / WIN / Go / No-Go are no longer conditions.
 */
export function validatePresalesConsultAdvance(input: ConsultAdvanceGateInput): ConsultAdvanceGateResult {
  const latest = [...input.sessions].sort((a, b) => Number(b.bant_total ?? 0) - Number(a.bant_total ?? 0))[0];
  const decision = String(latest?.decision || '');
  const bantTotal = Number(latest?.bant_total ?? 0);

  if (!input.leadTaskDone) {
    return block(['Hoàn thành task Lead trước khi chuyển Tư vấn'], decision, bantTotal);
  }

  const hasDiscovery = input.sessions.some((s) => sessionHasCompleteDiscovery(s.answers_json));
  const hasLegacyCompleted = input.sessions.some((s) => String(s.status || '') === 'completed');
  if (!hasDiscovery && !hasLegacyCompleted) {
    return block(['Hoàn thành Sales Discovery trước khi giao Solution'], decision, bantTotal);
  }

  return {
    ok: true,
    level: 'ok',
    messages: ['Sẵn sàng giao Solution'],
    decision,
    bant_total: bantTotal,
    requires_confirm: false,
    requires_override: false,
  };
}

export function consultAdvanceBlockReason(gate: ConsultAdvanceGateResult, confirm = false): string {
  if (!gate.ok) return gate.messages[0] || 'Không thể chuyển Consult';
  if (gate.requires_confirm && !confirm) return gate.messages[0] || 'Cần xác nhận';
  return '';
}

function block(messages: string[], decision: string, bantTotal: number): ConsultAdvanceGateResult {
  return {
    ok: false,
    level: 'block',
    messages,
    decision,
    bant_total: bantTotal,
    requires_confirm: false,
    requires_override: false,
  };
}
