'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredUser, getAccessToken } from '@/lib/auth';
import { shouldShowVideoSopNav } from '@/components/ops-nav-video-sop';
import { videoSopHref } from '@/lib/crm/cp-video-list.util';
import { CpStoryboard } from './CpStoryboard';
import { CpStudioBrief } from './CpStudioBrief';
import { CpStudioConfig } from './CpStudioConfig';
import { CpStudioQueue } from './CpStudioQueue';
import { CpStudioStage } from './CpStudioStage';
import { CpTimeline } from './CpTimeline';
import {
  CP_RENDER_POLL_MS,
  cancelCpRender,
  createCpRender,
  formatCpApiError,
  getCpSettings,
  getCpVideo,
  listCpAssets,
  listCpRenders,
  listCpScenes,
  listCpVideoPreviews,
  listKits,
  listVersions,
  parseCpScriptEditor,
  patchCpVideo,
  type CpAsset,
  type CpBrandKit,
  type CpRenderJob,
  type CpScene,
  type CpScope,
  type CpSettings,
  type CpVideoDraft,
  type CpVideoInputMode,
} from '@/lib/crm/cp-api';
import { CP_SUBTITLES } from '@/lib/crm/cp-copy';
import { autoScriptCpVideo } from '@/lib/crm/cp-playbook-api';
import { dash, mergeDraftAfterAutosave } from '@/lib/crm/cp-format';
import {
  VIDEO_STUDIO_TABS,
  draftAssets,
  defaultPreviewId,
  formatEstimate,
  mergeStudioPreviews,
  studioBrandPalette,
  studioConfigFrom,
  studioConfigPayload,
  studioGateItems,
  studioJobs,
  studioRenderRows,
  studioSceneCards,
  studioTabHref,
  type StudioConfig,
  type StudioPreviewItem,
  type VideoStudioTabId,
} from '@/lib/crm/cp-video-studio.util';

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpVideoStudio({
  videoId,
  scope: scopeValue,
  tab: tabValue,
}: {
  videoId: string;
  scope?: string;
  tab?: string;
}) {
  const scope = scopeFrom(scopeValue);
  const tab: VideoStudioTabId = tabValue === 'storyboard'
    || tabValue === 'timeline'
    || tabValue === 'review'
    || tabValue === 'version'
    ? tabValue
    : 'studio';
  const [draft, setDraft] = useState<CpVideoDraft | null>(null);
  const [kits, setKits] = useState<CpBrandKit[]>([]);
  const [settings, setSettings] = useState<CpSettings | null>(null);
  const [scenes, setScenes] = useState<CpScene[]>([]);
  const [assets, setAssets] = useState<CpAsset[]>([]);
  const [jobs, setJobs] = useState<CpRenderJob[]>([]);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<CpVideoInputMode>('prompt');
  const [content, setContent] = useState('');
  const [scriptValue, setScriptValue] = useState<unknown>(null);
  const [kitId, setKitId] = useState('');
  const [config, setConfig] = useState<StudioConfig>(studioConfigFrom({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scripting, setScripting] = useState(false);
  const [previews, setPreviews] = useState<StudioPreviewItem[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  const playbookId = useMemo(() => {
    const cfg = draft?.config_json;
    if (!cfg || typeof cfg !== 'object') return null;
    const id = (cfg as Record<string, unknown>).playbook_id;
    return typeof id === 'string' ? id : null;
  }, [draft?.config_json]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [video, kitResult, settingResult, sceneResult, assetResult, jobResult, previewResult] = await Promise.all([
        getCpVideo(token, videoId, scope),
        listKits(token, scope),
        getCpSettings(token).catch(() => null),
        listCpScenes(token, videoId, scope).catch(() => ({ items: [] as CpScene[] })),
        listCpAssets(token, scope).catch(() => ({ items: [] as CpAsset[] })),
        listCpRenders(token, scope).catch(() => ({ items: [] as CpRenderJob[] })),
        listCpVideoPreviews(token, videoId, scope).catch(() => ({ items: [] })),
      ]);
      setDraft(video);
      setKits(kitResult.items);
      setSettings(settingResult);
      setScenes(sceneResult.items);
      const projectAssets = draftAssets(assetResult.items, video.project_id);
      setAssets(projectAssets);
      setJobs(studioJobs(jobResult.items, video.id));
      const nextPreviews = mergeStudioPreviews({
        versions: previewResult.items,
        assets: projectAssets,
      });
      setPreviews(nextPreviews);
      setPreviewId((current) => (
        current && nextPreviews.some((item) => item.id === current)
          ? current
          : defaultPreviewId(nextPreviews)
      ));
      setName(video.name ?? '');
      setMode(video.input_mode ?? 'prompt');
      setScriptValue(video.script_json ?? null);
      const nextConfig = studioConfigFrom(video.config_json);
      setConfig(nextConfig);
      setContent(
        video.input_mode === 'script'
          ? typeof video.script_json === 'string'
            ? video.script_json
            : video.script_json == null
              ? ''
              : JSON.stringify(video.script_json, null, 2)
          : video.input_mode === 'url'
            ? nextConfig.source_url || video.prompt || ''
            : video.prompt ?? '',
      );
      setKitId(video.brand_kit_version_id ?? '');
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tải được video draft'));
    } finally {
      setLoading(false);
    }
  }, [scope, videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !kitId) {
      setBrandColors([]);
      return;
    }
    let cancelled = false;
    void listVersions(token, kitId, scope)
      .then((out) => {
        if (cancelled) return;
        const latest = out.items.at(-1)?.payload_json;
        setBrandColors(studioBrandPalette(latest));
      })
      .catch(() => {
        if (!cancelled) setBrandColors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kitId, scope]);

  useEffect(() => {
    if (!draft || tab !== 'studio') return;
    const timer = window.setInterval(() => {
      const token = getAccessToken();
      if (!token) return;
      void listCpRenders(token, scope)
        .then((out) => setJobs(studioJobs(out.items, draft.id)))
        .catch(() => undefined);
    }, CP_RENDER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [draft?.id, scope, tab]);

  const payload = useMemo(() => ({
    name: name.trim() || draft?.name || 'Video draft',
    input_mode: mode,
    prompt: mode === 'script' || mode === 'url' ? null : content,
    script_json: mode === 'script' ? scriptValue : null,
    config_json: {
      ...studioConfigPayload({
        ...config,
        source_url: mode === 'url' ? content : config.source_url,
      }),
    },
    brand_kit_version_id: kitId || null,
  }), [config, content, draft?.name, kitId, mode, name, scriptValue]);

  useEffect(() => {
    if (!draft || loading) return;
    const timer = window.setTimeout(async () => {
      const token = getAccessToken();
      if (!token) return;
      setSaving(true);
      try {
        const saved = await patchCpVideo(token, draft.id, payload, scope);
        setDraft((current) => mergeDraftAfterAutosave(current, saved));
      } catch (caught) {
        setError(formatCpApiError(caught, 'Không autosave được draft'));
      } finally {
        setSaving(false);
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [draft?.id, loading, payload, scope]);

  async function runAutoScript() {
    const token = getAccessToken();
    if (!token || !draft) return;
    setScripting(true);
    setError('');
    setNotice('');
    try {
      await autoScriptCpVideo(token, draft.id);
      setNotice('Đã tạo lại kịch bản từ playbook');
      await load();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tạo lại được kịch bản'));
    } finally {
      setScripting(false);
    }
  }

  async function cancelRender(jobId: string) {
    const token = getAccessToken();
    if (!token || !draft) return;
    setCancellingJobId(jobId);
    setError('');
    try {
      await cancelCpRender(token, jobId, scope);
      const refreshed = await listCpRenders(token, scope);
      setJobs(studioJobs(refreshed.items, draft.id));
      setNotice('Đã hủy render job');
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không hủy được render job'));
    } finally {
      setCancellingJobId(null);
    }
  }

  async function submitRender() {
    const token = getAccessToken();
    if (!token || !draft) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setRendering(true);
    setError('');
    setNotice('');
    try {
      await patchCpVideo(token, draft.id, payload, scope);
      const job = await createCpRender(token, draft.id, crypto.randomUUID(), scope);
      setNotice(`Đã gửi render job ${job.job_id ?? job.id}`);
      const [refreshed, previewResult] = await Promise.all([
        listCpRenders(token, scope),
        listCpVideoPreviews(token, draft.id, scope).catch(() => ({ items: [] })),
      ]);
      setJobs(studioJobs(refreshed.items, draft.id));
      const nextPreviews = mergeStudioPreviews({
        versions: previewResult.items,
        assets,
      });
      setPreviews(nextPreviews);
      setPreviewId((current) => (
        current && nextPreviews.some((item) => item.id === current)
          ? current
          : defaultPreviewId(nextPreviews)
      ));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không gửi được render'));
    } finally {
      setRendering(false);
    }
  }

  const estimate = formatEstimate(
    config.estimated_credits === '' ? null : Number(config.estimated_credits),
    settings?.watermark_draft,
  );
  const sceneCards = studioSceneCards(scenes, config.duration_sec);
  const attachedAssets = useMemo(
    () => assets.filter((asset) => (
      config.studio_assets.reference_ids.includes(asset.id)
      || config.studio_assets.logo_id === asset.id
    )),
    [assets, config.studio_assets],
  );
  const gates = studioGateItems({
    aiEnabled: settings?.ai_enabled === true,
    assets: attachedAssets.length ? attachedAssets : assets,
  });
  const queueRows = studioRenderRows({
    jobs,
    draftName: name || draft?.name || 'Video draft',
    config,
  });
  const href = (id: VideoStudioTabId) => studioTabHref(id, {
    videoId,
    scope,
    versionId: draft?.latest_version_id,
  });

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">
            Vận hành / Sản xuất sáng tạo / Video Studio — {name || dash(null)}
          </p>
          <h1>{name ? `Video Studio — ${name}` : 'Video Studio'}</h1>
          <p className="cp-muted">
            {CP_SUBTITLES.vidStudio}
            {saving ? ' · Đang autosave…' : draft?.autosaved_at ? ` · ${draft.autosaved_at}` : ''}
          </p>
          {playbookId ? (
            <p className="cp-alert cp-alert--inline">
              Playbook: {playbookId}
              {playbookId === 'tvc_short_169'
                ? ' · Render cinematic trong Video SOP → ingest version vào CP (QC tvc_short + Legal)'
                : null}
            </p>
          ) : null}
        </div>
        <div className="cp-overview__actions">
          {shouldShowVideoSopNav(getStoredUser()) ? (
            <Link className="cp-btn" href={videoSopHref(null)}>Mở Video SOP</Link>
          ) : null}
          <button
            type="button"
            className="cp-btn"
            disabled={loading || scripting || !draft || !playbookId}
            onClick={() => void runAutoScript()}
          >
            {scripting ? 'Đang tạo…' : 'Tạo lại kịch bản'}
          </button>
          <Link className="cp-btn" href={href('storyboard')}>Storyboard</Link>
        </div>
      </header>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}
      {notice ? <section className="cp-alert">{notice}</section> : null}

      <nav className="cp-chips" aria-label="Video studio">
        {VIDEO_STUDIO_TABS.map((item) => (
          <Link
            key={item.id}
            className={tab === item.id ? 'cp-chip is-on' : 'cp-chip'}
            href={href(item.id)}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === 'storyboard' ? <CpStoryboard videoId={videoId} scope={scope} /> : null}
      {tab === 'timeline' ? <CpTimeline videoId={videoId} scope={scope} /> : null}

      {tab === 'review' || tab === 'version' ? (
        <section className="cp-card">
          <header className="cp-card__head"><h2>{tab === 'review' ? 'Review' : 'Version'}</h2></header>
          <p className="cp-muted">
            Chưa có version. Reserve + render xong mới mở Review / Version (VID-05 / VID-08).
          </p>
        </section>
      ) : null}

      {tab === 'studio' ? (
        <div className="cp-studio-pro">
          <div className="cp-studio-pro__grid">
            <CpStudioBrief
              mode={mode}
              onModeChange={setMode}
              name={name}
              onNameChange={setName}
              content={content}
              onContentChange={(value) => {
                setContent(value);
                if (mode === 'script') setScriptValue(parseCpScriptEditor(value));
              }}
              config={config}
              onConfigChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
              assets={config.studio_assets}
              projectAssets={assets}
              onAssetsChange={(studio_assets) => setConfig((current) => ({ ...current, studio_assets }))}
              playbookId={playbookId}
              settings={settings}
              projectId={draft?.project_id}
              scope={scope}
              disabled={loading}
            />
            <CpStudioStage
              previews={previews}
              previewId={previewId}
              onPreviewSelect={setPreviewId}
              onRefresh={() => void load()}
              aspectRatio={config.aspect_ratio}
              durationSec={config.duration_sec}
              scope={scope}
              sceneCards={sceneCards}
              timelineHref={href('timeline')}
              seekTo={seekTo}
              onSeek={setSeekTo}
              currentSec={playheadSec}
              onCurrentChange={setPlayheadSec}
            />
            <CpStudioConfig
              config={config}
              onConfigChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
              kitId={kitId}
              onKitChange={setKitId}
              kits={kits}
              settings={settings}
              draft={draft}
              brandColors={brandColors}
              estimate={estimate}
              gates={gates}
              rendering={rendering}
              disabled={loading || !draft}
              onSubmit={() => void submitRender()}
            />
          </div>
          <CpStudioQueue
            rows={queueRows}
            scope={scope}
            onCancel={(jobId) => void cancelRender(jobId)}
            cancellingId={cancellingJobId}
          />
        </div>
      ) : null}
    </div>
  );
}
