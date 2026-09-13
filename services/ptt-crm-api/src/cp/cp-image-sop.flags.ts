function isEnabled(value: string | undefined): boolean {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}

export type ImageSopRouterMode = 'manual' | 'recommended';

export function readImageSopFlags(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  router: ImageSopRouterMode;
  variantMax: number;
  batchMax: number;
} {
  const routerRaw = String(env.CP_IMAGE_SOP_ROUTER ?? 'manual').trim().toLowerCase();
  const router: ImageSopRouterMode = routerRaw === 'recommended' ? 'recommended' : 'manual';
  const variantMax = parsePositiveInt(env.CP_IMAGE_SOP_VARIANT_MAX, 4);
  const batchMax = parsePositiveInt(env.CP_IMAGE_SOP_BATCH_MAX, 30);
  return {
    enabled: isEnabled(env.CP_IMAGE_SOP_ENABLED),
    router,
    variantMax,
    batchMax,
  };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
