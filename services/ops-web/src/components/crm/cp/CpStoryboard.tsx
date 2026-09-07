'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  listCpScenes,
  putCpScenes,
  regenerateCpScene,
  type CpScene,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';
import {
  CP_OVERLAY_MAX,
  applySceneRegenerate,
  clipOverlay,
  durationSec,
  reindexScenes,
} from '@/lib/crm/cp-timeline.util';

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function emptyScene(idx: number): CpScene {
  return {
    idx,
    title: '',
    t_start: null,
    t_end: null,
    visual: '',
    vo: '',
    overlay: '',
    locked: false,
    qc: null,
  };
}

export function CpStoryboard({
  videoId,
  scope: scopeValue,
}: {
  videoId: string;
  scope?: string;
}) {
  const scope = scopeFrom(scopeValue);
  const [scenes, setScenes] = useState<CpScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await listCpScenes(token, videoId, scope);
      setScenes(result.items);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tải được storyboard'));
    } finally {
      setLoading(false);
    }
  }, [scope, videoId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: CpScene[]) {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setBusy('save');
    setError('');
    try {
      const saved = await putCpScenes(token, videoId, {
        scenes: reindexScenes(next).map((scene) => ({
          ...scene,
          overlay: clipOverlay(scene.overlay ?? ''),
        })),
      }, scope);
      setScenes(saved.items);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không lưu được scene'));
    } finally {
      setBusy('');
    }
  }

  function updateScene(idx: number, patch: Partial<CpScene>) {
    setScenes((current) => current.map((scene) => (
      scene.idx === idx ? { ...scene, ...patch } : scene
    )));
  }

  async function saveAll() {
    await persist(scenes);
  }

  async function addScene() {
    await persist([...scenes, emptyScene(scenes.length)]);
  }

  async function duplicateScene(scene: CpScene) {
    const copy = { ...scene, idx: scene.idx + 1, locked: false };
    const next = [...scenes];
    next.splice(scene.idx + 1, 0, copy);
    await persist(next);
  }

  async function removeScene(scene: CpScene) {
    await persist(scenes.filter((item) => item.idx !== scene.idx));
  }

  async function regenerate(scene: CpScene) {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setBusy(`regen-${scene.idx}`);
    setError('');
    try {
      const generated = await regenerateCpScene(token, videoId, scene.idx, scope);
      setScenes((current) => current.map((item) => (
        item.idx === scene.idx
          ? applySceneRegenerate(item, {
            visual: generated.visual ?? item.visual ?? '',
            vo: generated.vo ?? item.vo ?? '',
            overlay: generated.overlay ?? item.overlay ?? '',
          })
          : item
      )));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không regenerate được scene'));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="cp-card" aria-busy={loading}>
      <div className="cp-card__head">
        <h2>Storyboard</h2>
        <button className="cp-btn" type="button" disabled={Boolean(busy)} onClick={() => void addScene()}>
          Thêm scene
        </button>
      </div>
      {error ? <p className="cp-card--error" style={{ padding: 10 }}>{error}</p> : null}
      {scenes.length === 0 ? (
        <p className="cp-empty">{dash(null)}</p>
      ) : (
        <div className="cp-storyboard">
          {scenes.map((scene) => {
            const duration = durationSec(scene.t_start, scene.t_end);
            return (
              <article key={scene.idx} className="cp-card">
                <div className="cp-card__head">
                  <h3>Scene {scene.idx + 1}</h3>
                  <span className="cp-pill">{scene.locked ? 'Locked' : 'Open'}</span>
                </div>
                <label>
                  <span>Title</span>
                  <input
                    value={scene.title ?? ''}
                    onChange={(event) => updateScene(scene.idx, { title: event.target.value })}
                    placeholder="—"
                  />
                </label>
                <p className="cp-muted">Duration: {duration == null ? dash(null) : `${duration}s`}</p>
                <label>
                  <span>Visual</span>
                  <textarea
                    rows={2}
                    value={scene.visual ?? ''}
                    disabled={scene.locked}
                    onChange={(event) => updateScene(scene.idx, { visual: event.target.value })}
                    placeholder="—"
                  />
                </label>
                <label>
                  <span>VO</span>
                  <textarea
                    rows={2}
                    value={scene.vo ?? ''}
                    disabled={scene.locked}
                    onChange={(event) => updateScene(scene.idx, { vo: event.target.value })}
                    placeholder="—"
                  />
                </label>
                <label>
                  <span>Overlay</span>
                  <input
                    maxLength={CP_OVERLAY_MAX}
                    value={scene.overlay ?? ''}
                    disabled={scene.locked}
                    onChange={(event) => updateScene(scene.idx, { overlay: clipOverlay(event.target.value) })}
                    placeholder="—"
                  />
                </label>
                <p className="cp-muted">QC: {dash(scene.qc)}</p>
                <div className="cp-filters" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                  <button className="cp-btn" type="button" disabled={Boolean(busy)} onClick={() => void saveAll()}>
                    Lưu
                  </button>
                  <button
                    className="cp-btn"
                    type="button"
                    onClick={() => void persist(scenes.map((item) => (
                      item.idx === scene.idx ? { ...item, locked: !item.locked } : item
                    )))}
                  >
                    {scene.locked ? 'Unlock' : 'Lock'}
                  </button>
                  <button
                    className="cp-btn"
                    type="button"
                    disabled={Boolean(busy) || scene.locked}
                    onClick={() => void regenerate(scene)}
                  >
                    {busy === `regen-${scene.idx}` ? '…' : 'Regenerate'}
                  </button>
                  <button className="cp-btn" type="button" onClick={() => void duplicateScene(scene)}>
                    Duplicate
                  </button>
                  <button className="cp-btn" type="button" onClick={() => void removeScene(scene)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
