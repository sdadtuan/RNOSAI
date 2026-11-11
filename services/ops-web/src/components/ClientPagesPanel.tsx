'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  addClientPortalPage,
  fetchClientPortalPages,
  fetchMetaBusinessPages,
  removeClientPortalPage,
  updateClientPortalPage,
  type PortalClientPage,
} from '@/lib/api';

type Channel = PortalClientPage['channel'];

type Props = {
  token: string;
  clientId: string;
  canMutate: boolean;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

const CHANNELS: { id: Channel; label: string; placeholder: string }[] = [
  { id: 'facebook', label: 'Facebook', placeholder: 'Fanpage ID' },
  { id: 'zalo', label: 'Zalo', placeholder: 'OA ID' },
  { id: 'google', label: 'Google', placeholder: 'Customer ID' },
  { id: 'tiktok', label: 'TikTok', placeholder: 'Advertiser ID' },
];

function channelLabel(channel: Channel): string {
  if (channel === 'ad_account') return 'Tài khoản quảng cáo';
  return CHANNELS.find((item) => item.id === channel)?.label ?? 'Facebook';
}

function pageError(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  if (code === 'page_owned_by_other_client') return 'Page ID này đã thuộc Client khác.';
  if (code === 'page_already_added') return 'Page ID này đã gắn với Client này.';
  if (code === 'invalid_page_id') return 'Page ID phải là dãy số, từ 6 chữ số. Google được phép có dấu gạch.';
  if (code === 'invalid_channel') return 'Chọn Facebook, Zalo, Google hoặc TikTok.';
  if (code === 'page_not_in_business_token') return 'Page này không nằm trong danh sách của token Business Manager chung.';
  if (code === 'business_token_missing') return 'Chưa có token Business Manager chung.';
  return code || 'Không lưu được Page';
}

export function ClientPagesPanel({ token, clientId, canMutate, onMessage, onError }: Props) {
  const [pages, setPages] = useState<PortalClientPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<Channel>('facebook');
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [editing, setEditing] = useState<PortalClientPage | null>(null);
  const [businessPages, setBusinessPages] = useState<Array<{ id: string; name: string }>>([]);
  const [businessReady, setBusinessReady] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const out = await fetchClientPortalPages(token, clientId);
      setPages(out.pages ?? []);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải Page thất bại');
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [token, clientId, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void fetchMetaBusinessPages(token)
      .then((out) => {
        setBusinessPages(out.pages ?? []);
        setBusinessReady(true);
      })
      .catch(() => {
        setBusinessPages([]);
        setBusinessReady(false);
      });
  }, [token]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate) return;
    setBusy(true);
    onError?.('');
    try {
      await addClientPortalPage(token, clientId, { channel, page_id: pageId.trim(), page_name: pageName.trim() });
      setPageId('');
      setPageName('');
      onMessage?.('Đã gắn Page. Client chỉ thấy Page của mình.');
      await reload();
    } catch (err) {
      onError?.(pageError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate || !editing) return;
    setBusy(true);
    onError?.('');
    try {
      await updateClientPortalPage(token, clientId, editing.id, {
        channel: editing.channel,
        page_id: editing.page_id.trim(),
        page_name: editing.page_name.trim(),
      });
      setEditing(null);
      onMessage?.('Đã sửa Page ID.');
      await reload();
    } catch (err) {
      onError?.(pageError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(rowId: string) {
    if (!canMutate) return;
    setBusy(true);
    onError?.('');
    try {
      await removeClientPortalPage(token, clientId, rowId);
      if (editing?.id === rowId) setEditing(null);
      onMessage?.('Đã gỡ Page khỏi Client.');
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Gỡ Page thất bại');
    } finally {
      setBusy(false);
    }
  }

  const placeholder = CHANNELS.find((item) => item.id === channel)?.placeholder ?? 'Page ID';

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Page của Client</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Facebook Page và Account ID lấy từ token chung. ID nào Client đã có ở Kênh ads và token trả về thì được gán vào Client. Zalo, Google và TikTok vẫn nhập ID.{' '}
        <Link href="/agency/meta-token">Token Business Manager</Link>
      </p>
      {loading ? <p className="muted">Đang tải Page…</p> : null}
      {canMutate ? (
        <form onSubmit={(e) => void handleAdd(e)} style={{ display: 'grid', gap: '0.75rem', maxWidth: 480, marginBottom: '1rem' }}>
          <label>
            Kênh
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {channel === 'facebook' ? 'Page trong token chung' : 'Page ID'}
            {channel === 'facebook' ? (
              <select
                value={pageId}
                required
                onChange={(e) => {
                  const id = e.target.value;
                  const found = businessPages.find((page) => page.id === id);
                  setPageId(id);
                  setPageName(found?.name ?? '');
                }}
              >
                <option value="">{businessReady ? 'Chọn Page' : 'Chưa có token chung'}</option>
                {businessPages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name || 'Page'} · {page.id}
                  </option>
                ))}
              </select>
            ) : (
              <input value={pageId} onChange={(e) => setPageId(e.target.value)} required placeholder={placeholder} />
            )}
          </label>
          {channel === 'facebook' ? null : (
            <label>
              Tên Page
              <input value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Tên hiển thị" />
            </label>
          )}
          <button type="submit" className="btn btn-sm" disabled={busy}>
            Thêm Page
          </button>
        </form>
      ) : (
        <p className="muted">Chỉ Super Admin / quyền ghi Client mới thêm hoặc sửa Page.</p>
      )}
      {editing ? (
        <form onSubmit={(e) => void handleSaveEdit(e)} style={{ display: 'grid', gap: '0.75rem', maxWidth: 480, marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Sửa Page</h3>
          <label>
            Kênh
            <select
              value={editing.channel}
              onChange={(e) => setEditing({ ...editing, channel: e.target.value as Channel })}
            >
              {CHANNELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              {editing.channel === 'ad_account' ? <option value="ad_account">Tài khoản quảng cáo</option> : null}
            </select>
          </label>
          {editing.channel === 'facebook' ? (
            <label>
              Page trong token chung
              <select
                value={editing.page_id}
                required
                onChange={(e) => {
                  const id = e.target.value;
                  const found = businessPages.find((page) => page.id === id);
                  setEditing({ ...editing, page_id: id, page_name: found?.name ?? editing.page_name });
                }}
              >
                <option value={editing.page_id}>
                  {editing.page_name || 'Page'} · {editing.page_id}
                </option>
                {businessPages
                  .filter((page) => page.id !== editing.page_id)
                  .map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name || 'Page'} · {page.id}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Page ID
                <input
                  value={editing.page_id}
                  onChange={(e) => setEditing({ ...editing, page_id: e.target.value })}
                  required
                />
              </label>
              <label>
                Tên Page
                <input value={editing.page_name} onChange={(e) => setEditing({ ...editing, page_name: e.target.value })} />
              </label>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-sm" disabled={busy}>
              Lưu Page ID
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
              Hủy
            </button>
          </div>
        </form>
      ) : null}
      <table className="perf-table">
        <thead>
          <tr>
            <th>Kênh</th>
            <th>Tên</th>
            <th>Page ID / Account ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id}>
              <td>{channelLabel(page.channel || 'facebook')}</td>
              <td>{page.page_name || '—'}</td>
              <td>
                <code>{page.page_id}</code>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {canMutate ? (
                  <>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditing(page)}>
                      Sửa
                    </button>{' '}
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void handleRemove(page.id)}>
                      Gỡ
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {!loading && pages.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                Chưa có Page.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
