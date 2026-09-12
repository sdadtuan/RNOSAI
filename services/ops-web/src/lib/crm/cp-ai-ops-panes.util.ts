export type CpAiOpsPane = 'weave' | 'magnific' | 'comfy';
export type MagnificTransport = 'api' | 'mcp';
export type MagnificProvider = 'magnific_rest' | 'magnific_mcp';
export type MagnificFlagSlice = {
  magnificRest: boolean;
  magnificMcp: boolean;
};

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

export function magnificProviderFromTransport(transport: MagnificTransport): MagnificProvider {
  return transport === 'api' ? 'magnific_rest' : 'magnific_mcp';
}

export function isMagnificTransportEnabled(
  flags: MagnificFlagSlice,
  transport: MagnificTransport,
): boolean {
  return transport === 'api' ? flags.magnificRest : flags.magnificMcp;
}

export function isMagnificComposerDisabled(flags: MagnificFlagSlice): boolean {
  return !flags.magnificRest && !flags.magnificMcp;
}
