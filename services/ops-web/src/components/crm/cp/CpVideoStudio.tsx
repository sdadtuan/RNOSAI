'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredUser, getAccessToken } from '@/lib/auth';
import { shouldShowVideoSopNav } from '@/components/ops-nav-video-sop';
import { videoSopHref } from '@/lib/crm/cp-video-list.util';
import { CpStoryboard } from './CpStoryboard';
import { CpTimeline } from './CpTimeline';
import {
  createCpRender,
  formatCpApiError,
  getCpSettings,
  getCpVideo,
  listCpAssets,
  listCpRenders,
  listCpScenes,
  listKits,
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
import { dash, draftLanguageWritable, mergeDraftAfterAutosave } from '@/lib/crm/cp-format';
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
  type StudioConfig,
  type VideoStudioTabId,
} from '@/lib/crm/cp-video-studio.util';

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function modeLabel(mode: CpVideoInputMode): string {
  if (mode === 'script') return 'Kịch bản';
  if (mode === 'url') return 'URL';
  return 'Prompt';
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
      const [video, kitResult, settingResult, sceneResult, assetResult, jobResult] = await Promise.all([
        getCpVideo(token, videoId, scope),
        listKits(token, scope),
        getCpSettings(token).catch(() => null),
        listCpScenes(token, videoId, scope).catch(() => ({ items: [] as CpScene[] })),
        listCpAssets(token, scope).catch(() => ({ items: [] as CpAsset[] })),
        listCpRenders(token, scope).catch(() => ({ items: [] as CpRenderJob[] })),
      ]);
      setDraft(video);
      setKits(kitResult.items);
      setSettings(settingResult);
      setScenes(sceneResult.items);
      setAssets(draftAssets(assetResult.items, video.project_id));
      setJobs(studioJobs(jobResult.items, video.id));
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
      const refreshed = await listCpRenders(token, scope);
      setJobs(studioJobs(refreshed.items, draft.id));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không gửi được render'));
    } finally {
      setRendering(false);
    }
  }

  function setConfigField<K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  const urlState = urlFieldState(settings);
  const maxChars = promptMaxChars(settings?.policy_json);
  const models = modelOptions(settings?.models_json);
  const blocks = liveRenderBlocks({
    aiEnabled: settings?.ai_enabled === true,
    assets,
  });
  const estimate = formatEstimate(
    config.estimated_credits === '' ? null : Number(config.estimated_credits),
    settings?.watermark_draft,
  );
  const playhead = formatPlayhead(null, config.duration_sec);
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
          <button
            className="cp-btn cp-btn--primary"
            type="button"
            disabled={loading || rendering || !draft}
            onClick={() => void submitRender()}
          >
            {rendering ? 'Đang gửi…' : 'Tạo video (reserve)'}
          </button>
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
          <p className="cp-muted">Chưa có version để mở VID-05 / VID-08.</p>
          <p className="cp-empty">{dash(null)}</p>
        </section>
      ) : null}

      {tab === 'studio' ? (
        <>
          <div className="cp-studio">
            <section className="cp-card">
              <div className="cp-chips">
                {(['prompt', 'script', 'url'] as CpVideoInputMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={mode === item ? 'cp-chip is-on' : 'cp-chip'}
                    onClick={() => setMode(item)}
                  >
                    {modeLabel(item)}
                  </button>
                ))}
              </div>
              <label>
                <span>Tên draft</span>
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                <span>{mode === 'script' ? 'Kịch bản' : mode === 'url' ? 'URL nguồn' : 'Prompt'}</span>
                <textarea
                  rows={8}
                  value={content}
                  disabled={mode === 'url' && urlState.disabled}
                  onChange={(event) => {
                    const value = event.target.value;
                    setContent(value);
                    if (mode === 'script') setScriptValue(parseCpScriptEditor(value));
                  }}
                />
              </label>
              <p className="cp-muted">
                {formatCharCount(content.length, maxChars)} · moderation trước dispatch
              </p>
              {mode === 'url' && urlState.reason ? <p className="cp-muted">{urlState.reason}</p> : null}
              <label className="cp-check">
                <input
                  type="checkbox"
                  checked={config.auto_script}
                  onChange={(event) => setConfigField('auto_script', event.target.checked)}
                />
                Tự tạo kịch bản (hook, scene, VO, overlay, CTA)
              </label>
              <Link className="cp-btn" href={`/crm/creative-os/media?project=${draft?.project_id ?? ''}`}>
                DAM picker (asset_version_id)
              </Link>
              {assets.length ? (
                <div className="cp-media-grid cp-media-grid--2">
                  {assets.map((asset) => (
                    <Link key={asset.id} className="cp-media-card" href={`/crm/creative-os/media/${asset.id}`}>
                      <div className="cp-thumb" />
                      <b>{asset.filename}</b>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="cp-empty">{dash(null)}</p>
              )}
            </section>

            <section className="cp-card">
              <div className="cp-preview">
                Preview {config.aspect_ratio} · {playhead}
              </div>
              {scenes.length ? (
                <div className="cp-scene-strip">
                  {scenes.map((scene) => (
                    <article key={scene.idx} className="cp-media-card">
                      <div className="cp-thumb" />
                      <b>{sceneStripLabel(scene)}</b>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="cp-empty">{dash(null)}</p>
              )}
              <Link className="cp-link" href={href('timeline')}>Mở timeline 4 track</Link>
            </section>

            <section className="cp-card cp-studio-config">
              <label>
                <span>Tỉ lệ</span>
                <select value={config.aspect_ratio} onChange={(event) => setConfigField('aspect_ratio', event.target.value)}>
                  <option>9:16</option>
                  <option>16:9</option>
                  <option>1:1</option>
                  <option>4:5</option>
                </select>
              </label>
              <label>
                <span>Duration</span>
                <select
                  value={config.duration_sec}
                  onChange={(event) => setConfigField('duration_sec', Number(event.target.value))}
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              </label>
              <label>
                <span>Style</span>
                <input value={config.style} onChange={(event) => setConfigField('style', event.target.value)} />
              </label>
              <label>
                <span>Locale / Voice</span>
                <input
                  value={config.language}
                  disabled={!draftLanguageWritable(draft)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setConfig((cur) => ({ ...cur, language: value }));
                  }}
                />
                <input
                  value={config.voice_id}
                  placeholder="Voice"
                  onChange={(event) => setConfigField('voice_id', event.target.value)}
                />
              </label>
              <label>
                <span>Music</span>
                <input value={config.music} onChange={(event) => setConfigField('music', event.target.value)} />
              </label>
              <label>
                <span>Model</span>
                <select value={config.model_id} onChange={(event) => setConfigField('model_id', event.target.value)}>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Brand Kit</span>
                <select value={kitId} onChange={(event) => setKitId(event.target.value)}>
                  <option value="">{dash(null)}</option>
                  {kits.map((kit) => (
                    <option key={kit.id} value={kit.id}>{formatKitOption(kit)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ước tính credit</span>
                <input
                  min="0"
                  step="1"
                  type="number"
                  value={config.estimated_credits}
                  onChange={(event) => setConfigField('estimated_credits', event.target.value)}
                  placeholder="—"
                />
              </label>
              <p><b>{estimate}</b></p>
              <p className="cp-muted">
                Block nếu: AI tắt · asset ≠ Ready · rights · credit · moderation
                {blocks.length ? ` · đang chặn: ${blocks.join(' · ')}` : ''}
              </p>
            </section>
          </div>

          <section className="cp-card">
            <header className="cp-card__head"><h2>Queue</h2></header>
            <div className="cp-table-wrap">
              <table className="cp-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Trạng thái</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length ? jobs.map((job) => (
                    <tr key={job.id}>
                      <td>
                        <Link className="cp-link" href={`/crm/creative-os/video/ops?job=${job.id}&scope=${scope}`}>
                          {job.job_id ?? job.id}
                        </Link>
                      </td>
                      <td>
                        <span className={job.state === 'failed' ? 'cp-pill cp-pill--danger' : 'cp-pill cp-pill--info'}>
                          {formatJobStatus(job)}
                        </span>
                      </td>
                      <td>{dash(job.stage)}</td>
                    </tr>
                  )) : (
                    <tr><td className="cp-empty" colSpan={3}>{dash(null)}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
