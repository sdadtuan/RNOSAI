export type CpAiOpsPane = 'weave' | 'magnific' | 'comfy';

const PANES: readonly CpAiOpsPane[] = ['weave', 'magnific', 'comfy'];

export function parseAiOpsPane(raw: string | null): CpAiOpsPane {
  return PANES.includes(raw as CpAiOpsPane) ? (raw as CpAiOpsPane) : 'weave';
}

export function aiOpsHref(
  projectId: string,
  pane: CpAiOpsPane,
  extra?: { wo?: string; job?: string },
): string {
  const params = new URLSearchParams({ tab: 'ai-ops', pane });
  if (extra?.wo) params.set('wo', extra.wo);
  if (extra?.job) params.set('job', extra.job);
  return `/crm/creative-os/projects/${projectId}?${params.toString()}`;
}
