import { ConflictException, NotFoundException } from '@nestjs/common';
import { assertHardDeleteOutcome, isLegalHold } from './legal-hold.util';

describe('legal hold', () => {
  it('defaults legal_hold to false', () => {
    expect(isLegalHold(undefined)).toBe(false);
    expect(isLegalHold(null)).toBe(false);
    expect(isLegalHold({})).toBe(false);
    expect(isLegalHold({ legal_hold: false })).toBe(false);
  });

  it('maps an atomic held outcome to 409 legal_hold', () => {
    expect(() => assertHardDeleteOutcome('held', 21)).toThrow(ConflictException);
    try {
      assertHardDeleteOutcome('held', 21);
    } catch (err) {
      expect(err).toMatchObject({ status: 409 });
      expect((err as ConflictException).getResponse()).toEqual({ error: 'legal_hold' });
    }
  });

  it('maps an atomic missing outcome to 404 and deleted to ok', () => {
    expect(assertHardDeleteOutcome('deleted', 21)).toEqual({ ok: true, id: 21 });
    expect(() => assertHardDeleteOutcome('missing', 99)).toThrow(NotFoundException);
  });
});
