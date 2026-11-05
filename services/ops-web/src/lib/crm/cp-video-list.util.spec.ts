import { describe, expect, it } from 'vitest';
import {
  filterProjectOptions,
  formatProjectSearchOption,
  projectSearchOptions,
  VIDEO_SOP_HUB,
  videoSopHref,
} from './cp-video-list.util';

describe('VID-01 draft project search', () => {
  it('labels a project by name and client, never a raw UUID', () => {
    expect(formatProjectSearchOption({
      id: 'aaaa',
      name: 'PTT',
      client_name: 'PTT-HCM',
    })).toBe('PTT — PTT-HCM');
    expect(formatProjectSearchOption({ id: 'aaaa', name: 'PTT', client_name: null })).toBe('PTT');
  });

  it('maps live projects to combobox options and filters by name or client', () => {
    const items = [
      { id: 'p1', name: 'PTT', client_name: 'PTT-HCM' },
      { id: 'p2', name: 'Glow Reels', client_name: 'Glow Spa' },
    ];
    expect(projectSearchOptions(items)).toEqual([
      { value: 'p1', label: 'PTT — PTT-HCM' },
      { value: 'p2', label: 'Glow Reels — Glow Spa' },
    ]);
    expect(filterProjectOptions(projectSearchOptions(items), 'glow')).toEqual([
      { value: 'p2', label: 'Glow Reels — Glow Spa' },
    ]);
    expect(filterProjectOptions(projectSearchOptions(items), '')).toHaveLength(2);
  });

  it('links Video AI to the existing Video SOP hub, with lifecycle when mapped', () => {
    expect(videoSopHref(null)).toBe(VIDEO_SOP_HUB);
    expect(videoSopHref('')).toBe(VIDEO_SOP_HUB);
    expect(videoSopHref(0)).toBe(VIDEO_SOP_HUB);
    expect(videoSopHref('3')).toBe('/crm/video?lifecycle_id=3');
    expect(videoSopHref(12)).toBe('/crm/video?lifecycle_id=12');
  });
});
