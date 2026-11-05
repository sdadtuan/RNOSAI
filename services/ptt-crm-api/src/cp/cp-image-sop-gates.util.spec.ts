import { HttpException } from '@nestjs/common';
import {
  assertOfficialLockup,
  assertPackBeforeG3,
  assertSelectBeforeRefine,
} from './cp-image-sop-gates.util';

describe('cp-image-sop-gates.util', () => {
  it('GT-I11 throws without winner', () => {
    expect(() => assertSelectBeforeRefine(null)).toThrow(HttpException);
    expect(() => assertSelectBeforeRefine(null)).toThrow(
      expect.objectContaining({ gate: 'GT-I11' }),
    );
  });

  it('GT-I09 blocks text_cta without overlay', () => {
    expect(() =>
      assertOfficialLockup({ intent: 'text_cta', overlayLockup: false, waiver: false }),
    ).toThrow(expect.objectContaining({ gate: 'GT-I09' }));
  });

  it('GT-I09 allows text_cta with overlay', () => {
    expect(() =>
      assertOfficialLockup({ intent: 'text_cta', overlayLockup: true, waiver: false }),
    ).not.toThrow();
  });

  it('GT-I10 blocks missing format pack', () => {
    expect(() => assertPackBeforeG3(null)).toThrow(expect.objectContaining({ gate: 'GT-I10' }));
    expect(() => assertPackBeforeG3({ '1:1': 'a' })).toThrow(
      expect.objectContaining({ gate: 'GT-I10' }),
    );
  });

  it('GT-I10 passes complete format pack', () => {
    expect(() =>
      assertPackBeforeG3({
        '1:1': 'asset-1',
        '4:5': 'asset-2',
        '9:16': 'asset-3',
        '16:9': 'asset-4',
      }),
    ).not.toThrow();
  });
});
