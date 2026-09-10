import { describe, expect, it } from 'vitest';
import {
  CP_CALENDAR_TABS,
  CP_DEFAULT_TZ,
  CP_PUBLISH_KIND,
  buildMonthCells,
  calendarItemKind,
  datetimeLocalInTz,
  distributionPostLabel,
  isComposerSchedulable,
  isCpPublishNative,
  isPublishLocked,
} from './cp-calendar.util';

describe('CP calendar helpers', () => {
  it('keeps calendar tabs to month/week/list plus composer, gate, distribution, and bulk', () => {
    expect(CP_CALENDAR_TABS.map((tab) => tab.id)).toEqual([
      'calendar',
      'composer',
      'gate',
      'distribution',
      'bulk',
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

  it('interprets datetime-local wall time in the selected tz, not the browser zone', () => {
    expect(datetimeLocalInTz('2026-09-15T09:00', 'Asia/Ho_Chi_Minh')).toBe('2026-09-15T02:00:00.000Z');
    expect(datetimeLocalInTz('2026-09-15T09:00', 'America/New_York')).toBe('2026-09-15T13:00:00.000Z');
    expect(datetimeLocalInTz('2026-09-15T09:00')).toBe('2026-09-15T02:00:00.000Z');
  });

  it('gates composer schedule with assertSchedulable rules and disables when unknown', () => {
    expect(isComposerSchedulable({ schedulable: true })).toBe(true);
    expect(isComposerSchedulable({ schedulable: false })).toBe(false);
    expect(isComposerSchedulable({
      approval_status: 'final_approved',
      qc_status: 'passed',
      rights_status: 'ok',
      disclaimer_present: true,
    })).toBe(true);
    expect(isComposerSchedulable({
      approval_status: 'client_review',
      qc_status: 'passed',
      rights_status: 'ok',
      disclaimer_present: true,
    })).toBe(false);
    expect(isComposerSchedulable({
      approval_status: 'final_approved',
      qc_status: 'blocked',
      rights_status: 'ok',
      disclaimer_present: true,
    })).toBe(false);
    expect(isComposerSchedulable({
      approval_status: 'final_approved',
      qc_status: 'passed',
      rights_status: 'block',
      disclaimer_present: true,
    })).toBe(false);
    expect(isComposerSchedulable({
      approval_status: 'final_approved',
      qc_status: 'passed',
      rights_status: 'ok',
      disclaimer_present: false,
    })).toBe(false);
    expect(isComposerSchedulable({
      approval_status: 'final_approved',
      qc_status: 'passed',
    })).toBe(false);
  });

  it('treats unset publish_native as file-export only and never labels TikTok success', () => {
    expect(isCpPublishNative({ publish_native: false })).toBe(false);
    expect(isCpPublishNative({ publish_native: null })).toBe(false);
    expect(isCpPublishNative(null)).toBe(false);
    expect(distributionPostLabel({
      post_ref: 'export:77777777-7777-4777-8777-777777777777',
      status: 'published',
    }, false)).toBe('Xuất file · export:77777777-7777-4777-8777-777777777777');
    expect(distributionPostLabel({
      post_ref: 'https://www.tiktok.com/@x/video/1',
      status: 'published',
    }, false)).not.toMatch(/tiktok|thành công native/i);
    expect(distributionPostLabel({
      post_ref: 'native:tiktok:77777777-7777-4777-8777-777777777777',
      status: 'published',
    }, true)).toBe('Native tiktok · native:tiktok:77777777-7777-4777-8777-777777777777');
    expect(distributionPostLabel({
      post_ref: 'native:tiktok:77777777-7777-4777-8777-777777777777',
      status: 'published',
    }, false)).toBe('—');
  });
});
