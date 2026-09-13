export type CpImageSopRouterMode = 'manual' | 'recommended';

export type CpImageSopFlags = {
  enabled: boolean;
  router: CpImageSopRouterMode;
};

export const OFF_CP_IMAGE_FLAGS: CpImageSopFlags = {
  enabled: false,
  router: 'manual',
};

export function isCpImageSopVisible(flags: CpImageSopFlags, canImgView: boolean): boolean {
  return flags.enabled && canImgView;
}
