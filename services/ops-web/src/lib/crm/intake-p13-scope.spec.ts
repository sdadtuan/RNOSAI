import { describe, expect, it } from 'vitest';
import { mergeIntakeP13Scope, readIntakeP13Scope, toggleScopeItem } from './intake-p13-scope';

describe('intake p13 scope', () => {
  it('reads the saved service and item codes', () => {
    expect(
      readIntakeP13Scope({
        p13_scope: { service_code: 'seo', item_codes: ['SEO-01', 'SEO-01', ''] },
      }),
    ).toEqual({ service_code: 'SEO', item_codes: ['SEO-01'] });
  });

  it('merges the scope into answers without dropping other keys', () => {
    expect(mergeIntakeP13Scope({ need: 'x' }, { service_code: 'WEB', item_codes: ['WEB-01'] })).toEqual({
      need: 'x',
      p13_scope: { service_code: 'WEB', item_codes: ['WEB-01'] },
    });
  });

  it('toggles an item on and off', () => {
    expect(toggleScopeItem(['SEO-01'], 'SEO-02', true)).toEqual(['SEO-01', 'SEO-02']);
    expect(toggleScopeItem(['SEO-01', 'SEO-02'], 'SEO-01', false)).toEqual(['SEO-02']);
  });
});
