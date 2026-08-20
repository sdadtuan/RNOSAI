import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_OS_VIDEO_API_PATHS } from '@/lib/content-os-api';
import * as contentOsApi from '@/lib/content-os-api';
import {
  VIDEO_STUDIO_CINEMATIC_LABEL,
  VIDEO_STUDIO_SOCIAL_LABEL,
  isCinematicVideoStudioEnabled,
  pickCinematicStudio,
} from './ContentOsVideoStudioPicker';

describe('ContentOsVideoStudioPicker labels', () => {
  it('exposes locked Social and SOP card labels', () => {
    expect(VIDEO_STUDIO_SOCIAL_LABEL).toBe('Video tuần (FFmpeg)');
    expect(VIDEO_STUDIO_CINEMATIC_LABEL).toBe('Video chiến dịch (SOP)');
  });

  it('disables SOP studio unless NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC is 1', () => {
    const prev = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    delete process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    expect(isCinematicVideoStudioEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '0';
    expect(isCinematicVideoStudioEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '1';
    expect(isCinematicVideoStudioEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = prev;
  });
});

describe('content-os video API paths', () => {
  it('matches backend Task 7 routes', () => {
    expect(CONTENT_OS_VIDEO_API_PATHS.lockStudio(42)).toBe('/items/42/video/lock-studio');
    expect(CONTENT_OS_VIDEO_API_PATHS.storyboard(42)).toBe('/items/42/jobs/video-storyboard');
    expect(CONTENT_OS_VIDEO_API_PATHS.patchStoryboard(42)).toBe('/items/42/video/storyboard');
    expect(CONTENT_OS_VIDEO_API_PATHS.render(42)).toBe('/items/42/jobs/video-render');
  });
});

describe('pickCinematicStudio', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('when flag is 1, creates vd_project and never locks social studio', async () => {
    const prev = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '1';

    const lockSpy = vi.spyOn(contentOsApi, 'lockVideoStudio');
    const createProject = vi.fn().mockResolvedValue({ id: 88 });
    const onSelect = vi.fn();
    const navigate = vi.fn();

    await pickCinematicStudio({
      token: 'staff-token',
      lifecycleId: 3,
      itemId: 42,
      createProject,
      onSelect,
      navigate,
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(createProject).toHaveBeenCalledWith('staff-token', {
      lifecycle_id: 3,
      cmkt_item_id: 42,
    });
    expect(lockSpy).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('cinematic');
    expect(navigate).toHaveBeenCalledWith('/crm/video/88');

    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = prev;
  });
});
