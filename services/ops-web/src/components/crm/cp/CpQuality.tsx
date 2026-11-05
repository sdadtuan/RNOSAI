'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  formatCpApiError,
  getCpQuality,
  type CpAsset,
  type CpQualityReport,
  type CpScope,
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

function emptyReport(): CpQualityReport {
  return { missing_metadata_count: null, missing_metadata: [], duplicates: [] };
}

export function CpQuality() {
  const searchParams = useSearchParams();
  const scope = scopeFrom(searchParams.get('scope'));
  const [report, setReport] = useState<CpQualityReport>(emptyReport);
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
      setReport(await getCpQuality(token, scope));
    } catch (caught) {
      setReport(emptyReport());
      setError(formatCpApiError(caught, 'Không tải được chất lượng media'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const missing = report.missing_metadata ?? [];
  const duplicates = report.duplicates ?? [];

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Chất lượng</p>
          <h1>Chất lượng &amp; trùng lặp</h1>
          <p className="cp-muted">Thiếu metadata và ứng viên trùng theo hash. Không xóa tự động.</p>
        </div>
      </header>

      <nav className="cp-filters" aria-label="Media">
        {MEDIA_TABS.map((tab) => (
          <Link
            key={tab.href}
            className={tab.label === 'Quality' ? 'cp-btn cp-btn--primary' : 'cp-btn'}
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

      <section className="cp-card">
        <header className="cp-card__head"><h2>Thiếu metadata</h2></header>
        <p className="cp-muted">
          Số asset thiếu filename / MIME / hash / bytes:{' '}
          <strong>{dash(report.missing_metadata_count)}</strong>
        </p>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>MIME</th>
                <th>Hash</th>
                <th>Bytes</th>
              </tr>
            </thead>
            <tbody>
              {missing.length ? missing.map((asset) => (
                <AssetRow key={asset.id} asset={asset} />
              )) : (
                <tr>
                  <td className="cp-empty" colSpan={4}>
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
        <header className="cp-card__head"><h2>Trùng hash</h2></header>
        {duplicates.length ? duplicates.map((group) => (
          <div key={group.hash} className="cp-table-wrap" style={{ marginBottom: 12 }}>
            <p className="cp-muted">
              Hash {dash(group.hash)} · {dash(group.count)} file
            </p>
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>MIME</th>
                  <th>Hash</th>
                  <th>Bytes</th>
                </tr>
              </thead>
              <tbody>
                {(group.items ?? []).map((asset) => (
                  <AssetRow key={asset.id} asset={asset} />
                ))}
              </tbody>
            </table>
          </div>
        )) : (
          <>
            <p className="cp-muted">{loading ? 'Đang tải…' : 'Chưa có dữ liệu'}</p>
            <p className="cp-empty">{dash(null)}</p>
          </>
        )}
      </section>
    </div>
  );
}

function AssetRow({ asset }: { asset: CpAsset }) {
  return (
    <tr>
      <td>
        <Link className="cp-link" href={`/crm/creative-os/media/${asset.id}`}>
          {dash(asset.filename)}
        </Link>
      </td>
      <td>{dash(asset.mime)}</td>
      <td>{dash(asset.hash)}</td>
      <td>{dash(asset.bytes)}</td>
    </tr>
  );
}
