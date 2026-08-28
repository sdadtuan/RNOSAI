export type B2CallOutcome = 'talked' | 'no_answer' | 'wrong_number';

export const B2_TALKED_DEFAULT_NOTE = 'Đã liên hệ KH — xác nhận nhu cầu';
export const B2_NO_ANSWER_DEFAULT_NOTE = 'Gọi — không nghe máy, sẽ gọi lại';
export const B2_WRONG_NUMBER_DEFAULT_NOTE = 'Số sai / không tồn tại';

export type B2CareReportBody = {
  content: string;
  care_status: string;
  care_contact_type: string;
};

export type B2OutcomePlan =
  | {
      kind: 'complete_b2';
      report: B2CareReportBody;
      completeNote: string;
      primary_label_vi: string;
      suggestLost: false;
    }
  | {
      kind: 'retry';
      report: B2CareReportBody;
      primary_label_vi: string;
      suggestLost: false;
    }
  | {
      kind: 'wrong_number';
      report: B2CareReportBody;
      primary_label_vi: string;
      suggestLost: true;
    };

export type B2OutcomeResult =
  | { ok: true; plan: B2OutcomePlan }
  | { ok: false; error_vi: string };

const DEFAULTS: Record<B2CallOutcome, string> = {
  talked: B2_TALKED_DEFAULT_NOTE,
  no_answer: B2_NO_ANSWER_DEFAULT_NOTE,
  wrong_number: B2_WRONG_NUMBER_DEFAULT_NOTE,
};

export function defaultNoteForB2Outcome(outcome: B2CallOutcome): string {
  return DEFAULTS[outcome];
}

export function resolveB2CallOutcome(input: {
  outcome: B2CallOutcome;
  note: string;
}): B2OutcomeResult {
  const trimmed = input.note.trim();
  if (trimmed.length > 0 && trimmed.length < 3) {
    return { ok: false, error_vi: 'Ghi chú cần ≥ 3 ký tự.' };
  }
  const content = trimmed || defaultNoteForB2Outcome(input.outcome);
  const report: B2CareReportBody = {
    content,
    care_status:
      input.outcome === 'talked'
        ? 'da_lien_he_thanh_cong'
        : input.outcome === 'no_answer'
          ? 'khong_nghe_may'
          : 'so_sai',
    care_contact_type: 'goi_dien',
  };

  if (input.outcome === 'talked') {
    return {
      ok: true,
      plan: {
        kind: 'complete_b2',
        report,
        completeNote: content,
        primary_label_vi: 'Xong B2',
        suggestLost: false,
      },
    };
  }

  if (input.outcome === 'no_answer') {
    return {
      ok: true,
      plan: {
        kind: 'retry',
        report,
        primary_label_vi: 'Ghi nhận — gọi lại',
        suggestLost: false,
      },
    };
  }

  return {
    ok: true,
    plan: {
      kind: 'wrong_number',
      report,
      primary_label_vi: 'Ghi nhận số sai',
      suggestLost: true,
    },
  };
}
