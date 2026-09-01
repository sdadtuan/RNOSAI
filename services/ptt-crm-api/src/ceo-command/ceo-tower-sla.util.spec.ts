import { clockSeverity } from './ceo-tower-sla.util';

const hour = 3600_000;
const day = 24 * hour;

describe('clockSeverity', () => {
  it('lead_b2 A no owner 2h → amber, 4h → red', () => {
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 2 * hour, noOwner: true,
    })).toBe('amber');
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 4 * hour, noOwner: true,
    })).toBe('red');
  });
  it('lead_b2 A no B2 4h amber, 8h red', () => {
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 4 * hour, noB2: true,
    })).toBe('amber');
    expect(clockSeverity({
      columnId: 'lead_b2', factory: 'A', elapsedMs: 8 * hour, noB2: true,
    })).toBe('red');
  });
  it('intake 3d amber, 5d red', () => {
    expect(clockSeverity({ columnId: 'intake', factory: 'A', elapsedMs: 3 * day })).toBe('amber');
    expect(clockSeverity({ columnId: 'intake', factory: 'A', elapsedMs: 5 * day })).toBe('red');
  });
  it('consult 5d amber, 10d red', () => {
    expect(clockSeverity({ columnId: 'consult', factory: 'A', elapsedMs: 5 * day })).toBe('amber');
    expect(clockSeverity({ columnId: 'consult', factory: 'A', elapsedMs: 10 * day })).toBe('red');
  });
  it('contract pending 24h amber, 48h red', () => {
    expect(clockSeverity({ columnId: 'contract', factory: 'A', elapsedMs: 24 * hour })).toBe('amber');
    expect(clockSeverity({ columnId: 'contract', factory: 'A', elapsedMs: 48 * hour })).toBe('red');
  });
  it('won no lifecycle 24h → red', () => {
    expect(clockSeverity({
      columnId: 'contract', factory: 'A', elapsedMs: 24 * hour, wonNoLifecycle: true,
    })).toBe('red');
  });
  it('tmmt 5d amber, 7d red', () => {
    expect(clockSeverity({ columnId: 'tmmt_deliver', factory: 'A', elapsedMs: 5 * day })).toBe('amber');
    expect(clockSeverity({ columnId: 'tmmt_deliver', factory: 'A', elapsedMs: 7 * day })).toBe('red');
  });
});
