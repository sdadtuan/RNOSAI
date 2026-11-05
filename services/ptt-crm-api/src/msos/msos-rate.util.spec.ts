import { UnprocessableEntityException } from '@nestjs/common';
import { assertRateBindable } from './msos-rate.util';

describe('msos-rate.util', () => {
  it('GT-01 rejects non-published rate versions', () => {
    expect(() => assertRateBindable('draft')).toThrow(UnprocessableEntityException);
    try {
      assertRateBindable('draft');
    } catch (e) {
      expect((e as UnprocessableEntityException).getResponse()).toEqual({ error: 'rate_not_published' });
    }
    expect(() => assertRateBindable('expired')).toThrow(UnprocessableEntityException);
  });

  it('GT-01 allows published rate versions', () => {
    expect(() => assertRateBindable('published')).not.toThrow();
  });
});
