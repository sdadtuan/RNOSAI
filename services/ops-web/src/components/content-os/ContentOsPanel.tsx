'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import { canWriteContentOs } from '@/lib/auth';
import {
  CMKT_P0_PAIRS,
  channelFormatLabel,
  fetchContentOsContext,
  fetchContentOsIdeas,
  fetchContentOsItem,
  fetchContentOsItems,
  patchContentOsItem,
  postContentOsIdea,
  postContentOsIdeaConvert,
  type ContentOsContext,
  type ContentOsIdea,
  type ContentOsItem,
} from '@/lib/content-os-api';

type SubView = 'overview' | 'ideas' | 'board';

interface Props {
  token: string;
  user: StoredStaffUser;
  lifecycleId: number;
}

const BOARD_COLUMNS = ['draft', 'in_review', 'approved_internal', 'scheduled', 'published'] as const;

const COLUMN_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'Đang duyệt',
  approved_internal: 'Đã duyệt',
  scheduled: 'Đã lên lịch',
  published: 'Published',
};

export function ContentOsPanel({ token, user, lifecycleId }: Props) {
  const [view, setView] = useState<SubView>('overview');
  const [ctx, setCtx] = useState<ContentOsContext | null>(null);
  const [ideas, setIdeas] = useState<ContentOsIdea[]>([]);
  const [items, setItems] = useState<ContentOsItem[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerItemId, setDrawerItemId] = useState<number | null>(null);
  const [drawerItem, setDrawerItem] = useState<ContentOsItem | null>(null);
  const [drawerMarkdown, setDrawerMarkdown] = useState('');
  const [saving, setSaving] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [convertPair, setConvertPair] = useState('facebook|social_post');

  const canWrite = canWriteContentOs(user);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [context, ideasRes, itemsRes] = await Promise.all([
        fetchContentOsContext(token, lifecycleId),
        fetchContentOsIdeas(token, lifecycleId),
        fetchContentOsItems(token, lifecycleId),
      ]);
      setCtx(context);
      setIdeas(ideasRes.ideas);
      setItems(itemsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải Content Board thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (drawerItemId == null) {
      setDrawerItem(null);
      return;
    }
    void (async () => {
      try {
        const item = await fetchContentOsItem(token, lifecycleId, drawerItemId);
        setDrawerItem(item);
        setDrawerMarkdown(String(item.body_json?.markdown ?? ''));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải item thất bại');
      }
    })();
  }, [drawerItemId, token, lifecycleId]);

  async function onCreateIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !newIdeaTitle.trim()) return;
    setSaving(true);
    setError('');
    try {
      await postContentOsIdea(token, lifecycleId, { title: newIdeaTitle.trim() });
      setNewIdeaTitle('');
      setMessage('Đã tạo idea');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo idea thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onConvertIdea(ideaId: number) {
    if (!canWrite) return;
    const [channel, format] = convertPair.split('|');
    setSaving(true);
    setError('');
    try {
      const out = await postContentOsIdeaConvert(token, lifecycleId, ideaId, { channel, format });
      setMessage(`Đã convert → item #${out.item.id}`);
      await reload();
      setDrawerItemId(out.item.id);
      setView('board');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Convert thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveItemBody() {
    if (!canWrite || drawerItemId == null) return;
    setSaving(true);
    setError('');
    try {
      await patchContentOsItem(token, lifecycleId, drawerItemId, {
        body_json: { markdown: drawerMarkdown, html: '', variants: drawerItem?.body_json?.variants ?? [] },
      });
      setMessage('Đã lưu nội dung');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {(['overview', 'ideas', 'board'] as SubView[]).map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
            onClick={() => setView(v)}
          >
            {v === 'overview' ? 'Tổng quan' : v === 'ideas' ? 'Ideas' : 'Board'}
          </button>
        ))}
      </div>

      {loading ? <p className="muted">Đang tải Content Board…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}

      {view === 'overview' && ctx ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <p className="muted">
            Snapshot:{' '}
            {ctx.snapshot
              ? ctx.snapshot.sealed
                ? 'Đã seal'
                : `Draft (#${ctx.snapshot.id}, ${ctx.snapshot.pillars_count} pillars)`
              : 'Chưa import Planner'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>Ideas: {ctx.counts.ideas}</span>
            <span>Draft: {ctx.counts.draft}</span>
            <span>Đang duyệt: {ctx.counts.in_review}</span>
            <span>Published MTD: {ctx.counts.published_mtd}</span>
          </div>
        </div>
      ) : null}

      {view === 'ideas' ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {canWrite ? (
            <form onSubmit={(e) => void onCreateIdea(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                value={newIdeaTitle}
                onChange={(e) => setNewIdeaTitle(e.target.value)}
                placeholder="Tiêu đề idea mới"
                style={{
                  flex: 1,
                  minWidth: 200,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.45rem 0.65rem',
                  color: 'var(--text)',
                }}
              />
              <button type="submit" className="btn btn-sm" disabled={saving || !newIdeaTitle.trim()}>
                Thêm idea
              </button>
            </form>
          ) : (
            <p className="muted">Chỉ xem — cần quyền crm_content.write</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
            {ideas.map((idea) => (
              <li
                key={idea.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.65rem 0.75rem',
                }}
              >
                <strong>{idea.title}</strong>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {idea.status} · {idea.hook || '—'}
                </div>
                {canWrite && idea.status !== 'converted' ? (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={convertPair}
                      onChange={(e) => setConvertPair(e.target.value)}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.35rem',
                        color: 'var(--text)',
                      }}
                    >
                      {CMKT_P0_PAIRS.map((p) => (
                        <option key={`${p.channel}|${p.format}`} value={`${p.channel}|${p.format}`}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={saving}
                      onClick={() => void onConvertIdea(idea.id)}
                    >
                      Convert → item
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {!ideas.length && !loading ? <p className="muted">Chưa có idea — thêm thủ công hoặc import Planner (M2).</p> : null}
        </div>
      ) : null}

      {view === 'board' ? (
        <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {BOARD_COLUMNS.map((col) => (
            <div key={col} style={{ minWidth: 200, flex: '0 0 200px' }}>
              <div className="muted" style={{ marginBottom: '0.35rem', fontWeight: 600 }}>
                {COLUMN_LABELS[col] ?? col} ({items.filter((i) => i.status === col).length})
              </div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {items
                  .filter((i) => i.status === col)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDrawerItemId(item.id)}
                      style={{
                        textAlign: 'left',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.55rem',
                        color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        {channelFormatLabel(item.channel, item.format)}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {drawerItemId != null ? (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setDrawerItemId(null)}
        >
          <div
            style={{
              width: 'min(720px, 95vw)',
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              padding: '1rem',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{drawerItem?.title ?? `Item #${drawerItemId}`}</h3>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDrawerItemId(null)}>
                Đóng
              </button>
            </div>
            {drawerItem ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                {channelFormatLabel(drawerItem.channel, drawerItem.format)} · {drawerItem.status}
              </p>
            ) : null}
            <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
              <span className="muted">Nội dung (markdown)</span>
              <textarea
                value={drawerMarkdown}
                onChange={(e) => setDrawerMarkdown(e.target.value)}
                rows={14}
                disabled={!canWrite || saving}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.55rem',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                }}
              />
            </label>
            {canWrite ? (
              <button
                type="button"
                className="btn btn-sm"
                style={{ marginTop: '0.65rem' }}
                disabled={saving}
                onClick={() => void onSaveItemBody()}
              >
                Lưu nội dung
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
