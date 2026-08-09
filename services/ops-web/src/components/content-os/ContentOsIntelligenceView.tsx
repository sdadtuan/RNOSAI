'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchContentOsIntelligence,
  fetchContentOsItems,
  postContentOsItemMetric,
  postContentOsTopicSuggestJob,
  type ContentOsIntelligence,
  type ContentOsItem,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  canWrite: boolean;
  canGenerate: boolean;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

const RANGES = ['7d', '30d', '90d'] as const;

export function ContentOsIntelligenceView({
  token,
  lifecycleId,
  canWrite,
  canGenerate,
  onMessage,
  onError,
}: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]>('30d');
  const [intel, setIntel] = useState<ContentOsIntelligence | null>(null);
  const [publishedItems, setPublishedItems] = useState<ContentOsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [itemId, setItemId] = useState('');
  const [metricDate, setMetricDate] = useState(new Date().toISOString().slice(0, 10));
  const [impressions, setImpressions] = useState('');
  const [engagements, setEngagements] = useState('');
  const [clicks, setClicks] = useState('');
  const [leads, setLeads] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    onError('');
    try {
      const [intelRes, itemsRes] = await Promise.all([
        fetchContentOsIntelligence(token, lifecycleId, range),
        fetchContentOsItems(token, lifecycleId),
      ]);
      setIntel(intelRes);
      setPublishedItems(itemsRes.items.filter((i) => i.status === 'published'));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải intelligence thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, range, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitMetric(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const parsedItemId = Number(itemId);
    if (!Number.isFinite(parsedItemId) || parsedItemId <= 0) {
      onError('Chọn item published');
      return;
    }
    setBusy(true);
    try {
      await postContentOsItemMetric(token, lifecycleId, parsedItemId, {
        metric_date: metricDate,
        impressions: impressions ? Number(impressions) : undefined,
        engagements: engagements ? Number(engagements) : undefined,
        clicks: clicks ? Number(clicks) : undefined,
        leads: leads ? Number(leads) : undefined,
      });
      onMessage('Đã lưu metrics');
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lưu metrics thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runTopicSuggest() {
    if (!canGenerate) return;
    setBusy(true);
    try {
      const job = await postContentOsTopicSuggestJob(token, lifecycleId, { range });
      if (job.status === 'failed') {
        onError(job.error_text ?? 'Topic suggest thất bại');
      } else {
        onMessage('Đã cập nhật gợi ý topic');
        await reload();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Topic suggest thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !intel) {
    return <p className="muted">Đang tải intelligence…</p>;
  }

  const channels = Object.entries(intel?.by_channel ?? {});

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.95rem' }}>Intelligence</strong>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as (typeof RANGES)[number])}
          style={fieldStyle}
          disabled={busy}
        >
          {RANGES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {intel ? (
          <span className="muted" style={{ fontSize: '0.82rem' }}>
            {intel.from_date} → {intel.to_date} · {intel.metrics_count} metric rows
          </span>
        ) : null}
        {canGenerate ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void runTopicSuggest()}>
            Gợi ý topic tuần sau
          </button>
        ) : null}
      </div>

      {channels.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '0.55rem',
          }}
        >
          {channels.map(([channel, stats]) => (
            <div
              key={channel}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.65rem 0.75rem',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{channel}</div>
              <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Published: {stats.published ?? 0}
              </div>
              {stats.avg_engagement != null ? (
                <div className="muted" style={{ fontSize: '0.78rem' }}>
                  ER: {stats.avg_engagement}%
                </div>
              ) : null}
              {stats.engagements != null ? (
                <div className="muted" style={{ fontSize: '0.78rem' }}>
                  Engagements: {stats.engagements}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Chưa có metrics — nhập thủ công sau khi publish.
        </p>
      )}

      {intel?.top_items?.length ? (
        <div>
          <strong style={{ fontSize: '0.88rem' }}>Top content</strong>
          <ul style={{ margin: '0.45rem 0 0', paddingLeft: '1.1rem', fontSize: '0.84rem' }}>
            {intel.top_items.map((row) => (
              <li key={row.item_id}>
                {row.title}{' '}
                <span className="muted">
                  ({row.channel} · score {row.score})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intel?.suggestions?.length ? (
        <div>
          <strong style={{ fontSize: '0.88rem' }}>Gợi ý topic</strong>
          <ul style={{ margin: '0.45rem 0 0', paddingLeft: '1.1rem', fontSize: '0.84rem' }}>
            {intel.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {canWrite ? (
        <form onSubmit={(e) => void submitMetric(e)} style={{ display: 'grid', gap: '0.45rem' }}>
          <strong style={{ fontSize: '0.88rem' }}>Nhập metrics (manual)</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} required style={fieldStyle}>
              <option value="">Chọn item published…</option>
              {publishedItems.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.id} · {item.title}
                </option>
              ))}
            </select>
            <input type="date" value={metricDate} onChange={(e) => setMetricDate(e.target.value)} style={fieldStyle} />
            <input
              value={impressions}
              onChange={(e) => setImpressions(e.target.value)}
              placeholder="Impressions"
              inputMode="numeric"
              style={fieldStyle}
            />
            <input
              value={engagements}
              onChange={(e) => setEngagements(e.target.value)}
              placeholder="Engagements"
              inputMode="numeric"
              style={fieldStyle}
            />
            <input
              value={clicks}
              onChange={(e) => setClicks(e.target.value)}
              placeholder="Clicks"
              inputMode="numeric"
              style={fieldStyle}
            />
            <input
              value={leads}
              onChange={(e) => setLeads(e.target.value)}
              placeholder="Leads"
              inputMode="numeric"
              style={fieldStyle}
            />
            <button type="submit" className="btn btn-sm" disabled={busy || !itemId}>
              Lưu metrics
            </button>
          </div>
        </form>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Cần quyền crm_content.write để nhập metrics.
        </p>
      )}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.35rem 0.5rem',
  color: 'var(--text)',
  minWidth: 120,
};
