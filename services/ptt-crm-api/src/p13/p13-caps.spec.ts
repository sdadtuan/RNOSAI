import { p13PositionCaps } from './p13-caps';

describe('p13PositionCaps catalog view', () => {
  it('lets AE and ACM open the catalog without pricing or manage', () => {
    for (const code of ['AE', 'ae', 'ACM']) {
      const caps = p13PositionCaps(code);
      expect(caps).toEqual([{ section_id: 'p13_catalog', action: 'view' }]);
    }
  });

  it('leaves an unrelated position without P13 caps', () => {
    expect(p13PositionCaps('intern')).toEqual([]);
  });
});
