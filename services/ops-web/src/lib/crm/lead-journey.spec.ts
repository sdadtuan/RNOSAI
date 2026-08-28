import { describe, expect, it } from 'vitest';
import { resolveLeadJourney } from './lead-journey';

describe('resolveLeadJourney', () => {
  it('lead #5 — B2 current, rest pending', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: false,
      presalesStage: null,
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.map((s) => s.key)).toEqual([
      'b2',
      'presales',
      'intake',
      'consult',
      'proposal',
      'contract',
    ]);
    expect(steps[0]).toMatchObject({ key: 'b2', state: 'current', label_vi: 'B2 Liên hệ' });
    expect(steps.slice(1).every((s) => s.state === 'pending')).toBe(true);
  });

  it('B2 done + stage lead → intake current', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'lead',
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'b2')?.state).toBe('done');
    expect(steps.find((s) => s.key === 'intake')?.state).toBe('current');
  });

  it('review queue blocks all', () => {
    const steps = resolveLeadJourney({
      reviewActive: true,
      b2Complete: false,
      presalesStage: null,
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.every((s) => s.state === 'blocked')).toBe(true);
  });

  it('proposal without contract → HĐ pending, proposal current', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: false,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'proposal')?.state).toBe('current');
    expect(steps.find((s) => s.key === 'contract')?.state).toBe('pending');
  });

  it('proposal + draft HĐ → HĐ current', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'contract')?.state).toBe('current');
  });

  it('active HĐ + lifecycle → HĐ done + service-delivery href', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'proposal',
      hasContract: true,
      contractActive: true,
      lifecycleId: 88,
    });
    const contract = steps.find((s) => s.key === 'contract');
    expect(contract?.state).toBe('done');
    expect(contract?.href).toBe('/crm/service-delivery/88');
  });

  it('contractActive + lifecycleId at consult → HĐ done + service-delivery href', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'consult',
      hasContract: true,
      contractActive: true,
      lifecycleId: 42,
    });
    const contract = steps.find((s) => s.key === 'contract');
    expect(contract?.state).toBe('done');
    expect(contract?.href).toBe('/crm/service-delivery/42');
  });

  it('draft HĐ ở stage lead → HĐ vẫn pending trên journey', () => {
    const steps = resolveLeadJourney({
      reviewActive: false,
      b2Complete: true,
      presalesStage: 'lead',
      hasContract: true,
      contractActive: false,
      lifecycleId: null,
    });
    expect(steps.find((s) => s.key === 'contract')?.state).toBe('pending');
  });
});
