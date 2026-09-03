import type { B2bProjectListItem } from '@/lib/b2b-projects-api';
import type { IwrItemMeta } from './iwr-item-meta';

export type IwrB2bProjectCatalog = Map<string, B2bProjectListItem>;

export function iwrB2bProjectCatalog(projects: B2bProjectListItem[]): IwrB2bProjectCatalog {
  return new Map(projects.map((p) => [p.id, p]));
}

export function iwrB2bProjectOptionLabel(project: B2bProjectListItem): string {
  return `${project.name} (${project.code})`;
}

export function iwrProjectMetaPatch(project: B2bProjectListItem | null): Partial<IwrItemMeta> {
  if (!project) return { b2b_project_id: '', project: '' };
  return { b2b_project_id: project.id, project: iwrB2bProjectOptionLabel(project) };
}

export function resolveIwrB2bProjectId(meta: IwrItemMeta, catalog: IwrB2bProjectCatalog): string {
  const id = String(meta.b2b_project_id ?? '').trim();
  if (id && catalog.has(id)) return id;

  const label = String(meta.project ?? '').trim().toLowerCase();
  if (!label) return '';

  for (const [projectId, project] of catalog) {
    const name = project.name.toLowerCase();
    const code = project.code.toLowerCase();
    const full = iwrB2bProjectOptionLabel(project).toLowerCase();
    if (label === projectId.toLowerCase() || label === name || label === code || label === full) return projectId;
    if (label.includes(name) || label.includes(code)) return projectId;
  }
  return '';
}

export function iwrProjectLabelFromMeta(meta: IwrItemMeta, catalog?: IwrB2bProjectCatalog): string {
  const id = resolveIwrB2bProjectId(meta, catalog ?? new Map());
  if (id && catalog?.has(id)) return iwrB2bProjectOptionLabel(catalog.get(id)!);
  return String(meta.project ?? '').trim();
}
