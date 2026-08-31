import { computeWinTotal, WIN_SCORE_KEYS, type WinScoreKey } from '@/lib/crm/intake-win-score';

export type WinChecklistState = Partial<Record<WinScoreKey, number>>;

export type WinChecklistItem = {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
};

export const WIN_CHECKLIST: Record<WinScoreKey, { hint: string; items: WinChecklistItem[] }> = {
  incumbent: {
    hint: 'Agency / freelancer / in-house đang làm?',
    items: [
      { score: 1, label: 'Không biết ai đang làm / “chưa dùng agency” mơ hồ' },
      { score: 2, label: 'Biết có người làm nhưng không tên, không kết quả' },
      { score: 3, label: 'Biết tên loại (freelancer/agency) + 1 phàn nàn chung' },
      { score: 4, label: 'Tên + lỗ hổng cụ thể (KPI/SLA/báo cáo)' },
      { score: 5, label: 'Tên + số liệu thất bại + lý do đang tìm chỗ mới' },
    ],
  },
  competitor: {
    hint: 'Ai đang pitch cùng lúc?',
    items: [
      { score: 1, label: 'Không biết / không hỏi' },
      { score: 2, label: '“Có vài bên” — không tên' },
      { score: 3, label: 'Biết 1 tên, chưa biết họ hứa gì' },
      { score: 4, label: 'Tên + điểm họ đang thắng (giá / case)' },
      { score: 5, label: 'Tên + so sánh được gói PTT vs họ trên tiêu chí KH' },
    ],
  },
  selection_criteria: {
    hint: 'KH chọn agency theo gì?',
    items: [
      { score: 1, label: 'Không nêu tiêu chí' },
      { score: 2, label: '“Giá” hoặc “uy tín” chung chung' },
      { score: 3, label: '1 tiêu chí rõ (giá / case / SLA) chưa trọng số' },
      { score: 4, label: '2+ tiêu chí + ai chấm' },
      { score: 5, label: 'Tiêu chí + trọng số + ngày chấm / họp board' },
    ],
  },
  switch_risk: {
    hint: 'Rủi ro nếu đổi sang PTT?',
    items: [
      { score: 1, label: 'Không nói / “không sao”' },
      { score: 2, label: 'Sợ giá hoặc sợ mất data, chưa cụ thể' },
      { score: 3, label: '1 rủi ro rõ (lock-in, mùa, sếp quen agency cũ)' },
      { score: 4, label: 'Rủi ro + cách KH muốn giảm (trial, bàn giao)' },
      { score: 5, label: 'KH nêu điều kiện đổi + mốc hết HĐ cũ' },
    ],
  },
  champion: {
    hint: 'Ai trong nội bộ đứng về phía mình?',
    items: [
      { score: 1, label: 'Chỉ gặp cổng (trợ lý / form)' },
      { score: 2, label: 'Có 1 người thân thiện, không quyền' },
      { score: 3, label: 'Người dùng dịch vụ ủng hộ, chưa kéo DM' },
      { score: 4, label: 'Có champion + sẵn sàng giới thiệu DM' },
      { score: 5, label: 'Champion + DM cùng cuộc hoặc đã hẹn 3 bên' },
    ],
  },
  next_step: {
    hint: 'Cam kết bước tiếp là gì?',
    items: [
      { score: 1, label: '“Để em xem lại” — không ngày' },
      { score: 2, label: 'Hẹn mơ hồ tuần sau' },
      { score: 3, label: 'Có việc (gửi proposal / họp) chưa khóa lịch' },
      { score: 4, label: 'Lịch cụ thể hoặc deadline gửi L2' },
      { score: 5, label: 'Lịch + chủ đề + người tham dự đã xác nhận' },
    ],
  },
};

export function parseWinChecklist(answers: Record<string, unknown> | undefined): WinChecklistState {
  const raw = answers?.win_checklist;
  if (!raw || typeof raw !== 'object') return {};
  const out: WinChecklistState = {};
  for (const key of WIN_SCORE_KEYS) {
    const score = Number((raw as Record<string, unknown>)[key] ?? 0);
    if (score >= 1 && score <= 5) out[key] = score;
  }
  return out;
}

export function scoreWinFromChecklist(checklist: WinChecklistState): Record<string, number> {
  const win: Record<string, number> = {};
  for (const key of WIN_SCORE_KEYS) {
    const score = Number(checklist[key] ?? 0);
    win[key] = score >= 1 && score <= 5 ? score : 0;
  }
  return win;
}

export function toggleWinChecklistScore(
  checklist: WinChecklistState,
  key: WinScoreKey,
  score: number,
): WinChecklistState {
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

export function mergeWinChecklistPatch(
  existing: Record<string, unknown>,
  checklist: WinChecklistState,
): Record<string, unknown> {
  const scored = scoreWinFromChecklist(checklist);
  return { ...existing, win_checklist: scored, win_score_json: scored };
}

export function winChecklistTotal(checklist: WinChecklistState): number {
  return computeWinTotal(scoreWinFromChecklist(checklist));
}
