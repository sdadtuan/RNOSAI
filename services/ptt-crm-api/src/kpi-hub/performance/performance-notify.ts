export type NotifyType =
  | 'assignment_activated'
  | 'checkin_due'
  | 'checkin_overdue'
  | 'health_yellow'
  | 'health_red'
  | 'quality_stale'
  | 'action_due'
  | 'scorecard_pending'
  | 'period_closed';

export function buildNotifyEvent(input: {
  type: NotifyType;
  owner?: string;
  lead?: string;
  account?: string;
  data_owner?: string;
  client_scoped?: boolean;
  href: string;
  title: string;
}) {
  const audience: string[] = [];
  if (input.type === 'quality_stale') {
    if (input.data_owner) audience.push(input.data_owner);
    if (input.owner) audience.push(input.owner);
    if (input.lead) audience.push(input.lead);
  } else if (input.type === 'health_red') {
    if (input.owner) audience.push(input.owner);
    if (input.lead) audience.push(input.lead);
    if (input.client_scoped && input.account) audience.push(input.account);
  } else if (input.type === 'health_yellow') {
    if (input.owner) audience.push(input.owner);
  } else {
    if (input.owner) audience.push(input.owner);
    if (input.lead) audience.push(input.lead);
  }
  const severity =
    input.type === 'health_red' ? 'critical' : input.type === 'quality_stale' || input.type === 'checkin_overdue' ? 'high' : 'info';
  return { type: input.type, audience, severity, href: input.href, title: input.title };
}
