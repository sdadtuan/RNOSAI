import { describe, expect, it } from 'vitest';
import { formatStaffNotificationAt, stripNotificationOpenLeadPath } from './staff-notification-format.util';

describe('stripNotificationOpenLeadPath', () => {
  it('removes the raw Mở lead path and keeps the rest of the body', () => {
    const raw =
      'Lead #900000141: Hạn AM nhận / làm Solution đã quá hạn (hạn 15:02 14/11/2026). AM nhận và làm Solution trong 15 phút trong giờ; ngoài giờ hạn 08:30 ngày làm việc kế. Mở lead: /crm/leads/900000141';
    const out = stripNotificationOpenLeadPath(raw);
    expect(out).toContain('đã quá hạn');
    expect(out).not.toMatch(/Mở lead:/);
    expect(out).not.toMatch(/\/crm\/leads\//);
  });
});

describe('formatStaffNotificationAt', () => {
  it('formats as HH:mm dd/MM/yyyy in Asia/Saigon without seconds', () => {
    const label = formatStaffNotificationAt('2026-11-14T07:57:31.000Z');
    expect(label).toBe('14:57 14/11/2026');
    expect(label).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
