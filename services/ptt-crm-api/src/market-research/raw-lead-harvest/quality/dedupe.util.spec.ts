import { buildDedupeKey, isDuplicateAgainst } from './dedupe.util';

describe('dedupe.util', () => {
  it('dedupes by phone_norm', () => {
    const c = buildDedupeKey({ company_name: 'Spa A', phone_norm: '0901234567' });
    const existing = [buildDedupeKey({ company_name: 'Other', phone_norm: '0901234567' })];
    expect(isDuplicateAgainst(c, existing)).toBe(true);
  });

  it('allows different phones same-ish name', () => {
    const c = buildDedupeKey({ company_name: 'Spa A', phone_norm: '0901111111' });
    const existing = [buildDedupeKey({ company_name: 'Spa A', phone_norm: '0902222222' })];
    expect(isDuplicateAgainst(c, existing)).toBe(false);
  });
});
