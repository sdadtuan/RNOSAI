import { UnprocessableEntityException } from '@nestjs/common';
import { assertNotSilentActual, classifyDiscrepancy } from './msos-discrepancy.util';

describe('msos-discrepancy.util', () => {
  describe('classifyDiscrepancy', () => {
    it('computes bps and material when over tolerance', () => {
      const out = classifyDiscrepancy(300, 282, 300);
      expect(out.bps).toBe(600);
      expect(out.material).toBe(true);
    });

    it('not material within tolerance', () => {
      const out = classifyDiscrepancy(300, 295, 300);
      expect(out.material).toBe(false);
    });

    it('bps null when report missing', () => {
      const out = classifyDiscrepancy(300, null, 300);
      expect(out.bps).toBeNull();
      expect(out.material).toBe(false);
    });
  });

  describe('assertNotSilentActual GT-P06', () => {
    it('throws when actual equals plan on shortfall', () => {
      expect(() => assertNotSilentActual(300, 300, 282)).toThrow(UnprocessableEntityException);
      try {
        assertNotSilentActual(300, 300, 282);
      } catch (e) {
        expect((e as UnprocessableEntityException).getResponse()).toEqual({
          error: 'actual_eq_plan_forbidden',
        });
      }
    });

    it('passes when actual reflects shortfall', () => {
      expect(() => assertNotSilentActual(300, 282, 282)).not.toThrow();
    });

    it('passes when no report', () => {
      expect(() => assertNotSilentActual(300, 300, null)).not.toThrow();
    });
  });
});
