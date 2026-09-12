import { describe, expect, it } from 'vitest';
import { CP_PROJECT_TABS } from './cp-project-tabs.util';

describe('CP_PROJECT_TABS', () => {
  it('contains exactly the nine project workspace tabs including AI Ops', () => {
    expect(CP_PROJECT_TABS).toHaveLength(9);
    expect(CP_PROJECT_TABS.map((t) => t.id)).toContain('ai-ops');
    expect(CP_PROJECT_TABS[8]).toEqual({ id: 'ai-ops', label: 'AI Ops' });
    expect(CP_PROJECT_TABS.map((tab) => tab.label)).toEqual([
      'Tổng quan',
      'Brief',
      'Deliverables',
      'Công việc',
      'Media',
      'Phê duyệt',
      'Ngân sách',
      'Hoạt động',
      'AI Ops',
    ]);
  });
});
