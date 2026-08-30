import { BANT_KEYS, computeBantTotal, type BantKey } from '@/lib/crm/intake-bant';

export type BantChecklistState = Partial<Record<BantKey, number>>;

export type BantChecklistItem = {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
};

export const BANT_CHECKLIST: Record<BantKey, { hint: string; items: BantChecklistItem[] }> = {
  budget: {
    hint: 'Ngân sách thực tế/tháng hoặc dự án? Ai duyệt chi?',
    items: [
      { score: 1, label: 'Không có ngân sách / chỉ hỏi giá / từ chối nêu range' },
      { score: 2, label: '“Tùy giá” / “xem đã” / không biết ai duyệt' },
      { score: 3, label: 'Có range lỏng nhưng chưa chắc, chưa rõ người duyệt' },
      { score: 4, label: 'Có khung rõ + biết ai duyệt chi' },
      { score: 5, label: 'Số đã duyệt hoặc gần duyệt; nói được hạn mức + người ký chi' },
    ],
  },
  authority: {
    hint: 'Ai ký HĐ? Ai quyết định cuối cùng?',
    items: [
      { score: 1, label: 'Không tiếp cận được người quyết / chỉ intern hỏi hộ' },
      { score: 2, label: '“Báo sếp” — không biết tên, chưa hẹn được DM' },
      { score: 3, label: 'Biết vai trò (GD, kế toán) nhưng chưa nói chuyện trực tiếp' },
      { score: 4, label: 'Đã nói với DM hoặc DM cùng cuộc gọi; quy trình ký rõ' },
      { score: 5, label: 'Người ký HĐ đang trong cuộc / đã xác nhận quyền quyết' },
    ],
  },
  need: {
    hint: 'Pain point #1? Hậu quả nếu không giải quyết?',
    items: [
      { score: 1, label: 'Không nêu pain, chỉ “làm marketing dùm”' },
      { score: 2, label: 'Pain chung chung (“muốn nhiều lead”) không hậu quả' },
      { score: 3, label: 'Có 1 pain cụ thể nhưng chưa đo được / chưa gấp' },
      { score: 4, label: 'Pain rõ + hậu quả (mất lead, mùa vụ, sếp hỏi)' },
      { score: 5, label: 'Pain #1 + số liệu/KPI + hậu quả nếu chậm' },
    ],
  },
  timeline: {
    hint: 'Khi nào cần bắt đầu? Deadline campaign/go-live?',
    items: [
      { score: 1, label: '“Từ từ”, không deadline, không mùa' },
      { score: 2, label: '“Năm nay” / “khi rảnh”' },
      { score: 3, label: 'Có hướng (Q3, trước Tết) nhưng chưa chốt ngày' },
      { score: 4, label: 'Có mốc go-live / họp board / campaign trong vài tuần–tháng' },
      { score: 5, label: 'Deadline cứng + lý do (mùa, launch, HĐ agency cũ hết hạn)' },
    ],
  },
  fit: {
    hint: 'Phù hợp ICP PTT? Scope trong năng lực?',
    items: [
      { score: 1, label: 'Ngoài năng lực / ngành PTT không làm / kỳ vọng ảo nặng' },
      { score: 2, label: 'Scope lệch (vd. muốn app + 50 trang, budget landing)' },
      { score: 3, label: 'Đúng nhóm dịch vụ nhưng ICP/ngành chưa rõ' },
      { score: 4, label: 'Đúng dịch vụ PTT, quy mô/ngành ổn, scope kiểm soát được' },
      { score: 5, label: 'Đúng ICP, scope rõ, KPI đo được, không red-flag kỳ vọng' },
    ],
  },
  history: {
    hint: 'Đã thử gì? Agency cũ? Kết quả?',
    items: [
      { score: 1, label: 'Giấu thông tin / kỳ vọng thần thánh / vừa đuổi agency vì giá' },
      { score: 2, label: '“Có làm rồi” nhưng không nói / đổ hết lỗi agency' },
      { score: 3, label: 'Kể được đã tự làm hoặc agency, kết quả mơ hồ' },
      { score: 4, label: 'Kể được việc đã làm + kết quả + lý do đổi' },
      { score: 5, label: 'Minh bạch số liệu/HĐ + kỳ vọng thực tế' },
    ],
  },
};

export function emptyBantChecklist(): BantChecklistState {
  return {};
}

export function parseBantChecklist(answers: Record<string, unknown> | undefined): BantChecklistState {
  const raw = answers?.bant_checklist;
  if (!raw || typeof raw !== 'object') return {};
  const out: BantChecklistState = {};
  for (const key of BANT_KEYS) {
    const score = Number((raw as Record<string, unknown>)[key] ?? 0);
    if (score >= 1 && score <= 5) out[key] = score;
  }
  return out;
}

export function scoreBantFromChecklist(checklist: BantChecklistState): Record<string, number> {
  const bant: Record<string, number> = {};
  for (const key of BANT_KEYS) {
    const score = Number(checklist[key] ?? 0);
    bant[key] = score >= 1 && score <= 5 ? score : 0;
  }
  return bant;
}

export function toggleBantChecklistScore(
  checklist: BantChecklistState,
  key: BantKey,
  score: number,
): BantChecklistState {
  const next = { ...checklist };
  if (Number(next[key] ?? 0) === score) {
    delete next[key];
  } else if (score >= 1 && score <= 5) {
    next[key] = score;
  } else {
    delete next[key];
  }
  return next;
}

export function checklistFromBant(bant: Record<string, number>): BantChecklistState {
  const out: BantChecklistState = {};
  for (const key of BANT_KEYS) {
    const score = Number(bant[key] ?? 0);
    if (score >= 1 && score <= 5) out[key] = score;
  }
  return out;
}

export function mergeBantChecklistPatch(
  existing: Record<string, unknown>,
  checklist: BantChecklistState,
): Record<string, unknown> {
  return { ...existing, bant_checklist: scoreBantFromChecklist(checklist) };
}

export function bantChecklistTotal(checklist: BantChecklistState): number {
  return computeBantTotal(scoreBantFromChecklist(checklist));
}
