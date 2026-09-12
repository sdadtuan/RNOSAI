export type CpAiOpsPane = 'weave' | 'magnific' | 'comfy';
export type MagnificTransport = 'api' | 'mcp';
export type MagnificProvider = 'magnific_rest' | 'magnific_mcp';
export type MagnificFlagSlice = {
  magnificRest: boolean;
  magnificMcp: boolean;
};
export type ComfyFlagSlice = { comfy: boolean };
export type ComfyHealthOk = { ok: true; vram_mb: number | null; checked_at: string };
export type ComfyHealthDown = { ok: false; reason: 'gpu_building'; checked_at?: string };
export type ComfyHealth = ComfyHealthOk | ComfyHealthDown;

export const COMFY_LOCKED_COPY = 'Đang xây GPU — chưa nhận job.';
export const COMFY_SETTINGS_STATUS_COPY = 'GPU chưa sẵn sàng';
export const COMFY_HEARTBEAT_MAX_AGE_MS = 30_000;

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

export function shouldShowComfyLockedCopy(health: ComfyHealth | null | undefined): boolean {
  return health?.ok !== true;
}

export function isComfyHeartbeatFresh(
  health: ComfyHealth | null | undefined,
  now = Date.now(),
): boolean {
  if (health?.ok !== true) return false;
  const checkedAt = Date.parse(health.checked_at);
  if (!Number.isFinite(checkedAt)) return false;
  return now - checkedAt < COMFY_HEARTBEAT_MAX_AGE_MS;
}

export function isComfySubmitEnabled(
  flags: ComfyFlagSlice,
  health: ComfyHealth | null | undefined,
  now = Date.now(),
): boolean {
  return flags.comfy === true && isComfyHeartbeatFresh(health, now);
}

export function comfyGatewayInputValue(_saved?: unknown): string {
  return '';
}

export function comfySettingsStatusCopy(_health?: ComfyHealth | null): string {
  return COMFY_SETTINGS_STATUS_COPY;
}
