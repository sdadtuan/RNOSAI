import { describe, expect, it } from 'vitest';
import {
  CP_CALENDAR_TABS,
  CP_DEFAULT_TZ,
  CP_PUBLISH_KIND,
  buildMonthCells,
  calendarItemKind,
  isPublishLocked,
} from './cp-calendar.util';

describe('CP calendar helpers', () => {
  it('keeps calendar tabs to month/week/list plus composer and gate', () => {
    expect(CP_CALENDAR_TABS.map((tab) => tab.id)).toEqual([
      'calendar',
      'composer',
      'gate',
    ]);
    expect(CP_DEFAULT_TZ).toBe('Asia/Ho_Chi_Minh');
    expect(CP_PUBLISH_KIND).toBe('video');
  });

  it('builds a Monday-first month grid without inventing copy posts', () => {
    const cells = buildMonthCells(2026, 9, [
      {
        id: 'pub-1',
        scheduled_at: '2026-09-15T02:00:00.000Z',
        channel: 'tiktok',
        draft_name: 'Peak Reels v2',
        kind: 'video',
      },
    ]);
    expect(cells[0].weekday).toBe(1);
    const day15 = cells.find((cell) => cell.day === 15 && cell.inMonth);
    expect(day15?.items).toHaveLength(1);
    expect(day15?.items[0].kind).toBe('video');
    expect(cells.some((cell) => cell.items.some((item) => item.kind === 'copy'))).toBe(false);
  });

  it('treats only video PublishItems as CP calendar items', () => {
    expect(calendarItemKind({ video_version_id: 'v1' })).toBe('video');
    expect(calendarItemKind({ content_item_id: 'c1' })).toBe('copy');
  });

  it('locks schedule unless final_approved and QC is not blocked', () => {
    expect(isPublishLocked({ approval_status: 'client_review', qc_status: 'passed' })).toBe(true);
    expect(isPublishLocked({ approval_status: 'final_approved', qc_status: 'blocked' })).toBe(true);
    expect(isPublishLocked({ approval_status: 'final_approved', qc_status: 'passed' })).toBe(false);
  });
});
