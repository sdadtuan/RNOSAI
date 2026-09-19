'use client';

import { PM_CLIENT_OPTIONS, PM_PROJECT_OPTIONS } from '@/lib/performance-clients';

type Props = {
  client: string;
  project?: string;
  onClientChange: (client: string) => void;
  onProjectChange?: (project: string) => void;
  showProject?: boolean;
  className?: string;
};

export function PmClientScopeFilters({
  client,
  project = 'all',
  onClientChange,
  onProjectChange,
  showProject = false,
  className,
}: Props) {
  return (
    <div className={className ?? 'kpi-hub-pm-fields'} style={{ marginBottom: 12 }}>
      <label className="kpi-hub-field">
        <span>Client</span>
        <select
          aria-label="Lọc theo Client"
          value={client}
          onChange={(e) => onClientChange(e.target.value)}
        >
          <option value="all">Tất cả client</option>
          {PM_CLIENT_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {showProject && onProjectChange ? (
        <label className="kpi-hub-field">
          <span>Project</span>
          <select
            aria-label="Lọc theo Project"
            value={project}
            onChange={(e) => onProjectChange(e.target.value)}
          >
            <option value="all">Tất cả project</option>
            {PM_PROJECT_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
