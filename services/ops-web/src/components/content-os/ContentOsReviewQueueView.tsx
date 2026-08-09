'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  channelFormatLabel,
  fetchContentOsReviewQueue,
  fetchContentOsReviewQueueSummary,
  postContentOsApproveItem,
  postContentOsRejectItem,
  type ContentOsReviewQueueItem,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  canApprove: boolean;
  onOpenItem: (itemId: number) => void;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsReviewQueueView({
  token,
  lifecycleId,
  canApprove,
  onOpenItem,
  onChanged,
  onError,
  onMessage,
}: Props) {
  const [items, setItems] = useState<ContentOsReviewQueueItem[]>([]);
  const [summary, setSummary] = useState<{ total: number; sla_breach: number } | null>(null);
  const [slaOnly, setSlaOnly] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [queue, sum] = await Promise.all([
        fetchContentOsReviewQueue(token, lifecycleId, { sla_breach: slaOnly || undefined }),
        fetchContentOsReviewQueueSummary(token, lifecycleId),
      ]);
      setItems(queue.items);
      setSummary(sum);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải review queue thất bại');
    }
  }, [token, lifecycleId, slaOnly, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onApprove(itemId: number) {
    if (!canApprove) return;
    setBusy(true);
    onError('');
    try {
      await postContentOsApproveItem(token, lifecycleId, itemId);
      onMessage(`Đã duyệt item #${itemId}`);
      await reload();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Duyệt thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canApprove || rejectId == null) return;
    setBusy(true);
    onError('');
    try {
      await postContentOsRejectItem(token, lifecycleId, rejectId, rejectComment.trim());
      onMessage(`Đã từ chối item #${rejectId}`);
      setRejectId(null);
      setRejectComment('');
      await reload();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Từ chối thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span>In review: {summary?.total ?? items.length}</span>
        <span style={{ color: summary?.sla_breach ? 'var(--warning, #e6a700)' : undefined }}>
          SLA breach: {summary?.sla_breach ?? 0}
        </span>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={slaOnly} onChange={(e) => setSlaOnly(e.target.checked)} />
          Chỉ SLA breach
        </label>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.65rem',
              background: item.sla_breach ? 'rgba(255, 80, 0, 0.06)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div>
                <strong>{item.title}</strong>
                <div className="muted" style={{ fontSize: '0.82rem' }}>
                  {channelFormatLabel(item.channel, item.format)}
                  {item.in_review_at
                    ? ` · since ${new Date(item.in_review_at).toLocaleString('vi-VN')}`
                    : ''}
                  {item.sla_breach ? ' · SLA ⚠' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenItem(item.id)}>
                  Mở
                </button>
                {canApprove ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => void onApprove(item.id)}
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        setRejectId(item.id);
                        setRejectComment('');
                      }}
                    >
                      Từ chối
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="muted">Không có item đang duyệt.</p> : null}

      {rejectId != null ? (
        <form
          onSubmit={(e) => void onRejectSubmit(e)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.65rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <strong>Từ chối item #{rejectId}</strong>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            placeholder="Comment tối thiểu 10 ký tự…"
            required
            minLength={10}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.45rem',
              color: 'var(--text)',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-sm" disabled={busy || rejectComment.trim().length < 10}>
              Xác nhận từ chối
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRejectId(null)}>
              Hủy
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
