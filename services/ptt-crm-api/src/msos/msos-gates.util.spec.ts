import { canIssueIo, evaluateLiveGates } from './msos-gates.util';

describe('msos-gates.util', () => {
  describe('canIssueIo GT-P01', () => {
    it('passes when all prerequisites met', () => {
      const out = canIssueIo({
        rateStatus: 'published',
        clientOk: true,
        hasSafetySnapshot: true,
        hardOrValidSoft: true,
      });
      expect(out).toEqual({ pass: true, gate: 'GT-P01' });
    });

    it('fails when rate not published', () => {
      const out = canIssueIo({
        rateStatus: 'draft',
        clientOk: true,
        hasSafetySnapshot: true,
        hardOrValidSoft: true,
      });
      expect(out.pass).toBe(false);
      expect(out.fail).toBe('rate_not_published');
    });

    it('fails when client missing', () => {
      const out = canIssueIo({
        rateStatus: 'published',
        clientOk: false,
        hasSafetySnapshot: true,
        hardOrValidSoft: true,
      });
      expect(out.fail).toBe('client_not_found');
    });

    it('fails when no safety snapshot', () => {
      const out = canIssueIo({
        rateStatus: 'published',
        clientOk: true,
        hasSafetySnapshot: false,
        hardOrValidSoft: true,
      });
      expect(out.fail).toBe('safety_snapshot_required');
    });

    it('fails when no valid reserve', () => {
      const out = canIssueIo({
        rateStatus: 'published',
        clientOk: true,
        hasSafetySnapshot: true,
        hardOrValidSoft: false,
      });
      expect(out.fail).toBe('reserve_required');
    });
  });

  describe('evaluateLiveGates', () => {
    it('canLive when GT-P01 P02 P03 pass and tracking owner set', () => {
      const out = evaluateLiveGates({
        ioIssued: true,
        ratePublished: true,
        reserveOk: true,
        clientOk: true,
        safetyLocked: true,
        trafficReady: true,
        partnerConfirmed: true,
        p03Override: false,
        trackingOwner: true,
      });
      expect(out.canLive).toBe(true);
      expect(out.gates.some((g) => g.id === 'GT-P01' && g.pass)).toBe(true);
      expect(out.gates.some((g) => g.id === 'GT-P02' && g.pass)).toBe(true);
    });

    it('canLive with p03 override when partner not confirmed', () => {
      const out = evaluateLiveGates({
        ioIssued: true,
        ratePublished: true,
        reserveOk: true,
        clientOk: true,
        safetyLocked: true,
        trafficReady: true,
        partnerConfirmed: false,
        p03Override: true,
        trackingOwner: true,
      });
      expect(out.canLive).toBe(true);
      expect(out.gates.find((g) => g.id === 'GT-P03')?.pass).toBe(true);
    });

    it('cannot live without tracking owner', () => {
      const out = evaluateLiveGates({
        ioIssued: true,
        ratePublished: true,
        reserveOk: true,
        clientOk: true,
        safetyLocked: true,
        trafficReady: true,
        partnerConfirmed: true,
        p03Override: false,
        trackingOwner: false,
      });
      expect(out.canLive).toBe(false);
    });
  });
});
