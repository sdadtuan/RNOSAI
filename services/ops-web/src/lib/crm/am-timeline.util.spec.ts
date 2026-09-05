import { describe, expect, it } from 'vitest';
import {
  amTimelineComposerError,
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
});
