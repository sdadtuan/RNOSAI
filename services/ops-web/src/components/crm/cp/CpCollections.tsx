'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  addCpCollectionItem,
  createCpCollection,
  formatCpApiError,
  getCpCollection,
  listCpCollections,
  removeCpCollectionItem,
  type CpCollection,
  type CpScope,
  type CpSmartFilter,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

const MEDIA_TABS = [
  { label: 'Library', href: '/crm/creative-os/media' },
  { label: 'Ingest', href: '/crm/creative-os/media?tab=ingest' },
  { label: 'Collections', href: '/crm/creative-os/media?tab=collections' },
  { label: 'Rights', href: '/crm/creative-os/media?tab=rights' },
  { label: 'Quality', href: '/crm/creative-os/media?tab=quality' },
] as const;

function scopeFrom(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function isSmart(collection: CpCollection | null): boolean {
  return collection?.smart_filter_json != null
    && Object.keys(collection.smart_filter_json).length > 0;
}

function readSmartFilter(form: FormData): CpSmartFilter | null {
  const filter: CpSmartFilter = {};
  const mime = String(form.get('mime') ?? '').trim();
  const state = String(form.get('state') ?? '').trim();
  const projectId = String(form.get('project_id') ?? '').trim();
  const clientId = String(form.get('agency_client_id') ?? '').trim();
  const tag = String(form.get('tag') ?? '').trim();
  if (mime) filter.mime = mime;
  if (state) filter.state = state;
  if (projectId) filter.project_id = projectId;
  if (clientId) filter.agency_client_id = clientId;
  if (tag) filter.tag = tag;
  return Object.keys(filter).length ? filter : null;
}

export function CpCollections() {
  const searchParams = useSearchParams();
  const scope = scopeFrom(searchParams.get('scope'));
  const [items, setItems] = useState<CpCollection[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<CpCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'manual' | 'smart'>('manual');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = (await listCpCollections(token, scope)).items;
      setItems(next);
      setSelectedId((current) => (
        current && next.some((row) => row.id === current) ? current : next[0]?.id ?? ''
      ));
    } catch (caught) {
      setItems([]);
      setSelected(null);
      setError(formatCpApiError(caught, 'Không tải được bộ sưu tập'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !selectedId) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    void getCpCollection(token, selectedId, scope)
      .then((row) => {
        if (!cancelled) setSelected(row);
      })
      .catch((caught) => {
        if (!cancelled) {
          setSelected(null);
          setError(formatCpApiError(caught, 'Không tải được bộ sưu tập'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, scope]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setBusy('create');
    setError('');
    try {
      const created = await createCpCollection(token, {
        name: String(form.get('name') ?? '').trim(),
        smart_filter_json: kind === 'smart' ? readSmartFilter(form) : null,
      }, scope);
      event.currentTarget.reset();
      setKind('manual');
      setSelectedId(created.id);
      await load();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tạo được bộ sưu tập'));
    } finally {
      setBusy('');
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || !selectedId) return;
    const form = new FormData(event.currentTarget);
    setBusy('add');
    setError('');
    try {
      await addCpCollectionItem(token, selectedId, {
        asset_id: String(form.get('asset_id') ?? '').trim(),
      }, scope);
      event.currentTarget.reset();
      setSelected(await getCpCollection(token, selectedId, scope));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không thêm được tài nguyên'));
    } finally {
      setBusy('');
    }
  }

  async function removeItem(assetId: string) {
    const token = getAccessToken();
    if (!token || !selectedId) return;
    setBusy(`remove:${assetId}`);
    setError('');
    try {
      await removeCpCollectionItem(token, selectedId, assetId, scope);
      setSelected(await getCpCollection(token, selectedId, scope));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không gỡ được tài nguyên'));
    } finally {
      setBusy('');
    }
  }

  const assets = selected?.items ?? [];

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Bộ sưu tập</p>
          <h1>Bộ sưu tập</h1>
          <p className="cp-muted">Nhóm thủ công hoặc bộ lọc thông minh theo phạm vi sách của bạn.</p>
        </div>
      </header>

      <nav className="cp-filters" aria-label="Media">
        {MEDIA_TABS.map((tab) => (
          <Link
            key={tab.href}
            className={tab.label === 'Collections' ? 'cp-btn cp-btn--primary' : 'cp-btn'}
            href={tab.href}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}

      <form className="cp-card" onSubmit={create}>
        <header className="cp-card__head"><h2>Tạo bộ sưu tập</h2></header>
        <div className="cp-filters">
          <label>
            <span>Tên *</span>
            <input name="name" required />
          </label>
          <label>
            <span>Loại</span>
            <select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value === 'smart' ? 'smart' : 'manual')}
            >
              <option value="manual">Thủ công</option>
              <option value="smart">Thông minh</option>
            </select>
          </label>
          {kind === 'smart' ? (
            <>
              <label><span>MIME prefix</span><input name="mime" placeholder="image/" /></label>
              <label><span>State</span><input name="state" placeholder="ready" /></label>
              <label><span>Project ID</span><input name="project_id" /></label>
              <label><span>Client ID</span><input name="agency_client_id" /></label>
              <label><span>Tag</span><input name="tag" /></label>
            </>
          ) : null}
          <button className="cp-btn cp-btn--primary" type="submit" disabled={busy === 'create'}>
            {busy === 'create' ? 'Đang tạo…' : 'Tạo'}
          </button>
        </div>
      </form>

      <section className="cp-card">
        <header className="cp-card__head"><h2>Danh sách</h2></header>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Loại</th>
                <th>Bộ lọc</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      className="cp-link"
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {dash(row.name)}
                    </button>
                  </td>
                  <td>{isSmart(row) ? 'Thông minh' : 'Thủ công'}</td>
                  <td>{dash(row.smart_filter_json ? JSON.stringify(row.smart_filter_json) : null)}</td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={3}>
                    {loading ? 'Đang tải…' : (
                      <>
                        <p className="cp-muted">Chưa có dữ liệu</p>
                        <p className="cp-empty">{dash(null)}</p>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cp-card">
        <header className="cp-card__head">
          <h2>Tài nguyên trong {dash(selected?.name)}</h2>
        </header>
        {selected && !isSmart(selected) ? (
          <form className="cp-filters" onSubmit={addItem} style={{ marginBottom: 12 }}>
            <label>
              <span>Asset ID trong phạm vi *</span>
              <input name="asset_id" required />
            </label>
            <button className="cp-btn" type="submit" disabled={busy === 'add'}>
              {busy === 'add' ? 'Đang thêm…' : 'Thêm'}
            </button>
          </form>
        ) : null}
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>MIME</th>
                <th>State</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assets.length ? assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <Link className="cp-link" href={`/crm/creative-os/media/${asset.id}`}>
                      {dash(asset.filename)}
                    </Link>
                  </td>
                  <td>{dash(asset.mime)}</td>
                  <td>{dash(asset.state)}</td>
                  <td>
                    {selected && !isSmart(selected) ? (
                      <button
                        className="cp-btn"
                        type="button"
                        disabled={busy === `remove:${asset.id}`}
                        onClick={() => void removeItem(asset.id)}
                      >
                        Gỡ
                      </button>
                    ) : dash(null)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={4}>
                    <p className="cp-muted">Chưa có dữ liệu</p>
                    <p className="cp-empty">{dash(null)}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
