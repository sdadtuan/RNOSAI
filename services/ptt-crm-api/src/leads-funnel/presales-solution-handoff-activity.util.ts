export const SOLUTION_HANDOFF_ACTIVITY_TYPES = {
  handoff: 'solution_handoff',
  claimed: 'solution_claimed',
  released: 'solution_released',
  returned: 'solution_returned',
  uploaded: 'solution_file_uploaded',
  ai_draft: 'solution_ai_draft',
  deadline: 'solution_deadline_changed',
  received: 'solution_received',
  viewed: 'solution_viewed',
} as const;

export type SolutionHandoffActivityType =
  (typeof SOLUTION_HANDOFF_ACTIVITY_TYPES)[keyof typeof SOLUTION_HANDOFF_ACTIVITY_TYPES];

export interface SolutionHandoffActivityInput {
  leadId: number;
  serviceSlug: string;
  actorName: string;
  amOwnerName?: string;
  solutionOwnerName?: string;
  returnReason?: string;
  fileName?: string;
  deadlineLabel?: string;
}

export function buildSolutionHandoffActivity(
  kind: SolutionHandoffActivityType,
  input: SolutionHandoffActivityInput,
): { activity_type: string; content: string; result: string; next_action: string } {
  const slug = input.serviceSlug ? ` (${input.serviceSlug})` : '';
  switch (kind) {
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff:
      return {
        activity_type: kind,
        content: `[Solution handoff] AM ${input.actorName} giao lead #${input.leadId}${slug} → Solution/MKT`,
        result: 'Handoff pending — chờ Solution nhận case',
        next_action: 'Solution: nhận case tại /crm/solution/queue',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.claimed:
      return {
        activity_type: kind,
        content: `[Solution handoff] ${input.actorName} nhận case lead #${input.leadId}${slug}`,
        result: 'Solution đang xử lý Consult + R5',
        next_action: 'Hoàn tất Consult + KHMKT sơ bộ → Trả Sales',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.returned: {
      const reason = String(input.returnReason ?? '').trim();
      return {
        activity_type: kind,
        content: `[Solution handoff] ${input.actorName} trả lại Sales lead #${input.leadId}${slug} — thông tin chưa đủ${reason ? `: ${reason}` : ''}`,
        result: 'MKT trả lại Sales để bổ sung thông tin',
        next_action: 'Sales: bổ sung thông tin rồi giao lại Solution',
      };
    }
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.released:
      return {
        activity_type: kind,
        content: `${input.actorName} · Nộp Solution cho Sales`,
        result: 'Lead chuyển sang bước Sales lấy phản hồi khách',
        next_action: 'Sales xem Solution và lấy phản hồi khách',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.uploaded:
      return {
        activity_type: kind,
        content: `${input.actorName} · Tải file Solution${input.fileName ? `: ${input.fileName}` : ''}`,
        result: 'Đã tải file Solution',
        next_action: '',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.ai_draft:
      return {
        activity_type: kind,
        content: `${input.actorName} · AI tạo Solution`,
        result: 'Đã tạo bản nháp Solution bằng AI',
        next_action: '',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.deadline:
      return {
        activity_type: kind,
        content: `${input.actorName} · Đổi Deadline Solutions${input.deadlineLabel ? `: ${input.deadlineLabel}` : ''}`,
        result: 'Đã lưu Deadline Solutions',
        next_action: '',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.received:
      return {
        activity_type: kind,
        content: `${input.actorName} · Sales nhận Solution`,
        result: 'Sales đã nhận Solution',
        next_action: 'Sales xem Solution và lấy phản hồi khách',
      };
    case SOLUTION_HANDOFF_ACTIVITY_TYPES.viewed:
      return {
        activity_type: kind,
        content: `${input.actorName} · Sales xem Solution`,
        result: 'Sales đã mở Solution',
        next_action: '',
      };
    default:
      return {
        activity_type: 'system',
        content: `Solution handoff lead #${input.leadId}`,
        result: '',
        next_action: '',
      };
  }
}
