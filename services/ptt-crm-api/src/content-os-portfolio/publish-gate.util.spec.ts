import { evaluatePublishGate } from './publish-gate.util';

describe('evaluatePublishGate', () => {
  const base = {
    briefReady: true,
    internalApproved: true,
    legalRequired: true,
    legalApproved: false,
    rightsValid: true,
    altComplete: false,
    clientApproved: false,
    urlOk: true,
    versionLocked: true,
    accountHealthy: true,
  };

  it('Blocked when alt, legal, or client missing', () => {
    const r = evaluatePublishGate(base);
    expect(r.status).toBe('Blocked');
    expect(r.blockers.map((b) => b.code).sort()).toEqual(
      ['a11y_alt', 'client_approval', 'legal_pending'].sort(),
    );
  });

  it('Pass when all required clear', () => {
    const r = evaluatePublishGate({
      ...base,
      legalApproved: true,
      altComplete: true,
      clientApproved: true,
    });
    expect(r.status).toBe('Pass');
    expect(r.blockers).toEqual([]);
  });

  it('Warning when rights paid expiry approaching but still valid', () => {
    const r = evaluatePublishGate({
      ...base,
      legalApproved: true,
      altComplete: true,
      clientApproved: true,
      paidExpiryWarning: true,
    });
    expect(r.status).toBe('Warning');
  });
});
