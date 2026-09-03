'use client';

import { useMemo, useState } from 'react';
import {
  buildIwrProjectProgress,
  formatIwrProjectProgressUpdated,
  iwrProjectProgressMaxY,
  iwrProjectProgressYTicks,
  type IwrProjectProgressRow,
} from '@/components/crm/iwr/iwr-project-progress';
import type { IwrReportRow } from '@/lib/crm/iwr-api';

const PLOT_HEIGHT = 188;

type IwrProjectProgressChartProps = {
  reports: IwrReportRow[];
};

export function IwrProjectProgressChart({ reports }: IwrProjectProgressChartProps) {
  const built = useMemo(() => buildIwrProjectProgress(reports), [reports]);
  const [projectFilter, setProjectFilter] = useState('all');

  const rows = useMemo(() => {
    if (projectFilter === 'all') return built.rows;
    return built.rows.filter((row) => row.id === projectFilter);
  }, [built.rows, projectFilter]);

  const maxY = iwrProjectProgressMaxY(rows.length ? rows : built.rows);
  const yTicks = iwrProjectProgressYTicks(maxY);

  return (
    <div className="iwr-proj-chart" data-testid="iwr-project-progress-chart">
      <div className="iwr-proj-chart__head">
        <h2>Tiến độ dự án</h2>
        <select
          className="iwr-input iwr-proj-chart__filter"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Lọc dự án"
          data-testid="iwr-project-progress-filter"
        >
          <option value="all">Tất cả dự án</option>
          {built.rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.client ? `${row.name} (${row.client})` : row.name}
            </option>
          ))}
        </select>
      </div>

      <div className="iwr-proj-chart__legend">
        <span>
          <i className="is-green" /> Đúng tiến độ
        </span>
        <span>
          <i className="is-yellow" /> Chậm tiến độ
        </span>
        <span>
          <i className="is-red" /> Nguy cơ
        </span>
      </div>

      <div className="iwr-proj-chart__plot">
        <div className="iwr-proj-chart__yaxis" aria-hidden>
          {yTicks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="iwr-proj-chart__canvas">
          <div className="iwr-proj-chart__grid" aria-hidden>
            {yTicks.slice(0, -1).map((tick) => (
              <span key={tick} style={{ bottom: `${(tick / maxY) * 100}%` }} />
            ))}
          </div>
          <div className="iwr-proj-chart__bars">
            {rows.map((row) => (
              <ProjectBar key={row.id} row={row} maxY={maxY} plotHeight={PLOT_HEIGHT} />
            ))}
          </div>
        </div>
      </div>

      <p className="iwr-proj-chart__foot">
        Số liệu cập nhật đến {formatIwrProjectProgressUpdated(built.updatedAt)}
        {built.fromDemo ? ' · mẫu minh hoạ' : ''}
      </p>
    </div>
  );
}

function ProjectBar({
  row,
  maxY,
  plotHeight,
}: {
  row: IwrProjectProgressRow;
  maxY: number;
  plotHeight: number;
}) {
  const segments: Array<{ tone: 'green' | 'yellow' | 'red'; value: number }> = [
    { tone: 'green', value: row.green },
    { tone: 'yellow', value: row.yellow },
    { tone: 'red', value: row.red },
  ].filter((seg) => seg.value > 0);

  return (
    <div className="iwr-proj-chart__col">
      <div className="iwr-proj-chart__stack" style={{ height: plotHeight }}>
        {segments.map((seg) => (
          <div
            key={seg.tone}
            className={`iwr-proj-chart__seg is-${seg.tone}`}
            style={{ height: `${(seg.value / maxY) * plotHeight}px` }}
          >
            <span>{seg.value}</span>
          </div>
        ))}
      </div>
      <div className="iwr-proj-chart__label">
        <strong>{row.name}</strong>
        {row.client ? <span>({row.client})</span> : null}
      </div>
    </div>
  );
}
