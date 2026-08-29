export type LifecycleAdvanceInfo = {
  current_stage: string;
  next_stage: string | null;
  can_advance_forward: boolean;
  block_reason: string;
  current_complete: boolean;
  current_done: number;
  current_total: number;
  onboard_gate?: {
    ok: boolean;
    messages?: string[];
    orchestrator_percent?: number;
    checklist_percent?: number;
  };
  launch_qa_gate?: {
    ok: boolean;
    requires_confirm?: boolean;
    messages?: string[];
    progress_completed?: number;
    progress_total?: number;
  };
  payment_gate?: {
    ok: boolean;
    requires_confirm?: boolean;
    messages?: string[];
    outstanding_vnd?: number;
  };
};

export type LifecycleNextActionKind =
  | 'continue_tasks'
  | 'onboard_checklist'
  | 'open_tmmt'
  | 'open_launch_qa'
  | 'open_finance'
  | 'advance_stage'
  | 'terminal'
  | 'fallback';

export type LifecycleNextAction = {
  kind: LifecycleNextActionKind;
  title: string;
  subtitle: string;
  primaryLabel: string | null;
  nextStage: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  consult: 'Tư vấn',
  proposal: 'Báo giá',
  onboard: 'Onboard',
  deliver: 'Triển khai',
  handover: 'Bàn giao',
  retain: 'Giữ chân',
};

function truncate(text: string, max = 120): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function firstMessage(info: LifecycleAdvanceInfo): string {
  return (
    info.onboard_gate?.messages?.[0] ??
    info.launch_qa_gate?.messages?.[0] ??
    info.payment_gate?.messages?.[0] ??
    info.block_reason ??
    ''
  );
}

export function resolveLifecycleNextAction(info: LifecycleAdvanceInfo): LifecycleNextAction {
  const { current_stage: currentStage, next_stage: nextStage } = info;
  const subtitle = truncate(firstMessage(info) || info.block_reason);

  if (!info.current_complete) {
    return {
      kind: 'continue_tasks',
      title: 'Hoàn thành task giai đoạn',
      subtitle: subtitle || `Còn ${info.current_total - info.current_done} task`,
      primaryLabel: `Làm tiếp (${info.current_done}/${info.current_total})`,
      nextStage,
    };
  }

  if (
    info.onboard_gate &&
    !info.onboard_gate.ok &&
    nextStage === 'deliver' &&
    currentStage === 'onboard'
  ) {
    return {
      kind: 'onboard_checklist',
      title: 'Gate Onboard',
      subtitle,
      primaryLabel: 'Mở checklist Onboard',
      nextStage,
    };
  }

  if (
    currentStage === 'onboard' &&
    nextStage === 'deliver' &&
    info.current_complete &&
    !info.can_advance_forward &&
    !(info.onboard_gate && !info.onboard_gate.ok)
  ) {
    return {
      kind: 'open_tmmt',
      title: 'Gate TMMT',
      subtitle,
      primaryLabel: 'Mở TMMT chính thức',
      nextStage,
    };
  }

  if (info.launch_qa_gate?.requires_confirm) {
    return {
      kind: 'open_launch_qa',
      title: 'Launch QA chưa ready',
      subtitle,
      primaryLabel: 'Mở Launch QA',
      nextStage,
    };
  }

  if (info.payment_gate?.requires_confirm) {
    return {
      kind: 'open_finance',
      title: 'Công nợ HĐ',
      subtitle,
      primaryLabel: 'Mở Tài chính',
      nextStage,
    };
  }

  if (info.can_advance_forward && nextStage) {
    const label = STAGE_LABELS[nextStage] ?? nextStage;
    return {
      kind: 'advance_stage',
      title: 'Sẵn sàng chuyển bước',
      subtitle,
      primaryLabel: `Chuyển → ${label}`,
      nextStage,
    };
  }

  if (!nextStage) {
    return {
      kind: 'terminal',
      title: 'Đã ở giai đoạn cuối',
      subtitle: subtitle || 'Lifecycle đã tới Retain.',
      primaryLabel: null,
      nextStage: null,
    };
  }

  return {
    kind: 'fallback',
    title: info.block_reason || 'Tiếp tục trên Workflow',
    subtitle,
    primaryLabel: 'Mở Workflow',
    nextStage,
  };
}
