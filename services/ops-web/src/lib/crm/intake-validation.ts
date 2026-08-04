import { BANT_KEYS } from '@/lib/crm/intake-bant';
import { countDiscoveryChecked, type IntakeSessionMode } from '@/lib/crm/intake-discovery';

export type IntakeValidationLevel = 'error' | 'warn';

export interface IntakeValidationIssue {
  level: IntakeValidationLevel;
  code: string;
  message: string;
}

export interface IntakeCompleteValidationInput {
  contactName: string;
  need: string;
  bant: Record<string, number>;
  decision: string;
  decisionReason: string;
  sessionMode: IntakeSessionMode;
  discoveryChecked: Record<string, boolean>;
  discoveryTotal: number;
}

export function isRichTextEmpty(html: string): boolean {
  if (!html.trim()) return true;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !text;
}

export function validateIntakeComplete(input: IntakeCompleteValidationInput): IntakeValidationIssue[] {
  const issues: IntakeValidationIssue[] = [];
  const checkedCount = countDiscoveryChecked(input.discoveryChecked);
  const checklistMin = input.sessionMode === 'phone' ? 8 : 6;

  if (!input.contactName.trim()) {
    issues.push({
      level: 'error',
      code: 'contact_name',
      message: 'Liên hệ "Contact" không được để trống.',
    });
  }

  if (!input.decision) {
    issues.push({
      level: 'error',
      code: 'decision',
      message: 'Cần chọn Quyết định "Decision" trước khi hoàn thành.',
    });
  }

  if (
    (input.decision === 'nurture' || input.decision === 'no_go') &&
    !input.decisionReason.trim()
  ) {
    issues.push({
      level: 'error',
      code: 'decision_reason',
      message: 'Lý do "Reason" bắt buộc khi chọn Nurture hoặc No-Go.',
    });
  }

  const unscored = BANT_KEYS.filter((key) => {
    const score = Number(input.bant[key] ?? 0);
    return score < 1 || score > 5;
  });
  if (unscored.length > 0) {
    issues.push({
      level: 'warn',
      code: 'bant_unscored',
      message: `Còn ${unscored.length} tiêu chí BANT chưa chấm (1–5).`,
    });
  }

  if (input.discoveryTotal > 0 && checkedCount < checklistMin) {
    issues.push({
      level: 'warn',
      code: 'checklist_low',
      message: `Checklist mới ${checkedCount}/${input.discoveryTotal} câu — gợi ý ≥${checklistMin}.`,
    });
  }

  if (isRichTextEmpty(input.need)) {
    issues.push({
      level: 'warn',
      code: 'need_empty',
      message: 'Nhu cầu / điểm đau "Need / Pain" đang trống.',
    });
  }

  return issues;
}

export function intakeValidationErrors(issues: IntakeValidationIssue[]): IntakeValidationIssue[] {
  return issues.filter((issue) => issue.level === 'error');
}

export function intakeValidationWarnings(issues: IntakeValidationIssue[]): IntakeValidationIssue[] {
  return issues.filter((issue) => issue.level === 'warn');
}
