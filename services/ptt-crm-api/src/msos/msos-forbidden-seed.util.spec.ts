import { UnprocessableEntityException } from '@nestjs/common';
import { assertAllowedMsosName } from './msos-forbidden-seed.util';

describe('msos-forbidden-seed.util', () => {
  it('rejects forbidden demo names', () => {
    for (const name of ['Sunlight Residence', 'Admicro giả', 'Nova Home Media', 'Tâm An Group']) {
      expect(() => assertAllowedMsosName(name)).toThrow(UnprocessableEntityException);
      try {
        assertAllowedMsosName(name);
      } catch (e) {
        expect((e as UnprocessableEntityException).getResponse()).toEqual({ error: 'forbidden_demo_name' });
      }
    }
  });

  it('allows real publisher names like VnExpress', () => {
    expect(() => assertAllowedMsosName('VnExpress')).not.toThrow();
    expect(() => assertAllowedMsosName('Cong ty TNHH ABC Truyen thong')).not.toThrow();
  });

  it('throws UnprocessableEntityException', () => {
    expect(() => assertAllowedMsosName('Sunlight')).toThrow(UnprocessableEntityException);
  });
});
