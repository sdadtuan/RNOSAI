'use client';

import { useMemo, useState } from 'react';
import {
  buildIwrProjectProgress,
  formatIwrProjectProgressUpdated,
  iwrProjectProgressFilterOptions,
  iwrProjectProgressMaxY,
  iwrProjectProgressYTicks,
  type IwrProjectProgressRow,
} from '@/components/crm/iwr/iwr-project-progress';
import { useIwrB2bProjects } from '@/components/crm/iwr/useIwrB2bProjects';
import type { IwrReportRow } from '@/lib/crm/iwr-api';

const PLOT_HEIGHT = 188;

type IwrProjectProgressChartProps = {
  token: string | null | undefined;
  reports: IwrReportRow[];
};

export function IwrProjectProgressChart({ token, reports }: IwrProjectProgressChartProps) {
  const { projects, loading, error } = useIwrB2bProjects(token);
  const built = useMemo(() => buildIwrProjectProgress(reports, projects), [reports, projects]);
  const filterOptions = useMemo(() => iwrProjectProgressFilterOptions(projects), [projects]);
  const [projectFilter, setProjectFilter] = useState('all');

  const rows = useMemo(() => {
    if (projectFilter === 'all') return built.rows;
    const picked = built.rows.find((row) => row.id === projectFilter);
    if (picked) return [picked];
    const project = projects.find((p) => p.id === projectFilter);
    if (!project) return [];
    return [{ id: project.id, name: project.name, code: project.code, green: 0, yellow: 0, red: 0 }];
  }, [built.rows, projectFilter, projects]);

  const maxY = iwrProjectProgressMaxY(rows.length ? rows : built.rows);
  const yTicks = iwrProjectProgressYTicks(maxY);
  const hasData = rows.some((row) => row.green + row.yellow + row.red > 0);

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
          disabled={loading || !filterOptions.length}
        >
          <option value="all">Tất cả dự án</option>
          {filterOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
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

      {error ? <p className="iwr-empty">{error}</p> : null}
      {!error && !loading && !projects.length ? (
        <p className="iwr-empty">Chưa có dự án PTT. Tạo tại mục Dự án PTT.</p>
      ) : null}
      {!error && projects.length && !hasData ? (
        <p className="iwr-empty">Chưa có hạng mục báo cáo gắn dự án PTT trong kỳ này.</p>
      ) : null}

      {hasData ? (
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
              {rows
                .filter((row) => row.green + row.yellow + row.red > 0)
                .map((row) => (
                  <ProjectBar key={row.id} row={row} maxY={maxY} plotHeight={PLOT_HEIGHT} />
                ))}
            </div>
          </div>
        </div>
      ) : null}

      <p className="iwr-proj-chart__foot">
        Số liệu cập nhật đến {formatIwrProjectProgressUpdated(built.updatedAt)}
        {' · '}
        Nguồn dự án: Dự án PTT
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
  const segments = [
    { tone: 'green' as const, value: row.green },
    { tone: 'yellow' as const, value: row.yellow },
    { tone: 'red' as const, value: row.red },
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
        <span>({row.code})</span>
      </div>
    </div>
  );
}
