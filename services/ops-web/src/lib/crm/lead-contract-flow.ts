export interface LeadContractFlowSummary {
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  lifecycleId: number | null;
  lifecycleStage?: string | null;
  agencyClientId?: string | null;
}
