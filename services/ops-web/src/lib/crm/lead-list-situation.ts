import { leadFollowup } from './lead-followup';
import { leadStatusLabel } from './lead-status';

const SPOKE = new Set([
  'answered',
  'connected_meet_pending',
  'connected_qualified',
  'connected_other',
]);

export type LeadListSituation = {
  status: string;
  call: 'Không nghe máy' | 'Máy bận' | 'Hẹn gọi lại' | 'Sai số' | 'Đã nói chuyện' | null;
  solution: 'Đã chuyển Solution' | null;
};

export function leadListSituation(lead: {
  status?: string | null;
  last_call_result?: string | null;
  solution_handoff?: string | null;
}): LeadListSituation {
  const result = String(lead.last_call_result ?? '').trim().toLowerCase();
  const followup = leadFollowup(lead);
  let call: LeadListSituation['call'] = followup?.label ?? null;
  if (!call && result === 'wrong_number') call = 'Sai số';
  if (!call && SPOKE.has(result)) call = 'Đã nói chuyện';
  const handoff = String(lead.solution_handoff ?? '').trim().toLowerCase();
  const solution =
    handoff === 'pending' || handoff === 'with_solution' ? 'Đã chuyển Solution' : null;
  return {
    status: leadStatusLabel(lead.status),
    call,
    solution,
  };
}
