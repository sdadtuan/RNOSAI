import { describe, expect, it } from 'vitest';
import { deriveS0IntakeGo, resolveLeadStageVisibility } from './lead-stage-visibility';

const b2bOpen = {
  flowKind: 'b2b_prospect' as const,
  b2Complete: false,
  presalesStage: null as string | null,
  intakeGo: false,
  hasContract: false,
  contractStatus: null as string | null,
  dealRoomEnabled: true,
};

describe('deriveS0IntakeGo', () => {
  it('true only for consult|proposal', () => {
    expect(deriveS0IntakeGo(null)).toBe(false);
    expect(deriveS0IntakeGo('')).toBe(false);
    expect(deriveS0IntakeGo('lead')).toBe(false);
    expect(deriveS0IntakeGo('consult')).toBe(true);
    expect(deriveS0IntakeGo('proposal')).toBe(true);
    expect(deriveS0IntakeGo('Proposal')).toBe(true);
  });
});

describe('resolveLeadStageVisibility', () => {
  it('VIS-01/02 lead #5 — B2B B2 mở: không HĐ, không Deal Room', () => {
    const out = resolveLeadStageVisibility(b2bOpen);
    expect(out).toEqual({
      showNbaB2b: true,
      showJourney: true,
      showB2Outcome: true,
      showPresalesBlock: false,
      showDealRoomBanner: false,
      showContractPanel: false,
    });
  });

  it('VIS-03 B2 xong, stage lead — ensure Pre-sales, Deal Room tắt', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'lead',
      intakeGo: deriveS0IntakeGo('lead'),
    });
    expect(out.showPresalesBlock).toBe(true);
    expect(out.showB2Outcome).toBe(false);
    expect(out.showDealRoomBanner).toBe(false);
    expect(out.showContractPanel).toBe(false);
  });

  it('Deal Room banner only after Intake Go', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'consult',
      intakeGo: deriveS0IntakeGo('consult'),
    });
    expect(out.showDealRoomBanner).toBe(true);
    expect(out.showContractPanel).toBe(false);
  });

  it('proposal without contract → show HĐ panel, Deal Room on', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'proposal',
      intakeGo: true,
    });
    expect(out.showContractPanel).toBe(true);
    expect(out.showDealRoomBanner).toBe(true);
  });

  it('VIS-05 draft HĐ lệch stage vẫn hiện panel', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'lead',
      intakeGo: false,
      hasContract: true,
      contractStatus: 'draft',
    });
    expect(out.showContractPanel).toBe(true);
    expect(out.showDealRoomBanner).toBe(false);
  });

  it('contractStatus pending/active hiện panel dù chưa proposal', () => {
    for (const contractStatus of ['pending', 'active'] as const) {
      const out = resolveLeadStageVisibility({
        ...b2bOpen,
        b2Complete: true,
        presalesStage: 'consult',
        intakeGo: true,
        hasContract: false,
        contractStatus,
      });
      expect(out.showContractPanel).toBe(true);
    }
  });

  it('VIS-04 spa_operational — tắt B2B chrome; B2 outcome nếu chưa xong', () => {
    const open = resolveLeadStageVisibility({
      ...b2bOpen,
      flowKind: 'spa_operational',
    });
    expect(open).toEqual({
      showNbaB2b: false,
      showJourney: false,
      showB2Outcome: true,
      showPresalesBlock: false,
      showDealRoomBanner: false,
      showContractPanel: false,
    });

    const done = resolveLeadStageVisibility({
      ...b2bOpen,
      flowKind: 'spa_operational',
      b2Complete: true,
      hasContract: true,
      contractStatus: 'draft',
      intakeGo: true,
    });
    expect(done.showB2Outcome).toBe(false);
    expect(done.showContractPanel).toBe(false);
    expect(done.showDealRoomBanner).toBe(false);
    expect(done.showNbaB2b).toBe(false);
  });

  it('Deal Room flag off → banner off even at consult', () => {
    const out = resolveLeadStageVisibility({
      ...b2bOpen,
      b2Complete: true,
      presalesStage: 'consult',
      intakeGo: true,
      dealRoomEnabled: false,
    });
    expect(out.showDealRoomBanner).toBe(false);
  });
});
