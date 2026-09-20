import { normalizeIntakeSlug } from '@/lib/crm/intake-service-resolve';
import type { ConsultGateState } from '@/lib/crm/funnel-stepper.types';

export type IntakeNextStepAction =
  | 'pick_service'
  | 'reopen_fix'
  | 'complete_session'
  | 'handoff_solution'
  | 'open_solution_queue'
  | 'none';

export type IntakeNextStepBanner = {
  tone: 'info' | 'warn' | 'ok';
  title_vi: string;
  body_vi: string;
  action: IntakeNextStepAction;
  cta_label_vi: string | null;
  blockers: string[];
};

export function resolveIntakeNextStepBanner(input: {
  hasActiveSession: boolean;
  sessionStatus: string | null;
  serviceSlug: string | null;
  decision: string | null;
  consultGate: ConsultGateState | null;
  handoffStatus: string | null;
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
        body_vi: 'Chọn dịch vụ trên Deal Bar rồi bấm + Gọi điện / + Gặp trực tiếp.',
        action: 'pick_service',
        cta_label_vi: null,
        blockers: ['Chưa chọn dịch vụ'],
      };
    }
    return {
      tone: 'info',
      title_vi: 'Tạo phiên khảo sát',
      body_vi: 'Bấm + Gọi điện hoặc + Gặp trực tiếp ở cột trái.',
      action: 'none',
      cta_label_vi: null,
      blockers: [],
    };
  }

  if (status === 'draft') {
    const blockers = [...(input.validationErrorMessages ?? [])];
    if (service === '_common') blockers.unshift('Chưa chọn dịch vụ');
    if (blockers.length > 0) {
      return {
        tone: 'warn',
        title_vi: 'Bổ sung trước khi hoàn thành',
        body_vi: blockers.slice(0, 3).join(' · '),
        action: 'complete_session',
        cta_label_vi: null,
        blockers,
      };
    }
    return {
      tone: 'info',
      title_vi: 'Sẵn sàng hoàn thành phiên',
      body_vi: 'Kiểm tra Quyết định, rồi bấm Hoàn thành phiên.',
      action: 'complete_session',
      cta_label_vi: 'Hoàn thành phiên',
      blockers: [],
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
    };
  }

  if (service === '_common') {
    return {
      tone: 'warn',
      title_vi: 'Thiếu dịch vụ — không giao Tư vấn được',
      body_vi: 'Reopen phiên, chọn dịch vụ, rồi hoàn thành lại.',
      action: 'reopen_fix',
      cta_label_vi: 'Reopen để bổ sung →',
      blockers: ['Chưa chọn dịch vụ'],
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
    };
  }

  if (!gate.ok || gate.level === 'block') {
    const blockers = gate.messages.length > 0 ? gate.messages : ['Chưa đủ điều kiện giao Solution'];
    return {
      tone: 'warn',
      title_vi: 'Gate chưa OK — bổ sung rồi giao',
      body_vi: blockers[0] ?? '',
      action: 'reopen_fix',
      cta_label_vi: 'Reopen để bổ sung →',
      blockers,
    };
  }

  if (decision === 'go' || decision === 'nurture' || !decision) {
    const needsConfirm = gate.requires_confirm || gate.level === 'warn';
    return {
      tone: 'ok',
      title_vi: needsConfirm ? 'Gate cảnh báo — có thể giao (xác nhận)' : 'Gate OK — giao Solution/MKT',
      body_vi: needsConfirm
        ? gate.messages[0] || 'Xác nhận trước khi giao.'
        : 'Bấm Giao Solution/MKT để chuyển Tư vấn.',
      action: 'handoff_solution',
      cta_label_vi: needsConfirm ? 'Giao Solution/MKT (xác nhận) →' : 'Giao Solution/MKT →',
      blockers: gate.messages,
    };
  }

  return {
    tone: 'info',
    title_vi: 'Đã hoàn thành phiên',
    body_vi: 'Xem Funnel để bước tiếp theo.',
    action: 'none',
    cta_label_vi: null,
    blockers: [],
  };
}

export function requireServiceSlugBeforeCreate(serviceSlug: string | null | undefined): string | null {
  const slug = normalizeIntakeSlug(serviceSlug) || '_common';
  if (slug === '_common') {
    return 'Chọn dịch vụ trên Deal Bar trước khi tạo phiên.';
  }
  return null;
}
