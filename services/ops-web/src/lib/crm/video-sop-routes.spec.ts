import { describe, expect, it } from 'vitest';
import {
  parseLifecycleIdQuery,
  withVdLifecycleQuery,
  vdSopPath,
  contentBoardHref,
} from './video-sop-routes';

describe('video-sop-routes', () => {
  it('parseLifecycleIdQuery accepts positive ints only', () => {
    expect(parseLifecycleIdQuery('4')).toBe(4);
    expect(parseLifecycleIdQuery('0')).toBeUndefined();
    expect(parseLifecycleIdQuery('x')).toBeUndefined();
    expect(parseLifecycleIdQuery(null)).toBeUndefined();
  });

  it('withVdLifecycleQuery appends lifecycle_id and preserves hash', () => {
    expect(withVdLifecycleQuery('/crm/video', 4)).toBe('/crm/video?lifecycle_id=4');
    expect(withVdLifecycleQuery('/crm/video?foo=1', 4)).toBe('/crm/video?foo=1&lifecycle_id=4');
    expect(withVdLifecycleQuery('/crm/video#projects', 4)).toBe(
      '/crm/video?lifecycle_id=4#projects',
    );
    expect(withVdLifecycleQuery('/crm/video', undefined)).toBe('/crm/video');
  });

  it('vdSopPath builds command and dashboard', () => {
    expect(vdSopPath('command', { lifecycleId: 4 })).toBe('/crm/video?lifecycle_id=4');
    expect(vdSopPath('dashboard', { lifecycleId: 4 })).toBe(
      '/crm/video/dashboard?lifecycle_id=4',
    );
    expect(vdSopPath('admin')).toBe('/admin/video/providers');
  });

  it('contentBoardHref uses CMKT lifecycle query key', () => {
    expect(contentBoardHref(4)).toBe('/crm/content-os?lifecycle=4');
    expect(contentBoardHref()).toBe('/crm/content-os');
  });
});
