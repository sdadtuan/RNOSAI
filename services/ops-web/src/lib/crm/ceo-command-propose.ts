import { commitCeoAction, postCeoTurn, type CeoTurnOutput } from '@/lib/api';

export async function proposeCeoAction(
  token: string,
  body: { action_id: string; params: Record<string, unknown>; thread_id?: string },
): Promise<CeoTurnOutput> {
  return postCeoTurn(token, {
    intent: 'propose_action',
    action_id: body.action_id,
    params: body.params,
    thread_id: body.thread_id,
  });
}

export async function commitProposedCeoAction(
  token: string,
  body: { turn_id: string; idempotency_key: string },
) {
  return commitCeoAction(token, body);
}
