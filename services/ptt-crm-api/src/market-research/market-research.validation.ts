import { PRODUCT_TYPES } from './market-research.constants';
import type { CreateProjectInput } from './market-research.types';

export function validateCreateProject(input: CreateProjectInput): string[] {
  const messages: string[] = [];
  if (!String(input.client_id ?? '').trim()) {
    messages.push('client_id is required');
  }
  if (!PRODUCT_TYPES.includes(input.product_type as (typeof PRODUCT_TYPES)[number])) {
    messages.push('product_type is invalid');
  }
  if (String(input.decision_statement ?? '').trim().length < 20) {
    messages.push('decision_statement must be at least 20 characters');
  }
  if (String(input.title ?? '').trim().length < 8) {
    messages.push('title must be at least 8 characters');
  }
  const questions = Array.isArray(input.questions) ? input.questions : [];
  if (questions.length < 1) {
    messages.push('at least one question is required');
  }
  for (const q of questions) {
    if (!String(q?.question_vi ?? '').trim()) {
      messages.push('question_vi is required');
      break;
    }
  }
  return messages;
}
