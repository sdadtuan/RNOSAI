import { describe, expect, it } from 'vitest';
import {
  amTimelineAttachError,
  amTimelineComposerError,
  amTimelineErrorCopy,
  amTimelineRowEditable,
} from './am-timeline.util';

describe('am-timeline', () => {
  it('meeting without attendees returns error helper', () => {
    expect(
      amTimelineComposerError({ kind: 'meeting', attendees: [], summary: 'QBR' }),
    ).toMatch(/attendees|người tham gia/i);
    expect(
      amTimelineComposerError({ kind: 'meeting', attendees: ['  '], summary: 'QBR' }),
    ).toMatch(/attendees|người tham gia/i);
    expect(
      amTimelineComposerError({ kind: 'meeting', attendees: ['Minh'], summary: 'QBR' }),
    ).toBe('');
  });

  it('system rows are not editable', () => {
    expect(amTimelineRowEditable({ kind: 'system' })).toBe(false);
    expect(amTimelineRowEditable({ kind: 'meeting' })).toBe(true);
    expect(amTimelineRowEditable({ kind: 'note' })).toBe(true);
  });

  it('maps action_item_not_found', () => {
    expect(amTimelineErrorCopy('action_item_not_found')).toBe('Không thấy action item');
  });

  it('rejects javascript href on composer attach', () => {
    expect(amTimelineAttachError({ href: 'javascript:alert(1)', title: 'x' })).toMatch(/http/i);
  });

  it('allows empty attach (optional)', () => {
    expect(amTimelineAttachError({ href: '', title: '' })).toBe('');
  });

  it('requires title when href is present', () => {
    expect(amTimelineAttachError({ href: 'https://example.com', title: '' })).toBe(
      'Cần tiêu đề tài liệu',
    );
  });
});
