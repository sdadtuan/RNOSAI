import {
  applyCriticFlagToLead,
  normalizeCriticFlag,
  parseCriticClassifications,
  type CriticFlag,
} from './harvest-critic.util';

describe('parseCriticClassifications', () => {
  it('parses object array with soft classes', () => {
    const raw = JSON.stringify([
      { index: 0, class: 'keep', reason: 'ok' },
      { index: 1, class: 'weak_contact', reason: 'no phone' },
      { index: 2, class: 'likely_fabricated', reason: 'fake phone' },
    ]);
    const out = parseCriticClassifications(raw, 3);
    expect(out.get(0)).toEqual({ flag: 'keep', reason: 'ok' });
    expect(out.get(1)).toEqual({ flag: 'weak_contact', reason: 'no phone' });
    expect(out.get(2)).toEqual({ flag: 'likely_fabricated', reason: 'fake phone' });
  });

  it('maps legacy drop index array to likely_fabricated (soft keep others)', () => {
    const out = parseCriticClassifications('[0,2]', 3);
    expect(out.get(0)?.flag).toBe('likely_fabricated');
    expect(out.get(1)?.flag).toBe('keep');
    expect(out.get(2)?.flag).toBe('likely_fabricated');
  });

  it('does not hard-drop weak_contact', () => {
    expect(applyCriticFlagToLead('weak_contact').forceReject).toBe(false);
    expect(applyCriticFlagToLead('weak_contact').classification).toBe('needs_review');
  });

  it('hard-rejects fabricated / generic / weak evidence', () => {
    for (const flag of ['likely_fabricated', 'generic_name', 'weak_evidence'] as CriticFlag[]) {
      const a = applyCriticFlagToLead(flag);
      expect(a.forceReject).toBe(true);
      expect(a.classification).toBe('rejected_critic');
    }
  });

  it('normalizes unknown class to keep', () => {
    expect(normalizeCriticFlag('nope')).toBe('keep');
    expect(normalizeCriticFlag('KEEP')).toBe('keep');
  });
});
