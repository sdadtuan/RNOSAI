import type { BantKey } from '@/lib/crm/intake-bant';
import type { DiscoveryResponseEntry, IntakeQuestionItem } from '@/lib/crm/intake-questions';

export function groupHasMappedQuestions(
  bantKey: BantKey,
  questionItems: IntakeQuestionItem[],
): boolean {
  return questionItems.some((item) => item.bant_key === bantKey);
}

export function hasBantDiscoveryEvidence(input: {
  bantKey: BantKey;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
}): boolean {
  if (!groupHasMappedQuestions(input.bantKey, input.questionItems)) return true;

  return input.questionItems.some((item) => {
    if (item.bant_key !== input.bantKey) return false;
    if (input.checked[item.key]) return true;
    const response = input.responses[item.key];
    if (!response) return false;
    if (response.answer.trim()) return true;
    return response.confidence === 'confirmed' || response.confidence === 'partial';
  });
}
