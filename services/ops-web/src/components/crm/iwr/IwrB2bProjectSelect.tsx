'use client';

import { iwrB2bProjectOptionLabel, iwrProjectMetaPatch } from '@/components/crm/iwr/iwr-b2b-project';
import { useIwrB2bProjects } from '@/components/crm/iwr/useIwrB2bProjects';
import type { B2bProjectListItem } from '@/lib/b2b-projects-api';

type IwrB2bProjectSelectProps = {
  token: string;
  value: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  onChange: (projectId: string, project: B2bProjectListItem | null) => void;
};

export function IwrB2bProjectSelect({
  token,
  value,
  disabled,
  className = 'iwr-tag',
  required,
  onChange,
}: IwrB2bProjectSelectProps) {
  const { projects, loading, error } = useIwrB2bProjects(token);

  return (
    <select
      className={className}
      value={value}
      disabled={disabled || loading}
      required={required}
      aria-label="Dự án PTT"
      title={error || undefined}
      onChange={(e) => {
        const projectId = e.target.value;
        const project = projects.find((p) => p.id === projectId) ?? null;
        onChange(projectId, project);
      }}
    >
      <option value="">{loading ? 'Đang tải dự án…' : '— Chọn dự án PTT —'}</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {iwrB2bProjectOptionLabel(project)}
        </option>
      ))}
    </select>
  );
}

export function iwrB2bProjectSelectPatch(project: B2bProjectListItem | null) {
  return iwrProjectMetaPatch(project);
}
