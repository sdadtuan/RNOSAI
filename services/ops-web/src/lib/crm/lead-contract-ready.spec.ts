import { describe, expect, it } from 'vitest';
import {
  contractCreateReady,
  contractSubmitReady,
  readinessCheckHref,
} from './lead-contract-ready';

const upstreamOk = [
  { key: 'b2_complete', ok: true },
  { key: 'presales_active', ok: true },
  { key: 'presales_lead', ok: true },
  { key: 'presales_consult', ok: true },
  { key: 'presales_proposal', ok: true },
  { key: 'marketing_plan', ok: true },
  { key: 'contract_draft', ok: false },
  { key: 'no_pending_approval', ok: true },
];

describe('contractCreateReady', () => {
  it('empty checks → false (not yet fetched)', () => {
    expect(contractCreateReady([])).toBe(false);
  });

  it('S1-G4 upstream ok + no draft → true', () => {
    expect(contractCreateReady(upstreamOk)).toBe(true);
  });

  it('S1-G4 missing B2 → false', () => {
    const checks = upstreamOk.map((c) =>
      c.key === 'b2_complete' ? { ...c, ok: false } : c,
    );
    expect(contractCreateReady(checks)).toBe(false);
  });

  it('ignores contract_draft and no_pending_approval', () => {
    expect(
      contractCreateReady([
        ...upstreamOk,
        { key: 'contract_draft', ok: false },
        { key: 'no_pending_approval', ok: false },
      ]),
    ).toBe(true);
  });
});

describe('contractSubmitReady', () => {
  it('false until every check except no_pending is ok', () => {
    expect(contractSubmitReady(upstreamOk)).toBe(false);
    expect(
      contractSubmitReady(upstreamOk.map((c) => ({ ...c, ok: true }))),
    ).toBe(true);
  });

  it('pending approval does not block submitReady', () => {
    const checks = upstreamOk.map((c) =>
      c.key === 'contract_draft'
        ? { ...c, ok: true }
        : c.key === 'no_pending_approval'
          ? { ...c, ok: false }
          : c,
    );
    expect(contractSubmitReady(checks)).toBe(true);
  });
});

describe('readinessCheckHref', () => {
  it('S1-G1…G3 + remaining keys', () => {
    expect(readinessCheckHref('b2_complete', 5)).toBe('#funnel-b2');
    expect(readinessCheckHref('presales_active', 5)).toBe('#funnel-presales');
    expect(readinessCheckHref('presales_lead', 5)).toBe('/crm/intake?lead_id=5');
    expect(readinessCheckHref('presales_consult', 5)).toBe('#funnel-presales');
    expect(readinessCheckHref('presales_proposal', 5)).toBe('/crm/leads/5/deal-room');
    expect(readinessCheckHref('marketing_plan', 5)).toBe('/crm/leads/5/deal-room');
    expect(readinessCheckHref('contract_draft', 5)).toBe('#lead-contract-amount');
    expect(readinessCheckHref('no_pending_approval', 5)).toBe('/crm/hub');
    expect(readinessCheckHref('unknown_key', 5)).toBeNull();
  });
});
