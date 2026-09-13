'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { getCpAssetStreamUrl, type CpScope } from '@/lib/crm/cp-api';
import {
  STUDIO_PLAYBACK_RATES,
  clampPreviewSeek,
  defaultPreviewId,
  formatPlayhead,
  formatPreviewMeta,
  studioViewerCommand,
  type StudioPreviewItem,
} from '@/lib/crm/cp-video-studio.util';

function playableSrc(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

function ratioClass(aspectRatio: string): string {
  return aspectRatio.replace(':', 'x').toLowerCase();
}

export function CpStudioPreview({
  items,
  selectedId,
  onSelect,
  onRefresh,
  aspectRatio,
  fallbackDurationSec,
  scope = 'me',
  layout = 'split',
  badgeLabel,
  zoom = 100,
  seekTo,
  onTimeUpdate,
}: {
  items: StudioPreviewItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
  aspectRatio: string;
  fallbackDurationSec: number;
  scope?: CpScope;
  layout?: 'split' | 'stack';
  badgeLabel?: string;
  zoom?: number;
  seekTo?: number | null;
  onTimeUpdate?: (sec: number) => void;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? items.find((item) => item.playable) ?? null;
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const retried = useRef(false);
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);

  const playable = Boolean(selected?.playable && selected.assetId);
  const knownDuration = duration ?? selected?.durationSec ?? fallbackDurationSec;
  const playhead = formatPlayhead(ready ? current : null, knownDuration);

  useEffect(() => {
    const next = items.some((item) => item.id === selectedId)
      ? selectedId
      : defaultPreviewId(items);
    if (next && next !== selectedId) onSelect(next);
  }, [items, onSelect, selectedId]);

  useEffect(() => {
    if (!playable || !selected?.assetId) {
      setSrc('');
      setError('');
      setLoading(false);
      setReady(false);
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    let cancelled = false;
    retried.current = false;
    setSrc('');
    setError('');
    setLoading(true);
    setReady(false);
    setCurrent(0);
    setDuration(selected.durationSec);
    void getCpAssetStreamUrl(token, selected.assetId, scope)
      .then((out) => {
        if (!cancelled) setSrc(playableSrc(out.url));
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Không mở được bản render');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playable, scope, selected?.assetId, selected?.durationSec]);

  useEffect(() => {
    if (seekTo == null || !Number.isFinite(seekTo) || !videoRef.current) return;
    videoRef.current.currentTime = seekTo;
    setCurrent(seekTo);
  }, [seekTo]);

  const rates = useMemo(() => (
    STUDIO_PLAYBACK_RATES.includes(rate as typeof STUDIO_PLAYBACK_RATES[number])
      ? STUDIO_PLAYBACK_RATES
      : [rate, ...STUDIO_PLAYBACK_RATES]
  ), [rate]);

  function applyCommand(command: ReturnType<typeof studioViewerCommand>) {
    const video = videoRef.current;
    if (!command) return;
    if (command === 'toggle') {
      if (!video) return;
      if (video.paused) void video.play();
      else video.pause();
      return;
    }
    if (command === 'back' || command === 'fwd') {
      const next = clampPreviewSeek(video?.currentTime ?? current, command === 'back' ? -5 : 5, knownDuration);
      if (video) video.currentTime = next;
      syncTime(next);
      return;
    }
    if (command === 'mute') {
      if (!video) return;
      video.muted = !video.muted;
      setMuted(video.muted);
      return;
    }
    if (command === 'fullscreen') {
      const node = viewerRef.current;
      if (!node) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void node.requestFullscreen();
    }
  }

  async function remint() {
    if (!selected?.assetId) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      const out = await getCpAssetStreamUrl(token, selected.assetId, scope);
      setSrc(playableSrc(out.url));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không mở được bản render');
    }
  }

  function syncTime(next: number) {
    setCurrent(next);
    onTimeUpdate?.(next);
  }

  return (
    <div className={`cp-studio-preview${layout === 'stack' ? ' cp-studio-preview--stack' : ''}`}>
      <div className={`cp-studio-preview__stage${layout === 'stack' ? ' cp-studio-preview__stage--stack' : ''}`}>
        <div
          ref={viewerRef}
          className={`cp-viewer cp-viewer--${ratioClass(aspectRatio)}`}
          style={{ ['--cp-viewer-zoom' as string]: `${zoom / 100}` }}
          tabIndex={0}
          role="region"
          aria-label="Xem bản render"
          onKeyDown={(event) => {
            const command = studioViewerCommand(event.key);
            if (!command) return;
            event.preventDefault();
            applyCommand(command);
          }}
        >
          <span className="cp-viewer__badge">
            {badgeLabel ?? `${selected?.label ?? 'Preview'} · ${aspectRatio} · ${playhead}`}
          </span>
          {playable && src ? (
            <video
              ref={videoRef}
              className="cp-viewer__video"
              src={src}
              playsInline
              preload="metadata"
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onTimeUpdate={(event) => syncTime(event.currentTarget.currentTime)}
              onLoadedMetadata={(event) => {
                setDuration(event.currentTarget.duration);
                syncTime(event.currentTarget.currentTime);
                setReady(true);
              }}
              onVolumeChange={(event) => {
                setMuted(event.currentTarget.muted);
                setVolume(event.currentTarget.volume);
              }}
              onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
              onError={() => {
                if (retried.current) {
                  setError('Không phát được bản render');
                  return;
                }
                retried.current = true;
                void remint();
              }}
            />
          ) : (
            <div className="cp-viewer__empty">
              <strong>
                {playable || loading
                  ? 'Đang tải bản xem…'
                  : items.length
                    ? 'Chưa chọn được bản xem'
                    : 'Chưa có bản render để xem'}
              </strong>
              <span>
                {playable || loading
                  ? 'Đang lấy bản render mới nhất.'
                  : items.length
                    ? 'Chọn một clip Ready trong danh sách bên cạnh.'
                    : 'Gửi render hoặc gắn video Ready từ thư viện.'}
              </span>
            </div>
          )}
          {error ? <p className="cp-viewer__status">{error}</p> : null}
          <div className="cp-viewer__chrome">
            <label className="cp-viewer__seek">
              <span className="sr-only">Tua</span>
              <input
                type="range"
                min={0}
                max={Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : 0}
                step={0.1}
                value={ready ? current : 0}
                disabled={!ready}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (videoRef.current) videoRef.current.currentTime = next;
                  syncTime(next);
                }}
              />
            </label>
            <div className="cp-viewer__row">
              <button type="button" onClick={() => applyCommand('toggle')} disabled={!src}>
                {paused ? 'Phát' : 'Tạm dừng'}
              </button>
              <button type="button" onClick={() => applyCommand('back')} disabled={!src}>-5s</button>
              <button type="button" onClick={() => applyCommand('fwd')} disabled={!src}>+5s</button>
              <span className="cp-viewer__time">{playhead}</span>
              <button type="button" onClick={() => applyCommand('mute')} disabled={!src}>
                {muted || volume === 0 ? 'Bật tiếng' : 'Tắt tiếng'}
              </button>
              <label className="cp-viewer__volume">
                <span className="sr-only">Âm lượng</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  disabled={!src}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (videoRef.current) {
                      videoRef.current.volume = next;
                      videoRef.current.muted = next === 0;
                    }
                    setVolume(next);
                    setMuted(next === 0);
                  }}
                />
              </label>
              <label className="cp-viewer__rate">
                <span className="sr-only">Tốc độ</span>
                <select
                  value={rate}
                  disabled={!src}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (videoRef.current) videoRef.current.playbackRate = next;
                    setRate(next);
                  }}
                >
                  {rates.map((item) => (
                    <option key={item} value={item}>{item}x</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => applyCommand('fullscreen')}>Toàn màn hình</button>
            </div>
          </div>
        </div>

        <aside className={`cp-preview-list${layout === 'stack' ? ' cp-preview-list--stack' : ''}`} aria-label="Danh sách bản render">
          <header className="cp-preview-list__head">
            <div>
              <b>Bản render</b>
              <p className="cp-muted">
                {items.length
                  ? `${items.filter((item) => item.playable).length}/${items.length} clip · mặc định mới nhất`
                  : 'Chưa có clip'}
              </p>
            </div>
            {onRefresh ? (
              <button type="button" className="cp-btn" onClick={onRefresh}>Làm mới</button>
            ) : null}
          </header>
          {items.length ? (
            <ul>
              {items.map((item) => {
                const active = item.id === (selected?.id ?? selectedId);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={active ? 'is-active' : undefined}
                      disabled={!item.playable}
                      onClick={() => onSelect(item.id)}
                    >
                      <span className="cp-preview-list__thumb" aria-hidden />
                      <span className="cp-preview-list__meta">
                        <b>{item.label}</b>
                        <span>{formatPreviewMeta(item)}</span>
                        {item.state ? <span>{item.state}</span> : null}
                        {active && item.playable ? <em>Đang xem</em> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="cp-muted">Chưa có bản render để xem</p>
          )}
        </aside>
      </div>
    </div>
  );
}
