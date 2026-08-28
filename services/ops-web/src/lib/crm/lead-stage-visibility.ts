export type LeadStageVisibilityInput = {
  flowKind: 'b2b_prospect' | 'spa_operational';
  b2Complete: boolean;
  presalesStage: string | null;
  intakeGo: boolean;
  hasContract: boolean;
  contractStatus: string | null;
  dealRoomEnabled: boolean;
};

export type LeadStageVisibility = {
  showNbaB2b: boolean;
  showJourney: boolean;
  showB2Outcome: boolean;
  showPresalesBlock: boolean;
  showDealRoomBanner: boolean;
  showContractPanel: boolean;
};

const LIVE_CONTRACT = new Set(['draft', 'pending', 'active']);

export function deriveS0IntakeGo(presalesStage: string | null): boolean {
  const stage = (presalesStage ?? '').trim().toLowerCase();
  return stage === 'consult' || stage === 'proposal';
}

export function resolveLeadStageVisibility(
  input: LeadStageVisibilityInput,
): LeadStageVisibility {
  if (input.flowKind === 'spa_operational') {
    return {
      showNbaB2b: false,
      showJourney: false,
      showB2Outcome: !input.b2Complete,
      showPresalesBlock: false,
      showDealRoomBanner: false,
      showContractPanel: false,
    };
  }

  const stage = (input.presalesStage ?? '').trim().toLowerCase();
  const status = (input.contractStatus ?? '').trim().toLowerCase();

  return {
    showNbaB2b: true,
    showJourney: true,
    showB2Outcome: !input.b2Complete,
    showPresalesBlock: input.b2Complete,
    showDealRoomBanner: input.dealRoomEnabled && input.b2Complete && input.intakeGo,
    showContractPanel:
      input.hasContract || stage === 'proposal' || LIVE_CONTRACT.has(status),
  };
}
