'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  getCpVideo,
  listCpScenes,
  patchCpTimeline,
  type CpScene,
  type CpScope,
  type CpTimelineResult,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import {
  CP_TIMELINE_SAVE_DEBOUNCE_MS,
  CP_TIMELINE_TRACKS,
  createDebouncedSequencedSave,
  createUndoStack,
  durationSec,
  type CpTimelineMusic,
  type CpTimelineSnapshot,
} from '@/lib/crm/cp-timeline.util';

type TimelineSavePayload = { scenes: CpScene[]; music: CpTimelineMusic | null };

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function musicFrom(value: unknown): CpTimelineMusic | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  const music = config.music;
  if (!music || typeof music !== 'object' || Array.isArray(music)) return null;
  const row = music as Record<string, unknown>;
  return {
    source: typeof row.source === 'string' ? row.source : null,
    t_start: row.t_start == null ? null : Number(row.t_start),
    t_end: row.t_end == null ? null : Number(row.t_end),
    volume: row.volume == null ? null : Number(row.volume),
  };
}

function snapshotOf(scenes: CpScene[], music: CpTimelineMusic | null): CpTimelineSnapshot {
  return {
    scenes: scenes.map((scene) => ({ ...scene })),
    music: music ? { ...music } : null,
  };
}

function clipLeft(scene: CpScene, total: number): string {
  const start = Number(scene.t_start ?? 0);
  return `${Math.max(0, (start / total) * 100)}%`;
}

function clipWidth(scene: CpScene, total: number): string {
  const duration = durationSec(scene.t_start ?? 0, scene.t_end ?? 0) ?? 0;
  return `${Math.max(4, (duration / total) * 100)}%`;
}

export function CpTimeline({
  videoId,
  scope: scopeValue,
}: {
  videoId: string;
  scope?: string;
}) {
  const scope = scopeFrom(scopeValue);
  const undo = useRef(createUndoStack<CpTimelineSnapshot>());
  const saveRef = useRef<ReturnType<typeof createDebouncedSequencedSave<TimelineSavePayload, CpTimelineResult>> | null>(null);
  const [scenes, setScenes] = useState<CpScene[]>([]);
  const [music, setMusic] = useState<CpTimelineMusic | null>(null);
  const [revision, setRevision] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [sceneResult, draft] = await Promise.all([
        listCpScenes(token, videoId, scope),
        getCpVideo(token, videoId, scope),
      ]);
      setScenes(sceneResult.items);
      setMusic(musicFrom(draft.config_json));
      setRevision(draft.revision ?? null);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tải được timeline'));
    } finally {
      setLoading(false);
    }
  }, [scope, videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const saver = createDebouncedSequencedSave<TimelineSavePayload, CpTimelineResult>({
      delayMs: CP_TIMELINE_SAVE_DEBOUNCE_MS,
      write: async (payload) => {
        const token = getAccessToken();
        if (!token) {
          throw Object.assign(new Error('unauthenticated'), { unauthenticated: true });
        }
        setSaving(true);
        setError('');
        return patchCpTimeline(token, videoId, {
          scenes: payload.scenes.map((scene) => ({
            idx: scene.idx,
            t_start: scene.t_start ?? null,
            t_end: scene.t_end ?? null,
          })),
          music: payload.music,
        }, scope);
      },
      apply: (result, payload) => {
        setScenes(result.scenes);
        setMusic(result.music ?? payload.music);
        setRevision(result.revision);
        setSaving(false);
      },
      onError: (caught) => {
        setError(
          caught && typeof caught === 'object' && 'unauthenticated' in caught
            ? 'Phiên đăng nhập không hợp lệ'
            : formatCpApiError(caught, 'Không lưu được timeline'),
        );
        setSaving(false);
      },
    });
    saveRef.current = saver;
    return () => {
      saver.cancel();
      saveRef.current = null;
    };
  }, [scope, videoId]);

  const total = useMemo(() => {
    const ends = scenes.map((scene) => Number(scene.t_end ?? 0));
    if (music?.t_end != null) ends.push(Number(music.t_end));
    return Math.max(1, ...ends, 1);
  }, [music, scenes]);

  function remember() {
    undo.current.push(snapshotOf(scenes, music));
    setCanUndo(undo.current.canUndo());
    setCanRedo(undo.current.canRedo());
  }

  function persist(nextScenes: CpScene[], nextMusic: CpTimelineMusic | null, immediate = false) {
    const payload = { scenes: nextScenes, music: nextMusic };
    if (immediate) saveRef.current?.flush(payload);
    else saveRef.current?.schedule(payload);
  }

  function applySnapshot(snapshot: CpTimelineSnapshot | null) {
    if (!snapshot) return;
    setScenes(snapshot.scenes);
    setMusic(snapshot.music);
    setCanUndo(undo.current.canUndo());
    setCanRedo(undo.current.canRedo());
    persist(snapshot.scenes, snapshot.music, true);
  }

  function updateSceneTime(idx: number, field: 't_start' | 't_end', value: string) {
    remember();
    const next = scenes.map((scene) => (
      scene.idx === idx
        ? { ...scene, [field]: value === '' ? null : Number(value) }
        : scene
    ));
    setScenes(next);
    persist(next, music);
  }

  function updateMusic(field: keyof CpTimelineMusic, value: string) {
    remember();
    const next = { ...(music ?? {}), [field]: value === '' ? null : field === 'source' ? value : Number(value) };
    setMusic(next);
    persist(scenes, next);
  }

  return (
    <section className="cp-card" aria-busy={loading}>
      <div className="cp-card__head">
        <h2>Timeline</h2>
        <p className="cp-muted">Revision {dash(revision)}{saving ? ' · Đang lưu…' : ''}</p>
      </div>
      <div className="cp-filters" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button className="cp-btn" type="button" disabled={!canUndo} onClick={() => applySnapshot(undo.current.undo(snapshotOf(scenes, music)))}>
          Undo
        </button>
        <button className="cp-btn" type="button" disabled={!canRedo} onClick={() => applySnapshot(undo.current.redo(snapshotOf(scenes, music)))}>
          Redo
        </button>
      </div>
      {error ? <p className="cp-card--error" style={{ padding: 10 }}>{error}</p> : null}
      {scenes.length === 0 && !music ? (
        <p className="cp-empty">{dash(null)}</p>
      ) : (
        <div className="cp-tracks">
          {CP_TIMELINE_TRACKS.map((track) => (
            <div key={track.id} className="cp-track">
              <b>{track.label}</b>
              <div className="cp-track__bar">
                {track.id === 'music' ? (
                  <i
                    className="cp-clip"
                    style={{
                      left: `${Math.max(0, Number(music?.t_start ?? 0) / total * 100)}%`,
                      width: `${Math.max(4, (durationSec(music?.t_start ?? 0, music?.t_end ?? 0) ?? 0) / total * 100)}%`,
                    }}
                  >
                    {dash(music?.source)}
                  </i>
                ) : scenes.map((scene) => (
                  <i
                    key={`${track.id}-${scene.idx}`}
                    className="cp-clip"
                    style={{ left: clipLeft(scene, total), width: clipWidth(scene, total) }}
                  >
                    {track.id === 'scene' ? dash(scene.title) : track.id === 'vo' ? dash(scene.vo) : dash(scene.overlay)}
                  </i>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Scene</th>
              <th>Start</th>
              <th>End</th>
              <th>Caption</th>
            </tr>
          </thead>
          <tbody>
            {scenes.length === 0 ? (
              <tr><td colSpan={4} className="cp-empty">{dash(null)}</td></tr>
            ) : scenes.map((scene) => (
              <tr key={scene.idx}>
                <td>{dash(scene.title)}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={scene.t_start ?? ''}
                    onChange={(event) => updateSceneTime(scene.idx, 't_start', event.target.value)}
                    placeholder="—"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={scene.t_end ?? ''}
                    onChange={(event) => updateSceneTime(scene.idx, 't_end', event.target.value)}
                    placeholder="—"
                  />
                </td>
                <td>{dash(scene.overlay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label>
        <span>Music</span>
        <input
          value={music?.source ?? ''}
          onChange={(event) => updateMusic('source', event.target.value)}
          placeholder="—"
        />
      </label>
    </section>
  );
}
