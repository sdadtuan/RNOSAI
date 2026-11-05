import { EVIDENCE_SLA_HOURS, canOfficial, isFresh } from './msos-evidence-pack.util';

describe('msos-evidence-pack.util', () => {
  const now = new Date('2026-09-12T12:00:00Z');

  it('isFresh within SLA hours', () => {
    const captured = new Date('2026-09-12T00:00:00Z');
    expect(isFresh(captured, now, EVIDENCE_SLA_HOURS)).toBe(true);
  });

  it('isFresh false when stale', () => {
    const captured = new Date('2026-09-10T00:00:00Z');
    expect(isFresh(captured, now, EVIDENCE_SLA_HOURS)).toBe(false);
  });

  it('canOfficial with fresh hashed item', () => {
    const out = canOfficial(
      [{ hash: 'abc123', capturedAt: new Date('2026-09-12T10:00:00Z'), source: 'partner_report' }],
      now,
    );
    expect(out).toBe(true);
  });

  it('canOfficial false without hash', () => {
    const out = canOfficial(
      [{ hash: '', capturedAt: new Date('2026-09-12T10:00:00Z'), source: 'partner_report' }],
      now,
    );
    expect(out).toBe(false);
  });

  it('canOfficial false when stale', () => {
    const out = canOfficial(
      [{ hash: 'abc123', capturedAt: new Date('2026-09-08T10:00:00Z'), source: 'partner_report' }],
      now,
    );
    expect(out).toBe(false);
  });

  it('canOfficial false without source', () => {
    const out = canOfficial(
      [{ hash: 'abc123', capturedAt: new Date('2026-09-12T10:00:00Z'), source: '' }],
      now,
    );
    expect(out).toBe(false);
  });
});
