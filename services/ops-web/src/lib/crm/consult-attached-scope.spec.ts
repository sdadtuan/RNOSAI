import { describe, expect, it } from 'vitest';
import { attachedScopeLines, scopeFromLeadSessions } from '@/lib/crm/consult-attached-scope';

describe('scopeFromLeadSessions', () => {
  it('uses the newest session of the current service', () => {
    const scope = scopeFromLeadSessions(
      [
        { id: 20, service_slug: 'dich-vu-seo-tong-the', answers_json: { p13_scope: { service_code: 'SEO', item_codes: ['SEO-01'] } } },
        { id: 23, service_slug: 'tiep-thi-noi-dung', answers_json: { p13_scope: { service_code: 'CS', item_codes: ['CS-01', 'CS-02'] } } },
      ],
      'tiep-thi-noi-dung',
    );
    expect(scope).toEqual({ service_code: 'CS', item_codes: ['CS-01', 'CS-02'] });
  });
});

describe('attachedScopeLines', () => {
  it('joins the catalog task onto each saved code', () => {
    expect(
      attachedScopeLines(
        { service_code: 'CS', item_codes: ['CS-01'] },
        [{ code: 'CS-01', task: 'Audit kênh', subtask: 'Facebook' }],
      ),
    ).toEqual([{ code: 'CS-01', label: 'Audit kênh — Facebook' }]);
  });
});
