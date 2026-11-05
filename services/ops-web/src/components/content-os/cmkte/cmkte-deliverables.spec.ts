import { describe, expect, it } from 'vitest';
import { deliverableFormatChannel, filterMasterDeliverables } from './cmkte-deliverables';

describe('filterMasterDeliverables', () => {
  const rows = [
    { id: 10, master_id: null, display_code: 'CNT-20260910-001', title: 'Master', format: 'blog', channel: 'website' },
    { id: 11, master_id: 10, display_code: 'CNT-20260910-002', title: 'FB post', format: 'social_post', channel: 'facebook' },
    { id: 12, master_id: 99, display_code: 'CNT-20260910-003', title: 'Other', format: 'email', channel: 'newsletter' },
  ];

  it('includes the current item and children whose master_id is current', () => {
    expect(filterMasterDeliverables(rows, 10).map((row) => row.id)).toEqual([10, 11]);
  });

  it('includes self when the current item is a child', () => {
    expect(filterMasterDeliverables(rows, 11).map((row) => row.id)).toEqual([11]);
  });

  it('returns empty when the lifecycle has no matching items', () => {
    expect(filterMasterDeliverables([], 10)).toEqual([]);
    expect(filterMasterDeliverables(rows, 77)).toEqual([]);
  });
});

describe('deliverableFormatChannel', () => {
  it('joins format and channel and leaves blanks empty for dash rendering', () => {
    expect(deliverableFormatChannel({ format: 'social_post', channel: 'facebook' })).toBe(
      'social_post / facebook',
    );
    expect(deliverableFormatChannel({ format: '', channel: '' })).toBe('');
  });
});
