export type CpImageSopRouterMode = 'manual' | 'recommended';

export type CpImageSopFlags = {
  enabled: boolean;
  router: CpImageSopRouterMode;
};

export const OFF_CP_IMAGE_FLAGS: CpImageSopFlags = {
  enabled: false,
  router: 'manual',
};

export function isCpImageSopFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_CP_IMAGE_SOP ?? '0').trim().toLowerCase(),
  );
}

export function isCpImageSopVisible(flags: CpImageSopFlags, canImgView: boolean): boolean {
  return flags.enabled && canImgView;
}

export function isCpImageSopNavEnabled(
  flags: CpImageSopFlags,
  feEnabled = isCpImageSopFeEnabled(),
): boolean {
  return feEnabled || flags.enabled;
}
