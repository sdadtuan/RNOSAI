import { describe, expect, it } from 'vitest';
import { CONTENT_OS_VIDEO_API_PATHS } from '@/lib/content-os-api';
import {
  VIDEO_STUDIO_CINEMATIC_LABEL,
  VIDEO_STUDIO_SOCIAL_LABEL,
  isCinematicVideoStudioEnabled,
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
