export function assertActualWritable(input: {
  quality: string;
  collection_method: string;
  incoming_actual?: number;
}) {
  const auto = input.collection_method === 'api' || input.collection_method === 'connector';
  if (input.incoming_actual != null && input.quality === 'verified' && auto) {
    throw new Error('actual_locked');
  }
}

export function assertRedRitual(input: { health: string; blocker: string; action_title: string }) {
  if (input.health !== 'red') return;
  if (!input.blocker.trim()) throw new Error('blocker_required_when_red');
  if (!input.action_title.trim()) throw new Error('action_required_when_red');
}

export function assertReviewTransition(
  from: string,
  to: 'approved' | 'returned' | 'escalated',
  comment: string,
): 'approved' | 'returned' | 'escalated' {
  if (from !== 'submitted') throw new Error('invalid_review_state');
  if (to === 'returned' && !comment.trim()) throw new Error('return_comment_required');
  return to;
}

export function nextCorrection(
  current: { id: string; value: number; quality: string },
  value: number,
) {
  return {
    id: `act-corr-${current.id}`,
    value,
    quality: 'pending' as const,
    supersedes: current.id,
  };
}
