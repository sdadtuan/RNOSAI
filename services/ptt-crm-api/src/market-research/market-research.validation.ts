import { PRODUCT_TYPES } from './market-research.constants';
import type { CreateEvidenceInput, CreateProjectInput } from './market-research.types';

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

export function validateCreateEvidence(input: CreateEvidenceInput): string[] {
  const messages: string[] = [];
  if (!String(input.locator ?? '').trim()) {
    messages.push('locator is required');
  }
  const hasExcerpt = Boolean(String(input.excerpt ?? '').trim());
  const hasValueTriple =
    input.value_num != null &&
    Boolean(String(input.unit ?? '').trim()) &&
    Boolean(String(input.value_base ?? '').trim());
  if (!hasExcerpt && !hasValueTriple) {
    messages.push('excerpt or value+unit+base is required');
  }
  if (input.value_num != null) {
    if (!String(input.unit ?? '').trim()) messages.push('unit is required');
    if (!String(input.value_base ?? '').trim()) messages.push('value_base is required');
    if (!String(input.period_note ?? '').trim()) messages.push('period_note is required');
    if (!String(input.geography ?? '').trim()) messages.push('geography is required');
  }
  if (input.source_id == null && input.study_id == null) {
    messages.push('source_id or study_id is required');
  }
  return messages;
}
