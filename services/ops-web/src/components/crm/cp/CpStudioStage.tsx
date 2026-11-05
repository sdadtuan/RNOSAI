'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  formatPlayhead,
  timelineMarks,
  type StudioPreviewItem,
  type StudioSceneCard,
} from '@/lib/crm/cp-video-studio.util';
import { CpStudioPreview } from './CpStudioPreview';

export function CpStudioStage({
  previews,
  previewId,
  onPreviewSelect,
  onRefresh,
  aspectRatio,
  durationSec,
  scope,
  sceneCards,
  timelineHref,
  seekTo,
  onSeek,
  currentSec,
  onCurrentChange,
}: {
  previews: StudioPreviewItem[];
  previewId: string | null;
  onPreviewSelect: (id: string) => void;
  onRefresh?: () => void;
  aspectRatio: string;
  durationSec: number;
  scope: string;
  sceneCards: StudioSceneCard[];
  timelineHref: string;
  seekTo?: number | null;
  onSeek?: (sec: number) => void;
  currentSec: number;
  onCurrentChange: (sec: number) => void;
}) {
  const [selectedScene, setSelectedScene] = useState(0);
  const [zoom, setZoom] = useState(100);
  const marks = useMemo(() => timelineMarks(durationSec), [durationSec]);
  const playhead = formatPlayhead(currentSec, durationSec);
  const activeScene = sceneCards[selectedScene] ?? sceneCards[0];

  useEffect(() => {
    if (seekTo == null || !Number.isFinite(seekTo)) return;
    onCurrentChange(seekTo);
  }, [seekTo, onCurrentChange]);

  function selectScene(index: number) {
    setSelectedScene(index);
    const scene = sceneCards[index];
    if (!scene) return;
    onSeek?.(scene.tStart);
    onCurrentChange(scene.tStart);
  }

  return (
    <section className="cp-studio-pro__stage">
      <CpStudioPreview
        items={previews}
        selectedId={previewId}
        onSelect={onPreviewSelect}
        onRefresh={onRefresh}
        aspectRatio={aspectRatio}
        fallbackDurationSec={durationSec}
        scope={scope as 'me'}
        layout="stack"
        badgeLabel={`Bản nháp · ${playhead.split(' / ')[1] ?? formatPlayhead(null, durationSec).split(' / ')[1]}`}
        zoom={zoom}
        seekTo={seekTo}
        onTimeUpdate={onCurrentChange}
      />

      <div className="cp-studio-pro__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={75}
          max={125}
          step={5}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
        <b>{zoom}%</b>
      </div>

      <div className="cp-studio-pro__scene-strip" aria-label="Storyboard scenes">
        {sceneCards.map((scene, index) => (
          <button
            key={scene.key}
            type="button"
            className={selectedScene === index ? 'is-on' : undefined}
            onClick={() => selectScene(index)}
          >
            <span className="cp-studio-pro__scene-thumb" aria-hidden />
            <b>{scene.title}</b>
            <small>{scene.hint}</small>
            {scene.locked ? <em>lock</em> : null}
            {scene.placeholder ? <em>placeholder</em> : null}
          </button>
        ))}
      </div>

      <div className="cp-studio-pro__timeline" aria-label="Timeline ruler">
        <div className="cp-studio-pro__timeline-track">
          <span
            className="cp-studio-pro__timeline-head"
            style={{
              left: `${Math.min(100, Math.max(0, (currentSec / durationSec) * 100))}%`,
            }}
            aria-hidden
          />
        </div>
        <div className="cp-studio-pro__timeline-marks">
          {marks.map((mark) => (
            <span key={mark}>{mark}s</span>
          ))}
        </div>
        {activeScene ? (
          <p className="cp-studio-pro__meta">
            Đang chọn {activeScene.title} · {activeScene.hint}
          </p>
        ) : null}
      </div>

      <Link className="cp-studio-pro__timeline-link" href={timelineHref}>
        Chỉnh sửa timeline
      </Link>
    </section>
  );
}
