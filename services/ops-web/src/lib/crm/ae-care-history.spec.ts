import { describe, expect, it } from 'vitest';
import { assignmentReasonLabel, collapseCareHistory, hideContactText } from './ae-care-history';

describe('collapseCareHistory', () => {
  it('keeps one row per lead and the latest event', () => {
    const rows = collapseCareHistory([
      {
        lead_id: 13,
        lead_name: 'Quoc Hung Tran',
        status: 'da_lien_he',
        staff_id: 15,
        staff_name: 'Nhã Phương',
        staff_code: 'PTTCN100015',
        event_label: 'Đã gán',
        at: '2026-10-16T06:00:00.000Z',
      },
      {
        lead_id: 13,
        lead_name: 'Quoc Hung Tran',
        status: 'da_lien_he',
        staff_id: 15,
        staff_name: 'Nhã Phương',
        staff_code: 'PTTCN100015',
        event_label: 'Bị thu hồi',
        at: '2026-10-17T06:00:00.000Z',
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.latest_event).toBe('Bị thu hồi');
    expect(rows[0]?.staff).toHaveLength(1);
  });
});

describe('contact hiding', () => {
  it('drops a phone and an email from free text', () => {
    expect(hideContactText('Gọi 0901234567 rồi gửi a@b.co')).toBe('Gọi rồi gửi');
    expect(assignmentReasonLabel('hybrid load=3; ab=ai_analytics')).toBe('Chuyển người phụ trách');
    expect(assignmentReasonLabel('Phân lại lead: CSKH')).toBe('Phân lại lead: CSKH');
  });
});
