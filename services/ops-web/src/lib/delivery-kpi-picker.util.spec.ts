import { describe, expect, it, vi } from 'vitest';
import {
  filterDictionaryRows,
  isDeprecatedDisabled,
  readWizardKpiSelection,
  writeWizardKpiSelection,
} from './delivery-kpi-picker.util';

describe('delivery-kpi-picker.util', () => {
  const rows = [
    { id: '1', code: 'MKT_002', name: 'Valid Leads', status: 'ACTIVE', kpi_group: 'Acquisition', source: 'CRM' },
    { id: '2', code: 'SAL_008', name: 'Revenue', status: 'DEPRECATED', kpi_group: 'Revenue', source: 'ERP' },
    { id: '3', code: 'MKT_006', name: 'CPL', status: 'ACTIVE', kpi_group: 'Media Efficiency', source: 'Meta Ads' },
  ];

  it('filters by q matching code or name', () => {
    expect(filterDictionaryRows(rows, { q: 'valid' }).map((r) => r.code)).toEqual(['MKT_002']);
    expect(filterDictionaryRows(rows, { q: 'cpl' }).map((r) => r.code)).toEqual(['MKT_006']);
  });

  it('keeps deprecated rows in list but marks disabled', () => {
    const filtered = filterDictionaryRows(rows, { q: 'sal' });
    expect(filtered.some((r) => r.code === 'SAL_008')).toBe(true);
    expect(isDeprecatedDisabled('DEPRECATED')).toBe(true);
    expect(isDeprecatedDisabled('ACTIVE')).toBe(false);
  });

  it('filters by group and status', () => {
    expect(filterDictionaryRows(rows, { groups: ['Acquisition'], status: 'ACTIVE' })).toHaveLength(1);
  });

  it('persists wizard selection in sessionStorage', () => {
    const store = new Map<string, string>();
    const sessionStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    vi.stubGlobal('window', { sessionStorage: sessionStorageMock });
    writeWizardKpiSelection('draft-1', ['a', 'b']);
    expect(readWizardKpiSelection('draft-1')).toEqual(['a', 'b']);
    vi.unstubAllGlobals();
  });
});
