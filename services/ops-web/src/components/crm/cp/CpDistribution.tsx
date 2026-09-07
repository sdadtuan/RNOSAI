'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  deliverCpPublishItem,
  formatCpApiError,
  getCpSettings,
  listCpPublishHistory,
  listCpPublishItems,
  retryCpPublishItem,
  type CpPublishHistoryRow,
  type CpPublishItem,
  type CpScope,
  type CpSettings,
} from '@/lib/crm/cp-api';
import {
  CP_DEFAULT_TZ,
  distributionPostLabel,
  isCpPublishNative,
} from '@/lib/crm/cp-calendar.util';
import { dash } from '@/lib/crm/cp-format';

function scopeFrom(value?: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function formatWhen(value: string | null | undefined, tz = CP_DEFAULT_TZ): string {
  if (!value) return dash(null);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: tz,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

export function CpDistribution({
  scope: scopeValue,
}: {
  scope?: string | null;
}) {
  const scope = scopeFrom(scopeValue);
  const [items, setItems] = useState<CpPublishItem[]>([]);
  const [settings, setSettings] = useState<CpSettings | null>(null);
  const [history, setHistory] = useState<CpPublishHistoryRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const native = isCpPublishNative(settings);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [listed, stored] = await Promise.all([
        listCpPublishItems(token, { scope }),
        getCpSettings(token),
      ]);
      setItems(listed.items.filter((item) => item.video_version_id));
      setSettings(stored);
    } catch (caught) {
      setItems([]);
      setError(formatCpApiError(caught, 'Không tải được phân phối'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  const loadHistory = useCallback(async (itemId: string) => {
    const token = getAccessToken();
    if (!token || !itemId) {
      setHistory([]);
      return;
    }
    try {
      const out = await listCpPublishHistory(token, itemId, scope);
      setHistory(out.items);
    } catch {
      setHistory([]);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadHistory(selectedId);
  }, [loadHistory, selectedId]);

  async function run(kind: 'deliver' | 'retry', item: CpPublishItem) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(item.id);
    setError('');
    try {
      if (kind === 'retry') await retryCpPublishItem(token, item.id, scope);
      else await deliverCpPublishItem(token, item.id, scope);
      setSelectedId(item.id);
      await load();
      await loadHistory(item.id);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không giao được'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="cp-overview-grid">
      <div className="cp-card">
        <div className="cp-card__head">
          <h2>Phân phối</h2>
          <p className="cp-muted">
            {native
              ? 'Native bật — vẫn chỉ ghi nhận xuất file, không giả lập TikTok.'
              : 'Chỉ xuất file. Không đăng native TikTok.'}
          </p>
        </div>
        {error ? <p className="cp-card--error">{error}</p> : null}
        {loading ? <p className="cp-muted">Đang tải…</p> : null}
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Video</th>
                <th>Kênh</th>
                <th>Trạng thái</th>
                <th>Xuất file / post</th>
                <th>Lỗi</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((item) => (
                <tr key={item.id}>
                  <td>{dash(item.draft_name)}</td>
                  <td>{dash(item.channel)}</td>
                  <td>{dash(item.status)}</td>
                  <td>{distributionPostLabel(item, native)}</td>
                  <td>{dash(item.last_error)}</td>
                  <td>
                    <button
                      className="cp-btn"
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                    >
                      Lịch sử
                    </button>
                    {item.status === 'failed' ? (
                      <button
                        className="cp-btn cp-btn--primary"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void run('retry', item)}
                      >
                        {busyId === item.id ? 'Đang thử…' : 'Thử lại'}
                      </button>
                    ) : item.status === 'published' ? null : (
                      <button
                        className="cp-btn cp-btn--primary"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void run('deliver', item)}
                      >
                        {busyId === item.id ? 'Đang giao…' : 'Xuất file'}
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={6}>{dash(null)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <section className="cp-card">
        <h2>Lịch sử</h2>
        <p className="cp-muted">{selectedId ? `PublishItem ${selectedId}` : dash(null)}</p>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Hành động</th>
                <th>Actor</th>
                <th>Lúc</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? history.map((row) => (
                <tr key={row.id}>
                  <td>{dash(row.action)}</td>
                  <td>{dash(row.actor_id)}</td>
                  <td>{formatWhen(row.created_at)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={3}>{dash(null)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
