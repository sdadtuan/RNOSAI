import { assignTowerColumn, isTowerUatSeed } from './ceo-tower-column.util';
import type { TowerEntityInput } from './ceo-tower.types';

const baseA = (): TowerEntityInput => ({
  factory: 'A',
  leadId: 10,
  lifecycleId: null,
  b2Done: false,
  intakeGo: false,
  contractPendingOrActive: false,
  won: false,
  hasLifecycle: false,
  clientActive: false,
  retain: false,
  spaOnBoard: false,
  firstCallDone: false,
});

describe('assignTowerColumn', () => {
  it('A !b2_done → lead_b2', () => {
    expect(assignTowerColumn(baseA())).toBe('lead_b2');
  });
  it('A b2_done && !intake_go → intake', () => {
    expect(assignTowerColumn({ ...baseA(), b2Done: true })).toBe('intake');
  });
  it('A intake_go && !contract → consult', () => {
    expect(assignTowerColumn({ ...baseA(), b2Done: true, intakeGo: true })).toBe('consult');
  });
  it('A contract pending → contract', () => {
    expect(assignTowerColumn({
      ...baseA(), b2Done: true, intakeGo: true, contractPendingOrActive: true,
    })).toBe('contract');
  });
  it('A won without lifecycle → contract (S4, not dropped)', () => {
    expect(assignTowerColumn({
      ...baseA(), b2Done: true, intakeGo: true, won: true, hasLifecycle: false,
    })).toBe('contract');
  });
  it('A post-won lifecycle !client_active → tmmt_deliver', () => {
    expect(assignTowerColumn({
      ...baseA(), won: true, hasLifecycle: true, lifecycleId: 99, clientActive: false,
    })).toBe('tmmt_deliver');
  });
  it('A client_active → care', () => {
    expect(assignTowerColumn({
      ...baseA(), won: true, hasLifecycle: true, lifecycleId: 99, clientActive: true,
    })).toBe('care');
  });
  it('B on board → care', () => {
    expect(assignTowerColumn({
      ...baseA(), factory: 'B', spaOnBoard: true, firstCallDone: true,
    })).toBe('care');
  });
  it('B no first call when filter B → lead_b2', () => {
    expect(assignTowerColumn({
      ...baseA(), factory: 'B', spaOnBoard: true, firstCallDone: false,
    }, { factoryFilter: 'B' })).toBe('lead_b2');
  });
});

describe('isTowerUatSeed', () => {
  it('excludes sqlite_lead_id >= 900000901', () => {
    expect(isTowerUatSeed(900000901, [])).toBe(true);
  });
  it('excludes mkt-ai-smoke-seed tag', () => {
    expect(isTowerUatSeed(12, ['mkt-ai-smoke-seed'])).toBe(true);
  });
  it('keeps real lead', () => {
    expect(isTowerUatSeed(12, [])).toBe(false);
  });
});
