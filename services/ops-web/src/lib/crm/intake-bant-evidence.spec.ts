import { describe, expect, it } from 'vitest';
import { groupHasMappedQuestions, hasBantDiscoveryEvidence } from './intake-bant-evidence';

const items = [{ key: 'phone_budget', text: 'NS', bant_key: 'budget' as const }];

describe('groupHasMappedQuestions', () => {
  it('is true when at least one item maps to the key', () => {
    expect(groupHasMappedQuestions('budget', items)).toBe(true);
  });

  it('is false when no item maps to the key', () => {
    expect(groupHasMappedQuestions('fit', items)).toBe(false);
  });
});

describe('hasBantDiscoveryEvidence', () => {
  it('does not warn when group has no mapped questions', () => {
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'fit',
        questionItems: items,
        checked: {},
        responses: {},
      }),
    ).toBe(true);
  });

  it('false when mapped group has empty checked and empty responses', () => {
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: {},
        responses: {},
      }),
    ).toBe(false);
  });

  it('true when checked, answer, or partial confidence', () => {
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: { phone_budget: true },
        responses: {},
      }),
    ).toBe(true);
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: {},
        responses: { phone_budget: { asked: false, answer: '30tr', confidence: '' } },
      }),
    ).toBe(true);
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: {},
        responses: { phone_budget: { asked: false, answer: '', confidence: 'partial' } },
      }),
    ).toBe(true);
  });

  it('true when confidence is confirmed with empty answer', () => {
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: {},
        responses: { phone_budget: { asked: false, answer: '', confidence: 'confirmed' } },
      }),
    ).toBe(true);
  });
});
