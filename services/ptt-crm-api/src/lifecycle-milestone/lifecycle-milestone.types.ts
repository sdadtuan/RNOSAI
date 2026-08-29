export type LifecycleMilestoneKey =
  | 'b2_done'
  | 'intake_go'
  | 'contract_active'
  | 'client_active';

export type RecordMilestoneInput = {
  leadId: number;
  key: LifecycleMilestoneKey;
  occurredAt: Date | string;
  source: string;
  refId?: string;
  payload?: Record<string, unknown>;
};
