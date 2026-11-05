import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  QT_ACTIVITY_FILTERS,
  QtActivityChipNotice,
  activityApiActions,
  activityChipNotice,
  mergeActivityPages,
} from './QtActivity';

describe('activityApiActions', () => {
  it('sends exact Task 6 action= values and never uses status/approval prefixes', () => {
    expect(activityApiActions('')).toEqual([]);
    expect(activityApiActions('submit_approval')).toEqual(['submit_approval']);
    expect(activityApiActions('approval')).toEqual(['submit_approval']);
    expect(activityApiActions('accept')).toEqual(['accept']);
    expect(activityApiActions('convert')).toEqual(['convert']);
    expect(activityApiActions('publication.viewed')).toEqual(['publication.viewed']);
    expect(activityApiActions('quote.created')).toEqual(['quote.created']);
    expect(activityApiActions('status')).toEqual([]);
  });

  it('maps chips to exact actions, with Status incomplete', () => {
    const byId = Object.fromEntries(QT_ACTIVITY_FILTERS.map((filter) => [filter.id, filter]));
    expect(byId.approval.action).toBe('submit_approval');
    expect(byId.share.action).toBe('publication.viewed');
    expect(byId.accept.action).toBe('accept');
    expect(byId.convert.action).toBe('convert');
    expect(activityApiActions(byId.status.action)).toEqual([]);
    expect(activityChipNotice(byId.status.action)).toMatch(/không map 1:1|chưa map 1:1/i);
    expect(activityChipNotice('submit_approval')).toBeNull();
  });
});

describe('mergeActivityPages', () => {
  it('merges exact-action pages by id without client-side prefix filtering', () => {
    const merged = mergeActivityPages([
      [{ id: 'a', action: 'submit_approval' }],
      [{ id: 'a', action: 'submit_approval' }, { id: 'b', action: 'submit_approval' }],
    ]);
    expect(merged.map((row) => row.id)).toEqual(['a', 'b']);
  });
});

describe('QtActivityChipNotice', () => {
  it('says Status cannot map 1:1 instead of pretending the chip is complete', () => {
    const html = renderToStaticMarkup(createElement(QtActivityChipNotice, { action: 'status' }));
    expect(html).toMatch(/Status/);
    expect(html).toMatch(/không map 1:1|chưa map 1:1/i);
    expect(renderToStaticMarkup(createElement(QtActivityChipNotice, { action: 'accept' }))).toBe('');
  });
});
