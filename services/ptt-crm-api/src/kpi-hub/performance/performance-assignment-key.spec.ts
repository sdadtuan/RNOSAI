import { assertUniqueAssignment, assignmentKey } from './performance-assignment-key';

describe('performance-assignment-key', () => {
  it('blocks duplicate definition + scope + period', () => {
    const existing = [
      { definition_code: 'MKT_006', scope_type: 'campaign', scope_id: 'an-phat', period: '09/2026' },
    ];
    expect(assignmentKey(existing[0])).toBe('MKT_006|campaign|an-phat|09/2026');
    expect(() =>
      assertUniqueAssignment(existing, {
        definition_code: 'MKT_006',
        scope_type: 'campaign',
        scope_id: 'an-phat',
        period: '09/2026',
      }),
    ).toThrow(/duplicate_assignment/);
    expect(() =>
      assertUniqueAssignment(existing, {
        definition_code: 'MKT_006',
        scope_type: 'campaign',
        scope_id: 'spa-abc',
        period: '09/2026',
      }),
    ).not.toThrow();
  });
});
