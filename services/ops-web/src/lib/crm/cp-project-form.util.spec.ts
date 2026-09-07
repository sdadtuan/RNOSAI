import { describe, expect, it } from 'vitest';
import {
  formatLifecycleOption,
  industryFromClient,
  parseMemberStaffIds,
} from './cp-project-form.util';

describe('PRJ-02 create form helpers', () => {
  it('labels a lifecycle like the mockup LC-id — slug', () => {
    expect(formatLifecycleOption({ id: '1', service_slug: 'meta-lead-gen' })).toBe(
      'LC-1 — meta-lead-gen',
    );
    expect(formatLifecycleOption({ id: '', service_slug: '' })).toBe('—');
  });

  it('copies industry from the selected SoR client', () => {
    expect(industryFromClient({ industry: 'Bất động sản' })).toBe('Bất động sản');
    expect(industryFromClient({ industry: null })).toBe('');
    expect(industryFromClient(null)).toBe('');
  });

  it('reads member staff ids from a multi-select, ignoring blanks', () => {
    expect(parseMemberStaffIds(['5', '4', ''])).toEqual([5, 4]);
    expect(parseMemberStaffIds([])).toEqual([]);
  });
});
