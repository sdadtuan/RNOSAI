import { describe, expect, it } from 'vitest';
import type { IwrReportRow } from '@/lib/crm/iwr-api';
import {
  iwrInboxClock,
  iwrInboxMatchesKind,
  iwrInboxMatchesLabel,
  iwrInboxPreview,
  iwrInboxProject,
  iwrInboxSortRows,
  iwrInboxStatusBadge,
} from './iwr-inbox';

function row(partial: Partial<IwrReportRow>): IwrReportRow {
  return {
    id: 'r1',
    template_id: 't',
    template_code: 'daily_work',
    template_name_vi: 'Báo cáo ngày',
    title: 'Báo cáo ngày — 03/09/2026',
    author_staff_id: 1,
    author_name: 'Nguyễn Văn A',
    reviewer_staff_id: 2,
    period_start: '2026-09-03',
    period_end: '2026-09-03',
    due_at: '2026-09-03T17:00:00+07:00',
    status: 'submitted',
    version: '1',
    rag: 'yellow',
    is_late: false,
    late_reason: null,
    first_viewed_at: null,
    submitted_at: '2026-09-03T10:42:00+07:00',
    acknowledged_at: null,
    sections_json: {},
    ...partial,
  };
}

describe('iwr-inbox helpers', () => {
  it('takes first done line as preview and project from item meta', () => {
    const r = row({
      sections_json: {
        done: { body: '- Xong offer tuần 3\n- Gửi khách' },
        wip: { items: [{ title: 'Landing', body: '{"project":"Spa ABC","text":"70%"}' }] },
      },
    });
    expect(iwrInboxPreview(r)).toBe('Xong offer tuần 3');
    expect(iwrInboxProject(r)).toBe('Spa ABC');
  });

  it('filters kind / label and sorts red first', () => {
    const daily = row({ id: 'd', rag: 'green' });
    const weekly = row({
      id: 'w',
      template_code: 'weekly_work',
      rag: 'red',
      sections_json: { blocked: { body: 'Chờ khách chốt offer' } },
    });
    expect(iwrInboxMatchesKind(weekly, 'weekly')).toBe(true);
    expect(iwrInboxMatchesKind(daily, 'weekly')).toBe(false);
    expect(iwrInboxMatchesLabel(weekly, 'wait_customer')).toBe(true);
    expect(iwrInboxMatchesLabel(weekly, 'priority')).toBe(true);
    expect(iwrInboxSortRows([daily, weekly], 'rag').map((x) => x.id)).toEqual(['w', 'd']);
  });

  it('formats today clock and status badges', () => {
    expect(iwrInboxClock('2026-09-03T10:42:00+07:00', new Date('2026-09-03T12:00:00+07:00'))).toBe('10:42');
    expect(iwrInboxClock('2026-09-02T10:42:00+07:00', new Date('2026-09-03T12:00:00+07:00'))).toBe('Hôm qua');
    expect(iwrInboxStatusBadge('changes_requested', 'green')).toEqual({ text: 'Cần bổ sung', tone: 'blue' });
    expect(iwrInboxStatusBadge('submitted', 'red')).toEqual({ text: 'Rủi ro cao', tone: 'red' });
  });
});
