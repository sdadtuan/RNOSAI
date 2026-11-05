export type CpRenderProvider = 'stub' | 'video_sop';

export function normalizeRenderProvider(value: unknown): CpRenderProvider | null {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'stub') return 'stub';
  if (text === 'sop' || text === 'video_sop' || text === 'video-sop') return 'video_sop';
  return null;
}

export function resolveRenderProvider(input: {
  config?: Record<string, unknown>;
  routing?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
}): CpRenderProvider {
  const config = input.config ?? {};
  const routing = input.routing ?? {};
  const env = input.env ?? process.env;

  const draftProvider = normalizeRenderProvider(
    config.render_provider ?? config.render_mode,
  );
  if (draftProvider) return draftProvider;

  const routingProvider = normalizeRenderProvider(routing.render_provider);
  if (routingProvider) return routingProvider;

  const mode = String(env.CP_RENDER_MODE ?? 'stub').trim().toLowerCase();
  if (mode === 'sop' || mode === 'video_sop') return 'video_sop';
  if (mode === 'auto') {
    if (config.vd_project_id != null || config.sop_project_id != null) return 'video_sop';
    if (String(config.playbook_id ?? '') === 'tvc_short_169') return 'video_sop';
    return 'stub';
  }
  return 'stub';
}

export function pricingVersionForProvider(provider: CpRenderProvider): string {
  return provider === 'video_sop' ? 'sop-2026-09' : 'stub-2026-09';
}
