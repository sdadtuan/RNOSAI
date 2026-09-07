'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { CpStoryboard } from './CpStoryboard';
import { CpTimeline } from './CpTimeline';
import {
  createCpRender,
  formatCpApiError,
  getCpVideo,
  listKits,
  parseCpScriptEditor,
  patchCpVideo,
  type CpBrandKit,
  type CpScope,
  type CpVideoDraft,
  type CpVideoInputMode,
} from '@/lib/crm/cp-api';
import { dash, draftLanguageWritable, mergeDraftAfterAutosave } from '@/lib/crm/cp-format';

type StudioConfig = {
  ratio: string;
  duration: number;
  style: string;
  locale: string;
  language: string;
  voice: string;
  model: string;
  estimated_credits: string;
};

const EMPTY_CONFIG: StudioConfig = {
  ratio: '9:16',
  duration: 30,
  style: '',
  locale: 'vi-VN',
  language: 'vi-VN',
  voice: '',
  model: 'stub',
  estimated_credits: '',
};

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function configFrom(value: unknown): StudioConfig {
  const config = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const duration = Number(config.duration);
  return {
    ratio: typeof config.ratio === 'string' ? config.ratio : EMPTY_CONFIG.ratio,
    duration: [15, 30, 60].includes(duration) ? duration : EMPTY_CONFIG.duration,
    style: typeof config.style === 'string' ? config.style : '',
    locale: typeof config.locale === 'string' ? config.locale : EMPTY_CONFIG.locale,
    language: typeof config.language === 'string'
      ? config.language
      : typeof config.locale === 'string'
        ? config.locale
        : EMPTY_CONFIG.language,
    voice: typeof config.voice === 'string' ? config.voice : '',
    model: typeof config.model === 'string' ? config.model : EMPTY_CONFIG.model,
    estimated_credits: config.estimated_credits == null
      ? ''
      : String(config.estimated_credits),
  };
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
  const tab = tabValue === 'storyboard' || tabValue === 'timeline' ? tabValue : 'studio';
  const [draft, setDraft] = useState<CpVideoDraft | null>(null);
  const [kits, setKits] = useState<CpBrandKit[]>([]);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<CpVideoInputMode>('prompt');
  const [content, setContent] = useState('');
  const [scriptValue, setScriptValue] = useState<unknown>(null);
  const [kitId, setKitId] = useState('');
  const [config, setConfig] = useState<StudioConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [video, kitResult] = await Promise.all([
        getCpVideo(token, videoId, scope),
        listKits(token, scope),
      ]);
      setDraft(video);
      setKits(kitResult.items);
      setName(video.name ?? '');
      setMode(video.input_mode ?? 'prompt');
      setScriptValue(video.script_json ?? null);
      setContent(
        video.input_mode === 'script'
          ? typeof video.script_json === 'string'
            ? video.script_json
            : video.script_json == null
              ? ''
              : JSON.stringify(video.script_json, null, 2)
          : video.prompt ?? '',
      );
      setKitId(video.brand_kit_version_id ?? '');
      setConfig(configFrom(video.config_json));
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
    prompt: mode === 'script' ? null : content,
    script_json: mode === 'script' ? scriptValue : null,
    config_json: {
      ratio: config.ratio,
      duration: config.duration,
      style: config.style || null,
      locale: config.locale || null,
      language: config.language || config.locale || null,
      voice: config.voice || null,
      model: config.model || null,
      estimated_credits: config.estimated_credits === ''
        ? null
        : Number(config.estimated_credits),
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
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không gửi được render'));
    } finally {
      setRendering(false);
    }
  }

  function setConfigField<K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Video Studio</p>
          <h1>{name ? `Video Studio — ${name}` : 'Video Studio'}</h1>
          <p className="cp-muted">{saving ? 'Đang autosave…' : dash(draft?.autosaved_at)}</p>
        </div>
        <div className="cp-filters">
          <Link className="cp-btn" href={`/crm/creative-os/video/templates?scope=${scope}`}>Mẫu</Link>
          <Link className="cp-btn" href={`/crm/creative-os/video/batch?scope=${scope}`}>Hàng loạt</Link>
          <Link className="cp-btn" href={`/crm/creative-os/video/ops?scope=${scope}`}>Ops</Link>
          <button
            className="cp-btn cp-btn--primary"
            type="button"
            disabled={loading || rendering || !draft}
            onClick={() => void submitRender()}
          >
            {rendering ? 'Đang gửi…' : 'Tạo video'}
          </button>
        </div>
      </header>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}
      {notice ? <section className="cp-alert">{notice}</section> : null}

      <nav className="cp-settings-tabs" aria-label="Video studio">
        <Link className={tab === 'studio' ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={`/crm/creative-os/video/${videoId}?scope=${scope}`}>Studio</Link>
        <Link className={tab === 'storyboard' ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={`/crm/creative-os/video/${videoId}?scope=${scope}&tab=storyboard`}>Storyboard</Link>
        <Link className={tab === 'timeline' ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={`/crm/creative-os/video/${videoId}?scope=${scope}&tab=timeline`}>Timeline</Link>
      </nav>

      {tab === 'storyboard' ? <CpStoryboard videoId={videoId} scope={scope} /> : null}
      {tab === 'timeline' ? <CpTimeline videoId={videoId} scope={scope} /> : null}

      {tab === 'studio' ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(0, 1.6fr) minmax(240px, 1fr)', gap: 12 }}>
        <section className="cp-card">
          <div className="cp-filters">
            {(['prompt', 'script', 'url'] as CpVideoInputMode[]).map((item) => (
              <button key={item} type="button" className={mode === item ? 'cp-btn cp-btn--primary' : 'cp-btn'} onClick={() => setMode(item)}>
                {item === 'prompt' ? 'Prompt' : item === 'script' ? 'Kịch bản' : 'URL'}
              </button>
            ))}
          </div>
          <label><span>Tên draft</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>
            <span>{mode === 'script' ? 'Kịch bản' : mode === 'url' ? 'URL nguồn' : 'Prompt'}</span>
            <textarea
              rows={10}
              value={content}
              onChange={(event) => {
                const value = event.target.value;
                setContent(value);
                if (mode === 'script') setScriptValue(parseCpScriptEditor(value));
              }}
            />
          </label>
        </section>

        <section className="cp-card">
          <div className="cp-card__head"><h2>Preview</h2></div>
          <div style={{ minHeight: 320, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#e5e7eb' }}>
            <span className="cp-empty">{dash(null)}</span>
          </div>
        </section>

        <section className="cp-card">
          <div className="cp-card__head"><h2>Cấu hình</h2></div>
          <div className="cp-filters" style={{ display: 'grid' }}>
            <label><span>Tỉ lệ</span><select value={config.ratio} onChange={(event) => setConfigField('ratio', event.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></label>
            <label><span>Duration</span><select value={config.duration} onChange={(event) => setConfigField('duration', Number(event.target.value))}><option value={15}>15s</option><option value={30}>30s</option><option value={60}>60s</option></select></label>
            <label><span>Style</span><input value={config.style} onChange={(event) => setConfigField('style', event.target.value)} /></label>
            <label>
              <span>Ngôn ngữ</span>
              <input
                value={config.language}
                disabled={!draftLanguageWritable(draft)}
                onChange={(event) => {
                  const value = event.target.value;
                  setConfig((cur) => ({ ...cur, language: value, locale: value }));
                }}
              />
            </label>
            <label><span>Voice</span><input value={config.voice} onChange={(event) => setConfigField('voice', event.target.value)} /></label>
            <label><span>Model</span><select value={config.model} onChange={(event) => setConfigField('model', event.target.value)}><option value="stub">stub</option></select></label>
            <label><span>Brand Kit</span><select value={kitId} onChange={(event) => setKitId(event.target.value)}><option value="">—</option>{kits.map((kit) => <option key={kit.id} value={kit.id}>{kit.name}</option>)}</select></label>
            <label><span>Ước tính credit</span><input min="0" step="1" type="number" value={config.estimated_credits} onChange={(event) => setConfigField('estimated_credits', event.target.value)} placeholder="—" /></label>
          </div>
        </section>
      </div> : null}
    </div>
  );
}
