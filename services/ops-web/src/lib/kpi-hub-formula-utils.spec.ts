import { describe, expect, it } from 'vitest';
import {
  createFormulaFilter,
  filtersToDisplay,
  removeFilter,
  toggleFilterJoin,
  updateFilter,
} from './kpi-hub-formula-utils';

describe('kpi-hub-formula-utils', () => {
  it('creates filter with defaults', () => {
    const f = createFormulaFilter();
    expect(f.field).toBe('Status');
    expect(f.operator).toBe('=');
    expect(f.value).toBe('');
  });

  it('renders filter display string', () => {
    const filters = [
      createFormulaFilter({ id: 'a', field: 'Status', operator: '=', value: 'Valid' }),
      createFormulaFilter({ id: 'b', field: 'Channel', operator: 'IN', value: 'Meta', join: 'AND' }),
    ];
    expect(filtersToDisplay(filters)).toBe('Status = Valid AND Channel IN Meta');
  });

  it('toggles join chip', () => {
    const filters = [
      createFormulaFilter({ id: 'a', join: 'AND' }),
      createFormulaFilter({ id: 'b', join: 'AND' }),
    ];
    const next = toggleFilterJoin(filters, 'b');
    expect(next[1]?.join).toBe('OR');
  });

  it('updates and removes filters', () => {
    const filters = [createFormulaFilter({ id: 'a', value: 'Draft' })];
    const updated = updateFilter(filters, 'a', { value: 'Active' });
    expect(updated[0]?.value).toBe('Active');
    expect(removeFilter(updated, 'a')).toEqual([]);
  });
});
