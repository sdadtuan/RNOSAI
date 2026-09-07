import { describe, expect, it } from 'vitest';
import {
  VIDEO_STUDIO_TABS,
  draftAssets,
  formatCharCount,
  formatEstimate,
  formatJobStatus,
  formatKitOption,
  formatPlayhead,
  liveRenderBlocks,
  modelOptions,
  promptMaxChars,
  sceneStripLabel,
  studioConfigFrom,
  studioConfigPayload,
  studioJobs,
  studioTabHref,
  urlFieldState,
} from './cp-video-studio.util';

describe('VID-01 studio helpers', () => {
  it('keeps the eight mockup video tabs', () => {
    expect(VIDEO_STUDIO_TABS.map((tab) => tab.label)).toEqual([
      'Studio',
      'Storyboard',
      'Timeline',
      'Ops',
      'Review',
      'Batch',
      'Template',
      'Version',
    ]);
  });

  it('routes studio tabs to live CP screens, not a second portal', () => {
    expect(studioTabHref('studio', { videoId: 'd1', scope: 'me' })).toBe(
      '/crm/creative-os/video/d1?scope=me',
    );
    expect(studioTabHref('storyboard', { videoId: 'd1', scope: 'me' })).toBe(
      '/crm/creative-os/video/d1?scope=me&tab=storyboard',
    );
    expect(studioTabHref('ops', { videoId: 'd1', scope: 'team' })).toBe(
      '/crm/creative-os/video/ops?scope=team',
    );
    expect(studioTabHref('review', { videoId: 'd1', scope: 'me', versionId: 'v9' })).toBe(
      '/crm/creative-os/video/versions/v9?scope=me',
    );
    expect(studioTabHref('review', { videoId: 'd1', scope: 'me' })).toBe(
      '/crm/creative-os/video/d1?scope=me&tab=review',
    );
  });

  it('prints char count / max and defaults the ceiling from policy', () => {
    expect(promptMaxChars({})).toBe(2000);
    expect(promptMaxChars({ prompt_max_chars: 1200 })).toBe(1200);
    expect(formatCharCount(842, 2000)).toBe('842 / 2.000');
    expect(formatCharCount(0, 2000)).toBe('0 / 2.000');
  });

  it('keeps the URL field visible but disabled until legal extract is on', () => {
    expect(urlFieldState({ policy_json: {} })).toEqual({
      disabled: true,
      reason: 'URL extract chưa mở — chờ legal (W2).',
    });
    expect(urlFieldState({ policy_json: { url_extract: true } })).toEqual({
      disabled: false,
      reason: null,
    });
  });

  it('reads studio config without inventing estimate or preview time', () => {
    expect(studioConfigFrom({ ratio: '16:9', duration: 15, voice: 'warm' })).toMatchObject({
      aspect_ratio: '16:9',
      duration_sec: 15,
      voice_id: 'warm',
    });
    expect(formatPlayhead(null, 30)).toBe('— / 00:30');
    expect(formatPlayhead(12, 30)).toBe('00:12 / 00:30');
    expect(formatEstimate(null, true)).toBe('Ước tính — · watermark draft ON');
    expect(formatEstimate(42, false)).toBe('Ước tính 42 cr · watermark draft OFF');
  });

  it('writes both legacy and SRS config keys for autosave', () => {
    expect(
      studioConfigPayload({
        aspect_ratio: '9:16',
        duration_sec: 30,
        style: 'Cinematic',
        language: 'vi-VN',
        voice_id: 'warm',
        model_id: 'stub',
        music: 'bed-a',
        auto_script: true,
        estimated_credits: '12',
        source_url: '',
        resolution: '',
        subtitle: true,
      }),
    ).toMatchObject({
      ratio: '9:16',
      aspect_ratio: '9:16',
      duration: 30,
      duration_sec: 30,
      voice: 'warm',
      model: 'stub',
      auto_script: true,
      estimated_credits: 12,
    });
  });

  it('filters jobs and assets to this draft and never invents a queue row', () => {
    expect(
      studioJobs(
        [
          { id: 'a', draft_id: 'd1', state: 'failed', stage: 'render' },
          { id: 'b', draft_id: 'd2', state: 'queued', stage: 'render' },
        ],
        'd1',
      ),
    ).toEqual([{ id: 'a', draft_id: 'd1', state: 'failed', stage: 'render' }]);
    expect(formatJobStatus({ state: 'processing', stage: 'encode', progress: 78 })).toBe(
      'Encoding 78%',
    );
    expect(formatJobStatus({ state: 'failed', stage: 'render', progress: null })).toBe('Failed');
    expect(
      draftAssets(
        [
          { id: '1', project_id: 'p1', filename: 'logo.svg' },
          { id: '2', project_id: 'p2', filename: 'other.svg' },
        ],
        'p1',
      ),
    ).toEqual([{ id: '1', project_id: 'p1', filename: 'logo.svg' }]);
  });

  it('labels scenes and kits from live rows, and models only from settings', () => {
    expect(sceneStripLabel({ idx: 0, title: 'Hook', locked: true })).toBe('1 Hook · lock');
    expect(sceneStripLabel({ idx: 1, title: 'Lobby', locked: false })).toBe('2 Lobby');
    expect(formatKitOption({ name: 'The Peak', latest_version: 12 })).toBe('The Peak v12');
    expect(formatKitOption({ name: 'The Peak', latest_version: null })).toBe('The Peak');
    expect(modelOptions([])).toEqual([{ id: 'stub', label: 'stub' }]);
    expect(modelOptions([{ id: 'stub-pro', max_res: '1080' }])).toEqual([
      { id: 'stub-pro', label: 'stub-pro' },
    ]);
    expect(modelOptions([{ id: 12 }])).toEqual([{ id: '12', label: '12' }]);
  });

  it('lists live render blocks without inventing credit or moderation hits', () => {
    expect(liveRenderBlocks({ aiEnabled: false, assets: [] })).toEqual(['AI tắt']);
    expect(
      liveRenderBlocks({
        aiEnabled: true,
        assets: [{ state: 'draft', rights_status: 'block' }],
      }),
    ).toEqual(['asset ≠ Ready', 'rights']);
    expect(liveRenderBlocks({ aiEnabled: true, assets: [] })).toEqual([]);
  });
});
