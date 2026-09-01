import { towerDrillHref } from './ceo-tower-drill.util';

describe('towerDrillHref', () => {
  it('A lead → /crm/leads/:id', () => {
    expect(towerDrillHref({
      factory: 'A', columnId: 'lead_b2', sensorIds: ['S1'], leadId: 7,
    })).toBe('/crm/leads/7');
  });
  it('A contract → hub or lead#lead-contract', () => {
    expect(towerDrillHref({
      factory: 'A', columnId: 'contract', sensorIds: ['S4'], leadId: 7,
    })).toMatch(/\/crm\/(hub|leads\/7)/);
  });
  it('A S5 → service-delivery + tab=ai-planner', () => {
    expect(towerDrillHref({
      factory: 'A', columnId: 'tmmt_deliver', sensorIds: ['S5'], lifecycleId: 3,
    })).toBe('/crm/service-delivery/3?tab=ai-planner');
  });
  it('A never href cskh-board', () => {
    const href = towerDrillHref({
      factory: 'A', columnId: 'care', sensorIds: ['S10'], lifecycleId: 3,
    });
    expect(href).not.toContain('/crm/cskh-board');
  });
  it('B never href ai-planner', () => {
    const href = towerDrillHref({
      factory: 'B', columnId: 'care', sensorIds: ['S9'], leadId: 8,
    });
    expect(href).not.toContain('ai-planner');
    expect(href).toContain('/crm/cskh-board');
  });
});
