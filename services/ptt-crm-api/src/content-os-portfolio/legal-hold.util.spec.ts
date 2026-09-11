import { ConflictException, NotFoundException } from '@nestjs/common';
import { assertHardDeleteAllowed, isLegalHold } from './legal-hold.util';

describe('legal hold', () => {
  it('defaults legal_hold to false', () => {
    expect(isLegalHold(undefined)).toBe(false);
    expect(isLegalHold(null)).toBe(false);
    expect(isLegalHold({})).toBe(false);
    expect(isLegalHold({ legal_hold: false })).toBe(false);
  });

  it('blocks hard delete with 409 legal_hold when the flag is true', () => {
    expect(() => assertHardDeleteAllowed({ id: 21, legal_hold: true })).toThrow(ConflictException);
    try {
      assertHardDeleteAllowed({ id: 21, legal_hold: true });
    } catch (err) {
      expect(err).toMatchObject({ status: 409 });
      expect((err as ConflictException).getResponse()).toEqual({ error: 'legal_hold' });
    }
  });

  it('allows hard delete when legal_hold is false and 404s a missing item', () => {
    expect(() => assertHardDeleteAllowed({ id: 21, legal_hold: false })).not.toThrow();
    expect(() => assertHardDeleteAllowed(null)).toThrow(NotFoundException);
  });
});
