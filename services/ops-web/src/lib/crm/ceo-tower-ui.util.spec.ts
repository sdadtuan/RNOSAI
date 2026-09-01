import { describe, expect, it } from 'vitest';
import {
  TOWER_COLUMN_DEFS,
  TOWER_EMPTY_STATE_COPY,
  TOWER_FACTORY_B_UNUSED_LABEL,
  towerColumnUnusedLabel,
} from './ceo-tower-ui.util';

describe('ceo-tower-ui.util', () => {
  it('empty-state copy reminds CEO to check degraded', () => {
    expect(TOWER_EMPTY_STATE_COPY).toBe('Không sót trong cửa sổ — kiểm tra degraded');
  });

  it('factory B unused columns use “Không dùng Factory B”', () => {
    expect(TOWER_FACTORY_B_UNUSED_LABEL).toBe('Không dùng Factory B');
    expect(towerColumnUnusedLabel('intake', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
    expect(towerColumnUnusedLabel('consult', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
    expect(towerColumnUnusedLabel('contract', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
    expect(towerColumnUnusedLabel('tmmt_deliver', 'B')).toBe(TOWER_FACTORY_B_UNUSED_LABEL);
  });

  it('factory B still uses Lead/B2 and CSKH; A and both do not hide columns', () => {
    expect(towerColumnUnusedLabel('lead_b2', 'B')).toBeNull();
    expect(towerColumnUnusedLabel('care', 'B')).toBeNull();
    expect(towerColumnUnusedLabel('intake', 'A')).toBeNull();
    expect(towerColumnUnusedLabel('contract', 'both')).toBeNull();
  });

  it('exposes all 6 column labels', () => {
    expect(TOWER_COLUMN_DEFS.map((c) => c.id)).toEqual([
      'lead_b2',
      'intake',
      'consult',
      'contract',
      'tmmt_deliver',
      'care',
    ]);
    expect(TOWER_COLUMN_DEFS.map((c) => c.label)).toEqual([
      'Lead/B2',
      'Intake',
      'Tư vấn',
      'HĐ',
      'TMMT/QA',
      'CSKH',
    ]);
  });
});
