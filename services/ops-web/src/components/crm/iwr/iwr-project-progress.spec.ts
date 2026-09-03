import { describe, expect, it } from 'vitest';
import {
  buildIwrProjectProgress,
  iwrProjectProgressMaxY,
  parseIwrProjectLabel,
} from './iwr-project-progress';
import type { IwrReportRow } from '@/lib/crm/iwr-api';

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
  it('parseIwrProjectLabel splits name and client', () => {
    expect(parseIwrProjectLabel('Website Redesign (ACB Bank)')).toEqual({
      name: 'Website Redesign',
      client: 'ACB Bank',
    });
  });

  it('buildIwrProjectProgress aggregates items by project', () => {
    const out = buildIwrProjectProgress([
      report({
        sections_json: {
          done: {
            items: [{ title: 'Landing', body: JSON.stringify({ project: 'SEO Growth (Tiki)', progress: 100 }) }],
          },
          wip: {
            items: [{ title: 'Blog', body: JSON.stringify({ project: 'SEO Growth (Tiki)', progress: 55 }) }],
          },
          blocked: {
            items: [{ title: 'API', body: JSON.stringify({ project: 'SEO Growth (Tiki)', progress: 10 }) }],
          },
        },
      }),
    ]);
    expect(out.fromDemo).toBe(false);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ name: 'SEO Growth', client: 'Tiki', green: 1, yellow: 1, red: 1 });
  });

  it('buildIwrProjectProgress falls back to demo rows', () => {
    const out = buildIwrProjectProgress([]);
    expect(out.fromDemo).toBe(true);
    expect(out.rows.length).toBeGreaterThan(0);
  });

  it('iwrProjectProgressMaxY rounds up to step 5', () => {
    expect(iwrProjectProgressMaxY([{ id: 'a', name: 'A', client: '', green: 14, yellow: 3, red: 1 }])).toBe(20);
  });
});
