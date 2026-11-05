export const AM_AI_OFF_TOOLTIP = 'AI tắt';
export const AM_AI_LABEL = 'Hỏi AI';
export const AM_AI_PROPOSAL_LABEL = 'AI đề xuất';

export const AM_AI_MODES = [
  { value: 'summary', label: 'Tóm tắt' },
  { value: 'health', label: 'Giải thích health' },
  { value: 'qbr', label: 'QBR' },
  { value: 'followup', label: 'Follow-up' },
] as const;

export type AmAiKind = (typeof AM_AI_MODES)[number]['value'];

export type AmAiDraftPayload = {
  draft: string;
  evidence?: unknown;
  draft_id?: string;
};

export type AmAiOpenFormAction =
  | {
      type: 'open_form';
      form: 'task';
      prefill: { title: string; ai_evidence_json?: unknown };
    }
  | {
      type: 'open_form';
      form: 'opportunity';
      prefill: { title: string; next_step: string; source?: string; ai_evidence_json?: unknown };
    }
  | {
      type: 'open_form';
      form: 'plan';
      prefill: { kind: 'qbr'; period_key?: string; title?: string; ai_evidence_json?: unknown };
    };

export function amAiAskButtonProps(enabled: boolean): { disabled: boolean; title: string } {
  if (!enabled) return { disabled: true, title: AM_AI_OFF_TOOLTIP };
  return { disabled: false, title: AM_AI_LABEL };
}

export function amAiCreateTaskAction(draft: AmAiDraftPayload): AmAiOpenFormAction {
  return {
    type: 'open_form',
    form: 'task',
    prefill: {
      title: firstLine(draft.draft),
      ai_evidence_json: draft.evidence,
    },
  };
}

export function amAiCreateDraftAction(kind: string, draft: AmAiDraftPayload): AmAiOpenFormAction {
  if (kind === 'qbr') {
    return {
      type: 'open_form',
      form: 'plan',
      prefill: {
        kind: 'qbr',
        title: firstLine(draft.draft),
        ai_evidence_json: draft.evidence,
      },
    };
  }
  return {
    type: 'open_form',
    form: 'opportunity',
    prefill: {
      title: firstLine(draft.draft),
      next_step: firstLine(draft.draft),
      source: 'ai',
      ai_evidence_json: draft.evidence,
    },
  };
}

function firstLine(text: string): string {
  return String(text ?? '')
    .split('\n')[0]
    ?.trim()
    .slice(0, 200) ?? '';
}
