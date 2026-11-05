'use client';

import Link from 'next/link';
import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';
import { SkpiClassificationBadge } from './SkpiClassificationBadge';

type Props = {
  rows: ServiceKpiInstanceItem[];
  dictionaryLabels?: Record<string, string>;
  onSelect?: (row: ServiceKpiInstanceItem) => void;
};

function readinessBadge(level?: string): { label: string; tone: string } {
  if (!level || level === 'pass' || level === 'ready') return { label: 'Ready', tone: 'green' };
  if (level === 'fail') return { label: 'Blocking', tone: 'red' };
  return { label: 'Warning', tone: 'amber' };
}

function statusBadge(status: string): { label: string; tone: string } {
  if (status === 'AT_RISK') return { label: 'AT RISK', tone: 'red' };
  if (status === 'TRACKING') return { label: 'TRACKING', tone: 'blue' };
  return { label: status, tone: 'gray' };
}

export function ServiceKpiInstanceTable({ rows, dictionaryLabels = {}, onSelect }: Props) {
  if (!rows.length) {
    return (
      <div className="kpi-hub-empty">
        <p>Chưa có KPI instance — bấm 「+ Tạo KPI Instance」 hoặc thêm DV vào Quote để kế thừa template.</p>
      </div>
    );
  }

  return (
    <div className="kpi-hub-table-wrap">
      <table className="kpi-hub-table">
        <thead>
          <tr>
            <th>KPI / Source</th>
            <th>Classification</th>
            <th>Target / Scenario</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Readiness</th>
            <th>Owner</th>
            <th>Status</th>
            <th aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const readiness = readinessBadge(row.readiness_level);
            const status = statusBadge(row.status);
            const varianceClass =
              row.variance_pct != null && row.variance_pct > 0 ? 'kpi-hub-skpi-variance--bad' : undefined;
            return (
              <tr key={row.id} onClick={() => onSelect?.(row)} className={onSelect ? 'kpi-hub-row-clickable' : ''}>
                <td>
                  <span className="kpi-hub-table__mono kpi-hub-linkish">
                    {dictionaryLabels[row.dictionary_id] ?? row.dictionary_id}
                  </span>
                  <div className="kpi-hub-table__sub">
                    {row.source_id}
                    {row.dv_code ? ` · ${row.dv_code}` : ''}
                  </div>
                </td>
                <td>
                  <SkpiClassificationBadge classification={row.classification} />
                </td>
                <td>
                  {row.target_min ?? '—'} – {row.target_max ?? '—'}
                  <div className="kpi-hub-table__sub">{row.scenario}</div>
                </td>
                <td>
                  <b>{row.latest_actual ?? '—'}</b>
                </td>
                <td className={varianceClass}>
                  {row.variance_pct != null
                    ? row.variance_pct > 0
                      ? `+${row.variance_pct}%`
                      : row.variance_pct === 0
                        ? 'On track'
                        : `${row.variance_pct}%`
                    : '—'}
                </td>
                <td>
                  <span className={`kpi-hub-badge kpi-hub-badge--${readiness.tone}`}>{readiness.label}</span>
                </td>
                <td>{row.owner_name ?? '—'}</td>
                <td>
                  <span className={`kpi-hub-badge kpi-hub-badge--${status.tone}`}>{status.label}</span>
                </td>
                <td>
                  <div className="kpi-hub-table__actions">
                    <Link
                      href={`/crm/kpi-hub/measurement?instance=${encodeURIComponent(row.id)}`}
                      className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Plan
                    </Link>
                    <Link
                      href={`/crm/kpi-hub/tracking?instance=${encodeURIComponent(row.id)}`}
                      className="kpi-hub-btn kpi-hub-btn--ghost kpi-hub-btn--sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Track
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
