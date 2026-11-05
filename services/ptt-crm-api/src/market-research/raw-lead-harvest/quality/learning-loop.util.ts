import { computePriorityTier } from './priority-cluster.util';

const DIAL_DELTA: Record<string, number> = {
  connected: 10,
  no_answer: -2,
  gatekeeper: 0,
  wrong_number: -25,
  out_of_business: -40,
  email_bounced: -15,
};

const FEEDBACK_DELTA: Record<string, number> = {
  bad_phone: -20,
  bad_email: -10,
  fake_company: -35,
  wrong_geo: -15,
  other: -5,
};

export type LearningDirection = 'boosted' | 'demoted' | 'unchanged';

export function learningDeltaFromSignals(input: {
  dial_outcome?: string | null;
  feedback_code?: string | null;
}): { delta: number; reasons: string[] } {
  const reasons: string[] = [];
  let delta = 0;
  const dial = String(input.dial_outcome ?? '').trim().toLowerCase();
  const feedback = String(input.feedback_code ?? '').trim().toLowerCase();
  if (dial && Object.prototype.hasOwnProperty.call(DIAL_DELTA, dial)) {
    delta += DIAL_DELTA[dial];
    reasons.push(`dial:${dial}`);
  }
  if (feedback && Object.prototype.hasOwnProperty.call(FEEDBACK_DELTA, feedback)) {
    delta += FEEDBACK_DELTA[feedback];
    reasons.push(`feedback:${feedback}`);
  }
  return { delta, reasons };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeLearningAdjustment(input: {
  quality_score?: number | null;
  learning_delta?: number | null;
  dial_outcome?: string | null;
  feedback_code?: string | null;
  readiness_status?: string | null;
  contactable?: boolean;
  phone_norm?: string | null;
  phone?: string | null;
}): {
  changed: boolean;
  direction: LearningDirection;
  quality_score: number;
  learning_delta: number;
  learning_reasons: string[];
  priority_tier: 'P1' | 'P2' | 'P3';
} {
  const currentScore = Number(input.quality_score ?? 0) || 0;
  const prevDelta = Number(input.learning_delta ?? 0) || 0;
  const { delta, reasons } = learningDeltaFromSignals({
    dial_outcome: input.dial_outcome,
    feedback_code: input.feedback_code,
  });

  if (!reasons.length) {
    const priority_tier = computePriorityTier({
      readiness_status: input.readiness_status,
      quality_score: currentScore,
      contactable: input.contactable,
      phone_norm: input.phone_norm,
      phone: input.phone,
    });
    return {
      changed: false,
      direction: 'unchanged',
      quality_score: clampScore(currentScore),
      learning_delta: prevDelta,
      learning_reasons: [],
      priority_tier,
    };
  }

  const base = currentScore - prevDelta;
  const nextScore = clampScore(base + delta);
  const priority_tier = computePriorityTier({
    readiness_status: input.readiness_status,
    quality_score: nextScore,
    contactable: input.contactable,
    phone_norm: input.phone_norm,
    phone: input.phone,
  });

  const scoreChanged =
    nextScore !== clampScore(currentScore) || delta !== prevDelta;
  let direction: LearningDirection = 'unchanged';
  if (nextScore > clampScore(currentScore)) direction = 'boosted';
  else if (nextScore < clampScore(currentScore)) direction = 'demoted';

  return {
    changed: scoreChanged,
    direction: scoreChanged ? direction : 'unchanged',
    quality_score: nextScore,
    learning_delta: delta,
    learning_reasons: reasons,
    priority_tier,
  };
}
