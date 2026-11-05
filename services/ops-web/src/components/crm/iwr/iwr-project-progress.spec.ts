import { describe, expect, it } from 'vitest';
import { buildIwrProjectProgress, iwrProjectProgressMaxY } from './iwr-project-progress';
import type { IwrReportRow } from '@/lib/crm/iwr-api';

const B2B = [
  { id: 'p-seo', code: 'tiki-seo', name: 'SEO Growth', status: 'active' },
  { id: 'p-web', code: 'acb-web', name: 'Website Redesign', status: 'active' },
];

function report(partial: Partial<IwrReportRow>): IwrReportRow {
  return {
    id: 'r1',
    template_id: 't1',
    template_code: 'daily_work',
    template_name_vi: 'Báo cáo ngày',
    title: 'BC ngày',
    author_staff_id: 1,
    reviewer_staff_id: null,
    period_start: '2026-09-01',
    period_end: '2026-09-01',
    due_at: '2026-09-01T17:00:00.000Z',
    status: 'submitted',
    version: '1',
    rag: 'green',
    is_late: false,
    late_reason: null,
    first_viewed_at: null,
    submitted_at: '2026-09-03T09:30:00.000Z',
    acknowledged_at: null,
    sections_json: {},
    ...partial,
  };
}

describe('iwr-project-progress', () => {
  it('buildIwrProjectProgress aggregates items by b2b project id', () => {
    const out = buildIwrProjectProgress(
      [
        report({
          sections_json: {
            done: {
              items: [
                {
                  title: 'Landing',
                  body: JSON.stringify({ b2b_project_id: 'p-seo', project: 'SEO Growth (tiki-seo)', progress: 100 }),
                },
              ],
            },
            wip: {
              items: [
                {
                  title: 'Blog',
                  body: JSON.stringify({ b2b_project_id: 'p-seo', project: 'SEO Growth (tiki-seo)', progress: 55 }),
                },
              ],
            },
            blocked: {
              items: [
                {
                  title: 'API',
                  body: JSON.stringify({ b2b_project_id: 'p-seo', project: 'SEO Growth (tiki-seo)', progress: 10 }),
                },
              ],
            },
          },
        }),
      ],
      B2B,
    );
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ id: 'p-seo', name: 'SEO Growth', code: 'tiki-seo', green: 1, yellow: 1, red: 1 });
  });

  it('buildIwrProjectProgress returns empty rows when no b2b-linked items', () => {
    const out = buildIwrProjectProgress([], B2B);
    expect(out.rows).toEqual([]);
  });

  it('iwrProjectProgressMaxY rounds up to step 5', () => {
    expect(
      iwrProjectProgressMaxY([{ id: 'a', name: 'A', code: 'a', green: 14, yellow: 3, red: 1 }]),
    ).toBe(20);
  });
});
