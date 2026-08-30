import { BANT_KEYS, computeBantTotal, GO_THRESHOLDS, type BantKey } from '@/lib/crm/intake-bant';
import { groupHasMappedQuestions, hasBantDiscoveryEvidence } from '@/lib/crm/intake-bant-evidence';
import {
  BANT_CHECKLIST,
  scoreBantFromChecklist,
  type BantChecklistState,
} from '@/lib/crm/intake-bant-checklist';
import { BANT_FIELD_LABELS } from '@/lib/crm/intake-labels';
import type { DiscoveryResponseEntry, IntakeQuestionItem } from '@/lib/crm/intake-questions';

export type BantNextStepCta = 'discovery' | 'qualify' | null;
export type BantNextStepCode = 'incomplete' | 'no_go' | 'nurture' | 'consult';
export type BantNextStep = {
  code: BantNextStepCode;
  title_vi: string;
  body_vi: string;
  cta: BantNextStepCta;
};

export function nextBantStep(input: {
  checklist: BantChecklistState;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
}): BantNextStep {
  const scores = scoreBantFromChecklist(input.checklist);
  const unscoredKeys = BANT_KEYS.filter((key) => {
    const score = Number(scores[key] ?? 0);
    return !(score >= 1 && score <= 5);
  });

  if (unscoredKeys.length > 0) {
    const needsDiscovery = unscoredKeys.some(
      (key) =>
        groupHasMappedQuestions(key, input.questionItems) &&
        !hasBantDiscoveryEvidence({
          bantKey: key,
          questionItems: input.questionItems,
          checked: input.checked,
          responses: input.responses,
        }),
    );
    return {
      code: 'incomplete',
      title_vi: 'Còn mục chưa chấm',
      body_vi: `${unscoredKeys.map((key) => BANT_FIELD_LABELS[key].label).join(', ')}. Tick nốt các mục còn lại hoặc hỏi trên Discovery.`,
      cta: needsDiscovery ? 'discovery' : null,
    };
  }

  const total = computeBantTotal(scores);

  if (total < GO_THRESHOLDS.nurture_min) {
    return {
      code: 'no_go',
      title_vi: 'Gợi ý: Từ chối / dừng Tư vấn',
      body_vi: `BANT ${total}/30 dưới Nurture. Hỏi thêm mục thấp nhất hoặc chọn No-Go + lý do`,
      cta: 'qualify',
    };
  }

  if (total < GO_THRESHOLDS.go) {
    const lowest = lowestBantKey(scores);
    const gap = GO_THRESHOLDS.go - total;
    return {
      code: 'nurture',
      title_vi: 'Gợi ý: Nuôi dưỡng',
      body_vi: `Còn ${gap} điểm để Tư vấn. ${BANT_CHECKLIST[lowest].hint}`,
      cta: 'discovery',
    };
  }

  return {
    code: 'consult',
    title_vi: 'Gợi ý: Đủ Tư vấn',
    body_vi:
      'Điểm đủ Tư vấn nhưng chưa phải đủ báo giá / HĐ. Chọn Quyết định Go trên Qualify, hoàn thành phiên, rồi Funnel Chuyển → Tư vấn.',
    cta: 'qualify',
  };
}

function lowestBantKey(scores: Record<string, number>): BantKey {
  let lowest: BantKey = BANT_KEYS[0];
  let min = Number(scores[lowest] ?? 0);
  for (const key of BANT_KEYS) {
    const score = Number(scores[key] ?? 0);
    if (score < min) {
      min = score;
      lowest = key;
    }
  }
  return lowest;
}
