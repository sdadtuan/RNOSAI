import {
  buildPromoteClientNotes,
  generatePromoteClientCode,
  pickDedupClientId,
  resolvePromoteClientName,
} from './contract-promote-client.util';

describe('resolvePromoteClientName', () => {
  it('prefers meta.company then company_name then full_name', () => {
    expect(resolvePromoteClientName({ company: ' ACME ' }, 'Person')).toBe('ACME');
    expect(resolvePromoteClientName({ company_name: 'Beta Co' }, 'Person')).toBe('Beta Co');
    expect(resolvePromoteClientName({}, '  Nguyễn A  ')).toBe('Nguyễn A');
  });
});

describe('generatePromoteClientCode', () => {
  it('WS2: L{leadId} then suffix on collision', () => {
    const taken = new Set<string>(['L5']);
    expect(generatePromoteClientCode(5, new Set())).toBe('L5');
    expect(generatePromoteClientCode(5, taken)).toBe('L5A');
    expect(generatePromoteClientCode(5, new Set(['L5', 'L5A']))).toBe('L5B');
  });
});

describe('pickDedupClientId', () => {
  it('WS2-03 single candidate → link_dedup_name', () => {
    const out = pickDedupClientId(['uuid-1']);
    expect(out).toEqual({ mode: 'link_dedup_name', clientId: 'uuid-1', ambiguousIds: [] });
  });

  it('WS2-04 multiple candidates → link_ambiguous', () => {
    const out = pickDedupClientId(['a', 'b']);
    expect(out.mode).toBe('link_ambiguous');
    expect(out.clientId).toBeNull();
    expect(out.ambiguousIds).toEqual(['a', 'b']);
  });

  it('zero candidates → created path (null id)', () => {
    expect(pickDedupClientId([])).toEqual({ mode: 'created', clientId: null, ambiguousIds: [] });
  });
});

describe('buildPromoteClientNotes', () => {
  it('includes contract/lead/lifecycle and needs_merge tag', () => {
    expect(buildPromoteClientNotes(9, 5, 12, false)).toContain('Promote HĐ #9');
    expect(buildPromoteClientNotes(9, 5, 12, true)).toContain('[needs_merge]');
  });
});
