'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { VdProductionReport, VdProjectRow } from '@/lib/video-sop-api';
import { contentBoardHref, vdSopPath, withVdLifecycleQuery } from '@/lib/crm/video-sop-routes';
import { summarizeVdCommandCenter } from './video-sop-command-center.util';

const EMPTY_COPY = 'Chọn Video chiến dịch từ Content Board';

export function VideoSopCommandCenter({
  lifecycleId,
  projects,
  report,
  loading,
  error,
}: {
  lifecycleId?: number;
  projects: VdProjectRow[];
  report: VdProductionReport | null;
  loading: boolean;
  error: string;
}) {
  const [search, setSearch] = useState('');
  const summary = useMemo(
    () => summarizeVdCommandCenter(projects, report),
    [projects, report],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((row) => {
      const title = (row.title || '').toLowerCase();
      return title.includes(q) || String(row.id).includes(q);
    });
  }, [projects, search]);

  const stageMix = Object.entries(summary.stageBuckets)
    .slice(0, 3)
    .map(([stage, count]) => `${stage}:${count}`)
    .join(' · ');

  const firstMetric = summary.metricTiles[0];

  return (
    <div className="vd-cmd">
      <div className="vd-page__head">
        <div>
          <h1>Video Operations Command Center</h1>
          <p className="vd-page__sub">
            Theo dõi project video theo lifecycle — brief, script, gate, render.
          </p>
        </div>
        <div className="vd-actions">
          <Link
            href={vdSopPath('dashboard', { lifecycleId })}
            className="vd-btn"
          >
            Mở Dashboard
          </Link>
          <Link href={contentBoardHref(lifecycleId)} className="vd-btn vd-btn--primary">
            ＋ Từ Content Board
          </Link>
        </div>
      </div>

      {!lifecycleId ? (
        <div className="vd-card">
          <p className="vd-empty">{EMPTY_COPY}</p>
          <Link href={contentBoardHref()} className="vd-btn vd-btn--primary">
            Mở Content Board
          </Link>
        </div>
      ) : (
        <>
          <div className="vd-card">
            <h3>Cần xử lý hôm nay</h3>
            {summary.attentionProjects.length === 0 ? (
              <p className="vd-empty">Không có project cần chú ý trong các stage early.</p>
            ) : (
              <ul className="vd-attention-list">
                {summary.attentionProjects.map((row) => (
                  <li key={row.id}>
                    <Link href={withVdLifecycleQuery(`/crm/video/${row.id}`, lifecycleId)}>
                      <strong>{row.title || `Video #${row.id}`}</strong>
                      <span className="vd-page__sub">
                        {' '}
                        · {row.stage} · {row.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="vd-kpi">
            <div className="vd-kpi__tile">
              <small>Active projects</small>
              <strong>{summary.activeCount}</strong>
            </div>
            <div className="vd-kpi__tile">
              <small>Project count (report)</small>
              <strong>{report?.project_count ?? projects.length}</strong>
            </div>
            <div className="vd-kpi__tile">
              <small>{firstMetric?.label ?? 'Stage mix'}</small>
              <strong>{firstMetric?.valueLabel ?? (stageMix || '—')}</strong>
            </div>
          </div>

          <div className="vd-card" id="projects">
            <div className="vd-page__head" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Projects</h3>
              <input
                className="vd-search-input"
                type="search"
                placeholder="Tìm title hoặc id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Tìm project video"
              />
            </div>
            {loading ? <p className="vd-status">Đang tải…</p> : null}
            {error ? <p className="vd-status vd-status--error">{error}</p> : null}
            {!loading && !error && filtered.length === 0 ? (
              <p className="vd-empty">{EMPTY_COPY}</p>
            ) : null}
            {filtered.length > 0 ? (
              <div className="vd-table-scroll">
                <table className="vd-table">
                  <thead>
                    <tr>
                      <th>TITLE</th>
                      <th>STAGE</th>
                      <th>STATUS</th>
                      <th>ITEM</th>
                      <th>UPDATED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link href={withVdLifecycleQuery(`/crm/video/${row.id}`, lifecycleId)}>
                            {row.title || `Video #${row.id}`}
                          </Link>
                        </td>
                        <td>{row.stage}</td>
                        <td>{row.status}</td>
                        <td>{row.cmkt_item_id ?? '—'}</td>
                        <td>{row.updated_at ? String(row.updated_at).slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
