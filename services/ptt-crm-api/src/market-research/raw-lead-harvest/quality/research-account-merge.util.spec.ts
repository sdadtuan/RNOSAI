import {
  bestPriorityTier,
  parseGlobalAccountKey,
  pickDisplayName,
  resolveGlobalKeyForMerge,
} from './research-account-merge.util';

describe('research-account-merge.util', () => {
  it('parses global account key parts', () => {
    expect(parseGlobalAccountKey('place:ChIJ1')).toEqual({
      place_id: 'ChIJ1',
      phone_norm: null,
      domain: null,
    });
    expect(parseGlobalAccountKey('phone:0909479018').phone_norm).toBe('0909479018');
    expect(parseGlobalAccountKey('domain:spa.example').domain).toBe('spa.example');
    expect(parseGlobalAccountKey('name:foo')).toEqual({
      place_id: null,
      phone_norm: null,
      domain: null,
    });
  });

  it('picks best priority tier', () => {
    expect(bestPriorityTier('P2', 'P1')).toBe('P1');
    expect(bestPriorityTier('P1', 'P3')).toBe('P1');
    expect(bestPriorityTier(null, 'P2')).toBe('P2');
  });

  it('resolves global key from lead or rebuilds', () => {
    expect(
      resolveGlobalKeyForMerge({ id: 1, global_account_key: 'phone:0909479018' }),
    ).toBe('phone:0909479018');
    expect(
      resolveGlobalKeyForMerge({ id: 2, phone_norm: '0909479018', company_name: 'Spa' }),
    ).toBe('phone:0909479018');
    expect(resolveGlobalKeyForMerge({ id: 3, company_name: 'Spa Only' })).toBeNull();
  });

  it('keeps existing display name', () => {
    expect(pickDisplayName('Spa Hoa', 'Other')).toBe('Spa Hoa');
    expect(pickDisplayName('', 'Spa Hoa')).toBe('Spa Hoa');
    expect(pickDisplayName(null, null)).toBe('Unknown account');
  });
});
