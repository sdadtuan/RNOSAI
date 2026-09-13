import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VIDEO_STUDIO_TABS,
  draftAssets,
  formatCharCount,
  formatEstimate,
  formatJobStatus,
  formatKitOption,
  formatModelLabel,
  formatPlayhead,
  liveRenderBlocks,
  modelOptions,
  defaultPreviewId,
  formatPreviewMeta,
  mergeStudioPreviews,
  studioAssetsFrom,
  studioRenderRows,
  studioSceneCards,
  studioViewerCommand,
  previewSceneSlots,
  studioGateItems,
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
    expect(formatModelLabel('stub')).toBe('Stub · demo (AI thật chưa bật)');
    expect(formatModelLabel('stub-pro')).toBe('Stub Pro · pricing 2026-09');
    expect(modelOptions([])).toEqual([{ id: 'stub', label: 'Stub · demo (AI thật chưa bật)' }]);
    expect(modelOptions([{ id: 'stub-pro', max_res: '1080' }])).toEqual([
      { id: 'stub-pro', label: 'Stub Pro · pricing 2026-09' },
    ]);
    expect(modelOptions([{ id: 12 }])).toEqual([{ id: '12', label: '12' }]);
  });

  it('fills a four-scene preview strip from live scenes or mockup placeholders', () => {
    expect(previewSceneSlots([], 30).map((slot) => slot.title)).toEqual([
      'Cảnh 01 · Hook',
      'Cảnh 02 · Benefit',
      'Cảnh 03 · Utility',
      'Cảnh 04 · CTA',
    ]);
    expect(previewSceneSlots([], 30)[0]).toMatchObject({
      hint: '00:00–00:05',
      placeholder: true,
    });
    expect(
      previewSceneSlots([{ idx: 0, title: 'Hook', locked: true }], 30)[0],
    ).toMatchObject({ title: '1 Hook', hint: 'lock', placeholder: false });
  });

  it('turns render blocks into operator gate pills', () => {
    expect(studioGateItems({ aiEnabled: false, assets: [] }).map((item) => item.id)).toEqual([
      'ai',
      'asset',
      'rights',
    ]);
    expect(studioGateItems({ aiEnabled: false, assets: [] })[0]).toMatchObject({
      ok: false,
      label: 'AI production',
    });
    expect(
      studioGateItems({
        aiEnabled: true,
        assets: [{ state: 'ready', rights_status: 'ok' }],
      }).every((item) => item.ok),
    ).toBe(true);
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

  it('sorts preview playlist newest first and defaults to the latest playable clip', () => {
    const items = mergeStudioPreviews({
      versions: [
        {
          id: 'v1',
          version_n: 1,
          created_at: '2026-09-12T10:00:00Z',
          asset_id: 'a1',
          mime: 'video/mp4',
          approval_status: 'internal_review',
        },
        {
          id: 'v2',
          version_n: 2,
          created_at: '2026-09-13T10:00:00Z',
          asset_id: 'a2',
          mime: 'video/mp4',
          approval_status: 'internal_review',
        },
      ],
      assets: [],
    });
    expect(items.map((item) => item.id)).toEqual(['v2', 'v1']);
    expect(defaultPreviewId(items)).toBe('v2');
    expect(items[0]).toMatchObject({ playable: true, label: 'v02' });
  });

  it('maps API preview duration and skips an unplayable newer version', () => {
    const items = mergeStudioPreviews({
      versions: [
        {
          id: 'v3',
          version_n: 3,
          label: 'v03',
          asset_id: null,
          mime: null,
          playable: false,
          duration_ms: null,
        },
        {
          id: 'v2',
          version_n: 2,
          label: 'v02',
          asset_id: 'a2',
          mime: 'video/mp4',
          playable: true,
          duration_ms: 30000,
        },
      ],
      assets: [],
    });
    expect(items.map((item) => item.id)).toEqual(['v3', 'v2']);
    expect(items[1]).toMatchObject({ playable: true, durationSec: 30 });
    expect(defaultPreviewId(items)).toBe('v2');
    expect(formatPreviewMeta(items[0])).toBe('Chưa có file');
    expect(formatPreviewMeta(items[1])).toBe('00:30');
  });

  it('maps professional viewer keys without inventing an editor', () => {
    expect(studioViewerCommand(' ')).toBe('toggle');
    expect(studioViewerCommand('ArrowLeft')).toBe('back');
    expect(studioViewerCommand('ArrowRight')).toBe('fwd');
    expect(studioViewerCommand('m')).toBe('mute');
    expect(studioViewerCommand('f')).toBe('fullscreen');
    expect(studioViewerCommand('Escape')).toBe(null);
  });

  it('keeps VID-01 operator copy free of raw DAM/API jargon', () => {
    const src = readFileSync(
      join(__dirname, '../../components/crm/cp/CpVideoStudio.tsx'),
      'utf8',
    );
    expect(src).toContain('CpStudioBrief');
    expect(src).toContain('CpStudioStage');
    expect(src).toContain('CpStudioQueue');
    expect(src).not.toContain('DAM picker');
    expect(src).not.toContain('asset_version_id');
    expect(src).toContain('listCpVideoPreviews');
    expect(src).not.toContain('formatPlayhead(null');
  });

  it('builds four scene cards and render queue rows from real draft data', () => {
    const cards = studioSceneCards([], 30);
    expect(cards).toHaveLength(4);
    expect(cards[0].title).toContain('Hook');
    expect(studioRenderRows({
      jobs: [{ id: 'j1', job_id: 'job_1', state: 'running', progress: 66 }],
      draftName: 'Video căn hộ The Peak',
      config: studioConfigFrom({ duration_sec: 30, aspect_ratio: '9:16', model_id: 'stub' }),
    })[0]).toMatchObject({
      title: 'Video căn hộ The Peak',
      progress: 66,
      statusKind: 'running',
      cancellable: true,
    });
    expect(studioAssetsFrom({ studio_assets: { reference_ids: ['a1'], logo_id: 'logo' } })).toEqual({
      reference_ids: ['a1'],
      logo_id: 'logo',
    });
  });

  it('uses a professional signed-video viewer with playlist chrome', () => {
    const src = readFileSync(
      join(__dirname, '../../components/crm/cp/CpStudioPreview.tsx'),
      'utf8',
    );
    expect(src).toContain('<video');
    expect(src).toContain('getCpAssetStreamUrl');
    expect(src).toContain('playbackRate');
    expect(src).toContain('requestFullscreen');
    expect(src).toContain('Bản render');
    expect(src).toContain('Chưa có bản render để xem');
  });
});
