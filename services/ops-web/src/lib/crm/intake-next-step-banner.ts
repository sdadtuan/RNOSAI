import { normalizeIntakeSlug } from '@/lib/crm/intake-service-resolve';
import type { ConsultGateState } from '@/lib/crm/funnel-stepper.types';
import type { IntakeValidationIssue } from '@/lib/crm/intake-validation';

export type IntakeNextStepAction =
  | 'pick_service'
  | 'reopen_form'
  | 'complete_session'
  | 'handoff_solution'
  | 'open_solution_queue'
  | 'none';

export type IntakeNextStepTarget =
  | 'service'
  | 'decision'
  | 'discovery_need'
  | 'discovery_critical'
  | 'handoff_dm'
  | 'contact'
  | 'none';

export type IntakeNextStepChip = {
  code: string;
  label_vi: string;
  target: IntakeNextStepTarget;
};

export type IntakeNextStepBanner = {
  tone: 'info' | 'warn' | 'ok';
  title_vi: string;
  body_vi: string;
  action: IntakeNextStepAction;
  cta_label_vi: string | null;
  /** @deprecated prefer chips — kept for gate/handoff message lists */
  blockers: string[];
  chips: IntakeNextStepChip[];
};

const CHIP_BY_CODE: Record<string, IntakeNextStepChip> = {
  service_unselected: { code: 'service_unselected', label_vi: 'Dịch vụ', target: 'service' },
  decision: { code: 'decision', label_vi: 'Quyết định', target: 'decision' },
  decision_reason: { code: 'decision_reason', label_vi: 'Lý do', target: 'decision' },
  need_empty: { code: 'need_empty', label_vi: 'Need / Pain', target: 'discovery_need' },
  critical_answers_missing: {
    code: 'critical_answers_missing',
    label_vi: 'Câu quan trọng',
    target: 'discovery_critical',
  },
  stakeholder_dm_missing: {
    code: 'stakeholder_dm_missing',
    label_vi: 'Decision Maker',
    target: 'handoff_dm',
  },
  contact_name: { code: 'contact_name', label_vi: 'Liên hệ', target: 'contact' },
};

/** Map validation issues → unique short chips (no long duplicate sentences). */
export function chipsFromValidationIssues(
  issues: IntakeValidationIssue[],
  serviceSlug?: string | null,
): IntakeNextStepChip[] {
  const chips: IntakeNextStepChip[] = [];
  const seen = new Set<string>();

  const service = normalizeIntakeSlug(serviceSlug) || '_common';
  if (service === '_common') {
    chips.push(CHIP_BY_CODE.service_unselected);
    seen.add('service_unselected');
  }

  for (const issue of issues) {
    if (issue.level !== 'error') continue;
    if (seen.has(issue.code)) continue;
    const chip = CHIP_BY_CODE[issue.code];
    if (!chip) continue;
    if (issue.code === 'service_unselected' && seen.has('service_unselected')) continue;
    chips.push(chip);
    seen.add(issue.code);
  }

  return chips.slice(0, 5);
}

export function resolveIntakeNextStepBanner(input: {
  hasActiveSession: boolean;
  sessionStatus: string | null;
  serviceSlug: string | null;
  decision: string | null;
  consultGate: ConsultGateState | null;
  handoffStatus: string | null;
  validationIssues?: IntakeValidationIssue[];
  /** @deprecated use validationIssues */
  validationErrorMessages?: string[];
}): IntakeNextStepBanner | null {
  const service = normalizeIntakeSlug(input.serviceSlug) || '_common';
  const status = String(input.sessionStatus ?? '').trim();
  const handoff = String(input.handoffStatus ?? '').trim().toLowerCase();
  const decision = String(input.decision ?? '').trim().toLowerCase();

  if (!input.hasActiveSession) {
    if (service === '_common') {
      return {
        tone: 'warn',
        title_vi: 'Chọn dịch vụ trước',
        body_vi: 'Chọn trên Deal Bar, rồi tạo phiên.',
        action: 'pick_service',
        cta_label_vi: null,
        blockers: [],
        chips: [CHIP_BY_CODE.service_unselected],
      };
    }
    return {
      tone: 'info',
      title_vi: 'Tạo phiên khảo sát',
      body_vi: 'Bấm + Gọi điện hoặc + Gặp trực tiếp.',
      action: 'none',
      cta_label_vi: null,
      blockers: [],
      chips: [],
    };
  }

  if (status === 'draft') {
    const issues = input.validationIssues ?? [];
    const chips = chipsFromValidationIssues(issues, service);
    if (chips.length > 0) {
      return {
        tone: 'warn',
        title_vi: 'Còn thiếu để hoàn thành',
        body_vi: 'Bấm mục bên dưới để đi tới chỗ cần điền.',
        action: 'complete_session',
        cta_label_vi: null,
        blockers: [],
        chips,
      };
    }
    return {
      tone: 'info',
      title_vi: 'Sẵn sàng hoàn thành phiên',
      body_vi: 'Kiểm tra Quyết định, rồi bấm Hoàn thành phiên.',
      action: 'complete_session',
      cta_label_vi: 'Hoàn thành phiên',
      blockers: [],
      chips: [],
    };
  }

  if (status !== 'completed') return null;

  if (handoff === 'pending' || handoff === 'with_solution') {
    return {
      tone: 'ok',
      title_vi: 'Đã giao Solution/MKT',
      body_vi: 'Solution claim trên queue.',
      action: 'open_solution_queue',
      cta_label_vi: 'Mở queue Solution →',
      blockers: [],
      chips: [],
    };
  }

  if (service === '_common') {
    return {
      tone: 'warn',
      title_vi: 'Thiếu dịch vụ',
      body_vi: 'Reopen phiên, chọn dịch vụ, rồi hoàn thành lại.',
      action: 'reopen_form',
      cta_label_vi: 'Reopen để bổ sung →',
      blockers: [],
      chips: [CHIP_BY_CODE.service_unselected],
    };
  }

  const gate = input.consultGate;
  if (!gate) {
    return {
      tone: 'info',
      title_vi: 'Đã hoàn thành phiên',
      body_vi: 'Đang tải điều kiện giao Solution…',
      action: 'none',
      cta_label_vi: null,
      blockers: [],
      chips: [],
    };
  }

  if (!gate.ok || gate.level === 'block') {
    const blockers = gate.messages.length > 0 ? gate.messages : ['Chưa đủ điều kiện giao Solution'];
    return {
      tone: 'warn',
      title_vi: 'Gate chưa OK',
      body_vi: blockers[0] ?? '',
      action: 'reopen_form',
      cta_label_vi: 'Reopen để bổ sung →',
      blockers,
      chips: [],
    };
  }

  if (decision === 'go' || decision === 'nurture' || !decision) {
    const needsConfirm = gate.requires_confirm || gate.level === 'warn';
    return {
      tone: 'ok',
      title_vi: needsConfirm ? 'Gate cảnh báo — có thể giao' : 'Gate OK — giao Solution/MKT',
      body_vi: needsConfirm
        ? gate.messages[0] || 'Xác nhận trước khi giao.'
        : 'Bấm Giao Solution/MKT để chuyển Tư vấn.',
      action: 'handoff_solution',
      cta_label_vi: needsConfirm ? 'Giao Solution/MKT (xác nhận) →' : 'Giao Solution/MKT →',
      blockers: gate.messages,
      chips: [],
    };
  }

  return {
    tone: 'info',
    title_vi: 'Đã hoàn thành phiên',
    body_vi: 'Xem Funnel để bước tiếp theo.',
    action: 'none',
    cta_label_vi: null,
    blockers: [],
    chips: [],
  };
}

export function requireServiceSlugBeforeCreate(serviceSlug: string | null | undefined): string | null {
  const slug = normalizeIntakeSlug(serviceSlug) || '_common';
  if (slug === '_common') {
    return 'Chọn dịch vụ trên Deal Bar trước khi tạo phiên.';
  }
  return null;
}
