import { decideReserve } from './msos-capacity.util';

describe('msos-capacity.util decideReserve', () => {
  const base = {
    total: 10,
    reservedHard: 4,
    reservedSoft: 3,
    addQty: 1,
    partnerStatus: 'approved',
  };

  it('blocks when partner suspended', () => {
    expect(
      decideReserve({ ...base, partnerStatus: 'suspended', kind: 'hard' }),
    ).toEqual({ ok: false, error: 'partner_suspended' });
  });

  it('blocks hard overbook', () => {
    expect(
      decideReserve({ ...base, reservedHard: 9, addQty: 2, kind: 'hard' }),
    ).toEqual({ ok: false, error: 'overbook_hard' });
  });

  it('allows soft even when total exceeded (visible conflict)', () => {
    expect(
      decideReserve({ ...base, reservedHard: 8, reservedSoft: 3, addQty: 1, kind: 'soft' }),
    ).toEqual({ ok: true, kind: 'soft', conflict: true });
  });

  it('allows soft without conflict when within total', () => {
    expect(decideReserve({ ...base, kind: 'soft' })).toEqual({
      ok: true,
      kind: 'soft',
      conflict: false,
    });
  });

  it('allows waitlist without touching reserved_hard', () => {
    expect(
      decideReserve({ ...base, reservedHard: 10, addQty: 5, kind: 'waitlist' }),
    ).toEqual({ ok: true, kind: 'waitlist', conflict: false });
  });

  it('allows hard when within total', () => {
    expect(decideReserve({ ...base, kind: 'hard' })).toEqual({
      ok: true,
      kind: 'hard',
      conflict: false,
    });
  });
});
