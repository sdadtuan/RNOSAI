'use client';

import Link from 'next/link';
import type { VdLibraryAssetRow } from '@/lib/video-sop-api';
import { withVdLifecycleQuery } from '@/lib/crm/video-sop-routes';
import { formatAssetSha8, formatAssetSize } from './video-sop-asset-library.util';

const KINDS = ['', 'keyframe', 'take', 'master', 'proxy', 'package'] as const;

export function VideoSopAssetLibrary({
  projectId,
  lifecycleId,
  items,
  loading,
  error,
  scope,
  kind,
  q,
  onScopeChange,
  onKindChange,
  onQChange,
  onSearch,
}: {
  projectId: number;
  lifecycleId: number;
  items: VdLibraryAssetRow[];
  loading: boolean;
  error: string;
  scope: 'project' | 'lifecycle';
  kind: string;
  q: string;
  onScopeChange: (scope: 'project' | 'lifecycle') => void;
  onKindChange: (kind: string) => void;
  onQChange: (q: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="vd-cmd">
      <p style={{ margin: '0 0 12px' }}>
        <Link href={withVdLifecycleQuery(`/crm/video/${projectId}`, lifecycleId)} className="vd-btn">
          ← Về workspace
        </Link>
      </p>

      <div className="vd-card">
        <div className="vd-actions" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <label>
            Scope{' '}
            <select
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as 'project' | 'lifecycle')}
              aria-label="Phạm vi asset"
            >
              <option value="project">Project này</option>
              <option value="lifecycle">Cả lifecycle</option>
            </select>
          </label>
          <label>
            Kind{' '}
            <select
              value={kind}
              onChange={(e) => onKindChange(e.target.value)}
              aria-label="Loại asset"
            >
              {KINDS.map((k) => (
                <option key={k || 'all'} value={k}>
                  {k || 'All'}
                </option>
              ))}
            </select>
          </label>
          <input
            className="vd-search-input"
            type="search"
            placeholder="id / sha / storage_key…"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch();
            }}
            aria-label="Tìm asset"
          />
          <button type="button" className="vd-btn vd-btn--primary" onClick={onSearch}>
            Tìm
          </button>
        </div>

        {loading ? <p className="vd-status">Đang tải…</p> : null}
        {error ? <p className="vd-status vd-status--error">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="vd-empty">Chưa có asset khớp bộ lọc.</p>
        ) : null}

        {items.length > 0 ? (
          <div className="vd-table-scroll">
            <table className="vd-table">
              <thead>
                <tr>
                  <th>PROJECT</th>
                  <th>KIND</th>
                  <th>ASSET #</th>
                  <th>SHA8</th>
                  <th>SIZE</th>
                  <th>UPDATED</th>
                  <th>PREVIEW</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={withVdLifecycleQuery(`/crm/video/${row.project_id}`, lifecycleId)}>
                        {row.project_title || `Video #${row.project_id}`}
                      </Link>
                    </td>
                    <td>{row.kind}</td>
                    <td>{row.id}</td>
                    <td>{formatAssetSha8(row.sha256)}</td>
                    <td>{formatAssetSize(row.width, row.height)}</td>
                    <td>{row.created_at ? String(row.created_at).slice(0, 10) : '—'}</td>
                    <td>
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noreferrer">
                          Mở
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
