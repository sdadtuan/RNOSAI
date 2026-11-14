import { describe, expect, it } from 'vitest';
import { firstAcceptorName, mergeLeadCareHistory, presentLeadHistory, presentOwnerChange, resolveActorDisplayName } from './lead-history';

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

  it('places a status change on the same timeline as care notes', () => {
    const lines = mergeLeadCareHistory(
      [
        {
          id: 4,
          user_name: 'Nguyễn Đình Tâm',
          content: 'khách lại bận, hen goi lai sau',
          created_at: '2026-10-15T04:22:00.000Z',
        },
      ],
      [
        {
          id: '9',
          old_status: 'moi',
          new_status: 'da_lien_he',
          changed_by: 'staff:1',
          note: '',
          created_at: '2026-10-14T03:16:00.000Z',
        },
      ],
    );
    expect(lines.map((line) => line.what)).toEqual([
      'khách lại bận, hen goi lai sau',
      'Trạng thái: Mới → Đã liên hệ',
    ]);
    expect(lines[1]?.who).toBe('Hệ thống');
    expect(lines[1]?.key).toBe('status-9');
  });
});

describe('presentOwnerChange', () => {
  it('formats a manual reassign as one short line with no seconds', () => {
    const line = presentOwnerChange({
      id: 11,
      from_name: 'Nguyen Van A',
      to_name: 'Tran Thi B',
      reason: 'manual_reassign',
      created_by: 'admin@local',
      created_by_name: 'Admin Local',
      created_at: '2026-11-16T03:32:20.000Z',
    });
    expect(line.what).toBe('Chuyển từ Sales Nguyen Van A → Sales Tran Thi B · thủ công bởi Admin Local · 10:32 16/11/2026');
    expect(line.what).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(line.when).toBe('');
  });

  it('labels a dry-run would-be auto reassign as late update', () => {
    const line = presentOwnerChange({
      id: 12,
      from_name: 'Nguyen Van A',
      to_name: '',
      would_to_name: 'Le Van C',
      reason: 'would_reassign:sla_hold_expired_1b',
      created_by: 'system',
      created_at: '2026-11-16T03:30:00.000Z',
      dry_run: true,
    });
    expect(line.what).toBe('Chuyển từ Sales Nguyen Van A → Sales Le Van C · trễ cập nhật (chạy thử, chưa chuyển) · 10:30 16/11/2026');
  });

  it('shows Nhận ban đầu only when the current owner is not the first acceptor', () => {
    const logs = [
      { id: 1, from_name: 'Nguyen Van A', to_name: 'Tran Thi B', reason: 'manual_reassign', created_at: '2026-11-15T02:00:00.000Z' },
    ];
    expect(firstAcceptorName(logs, 'Tran Thi B')).toBe('Nguyen Van A');
    expect(firstAcceptorName(logs, 'Nguyen Van A')).toBeNull();
  });

  it('hides Nhận ban đầu when first acceptor is the same staff as the current owner, even if labels differ', () => {
    const logs = [
      {
        id: 1,
        from_user_id: null,
        from_name: '—',
        to_user_id: 107,
        to_name: '#107',
        reason: 'auto_assign',
        created_at: '2026-11-14T02:00:00.000Z',
      },
    ];
    expect(firstAcceptorName(logs, 'Sale Local', 107)).toBeNull();
  });

  it('returns a staff name, never a #id, when the current owner is someone else', () => {
    const logs = [
      {
        id: 1,
        from_user_id: 107,
        from_name: 'Sale Local',
        to_user_id: 2,
        to_name: '#2',
        reason: 'thủ công',
        created_at: '2026-11-14T03:00:00.000Z',
      },
    ];
    expect(firstAcceptorName(logs, 'Nguyễn Minh Khoa', 2)).toBe('Sale Local');
    expect(firstAcceptorName(logs, 'Nguyễn Minh Khoa', 2)).not.toMatch(/^#\d+$/);
  });

  it('does not treat a marketing/AM reassign as the first sales acceptor', () => {
    const logs = [
      {
        id: 1,
        from_user_id: 108,
        from_name: 'MKT Leader',
        to_user_id: 1,
        to_name: 'Admin Local',
        owner_kind: 'solution',
        created_at: '2026-11-14T02:00:00.000Z',
      },
    ];
    expect(firstAcceptorName(logs, 'Sale Local', 107)).toBeNull();
  });

  it('labels a quote AM reassign with the AM role, not Sales', () => {
    const line = presentOwnerChange({
      id: 21,
      from_name: 'Sale Local',
      to_name: 'Nguyễn Minh Khoa',
      reason: 'thủ công',
      created_by: 'admin@local',
      created_at: '2026-11-16T03:32:20.000Z',
      owner_kind: 'quote_am',
    });
    expect(line.what).toBe('Chuyển từ AM Sale Local → AM Nguyễn Minh Khoa · thủ công bởi admin@local · 10:32 16/11/2026');
  });

  it('uses a staff display name for the actor when one is provided, not the email', () => {
    const line = presentOwnerChange({
      id: 22,
      from_name: 'Sale Local',
      to_name: 'Marketing Leader Local',
      reason: 'thủ công',
      created_by: 'admin@local',
      created_by_name: 'Admin Local',
      created_at: '2026-11-16T03:32:20.000Z',
      owner_kind: 'am',
    });
    expect(line.what).toBe('Chuyển từ AM Sale Local → AM Marketing Leader Local · thủ công bởi Admin Local · 10:32 16/11/2026');
    expect(line.what).not.toContain('admin@local');
  });

  it('says Giao ban đầu and tự động when the first owner is auto-assigned', () => {
    const line = presentOwnerChange({
      id: 23,
      from_name: '—',
      from_user_id: null,
      to_name: 'Sale Local',
      to_user_id: 107,
      reason: 'auto_assign',
      created_by: 'auto_assign',
      created_at: '2026-11-16T03:20:00.000Z',
    });
    expect(line.what).toBe('Giao ban đầu cho Sales Sale Local · tự động · 10:20 16/11/2026');
    expect(line.what).not.toMatch(/thủ công|auto_assign|Chuyển từ/);
    expect(line.who).toBe('Hệ thống');
  });

  it('labels a dry-run auto row as chạy thử, chưa chuyển', () => {
    const line = presentOwnerChange({
      id: 24,
      from_name: 'Sale Local',
      would_to_name: 'Admin Local',
      reason: 'auto_assign',
      created_by: 'system',
      created_at: '2026-11-16T03:30:00.000Z',
      dry_run: true,
    });
    expect(line.what).toBe('Chuyển từ Sales Sale Local → Sales Admin Local · tự động (chạy thử, chưa chuyển) · 10:30 16/11/2026');
  });

  it('falls back to the actor email only when no display name exists', () => {
    const line = presentOwnerChange({
      id: 25,
      from_name: 'Sale Local',
      to_name: 'Admin Local',
      reason: 'manual_reassign',
      created_by: 'admin@local',
      created_at: '2026-11-16T03:32:20.000Z',
    });
    expect(line.what).toContain('thủ công bởi admin@local');
  });
});

describe('resolveActorDisplayName', () => {
  const staff = [{ id: 1, name: 'Admin Local', email: 'admin@local' }];
  it('maps an actor email to the staff display name', () => {
    expect(resolveActorDisplayName('admin@local', staff)).toBe('Admin Local');
  });
  it('returns empty for auto_assign or system', () => {
    expect(resolveActorDisplayName('auto_assign', staff)).toBe('');
    expect(resolveActorDisplayName('system', staff)).toBe('');
  });
});

describe('presentLeadHistory solution flow', () => {
  it('formats AM solution events as who · action · HH:mm dd/MM/yyyy', () => {
    const line = presentLeadHistory({
      id: 91,
      user_name: 'Admin',
      created_by: 'admin@local',
      activity_type: 'solution_released',
      content: 'Admin · Nộp Solution cho Sales',
      created_at: '2026-11-14T10:32:00.000Z',
    });
    expect(line.who).toBe('Admin');
    expect(line.what).toMatch(/^Admin · Nộp Solution cho Sales · \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}$/);
  });
});
