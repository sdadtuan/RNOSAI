import { describe, expect, it } from 'vitest';
import { CP_PROJECT_TABS } from './cp-project-tabs.util';

describe('CP_PROJECT_TABS', () => {
  it('contains exactly the eight project workspace tabs', () => {
    expect(CP_PROJECT_TABS).toHaveLength(8);
    expect(CP_PROJECT_TABS.map((tab) => tab.label)).toEqual([
      'Tổng quan',
      'Brief',
      'Deliverables',
      'Công việc',
      'Media',
      'Phê duyệt',
      'Ngân sách',
      'Hoạt động',
    ]);
  });
});
