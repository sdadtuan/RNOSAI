import { emptySectionsForCode } from './iwr-sections.util';

describe('iwr-sections.util', () => {
  it('seeds daily weekly monthly keys', () => {
    expect(Object.keys(emptySectionsForCode('daily_work'))).toEqual([
      'general',
      'done',
      'wip',
      'next',
      'blocked',
      'approvals',
      'notes',
    ]);
    expect(Object.keys(emptySectionsForCode('weekly_work'))).toHaveLength(10);
    expect(emptySectionsForCode('monthly_work').people).toEqual({ body: '', items: [] });
  });
});
