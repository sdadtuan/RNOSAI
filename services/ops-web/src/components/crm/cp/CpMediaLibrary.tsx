'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { listCpAssets, type CpAsset, type CpScope } from '@/lib/crm/cp-api';
import { CP_SUBTITLES } from '@/lib/crm/cp-copy';
import { dash, rightsStatus } from '@/lib/crm/cp-format';

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

function statusClass(status: ReturnType<typeof rightsStatus>): string {
  if (status === 'block') return 'cp-pill cp-pill--danger';
  if (status === 'warn') return 'cp-pill cp-pill--warning';
  return 'cp-pill';
}

export function CpMediaLibrary() {
  const searchParams = useSearchParams();
  const scope = scopeFrom(searchParams.get('scope'));
  const [assets, setAssets] = useState<CpAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kind, setKind] = useState('all');
  const [loading, setLoading] = useState(true);
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
      const out = await listCpAssets(token, scope);
      setAssets(out.items);
      setSelectedId((current) =>
        current && out.items.some((asset) => asset.id === current) ? current : null,
      );
    } catch (err) {
      setAssets([]);
      setSelectedId(null);
      setError(err instanceof Error ? err.message : 'Không tải được thư viện media');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleAssets = useMemo(
    () => assets.filter((asset) => kind === 'all' || asset.mime.startsWith(`${kind}/`)),
    [assets, kind],
  );
  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  const selectedRights = rightsStatus(selected?.expiry_on);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Thư viện media</p>
          <h1>Thư viện media</h1>
          <p className="cp-muted">{CP_SUBTITLES.medLibrary}</p>
        </div>
        <Link className="cp-btn cp-btn--primary" href="/crm/creative-os/media?tab=ingest">
          Upload
        </Link>
      </header>

      <nav className="cp-filters" aria-label="Media">
        {MEDIA_TABS.map((tab) => (
          <Link key={tab.href} className={tab.label === 'Library' ? 'cp-btn cp-btn--primary' : 'cp-btn'} href={tab.href}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="cp-filters" role="group" aria-label="Loại media">
        {[
          ['all', 'Tất cả'],
          ['image', 'Ảnh'],
          ['video', 'Video'],
          ['audio', 'Audio'],
          ['application', 'Docs'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={kind === value ? 'cp-btn cp-btn--primary' : 'cp-btn'}
            onClick={() => setKind(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}

      <div className="cp-overview-grid">
        <section className="cp-card">
          {visibleAssets.length ? (
            <div className="cp-media-grid">
              {visibleAssets.map((asset) => {
                const rights = rightsStatus(asset.expiry_on);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className="cp-media-card"
                    aria-pressed={selectedId === asset.id}
                    onClick={() => setSelectedId(asset.id)}
                  >
                    <div className="cp-thumb" aria-hidden="true">
                      {(asset.mime.split('/')[0] || 'file').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="cp-media-card__body">
                      <strong>{dash(asset.filename)}</strong>
                      <span className={statusClass(rights)}>{rights ?? dash(asset.state)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <p className="cp-muted">{loading ? 'Đang tải…' : 'Chưa có dữ liệu'}</p>
              <p className="cp-empty">{dash(null)}</p>
            </div>
          )}
        </section>

        <aside className="cp-card">
          <header className="cp-card__head"><h2>Inspector</h2></header>
          {selected ? (
            <>
              <p><b>{dash(selected.filename)}</b></p>
              <p>{dash(selected.state)} · {dash(selected.mime)} · {dash(selected.bytes)} bytes</p>
              <p>Project: {dash(selected.project_id)}</p>
              <p>
                Rights:{' '}
                {selectedRights
                  ? <span className={statusClass(selectedRights)}>{selectedRights}</span>
                  : dash(null)}
                {' · hết '}
                {dash(selected.expiry_on)}
              </p>
              <Link className="cp-btn" href={`/crm/creative-os/media/${selected.id}`}>Chi tiết</Link>
            </>
          ) : (
            <>
              <p className="cp-muted">Chọn một asset để xem inspector.</p>
              <p className="cp-empty">{dash(null)}</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
