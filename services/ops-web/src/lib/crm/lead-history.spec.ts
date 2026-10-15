import { describe, expect, it } from 'vitest';
import { presentLeadHistory } from './lead-history';

describe('presentLeadHistory', () => {
  it('shows the carer, the update, and the time in Vietnamese', () => {
    const line = presentLeadHistory({
      id: 1,
      user_name: 'Nguyễn Đình Tâm',
      content: 'Không liên lạc được (máy bận hoặc không kết nối)\nKênh: Điện thoại\nkhách gọi thuê bao\nTrạng thái lead lúc ghi: Mới',
      activity_type: 'call',
      activity_type_label: 'Gọi điện',
      created_at: '2026-10-14T09:42:00.000Z',
      created_by: 'tam@example.com',
    });
    expect(line.who).toBe('Nguyễn Đình Tâm');
    expect(line.what).toBe('Máy bận. khách gọi thuê bao');
    expect(line.what).not.toMatch(/Kênh|Trạng thái|Điện thoại/);
    expect(line.when).toContain('14/10/2026');
    expect(line.when).toContain('16:42');
  });

  it('rewrites system reminders without English', () => {
    const line = presentLeadHistory({
      id: 2,
      user_name: '',
      created_by: 'revops-sla-worker',
      content: 'RevOps SLA reminder — lead first response sắp breach',
      activity_type: 'note',
      activity_type_label: 'Ghi chú',
      created_at: '2026-10-14T08:00:00.000Z',
    });
    expect(line.who).toBe('Hệ thống');
    expect(line.what).toBe('Nhắc sắp hết giờ gọi khách lần đầu.');
    expect(line.what).not.toMatch(/RevOps|SLA|breach|first response/i);
  });

  it('calls a leader reminder by the Vietnamese role', () => {
    const line = presentLeadHistory({
      id: 3,
      created_by: 'system',
      content: 'Lead đứng yên thêm 1 ngày. Nhắc leader.',
      created_at: '2026-10-13T03:00:00.000Z',
    });
    expect(line.what).toBe('Nhắc trưởng nhóm: lead chưa được chăm thêm 1 ngày.');
  });
});
