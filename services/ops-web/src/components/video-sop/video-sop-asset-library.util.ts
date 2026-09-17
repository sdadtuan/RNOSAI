export function resolveLibraryLifecycleId(
  queryLifecycleId?: number,
  projectLifecycleId?: number,
): number | undefined {
  if (queryLifecycleId && queryLifecycleId > 0) return queryLifecycleId;
  if (projectLifecycleId && projectLifecycleId > 0) return projectLifecycleId;
  return undefined;
}

export function formatAssetSha8(sha: string | null | undefined): string {
  if (!sha) return '—';
  return sha.slice(0, 8);
}

export function formatAssetSize(w: number | null, h: number | null): string {
  if (w == null || h == null) return '—';
  return `${w}×${h}`;
}
